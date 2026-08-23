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
  addWatchlistMovie,
  createMovieHistory,
  deleteMovieHistory,
  discoverMovies,
  listMovieHistory,
  listWatchlist,
  movieDetails,
  movieGenres,
  movieStats,
  movieVideos,
  popularMovies,
  removeWatchlistMovie,
  searchMovies,
  topRatedMovies,
  updateMovieHistory,
} from './routes/movies'
import {
  createGame,
  createGameHistory,
  deleteGame,
  deleteGameHistory,
  gameStats,
  listGameHistory,
  listGames,
  updateGame,
  updateGameHistory,
} from './routes/games'
import { createSong, deleteSong, listSongs, updateSong } from './routes/songs'
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

  if (pathname === '/api/movies/genres') {
    return request.method === 'GET' ? movieGenres(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/movies/popular') {
    return request.method === 'GET' ? popularMovies(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/movies/top-rated') {
    return request.method === 'GET' ? topRatedMovies(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/movies/search') {
    return request.method === 'GET' ? searchMovies(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/movies/discover') {
    return request.method === 'GET' ? discoverMovies(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/movies/watchlist') {
    if (request.method === 'GET') return listWatchlist(request, env)
    if (request.method === 'POST') return addWatchlistMovie(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/movies/history') {
    if (request.method === 'GET') return listMovieHistory(request, env)
    if (request.method === 'POST') return createMovieHistory(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/movies/stats') {
    return request.method === 'GET' ? movieStats(request, env) : methodNotAllowed()
  }
  const movieVideoMatch = pathname.match(/^\/api\/movies\/(\d+)\/videos$/u)
  if (movieVideoMatch?.[1]) {
    return request.method === 'GET' ? movieVideos(request, env, movieVideoMatch[1]) : methodNotAllowed()
  }
  const watchlistMovieMatch = pathname.match(/^\/api\/movies\/watchlist\/(\d+)$/u)
  if (watchlistMovieMatch?.[1]) {
    return request.method === 'DELETE'
      ? removeWatchlistMovie(request, env, watchlistMovieMatch[1])
      : methodNotAllowed()
  }
  const movieHistoryMatch = pathname.match(/^\/api\/movies\/history\/([^/]+)$/u)
  if (movieHistoryMatch?.[1]) {
    if (request.method === 'PATCH') return updateMovieHistory(request, env, movieHistoryMatch[1])
    if (request.method === 'DELETE') return deleteMovieHistory(request, env, movieHistoryMatch[1])
    return methodNotAllowed()
  }
  const movieMatch = pathname.match(/^\/api\/movies\/(\d+)$/u)
  if (movieMatch?.[1]) {
    return request.method === 'GET' ? movieDetails(request, env, movieMatch[1]) : methodNotAllowed()
  }

  if (pathname === '/api/games') {
    if (request.method === 'GET') return listGames(request, env)
    if (request.method === 'POST') return createGame(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/games/history') {
    if (request.method === 'GET') return listGameHistory(request, env)
    if (request.method === 'POST') return createGameHistory(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/games/stats') {
    return request.method === 'GET' ? gameStats(request, env) : methodNotAllowed()
  }
  const gameHistoryMatch = pathname.match(/^\/api\/games\/history\/([^/]+)$/u)
  if (gameHistoryMatch?.[1]) {
    if (request.method === 'PATCH') return updateGameHistory(request, env, gameHistoryMatch[1])
    if (request.method === 'DELETE') return deleteGameHistory(request, env, gameHistoryMatch[1])
    return methodNotAllowed()
  }
  const gameMatch = pathname.match(/^\/api\/games\/([^/]+)$/u)
  if (gameMatch?.[1]) {
    if (request.method === 'PATCH') return updateGame(request, env, gameMatch[1])
    if (request.method === 'DELETE') return deleteGame(request, env, gameMatch[1])
    return methodNotAllowed()
  }

  if (pathname === '/api/songs') {
    if (request.method === 'GET') return listSongs(request, env)
    if (request.method === 'POST') return createSong(request, env)
    return methodNotAllowed()
  }
  const songMatch = pathname.match(/^\/api\/songs\/([^/]+)$/u)
  if (songMatch?.[1]) {
    if (request.method === 'PATCH') return updateSong(request, env, songMatch[1])
    if (request.method === 'DELETE') return deleteSong(request, env, songMatch[1])
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
