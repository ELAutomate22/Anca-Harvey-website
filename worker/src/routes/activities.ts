import { requireSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import {
  ACTIVITY_BUDGETS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_DURATIONS,
  ACTIVITY_ENERGIES,
  ACTIVITY_LOCATIONS,
  assertId,
  enumValue,
  nullableIsoDate,
  optionalEnumValue,
  optionalIsoDate,
  optionalRatingHalfSteps,
  optionalTime,
  optionalTrimmed,
  todayInTimeZone,
} from '../lib/phase-four'
import { asRecord, isoDate, requiredString } from '../lib/validation'

interface ActivityRow {
  id: string
  relationship_id: string | null
  created_by_user_id: string | null
  name: string
  description: string
  category: string
  location_type: string
  budget_level: string
  energy_level: string
  duration_category: string
  notes: string
  is_builtin: number
  is_active: number
  created_at: number
  updated_at: number
  is_saved?: number
  is_hidden?: number
}

interface PlanRow {
  id: string
  relationship_id: string
  activity_id: string
  planned_date: string
  planned_time: string | null
  note: string
  status: 'planned' | 'completed' | 'cancelled'
  created_by_user_id: string
  created_at: number
  updated_at: number
  activity_name: string
  activity_category: string
}

interface HistoryRow {
  id: string
  relationship_id: string
  activity_id: string
  planned_activity_id: string | null
  completed_date: string
  rating_half_steps: number | null
  notes: string
  created_by_user_id: string
  linked_memory_id: string | null
  created_at: number
  updated_at: number
  activity_name: string
  activity_category: string
  memory_title: string | null
  memory_media_id: string | null
}

const ACTIVITY_SELECT = `
  SELECT a.id, a.relationship_id, a.created_by_user_id, a.name, a.description, a.category,
    a.location_type, a.budget_level, a.energy_level, a.duration_category, a.notes,
    a.is_builtin, a.is_active, a.created_at, a.updated_at,
    CASE WHEN sa.activity_id IS NULL THEN 0 ELSE 1 END AS is_saved,
    CASE WHEN ae.activity_id IS NULL THEN 0 ELSE 1 END AS is_hidden
  FROM activities a
  LEFT JOIN saved_activities sa ON sa.activity_id = a.id AND sa.relationship_id = ?
  LEFT JOIN activity_exclusions ae ON ae.activity_id = a.id AND ae.relationship_id = ?
`

const activityResponse = (row: ActivityRow) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  category: row.category,
  locationType: row.location_type,
  budgetLevel: row.budget_level,
  energyLevel: row.energy_level,
  durationCategory: row.duration_category,
  notes: row.notes,
  isBuiltin: Boolean(row.is_builtin),
  isSaved: Boolean(row.is_saved),
  isHidden: Boolean(row.is_hidden),
  createdByUserId: row.created_by_user_id,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const planResponse = (row: PlanRow) => ({
  id: row.id,
  activityId: row.activity_id,
  activityName: row.activity_name,
  activityCategory: row.activity_category,
  plannedDate: row.planned_date,
  plannedTime: row.planned_time,
  note: row.note,
  status: row.status,
  createdByUserId: row.created_by_user_id,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const historyResponse = (row: HistoryRow) => ({
  id: row.id,
  activityId: row.activity_id,
  activityName: row.activity_name,
  activityCategory: row.activity_category,
  plannedActivityId: row.planned_activity_id,
  completedDate: row.completed_date,
  rating: row.rating_half_steps === null ? null : Number(row.rating_half_steps) / 2,
  notes: row.notes,
  createdByUserId: row.created_by_user_id,
  linkedMemoryId: row.linked_memory_id,
  linkedMemoryTitle: row.memory_title,
  memoryImageUrl: row.memory_media_id ? `/api/media/${row.memory_media_id}` : null,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const getActivity = async (
  env: Env,
  relationshipId: string,
  activityId: string,
  allowHidden = false,
): Promise<ActivityRow> => {
  assertId(activityId, 'activityId')
  const row = await env.DB.prepare(`${ACTIVITY_SELECT}
    WHERE a.id = ? AND a.is_active = 1
      AND (a.is_builtin = 1 OR a.relationship_id = ?)
      ${allowHidden ? '' : 'AND ae.activity_id IS NULL'}
    LIMIT 1
  `).bind(relationshipId, relationshipId, activityId, relationshipId).first<ActivityRow>()
  if (!row) throw new ApiError(404, 'ACTIVITY_NOT_FOUND', 'That activity was not found.')
  return row
}

const activityInput = async (request: Request, current?: ActivityRow) => {
  const body = asRecord(await readJson(request))
  return {
    name: body.name === undefined && current ? current.name : requiredString(body.name, 'name', 1, 150),
    description: body.description === undefined && current ? current.description : (optionalTrimmed(body.description, 'description', 2_000) ?? ''),
    category: body.category === undefined && current ? current.category : enumValue(body.category, 'category', ACTIVITY_CATEGORIES),
    locationType: body.locationType === undefined && current ? current.location_type : enumValue(body.locationType, 'locationType', ACTIVITY_LOCATIONS),
    budgetLevel: body.budgetLevel === undefined && current ? current.budget_level : enumValue(body.budgetLevel, 'budgetLevel', ACTIVITY_BUDGETS),
    energyLevel: body.energyLevel === undefined && current ? current.energy_level : enumValue(body.energyLevel, 'energyLevel', ACTIVITY_ENERGIES),
    durationCategory: body.durationCategory === undefined && current ? current.duration_category : enumValue(body.durationCategory, 'durationCategory', ACTIVITY_DURATIONS),
    notes: body.notes === undefined && current ? current.notes : (optionalTrimmed(body.notes, 'notes', 5_000) ?? ''),
  }
}

export const listActivities = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const search = new URL(request.url).searchParams
  const category = search.get('category') || undefined
  const location = search.get('locationType') || undefined
  const budget = search.get('budgetLevel') || undefined
  const energy = search.get('energyLevel') || undefined
  const duration = search.get('durationCategory') || undefined
  const savedOnly = search.get('saved') === 'true'
  const hiddenOnly = search.get('hidden') === 'true'
  if (category) enumValue(category, 'category', ACTIVITY_CATEGORIES)
  if (location) enumValue(location, 'locationType', ACTIVITY_LOCATIONS)
  if (budget) enumValue(budget, 'budgetLevel', ACTIVITY_BUDGETS)
  if (energy) enumValue(energy, 'energyLevel', ACTIVITY_ENERGIES)
  if (duration) enumValue(duration, 'durationCategory', ACTIVITY_DURATIONS)

  const conditions = ['a.is_active = 1', '(a.is_builtin = 1 OR a.relationship_id = ?)']
  const values: Array<string | number> = [session.relationship.id, session.relationship.id, session.relationship.id]
  if (hiddenOnly) conditions.push('ae.activity_id IS NOT NULL')
  else conditions.push('ae.activity_id IS NULL')
  if (savedOnly) conditions.push('sa.activity_id IS NOT NULL')
  if (category) { conditions.push('a.category = ?'); values.push(category) }
  if (location && location !== 'either') {
    if (location === 'indoor') conditions.push("a.location_type IN ('indoor', 'either', 'home')")
    if (location === 'outdoor') conditions.push("a.location_type IN ('outdoor', 'either')")
    if (location === 'home') conditions.push("a.location_type IN ('home', 'either')")
  }
  if (budget) { conditions.push('a.budget_level = ?'); values.push(budget) }
  if (energy) { conditions.push('a.energy_level = ?'); values.push(energy) }
  if (duration) { conditions.push('a.duration_category = ?'); values.push(duration) }
  const result = await env.DB.prepare(`${ACTIVITY_SELECT}
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.is_builtin DESC, a.name COLLATE NOCASE
    LIMIT 250
  `).bind(...values).all<ActivityRow>()
  return apiSuccess(result.results.map(activityResponse))
}

export const createActivity = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const input = await activityInput(request)
  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(`
    INSERT INTO activities (id, relationship_id, created_by_user_id, name, description, category,
      location_type, budget_level, energy_level, duration_category, notes, is_builtin, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `).bind(id, session.relationship.id, session.user.id, input.name, input.description, input.category,
    input.locationType, input.budgetLevel, input.energyLevel, input.durationCategory, input.notes, now, now).run()
  return apiSuccess(activityResponse({
    id, relationship_id: session.relationship.id, created_by_user_id: session.user.id,
    name: input.name, description: input.description, category: input.category,
    location_type: input.locationType, budget_level: input.budgetLevel, energy_level: input.energyLevel,
    duration_category: input.durationCategory, notes: input.notes, is_builtin: 0, is_active: 1,
    created_at: now, updated_at: now, is_saved: 0, is_hidden: 0,
  }), { status: 201 })
}

export const updateActivity = async (request: Request, env: Env, activityId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getActivity(env, session.relationship.id, activityId, true)
  if (current.is_builtin || current.relationship_id !== session.relationship.id) {
    throw new ApiError(403, 'BUILTIN_ACTIVITY_IMMUTABLE', 'Starter activities cannot be edited.')
  }
  const input = await activityInput(request, current)
  const now = Date.now()
  await env.DB.prepare(`
    UPDATE activities SET name = ?, description = ?, category = ?, location_type = ?, budget_level = ?,
      energy_level = ?, duration_category = ?, notes = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND is_builtin = 0
  `).bind(input.name, input.description, input.category, input.locationType, input.budgetLevel,
    input.energyLevel, input.durationCategory, input.notes, now, activityId, session.relationship.id).run()
  return apiSuccess(activityResponse({ ...current, name: input.name, description: input.description,
    category: input.category, location_type: input.locationType, budget_level: input.budgetLevel,
    energy_level: input.energyLevel, duration_category: input.durationCategory, notes: input.notes, updated_at: now }))
}

export const deleteActivity = async (request: Request, env: Env, activityId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getActivity(env, session.relationship.id, activityId, true)
  if (current.is_builtin || current.relationship_id !== session.relationship.id) {
    throw new ApiError(403, 'BUILTIN_ACTIVITY_IMMUTABLE', 'Starter activities cannot be deleted.')
  }
  await env.DB.prepare('UPDATE activities SET is_active = 0, updated_at = ? WHERE id = ? AND relationship_id = ?')
    .bind(Date.now(), activityId, session.relationship.id).run()
  return apiSuccess({ deleted: true })
}

export const hideActivity = async (request: Request, env: Env, activityId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  await getActivity(env, session.relationship.id, activityId, true)
  await env.DB.prepare(`
    INSERT INTO activity_exclusions (relationship_id, activity_id, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?) ON CONFLICT (relationship_id, activity_id) DO NOTHING
  `).bind(session.relationship.id, activityId, session.user.id, Date.now()).run()
  return apiSuccess({ hidden: true })
}

export const restoreActivity = async (request: Request, env: Env, activityId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  assertId(activityId, 'activityId')
  await env.DB.prepare('DELETE FROM activity_exclusions WHERE relationship_id = ? AND activity_id = ?')
    .bind(session.relationship.id, activityId).run()
  return apiSuccess({ hidden: false })
}

export const saveActivity = async (request: Request, env: Env, activityId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  await getActivity(env, session.relationship.id, activityId)
  await env.DB.prepare(`
    INSERT INTO saved_activities (relationship_id, activity_id, saved_by_user_id, created_at)
    VALUES (?, ?, ?, ?) ON CONFLICT (relationship_id, activity_id) DO UPDATE SET saved_by_user_id = excluded.saved_by_user_id
  `).bind(session.relationship.id, activityId, session.user.id, Date.now()).run()
  return apiSuccess({ saved: true })
}

export const unsaveActivity = async (request: Request, env: Env, activityId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  assertId(activityId, 'activityId')
  await env.DB.prepare('DELETE FROM saved_activities WHERE relationship_id = ? AND activity_id = ?')
    .bind(session.relationship.id, activityId).run()
  return apiSuccess({ saved: false })
}

export const randomActivity = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const category = optionalEnumValue(body.category, 'category', ACTIVITY_CATEGORIES)
  const location = optionalEnumValue(body.locationType, 'locationType', ACTIVITY_LOCATIONS)
  const budget = optionalEnumValue(body.budgetLevel, 'budgetLevel', ACTIVITY_BUDGETS)
  const energy = optionalEnumValue(body.energyLevel, 'energyLevel', ACTIVITY_ENERGIES)
  const duration = optionalEnumValue(body.durationCategory, 'durationCategory', ACTIVITY_DURATIONS)
  const conditions = ['a.is_active = 1', '(a.is_builtin = 1 OR a.relationship_id = ?)', 'ae.activity_id IS NULL']
  const values: Array<string | number> = [session.relationship.id, session.relationship.id, session.relationship.id]
  if (category) { conditions.push('a.category = ?'); values.push(category) }
  if (location && location !== 'either') {
    if (location === 'indoor') conditions.push("a.location_type IN ('indoor', 'either', 'home')")
    if (location === 'outdoor') conditions.push("a.location_type IN ('outdoor', 'either')")
    if (location === 'home') conditions.push("a.location_type IN ('home', 'either')")
  }
  if (budget) { conditions.push('a.budget_level = ?'); values.push(budget) }
  if (energy) { conditions.push('a.energy_level = ?'); values.push(energy) }
  if (duration) { conditions.push('a.duration_category = ?'); values.push(duration) }
  const candidates = await env.DB.prepare(`${ACTIVITY_SELECT}
    WHERE ${conditions.join(' AND ')}
    ORDER BY RANDOM() LIMIT 80
  `).bind(...values).all<ActivityRow>()
  if (candidates.results.length === 0) {
    throw new ApiError(404, 'NO_ACTIVITY_MATCH', 'No visible activity matches those filters. Try widening one choice.')
  }
  const recent = await env.DB.prepare(`
    SELECT activity_id FROM activity_suggestions WHERE relationship_id = ? ORDER BY suggested_at DESC LIMIT 8
  `).bind(session.relationship.id).all<{ activity_id: string }>()
  const recentIds = new Set(recent.results.map((row) => row.activity_id))
  const fresh = candidates.results.filter((row) => !recentIds.has(row.id))
  const pool = fresh.length ? fresh : candidates.results
  const bytes = new Uint32Array(1)
  crypto.getRandomValues(bytes)
  const selected = pool[(bytes[0] ?? 0) % pool.length]
  if (!selected) throw new ApiError(500, 'ACTIVITY_SELECTION_FAILED', 'An activity could not be selected.')
  const suggestionId = crypto.randomUUID()
  await env.DB.prepare(`
    INSERT INTO activity_suggestions (id, relationship_id, activity_id, created_by_user_id, accepted, suggested_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).bind(suggestionId, session.relationship.id, selected.id, session.user.id, Date.now()).run()
  return apiSuccess({ suggestionId, activity: activityResponse(selected), repeatedAfterExhaustion: fresh.length === 0 })
}

const PLAN_SELECT = `
  SELECT p.id, p.relationship_id, p.activity_id, p.planned_date, p.planned_time, p.note, p.status,
    p.created_by_user_id, p.created_at, p.updated_at, a.name AS activity_name, a.category AS activity_category
  FROM planned_activities p JOIN activities a ON a.id = p.activity_id
`

const getPlan = async (env: Env, relationshipId: string, planId: string): Promise<PlanRow> => {
  assertId(planId, 'planId')
  const row = await env.DB.prepare(`${PLAN_SELECT} WHERE p.id = ? AND p.relationship_id = ? LIMIT 1`)
    .bind(planId, relationshipId).first<PlanRow>()
  if (!row) throw new ApiError(404, 'PLAN_NOT_FOUND', 'That planned activity was not found.')
  return row
}

export const listPlannedActivities = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const status = new URL(request.url).searchParams.get('status')
  if (status && !['planned', 'completed', 'cancelled', 'all'].includes(status)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'status is invalid.')
  }
  const values: string[] = [session.relationship.id]
  const clause = status && status !== 'all' ? 'AND p.status = ?' : ''
  if (status && status !== 'all') values.push(status)
  const result = await env.DB.prepare(`${PLAN_SELECT}
    WHERE p.relationship_id = ? ${clause}
    ORDER BY CASE p.status WHEN 'planned' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
      p.planned_date ASC, COALESCE(p.planned_time, '99:99') ASC, p.created_at DESC
    LIMIT 250
  `).bind(...values).all<PlanRow>()
  return apiSuccess(result.results.map(planResponse))
}

export const createPlannedActivity = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const activityId = requiredString(body.activityId, 'activityId', 1, 100)
  const activity = await getActivity(env, session.relationship.id, activityId)
  const plannedDate = isoDate(body.plannedDate, 'plannedDate')
  const plannedTime = optionalTime(body.plannedTime, 'plannedTime') ?? null
  const note = optionalTrimmed(body.note, 'note', 5_000) ?? ''
  const suggestionId = optionalTrimmed(body.suggestionId, 'suggestionId', 100)
  const id = crypto.randomUUID()
  const now = Date.now()
  const statements = [env.DB.prepare(`
    INSERT INTO planned_activities (id, relationship_id, activity_id, planned_date, planned_time, note,
      status, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, ?, ?)
  `).bind(id, session.relationship.id, activity.id, plannedDate, plannedTime, note, session.user.id, now, now)]
  if (suggestionId) {
    statements.push(env.DB.prepare(`
      UPDATE activity_suggestions SET accepted = 1
      WHERE id = ? AND relationship_id = ? AND activity_id = ?
    `).bind(suggestionId, session.relationship.id, activity.id))
  }
  await env.DB.batch(statements)
  return apiSuccess(planResponse({ id, relationship_id: session.relationship.id, activity_id: activity.id,
    planned_date: plannedDate, planned_time: plannedTime, note, status: 'planned',
    created_by_user_id: session.user.id, created_at: now, updated_at: now,
    activity_name: activity.name, activity_category: activity.category }), { status: 201 })
}

export const updatePlannedActivity = async (request: Request, env: Env, planId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getPlan(env, session.relationship.id, planId)
  if (current.status !== 'planned') throw new ApiError(409, 'PLAN_NOT_EDITABLE', 'Only upcoming plans can be edited.')
  const body = asRecord(await readJson(request))
  const plannedDate = optionalIsoDate(body.plannedDate, 'plannedDate') ?? current.planned_date
  const plannedTime = optionalTime(body.plannedTime, 'plannedTime')
  const note = optionalTrimmed(body.note, 'note', 5_000)
  const updated: PlanRow = { ...current, planned_date: plannedDate,
    planned_time: plannedTime === undefined ? current.planned_time : plannedTime,
    note: note ?? current.note, updated_at: Date.now() }
  await env.DB.prepare(`UPDATE planned_activities SET planned_date = ?, planned_time = ?, note = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND status = 'planned'`)
    .bind(updated.planned_date, updated.planned_time, updated.note, updated.updated_at, planId, session.relationship.id).run()
  return apiSuccess(planResponse(updated))
}

export const cancelPlannedActivity = async (request: Request, env: Env, planId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getPlan(env, session.relationship.id, planId)
  if (current.status !== 'planned') throw new ApiError(409, 'PLAN_NOT_CANCELLABLE', 'Only upcoming plans can be cancelled.')
  const now = Date.now()
  await env.DB.prepare(`UPDATE planned_activities SET status = 'cancelled', updated_at = ?
    WHERE id = ? AND relationship_id = ? AND status = 'planned'`).bind(now, planId, session.relationship.id).run()
  return apiSuccess(planResponse({ ...current, status: 'cancelled', updated_at: now }))
}

const HISTORY_SELECT = `
  SELECT h.id, h.relationship_id, h.activity_id, h.planned_activity_id, h.completed_date,
    h.rating_half_steps, h.notes, h.created_by_user_id, h.linked_memory_id, h.created_at, h.updated_at,
    a.name AS activity_name, a.category AS activity_category, m.title AS memory_title,
    (SELECT mm.id FROM memory_media mm WHERE mm.memory_id = m.id AND mm.media_type = 'image'
      ORDER BY mm.sort_order, mm.created_at LIMIT 1) AS memory_media_id
  FROM activity_history h
  JOIN activities a ON a.id = h.activity_id
  LEFT JOIN memories m ON m.id = h.linked_memory_id AND m.relationship_id = h.relationship_id
`

const getHistory = async (env: Env, relationshipId: string, historyId: string): Promise<HistoryRow> => {
  assertId(historyId, 'historyId')
  const row = await env.DB.prepare(`${HISTORY_SELECT} WHERE h.id = ? AND h.relationship_id = ? LIMIT 1`)
    .bind(historyId, relationshipId).first<HistoryRow>()
  if (!row) throw new ApiError(404, 'HISTORY_NOT_FOUND', 'That activity history entry was not found.')
  return row
}

export const completePlannedActivity = async (request: Request, env: Env, planId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const plan = await getPlan(env, session.relationship.id, planId)
  if (plan.status !== 'planned') throw new ApiError(409, 'PLAN_ALREADY_RESOLVED', 'That plan has already been completed or cancelled.')
  const body = asRecord(await readJson(request))
  const completedDate = optionalIsoDate(body.completedDate, 'completedDate') ?? todayInTimeZone(session.relationship.timezone)
  const rating = optionalRatingHalfSteps(body.rating) ?? null
  const notes = optionalTrimmed(body.notes, 'notes', 5_000) ?? ''
  const createMemory = body.createMemory === true
  if (body.createMemory !== undefined && typeof body.createMemory !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'createMemory must be true or false.')
  }
  const now = Date.now()
  const historyId = crypto.randomUUID()
  const memoryId = createMemory ? crypto.randomUUID() : null
  const statements: D1PreparedStatement[] = []
  if (memoryId) {
    statements.push(env.DB.prepare(`
      INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, location,
        memory_date, category, favorite, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '', ?, 'activity', 0, ?, ?)
    `).bind(memoryId, session.relationship.id, session.user.id, plan.activity_name, notes, completedDate, now, now))
  }
  statements.push(
    env.DB.prepare(`
      INSERT INTO activity_history (id, relationship_id, activity_id, planned_activity_id, completed_date,
        rating_half_steps, notes, created_by_user_id, linked_memory_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(historyId, session.relationship.id, plan.activity_id, plan.id, completedDate, rating, notes,
      session.user.id, memoryId, now, now),
    env.DB.prepare(`UPDATE planned_activities SET status = 'completed', updated_at = ?
      WHERE id = ? AND relationship_id = ? AND status = 'planned'`).bind(now, plan.id, session.relationship.id),
  )
  await env.DB.batch(statements)
  const row = await getHistory(env, session.relationship.id, historyId)
  return apiSuccess({ history: historyResponse(row), memoryId }, { status: 201 })
}

export const listActivityHistory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const result = await env.DB.prepare(`${HISTORY_SELECT}
    WHERE h.relationship_id = ? ORDER BY h.completed_date DESC, h.created_at DESC LIMIT 250
  `).bind(session.relationship.id).all<HistoryRow>()
  return apiSuccess(result.results.map(historyResponse))
}

export const updateActivityHistory = async (request: Request, env: Env, historyId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getHistory(env, session.relationship.id, historyId)
  const body = asRecord(await readJson(request))
  const completedDate = nullableIsoDate(body.completedDate, 'completedDate') ?? current.completed_date
  const rating = optionalRatingHalfSteps(body.rating)
  const notes = optionalTrimmed(body.notes, 'notes', 5_000)
  const now = Date.now()
  await env.DB.prepare(`UPDATE activity_history SET completed_date = ?, rating_half_steps = ?, notes = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ?`).bind(completedDate,
      rating === undefined ? current.rating_half_steps : rating, notes ?? current.notes, now, historyId, session.relationship.id).run()
  return apiSuccess(historyResponse({ ...current, completed_date: completedDate,
    rating_half_steps: rating === undefined ? current.rating_half_steps : rating,
    notes: notes ?? current.notes, updated_at: now }))
}

export const deleteActivityHistory = async (request: Request, env: Env, historyId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await getHistory(env, session.relationship.id, historyId)
  const statements = [env.DB.prepare('DELETE FROM activity_history WHERE id = ? AND relationship_id = ?')
    .bind(historyId, session.relationship.id)]
  if (current.planned_activity_id) {
    statements.push(env.DB.prepare(`UPDATE planned_activities SET status = 'planned', updated_at = ?
      WHERE id = ? AND relationship_id = ? AND status = 'completed'`)
      .bind(Date.now(), current.planned_activity_id, session.relationship.id))
  }
  await env.DB.batch(statements)
  return apiSuccess({ deleted: true, linkedMemoryId: current.linked_memory_id })
}

export const activityStats = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const relationshipId = session.relationship.id
  const [totals, favorite] = await Promise.all([
    env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM activity_history WHERE relationship_id = ?) AS completed_count,
        (SELECT ROUND(AVG(rating_half_steps) / 2.0, 2) FROM activity_history WHERE relationship_id = ? AND rating_half_steps IS NOT NULL) AS average_rating,
        (SELECT COUNT(*) FROM saved_activities WHERE relationship_id = ?) AS saved_count,
        (SELECT COUNT(*) FROM planned_activities WHERE relationship_id = ? AND status = 'planned') AS planned_count
    `).bind(relationshipId, relationshipId, relationshipId, relationshipId).first<{
      completed_count: number; average_rating: number | null; saved_count: number; planned_count: number
    }>(),
    env.DB.prepare(`
      SELECT a.category, COUNT(*) AS count FROM activity_history h JOIN activities a ON a.id = h.activity_id
      WHERE h.relationship_id = ? GROUP BY a.category ORDER BY count DESC, a.category LIMIT 1
    `).bind(relationshipId).first<{ category: string; count: number }>(),
  ])
  return apiSuccess({ completedCount: Number(totals?.completed_count ?? 0),
    averageRating: totals?.average_rating === null || totals?.average_rating === undefined ? null : Number(totals.average_rating),
    savedCount: Number(totals?.saved_count ?? 0), plannedCount: Number(totals?.planned_count ?? 0),
    favoriteCategory: favorite?.category ?? null })
}
