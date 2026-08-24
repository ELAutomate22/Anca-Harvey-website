import { requireSession } from '../auth/session'
import { bytesToBase64Url, hashText } from '../lib/crypto'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { asRecord, isoDate, optionalBoolean, optionalString, requiredString } from '../lib/validation'

const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const MAX_MEDIA_PER_MEMORY = 12

const MIME_LIMITS = {
  'image/jpeg': { kind: 'image', extension: 'jpg', maxBytes: MAX_IMAGE_BYTES },
  'image/png': { kind: 'image', extension: 'png', maxBytes: MAX_IMAGE_BYTES },
  'image/webp': { kind: 'image', extension: 'webp', maxBytes: MAX_IMAGE_BYTES },
  'image/avif': { kind: 'image', extension: 'avif', maxBytes: MAX_IMAGE_BYTES },
  'video/mp4': { kind: 'video', extension: 'mp4', maxBytes: MAX_VIDEO_BYTES },
  'video/webm': { kind: 'video', extension: 'webm', maxBytes: MAX_VIDEO_BYTES },
} as const

export type AllowedMime = keyof typeof MIME_LIMITS

interface MemoryRow {
  id: string
  relationship_id: string
  created_by_user_id: string
  title: string
  caption: string
  location: string
  memory_date: string
  category: string
  favorite: number
  created_at: number
  updated_at: number
}

interface MediaRow {
  id: string
  memory_id: string
  media_type: 'image' | 'video'
  mime_type: AllowedMime
  size_bytes: number
  width: number | null
  height: number | null
  duration_seconds: number | null
  alt_text: string
  original_filename: string
  sort_order: number
  created_at: number
}

interface MediaStorageRow extends MediaRow {
  r2_key: string
}

interface IdempotencyRow {
  status_code: number
  response_body: string
}

const mediaResponse = (row: MediaRow) => ({
  id: row.id,
  memoryId: row.memory_id,
  type: row.media_type,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  width: row.width === null ? null : Number(row.width),
  height: row.height === null ? null : Number(row.height),
  durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
  altText: row.alt_text,
  originalFilename: row.original_filename,
  sortOrder: Number(row.sort_order),
  createdAt: Number(row.created_at),
  url: `/api/media/${row.id}`,
})

const memoryResponse = (row: MemoryRow, media: MediaRow[]) => ({
  id: row.id,
  title: row.title,
  caption: row.caption,
  location: row.location,
  date: row.memory_date,
  category: row.category,
  favorite: Boolean(row.favorite),
  createdByUserId: row.created_by_user_id,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
  media: media.map(mediaResponse),
})

const encodeCursor = (row: MemoryRow): string =>
  bytesToBase64Url(new TextEncoder().encode(`${row.memory_date}|${row.id}`))

const decodeCursor = (cursor: string): { date: string; id: string } => {
  try {
    const normalized = cursor.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const value = new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)))
    const [date, id, extra] = value.split('|')
    if (!date || !id || extra || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error('bad cursor')
    return { date, id }
  } catch {
    throw new ApiError(400, 'INVALID_CURSOR', 'The pagination cursor is invalid.')
  }
}

const loadMediaForMemories = async (env: Env, memoryIds: string[]): Promise<Map<string, MediaRow[]>> => {
  const byMemory = new Map<string, MediaRow[]>()
  if (memoryIds.length === 0) return byMemory
  const placeholders = memoryIds.map(() => '?').join(', ')
  const result = await env.DB.prepare(`
    SELECT id, memory_id, media_type, mime_type, size_bytes, width, height, duration_seconds,
      alt_text, original_filename, sort_order, created_at
    FROM memory_media
    WHERE memory_id IN (${placeholders})
    ORDER BY memory_id, sort_order, created_at
  `).bind(...memoryIds).all<MediaRow>()

  for (const media of result.results) {
    const entries = byMemory.get(media.memory_id) ?? []
    entries.push(media)
    byMemory.set(media.memory_id, entries)
  }
  return byMemory
}

const getOwnedMemory = async (env: Env, relationshipId: string, memoryId: string): Promise<MemoryRow> => {
  const row = await env.DB.prepare(`
    SELECT id, relationship_id, created_by_user_id, title, caption, location, memory_date, category, favorite, created_at, updated_at
    FROM memories WHERE id = ? AND relationship_id = ? LIMIT 1
  `).bind(memoryId, relationshipId).first<MemoryRow>()
  if (!row) throw new ApiError(404, 'MEMORY_NOT_FOUND', 'That memory was not found.')
  return row
}

