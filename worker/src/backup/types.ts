export const BACKUP_FORMAT_VERSION = '1.0' as const
export const BACKUP_DOWNLOAD_WINDOW_MS = 15 * 60 * 1000
export const FULL_BACKUP_RECENT_AUTH_MS = 10 * 60 * 1000

export type BackupType = 'data' | 'full'
export type BackupJobStatus = 'queued' | 'preparing' | 'succeeded' | 'failed' | 'expired'
export type LetterSnapshotStatus = 'draft' | 'sealed-locked' | 'ready-unopened' | 'opened'
export type LetterContentPolicy = 'requester-draft-included' | 'metadata-only' | 'opened-content-included'

export interface BackupEstimate {
  estimatedBytes: number
  mediaFiles: number
  memories: number
  openedLetters: number
  estimateAvailable: boolean
  recentAuthenticationValid: boolean
}

export interface BackupJobPublic {
  id: string
  type: BackupType
  status: BackupJobStatus
  formatVersion: typeof BACKUP_FORMAT_VERSION
  requestedBy: { id: string; displayName: string }
  includeMyDrafts: boolean
  estimatedBytes: number | null
  archiveBytes: number | null
  plannedMediaFiles: number
  exportedMediaFiles: number
  missingMediaFiles: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string
  downloadedAt: string | null
  downloadUrl: string | null
}

