import { ApiError } from '../lib/http'
import type { BackupEstimate, BackupJobPublic, BackupJobStatus, BackupType } from './types'
import { BACKUP_DOWNLOAD_WINDOW_MS, BACKUP_FORMAT_VERSION } from './types'

interface BackupJobRow {
  id: string
  relationship_id: string
  requested_by_user_id: string
  requested_by_display_name: string
  backup_type: BackupType
  status: BackupJobStatus
  format_version: string
  include_requester_drafts: number
  estimated_bytes: number | null
  planned_media_files: number
  exported_media_files: number
  missing_media_files: number
  archive_bytes: number | null
  error_code: string | null
  snapshot_started_at: number | null
  created_at: number
  started_at: number | null
  completed_at: number | null
  expires_at: number
  downloaded_at: number | null
}

const JOB_SELECT = `
  SELECT j.id, j.relationship_id, j.requested_by_user_id, u.display_name AS requested_by_display_name,
    j.backup_type, j.status, j.format_version, j.include_requester_drafts, j.estimated_bytes,
    j.planned_media_files, j.exported_media_files, j.missing_media_files, j.archive_bytes,
    j.error_code, j.snapshot_started_at, j.created_at, j.started_at, j.completed_at,
    j.expires_at, j.downloaded_at
  FROM backup_jobs j
  JOIN users u ON u.id = j.requested_by_user_id
`

const iso = (value: number | null): string | null => value === null ? null : new Date(Number(value)).toISOString()

export const jobResponse = (row: BackupJobRow, currentUserId: string, now = Date.now()): BackupJobPublic => ({
  id: row.id,
  type: row.backup_type,
  status: row.status,
  formatVersion: BACKUP_FORMAT_VERSION,
  requestedBy: { id: row.requested_by_user_id, displayName: row.requested_by_display_name },
  includeMyDrafts: row.requested_by_user_id === currentUserId && Boolean(row.include_requester_drafts),
  estimatedBytes: row.estimated_bytes === null ? null : Number(row.estimated_bytes),
  archiveBytes: row.archive_bytes === null ? null : Number(row.archive_bytes),
  plannedMediaFiles: Number(row.planned_media_files),
  exportedMediaFiles: Number(row.exported_media_files),
  missingMediaFiles: Number(row.missing_media_files),
  createdAt: iso(row.created_at) ?? '',
  startedAt: iso(row.started_at),
  completedAt: iso(row.completed_at),
  expiresAt: iso(row.expires_at) ?? '',
  downloadedAt: iso(row.downloaded_at),
  downloadUrl: row.requested_by_user_id === currentUserId && row.status === 'queued' && Number(row.expires_at) > now
    ? `/api/backup/jobs/${encodeURIComponent(row.id)}/download`
    : null,
})

const expireStaleJobs = async (env: Env, relationshipId: string, now: number): Promise<void> => {
  await env.DB.prepare(`
    UPDATE backup_jobs
    SET status = 'expired', completed_at = ?, error_code = 'DOWNLOAD_WINDOW_EXPIRED'
    WHERE relationship_id = ? AND status IN ('queued', 'preparing') AND expires_at <= ?
  `).bind(now, relationshipId, now).run()
}

export const getBackupEstimate = async (
  env: Env,
  relationshipId: string,
  requesterUserId: string,
  includeMyDrafts: boolean,
): Promise<BackupEstimate> => {
  const includeDraftFlag = includeMyDrafts ? 1 : 0
  const [memoryMedia, letterMedia, memories, openedLetters] = await env.DB.batch<{ total: number; bytes: number }>([
    env.DB.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(mm.size_bytes), 0) AS bytes FROM memory_media mm JOIN memories m ON m.id = mm.memory_id WHERE m.relationship_id = ?`).bind(relationshipId),
    env.DB.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(fm.size_bytes), 0) AS bytes FROM future_letter_media fm JOIN future_letters fl ON fl.id = fm.future_letter_id AND fl.relationship_id = fm.relationship_id WHERE fm.relationship_id = ? AND (fl.status = 'opened' OR (fl.status = 'draft' AND fl.created_by_user_id = ? AND ? = 1))`).bind(relationshipId, requesterUserId, includeDraftFlag),
    env.DB.prepare(`SELECT COUNT(*) AS total, 0 AS bytes FROM memories WHERE relationship_id = ?`).bind(relationshipId),
    env.DB.prepare(`SELECT COUNT(*) AS total, 0 AS bytes FROM future_letters WHERE relationship_id = ? AND status = 'opened'`).bind(relationshipId),
  ])
  const first = (result: D1Result<{ total: number; bytes: number }> | undefined) => result?.results[0] ?? { total: 0, bytes: 0 }
  const memory = first(memoryMedia)
  const letters = first(letterMedia)
  return {
    estimatedBytes: Number(memory.bytes) + Number(letters.bytes),
    mediaFiles: Number(memory.total) + Number(letters.total),
    memories: Number(first(memories).total),
    openedLetters: Number(first(openedLetters).total),
    estimateAvailable: true,
    recentAuthenticationValid: false,
  }
}

