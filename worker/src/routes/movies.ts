import { requireSession, type AuthSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import {
  movieSnapshot,
  optionalYear,
  pageLimit,
  phaseThreeDate,
  positiveInteger,
  ratingHalfSteps,
} from '../lib/phase-three'
import { asRecord, optionalString } from '../lib/validation'
import { normalizeMoviePage, normalizeMovieSummary, tmdbRequest } from '../lib/tmdb'

const catalogueCacheHeaders = { 'Cache-Control': 'private, max-age=180, stale-while-revalidate=600' }

const positiveQueryInteger = (value: string | null, field: string, fallback: number, maximum: number): number => {
  if (value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be between 1 and ${maximum}.`)
  }
  return parsed
}

const decimalQuery = (value: string | null, field: string, minimum: number, maximum: number): number | undefined => {
  if (value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be between ${minimum} and ${maximum}.`)
  }
  return parsed
}

const catalogueParams = (url: URL) => {
  const params = new URLSearchParams({
    language: 'en-GB',
    region: 'GB',
    include_adult: 'false',
    page: String(positiveQueryInteger(url.searchParams.get('page'), 'page', 1, 500)),
  })
  return params
}

export const movieGenres = async (request: Request, env: Env): Promise<Response> => {
  await requireSession(request, env)
  const payload = await tmdbRequest(env, '/genre/movie/list', new URLSearchParams({ language: 'en-GB' }), 86_400)
  const record = payload && typeof payload === 'object' ? payload as { genres?: unknown } : {}
  const genres = Array.isArray(record.genres) ? record.genres.flatMap((genre) => {
    if (!genre || typeof genre !== 'object') return []
    const item = genre as { id?: unknown; name?: unknown }
    return Number.isSafeInteger(item.id) && typeof item.name === 'string'
      ? [{ id: Number(item.id), name: item.name }]
      : []
  }) : []
  return apiSuccess(genres, { headers: catalogueCacheHeaders })
}

export const popularMovies = async (request: Request, env: Env): Promise<Response> => {
  await requireSession(request, env)
  const payload = await tmdbRequest(env, '/movie/popular', catalogueParams(new URL(request.url)))
  return apiSuccess(normalizeMoviePage(payload), { headers: catalogueCacheHeaders })
}

export const topRatedMovies = async (request: Request, env: Env): Promise<Response> => {
  await requireSession(request, env)
  const payload = await tmdbRequest(env, '/movie/top_rated', catalogueParams(new URL(request.url)))
  return apiSuccess(normalizeMoviePage(payload), { headers: catalogueCacheHeaders })
}

export const searchMovies = async (request: Request, env: Env): Promise<Response> => {
  await requireSession(request, env)
  const url = new URL(request.url)
  const query = (url.searchParams.get('query') ?? '').trim()
  if (!query || query.length > 200) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'query must be between 1 and 200 characters.')
  }
  const params = catalogueParams(url)
  params.set('query', query)
  const year = url.searchParams.get('year')
  if (year) params.set('year', String(optionalYear(year, 'year')))
  const payload = await tmdbRequest(env, '/search/movie', params, 120)
  return apiSuccess(normalizeMoviePage(payload), { headers: catalogueCacheHeaders })
}

export const discoverMovies = async (request: Request, env: Env): Promise<Response> => {
  await requireSession(request, env)
  const url = new URL(request.url)
  const params = catalogueParams(url)
  params.set('include_video', 'false')
  const sort = url.searchParams.get('sortBy') ?? 'popularity.desc'
  const allowedSorts = new Set(['popularity.desc', 'vote_average.desc', 'primary_release_date.desc', 'revenue.desc'])
  if (!allowedSorts.has(sort)) throw new ApiError(400, 'VALIDATION_ERROR', 'sortBy is not supported.')
  params.set('sort_by', sort)

  const genreId = url.searchParams.get('genreId')
  if (genreId) params.set('with_genres', String(positiveQueryInteger(genreId, 'genreId', 1, 99_999)))
  const minRating = decimalQuery(url.searchParams.get('minRating'), 'minRating', 0, 10)
  if (minRating !== undefined) params.set('vote_average.gte', String(minRating))
  const minVotes = decimalQuery(url.searchParams.get('minVotes'), 'minVotes', 0, 100_000_000)
  if (minVotes !== undefined) params.set('vote_count.gte', String(Math.trunc(minVotes)))
  const minRuntime = decimalQuery(url.searchParams.get('minRuntime'), 'minRuntime', 0, 1_000)
  if (minRuntime !== undefined) params.set('with_runtime.gte', String(Math.trunc(minRuntime)))
  const maxRuntime = decimalQuery(url.searchParams.get('maxRuntime'), 'maxRuntime', 1, 1_000)
  if (maxRuntime !== undefined) params.set('with_runtime.lte', String(Math.trunc(maxRuntime)))
  const year = url.searchParams.get('year')
  if (year) params.set('primary_release_year', String(optionalYear(year, 'year')))
  const payload = await tmdbRequest(env, '/discover/movie', params)
  return apiSuccess(normalizeMoviePage(payload), { headers: catalogueCacheHeaders })
}

