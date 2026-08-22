import { env, exports } from 'cloudflare:workers'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bytesToBase64Url, hashText } from '../src/lib/crypto'
import { verifyPassword } from '../src/lib/password'
import { hasValidFileSignature } from '../src/routes/memories'

const ORIGIN = 'https://our-corner.test'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple!'
let passwordHash = ''

const hashPasswordForTest = async (password: string): Promise<string> => {
  const salt = new Uint8Array(16).fill(7)
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const hash = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
    material,
    256,
  ))
  return `pbkdf2-sha256$100000$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`
}

const request = (
  path: string,
  init: RequestInit = {},
  cookie?: string,
  origin = ORIGIN,
) => {
  const headers = new Headers(init.headers)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD'].includes(init.method ?? 'GET')) headers.set('Origin', origin)
  if (cookie) headers.set('Cookie', cookie)
  return exports.default.fetch(`${ORIGIN}${path}`, { ...init, headers })
}

const login = async (email = 'one@example.test', password = TEST_PASSWORD) => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const setCookie = response.headers.get('set-cookie') ?? ''
  return { response, cookie: setCookie.split(';')[0] ?? '', setCookie }
}

beforeAll(async () => {
  passwordHash = await hashPasswordForTest(TEST_PASSWORD)
})

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM idempotency_keys'),
    env.DB.prepare('DELETE FROM login_attempts'),
    env.DB.prepare('DELETE FROM sessions'),
    env.DB.prepare('DELETE FROM memory_media'),
    env.DB.prepare('DELETE FROM memories'),
    env.DB.prepare('DELETE FROM timeline_entries'),
    env.DB.prepare('DELETE FROM relationships'),
    env.DB.prepare('DELETE FROM users'),
  ])
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .bind('partner-1', 'one@example.test', 'Partner One', passwordHash, now, now),
    env.DB.prepare('INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
      .bind('partner-2', 'two@example.test', 'Partner Two', passwordHash, now, now),
  ])
  await env.DB.prepare(`
    INSERT INTO relationships (id, title, start_date, timezone, partner_1_user_id, partner_2_user_id, created_at, updated_at)
    VALUES ('primary', 'Our Corner', '2025-08-20', 'Europe/London', 'partner-1', 'partner-2', ?, ?)
  `).bind(now, now).run()
})

describe('password and media validation helpers', () => {
  it('verifies a PBKDF2 password and rejects the wrong password', async () => {
    await expect(verifyPassword(TEST_PASSWORD, passwordHash)).resolves.toBe(true)
    await expect(verifyPassword('wrong password', passwordHash)).resolves.toBe(false)
    await expect(verifyPassword(TEST_PASSWORD, 'malformed')).resolves.toBe(false)
  })

  it('accepts supported signatures and rejects MIME spoofing', () => {
    expect(hasValidFileSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(hasValidFileSignature('image/png', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false)
    expect(hasValidFileSignature('video/webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true)
  })
})

describe('authentication and session security', () => {
  it('returns a generic wrong-credentials error and eventually rate-limits failures', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login('one@example.test', 'wrong password')
      expect(response.response.status).toBe(401)
      const payload = await response.response.json<{ error: { code: string; message: string } }>()
      expect(payload.error.code).toBe('INVALID_CREDENTIALS')
      expect(payload.error.message).toBe('The email or password is incorrect.')
    }
    const throttled = await login('one@example.test', 'wrong password')
    expect(throttled.response.status).toBe(429)
    expect(throttled.response.headers.get('retry-after')).toBe('900')
  })

  it('creates a secure cookie, stores only its hash, expires it, and invalidates it on logout', async () => {
    const signedIn = await login()
    expect(signedIn.response.status).toBe(200)
    expect(signedIn.setCookie).toContain('HttpOnly')
    expect(signedIn.setCookie).toContain('Secure')
    expect(signedIn.setCookie).toContain('SameSite=Strict')
    expect(signedIn.setCookie).toContain('Max-Age=2592000')

    const rawToken = signedIn.cookie.split('=')[1] ?? ''
    const stored = await env.DB.prepare('SELECT token_hash FROM sessions').first<{ token_hash: string }>()
    expect(stored?.token_hash).toBe(await hashText(rawToken))
    expect(stored?.token_hash).not.toBe(rawToken)
    expect((await request('/api/auth/me', {}, signedIn.cookie)).status).toBe(200)

    await env.DB.prepare('UPDATE sessions SET expires_at = ?').bind(Date.now() - 1).run()
    expect((await request('/api/auth/me', {}, signedIn.cookie)).status).toBe(401)

    const second = await login()
    expect((await request('/api/auth/logout', { method: 'POST' }, second.cookie)).status).toBe(200)
    expect((await request('/api/auth/me', {}, second.cookie)).status).toBe(401)
  })

  it('blocks cross-origin mutations and unauthenticated relationship access', async () => {
    const crossOrigin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'one@example.test', password: TEST_PASSWORD }),
    }, undefined, 'https://attacker.example')
    expect(crossOrigin.status).toBe(403)
    expect((await request('/api/relationship')).status).toBe(401)
  })
})