export const listMemories = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const url = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20))
  const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest'
  const category = url.searchParams.get('category')?.trim()
  const favorite = url.searchParams.get('favorite') === 'true'
  const mediaType = url.searchParams.get('mediaType')
  if (mediaType && mediaType !== 'image' && mediaType !== 'video') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'mediaType must be image or video.')
  }

  const conditions = ['m.relationship_id = ?']
  const values: Array<string | number> = [session.relationship.id]
  if (category) {
    conditions.push('m.category = ?')
    values.push(category)
  }
  if (favorite) conditions.push('m.favorite = 1')
  if (mediaType) {
    conditions.push('EXISTS (SELECT 1 FROM memory_media mm WHERE mm.memory_id = m.id AND mm.media_type = ?)')
    values.push(mediaType)
  }

  const cursorValue = url.searchParams.get('cursor')
  if (cursorValue) {
    const cursor = decodeCursor(cursorValue)
    const operator = sort === 'newest' ? '<' : '>'
    conditions.push(`(m.memory_date ${operator} ? OR (m.memory_date = ? AND m.id ${operator} ?))`)
    values.push(cursor.date, cursor.date, cursor.id)
  }

  values.push(limit + 1)
  const direction = sort === 'newest' ? 'DESC' : 'ASC'
  const result = await env.DB.prepare(`
    SELECT m.id, m.relationship_id, m.created_by_user_id, m.title, m.caption, m.location, m.memory_date,
      m.category, m.favorite, m.created_at, m.updated_at
    FROM memories m
    WHERE ${conditions.join(' AND ')}
    ORDER BY m.memory_date ${direction}, m.id ${direction}
    LIMIT ?
  `).bind(...values).all<MemoryRow>()

  const hasMore = result.results.length > limit
  const rows = result.results.slice(0, limit)
  const media = await loadMediaForMemories(env, rows.map((row) => row.id))
  const last = rows.at(-1)
  return apiSuccess({
    items: rows.map((row) => memoryResponse(row, media.get(row.id) ?? [])),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  })
}

export const getMemory = async (request: Request, env: Env, memoryId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const row = await getOwnedMemory(env, session.relationship.id, memoryId)
  const media = await loadMediaForMemories(env, [row.id])
  return apiSuccess(memoryResponse(row, media.get(row.id) ?? []))
}

const readMemoryInput = async (request: Request, current?: MemoryRow) => {
  const body = asRecord(await readJson(request))
  return {
    title: body.title === undefined && current ? current.title : requiredString(body.title, 'title', 1, 120),
    caption: body.caption === undefined && current ? current.caption : (optionalString(body.caption, 'caption', 2_000) ?? ''),
    location: body.location === undefined && current ? current.location : (optionalString(body.location, 'location', 250) ?? ''),
    date: body.date === undefined && current ? current.memory_date : isoDate(body.date, 'date'),
    category: body.category === undefined && current ? current.category : requiredString(body.category, 'category', 1, 60),
    favorite: body.favorite === undefined && current ? Boolean(current.favorite) : (optionalBoolean(body.favorite, 'favorite') ?? false),
  }
}

export const createMemory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const idempotencyKey = request.headers.get('idempotency-key')
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{16,100}$/u.test(idempotencyKey)) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.')
  }

  const keyHash = await hashText(`${session.user.id}:memory-create:${idempotencyKey}`)
  const existing = await env.DB.prepare(
    'SELECT status_code, response_body FROM idempotency_keys WHERE key_hash = ? AND expires_at > ?',
  ).bind(keyHash, Date.now()).first<IdempotencyRow>()
  if (existing) {
    return new Response(existing.response_body, {
      status: Number(existing.status_code),
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  const input = await readMemoryInput(request)
  const id = crypto.randomUUID()
  const now = Date.now()
  const row: MemoryRow = {
    id,
    relationship_id: session.relationship.id,
    created_by_user_id: session.user.id,
    title: input.title,
    caption: input.caption,
    location: input.location,
    memory_date: input.date,
    category: input.category,
    favorite: input.favorite ? 1 : 0,
    created_at: now,
    updated_at: now,
  }
  const payload = { success: true, data: memoryResponse(row, []) }
  const responseBody = JSON.stringify(payload)

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, location, memory_date, category, favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, session.relationship.id, session.user.id, input.title, input.caption, input.location, input.date, input.category, input.favorite ? 1 : 0, now, now),
    env.DB.prepare(`
      INSERT INTO idempotency_keys (key_hash, user_id, scope, status_code, response_body, expires_at, created_at)
      VALUES (?, ?, 'memory-create', 201, ?, ?, ?)
    `).bind(keyHash, session.user.id, responseBody, now + 24 * 60 * 60 * 1000, now),
  ])

  return new Response(responseBody, { status: 201, headers: { 'Content-Type': 'application/json; charset=UTF-8' } })
}

