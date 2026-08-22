export interface ApiFailure {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface ApiSuccess<T> {
  success: true
  data: T
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiSuccess = <T>(data: T, init: ResponseInit = {}): Response =>
  Response.json({ success: true, data } satisfies ApiSuccess<T>, init)

export const apiFailure = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response => Response.json(
  {
    success: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
  } satisfies ApiFailure,
  { status },
)

export const readJson = async (request: Request, maxBytes = 32_768): Promise<unknown> => {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim()
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'This endpoint requires application/json.')
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.')
  }

  try {
    return await request.json()
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.')
  }
}

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
].join('; ')

export const applySecurityHeaders = (response: Response, request: Request, env: Env): Response => {
  const secured = new Response(response.body, response)
  secured.headers.set('Content-Security-Policy', csp)
  secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  secured.headers.set('X-Content-Type-Options', 'nosniff')
  secured.headers.set('X-Frame-Options', 'DENY')
  secured.headers.set('Cross-Origin-Opener-Policy', 'same-origin')

  const origin = request.headers.get('origin')
  if (origin && origin === env.ALLOWED_ORIGIN) {
    secured.headers.set('Access-Control-Allow-Origin', origin)
    secured.headers.set('Access-Control-Allow-Credentials', 'true')
    secured.headers.append('Vary', 'Origin')
  }

  return secured
}

export const handleOptions = (request: Request, env: Env): Response => {
  const origin = request.headers.get('origin')
  if (!origin || origin !== env.ALLOWED_ORIGIN) {
    return apiFailure(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.')
  }

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key, X-File-Name, X-Media-Alt',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Max-Age': '3600',
      Vary: 'Origin',
    },
  })
}

export const assertMutationOrigin = (request: Request, env: Env): void => {
  const origin = request.headers.get('origin')
  if (!origin || origin !== env.ALLOWED_ORIGIN) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'This request did not come from the trusted site.')
  }

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    throw new ApiError(403, 'CROSS_SITE_REQUEST', 'Cross-site mutations are not allowed.')
  }

  if (env.APP_ENV === 'production') {
    const host = request.headers.get('host')
    const allowedHost = new URL(env.ALLOWED_ORIGIN).host
    if (host !== allowedHost) {
      throw new ApiError(403, 'HOST_NOT_ALLOWED', 'This host is not allowed.')
    }
  }
}