describe('relationship, memory, and private media authorization', () => {
  it('requires confirmation for a start-date change and accepts the confirmed mutation', async () => {
    const { cookie } = await login()
    const unconfirmed = await request('/api/relationship', {
      method: 'PATCH',
      body: JSON.stringify({ startDate: '2025-08-21' }),
    }, cookie)
    expect(unconfirmed.status).toBe(409)

    const confirmed = await request('/api/relationship', {
      method: 'PATCH',
      body: JSON.stringify({ startDate: '2025-08-21', confirmStartDateChange: true }),
    }, cookie)
    expect(confirmed.status).toBe(200)
  })

  it('creates memories idempotently and rejects oversized uploads before parsing', async () => {
    const { cookie } = await login()
    const injectedTitle = "Rain'); DROP TABLE memories; --"
    const body = JSON.stringify({ title: injectedTitle, caption: 'Two coffees.', location: 'London', date: '2026-01-10', category: 'Dates', favorite: true })
    const headers = { 'Idempotency-Key': 'test-key-1234567890' }
    const first = await request('/api/memories', { method: 'POST', headers, body }, cookie)
    const second = await request('/api/memories', { method: 'POST', headers, body }, cookie)
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM memories').first<number>('total')).toBe(1)
    const payload = await first.json<{ data: { id: string; title: string; location: string } }>()
    expect(payload.data.title).toBe(injectedTitle)
    expect(payload.data.location).toBe('London')
    expect(await env.DB.prepare('SELECT COUNT(*) AS total FROM memories').first<number>('total')).toBe(1)

    const oversized = await request(`/api/memories/${payload.data.id}/media`, {
      method: 'POST',
      headers: { 'Content-Length': String(81 * 1024 * 1024 + 1) },
    }, cookie)
    expect(oversized.status).toBe(413)
  })

  it('keeps a 101-memory archive bounded with stable cursor pagination', async () => {
    const { cookie } = await login()
    const now = Date.now()
    const statements = Array.from({ length: 101 }, (_, index) => {
      const month = String(Math.floor(index / 28) + 1).padStart(2, '0')
      const day = String((index % 28) + 1).padStart(2, '0')
      return env.DB.prepare(`
        INSERT INTO memories (
          id, relationship_id, created_by_user_id, title, caption, location,
          memory_date, category, favorite, created_at, updated_at
        ) VALUES (?, 'primary', 'partner-1', ?, '', '', ?, 'Everyday', 0, ?, ?)
      `).bind(`memory-${String(index).padStart(3, '0')}`, `Memory ${index}`, `2026-${month}-${day}`, now + index, now + index)
    })
    await env.DB.batch(statements)

    const first = await request('/api/memories?limit=20&sort=newest', {}, cookie)
    const firstPayload = await first.json<{ data: { items: Array<{ id: string }>; nextCursor: string | null } }>()
    expect(first.status).toBe(200)
    expect(firstPayload.data.items).toHaveLength(20)
    expect(firstPayload.data.nextCursor).toBeTruthy()

    const second = await request(`/api/memories?limit=20&sort=newest&cursor=${encodeURIComponent(firstPayload.data.nextCursor ?? '')}`, {}, cookie)
    const secondPayload = await second.json<{ data: { items: Array<{ id: string }>; nextCursor: string | null } }>()
    expect(second.status).toBe(200)
    expect(secondPayload.data.items).toHaveLength(20)
    expect(new Set([...firstPayload.data.items, ...secondPayload.data.items].map((item) => item.id)).size).toBe(40)
  })

  it('never exposes R2 keys and serves authorized video byte ranges only', async () => {
    const { cookie } = await login()
    const now = Date.now()
    const memoryId = crypto.randomUUID()
    const mediaId = crypto.randomUUID()
    const key = `primary/${memoryId}/${crypto.randomUUID()}.mp4`
    const bytes = new Uint8Array([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: 'video/mp4' } })
    await env.DB.prepare(`
      INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at)
      VALUES (?, 'primary', 'partner-1', 'Clip', '', '2026-01-01', 'Dates', 0, ?, ?)
    `).bind(memoryId, now, now).run()
    await env.DB.prepare(`
      INSERT INTO memory_media (id, memory_id, r2_key, media_type, mime_type, size_bytes, alt_text, original_filename, sort_order, created_at)
      VALUES (?, ?, ?, 'video', 'video/mp4', ?, 'A short clip', 'clip.mp4', 0, ?)
    `).bind(mediaId, memoryId, key, bytes.byteLength, now).run()

    expect((await request(`/api/media/${mediaId}`)).status).toBe(401)
    const ranged = await request(`/api/media/${mediaId}`, { headers: { Range: 'bytes=0-3' } }, cookie)
    expect(ranged.status).toBe(206)
    expect(ranged.headers.get('content-range')).toBe(`bytes 0-3/${bytes.byteLength}`)
    expect(ranged.headers.get('cache-control')).toContain('private')
    expect(new Uint8Array(await ranged.arrayBuffer())).toEqual(bytes.slice(0, 4))

    const listed = await request('/api/memories', {}, cookie)
    expect(await listed.text()).not.toContain(key)
  })
})
