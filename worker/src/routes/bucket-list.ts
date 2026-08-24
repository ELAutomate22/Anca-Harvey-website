import { requireSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import {
  BUCKET_CATEGORIES,
  BUCKET_PRIORITIES,
  BUCKET_STATUSES,
  assertId,
  enumValue,
  nullableEnumValue,
  nullableIsoDate,
  optionalEnumValue,
  optionalIsoDate,
  optionalRatingHalfSteps,
  optionalTrimmed,
  todayInTimeZone,
} from '../lib/phase-four'
import { asRecord, requiredString } from '../lib/validation'

interface BucketRow {
  id: string
  relationship_id: string
  created_by_user_id: string
  completed_by_user_id: string | null
  title: string
  description: string
  category: string
  status: 'dreaming' | 'planning' | 'booked' | 'completed'
  target_date: string | null
  location: string
  priority: string | null
  completed_at: string | null
  completion_rating_half_steps: number | null
  completion_note: string
  linked_memory_id: string | null
  created_at: number
  updated_at: number
  memory_title: string | null
  memory_media_id: string | null
}

const BUCKET_SELECT = `
  SELECT b.id, b.relationship_id, b.created_by_user_id, b.completed_by_user_id, b.title,
    b.description, b.category, b.status, b.target_date, b.location, b.priority, b.completed_at,
    b.completion_rating_half_steps, b.completion_note, b.linked_memory_id, b.created_at, b.updated_at,
    m.title AS memory_title,
    (SELECT mm.id FROM memory_media mm WHERE mm.memory_id = m.id AND mm.media_type = 'image'
      ORDER BY mm.sort_order, mm.created_at LIMIT 1) AS memory_media_id
  FROM bucket_list_items b
  LEFT JOIN memories m ON m.id = b.linked_memory_id AND m.relationship_id = b.relationship_id
`

const bucketResponse = (row: BucketRow) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  status: row.status,
  targetDate: row.target_date,
  location: row.location,
  priority: row.priority,
  createdByUserId: row.created_by_user_id,
  completedByUserId: row.completed_by_user_id,
  completedAt: row.completed_at,
  completionRating: row.completion_rating_half_steps === null ? null : Number(row.completion_rating_half_steps) / 2,
  completionNote: row.completion_note,
  linkedMemoryId: row.linked_memory_id,
  linkedMemoryTitle: row.memory_title,
  memoryImageUrl: row.memory_media_id ? `/api/media/${row.memory_media_id}` : null,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const getBucketItem = async (env: Env, relationshipId: string, itemId: string): Promise<BucketRow> => {
  assertId(itemId, 'itemId')
  const row = await env.DB.prepare(`${BUCKET_SELECT} WHERE b.id = ? AND b.relationship_id = ? LIMIT 1`)
    .bind(itemId, relationshipId).first<BucketRow>()
  if (!row) throw new ApiError(404, 'BUCKET_ITEM_NOT_FOUND', 'That bucket-list item was not found.')
  return row
}

export const listBucketItems = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const search = new URL(request.url).searchParams
  const category = search.get('category') || undefined
  const status = search.get('status') || undefined
  if (category) enumValue(category, 'category', BUCKET_CATEGORIES)
  if (status) enumValue(status, 'status', BUCKET_STATUSES)
  const conditions = ['b.relationship_id = ?']
  const values: string[] = [session.relationship.id]
  if (category) { conditions.push('b.category = ?'); values.push(category) }
  if (status) { conditions.push('b.status = ?'); values.push(status) }
  const result = await env.DB.prepare(`${BUCKET_SELECT}
    WHERE ${conditions.join(' AND ')}
    ORDER BY CASE b.status WHEN 'booked' THEN 0 WHEN 'planning' THEN 1 WHEN 'dreaming' THEN 2 ELSE 3 END,
      CASE WHEN b.target_date IS NULL THEN 1 ELSE 0 END, b.target_date, b.updated_at DESC
    LIMIT 250
  `).bind(...values).all<BucketRow>()
  return apiSuccess(result.results.map(bucketResponse))
}

