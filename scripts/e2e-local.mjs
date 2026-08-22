import assert from 'node:assert/strict'

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8787'
const trustedOrigin = process.env.E2E_ORIGIN ?? 'http://localhost:5173'
const localEmail = process.env.E2E_EMAIL ?? 'partner.one@example.test'
const localPassword = process.env.E2E_PASSWORD ?? 'LocalOnly-Partner-One!2026'

let sessionCookie = ''
let memoryId = ''

const request = (path, init = {}) => {
  const headers = new Headers(init.headers)
  headers.set('Origin', trustedOrigin)
  if (sessionCookie) headers.set('Cookie', sessionCookie)
  return fetch(`${baseUrl}${path}`, { ...init, headers })
}

const jsonRequest = async (path, init = {}) => {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const response = await request(path, { ...init, headers })
  const payload = await response.json()
  return { response, payload }
}

const expectSuccess = (result, status) => {
  assert.equal(result.response.status, status, JSON.stringify(result.payload))
  assert.equal(result.payload.success, true, JSON.stringify(result.payload))
  return result.payload.data
}

const run = async () => {
  const health = await jsonRequest('/api/health')
  expectSuccess(health, 200)

  const login = await jsonRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: localEmail, password: localPassword }),
  })
  expectSuccess(login, 200)
  const setCookie = login.response.headers.get('set-cookie')
  assert.ok(setCookie, 'Login did not return a session cookie.')
  sessionCookie = setCookie.split(';', 1)[0]
  assert.match(setCookie, /HttpOnly/u)
  assert.match(setCookie, /Secure/u)
  assert.match(setCookie, /SameSite=Strict/u)

  const relationship = await jsonRequest('/api/relationship')
  expectSuccess(relationship, 200)
  const profileList = await jsonRequest('/api/profiles')
  const profiles = expectSuccess(profileList, 200)
  assert.equal(profiles.length, 2)

  const create = await jsonRequest('/api/memories', {
    method: 'POST',
    headers: { 'Idempotency-Key': `local-e2e-${crypto.randomUUID()}` },
    body: JSON.stringify({
      title: 'Local integration proof',
      caption: 'Temporary memory created by the local acceptance test.',
      location: 'London',
      date: new Date().toISOString().slice(0, 10),
      category: 'Everyday',
      favorite: true,
    }),
  })
  const memory = expectSuccess(create, 201)
  memoryId = memory.id
  assert.equal(memory.location, 'London')

  const png = Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZgS8AAAAASUVORK5CYII=',
    'base64',
  ))
  const form = new FormData()
  form.set('file', new File([png], 'local-proof.png', { type: 'image/png' }))
  form.set('altText', 'A one-pixel local integration test image')
  const uploadResponse = await request(`/api/memories/${memoryId}/media`, { method: 'POST', body: form })
  const uploadPayload = await uploadResponse.json()
  const media = expectSuccess({ response: uploadResponse, payload: uploadPayload }, 201)
  assert.equal(media.mimeType, 'image/png')
  assert.equal('r2Key' in media || 'r2_key' in media, false)

  const mp4 = Uint8Array.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])
  const videoForm = new FormData()
  videoForm.set('file', new File([mp4], 'local-proof.mp4', { type: 'video/mp4' }))
  videoForm.set('altText', 'A local integration test video')
  const videoResponse = await request(`/api/memories/${memoryId}/media`, { method: 'POST', body: videoForm })
  const videoPayload = await videoResponse.json()
  const video = expectSuccess({ response: videoResponse, payload: videoPayload }, 201)
  assert.equal(video.mimeType, 'video/mp4')
  assert.equal('r2Key' in video || 'r2_key' in video, false)

  const anonymousMedia = await fetch(`${baseUrl}${media.url}`, { headers: { Origin: trustedOrigin } })
  assert.equal(anonymousMedia.status, 401)

  const rangeResponse = await request(media.url, { headers: { Range: 'bytes=0-7' } })
  assert.equal(rangeResponse.status, 206)
  assert.equal(rangeResponse.headers.get('content-range'), `bytes 0-7/${png.byteLength}`)
  assert.deepEqual(new Uint8Array(await rangeResponse.arrayBuffer()), png.slice(0, 8))

  const videoRange = await request(video.url, { headers: { Range: 'bytes=4-7' } })
  assert.equal(videoRange.status, 206)
  assert.equal(videoRange.headers.get('content-type'), 'video/mp4')
  assert.deepEqual(new Uint8Array(await videoRange.arrayBuffer()), mp4.slice(4, 8))

  const list = await jsonRequest('/api/memories?limit=10&favorite=true&mediaType=image')
  const listed = expectSuccess(list, 200)
  const createdMemory = listed.items.find((item) => item.id === memoryId)
  assert.ok(createdMemory)
  assert.equal(createdMemory.media.length, 2)
  assert.deepEqual(new Set(createdMemory.media.map((item) => item.type)), new Set(['image', 'video']))
  assert.equal(JSON.stringify(createdMemory).includes('r2_key'), false)

  const remove = await jsonRequest(`/api/memories/${memoryId}`, { method: 'DELETE' })
  expectSuccess(remove, 200)
  memoryId = ''

  const logout = await jsonRequest('/api/auth/logout', { method: 'POST' })
  expectSuccess(logout, 200)
  sessionCookie = ''

  const expired = await jsonRequest('/api/auth/me')
  assert.equal(expired.response.status, 401)
  assert.equal(expired.payload.success, false)

  console.log('Local E2E passed: login -> D1 create/list -> mixed R2 uploads -> private range reads -> cleanup -> logout.')
}

try {
  await run()
} finally {
  if (memoryId && sessionCookie) {
    await request(`/api/memories/${memoryId}`, { method: 'DELETE' }).catch(() => undefined)
  }
}
