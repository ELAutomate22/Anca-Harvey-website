import { requireSession, type AuthSession } from '../auth/session'
import { ApiError, apiSuccess, readJson, requireBoundedContentLength } from '../lib/http'
import { assertId, enumValue } from '../lib/phase-four'
import { asRecord, optionalString, requiredString } from '../lib/validation'
import { hasValidFileSignature, type AllowedMime } from './memories'
import {
  getLetterMedia,
  getLetterSummary,
  getOwnedDraft,
  getVisibleLetter,
  listLetterMedia,
  listVisibleLetters,
} from '../letters/repository'
import {
  assertSealReady,
  canInitiallyOpen,
  localDateTimeToEpoch,
  MAX_LETTER_BODY,
  MAX_LETTER_IMAGE_BYTES,
  MAX_LETTER_PAGES,
  quickUnlockDates,
  safeLetterMetadata,
} from '../letters/state'
import type {
  FutureLetterRow,
  LetterMediaRole,
  LetterMediaRow,
  LetterType,
  RecipientType,
} from '../letters/types'

const LETTER_TYPES = ['typed', 'uploaded'] as const
const RECIPIENT_TYPES = ['user', 'both'] as const
const MEDIA_ROLES = ['page', 'cover'] as const
const LETTER_IMAGE_POLICY = {
  'image/jpeg': { extension: 'jpg' },
  'image/png': { extension: 'png' },
  'image/webp': { extension: 'webp' },
  'image/avif': { extension: 'avif' },
} as const
type LetterImageMime = keyof typeof LETTER_IMAGE_POLICY

const DRAFT_FIELDS = new Set([
  'title', 'typedContent', 'teaser', 'recipientType', 'recipientUserId', 'unlockDate', 'unlockTime',
])

