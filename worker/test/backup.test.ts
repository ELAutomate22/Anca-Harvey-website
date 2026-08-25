import { env, exports } from 'cloudflare:workers'
import { scryptSync } from 'node:crypto'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createCsv } from '../src/backup/csv'
import { assertSafeArchivePath, memoryMediaArchivePath, safeArchiveSegment } from '../src/backup/filenames'
import { bytesToBase64Url } from '../src/lib/crypto'
import { SCRYPT_N, SCRYPT_P, SCRYPT_R } from '../src/lib/password'

const ORIGIN = 'https://our-corner.test'
const TEST_PASSWORD = 'Correct-Horse-Battery-Staple!'
let passwordHash = ''

const hashPasswordForTest = (password: string): string => {
  const salt = new Uint8Array(16).fill(11)
  const hash = scryptSync(password, salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${bytesToBase64Url(salt)}$${bytesToBase64Url(hash)}`
}

const request = (path: string, init: RequestInit = {}, cookie?: string) => {
  const headers = new Headers(init.headers)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD'].includes(init.method ?? 'GET')) headers.set('Origin', ORIGIN)
  if (cookie) headers.set('Cookie', cookie)
  return exports.default.fetch(`${ORIGIN}${path}`, { ...init, headers })
}

const login = async (email = 'one@example.test', password = TEST_PASSWORD) => {
  const response = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  const setCookie = response.headers.get('set-cookie') ?? ''
  return { response, cookie: setCookie.split(';')[0] ?? '' }
}

beforeAll(() => {
  passwordHash = hashPasswordForTest(TEST_PASSWORD)
})

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM backup_jobs'),
    env.DB.prepare('DELETE FROM idempotency_keys'),
    env.DB.prepare('DELETE FROM login_attempts'),
    env.DB.prepare('DELETE FROM sessions'),
    env.DB.prepare('DELETE FROM future_letter_media'),
    env.DB.prepare('DELETE FROM future_letters'),
    env.DB.prepare('DELETE FROM bucket_list_items'),
    env.DB.prepare('DELETE FROM activity_history'),
    env.DB.prepare('DELETE FROM planned_activities'),
    env.DB.prepare('DELETE FROM activity_suggestions'),
    env.DB.prepare('DELETE FROM saved_activities'),
    env.DB.prepare('DELETE FROM activity_exclusions'),
    env.DB.prepare('DELETE FROM activities WHERE is_builtin = 0'),
    env.DB.prepare('DELETE FROM memory_media'),
    env.DB.prepare('DELETE FROM memories'),
    env.DB.prepare('DELETE FROM timeline_entries'),
    env.DB.prepare('DELETE FROM movie_history_ratings'),
    env.DB.prepare('DELETE FROM movie_history'),
    env.DB.prepare('DELETE FROM movie_watchlist'),
    env.DB.prepare('DELETE FROM game_history'),
    env.DB.prepare('DELETE FROM games WHERE built_in = 0'),
    env.DB.prepare('DELETE FROM songs'),
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
    VALUES ('primary', 'Our Corner', '2025-08-28', 'Europe/London', 'partner-1', 'partner-2', ?, ?)
  `).bind(now, now).run()
})

const readZipEntries = (bytes: Uint8Array): Map<string, Uint8Array> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.byteLength - 22
  while (end >= Math.max(0, bytes.byteLength - 65_557) && view.getUint32(end, true) !== 0x06054b50) end -= 1
  if (end < 0) throw new Error('ZIP end-of-central-directory record was not found.')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const entries = new Map<string, Uint8Array>()
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP central directory entry.')
    const size = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength))
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Invalid ZIP local header.')
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    entries.set(name, bytes.slice(dataStart, dataStart + size))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

const decodeEntry = (entries: Map<string, Uint8Array>, name: string): string => {
  const value = entries.get(name)
  if (!value) throw new Error(`ZIP entry not found: ${name}`)
  return new TextDecoder().decode(value).replace(/^\uFEFF/u, '')
}

