import { ApiError } from './http'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const REQUEST_TIMEOUT_MS = 8_000

export interface TmdbMovieSummary {
  id: number
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string | null
  genreIds: number[]
  voteAverage: number
  voteCount: number
}

interface RawMovieSummary {
  id?: unknown
  title?: unknown
  overview?: unknown
  poster_path?: unknown
  backdrop_path?: unknown
  release_date?: unknown
  genre_ids?: unknown
  vote_average?: unknown
  vote_count?: unknown
}

interface RawPage {
  page?: unknown
  total_pages?: unknown
  total_results?: unknown
  results?: unknown
}

const safeNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const safeText = (value: unknown): string => typeof value === 'string' ? value : ''
const safePath = (value: unknown): string | null => typeof value === 'string' && value.startsWith('/') ? value : null

export const normalizeMovieSummary = (movie: RawMovieSummary): TmdbMovieSummary => ({
  id: Math.trunc(safeNumber(movie.id)),
  title: safeText(movie.title) || 'Untitled film',
  overview: safeText(movie.overview),
  posterPath: safePath(movie.poster_path),
  backdropPath: safePath(movie.backdrop_path),
  releaseDate: /^\d{4}-\d{2}-\d{2}$/u.test(safeText(movie.release_date)) ? safeText(movie.release_date) : null,
  genreIds: Array.isArray(movie.genre_ids)
    ? movie.genre_ids.filter((value): value is number => Number.isSafeInteger(value) && Number(value) > 0)
    : [],
  voteAverage: safeNumber(movie.vote_average),
  voteCount: Math.max(0, Math.trunc(safeNumber(movie.vote_count))),
})

const readJsonResponse = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw new ApiError(502, 'TMDB_INVALID_RESPONSE', 'The movie catalogue returned an unreadable response.')
  }
}

export const tmdbRequest = async (
  env: Env,
  path: string,
  params: URLSearchParams,
  cacheTtlSeconds = 300,
): Promise<unknown> => {
  const token = env.TMDB_API_READ_TOKEN?.trim()
  if (!token) {
    throw new ApiError(503, 'TMDB_NOT_CONFIGURED', 'Movie discovery is waiting for its private TMDB connection.')
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`)
  params.forEach((value, key) => url.searchParams.set(key, value))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const init: RequestInit & { cf?: { cacheEverything: boolean; cacheTtl: number } } = {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
      cf: { cacheEverything: true, cacheTtl: cacheTtlSeconds },
    }
    const response = await fetch(url, init)
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError(503, 'TMDB_CONFIGURATION_ERROR', 'The private movie catalogue connection needs attention.')
      }
      if (response.status === 429) {
        throw new ApiError(503, 'TMDB_RATE_LIMITED', 'The movie catalogue is busy. Please try again shortly.')
      }
      throw new ApiError(502, 'TMDB_UNAVAILABLE', 'The movie catalogue is temporarily unavailable.')
    }
    return await readJsonResponse(response)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(504, 'TMDB_TIMEOUT', 'The movie catalogue took too long to respond.')
    }
    throw new ApiError(502, 'TMDB_UNAVAILABLE', 'The movie catalogue could not be reached.')
  } finally {
    clearTimeout(timeout)
  }
}

export const normalizeMoviePage = (payload: unknown) => {
  const page = payload && typeof payload === 'object' ? payload as RawPage : {}
  const results = Array.isArray(page.results) ? page.results : []
  return {
    page: Math.max(1, Math.trunc(safeNumber(page.page, 1))),
    totalPages: Math.min(500, Math.max(0, Math.trunc(safeNumber(page.total_pages)))),
    totalResults: Math.max(0, Math.trunc(safeNumber(page.total_results))),
    results: results
      .filter((movie): movie is RawMovieSummary => Boolean(movie) && typeof movie === 'object')
      .map(normalizeMovieSummary)
      .filter((movie) => movie.id > 0),
  }
}

export const tmdbImageUrl = (path: string | null, size: 'w342' | 'w500' | 'w780' | 'original' = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null