const assertOnlyFields = (body: Record<string, unknown>, allowed: Set<string>): void => {
  const unexpected = Object.keys(body).filter((key) => !allowed.has(key))
  if (unexpected.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported field: ${unexpected[0]}.`)
  }
}

const nullableText = (value: unknown, field: string, max: number): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be text.`)
  if (value.length > max) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is too long.`)
  return value
}

const recipientInput = (
  session: AuthSession,
  body: Record<string, unknown>,
  current?: FutureLetterRow,
): { recipientType: RecipientType | null; recipientUserId: string | null } => {
  const rawType = body.recipientType
  let recipientType: RecipientType | null
  if (rawType === undefined) recipientType = current?.recipient_type ?? null
  else if (rawType === null || rawType === '') recipientType = null
  else recipientType = enumValue(rawType, 'recipientType', RECIPIENT_TYPES)

  let recipientUserId: string | null
  if (body.recipientUserId === undefined) recipientUserId = current?.recipient_user_id ?? null
  else if (body.recipientUserId === null || body.recipientUserId === '') recipientUserId = null
  else recipientUserId = requiredString(body.recipientUserId, 'recipientUserId', 1, 100)

  if (recipientType === 'both') return { recipientType, recipientUserId: null }
  if (recipientType === null) return { recipientType: null, recipientUserId: null }
  const members = new Set([session.relationship.partner1UserId, session.relationship.partner2UserId])
  if (!recipientUserId || !members.has(recipientUserId)) {
    throw new ApiError(400, 'INVALID_RECIPIENT', 'Choose one of the two relationship profiles.')
  }
  return { recipientType, recipientUserId }
}

const unlockInput = (
  session: AuthSession,
  body: Record<string, unknown>,
  current?: FutureLetterRow,
): number | null => {
  if (body.unlockDate === undefined && body.unlockTime === undefined) return current?.unlock_at ?? null
  if (body.unlockDate === null || body.unlockDate === '') return null
  if (body.unlockDate === undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'unlockDate is required when changing the unlock time.')
  }
  return localDateTimeToEpoch(body.unlockDate, body.unlockTime, session.relationship.timezone).unlockAt
}

const mediaResponse = (row: LetterMediaRow) => ({
  id: row.id,
  role: row.media_role,
  filename: row.original_filename,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  width: row.width === null ? null : Number(row.width),
  height: row.height === null ? null : Number(row.height),
  altText: row.alt_text,
  sortOrder: Number(row.sort_order),
  createdAt: Number(row.created_at),
  url: `/api/letters/${row.future_letter_id}/pages/${row.id}`,
})

const letterDetail = async (
  env: Env,
  session: AuthSession,
  letter: FutureLetterRow,
  serverNow: number,
) => {
  const metadata = safeLetterMetadata(session, letter, serverNow)
  if (letter.status === 'draft') {
    const media = await listLetterMedia(env, letter.id)
    return { ...metadata, typedContent: letter.typed_content, media: media.map(mediaResponse) }
  }
  if (letter.status === 'opened') {
    const media = await listLetterMedia(env, letter.id)
    return { ...metadata, typedContent: letter.typed_content, media: media.map(mediaResponse) }
  }
  return metadata
}

export const listLetters = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const letters = await listVisibleLetters(env, session.relationship.id, session.user.id)
  const serverNow = Date.now()
  const items = letters.map((letter) => safeLetterMetadata(session, letter, serverNow))
  const summary = await getLetterSummary(env, session.relationship.id, serverNow)
  return apiSuccess({ items, summary, serverNow, timeZone: session.relationship.timezone })
}

export const letterSummary = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const serverNow = Date.now()
  const summary = await getLetterSummary(env, session.relationship.id, serverNow)
  return apiSuccess({ ...summary, serverNow, timeZone: session.relationship.timezone })
}

export const letterQuickDates = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  return apiSuccess(quickUnlockDates(session.relationship.startDate, session.relationship.timezone, Date.now()))
}

export const createLetter = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request, 131_072))
  assertOnlyFields(body, new Set(['letterType', ...DRAFT_FIELDS]))
  const letterType = enumValue(body.letterType, 'letterType', LETTER_TYPES) as LetterType
  const title = optionalString(body.title, 'title', 200) ?? ''
  const teaser = optionalString(body.teaser, 'teaser', 500) ?? ''
  const typedContent = letterType === 'typed' ? (nullableText(body.typedContent, 'typedContent', MAX_LETTER_BODY) ?? '') : null
  const { recipientType, recipientUserId } = recipientInput(session, body)
  const unlockAt = unlockInput(session, body)
  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(`
    INSERT INTO future_letters (
      id, relationship_id, created_by_user_id, recipient_type, recipient_user_id, title,
      letter_type, typed_content, teaser, status, unlock_at, sealed_at, opened_at,
      first_opened_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, NULL, NULL, ?, ?)
  `).bind(
    id, session.relationship.id, session.user.id, recipientType, recipientUserId, title,
    letterType, typedContent, teaser, unlockAt, now, now,
  ).run()
  const letter = await getOwnedDraft(env, session.relationship.id, session.user.id, id)
  return apiSuccess({ letter: await letterDetail(env, session, letter, Date.now()), serverNow: Date.now() }, { status: 201 })
}

export const getLetter = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  const letter = await getVisibleLetter(env, session.relationship.id, session.user.id, letterId)
  const serverNow = Date.now()
  return apiSuccess({ letter: await letterDetail(env, session, letter, serverNow), serverNow })
}

export const updateLetter = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  const current = await getOwnedDraft(env, session.relationship.id, session.user.id, letterId)
  const body = asRecord(await readJson(request, 131_072))
  assertOnlyFields(body, DRAFT_FIELDS)
  const title = body.title === undefined ? current.title : (optionalString(body.title, 'title', 200) ?? '')
  const teaser = body.teaser === undefined ? current.teaser : (optionalString(body.teaser, 'teaser', 500) ?? '')
  const typedContent = current.letter_type === 'typed'
    ? (nullableText(body.typedContent, 'typedContent', MAX_LETTER_BODY) ?? current.typed_content ?? '')
    : null
  if (current.letter_type === 'uploaded' && body.typedContent !== undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Uploaded letters do not have typed content.')
  }
  const { recipientType, recipientUserId } = recipientInput(session, body, current)
  const unlockAt = unlockInput(session, body, current)
  const now = Date.now()
  const result = await env.DB.prepare(`
    UPDATE future_letters SET title = ?, typed_content = ?, teaser = ?, recipient_type = ?,
      recipient_user_id = ?, unlock_at = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND created_by_user_id = ? AND status = 'draft'
  `).bind(
    title, typedContent, teaser, recipientType, recipientUserId, unlockAt, now,
    letterId, session.relationship.id, session.user.id,
  ).run()
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, 'LETTER_IMMUTABLE', 'A sealed letter cannot be changed.')
  }
  const letter = await getOwnedDraft(env, session.relationship.id, session.user.id, letterId)
  return apiSuccess({ letter: await letterDetail(env, session, letter, Date.now()), serverNow: Date.now() })
}

export const sealLetter = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  const letter = await getOwnedDraft(env, session.relationship.id, session.user.id, letterId)
  const serverNow = Date.now()
  assertSealReady(letter, Number(letter.page_count), serverNow)
  const result = await env.DB.prepare(`
    UPDATE future_letters SET status = 'sealed', sealed_at = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND created_by_user_id = ? AND status = 'draft'
  `).bind(serverNow, serverNow, letterId, session.relationship.id, session.user.id).run()
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new ApiError(409, 'LETTER_IMMUTABLE', 'This letter has already been sealed.')
  }
  const sealed = await getVisibleLetter(env, session.relationship.id, session.user.id, letterId)
  return apiSuccess({ letter: safeLetterMetadata(session, sealed, Date.now()), serverNow: Date.now() })
}

export const openLetter = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  let letter = await getVisibleLetter(env, session.relationship.id, session.user.id, letterId)
  let serverNow = Date.now()
  if (letter.status === 'opened') {
    return apiSuccess({ letter: await letterDetail(env, session, letter, serverNow), serverNow })
  }
  if (letter.status !== 'sealed' || letter.unlock_at === null || serverNow < Number(letter.unlock_at)) {
    throw new ApiError(423, 'LETTER_LOCKED', 'This letter is still sealed until its server-authoritative unlock time.', {
      unlockAt: letter.unlock_at === null ? null : Number(letter.unlock_at),
      serverNow,
    })
  }
  if (!canInitiallyOpen(session, letter)) {
    throw new ApiError(403, 'LETTER_FOR_RECIPIENT', 'Only the selected recipient can open this letter first.')
  }

  await env.DB.prepare(`
    UPDATE future_letters
    SET status = 'opened', opened_at = ?, first_opened_by_user_id = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND status = 'sealed' AND unlock_at <= ?
  `).bind(serverNow, session.user.id, serverNow, letterId, session.relationship.id, serverNow).run()
  letter = await getVisibleLetter(env, session.relationship.id, session.user.id, letterId)
  serverNow = Date.now()
  if (letter.status !== 'opened') {
    throw new ApiError(409, 'LETTER_OPEN_CONFLICT', 'The letter could not be opened. Please refresh and try again.')
  }
  return apiSuccess({ letter: await letterDetail(env, session, letter, serverNow), serverNow })
}

export const deleteLetter = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  assertOnlyFields(body, new Set(['confirmation']))
  if (body.confirmation !== 'DELETE') {
    throw new ApiError(400, 'DELETE_CONFIRMATION_REQUIRED', 'Type DELETE to permanently remove this letter.')
  }
  const letter = await getVisibleLetter(env, session.relationship.id, session.user.id, letterId)
  if (letter.created_by_user_id !== session.user.id) {
    throw new ApiError(403, 'LETTER_DELETE_FORBIDDEN', 'Only the letter creator can delete it.')
  }
  const media = await listLetterMedia(env, letterId)
  const result = await env.DB.prepare(`
    DELETE FROM future_letters WHERE id = ? AND relationship_id = ? AND created_by_user_id = ?
  `).bind(letterId, session.relationship.id, session.user.id).run()
  // D1 reports cascaded future_letter_media deletions in the change count too.
  if (Number(result.meta.changes ?? 0) < 1) throw new ApiError(404, 'LETTER_NOT_FOUND', 'That future letter was not found.')
  try {
    if (media.length > 0) await env.MEDIA.delete(media.map((item) => item.r2_key))
  } catch (error) {
    console.error(JSON.stringify({
      message: 'R2 cleanup failed after future letter deletion',
      letterId,
      error: error instanceof Error ? error.message : String(error),
    }))
  }
  return apiSuccess({ deleted: true })
}

const safeFilename = (name: string): string => {
  const filename = name.split(/[\\/]/u).at(-1)?.replace(/[^\p{L}\p{N}._ -]/gu, '_').trim().slice(0, 180)
  return filename || 'letter-page'
}

export const uploadLetterMedia = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  const letter = await getOwnedDraft(env, session.relationship.id, session.user.id, letterId)
  requireBoundedContentLength(
    request,
    MAX_LETTER_IMAGE_BYTES + 1_048_576,
    'MEDIA_TOO_LARGE',
    'Letter images must be 20 MB or smaller.',
  )

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new ApiError(400, 'INVALID_UPLOAD', 'The upload form could not be read.')
  }
  const upload = formData.get('file')
  if (!(upload instanceof File)) throw new ApiError(400, 'FILE_REQUIRED', 'Choose an image to upload.')
  if (!(upload.type in LETTER_IMAGE_POLICY)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use JPEG, PNG, WebP, or AVIF images.')
  }
  const mimeType = upload.type as LetterImageMime
  if (upload.size < 1 || upload.size > MAX_LETTER_IMAGE_BYTES) {
    throw new ApiError(413, 'MEDIA_TOO_LARGE', 'Letter images must be 20 MB or smaller.')
  }
  const signature = new Uint8Array(await upload.slice(0, 16).arrayBuffer())
  if (!hasValidFileSignature(mimeType as AllowedMime, signature)) {
    throw new ApiError(415, 'INVALID_FILE_SIGNATURE', 'The file contents do not match the selected image type.')
  }
  const role = enumValue(formData.get('role') ?? 'page', 'role', MEDIA_ROLES) as LetterMediaRole
  if (role === 'cover' && letter.letter_type !== 'typed') {
    throw new ApiError(400, 'INVALID_MEDIA_ROLE', 'Only typed letters can have a cover image.')
  }
  const media = await listLetterMedia(env, letterId)
  const pages = media.filter((item) => item.media_role === 'page')
  if (role === 'page' && pages.length >= MAX_LETTER_PAGES) {
    throw new ApiError(409, 'LETTER_PAGE_LIMIT', `A letter can contain up to ${MAX_LETTER_PAGES} pages.`)
  }
  if (role === 'cover' && media.some((item) => item.media_role === 'cover')) {
    throw new ApiError(409, 'LETTER_COVER_EXISTS', 'This letter already has a cover image.')
  }

  const mediaId = crypto.randomUUID()
  const originalFilename = safeFilename(upload.name)
  const objectKey = `${session.relationship.id}/letters/${letterId}/${mediaId}.${LETTER_IMAGE_POLICY[mimeType].extension}`
  const altText = optionalString(formData.get('altText') ?? undefined, 'altText', 500) ?? ''
  const sortOrder = role === 'page' ? pages.length : 0
  const now = Date.now()
  await env.MEDIA.put(objectKey, upload, {
    httpMetadata: {
      contentType: mimeType,
      contentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
      cacheControl: 'private, no-store',
    },
    customMetadata: { mediaId, letterId, role },
  })
  try {
    await env.DB.prepare(`
      INSERT INTO future_letter_media (
        id, future_letter_id, relationship_id, uploaded_by_user_id, media_role, media_type,
        r2_key, original_filename, mime_type, size_bytes, width, height, alt_text, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, 'image', ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
    `).bind(
      mediaId, letterId, session.relationship.id, session.user.id, role, objectKey,
      originalFilename, mimeType, upload.size, altText, sortOrder, now,
    ).run()
  } catch (error) {
    await env.MEDIA.delete(objectKey)
    if (role === 'page') {
      const current = await env.DB.prepare(`
        SELECT COUNT(*) AS total FROM future_letter_media
        WHERE future_letter_id = ? AND media_role = 'page'
      `).bind(letterId).first<{ total: number }>()
      if (Number(current?.total ?? 0) >= MAX_LETTER_PAGES) {
        throw new ApiError(409, 'LETTER_PAGE_LIMIT', `A letter can contain up to ${MAX_LETTER_PAGES} pages.`)
      }
    }
    throw error
  }
  const row = await getLetterMedia(env, session.relationship.id, letterId, mediaId)
  return apiSuccess({ media: mediaResponse(row) }, { status: 201 })
}

export const reorderLetterPages = async (request: Request, env: Env, letterId: string): Promise<Response> => {
  assertId(letterId, 'letterId')
  const session = await requireSession(request, env)
  await getOwnedDraft(env, session.relationship.id, session.user.id, letterId)
  const body = asRecord(await readJson(request))
  assertOnlyFields(body, new Set(['pageIds']))
  if (!Array.isArray(body.pageIds) || body.pageIds.some((id) => typeof id !== 'string')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'pageIds must be a list of page IDs.')
  }
  const pageIds = body.pageIds as string[]
  if (pageIds.length > MAX_LETTER_PAGES || new Set(pageIds).size !== pageIds.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'pageIds contains too many or duplicate pages.')
  }
  const media = await listLetterMedia(env, letterId)
  const currentIds = media.filter((item) => item.media_role === 'page').map((item) => item.id)
  if (pageIds.length !== currentIds.length || pageIds.some((id) => !currentIds.includes(id))) {
    throw new ApiError(400, 'LETTER_PAGE_SET_MISMATCH', 'Include every uploaded page exactly once.')
  }
  if (pageIds.length > 0) {
    await env.DB.batch(pageIds.map((id, index) => env.DB.prepare(`
      UPDATE future_letter_media SET sort_order = ?
      WHERE id = ? AND future_letter_id = ? AND relationship_id = ? AND media_role = 'page'
    `).bind(index, id, letterId, session.relationship.id)))
  }
  const reordered = await listLetterMedia(env, letterId)
  return apiSuccess({ media: reordered.map(mediaResponse) })
}

export const deleteLetterMedia = async (
  request: Request,
  env: Env,
  letterId: string,
  mediaId: string,
): Promise<Response> => {
  assertId(letterId, 'letterId')
  assertId(mediaId, 'mediaId')
  const session = await requireSession(request, env)
  await getOwnedDraft(env, session.relationship.id, session.user.id, letterId)
  const media = await getLetterMedia(env, session.relationship.id, letterId, mediaId)
  await env.DB.prepare('DELETE FROM future_letter_media WHERE id = ? AND future_letter_id = ?')
    .bind(mediaId, letterId).run()
  try {
    await env.MEDIA.delete(media.r2_key)
  } catch (error) {
    console.error(JSON.stringify({
      message: 'R2 cleanup failed after future letter media deletion', mediaId,
      error: error instanceof Error ? error.message : String(error),
    }))
  }
  return apiSuccess({ deleted: true })
}

const letterMediaHeaders = (row: LetterMediaRow, etag: string): Headers => new Headers({
  'Cache-Control': 'private, no-store',
  'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.original_filename)}`,
  'Content-Type': row.mime_type,
  ETag: etag,
  Vary: 'Cookie',
})