export const movieDetails = async (request: Request, env: Env, movieId: string): Promise<Response> => {
  await requireSession(request, env)
  const id = positiveInteger(movieId, 'movieId')
  const payload = await tmdbRequest(env, `/movie/${id}`, new URLSearchParams({ language: 'en-GB' }), 3_600)
  const raw = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const summary = normalizeMovieSummary(raw)
  const genres = Array.isArray(raw.genres) ? raw.genres.flatMap((genre) => {
    if (!genre || typeof genre !== 'object') return []
    const item = genre as { id?: unknown; name?: unknown }
    return Number.isSafeInteger(item.id) && typeof item.name === 'string'
      ? [{ id: Number(item.id), name: item.name }]
      : []
  }) : []
  return apiSuccess({
    ...summary,
    genres,
    runtime: typeof raw.runtime === 'number' && Number.isFinite(raw.runtime) ? raw.runtime : null,
    tagline: typeof raw.tagline === 'string' ? raw.tagline : '',
    status: typeof raw.status === 'string' ? raw.status : '',
  }, { headers: catalogueCacheHeaders })
}

export const movieVideos = async (request: Request, env: Env, movieId: string): Promise<Response> => {
  await requireSession(request, env)
  const id = positiveInteger(movieId, 'movieId')
  const payload = await tmdbRequest(env, `/movie/${id}/videos`, new URLSearchParams({ language: 'en-GB' }), 3_600)
  const raw = payload && typeof payload === 'object' ? payload as { results?: unknown } : {}
  const results = Array.isArray(raw.results) ? raw.results.flatMap((video) => {
    if (!video || typeof video !== 'object') return []
    const item = video as Record<string, unknown>
    if (item.site !== 'YouTube' || typeof item.key !== 'string' || !/^[\w-]{6,20}$/u.test(item.key)) return []
    return [{
      id: typeof item.id === 'string' ? item.id : item.key,
      key: item.key,
      name: typeof item.name === 'string' ? item.name : 'Trailer',
      type: typeof item.type === 'string' ? item.type : 'Video',
      official: item.official === true,
    }]
  }) : []
  return apiSuccess(results, { headers: catalogueCacheHeaders })
}

interface WatchlistRow {
  tmdb_movie_id: number
  title: string
  poster_path: string | null
  release_year: number | null
  added_by_user_id: string
  created_at: number
  watched: number
}

const watchlistResponse = (row: WatchlistRow) => ({
  tmdbMovieId: Number(row.tmdb_movie_id),
  title: row.title,
  posterPath: row.poster_path,
  releaseYear: row.release_year === null ? null : Number(row.release_year),
  addedByUserId: row.added_by_user_id,
  createdAt: Number(row.created_at),
  watched: Boolean(row.watched),
})

export const listWatchlist = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const result = await env.DB.prepare(`
    SELECT w.tmdb_movie_id, w.title, w.poster_path, w.release_year, w.added_by_user_id, w.created_at,
      EXISTS(
        SELECT 1 FROM movie_history h
        WHERE h.relationship_id = w.relationship_id AND h.tmdb_movie_id = w.tmdb_movie_id
      ) AS watched
    FROM movie_watchlist w
    WHERE w.relationship_id = ?
    ORDER BY w.created_at DESC
    LIMIT ?
  `).bind(session.relationship.id, pageLimit(new URL(request.url))).all<WatchlistRow>()
  return apiSuccess(result.results.map(watchlistResponse))
}

export const addWatchlistMovie = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const snapshot = movieSnapshot(asRecord(await readJson(request)))
  const now = Date.now()
  const result = await env.DB.prepare(`
    INSERT INTO movie_watchlist (
      relationship_id, tmdb_movie_id, title, poster_path, release_year, added_by_user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(relationship_id, tmdb_movie_id) DO NOTHING
  `).bind(
    session.relationship.id,
    snapshot.tmdbMovieId,
    snapshot.title,
    snapshot.posterPath,
    snapshot.releaseYear,
    session.user.id,
    now,
  ).run()
  if (!result.meta.changed_db) throw new ApiError(409, 'MOVIE_ALREADY_WATCHLISTED', 'That film is already on the watchlist.')
  return apiSuccess({ ...snapshot, addedByUserId: session.user.id, createdAt: now, watched: false }, { status: 201 })
}

