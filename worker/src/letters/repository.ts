import { ApiError } from '../lib/http'
import type { FutureLetterRow, LetterMediaRow } from './types'

const LETTER_SELECT = `
  SELECT l.id, l.relationship_id, l.created_by_user_id, l.recipient_type, l.recipient_user_id,
    l.title, l.letter_type, l.typed_content, l.teaser, l.status, l.unlock_at, l.sealed_at,
    l.opened_at, l.first_opened_by_user_id, l.created_at, l.updated_at,
    sender.display_name AS sender_name, recipient.display_name AS recipient_name,
    opener.display_name AS first_opened_by_name,
    (SELECT COUNT(*) FROM future_letter_media fm WHERE fm.future_letter_id = l.id AND fm.media_role = 'page') AS page_count,
    (SELECT COUNT(*) FROM future_letter_media fm WHERE fm.future_letter_id = l.id AND fm.media_role = 'cover') AS cover_count
  FROM future_letters l
  JOIN users sender ON sender.id = l.created_by_user_id
  LEFT JOIN users recipient ON recipient.id = l.recipient_user_id
  LEFT JOIN users opener ON opener.id = l.first_opened_by_user_id
`

export const listVisibleLetters = async (env: Env, relationshipId: string, userId: string): Promise<FutureLetterRow[]> => {
  const result = await env.DB.prepare(`${LETTER_SELECT}
    WHERE l.relationship_id = ? AND (l.status <> 'draft' OR l.created_by_user_id = ?)
    ORDER BY CASE l.status WHEN 'draft' THEN 0 WHEN 'sealed' THEN 1 ELSE 2 END,
      COALESCE(l.opened_at, l.unlock_at, l.updated_at) DESC
    LIMIT 250
  `).bind(relationshipId, userId).all<FutureLetterRow>()
  return result.results
}

export const getVisibleLetter = async (
  env: Env,
  relationshipId: string,
  userId: string,
  letterId: string,
): Promise<FutureLetterRow> => {
  const row = await env.DB.prepare(`${LETTER_SELECT}
    WHERE l.id = ? AND l.relationship_id = ? AND (l.status <> 'draft' OR l.created_by_user_id = ?)
    LIMIT 1
  `).bind(letterId, relationshipId, userId).first<FutureLetterRow>()
  if (!row) throw new ApiError(404, 'LETTER_NOT_FOUND', 'That future letter was not found.')
  return row
}

export const getOwnedDraft = async (
  env: Env,
  relationshipId: string,
  userId: string,
  letterId: string,
): Promise<FutureLetterRow> => {
  const row = await env.DB.prepare(`${LETTER_SELECT}
    WHERE l.id = ? AND l.relationship_id = ? AND l.created_by_user_id = ? AND l.status = 'draft'
    LIMIT 1
  `).bind(letterId, relationshipId, userId).first<FutureLetterRow>()
  if (!row) throw new ApiError(404, 'LETTER_NOT_FOUND', 'That future letter was not found.')
  return row
}

export const listLetterMedia = async (env: Env, letterId: string): Promise<LetterMediaRow[]> => {
  const result = await env.DB.prepare(`
    SELECT id, future_letter_id, relationship_id, uploaded_by_user_id, media_role, media_type,
      r2_key, original_filename, mime_type, size_bytes, width, height, alt_text, sort_order, created_at
    FROM future_letter_media WHERE future_letter_id = ?
    ORDER BY CASE media_role WHEN 'cover' THEN 0 ELSE 1 END, sort_order, created_at
  `).bind(letterId).all<LetterMediaRow>()
  return result.results
}

export const getLetterMedia = async (
  env: Env,
  relationshipId: string,
  letterId: string,
  mediaId: string,
): Promise<LetterMediaRow> => {
  const row = await env.DB.prepare(`
    SELECT id, future_letter_id, relationship_id, uploaded_by_user_id, media_role, media_type,
      r2_key, original_filename, mime_type, size_bytes, width, height, alt_text, sort_order, created_at
    FROM future_letter_media
    WHERE id = ? AND future_letter_id = ? AND relationship_id = ? LIMIT 1
  `).bind(mediaId, letterId, relationshipId).first<LetterMediaRow>()
  if (!row) throw new ApiError(404, 'LETTER_MEDIA_NOT_FOUND', 'That letter page was not found.')
  return row
}

export const getLetterSummary = async (env: Env, relationshipId: string, serverNow: number) => {
  const row = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'sealed' AND unlock_at > ? THEN 1 ELSE 0 END) AS sealed_count,
      SUM(CASE WHEN status = 'sealed' AND unlock_at <= ? THEN 1 ELSE 0 END) AS ready_count,
      SUM(CASE WHEN status = 'opened' THEN 1 ELSE 0 END) AS opened_count,
      MIN(CASE WHEN status = 'sealed' AND unlock_at > ? THEN unlock_at ELSE NULL END) AS next_unlock_at
    FROM future_letters WHERE relationship_id = ? AND status <> 'draft'
  `).bind(serverNow, serverNow, serverNow, relationshipId).first<{
    sealed_count: number | null
    ready_count: number | null
    opened_count: number | null
    next_unlock_at: number | null
  }>()
  return {
    sealedCount: Number(row?.sealed_count ?? 0),
    readyCount: Number(row?.ready_count ?? 0),
    openedCount: Number(row?.opened_count ?? 0),
    nextUnlockAt: row?.next_unlock_at === null || row?.next_unlock_at === undefined ? null : Number(row.next_unlock_at),
  }
}