export interface ProfileExportV1 {
  id: string
  displayName: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface RelationshipExportV1 {
  backupFormatVersion: typeof BACKUP_FORMAT_VERSION
  id: string
  title: string
  startDate: string
  timezone: string
  partnerUserIds: [string, string]
  createdAt: string
  updatedAt: string
}

export interface MediaMetadataExportV1 {
  id: string
  type: 'image' | 'video'
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationSeconds: number | null
  altText: string
  originalFilename: string
  sortOrder: number
  createdAt: string
  archivePath: string | null
}

export interface TimelineExportV1 {
  id: string
  createdByUserId: string
  title: string
  description: string
  date: string
  eyebrow: string
  createdAt: string
  updatedAt: string
}

export interface MemoryExportV1 {
  id: string
  title: string
  caption: string
  location: string
  date: string
  category: string
  favorite: boolean
  createdByUserId: string
  createdAt: string
  updatedAt: string
  linkedActivityHistoryIds: string[]
  linkedBucketListItemIds: string[]
  media: MediaMetadataExportV1[]
}

export interface MovieWatchlistExportV1 {
  tmdbMovieId: number
  title: string
  posterPath: string | null
  releaseYear: number | null
  addedByUserId: string
  addedAt: string
}

export interface MovieRatingExportV1 {
  userId: string
  displayName: string
  rating: number
}

export interface MovieHistoryExportV1 {
  id: string
  tmdbMovieId: number
  title: string
  posterPath: string | null
  releaseYear: number | null
  watchedOn: string
  note: string
  createdByUserId: string
  ratings: MovieRatingExportV1[]
  createdAt: string
  updatedAt: string
}

export interface GameExportV1 {
  id: string
  name: string
  category: string
  playerCount: string
  duration: string
  notes: string
  builtIn: boolean
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface GameHistoryExportV1 {
  id: string
  gameId: string
  gameNameSnapshot: string
  playedOn: string
  outcome: string
  winnerUserId: string | null
  winnerDisplayName: string | null
  rating: number
  note: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface SongExportV1 {
  id: string
  title: string
  artist: string
  spotifyUrl: string | null
  youtubeUrl: string | null
  whyItMatters: string
  addedOn: string
  createdByUserId: string
  associatedMemoryId: string | null
  artworkMediaId: string | null
  isOurSong: boolean
  createdAt: string
  updatedAt: string
}

export interface ActivityExportV1 {
  id: string
  name: string
  description: string
  category: string
  locationType: string
  budgetLevel: string
  energyLevel: string
  durationCategory: string
  notes: string
  builtIn: boolean
  active: boolean
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityExclusionExportV1 {
  activityId: string
  createdByUserId: string
  createdAt: string
}

export interface SavedActivityExportV1 {
  activityId: string
  savedByUserId: string
  createdAt: string
}

export interface PlannedActivityExportV1 {
  id: string
  activityId: string
  plannedDate: string
  plannedTime: string | null
  note: string
  status: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface ActivityHistoryExportV1 {
  id: string
  activityId: string
  activityNameSnapshot: string
  plannedActivityId: string | null
  completedDate: string
  rating: number | null
  notes: string
  createdByUserId: string
  linkedMemoryId: string | null
  createdAt: string
  updatedAt: string
}

export interface BucketListExportV1 {
  id: string
  title: string
  description: string
  category: string
  status: string
  targetDate: string | null
  location: string
  priority: string | null
  createdByUserId: string
  completedByUserId: string | null
  completedAt: string | null
  completionRating: number | null
  completionNote: string
  linkedMemoryId: string | null
  createdAt: string
  updatedAt: string
}

export interface LetterMediaExportV1 {
  id: string
  role: 'page' | 'cover'
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  altText: string
  originalFilename: string
  sortOrder: number
  createdAt: string
  archivePath: string | null
}

export interface LetterExportV1 {
  id: string
  title: string
  senderUserId: string
  senderDisplayName: string
  recipientType: 'user' | 'both' | null
  recipientUserId: string | null
  recipientDisplayName: string | null
  letterType: 'typed' | 'uploaded'
  teaser: string
  statusAtSnapshot: LetterSnapshotStatus
  contentPolicy: LetterContentPolicy
  unlockAt: string | null
  sealedAt: string | null
  openedAt: string | null
  firstOpenedByUserId: string | null
  pageCount: number
  typedContent?: string
  media?: LetterMediaExportV1[]
  createdAt: string
  updatedAt: string
}

export interface BackupWarningV1 {
  code: 'media-missing' | 'media-unavailable'
  mediaId: string
  plannedArchivePath: string
}

export interface BackupMediaIndexV1 {
  mediaId: string
  archivePath: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  entityType: 'memory' | 'letter'
  entityId: string
  included: boolean
}

export interface BackupManifestV1 {
  backupFormatVersion: typeof BACKUP_FORMAT_VERSION
  exportType: BackupType
  createdAt: string
  snapshotAt: string
  relationshipId: string
  relationshipTitle: string
  createdBy: { id: string; displayName: string }
  timezone: string
  counts: {
    profiles: number
    timelineEntries: number
    memories: number
    movieWatchlist: number
    movieHistory: number
    games: number
    gameHistory: number
    songs: number
    activities: number
    activityHistory: number
    bucketListItems: number
    letters: number
    mediaFiles: number
  }
  totalMediaBytes: number
  includesRequesterDrafts: boolean
  containsLockedLetterMetadata: boolean
  containsLockedLetterContent: false
  checksumPolicy: 'not-included'
  media: BackupMediaIndexV1[]
  warnings: BackupWarningV1[]
}

export interface BackupDataV1 {
  relationship: RelationshipExportV1
  profiles: ProfileExportV1[]
  timeline: TimelineExportV1[]
  memories: MemoryExportV1[]
  movies: { watchlist: MovieWatchlistExportV1[]; history: MovieHistoryExportV1[] }
  games: { catalogue: GameExportV1[]; history: GameHistoryExportV1[] }
  soundtrack: SongExportV1[]
  activities: {
    catalogue: ActivityExportV1[]
    exclusions: ActivityExclusionExportV1[]
    saved: SavedActivityExportV1[]
    planned: PlannedActivityExportV1[]
    history: ActivityHistoryExportV1[]
  }
  bucketList: BucketListExportV1[]
  letters: LetterExportV1[]
}

export interface BackupMediaSource {
  mediaId: string
  r2Key: string
  archivePath: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  entityType: 'memory' | 'letter'
  entityId: string
}

export interface BackupSnapshot {
  snapshotAt: number
  data: BackupDataV1
  mediaSources: BackupMediaSource[]
}