export const createBackupJob = async (input: {
  env: Env
  relationshipId: string
  requesterUserId: string
  type: BackupType
  includeMyDrafts: boolean
  estimate: BackupEstimate
}): Promise<{ job: BackupJobPublic; reused: boolean }> => {
  const now = Date.now()
  await expireStaleJobs(input.env, input.relationshipId, now)
  if (input.type === 'full') {
    const active = await input.env.DB.prepare(`${JOB_SELECT} WHERE j.relationship_id = ? AND j.backup_type = 'full' AND j.status IN ('queued', 'preparing') ORDER BY j.created_at DESC LIMIT 1`)
      .bind(input.relationshipId).first<BackupJobRow>()
    if (active) return { job: jobResponse(active, input.requesterUserId, now), reused: true }
  }

  const recentRequests = await input.env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM backup_jobs
    WHERE requested_by_user_id = ? AND created_at > ?
  `).bind(input.requesterUserId, now - 5 * 60 * 1000).first<{ total: number }>()
  if (Number(recentRequests?.total ?? 0) >= 10) {
    throw new ApiError(429, 'BACKUP_RATE_LIMITED', 'Too many backup requests. Please wait a few minutes and try again.')
  }

  const id = crypto.randomUUID()
  const expiresAt = now + BACKUP_DOWNLOAD_WINDOW_MS
  await input.env.DB.prepare(`
    INSERT INTO backup_jobs (
      id, relationship_id, requested_by_user_id, backup_type, status, format_version,
      include_requester_drafts, estimated_bytes, planned_media_files, exported_media_files,
      missing_media_files, archive_bytes, error_code, snapshot_started_at, created_at,
      started_at, completed_at, expires_at, downloaded_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, 0, 0, NULL, NULL, NULL, ?, NULL, NULL, ?, NULL)
  `).bind(
    id, input.relationshipId, input.requesterUserId, input.type, BACKUP_FORMAT_VERSION,
    input.includeMyDrafts ? 1 : 0, input.type === 'full' ? input.estimate.estimatedBytes : 0,
    input.type === 'full' ? input.estimate.mediaFiles : 0, now, expiresAt,
  ).run()
  const row = await getBackupJob(input.env, input.relationshipId, id)
  return { job: jobResponse(row, input.requesterUserId, now), reused: false }
}

export const getBackupJob = async (env: Env, relationshipId: string, jobId: string): Promise<BackupJobRow> => {
  const row = await env.DB.prepare(`${JOB_SELECT} WHERE j.id = ? AND j.relationship_id = ? LIMIT 1`)
    .bind(jobId, relationshipId).first<BackupJobRow>()
  if (!row) throw new ApiError(404, 'BACKUP_NOT_FOUND', 'That backup request was not found.')
  return row
}

export const listBackupJobs = async (env: Env, relationshipId: string): Promise<BackupJobRow[]> => {
  await expireStaleJobs(env, relationshipId, Date.now())
  const result = await env.DB.prepare(`${JOB_SELECT} WHERE j.relationship_id = ? ORDER BY j.created_at DESC LIMIT 20`)
    .bind(relationshipId).all<BackupJobRow>()
  return result.results
}

export const beginBackupDownload = async (env: Env, row: BackupJobRow, now: number): Promise<void> => {
  if (row.status !== 'queued' || Number(row.expires_at) <= now) {
    if (Number(row.expires_at) <= now && row.status === 'queued') {
      await env.DB.prepare(`UPDATE backup_jobs SET status = 'expired', completed_at = ?, error_code = 'DOWNLOAD_WINDOW_EXPIRED' WHERE id = ? AND status = 'queued'`)
        .bind(now, row.id).run()
    }
    throw new ApiError(410, 'BACKUP_EXPIRED', 'This download request has expired. Create a new backup.')
  }
  const activeUntil = now + 6 * 60 * 60 * 1000
  const result = await env.DB.prepare(`
    UPDATE backup_jobs SET status = 'preparing', snapshot_started_at = ?, started_at = ?, downloaded_at = ?, expires_at = ?
    WHERE id = ? AND status = 'queued' AND expires_at > ?
  `).bind(now, now, now, activeUntil, row.id, now).run()
  if (Number(result.meta.changes ?? 0) !== 1) throw new ApiError(409, 'BACKUP_ALREADY_STARTED', 'This direct download has already started.')
}

export const completeBackupJob = async (input: {
  env: Env
  jobId: string
  archiveBytes: number
  exportedMediaFiles: number
  missingMediaFiles: number
}): Promise<void> => {
  const now = Date.now()
  await input.env.DB.prepare(`
    UPDATE backup_jobs SET status = 'succeeded', archive_bytes = ?, exported_media_files = ?,
      missing_media_files = ?, completed_at = ?, error_code = NULL
    WHERE id = ? AND status = 'preparing'
  `).bind(input.archiveBytes, input.exportedMediaFiles, input.missingMediaFiles, now, input.jobId).run()
}

export const failBackupJob = async (env: Env, jobId: string, errorCode: string): Promise<void> => {
  await env.DB.prepare(`
    UPDATE backup_jobs SET status = 'failed', completed_at = ?, error_code = ?
    WHERE id = ? AND status IN ('queued', 'preparing')
  `).bind(Date.now(), errorCode.slice(0, 80), jobId).run()
}

export type { BackupJobRow }