export const removeWatchlistMovie = async (request: Request, env: Env, movieId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const id = positiveInteger(movieId, 'movieId')
  const result = await env.DB.prepare('DELETE FROM movie_watchlist WHERE relationship_id = ? AND tmdb_movie_id = ?')
    .bind(session.relationship.id, id).run()
  if (!result.meta.changed_db) throw new ApiError(404, 'WATCHLIST_MOVIE_NOT_FOUND', 'That film is not on the watchlist.')
  return apiSuccess({ deleted: true })
}

interface MovieRatingRow {
  user_id: string
  rating_half_steps: number
}

interface HistoryRow {
  id: string
  tmdb_movie_id: number
  title: string
  poster_path: string | null
  release_year: number | null
  watched_on: string
  note: string
  created_by_user_id: string
  created_at: number
  updated_at: number
}

const historyResponse = (row: HistoryRow, ratings: MovieRatingRow[]) => ({
  id: row.id,
  tmdbMovieId: Number(row.tmdb_movie_id),
  title: row.title,
  posterPath: row.poster_path,
  releaseYear: row.release_year === null ? null : Number(row.release_year),
  watchedOn: row.watched_on,
  note: row.note,
  ratings: Object.fromEntries(ratings.map((rating) => [rating.user_id, Number(rating.rating_half_steps) / 2])),
  createdByUserId: row.created_by_user_id,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const listHistoryRows = async (env: Env, relationshipId: string, limit: number) => {
  const result = await env.DB.prepare(`
    SELECT id, tmdb_movie_id, title, poster_path, release_year, watched_on, note,
      created_by_user_id, created_at, updated_at
    FROM movie_history WHERE relationship_id = ?
    ORDER BY watched_on DESC, created_at DESC LIMIT ?
  `).bind(relationshipId, limit).all<HistoryRow>()
  if (!result.results.length) return []
  const ratings = await env.DB.prepare(`
    SELECT r.user_id, r.rating_half_steps, r.history_id
    FROM movie_history_ratings r
    JOIN movie_history h ON h.id = r.history_id
    WHERE h.relationship_id = ?
  `).bind(relationshipId).all<MovieRatingRow & { history_id: string }>()
  return result.results.map((row) => historyResponse(
    row,
    ratings.results.filter((rating) => rating.history_id === row.id),
  ))
}

const parseRatings = (value: unknown, session: AuthSession): Map<string, number> => {
  if (value === undefined) return new Map()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'ratings must be keyed by partner user ID.')
  }
  const allowed = new Set([session.relationship.partner1UserId, session.relationship.partner2UserId])
  const ratings = new Map<string, number>()
  for (const [userId, rating] of Object.entries(value)) {
    if (!allowed.has(userId)) throw new ApiError(400, 'VALIDATION_ERROR', 'ratings contains an unknown partner.')
    ratings.set(userId, ratingHalfSteps(rating))
  }
  return ratings
}

export const listMovieHistory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  return apiSuccess(await listHistoryRows(env, session.relationship.id, pageLimit(new URL(request.url), 100, 250)))
}

