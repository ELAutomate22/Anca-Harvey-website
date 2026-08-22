import { requireSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { asRecord, isoDate, optionalString, requiredString } from '../lib/validation'

interface TimelineRow {
  id: string
  created_by_user_id: string
  title: string
  description: string
  event_date: string
  eyebrow: string
  created_at: number
  updated_at: number
}

const timelineResponse = (row: TimelineRow) => ({
  id: row.id,
  createdByUserId: row.created_by_user_id,
  title: row.title,
  description: row.description,
  date: row.event_date,
  eyebrow: row.eyebrow,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const getOwnedEntry = async (env: Env, relationshipId: string, entryId: string): Promise<TimelineRow> => {
  const row = await env.DB.prepare(`
    SELECT id, created_by_user_id, title, description, event_date, eyebrow, created_at, updated_at
    FROM timeline_entries WHERE id = ? AND relationship_id = ? LIMIT 1
  `).bind(entryId, relationshipId).first<TimelineRow>()
  if (!row) throw new ApiError(404, 'TIMELINE_ENTRY_NOT_FOUND', 'That timeline entry was not found.')
  return row
}

export const listTimeline = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const result = await env.DB.prepare(`
    SELECT id, created_by_user_id, title, description, event_date, eyebrow, created_at, updated_at
    FROM timeline_entries WHERE relationship_id = ? ORDER BY event_date, id
  `).bind(session.relationship.id).all<TimelineRow>()
  return apiSuccess(result.results.map(timelineResponse))
}

export const createTimelineEntry = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const title = requiredString(body.title, 'title', 1, 120)
  const description = optionalString(body.description, 'description', 2_000) ?? ''
  const date = isoDate(body.date, 'date')
  const eyebrow = body.eyebrow === undefined ? 'Our note' : requiredString(body.eyebrow, 'eyebrow', 1, 80)
  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(`
    INSERT INTO timeline_entries (
      id, relationship_id, created_by_user_id, title, description, event_date, eyebrow, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, session.relationship.id, session.user.id, title, description, date, eyebrow, now, now).run()

  return apiSuccess(timelineResponse({
    id,
    created_by_user_id: session.user.id,
    title,
    description,
    event_date: date,
    eyebrow,
    created_at: now,
    updated_at: now,
  }), { status: 201 })
}

export const updateTimelineEntry = async (
  request: Request,
  env: Env,
  entryId: string,
): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getOwnedEntry(env, session.relationship.id, entryId)
  const body = asRecord(await readJson(request))
  const title = body.title === undefined ? current.title : requiredString(body.title, 'title', 1, 120)
  const description = body.description === undefined
    ? current.description
    : (optionalString(body.description, 'description', 2_000) ?? '')
  const date = body.date === undefined ? current.event_date : isoDate(body.date, 'date')
  const eyebrow = body.eyebrow === undefined ? current.eyebrow : requiredString(body.eyebrow, 'eyebrow', 1, 80)
  const now = Date.now()

  await env.DB.prepare(`
    UPDATE timeline_entries SET title = ?, description = ?, event_date = ?, eyebrow = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ?
  `).bind(title, description, date, eyebrow, now, entryId, session.relationship.id).run()

  return apiSuccess(timelineResponse({
    ...current,
    title,
    description,
    event_date: date,
    eyebrow,
    updated_at: now,
  }))
}

export const deleteTimelineEntry = async (
  request: Request,
  env: Env,
  entryId: string,
): Promise<Response> => {
  const session = await requireSession(request, env)
  await getOwnedEntry(env, session.relationship.id, entryId)
  await env.DB.prepare('DELETE FROM timeline_entries WHERE id = ? AND relationship_id = ?')
    .bind(entryId, session.relationship.id).run()
  return apiSuccess({ deleted: true })
}
