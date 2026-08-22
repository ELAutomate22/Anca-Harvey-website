import { me, login, logout, profiles, updateMyProfile } from './routes/auth'
import {
  createMemory,
  deleteMemory,
  deleteMemoryMedia,
  getMemory,
  listMemories,
  servePrivateMedia,
  updateMemory,
  uploadMemoryMedia,
} from './routes/memories'
import { getRelationship, updateRelationship } from './routes/relationship'
import {
  createTimelineEntry,
  deleteTimelineEntry,
  listTimeline,
  updateTimelineEntry,
} from './routes/timeline'
import {
  ApiError,
  apiFailure,
  apiSuccess,
  applySecurityHeaders,
  assertMutationOrigin,
  handleOptions,
} from './lib/http'

const methodNotAllowed = (): Response =>
  apiFailure(405, 'METHOD_NOT_ALLOWED', 'That method is not allowed for this endpoint.')

const handleApi = async (request: Request, env: Env): Promise<Response> => {
  const url = new URL(request.url)
  const { pathname } = url

  if (request.method === 'OPTIONS') return handleOptions(request, env)
  if (!['GET', 'HEAD'].includes(request.method)) assertMutationOrigin(request, env)

  if (pathname === '/api/health') {
    if (request.method !== 'GET') return methodNotAllowed()
    return apiSuccess({ status: 'ok', environment: env.APP_ENV })
  }

  if (pathname === '/api/auth/login') {
    return request.method === 'POST' ? login(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/auth/logout') {
    return request.method === 'POST' ? logout(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/auth/me' || pathname === '/api/me') {
    return request.method === 'GET' ? me(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/profiles') {
    return request.method === 'GET' ? profiles(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/profiles/me') {
    return request.method === 'PATCH' ? updateMyProfile(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/relationship') {
    if (request.method === 'GET') return getRelationship(request, env)
    if (request.method === 'PATCH') return updateRelationship(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/memories') {
    if (request.method === 'GET') return listMemories(request, env)
    if (request.method === 'POST') return createMemory(request, env)
    return methodNotAllowed()
  }

  const mediaUploadMatch = pathname.match(/^\/api\/memories\/([^/]+)\/media$/u)
  if (mediaUploadMatch?.[1]) {
    return request.method === 'POST'
      ? uploadMemoryMedia(request, env, mediaUploadMatch[1])
      : methodNotAllowed()
  }

  const memoryMediaMatch = pathname.match(/^\/api\/memories\/([^/]+)\/media\/([^/]+)$/u)
  if (memoryMediaMatch?.[1] && memoryMediaMatch[2]) {
    return request.method === 'DELETE'
      ? deleteMemoryMedia(request, env, memoryMediaMatch[1], memoryMediaMatch[2])
      : methodNotAllowed()
  }

  const memoryMatch = pathname.match(/^\/api\/memories\/([^/]+)$/u)
  if (memoryMatch?.[1]) {
    if (request.method === 'GET') return getMemory(request, env, memoryMatch[1])
    if (request.method === 'PATCH') return updateMemory(request, env, memoryMatch[1])
    if (request.method === 'DELETE') return deleteMemory(request, env, memoryMatch[1])
    return methodNotAllowed()
  }

  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)$/u)
  if (mediaMatch?.[1]) {
    return request.method === 'GET' || request.method === 'HEAD'
      ? servePrivateMedia(request, env, mediaMatch[1])
      : methodNotAllowed()
  }

  if (pathname === '/api/timeline') {
    if (request.method === 'GET') return listTimeline(request, env)
    if (request.method === 'POST') return createTimelineEntry(request, env)
    return methodNotAllowed()
  }

  const timelineMatch = pathname.match(/^\/api\/timeline\/([^/]+)$/u)
  if (timelineMatch?.[1]) {
    if (request.method === 'PATCH') return updateTimelineEntry(request, env, timelineMatch[1])
    if (request.method === 'DELETE') return deleteTimelineEntry(request, env, timelineMatch[1])
    return methodNotAllowed()
  }

  return apiFailure(404, 'API_ROUTE_NOT_FOUND', 'That API route does not exist.')
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID()
    const url = new URL(request.url)

    try {
      const response = url.pathname.startsWith('/api/')
        ? await handleApi(request, env)
        : await env.ASSETS.fetch(request)
      const secured = applySecurityHeaders(response, request, env)
      secured.headers.set('X-Request-Id', requestId)
      if (url.pathname.startsWith('/api/') && !secured.headers.has('Cache-Control')) {
        secured.headers.set('Cache-Control', 'no-store')
      }
      return secured
    } catch (error) {
      const response = error instanceof ApiError
        ? apiFailure(error.status, error.code, error.message, error.details)
        : apiFailure(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')

      if (!(error instanceof ApiError) || error.status >= 500) {
        console.error(JSON.stringify({
          message: 'Unhandled request error',
          requestId,
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        }))
      }

      const secured = applySecurityHeaders(response, request, env)
      secured.headers.set('Cache-Control', 'no-store')
      secured.headers.set('X-Request-Id', requestId)
      if (error instanceof ApiError && error.status === 429) secured.headers.set('Retry-After', '900')
      return secured
    }
  },
} satisfies ExportedHandler<Env>

export default worker