export const createMovieHistory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const snapshot = movieSnapshot(body)
  const watchedOn = phaseThreeDate(body, 'watchedOn')
  const note = optionalString(body.note, 'note', 5_000) ?? ''
  const ratings = parseRatings(body.ratings, session)
  const id = crypto.randomUUID()
  const now = Date.now()
  const statements = [env.DB.prepare(`
    INSERT INTO movie_history (
      id, relationship_id, tmdb_movie_id, title, poster_path, release_year, watched_on,
      note, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, session.relationship.id, snapshot.tmdbMovieId, snapshot.title, snapshot.posterPath,
    snapshot.releaseYear, watchedOn, note, session.user.id, now, now,
  )]
  ratings.forEach((halfSteps, userId) => {
    statements.push(env.DB.prepare(
      'INSERT INTO movie_history_ratings (history_id, user_id, rating_half_steps) VALUES (?, ?, ?)',
    ).bind(id, userId, halfSteps))
  })
  await env.DB.batch(statements)
  return apiSuccess(historyResponse({
    id,
    tmdb_movie_id: snapshot.tmdbMovieId,
    title: snapshot.title,
    poster_path: snapshot.posterPath,
    release_year: snapshot.releaseYear,
    watched_on: watchedOn,
    note,
    created_by_user_id: session.user.id,
    created_at: now,
    updated_at: now,
  }, [...ratings].map(([user_id, rating_half_steps]) => ({ user_id, rating_half_steps }))), { status: 201 })
}

const ownedHistory = async (env: Env, relationshipId: string, historyId: string): Promise<HistoryRow> => {
  const row = await env.DB.prepare(`
    SELECT id, tmdb_movie_id, title, poster_path, release_year, watched_on, note,
      created_by_user_id, created_at, updated_at
    FROM movie_history WHERE id = ? AND relationship_id = ? LIMIT 1
  `).bind(historyId, relationshipId).first<HistoryRow>()
  if (!row) throw new ApiError(404, 'MOVIE_HISTORY_NOT_FOUND', 'That movie diary entry was not found.')
  return row
}

export const updateMovieHistory = async (request: Request, env: Env, historyId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await ownedHistory(env, session.relationship.id, historyId)
  const body = asRecord(await readJson(request))
  const watchedOn = body.watchedOn === undefined ? current.watched_on : phaseThreeDate(body, 'watchedOn')
  const note = body.note === undefined ? current.note : (optionalString(body.note, 'note', 5_000) ?? '')
  const title = body.title === undefined ? current.title : movieSnapshot({
    tmdbMovieId: current.tmdb_movie_id,
    title: body.title,
    posterPath: current.poster_path,
    releaseYear: current.release_year,
  }).title
  const now = Date.now()
  const statements = [env.DB.prepare(`
    UPDATE movie_history SET title = ?, watched_on = ?, note = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ?
  `).bind(title, watchedOn, note, now, historyId, session.relationship.id)]
  let ratings: Map<string, number> | undefined
  if (body.ratings !== undefined) {
    ratings = parseRatings(body.ratings, session)
    statements.push(env.DB.prepare('DELETE FROM movie_history_ratings WHERE history_id = ?').bind(historyId))
    ratings.forEach((halfSteps, userId) => {
      statements.push(env.DB.prepare(
        'INSERT INTO movie_history_ratings (history_id, user_id, rating_half_steps) VALUES (?, ?, ?)',
      ).bind(historyId, userId, halfSteps))
    })
  }
  await env.DB.batch(statements)
  const ratingRows = ratings
    ? [...ratings].map(([user_id, rating_half_steps]) => ({ user_id, rating_half_steps }))
    : (await env.DB.prepare(
      'SELECT user_id, rating_half_steps FROM movie_history_ratings WHERE history_id = ?',
    ).bind(historyId).all<MovieRatingRow>()).results
  return apiSuccess(historyResponse({ ...current, title, watched_on: watchedOn, note, updated_at: now }, ratingRows))
}

export const deleteMovieHistory = async (request: Request, env: Env, historyId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  await ownedHistory(env, session.relationship.id, historyId)
  await env.DB.prepare('DELETE FROM movie_history WHERE id = ? AND relationship_id = ?')
    .bind(historyId, session.relationship.id).run()
  return apiSuccess({ deleted: true })
}

export const movieStats = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const [history, watchlist, ratings, favourite] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS total_watches, COUNT(DISTINCT tmdb_movie_id) AS unique_movies
      FROM movie_history WHERE relationship_id = ?
    `).bind(session.relationship.id).first<{ total_watches: number; unique_movies: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM movie_watchlist WHERE relationship_id = ?')
      .bind(session.relationship.id).first<{ count: number }>(),
    env.DB.prepare(`
      SELECT r.user_id, AVG(r.rating_half_steps) / 2.0 AS average_rating, COUNT(*) AS rating_count
      FROM movie_history_ratings r JOIN movie_history h ON h.id = r.history_id
      WHERE h.relationship_id = ? GROUP BY r.user_id
    `).bind(session.relationship.id).all<{ user_id: string; average_rating: number; rating_count: number }>(),
    env.DB.prepare(`
      SELECT title, tmdb_movie_id, COUNT(*) AS watch_count
      FROM movie_history WHERE relationship_id = ?
      GROUP BY tmdb_movie_id, title ORDER BY watch_count DESC, MAX(watched_on) DESC LIMIT 1
    `).bind(session.relationship.id).first<{ title: string; tmdb_movie_id: number; watch_count: number }>(),
  ])
  const totalWatches = Number(history?.total_watches ?? 0)
  const uniqueMovies = Number(history?.unique_movies ?? 0)
  return apiSuccess({
    totalWatches,
    uniqueMovies,
    rewatches: Math.max(0, totalWatches - uniqueMovies),
    watchlistCount: Number(watchlist?.count ?? 0),
    ratingsByUser: ratings.results.map((row) => ({
      userId: row.user_id,
      averageRating: Number(row.average_rating),
      ratingCount: Number(row.rating_count),
    })),
    mostWatched: favourite ? {
      title: favourite.title,
      tmdbMovieId: Number(favourite.tmdb_movie_id),
      watchCount: Number(favourite.watch_count),
    } : null,
  })
}
