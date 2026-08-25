import {
  getRecentAuthenticationAt,
  markSessionRecentlyAuthenticated,
  requireSession,
  type AuthSession,
} from '../auth/session'
import { createBackupArchive, type ArchiveProgress } from '../backup/archive'
import {
  beginBackupDownload,
  completeBackupJob,
  createBackupJob,
  failBackupJob,
  getBackupEstimate,
  getBackupJob,
  jobResponse,
  listBackupJobs,
  type BackupJobRow,
} from '../backup/jobs'
import { createBackupSnapshot } from '../backup/snapshot'
import {
  BACKUP_FORMAT_VERSION,
  FULL_BACKUP_RECENT_AUTH_MS,
  type BackupType,
} from '../backup/types'
import { backupDownloadFilename } from '../backup/filenames'
import { hashText } from '../lib/crypto'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { verifyPassword } from '../lib/password'
import { asRecord, optionalBoolean, requiredString } from '../lib/validation'

const REAUTH_WINDOW_MS = 15 * 60 * 1000
const REAUTH_LOCK_MS = 15 * 60 * 1000
const MAX_REAUTH_ATTEMPTS = 5

interface ReauthAttemptRow {
  attempts: number
  window_started_at: number
  locked_until: number
}

const assertOnlyFields = (body: Record<string, unknown>, allowed: Set<string>): void => {
  const unexpected = Object.keys(body).filter((key) => !allowed.has(key))
  if (unexpected.length > 0) throw new ApiError(400, 'VALIDATION_ERROR', `Unexpected field: ${unexpected[0]}.`)
}

const assertJobId = (value: string): void => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new ApiError(400, 'INVALID_BACKUP_ID', 'The backup request ID is invalid.')
  }
}

const isRecentlyAuthenticated = async (env: Env, session: AuthSession, now = Date.now()): Promise<boolean> =>
  now - await getRecentAuthenticationAt(env, session) <= FULL_BACKUP_RECENT_AUTH_MS

const requireRecentAuthentication = async (env: Env, session: AuthSession): Promise<void> => {
  if (!await isRecentlyAuthenticated(env, session)) {
    throw new ApiError(428, 'RECENT_AUTH_REQUIRED', 'Confirm your password before creating a Full Backup.')
  }
}

const readBackupOptions = async (request: Request): Promise<{ includeMyDrafts: boolean }> => {
  const body = asRecord(await readJson(request, 2_048))
  assertOnlyFields(body, new Set(['includeMyDrafts']))
  return { includeMyDrafts: optionalBoolean(body.includeMyDrafts, 'includeMyDrafts') ?? false }
}

const reauthKey = async (session: AuthSession): Promise<string> => hashText(`backup-reauth:${session.tokenHash}`)

const recordFailedReauth = async (env: Env, keyHash: string, now: number): Promise<void> => {
  const row = await env.DB.prepare('SELECT attempts, window_started_at, locked_until FROM login_attempts WHERE key_hash = ?')
    .bind(keyHash).first<ReauthAttemptRow>()
  const withinWindow = row && now - Number(row.window_started_at) < REAUTH_WINDOW_MS
  const attempts = withinWindow ? Number(row.attempts) + 1 : 1
  const startedAt = withinWindow ? Number(row.window_started_at) : now
  const lockedUntil = attempts >= MAX_REAUTH_ATTEMPTS ? now + REAUTH_LOCK_MS : 0
  await env.DB.prepare(`
    INSERT INTO login_attempts (key_hash, attempts, window_started_at, locked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key_hash) DO UPDATE SET attempts = excluded.attempts,
      window_started_at = excluded.window_started_at, locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  `).bind(keyHash, attempts, startedAt, lockedUntil, now).run()
}

export const reauthenticateForBackup = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request, 4_096))
  assertOnlyFields(body, new Set(['password']))
  const password = requiredString(body.password, 'password', 1, 256)
  const keyHash = await reauthKey(session)
  const now = Date.now()
  const attempts = await env.DB.prepare('SELECT attempts, window_started_at, locked_until FROM login_attempts WHERE key_hash = ?')
    .bind(keyHash).first<ReauthAttemptRow>()
  if (Number(attempts?.locked_until ?? 0) > now) {
    throw new ApiError(429, 'REAUTH_RATE_LIMITED', 'Too many confirmation attempts. Please wait and try again.')
  }
  const user = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ? AND active = 1 LIMIT 1')
    .bind(session.user.id).first<{ password_hash: string }>()
  if (!await verifyPassword(password, user?.password_hash)) {
    await recordFailedReauth(env, keyHash, now)
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'The password is incorrect.')
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(keyHash).run()
  await markSessionRecentlyAuthenticated(env, session, now)
  return apiSuccess({ recentAuthenticationValid: true, validUntil: new Date(now + FULL_BACKUP_RECENT_AUTH_MS).toISOString() })
}