export const updateMemory = async (request: Request, env: Env, memoryId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getOwnedMemory(env, session.relationship.id, memoryId)
  const input = await readMemoryInput(request, current)
  const now = Date.now()
  await env.DB.prepare(`
    UPDATE memories SET title = ?, caption = ?, location = ?, memory_date = ?, category = ?, favorite = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ?
  `).bind(input.title, input.caption, input.location, input.date, input.category, input.favorite ? 1 : 0, now, memoryId, session.relationship.id).run()

  const updated: MemoryRow = {
    ...current,
    title: input.title,
    caption: input.caption,
    location: input.location,
    memory_date: input.date,
    category: input.category,
    favorite: input.favorite ? 1 : 0,
    updated_at: now,
  }
  const media = await loadMediaForMemories(env, [memoryId])
  return apiSuccess(memoryResponse(updated, media.get(memoryId) ?? []))
}

export const deleteMemory = async (request: Request, env: Env, memoryId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  await getOwnedMemory(env, session.relationship.id, memoryId)
  const media = await env.DB.prepare(`
    SELECT mm.r2_key
    FROM memory_media mm
    JOIN memories m ON m.id = mm.memory_id
    WHERE mm.memory_id = ? AND m.relationship_id = ?
  `).bind(memoryId, session.relationship.id).all<{ r2_key: string }>()

  await env.DB.prepare('DELETE FROM memories WHERE id = ? AND relationship_id = ?')
    .bind(memoryId, session.relationship.id).run()

  if (media.results.length > 0) {
    try {
      await env.MEDIA.delete(media.results.map((item) => item.r2_key))
    } catch (error) {
      console.error(JSON.stringify({
        message: 'R2 cleanup failed after memory deletion',
        memoryId,
        error: error instanceof Error ? error.message : String(error),
      }))
    }
  }
  return apiSuccess({ deleted: true })
}

const hasPrefix = (bytes: Uint8Array, prefix: number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte)

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.slice(start, end))

export const hasValidFileSignature = (mimeType: AllowedMime, bytes: Uint8Array): boolean => {
  if (mimeType === 'image/jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff])
  if (mimeType === 'image/png') return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mimeType === 'image/webp') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP'
  if (mimeType === 'video/webm') return hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3])
  if (mimeType === 'image/avif') {
    const brand = ascii(bytes, 8, 12)
    return ascii(bytes, 4, 8) === 'ftyp' && (brand === 'avif' || brand === 'avis')
  }
  if (mimeType === 'video/mp4') {
    const brand = ascii(bytes, 8, 12)
    return ascii(bytes, 4, 8) === 'ftyp' && brand !== 'avif' && brand !== 'avis'
  }
  return false
}

const safeFilename = (name: string): string => {
  const filename = name.split(/[\\/]/u).at(-1)?.replace(/[^\p{L}\p{N}._ -]/gu, '_').trim().slice(0, 180)
  return filename || 'memory-upload'
}

export const uploadMemoryMedia = async (request: Request, env: Env, memoryId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  await getOwnedMemory(env, session.relationship.id, memoryId)
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_VIDEO_BYTES + 1_048_576) {
    throw new ApiError(413, 'MEDIA_TOO_LARGE', 'The upload exceeds the maximum supported size.')
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new ApiError(400, 'INVALID_UPLOAD', 'The upload form could not be read.')
  }
  const upload = formData.get('file')
  if (!(upload instanceof File)) throw new ApiError(400, 'FILE_REQUIRED', 'Choose a file to upload.')
  if (!(upload.type in MIME_LIMITS)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use JPEG, PNG, WebP, AVIF, MP4, or WebM.')
  }

  const mimeType = upload.type as AllowedMime
  const policy = MIME_LIMITS[mimeType]
  if (upload.size < 1 || upload.size > policy.maxBytes) {
    const maxMb = Math.floor(policy.maxBytes / 1024 / 1024)
    throw new ApiError(413, 'MEDIA_TOO_LARGE', `${policy.kind === 'image' ? 'Images' : 'Videos'} must be ${maxMb} MB or smaller.`)
  }

  const signature = new Uint8Array(await upload.slice(0, 16).arrayBuffer())
  if (!hasValidFileSignature(mimeType, signature)) {
    throw new ApiError(415, 'INVALID_FILE_SIGNATURE', 'The file contents do not match the selected media type.')
  }

  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM memory_media WHERE memory_id = ?')
    .bind(memoryId).first<{ total: number }>()
  if (Number(count?.total ?? 0) >= MAX_MEDIA_PER_MEMORY) {
    throw new ApiError(409, 'MEDIA_LIMIT_REACHED', `A memory can contain up to ${MAX_MEDIA_PER_MEMORY} files.`)
  }

  const mediaId = crypto.randomUUID()
  const objectKey = `${session.relationship.id}/${memoryId}/${crypto.randomUUID()}.${policy.extension}`
  const originalFilename = safeFilename(upload.name)
  const altText = optionalString(formData.get('altText') ?? undefined, 'altText', 500) ?? ''
  const sortOrder = Number(count?.total ?? 0)
  const now = Date.now()

  await env.MEDIA.put(objectKey, upload, {
    httpMetadata: {
      contentType: mimeType,
      contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
      cacheControl: 'private, max-age=3600, must-revalidate',
    },
    customMetadata: { mediaId, memoryId },
  })

  try {
    await env.DB.prepare(`
      INSERT INTO memory_media (
        id, memory_id, r2_key, media_type, mime_type, size_bytes, width, height,
        duration_seconds, alt_text, original_filename, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?)
    `).bind(
      mediaId,
      memoryId,
      objectKey,
      policy.kind,
      mimeType,
      upload.size,
      altText,
      originalFilename,
      sortOrder,
      now,
    ).run()
  } catch (error) {
    await env.MEDIA.delete(objectKey)
    throw error
  }

  const row: MediaRow = {
    id: mediaId,
    memory_id: memoryId,
    media_type: policy.kind,
    mime_type: mimeType,
    size_bytes: upload.size,
    width: null,
    height: null,
    duration_seconds: null,
    alt_text: altText,
    original_filename: originalFilename,
    sort_order: sortOrder,
    created_at: now,
  }
  return apiSuccess(mediaResponse(row), { status: 201 })
}

