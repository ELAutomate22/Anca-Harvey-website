export interface MovieGenre {
  id: number
  name: string
}

export interface MovieSummary {
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

export interface MoviePage {
  page: number
  totalPages: number
  totalResults: number
  results: MovieSummary[]
}

export interface MovieDetails extends MovieSummary {
  genres: MovieGenre[]
  runtime: number | null
  tagline: string
  status: string
}

export interface MovieVideo {
  id: string
  key: string
  name: string
  type: string
  official: boolean
}

export interface WatchlistMovie {
  tmdbMovieId: number
  title: string
  posterPath: string | null
  releaseYear: number | null
  addedByUserId: string
  createdAt: number
  watched: boolean
}

export interface MovieHistoryEntry {
  id: string
  tmdbMovieId: number
  title: string
  posterPath: string | null
  releaseYear: number | null
  watchedOn: string
  note: string
  ratings: Record<string, number>
  createdByUserId: string
  createdAt: number
  updatedAt: number
}

export interface MovieStats {
  totalWatches: number
  uniqueMovies: number
  rewatches: number
  watchlistCount: number
  ratingsByUser: Array<{ userId: string; averageRating: number; ratingCount: number }>
  mostWatched: { title: string; tmdbMovieId: number; watchCount: number } | null
}

export interface MovieSnapshotInput {
  tmdbMovieId: number
  title: string
  posterPath: string | null
  releaseYear: number | null
}

export interface MovieHistoryInput extends MovieSnapshotInput {
  watchedOn: string
  note: string
  ratings: Record<string, number>
}
