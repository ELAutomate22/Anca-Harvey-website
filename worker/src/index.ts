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
  activityStats,
  cancelPlannedActivity,
  completePlannedActivity,
  createActivity,
  createPlannedActivity,
  deleteActivity,
  deleteActivityHistory,
  hideActivity,
  listActivities,
  listActivityHistory,
  listPlannedActivities,
  randomActivity,
  restoreActivity,
  saveActivity,
  unsaveActivity,
  updateActivity,
  updateActivityHistory,
  updatePlannedActivity,
} from './routes/activities'
import {
  bucketStats,
  completeBucketItem,
  createBucketItem,
  deleteBucketItem,
  listBucketItems,
  randomBucketItem,
  updateBucketItem,
} from './routes/bucket-list'
import {
  createLetter,
  deleteLetter,
  deleteLetterMedia,
  getLetter,
  letterQuickDates,
  letterSummary,
  listLetters,
  openLetter,
  reorderLetterPages,
  sealLetter,
  serveLetterMedia,
  updateLetter,
  uploadLetterMedia,
} from './routes/letters'
import {
  backupEstimate,
  backupHistory,
  backupJob,
  createBackup,
  downloadBackup,
  reauthenticateForBackup,
} from './routes/backup'
import {
  recapCurrentYear,
  recapIndex,
  recapYear,
  thisDay,
} from './routes/recap'
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

  if (pathname === '/api/recap') {
    return request.method === 'GET' ? recapIndex(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/recap/current') {
    return request.method === 'GET' ? recapCurrentYear(request, env) : methodNotAllowed()
  }
  const recapYearMatch = pathname.match(/^\/api\/recap\/year\/(\d{1,3})$/u)
  if (recapYearMatch?.[1]) {
    return request.method === 'GET' ? recapYear(request, env, recapYearMatch[1]) : methodNotAllowed()
  }
  if (pathname === '/api/this-day') {
    return request.method === 'GET' ? thisDay(request, env) : methodNotAllowed()
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

  if (pathname === '/api/backup/estimate') {
    return request.method === 'GET' ? backupEstimate(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/backup/history') {
    return request.method === 'GET' ? backupHistory(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/backup/reauthenticate') {
    return request.method === 'POST' ? reauthenticateForBackup(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/backup/data') {
    return request.method === 'POST' ? createBackup(request, env, 'data') : methodNotAllowed()
  }
  if (pathname === '/api/backup/full') {
    return request.method === 'POST' ? createBackup(request, env, 'full') : methodNotAllowed()
  }
  const backupDownloadMatch = pathname.match(/^\/api\/backup\/jobs\/([^/]+)\/download$/u)
  if (backupDownloadMatch?.[1]) {
    return request.method === 'GET' ? downloadBackup(request, env, backupDownloadMatch[1]) : methodNotAllowed()
  }
  const backupJobMatch = pathname.match(/^\/api\/backup\/jobs\/([^/]+)$/u)
  if (backupJobMatch?.[1]) {
    return request.method === 'GET' ? backupJob(request, env, backupJobMatch[1]) : methodNotAllowed()
  }

  if (pathname === '/api/letters') {
    if (request.method === 'GET') return listLetters(request, env)
    if (request.method === 'POST') return createLetter(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/letters/summary') {
    return request.method === 'GET' ? letterSummary(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/letters/quick-dates') {
    return request.method === 'GET' ? letterQuickDates(request, env) : methodNotAllowed()
  }
  const letterSealMatch = pathname.match(/^\/api\/letters\/([^/]+)\/seal$/u)
  if (letterSealMatch?.[1]) {
    return request.method === 'POST' ? sealLetter(request, env, letterSealMatch[1]) : methodNotAllowed()
  }
  const letterOpenMatch = pathname.match(/^\/api\/letters\/([^/]+)\/open$/u)
  if (letterOpenMatch?.[1]) {
    return request.method === 'POST' ? openLetter(request, env, letterOpenMatch[1]) : methodNotAllowed()
  }
  const letterMediaOrderMatch = pathname.match(/^\/api\/letters\/([^/]+)\/media\/order$/u)
  if (letterMediaOrderMatch?.[1]) {
    return request.method === 'PATCH'
      ? reorderLetterPages(request, env, letterMediaOrderMatch[1])
      : methodNotAllowed()
  }
  const letterMediaMatch = pathname.match(/^\/api\/letters\/([^/]+)\/media\/([^/]+)$/u)
  if (letterMediaMatch?.[1] && letterMediaMatch[2]) {
    return request.method === 'DELETE'
      ? deleteLetterMedia(request, env, letterMediaMatch[1], letterMediaMatch[2])
      : methodNotAllowed()
  }
  const letterUploadMatch = pathname.match(/^\/api\/letters\/([^/]+)\/media$/u)
  if (letterUploadMatch?.[1]) {
    return request.method === 'POST'
      ? uploadLetterMedia(request, env, letterUploadMatch[1])
      : methodNotAllowed()
  }
  const letterPageMatch = pathname.match(/^\/api\/letters\/([^/]+)\/pages\/([^/]+)$/u)
  if (letterPageMatch?.[1] && letterPageMatch[2]) {
    return request.method === 'GET' || request.method === 'HEAD'
      ? serveLetterMedia(request, env, letterPageMatch[1], letterPageMatch[2])
      : methodNotAllowed()
  }
  const letterMatch = pathname.match(/^\/api\/letters\/([^/]+)$/u)
  if (letterMatch?.[1]) {
    if (request.method === 'GET') return getLetter(request, env, letterMatch[1])
    if (request.method === 'PATCH') return updateLetter(request, env, letterMatch[1])
    if (request.method === 'DELETE') return deleteLetter(request, env, letterMatch[1])
    return methodNotAllowed()
  }

  if (pathname === '/api/activities') {
    if (request.method === 'GET') return listActivities(request, env)
    if (request.method === 'POST') return createActivity(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/activities/random') {
    return request.method === 'POST' ? randomActivity(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/activities/stats') {
    return request.method === 'GET' ? activityStats(request, env) : methodNotAllowed()
  }
  const activityHideMatch = pathname.match(/^\/api\/activities\/([^/]+)\/hide$/u)
  if (activityHideMatch?.[1]) {
    if (request.method === 'POST') return hideActivity(request, env, activityHideMatch[1])
    if (request.method === 'DELETE') return restoreActivity(request, env, activityHideMatch[1])
    return methodNotAllowed()
  }
  const activitySaveMatch = pathname.match(/^\/api\/activities\/([^/]+)\/save$/u)
  if (activitySaveMatch?.[1]) {
    if (request.method === 'POST') return saveActivity(request, env, activitySaveMatch[1])
    if (request.method === 'DELETE') return unsaveActivity(request, env, activitySaveMatch[1])
    return methodNotAllowed()
  }
  const activityMatch = pathname.match(/^\/api\/activities\/([^/]+)$/u)
  if (activityMatch?.[1]) {
    if (request.method === 'PATCH') return updateActivity(request, env, activityMatch[1])
    if (request.method === 'DELETE') return deleteActivity(request, env, activityMatch[1])
    return methodNotAllowed()
  }

  if (pathname === '/api/planned-activities') {
    if (request.method === 'GET') return listPlannedActivities(request, env)
    if (request.method === 'POST') return createPlannedActivity(request, env)
    return methodNotAllowed()
  }
  const planCompleteMatch = pathname.match(/^\/api\/planned-activities\/([^/]+)\/complete$/u)
  if (planCompleteMatch?.[1]) {
    return request.method === 'POST' ? completePlannedActivity(request, env, planCompleteMatch[1]) : methodNotAllowed()
  }
  const planMatch = pathname.match(/^\/api\/planned-activities\/([^/]+)$/u)
  if (planMatch?.[1]) {
    if (request.method === 'PATCH') return updatePlannedActivity(request, env, planMatch[1])
    if (request.method === 'DELETE') return cancelPlannedActivity(request, env, planMatch[1])
    return methodNotAllowed()
  }
  if (pathname === '/api/activity-history') {
    return request.method === 'GET' ? listActivityHistory(request, env) : methodNotAllowed()
  }
  const activityHistoryMatch = pathname.match(/^\/api\/activity-history\/([^/]+)$/u)
  if (activityHistoryMatch?.[1]) {
    if (request.method === 'PATCH') return updateActivityHistory(request, env, activityHistoryMatch[1])
    if (request.method === 'DELETE') return deleteActivityHistory(request, env, activityHistoryMatch[1])
    return methodNotAllowed()
  }

  if (pathname === '/api/bucket-list') {
    if (request.method === 'GET') return listBucketItems(request, env)
    if (request.method === 'POST') return createBucketItem(request, env)
    return methodNotAllowed()
  }
  if (pathname === '/api/bucket-list/stats') {
    return request.method === 'GET' ? bucketStats(request, env) : methodNotAllowed()
  }
  if (pathname === '/api/bucket-list/random') {
    return request.method === 'GET' ? randomBucketItem(request, env) : methodNotAllowed()
  }
  const bucketCompleteMatch = pathname.match(/^\/api\/bucket-list\/([^/]+)\/complete$/u)
  if (bucketCompleteMatch?.[1]) {
    return request.method === 'POST' ? completeBucketItem(request, env, bucketCompleteMatch[1]) : methodNotAllowed()
  }
  const bucketMatch = pathname.match(/^\/api\/bucket-list\/([^/]+)$/u)
  if (bucketMatch?.[1]) {
    if (request.method === 'PATCH') return updateBucketItem(request, env, bucketMatch[1])
    if (request.method === 'DELETE') return deleteBucketItem(request, env, bucketMatch[1])
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
