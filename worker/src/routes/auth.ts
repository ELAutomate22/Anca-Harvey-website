import { createSession, clearSessionCookie, deleteSession, requireSession } from '../auth/session'
import { hashText } from '../lib/crypto'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { verifyPassword } from '../lib/password'
import { asRecord, requiredString } from '../lib/validation'

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_LOCK_MS = 15 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 5

interface LoginUserRow {
  id: string
  password_hash: string
}

interface LoginAttemptRow {
  attempts: number
  window_started_at: number
  locked_until: number
}

interface ProfileRow {
  id: string
  email: string
  display_name: string
}

const normalizeEmail = (value: unknown): string => {
  const email = requiredString(value, 'email', 3, 254).toLocaleLowerCase('en-US')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid email address.')
  }
  return email
}

const loginKey = async (request: Request, email: string): Promise<string> => {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local'
  return hashText(`login:${ip}:${email}`)
}

const assertNotRateLimited = async (env: Env, keyHash: string, now: number): Promise<void> => {
  const row = await env.DB.prepare(
    'SELECT attempts, window_started_at, locked_until FROM login_attempts WHERE key_hash = ?',
  ).bind(keyHash).first<LoginAttemptRow>()

  if (row && Number(row.locked_until) > now) {
    throw new ApiError(429, 'LOGIN_RATE_LIMITED', 'Too many sign-in attempts. Please wait and try again.')
  }
}

const recordFailedLogin = async (env: Env, keyHash: string, now: number): Promise<void> => {
  const row = await env.DB.prepare(
    'SELECT attempts, window_started_at, locked_until FROM login_attempts WHERE key_hash = ?',
  ).bind(keyHash).first<LoginAttemptRow>()

  const withinWindow = row && now - Number(row.window_started_at) < LOGIN_WINDOW_MS
  const attempts = withinWindow ? Number(row.attempts) + 1 : 1
  const windowStartedAt = withinWindow ? Number(row.window_started_at) : now
  const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? now + LOGIN_LOCK_MS : 0

  await env.DB.prepare(`
    INSERT INTO login_attempts (key_hash, attempts, window_started_at, locked_until, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
      attempts = excluded.attempts,
      window_started_at = excluded.window_started_at,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  `).bind(keyHash, attempts, windowStartedAt, lockedUntil, now).run()
}

const listProfiles = async (env: Env, relationshipId: string): Promise<Array<{ id: string; email: string; displayName: string }>> => {
  const result = await env.DB.prepare(`
    SELECT u.id, u.email, u.display_name
    FROM relationships r
    JOIN users u ON u.id IN (r.partner_1_user_id, r.partner_2_user_id)
    WHERE r.id = ? AND u.active = 1
    ORDER BY CASE WHEN u.id = r.partner_1_user_id THEN 0 ELSE 1 END
  `).bind(relationshipId).all<ProfileRow>()
  return result.results.map((profile) => ({
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
  }))
}

export const login = async (request: Request, env: Env): Promise<Response> => {
  const body = asRecord(await readJson(request, 4_096))
  const email = normalizeEmail(body.email)
  const password = requiredString(body.password, 'password', 1, 256)
  const keyHash = await loginKey(request, email)
  const now = Date.now()

  await assertNotRateLimited(env, keyHash, now)
  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE email = ? COLLATE NOCASE AND active = 1 LIMIT 1',
  ).bind(email).first<LoginUserRow>()
  const valid = await verifyPassword(password, user?.password_hash)

  if (!user || !valid) {
    await recordFailedLogin(env, keyHash, now)
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.')
  }

  const relationship = await env.DB.prepare(
    'SELECT id FROM relationships WHERE ? IN (partner_1_user_id, partner_2_user_id) LIMIT 1',
  ).bind(user.id).first<{ id: string }>()
  if (!relationship) {
    await recordFailedLogin(env, keyHash, now)
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.')
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_attempts WHERE key_hash = ?').bind(keyHash),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
  ])

  const cookie = await createSession(request, env, user.id)
  const response = apiSuccess({ authenticated: true }, { status: 200 })
  response.headers.set('Set-Cookie', cookie)
  return response
}

export const logout = async (request: Request, env: Env): Promise<Response> => {
  await deleteSession(request, env)
  const response = apiSuccess({ authenticated: false })
  response.headers.set('Set-Cookie', clearSessionCookie())
  return response
}

export const me = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const profiles = await listProfiles(env, session.relationship.id)
  return apiSuccess({ user: session.user, relationship: session.relationship, profiles })
}

export const profiles = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  return apiSuccess(await listProfiles(env, session.relationship.id))
}

export const updateMyProfile = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const displayName = requiredString(body.displayName, 'displayName', 1, 80)
  const now = Date.now()
  await env.DB.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?')
    .bind(displayName, now, session.user.id).run()
  return apiSuccess({ ...session.user, displayName })
}