export const createBucketItem = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const title = requiredString(body.title, 'title', 1, 200)
  const description = optionalTrimmed(body.description, 'description', 5_000) ?? ''
  const category = enumValue(body.category, 'category', BUCKET_CATEGORIES)
  const status = optionalEnumValue(body.status, 'status', BUCKET_STATUSES) ?? 'dreaming'
  if (status === 'completed') throw new ApiError(400, 'USE_COMPLETION_ENDPOINT', 'Use the completion action to mark a dream complete.')
  const targetDate = nullableIsoDate(body.targetDate, 'targetDate') ?? null
  const location = optionalTrimmed(body.location, 'location', 250) ?? ''
  const priority = nullableEnumValue(body.priority, 'priority', BUCKET_PRIORITIES) ?? null
  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(`
    INSERT INTO bucket_list_items (id, relationship_id, created_by_user_id, completed_by_user_id,
      title, description, category, status, target_date, location, priority, completed_at,
      completion_rating_half_steps, completion_note, linked_memory_id, created_at, updated_at)
    VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '', NULL, ?, ?)
  `).bind(id, session.relationship.id, session.user.id, title, description, category, status,
    targetDate, location, priority, now, now).run()
  return apiSuccess(bucketResponse({ id, relationship_id: session.relationship.id,
    created_by_user_id: session.user.id, completed_by_user_id: null, title, description, category,
    status, target_date: targetDate, location, priority, completed_at: null,
    completion_rating_half_steps: null, completion_note: '', linked_memory_id: null,
    created_at: now, updated_at: now, memory_title: null, memory_media_id: null }), { status: 201 })
}

export const updateBucketItem = async (request: Request, env: Env, itemId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getBucketItem(env, session.relationship.id, itemId)
  const body = asRecord(await readJson(request))
  const title = body.title === undefined ? current.title : requiredString(body.title, 'title', 1, 200)
  const description = optionalTrimmed(body.description, 'description', 5_000) ?? current.description
  const category = optionalEnumValue(body.category, 'category', BUCKET_CATEGORIES) ?? current.category
  const requestedStatus = optionalEnumValue(body.status, 'status', BUCKET_STATUSES)
  if (requestedStatus === 'completed') {
    throw new ApiError(400, 'USE_COMPLETION_ENDPOINT', 'Use the completion action to mark a dream complete.')
  }
  const targetDateValue = nullableIsoDate(body.targetDate, 'targetDate')
  const location = optionalTrimmed(body.location, 'location', 250) ?? current.location
  const priorityValue = nullableEnumValue(body.priority, 'priority', BUCKET_PRIORITIES)
  const status = requestedStatus ?? current.status
  const reopening = current.status === 'completed' && status !== 'completed'
  const now = Date.now()
  await env.DB.prepare(`
    UPDATE bucket_list_items SET title = ?, description = ?, category = ?, status = ?, target_date = ?,
      location = ?, priority = ?, completed_by_user_id = ?, completed_at = ?, completion_rating_half_steps = ?,
      completion_note = ?, linked_memory_id = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ?
  `).bind(title, description, category, status,
    targetDateValue === undefined ? current.target_date : targetDateValue, location,
    priorityValue === undefined ? current.priority : priorityValue,
    reopening ? null : current.completed_by_user_id, reopening ? null : current.completed_at,
    reopening ? null : current.completion_rating_half_steps, reopening ? '' : current.completion_note,
    reopening ? null : current.linked_memory_id, now, itemId, session.relationship.id).run()
  return apiSuccess(bucketResponse({ ...current, title, description, category, status,
    target_date: targetDateValue === undefined ? current.target_date : targetDateValue,
    location, priority: priorityValue === undefined ? current.priority : priorityValue,
    completed_by_user_id: reopening ? null : current.completed_by_user_id,
    completed_at: reopening ? null : current.completed_at,
    completion_rating_half_steps: reopening ? null : current.completion_rating_half_steps,
    completion_note: reopening ? '' : current.completion_note,
    linked_memory_id: reopening ? null : current.linked_memory_id,
    memory_title: reopening ? null : current.memory_title,
    memory_media_id: reopening ? null : current.memory_media_id, updated_at: now }))
}