const requestBackup = async (cookie: string, type: 'data' | 'full', includeMyDrafts = false) => {
  const response = await request(`/api/backup/${type}`, {
    method: 'POST', body: JSON.stringify({ includeMyDrafts }),
  }, cookie)
  const payload = await response.json<{ data: { job: { id: string; downloadUrl: string | null }; reused: boolean } }>()
  return { response, ...payload.data }
}

const downloadBackupForTest = async (cookie: string, type: 'data' | 'full', includeMyDrafts = false) => {
  const created = await requestBackup(cookie, type, includeMyDrafts)
  if (!created.job.downloadUrl) throw new Error('Test backup did not provide a direct download URL.')
  const response = await request(created.job.downloadUrl, {}, cookie)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { created, response, bytes, entries: readZipEntries(bytes) }
}

const insertLetter = async (input: {
  id: string
  creator?: 'partner-1' | 'partner-2'
  type?: 'typed' | 'uploaded'
  status: 'draft' | 'sealed' | 'opened'
  content?: string | null
  unlockAt?: number
}): Promise<void> => {
  const now = Date.now()
  const creator = input.creator ?? 'partner-1'
  const opened = input.status === 'opened'
  const sealed = input.status !== 'draft'
  await env.DB.prepare(`
    INSERT INTO future_letters (
      id, relationship_id, created_by_user_id, recipient_type, recipient_user_id, title,
      letter_type, typed_content, teaser, status, unlock_at, sealed_at, opened_at,
      first_opened_by_user_id, created_at, updated_at
    ) VALUES (?, 'primary', ?, ?, NULL, ?, ?, ?, 'A safe teaser', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.id,
    creator,
    input.status === 'draft' ? null : 'both',
    `Letter ${input.id}`,
    input.type ?? 'typed',
    input.type === 'uploaded' ? null : (input.content ?? ''),
    input.status,
    input.status === 'draft' ? null : (input.unlockAt ?? now + 86_400_000),
    sealed ? now - 60_000 : null,
    opened ? now - 30_000 : null,
    opened ? 'partner-1' : null,
    now - 120_000,
    now,
  ).run()
}

describe('Phase 7 secure, portable backup', () => {
  it('escapes UTF-8 CSV correctly and produces traversal-safe media paths', () => {
    const csv = createCsv(['title', 'note'], [['Și ❤️', 'A "quote", then\na new line'], ['=WEBSERVICE("https://example.invalid")', '@SUM(1+1)']])
    expect(csv).toContain('Și ❤️')
    expect(csv).toContain('"A ""quote"", then\na new line"')
    expect(csv).toContain('\'=WEBSERVICE')
    expect(csv).toContain('\'@SUM')
    expect(safeArchiveSegment('My / Favourite: Day?')).toBe('my-favourite-day')
    const path = memoryMediaArchivePath({
      memoryId: 'memory-special-12345678', memoryDate: '2026-08-24',
      memoryTitle: '../Our "Best" Day / 2026 ❤️', mediaType: 'image', mimeType: 'image/jpeg', sortOrder: 0,
    })
    expect(() => assertSafeArchivePath(path)).not.toThrow()
    expect(path).not.toContain('..')
    expect(() => assertSafeArchivePath('../secrets.txt')).toThrow()
  })

  it('requires auth, rejects relationship injection, confirms the password, controls concurrency, and expires requests', async () => {
    expect((await request('/api/backup/estimate')).status).toBe(401)
    expect((await request('/api/backup/history')).status).toBe(401)
    expect((await request('/api/backup/data', { method: 'POST', body: JSON.stringify({}) })).status).toBe(401)

    const first = await login()
    const injected = await request('/api/backup/data', { method: 'POST', body: JSON.stringify({ relationshipId: 'someone-else' }) }, first.cookie)
    expect(injected.status).toBe(400)
    await env.DB.prepare('UPDATE sessions SET recent_auth_at = 0').run()
    const stale = await request('/api/backup/full', { method: 'POST', body: JSON.stringify({ includeMyDrafts: false }) }, first.cookie)
    expect(stale.status).toBe(428)
    expect(await stale.text()).toContain('RECENT_AUTH_REQUIRED')
    expect((await request('/api/backup/reauthenticate', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) }, first.cookie)).status).toBe(401)
    expect((await request('/api/backup/reauthenticate', { method: 'POST', body: JSON.stringify({ password: TEST_PASSWORD }) }, first.cookie)).status).toBe(200)

    const created = await requestBackup(first.cookie, 'full', true)
    const duplicate = await requestBackup(first.cookie, 'full', true)
    expect(created.response.status).toBe(201)
    expect(duplicate.response.status).toBe(200)
    expect(duplicate.reused).toBe(true)
    expect(duplicate.job.id).toBe(created.job.id)
    expect(await env.DB.prepare("SELECT COUNT(*) AS total FROM backup_jobs WHERE backup_type = 'full' AND status = 'queued'").first<number>('total')).toBe(1)

    const second = await login('two@example.test')
    expect((await request(created.job.downloadUrl ?? '', {}, second.cookie)).status).toBe(403)
    const partnerHistory = await request('/api/backup/history', {}, second.cookie)
    expect(partnerHistory.status).toBe(200)
    expect((await partnerHistory.json<{ data: { items: Array<{ includeMyDrafts: boolean }> } }>()).data.items[0]?.includeMyDrafts).toBe(false)
    await env.DB.prepare('UPDATE backup_jobs SET expires_at = ? WHERE id = ?').bind(Date.now() - 1, created.job.id).run()
    expect((await request(created.job.downloadUrl ?? '', {}, first.cookie)).status).toBe(410)
  })

  it('rate limits repeated backup creation without weakening the one-active-Full rule', async () => {
    const { cookie } = await login()
    for (let index = 0; index < 10; index += 1) {
      expect((await requestBackup(cookie, 'data')).response.status).toBe(201)
    }
    const limited = await requestBackup(cookie, 'data')
    expect(limited.response.status).toBe(429)
  })

  it('creates a valid empty Data Only ZIP and marks Last Backup only after streaming succeeds', async () => {
    const { cookie } = await login()
    const created = await requestBackup(cookie, 'data')
    const before = await request('/api/backup/history', {}, cookie)
    expect((await before.json<{ data: { lastSuccessful: unknown } }>()).data.lastSuccessful).toBeNull()
    const response = await request(created.job.downloadUrl ?? '', {}, cookie)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toContain('attachment')
    const bytes = new Uint8Array(await response.arrayBuffer())
    const entries = readZipEntries(bytes)
    expect(entries.has('Our-Relationship-Backup/manifest.json')).toBe(true)
    expect(entries.has('Our-Relationship-Backup/README.txt')).toBe(true)
    expect(entries.has('Our-Relationship-Backup/data/memories.json')).toBe(true)
    expect([...entries.keys()].some((name) => name.includes('/media/'))).toBe(false)
    const manifest = JSON.parse(decodeEntry(entries, 'Our-Relationship-Backup/manifest.json')) as { backupFormatVersion: string; exportType: string; counts: { mediaFiles: number } }
    expect(manifest).toMatchObject({ backupFormatVersion: '1.0', exportType: 'data', counts: { mediaFiles: 0 } })
    const after = await request('/api/backup/history', {}, cookie)
    expect((await after.json<{ data: { lastSuccessful: { status: string; archiveBytes: number } } }>()).data.lastSuccessful).toMatchObject({ status: 'succeeded', archiveBytes: bytes.byteLength })
  })

  it('never exports locked or ready Letter content and never exposes the other partner draft', async () => {
    const { cookie } = await login()
    await insertLetter({ id: 'own-draft', status: 'draft', content: 'OWN PRIVATE DRAFT' })
    await insertLetter({ id: 'other-draft', creator: 'partner-2', status: 'draft', content: 'OTHER PRIVATE DRAFT' })
    await insertLetter({ id: 'locked-typed', status: 'sealed', content: 'LOCKED BODY', unlockAt: Date.now() + 86_400_000 })
    await insertLetter({ id: 'ready-typed', status: 'sealed', content: 'READY BUT UNOPENED BODY', unlockAt: Date.now() - 60_000 })
    await insertLetter({ id: 'opened-typed', status: 'opened', content: 'OPENED PORTABLE BODY', unlockAt: Date.now() - 120_000 })
    await insertLetter({ id: 'locked-handwritten', type: 'uploaded', status: 'sealed', unlockAt: Date.now() + 86_400_000 })
    const lockedPageKey = 'primary/letters/locked-handwritten/private-locked-page.jpg'
    await env.MEDIA.put(lockedPageKey, new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))
    await env.DB.prepare(`
      INSERT INTO future_letter_media (
        id, future_letter_id, relationship_id, uploaded_by_user_id, media_role, media_type,
        r2_key, original_filename, mime_type, size_bytes, alt_text, sort_order, created_at
      ) VALUES ('locked-page', 'locked-handwritten', 'primary', 'partner-1', 'page', 'image', ?, 'locked.jpg', 'image/jpeg', 4, '', 0, ?)
    `).bind(lockedPageKey, Date.now()).run()

    const exported = await downloadBackupForTest(cookie, 'data')
    const allText = [...exported.entries.values()].map((value) => new TextDecoder().decode(value)).join('\n')
    expect(allText).toContain('OPENED PORTABLE BODY')
    expect(allText).not.toContain('LOCKED BODY')
    expect(allText).not.toContain('READY BUT UNOPENED BODY')
    expect(allText).not.toContain('OWN PRIVATE DRAFT')
    expect(allText).not.toContain('OTHER PRIVATE DRAFT')
    expect(allText).not.toContain(lockedPageKey)
    const letters = JSON.parse(decodeEntry(exported.entries, 'Our-Relationship-Backup/data/letters.json')) as { items: Array<{ id: string; statusAtSnapshot: string; typedContent?: string }> }
    expect(letters.items.find((item) => item.id === 'locked-typed')).toMatchObject({ statusAtSnapshot: 'sealed-locked' })
    expect(letters.items.find((item) => item.id === 'ready-typed')).toMatchObject({ statusAtSnapshot: 'ready-unopened' })
    expect(letters.items.find((item) => item.id === 'locked-typed')).not.toHaveProperty('typedContent')

    const ownDraftExport = await downloadBackupForTest(cookie, 'data', true)
    const draftText = decodeEntry(ownDraftExport.entries, 'Our-Relationship-Backup/data/letters.json')
    expect(draftText).toContain('OWN PRIVATE DRAFT')
    expect(draftText).not.toContain('OTHER PRIVATE DRAFT')
  })

  it('freezes Letter eligibility at snapshot time even if a letter opens before streaming finishes', async () => {
    const { cookie } = await login()
    await insertLetter({ id: 'unlock-during-backup', status: 'sealed', content: 'SNAPSHOT MUST KEEP THIS SECRET', unlockAt: Date.now() + 60_000 })
    const created = await requestBackup(cookie, 'data')
    const response = await request(created.job.downloadUrl ?? '', {}, cookie)
    const now = Date.now()
    await env.DB.prepare(`
      UPDATE future_letters SET status = 'opened', unlock_at = ?, opened_at = ?,
        first_opened_by_user_id = 'partner-1', updated_at = ? WHERE id = 'unlock-during-backup'
    `).bind(now - 1, now, now).run()
    const entries = readZipEntries(new Uint8Array(await response.arrayBuffer()))
    const letters = decodeEntry(entries, 'Our-Relationship-Backup/data/letters.json')
    expect(letters).not.toContain('SNAPSHOT MUST KEEP THIS SECRET')
    expect(letters).toContain('sealed-locked')
  })

  it('streams a large video and opened handwritten page while excluding missing, orphan, TMDB, and static media', async () => {
    const { cookie } = await login()
    const now = Date.now()
    const memoryId = 'large-video-memory'
    const largeVideo = new Uint8Array(12 * 1024 * 1024)
    for (let offset = 0; offset < largeVideo.length; offset += 4096) largeVideo[offset] = (offset / 4096) % 251
    largeVideo.set([0, 0, 0, 24, 102, 116, 121, 112], 0)
    const videoKey = 'primary/memories/large/private-video.mp4'
    const missingKey = 'primary/memories/large/missing.jpg'
    const orphanKey = 'primary/orphans/DO-NOT-EXPORT.txt'
    await env.MEDIA.put(videoKey, largeVideo, { httpMetadata: { contentType: 'video/mp4' } })
    await env.MEDIA.put(orphanKey, 'ORPHAN-R2-CONTENT')
    await env.DB.prepare(`
      INSERT INTO memories (
        id, relationship_id, created_by_user_id, title, caption, location,
        memory_date, category, favorite, created_at, updated_at
      ) VALUES (?, 'primary', 'partner-1', 'Our "Best" Day / 2026 ❤️', 'Large original video',
        'London', '2026-08-24', 'Dates', 1, ?, ?)
    `).bind(memoryId, now, now).run()
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO memory_media (
          id, memory_id, r2_key, media_type, mime_type, size_bytes, alt_text,
          original_filename, sort_order, created_at
        ) VALUES ('large-video', ?, ?, 'video', 'video/mp4', ?, 'Large original', 'IMG_0001.mp4', 0, ?)
      `).bind(memoryId, videoKey, largeVideo.byteLength, now),
      env.DB.prepare(`
        INSERT INTO memory_media (
          id, memory_id, r2_key, media_type, mime_type, size_bytes, alt_text,
          original_filename, sort_order, created_at
        ) VALUES ('missing-image', ?, ?, 'image', 'image/jpeg', 2048, 'Missing test image', 'IMG_0001.jpg', 1, ?)
      `).bind(memoryId, missingKey, now),
      env.DB.prepare(`
        INSERT INTO movie_watchlist (
          relationship_id, tmdb_movie_id, title, poster_path, release_year, added_by_user_id, created_at
        ) VALUES ('primary', 603, 'TMDB Film', '/external-poster.jpg', 2026, 'partner-1', ?)
      `).bind(now),
    ])
    await insertLetter({ id: 'opened-handwritten', type: 'uploaded', status: 'opened', unlockAt: now - 120_000 })
    const pageKey = 'primary/letters/opened-handwritten/page.jpg'
    const pageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
    await env.MEDIA.put(pageKey, pageBytes, { httpMetadata: { contentType: 'image/jpeg' } })
    await env.DB.prepare(`
      INSERT INTO future_letter_media (
        id, future_letter_id, relationship_id, uploaded_by_user_id, media_role, media_type,
        r2_key, original_filename, mime_type, size_bytes, alt_text, sort_order, created_at
      ) VALUES ('opened-page', 'opened-handwritten', 'primary', 'partner-1', 'page', 'image',
        ?, 'page.jpg', 'image/jpeg', ?, 'Handwritten page', 0, ?)
    `).bind(pageKey, pageBytes.byteLength, now).run()

    const exported = await downloadBackupForTest(cookie, 'full')
    const names = [...exported.entries.keys()]
    const videoName = names.find((name) => name.endsWith('/video-01.mp4'))
    const pageName = names.find((name) => name.includes('/media/letters/') && name.endsWith('/page-01.jpg'))
    expect(videoName).toBeTruthy()
    expect(pageName).toBeTruthy()
    const archivedVideo = exported.entries.get(videoName ?? '')
    expect(archivedVideo?.byteLength).toBe(largeVideo.byteLength)
    expect(archivedVideo?.slice(0, 8)).toEqual(largeVideo.slice(0, 8))
    expect(archivedVideo?.at(4096 * 100)).toBe(largeVideo[4096 * 100])
    expect(exported.entries.get(pageName ?? '')).toEqual(pageBytes)
    expect(names.some((name) => name.includes('missing-image'))).toBe(false)
    expect(names.some((name) => name.includes('DO-NOT-EXPORT'))).toBe(false)
    expect(names.some((name) => name.includes('external-poster'))).toBe(false)
    expect(names.some((name) => name.includes('IMG-20260817-WA0002'))).toBe(false)
    expect(names.some((name) => name.includes('public/') || name.includes('src/assets'))).toBe(false)
    const manifest = JSON.parse(decodeEntry(exported.entries, 'Our-Relationship-Backup/manifest.json')) as {
      counts: { mediaFiles: number }
      warnings: Array<{ code: string; mediaId: string }>
      media: Array<{ mediaId: string; included: boolean }>
    }
    expect(manifest.counts.mediaFiles).toBe(2)
    expect(manifest.warnings).toContainEqual(expect.objectContaining({ code: 'media-missing', mediaId: 'missing-image' }))
    expect(manifest.media).toContainEqual(expect.objectContaining({ mediaId: 'missing-image', included: false }))
    const rawArchiveText = new TextDecoder().decode(exported.bytes)
    expect(rawArchiveText).not.toContain(videoKey)
    expect(rawArchiveText).not.toContain(pageKey)
    expect(rawArchiveText).not.toContain('ORPHAN-R2-CONTENT')
  }, 60_000)

  it('exports 105 uniquely named media entries without overwrites or unsafe paths', async () => {
    const { cookie } = await login()
    const now = Date.now()
    const memoryId = 'many-files-memory'
    await env.DB.prepare(`
      INSERT INTO memories (
        id, relationship_id, created_by_user_id, title, caption, location,
        memory_date, category, favorite, created_at, updated_at
      ) VALUES (?, 'primary', 'partner-1', 'Paris / Paris: ❤️', '', '', '2026-08-24', 'Travel', 0, ?, ?)
    `).bind(memoryId, now, now).run()
    const statements: D1PreparedStatement[] = []
    for (let index = 0; index < 105; index += 1) {
      const id = `many-media-${String(index).padStart(3, '0')}`
      const key = `primary/many/${id}.jpg`
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, index % 256])
      await env.MEDIA.put(key, bytes)
      statements.push(env.DB.prepare(`
        INSERT INTO memory_media (
          id, memory_id, r2_key, media_type, mime_type, size_bytes, alt_text,
          original_filename, sort_order, created_at
        ) VALUES (?, ?, ?, 'image', 'image/jpeg', ?, '', 'IMG_0001.jpg', 0, ?)
      `).bind(id, memoryId, key, bytes.byteLength, now + index))
    }
    for (let offset = 0; offset < statements.length; offset += 50) await env.DB.batch(statements.slice(offset, offset + 50))
    const exported = await downloadBackupForTest(cookie, 'full')
    const mediaNames = [...exported.entries.keys()].filter((name) => name.includes('/media/memories/'))
    expect(mediaNames).toHaveLength(105)
    expect(new Set(mediaNames).size).toBe(105)
    for (const name of mediaNames) {
      expect(() => assertSafeArchivePath(name)).not.toThrow()
      expect(name).not.toContain('..')
      expect(name).not.toContain('\\')
    }
    const manifest = JSON.parse(decodeEntry(exported.entries, 'Our-Relationship-Backup/manifest.json')) as { counts: { mediaFiles: number }; totalMediaBytes: number }
    expect(manifest.counts.mediaFiles).toBe(105)
    expect(manifest.totalMediaBytes).toBe(525)
  }, 60_000)
})
