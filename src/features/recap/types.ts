export interface RecapProfile {
  id: string
  displayName: string
}

export interface RecapRelationship {
  title: string
  startDate: string
  timeZone: string
  profiles: RecapProfile[]
}

export interface RecapYearSummary {
  yearNumber: number
  label: string
  startDate: string
  endDate: string
  endExclusiveDate: string
  completed: boolean
  current: boolean
  daysIntoYear: number
  daysInYear: number
}

export interface RecapComparisonMetric {
  key: 'memories' | 'movies' | 'games' | 'activities' | 'bucket' | 'letters'
  label: string
  earlier: number
  later: number
}

export interface RecapComparison {
  earlierYear: number
  laterYear: number
  metrics: RecapComparisonMetric[]
}

export interface RecapIndexResponse {
  relationship: RecapRelationship
  serverDate: string
  currentYear: RecapYearSummary
  completedYears: RecapYearSummary[]
  comparison: RecapComparison | null
  anniversary: {
    isToday: boolean
    completedYearNumber: number | null
  }
}

export interface RecapMediaPreview {
  type: 'image' | 'video'
  url: string
  alt: string
}

export interface RecapMemoryHighlight {
  id: string
  title: string
  caption: string
  date: string
  category: string
  favorite: boolean
  mediaCount: number
  preview: RecapMediaPreview | null
}

export interface RecapMilestone {
  title: string
  description: string
  date: string
  eyebrow: string
}

export interface RecapMovieHighlight {
  tmdbMovieId: number
  title: string
  posterPath: string | null
  watchCount: number
  averageRating: number | null
}

export interface RecapGameHighlight {
  gameId: string
  name: string
  category: string
  playCount: number
  averageRating: number
}

export interface RecapSongHighlight {
  title: string
  artist: string
  whyItMatters: string
  addedOn: string
  spotifyUrl: string | null
  youtubeUrl: string | null
  isOurSong: boolean
  artworkUrl: string | null
}

export interface RecapActivityHighlight {
  name: string
  category: string
  completedDate: string
  rating: number | null
  linkedMemoryId: string | null
  preview: RecapMediaPreview | null
}

export interface RecapBucketHighlight {
  title: string
  category: string
  addedDate: string
  completedDate: string | null
  dateContext: 'added' | 'completed'
  linkedMemoryId: string | null
  preview: RecapMediaPreview | null
}

export interface RecapOpenedLetterHighlight {
  title: string
  letterType: 'typed' | 'uploaded'
  senderName: string
  recipientName: string
  openedAt: number
  waitDays: number
}

export interface RecapYearResponse {
  relationship: RecapRelationship
  serverDate: string
  year: RecapYearSummary
  memories: {
    count: number
    photoCount: number
    videoCount: number
    favoriteCount: number
    highlights: RecapMemoryHighlight[]
  }
  milestones: RecapMilestone[]
  movies: {
    watchCount: number
    uniqueCount: number
    rewatchCount: number
    ratedWatchCount: number
    highestRated: RecapMovieHighlight[]
    mostWatched: RecapMovieHighlight | null
    largestRatingDisagreement: {
      title: string
      watchedOn: string
      difference: number
    } | null
  }
  games: {
    playCount: number
    draws: number
    cooperativeWins: number
    noWinnerCount: number
    partnerWins: Array<{ userId: string; displayName: string; wins: number }>
    mostPlayed: RecapGameHighlight | null
    highestRated: RecapGameHighlight[]
  }
  soundtrack: {
    songsAdded: number
    ourSong: RecapSongHighlight | null
    highlights: RecapSongHighlight[]
  }
  activities: {
    completedCount: number
    averageRating: number | null
    repeatedCount: number
    indoorCount: number
    outdoorCount: number
    freeCount: number
    adventurousCount: number
    topCategories: Array<{ category: string; count: number }>
    highlights: RecapActivityHighlight[]
  }
  bucket: {
    addedCount: number
    completedCount: number
    highlights: RecapBucketHighlight[]
  }
  letters: {
    openedCount: number
    typedCount: number
    uploadedCount: number
    longestWaitDays: number | null
    highlights: RecapOpenedLetterHighlight[]
  }
}

export type ThisDayItemKind = 'memory' | 'milestone'

export interface ThisDayItem {
  kind: ThisDayItemKind
  title: string
  detail: string
  date: string
  href: string | null
  media: RecapMediaPreview | null
}

export interface ThisDayResponse {
  date: string
  items: ThisDayItem[]
}