export const backupEstimate = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const includeMyDrafts = new URL(request.url).searchParams.get('includeMyDrafts') === 'true'
  const estimate = await getBackupEstimate(env, session.relationship.id, session.user.id, includeMyDrafts)
  return apiSuccess({ ...estimate, recentAuthenticationValid: await isRecentlyAuthenticated(env, session) })
}

export const createBackup = async (request: Request, env: Env, type: BackupType): Promise<Response> => {
  const session = await requireSession(request, env)
  const options = await readBackupOptions(request)
  if (type === 'full') await requireRecentAuthentication(env, session)
  const estimate = await getBackupEstimate(env, session.relationship.id, session.user.id, options.includeMyDrafts)
  const result = await createBackupJob({
    env,
    relationshipId: session.relationship.id,
    requesterUserId: session.user.id,
    type,
    includeMyDrafts: options.includeMyDrafts,
    estimate,
  })
  return apiSuccess(result, { status: result.reused ? 200 : 201 })
}

export const backupHistory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const jobs = await listBackupJobs(env, session.relationship.id)
  const items = jobs.map((job) => jobResponse(job, session.user.id))
  return apiSuccess({
    items,
    lastSuccessful: items.find((job) => job.status === 'succeeded') ?? null,
  })
}

export const backupJob = async (request: Request, env: Env, jobId: string): Promise<Response> => {
  assertJobId(jobId)
  const session = await requireSession(request, env)
  const job = await getBackupJob(env, session.relationship.id, jobId)
  return apiSuccess(jobResponse(job, session.user.id))
}

const assertDownloadRequest = (request: Request, session: AuthSession, job: BackupJobRow): void => {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'CROSS_SITE_REQUEST', 'Cross-site backup downloads are not allowed.')
  }
  if (job.requested_by_user_id !== session.user.id) {
    throw new ApiError(403, 'BACKUP_DOWNLOAD_FORBIDDEN', 'Only the person who requested this direct download can start it.')
  }
}

const monitoredArchiveStream = (input: {
  source: ReadableStream<Uint8Array>
  env: Env
  jobId: string
  progress: ArchiveProgress
}): ReadableStream<Uint8Array> => {
  const reader = input.source.getReader()
  let archiveBytes = 0
  let settled = false
  const fail = async (code: string): Promise<void> => {
    if (settled) return
    settled = true
    await failBackupJob(input.env, input.jobId, code)
  }
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read()
        if (next.done) {
          settled = true
          await completeBackupJob({
            env: input.env,
            jobId: input.jobId,
            archiveBytes,
            exportedMediaFiles: input.progress.exportedMediaFiles,
            missingMediaFiles: input.progress.missingMediaFiles,
          })
          controller.close()
          return
        }
        archiveBytes += next.value.byteLength
        controller.enqueue(next.value)
      } catch (error) {
        await fail('ARCHIVE_STREAM_FAILED')
        controller.error(error)
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason)
      } finally {
        await fail('DOWNLOAD_INTERRUPTED')
      }
    },
  })
}

export const downloadBackup = async (request: Request, env: Env, jobId: string): Promise<Response> => {
  assertJobId(jobId)
  const session = await requireSession(request, env)
  const job = await getBackupJob(env, session.relationship.id, jobId)
  assertDownloadRequest(request, session, job)
  if (job.backup_type === 'full') await requireRecentAuthentication(env, session)
  const snapshotAt = Date.now()
  await beginBackupDownload(env, job, snapshotAt)
  try {
    const snapshot = await createBackupSnapshot({
      env,
      relationshipId: session.relationship.id,
      requesterUserId: session.user.id,
      backupType: job.backup_type,
      includeMyDrafts: Boolean(job.include_requester_drafts),
      snapshotAt,
    })
    const archive = createBackupArchive({
      env,
      snapshot,
      type: job.backup_type,
      requester: { id: session.user.id, displayName: session.user.displayName },
      includeMyDrafts: Boolean(job.include_requester_drafts),
    })
    const stream = monitoredArchiveStream({ source: archive.stream, env, jobId, progress: archive.progress })
    return new Response(stream, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${backupDownloadFilename(job.backup_type, snapshotAt)}"`,
        'Content-Type': 'application/zip',
        'X-Content-Type-Options': 'nosniff',
        'X-Backup-Format-Version': BACKUP_FORMAT_VERSION,
        Pragma: 'no-cache',
        Vary: 'Cookie',
      },
    })
  } catch (error) {
    await failBackupJob(env, jobId, 'SNAPSHOT_FAILED')
    throw error
  }
}
