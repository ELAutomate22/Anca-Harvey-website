import { requireSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { asRecord, isoDate, requiredString, validateTimeZone } from '../lib/validation'

interface RelationshipRow {
  id: string
  title: string
  start_date: string
  timezone: string
  partner_1_user_id: string
  partner_2_user_id: string
}

const serializeRelationship = (row: RelationshipRow) => ({
  id: row.id,
  title: row.title,
  startDate: row.start_date,
  timezone: row.timezone,
  partner1UserId: row.partner_1_user_id,
  partner2UserId: row.partner_2_user_id,
})

export const getRelationship = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const row = await env.DB.prepare(`
    SELECT id, title, start_date, timezone, partner_1_user_id, partner_2_user_id
    FROM relationships WHERE id = ?
  `).bind(session.relationship.id).first<RelationshipRow>()
  if (!row) throw new ApiError(404, 'RELATIONSHIP_NOT_FOUND', 'The relationship record was not found.')
  return apiSuccess(serializeRelationship(row))
}

export const updateRelationship = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const title = body.title === undefined ? session.relationship.title : requiredString(body.title, 'title', 1, 100)
  const startDate = body.startDate === undefined ? session.relationship.startDate : isoDate(body.startDate, 'startDate')
  const timezone = body.timezone === undefined ? session.relationship.timezone : validateTimeZone(body.timezone)

  if (startDate !== session.relationship.startDate && body.confirmStartDateChange !== true) {
    throw new ApiError(
      409,
      'START_DATE_CONFIRMATION_REQUIRED',
      'Changing the relationship date affects counters and milestones. Confirm the change to continue.',
    )
  }

  await env.DB.prepare('UPDATE relationships SET title = ?, start_date = ?, timezone = ?, updated_at = ? WHERE id = ?')
    .bind(title, startDate, timezone, Date.now(), session.relationship.id).run()

  return apiSuccess({
    ...session.relationship,
    title,
    startDate,
    timezone,
  })
}
