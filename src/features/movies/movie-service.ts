import { apiRequest } from '@/lib/api'
import type {
  MovieDetails,
  MovieGenre,
  MovieHistoryEntry,
  MovieHistoryInput,
  MoviePage,
  MovieSnapshotInput,
  MovieStats,
  MovieSummary,
  MovieVideo,
  WatchlistMovie,
} from './types'

export const tmdbImage = (
  path: string | null,
  size: 'w342' | 'w500' | 'w780' | 'original' = 'w500',
): string | null => path ? `https://image.tmdb.org/t/p/${size}${path}` : null

const queryPath = (path: string, params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value))
  })
  return `${path}${search.size ? `?${search.toString()}` : ''}`
}

export const movieService = {
  genres: (signal?: AbortSignal) => apiRequest<MovieGenre[]>('/api/movies/genres', { signal }),
  popular: (page = 1, signal?: AbortSignal) => apiRequest<MoviePage>(queryPath('/api/movies/popular', { page }), { signal }),
  topRated: (page = 1, signal?: AbortSignal) => apiRequest<MoviePage>(queryPath('/api/movies/top-rated', { page }), { signal }),
  search: (query: string, page = 1, signal?: AbortSignal) => apiRequest<MoviePage>(
    queryPath('/api/movies/search', { query, page }),
    { signal },
  ),
  discover: (filters: {
    page?: number
    genreId?: number
    minRating?: number
    minVotes?: number
    minRuntime?: number
    maxRuntime?: number
    year?: number
    sortBy?: string
  }, signal?: AbortSignal) => apiRequest<MoviePage>(queryPath('/api/movies/discover', filters), { signal }),
  details: (id: number, signal?: AbortSignal) => apiRequest<MovieDetails>(`/api/movies/${id}`, { signal }),
  videos: (id: number, signal?: AbortSignal) => apiRequest<MovieVideo[]>(`/api/movies/${id}/videos`, { signal }),
  watchlist: () => apiRequest<WatchlistMovie[]>('/api/movies/watchlist?limit=100'),
  addWatchlist: (movie: MovieSnapshotInput) => apiRequest<WatchlistMovie>('/api/movies/watchlist', {
    method: 'POST',
    body: JSON.stringify(movie),
  }),
  removeWatchlist: (movieId: number) => apiRequest<{ deleted: true }>(`/api/movies/watchlist/${movieId}`, { method: 'DELETE' }),
  history: () => apiRequest<MovieHistoryEntry[]>('/api/movies/history?limit=250'),
  createHistory: (input: MovieHistoryInput) => apiRequest<MovieHistoryEntry>('/api/movies/history', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updateHistory: (id: string, input: Pick<MovieHistoryInput, 'watchedOn' | 'note' | 'ratings'>) =>
    apiRequest<MovieHistoryEntry>(`/api/movies/history/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteHistory: (id: string) => apiRequest<{ deleted: true }>(
    `/api/movies/history/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  ),
  stats: () => apiRequest<MovieStats>('/api/movies/stats'),
}

export const movieSnapshot = (movie: MovieSummary | MovieDetails): MovieSnapshotInput => ({
  tmdbMovieId: movie.id,
  title: movie.title,
  posterPath: movie.posterPath,
  releaseYear: movie.releaseDate ? Number(movie.releaseDate.slice(0, 4)) : null,
})
