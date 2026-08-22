import { ApiError } from '../lib/http'
import { hashText, randomToken } from '../lib/crypto'

export const SESSION_COOKIE = '__Host-our-corner-session'
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

interface SessionRow {
  user_id: string
  email: string
  display_name: string
  relationship_id: string
  relationship_title: string
  relationship_start_date: string
  relationship_timezone: string
  partner_1_user_id: string
  partner_2_user_id: string
  expires_at: number
}

export interface AuthSession {
  user: {
    id: string
    email: string
    displayName: string
  }
  relationship: {
    id: string
    title: string
    startDate: string
    timezone: string
    partner1UserId: string
    partner2UserId: string
  }
  tokenHash: string
}

const parseCookies = (request: Request): Map<string, string> => {
  const cookies = new Map<string, string>()
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 1) continue
    const key = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (key) cookies.set(key, value)
  }
  return cookies
}

export const sessionCookie = (token: string, maxAge = SESSION_MAX_AGE_SECONDS): string =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`

export const clearSessionCookie = (): string => sessionCookie('', 0)

export const createSession = async (request: Request, env: Env, userId: string): Promise<string> => {
  const token = randomToken()
  const tokenHash = await hashText(token)
  const now = Date.now()
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000
  const ip = request.headers.get('cf-connecting-ip') ?? 'local'
  const userAgent = request.headers.get('user-agent') ?? 'unknown'
  const [ipHash, userAgentHash] = await Promise.all([hashText(ip), hashText(userAgent)])

  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at, ip_hash, user_agent_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(tokenHash, userId, expiresAt, now, now, ipHash, userAgentHash).run()

  return sessionCookie(token)
}

export const getSession = async (request: Request, env: Env): Promise<AuthSession | null> => {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token || token.length < 40 || token.length > 100) return null

  const tokenHash = await hashText(token)
  const now = Date.now()
  const row = await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.email,
      u.display_name,
      r.id AS relationship_id,
      r.title AS relationship_title,
      r.start_date AS relationship_start_date,
      r.timezone AS relationship_timezone,
      r.partner_1_user_id,
      r.partner_2_user_id,
      s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id AND u.active = 1
    JOIN relationships r ON u.id IN (r.partner_1_user_id, r.partner_2_user_id)
    WHERE s.token_hash = ? AND s.expires_at > ?
    LIMIT 1
  `).bind(tokenHash, now).first<SessionRow>()

  if (!row) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ? OR expires_at <= ?').bind(tokenHash, now).run()
    return null
  }

  if (now - Number(row.expires_at) > SESSION_MAX_AGE_SECONDS * 1000) return null

  return {
    user: { id: row.user_id, email: row.email, displayName: row.display_name },
    relationship: {
      id: row.relationship_id,
      title: row.relationship_title,
      startDate: row.relationship_start_date,
      timezone: row.relationship_timezone,
      partner1UserId: row.partner_1_user_id,
      partner2UserId: row.partner_2_user_id,
    },
    tokenHash,
  }
}

export const requireSession = async (request: Request, env: Env): Promise<AuthSession> => {
  const session = await getSession(request, env)
  if (!session) throw new ApiError(401, 'AUTH_REQUIRED', 'Please sign in to continue.')
  return session
}

export const deleteSession = async (request: Request, env: Env): Promise<void> => {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token) return
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashText(token)).run()
}