export const serveLetterMedia = async (
  request: Request,
  env: Env,
  letterId: string,
  mediaId: string,
): Promise<Response> => {
  assertId(letterId, 'letterId')
  assertId(mediaId, 'mediaId')
  const session = await requireSession(request, env)
  const letter = await getVisibleLetter(env, session.relationship.id, session.user.id, letterId)
  if (letter.status === 'draft' && letter.created_by_user_id !== session.user.id) {
    throw new ApiError(404, 'LETTER_MEDIA_NOT_FOUND', 'That letter page was not found.')
  }
  if (letter.status === 'sealed') {
    throw new ApiError(423, 'LETTER_LOCKED', 'Letter pages remain private until the letter has been opened.')
  }
  const media = await getLetterMedia(env, session.relationship.id, letterId, mediaId)
  if (request.method === 'HEAD') {
    const object = await env.MEDIA.head(media.r2_key)
    if (!object) throw new ApiError(404, 'LETTER_MEDIA_NOT_FOUND', 'That letter page was not found.')
    const headers = letterMediaHeaders(media, object.httpEtag)
    headers.set('Content-Length', String(object.size))
    return new Response(null, { status: 200, headers })
  }
  const object = await env.MEDIA.get(media.r2_key)
  if (!object) throw new ApiError(404, 'LETTER_MEDIA_NOT_FOUND', 'That letter page was not found.')
  const headers = letterMediaHeaders(media, object.httpEtag)
  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}