export const deleteMemoryMedia = async (
  request: Request,
  env: Env,
  memoryId: string,
  mediaId: string,
): Promise<Response> => {
  const session = await requireSession(request, env)
  const row = await env.DB.prepare(`
    SELECT mm.id, mm.r2_key
    FROM memory_media mm
    JOIN memories m ON m.id = mm.memory_id
    WHERE mm.id = ? AND mm.memory_id = ? AND m.relationship_id = ?
  `).bind(mediaId, memoryId, session.relationship.id).first<{ id: string; r2_key: string }>()
  if (!row) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media item was not found.')

  await env.DB.prepare('DELETE FROM memory_media WHERE id = ?').bind(mediaId).run()
  try {
    await env.MEDIA.delete(row.r2_key)
  } catch (error) {
    console.error(JSON.stringify({
      message: 'R2 cleanup failed after media deletion',
      mediaId,
      error: error instanceof Error ? error.message : String(error),
    }))
  }
  return apiSuccess({ deleted: true })
}

export const servePrivateMedia = async (request: Request, env: Env, mediaId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const row = await env.DB.prepare(`
    SELECT mm.id, mm.memory_id, mm.r2_key, mm.media_type, mm.mime_type, mm.size_bytes,
      mm.width, mm.height, mm.duration_seconds, mm.alt_text, mm.original_filename,
      mm.sort_order, mm.created_at
    FROM memory_media mm
    JOIN memories m ON m.id = mm.memory_id
    WHERE mm.id = ? AND m.relationship_id = ?
    LIMIT 1
  `).bind(mediaId, session.relationship.id).first<MediaStorageRow>()
  if (!row) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media item was not found.')

  if (request.method === 'HEAD') {
    const object = await env.MEDIA.head(row.r2_key)
    if (!object) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media item was not found.')
    const headers = privateMediaHeaders(row, object.httpEtag)
    headers.set('Content-Length', String(object.size))
    return new Response(null, { status: 200, headers })
  }

  let object: R2ObjectBody | null
  try {
    object = await env.MEDIA.get(row.r2_key, {
      ...(request.headers.has('range') ? { range: request.headers } : {}),
    })
  } catch {
    throw new ApiError(416, 'INVALID_RANGE', 'The requested byte range is not available.')
  }
  if (!object) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'That media item was not found.')

  const headers = privateMediaHeaders(row, object.httpEtag)
  if (request.headers.get('if-none-match') === object.httpEtag && !request.headers.has('range')) {
    return new Response(null, { status: 304, headers })
  }

  if (object.range) {
    let offset = 0
    let length = object.size
    if ('offset' in object.range && typeof object.range.offset === 'number') offset = object.range.offset
    if ('length' in object.range && typeof object.range.length === 'number') length = object.range.length
    else if ('suffix' in object.range && typeof object.range.suffix === 'number') {
      length = object.range.suffix
      offset = Math.max(0, row.size_bytes - length)
    }
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${row.size_bytes}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}

const privateMediaHeaders = (row: MediaStorageRow, etag: string): Headers => {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600, must-revalidate',
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.original_filename)}`,
    'Content-Type': row.mime_type,
    ETag: etag,
    Vary: 'Cookie, Range',
  })
  return headers
}