export const deleteBucketItem = async (request: Request, env: Env, itemId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const item = await getBucketItem(env, session.relationship.id, itemId)
  await env.DB.prepare('DELETE FROM bucket_list_items WHERE id = ? AND relationship_id = ?')
    .bind(itemId, session.relationship.id).run()
  return apiSuccess({ deleted: true, linkedMemoryId: item.linked_memory_id })
}

export const completeBucketItem = async (request: Request, env: Env, itemId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const item = await getBucketItem(env, session.relationship.id, itemId)
  if (item.status === 'completed') throw new ApiError(409, 'BUCKET_ITEM_ALREADY_COMPLETED', 'That dream is already complete.')
  const body = asRecord(await readJson(request))
  const completedAt = optionalIsoDate(body.completedAt, 'completedAt') ?? todayInTimeZone(session.relationship.timezone)
  const rating = optionalRatingHalfSteps(body.rating, 'rating') ?? null
  const note = optionalTrimmed(body.note, 'note', 5_000) ?? ''
  const createMemory = body.createMemory === true
  if (body.createMemory !== undefined && typeof body.createMemory !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'createMemory must be true or false.')
  }
  const memoryId = createMemory ? crypto.randomUUID() : null
  const now = Date.now()
  const statements: D1PreparedStatement[] = []
  if (memoryId) {
    statements.push(env.DB.prepare(`
      INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, location,
        memory_date, category, favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'bucket-list', 0, ?, ?)
    `).bind(memoryId, session.relationship.id, session.user.id, item.title, note,
      item.location, completedAt, now, now))
  }
  statements.push(env.DB.prepare(`
    UPDATE bucket_list_items SET status = 'completed', completed_by_user_id = ?, completed_at = ?,
      completion_rating_half_steps = ?, completion_note = ?, linked_memory_id = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND status <> 'completed'
  `).bind(session.user.id, completedAt, rating, note, memoryId, now, itemId, session.relationship.id))
  await env.DB.batch(statements)
  const completed = await getBucketItem(env, session.relationship.id, itemId)
  return apiSuccess({ item: bucketResponse(completed), memoryId }, { status: 201 })
}

export const randomBucketItem = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const row = await env.DB.prepare(`${BUCKET_SELECT}
    WHERE b.relationship_id = ? AND b.status <> 'completed' ORDER BY RANDOM() LIMIT 1
  `).bind(session.relationship.id).first<BucketRow>()
  if (!row) throw new ApiError(404, 'NO_BUCKET_ITEM_AVAILABLE', 'Add a new dream before asking for a random pick.')
  return apiSuccess(bucketResponse(row))
}

export const bucketStats = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const relationshipId = session.relationship.id
  const [totals, categories] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN status = 'planning' THEN 1 ELSE 0 END) AS planning_count,
        SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) AS booked_count
      FROM bucket_list_items WHERE relationship_id = ?
    `).bind(relationshipId).first<{ total_count: number; completed_count: number | null; planning_count: number | null; booked_count: number | null }>(),
    env.DB.prepare(`
      SELECT category, COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
      FROM bucket_list_items WHERE relationship_id = ? GROUP BY category ORDER BY total DESC, category
    `).bind(relationshipId).all<{ category: string; total: number; completed: number | null }>(),
  ])
  const total = Number(totals?.total_count ?? 0)
  const completed = Number(totals?.completed_count ?? 0)
  return apiSuccess({ totalCount: total, completedCount: completed,
    planningCount: Number(totals?.planning_count ?? 0), bookedCount: Number(totals?.booked_count ?? 0),
    progressPercent: total ? Math.round(completed / total * 100) : 0,
    categories: categories.results.map((row) => ({ category: row.category,
      total: Number(row.total), completed: Number(row.completed ?? 0) })) })
}
