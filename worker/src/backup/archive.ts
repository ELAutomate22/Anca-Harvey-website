import { makeZip } from 'client-zip'
import { createCsv, type CsvValue } from './csv'
import { assertSafeArchivePath } from './filenames'
import type {
  BackupManifestV1,
  BackupMediaIndexV1,
  BackupSnapshot,
  BackupType,
  BackupWarningV1,
} from './types'
import { BACKUP_FORMAT_VERSION } from './types'

const ROOT = 'Our-Relationship-Backup'

interface ArchiveEntry {
  name: string
  input: string | ReadableStream<Uint8Array>
  size?: number
  lastModified: Date
}

export interface ArchiveProgress {
  exportedMediaFiles: number
  missingMediaFiles: number
  exportedMediaBytes: number
  warnings: BackupWarningV1[]
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`
const collection = <T>(items: T[]) => ({ backupFormatVersion: BACKUP_FORMAT_VERSION, items })
const file = (name: string, input: string, lastModified: Date): ArchiveEntry => ({ name: `${ROOT}/${name}`, input, lastModified })

const buildReadme = (input: {
  type: BackupType
  relationshipTitle: string
  createdAt: string
  includeMyDrafts: boolean
}): string => [
  'OUR RELATIONSHIP BACKUP',
  '',
  `Relationship: ${input.relationshipTitle}`,
  `Generated: ${input.createdAt}`,
  `Backup format: ${BACKUP_FORMAT_VERSION}`,
  `Export type: ${input.type === 'full' ? 'Full Backup (structured data and eligible uploaded media)' : 'Data Only (structured data without media binaries)'}`,
  '',
  'JSON files are the canonical, machine-readable record. CSV files are supplementary copies for spreadsheets.',
  input.includeMyDrafts
    ? 'The requester explicitly included only their own private Future Letter drafts.'
    : 'Private Future Letter drafts are not included.',
  'Locked and ready-but-unopened Future Letters contain metadata only. Their body and pages are not included.',
  'Opened Future Letters may include their content and handwritten pages.',
  'Passwords, session data, authentication records, API credentials, and storage keys are never included.',
  'Developer-provided website assets, source code, TMDB images, and orphan storage objects are never included.',
  'The media index in manifest.json maps stable media IDs to portable archive paths without exposing private R2 keys.',
  'Checksums are not included in format v1 because the archive is streamed and large files are never buffered.',
  '',
  'This archive is not encrypted. It was delivered over an authenticated HTTPS connection; store it somewhere you trust.',
  'Restore/import is not implemented in Phase 7.',
  '',
].join('\r\n')

const csvFiles = (snapshot: BackupSnapshot, lastModified: Date): ArchiveEntry[] => {
  const { data } = snapshot
  const movieRatings = data.movies.history.flatMap((movie) => movie.ratings.map((rating) => [movie.id, movie.tmdbMovieId, movie.title, rating.userId, rating.displayName, rating.rating] satisfies CsvValue[]))
  return [
    file('csv/memories.csv', createCsv(
      ['id', 'title', 'caption', 'date', 'location', 'category', 'favorite', 'createdByUserId', 'createdAt', 'updatedAt', 'mediaCount'],
      data.memories.map((item) => [item.id, item.title, item.caption, item.date, item.location, item.category, item.favorite, item.createdByUserId, item.createdAt, item.updatedAt, item.media.length]),
    ), lastModified),
    file('csv/timeline.csv', createCsv(
      ['id', 'date', 'title', 'description', 'eyebrow', 'createdByUserId', 'createdAt', 'updatedAt'],
      data.timeline.map((item) => [item.id, item.date, item.title, item.description, item.eyebrow, item.createdByUserId, item.createdAt, item.updatedAt]),
    ), lastModified),
    file('csv/movie-watchlist.csv', createCsv(
      ['tmdbMovieId', 'title', 'releaseYear', 'posterPath', 'addedByUserId', 'addedAt'],
      data.movies.watchlist.map((item) => [item.tmdbMovieId, item.title, item.releaseYear, item.posterPath, item.addedByUserId, item.addedAt]),
    ), lastModified),
    file('csv/movie-history.csv', createCsv(
      ['id', 'tmdbMovieId', 'title', 'releaseYear', 'posterPath', 'watchedOn', 'note', 'createdByUserId', 'createdAt', 'updatedAt'],
      data.movies.history.map((item) => [item.id, item.tmdbMovieId, item.title, item.releaseYear, item.posterPath, item.watchedOn, item.note, item.createdByUserId, item.createdAt, item.updatedAt]),
    ), lastModified),
    file('csv/movie-ratings.csv', createCsv(
      ['historyId', 'tmdbMovieId', 'title', 'userId', 'displayName', 'rating'],
      movieRatings,
    ), lastModified),
    file('csv/game-history.csv', createCsv(
      ['id', 'gameId', 'gameNameSnapshot', 'playedOn', 'outcome', 'winnerUserId', 'winnerDisplayName', 'rating', 'note', 'createdByUserId', 'createdAt', 'updatedAt'],
      data.games.history.map((item) => [item.id, item.gameId, item.gameNameSnapshot, item.playedOn, item.outcome, item.winnerUserId, item.winnerDisplayName, item.rating, item.note, item.createdByUserId, item.createdAt, item.updatedAt]),
    ), lastModified),
    file('csv/songs.csv', createCsv(
      ['id', 'title', 'artist', 'spotifyUrl', 'youtubeUrl', 'whyItMatters', 'addedOn', 'createdByUserId', 'associatedMemoryId', 'artworkMediaId', 'isOurSong', 'createdAt', 'updatedAt'],
      data.soundtrack.map((item) => [item.id, item.title, item.artist, item.spotifyUrl, item.youtubeUrl, item.whyItMatters, item.addedOn, item.createdByUserId, item.associatedMemoryId, item.artworkMediaId, item.isOurSong, item.createdAt, item.updatedAt]),
    ), lastModified),
    file('csv/activity-history.csv', createCsv(
      ['id', 'activityId', 'activityNameSnapshot', 'plannedActivityId', 'completedDate', 'rating', 'notes', 'createdByUserId', 'linkedMemoryId', 'createdAt', 'updatedAt'],
      data.activities.history.map((item) => [item.id, item.activityId, item.activityNameSnapshot, item.plannedActivityId, item.completedDate, item.rating, item.notes, item.createdByUserId, item.linkedMemoryId, item.createdAt, item.updatedAt]),
    ), lastModified),
    file('csv/bucket-list.csv', createCsv(
      ['id', 'title', 'description', 'category', 'status', 'targetDate', 'location', 'priority', 'createdByUserId', 'completedByUserId', 'completedAt', 'completionRating', 'completionNote', 'linkedMemoryId', 'createdAt', 'updatedAt'],
      data.bucketList.map((item) => [item.id, item.title, item.description, item.category, item.status, item.targetDate, item.location, item.priority, item.createdByUserId, item.completedByUserId, item.completedAt, item.completionRating, item.completionNote, item.linkedMemoryId, item.createdAt, item.updatedAt]),
    ), lastModified),
    file('csv/letters.csv', createCsv(
      ['id', 'title', 'senderUserId', 'senderDisplayName', 'recipientType', 'recipientUserId', 'recipientDisplayName', 'letterType', 'statusAtSnapshot', 'contentPolicy', 'unlockAt', 'sealedAt', 'openedAt', 'firstOpenedByUserId', 'pageCount', 'createdAt', 'updatedAt'],
      data.letters.map((item) => [item.id, item.title, item.senderUserId, item.senderDisplayName, item.recipientType, item.recipientUserId, item.recipientDisplayName, item.letterType, item.statusAtSnapshot, item.contentPolicy, item.unlockAt, item.sealedAt, item.openedAt, item.firstOpenedByUserId, item.pageCount, item.createdAt, item.updatedAt]),
    ), lastModified),
  ]
}

const dataFiles = (snapshot: BackupSnapshot, lastModified: Date): ArchiveEntry[] => {
  const { data } = snapshot
  return [
    file('relationship.json', json(data.relationship), lastModified),
    file('data/profiles.json', json(collection(data.profiles)), lastModified),
    file('data/timeline.json', json(collection(data.timeline)), lastModified),
    file('data/memories.json', json(collection(data.memories)), lastModified),
    file('data/movies.json', json({ backupFormatVersion: BACKUP_FORMAT_VERSION, ...data.movies }), lastModified),
    file('data/games.json', json({ backupFormatVersion: BACKUP_FORMAT_VERSION, ...data.games }), lastModified),
    file('data/soundtrack.json', json(collection(data.soundtrack)), lastModified),
    file('data/activities.json', json({ backupFormatVersion: BACKUP_FORMAT_VERSION, ...data.activities }), lastModified),
    file('data/bucket-list.json', json(collection(data.bucketList)), lastModified),
    file('data/letters.json', json(collection(data.letters)), lastModified),
    ...csvFiles(snapshot, lastModified),
  ]
}

const createManifest = (input: {
  snapshot: BackupSnapshot
  type: BackupType
  requester: { id: string; displayName: string }
  includeMyDrafts: boolean
  progress: ArchiveProgress
  media: BackupMediaIndexV1[]
}): BackupManifestV1 => {
  const { snapshot, type, requester, includeMyDrafts, progress, media } = input
  const { data } = snapshot
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    exportType: type,
    createdAt: new Date(snapshot.snapshotAt).toISOString(),
    snapshotAt: new Date(snapshot.snapshotAt).toISOString(),
    relationshipId: data.relationship.id,
    relationshipTitle: data.relationship.title,
    createdBy: requester,
    timezone: data.relationship.timezone,
    counts: {
      profiles: data.profiles.length,
      timelineEntries: data.timeline.length,
      memories: data.memories.length,
      movieWatchlist: data.movies.watchlist.length,
      movieHistory: data.movies.history.length,
      games: data.games.catalogue.length,
      gameHistory: data.games.history.length,
      songs: data.soundtrack.length,
      activities: data.activities.catalogue.length,
      activityHistory: data.activities.history.length,
      bucketListItems: data.bucketList.length,
      letters: data.letters.length,
      mediaFiles: progress.exportedMediaFiles,
    },
    totalMediaBytes: progress.exportedMediaBytes,
    includesRequesterDrafts: includeMyDrafts,
    containsLockedLetterMetadata: data.letters.some((letter) => letter.contentPolicy === 'metadata-only'),
    containsLockedLetterContent: false,
    checksumPolicy: 'not-included',
    media,
    warnings: progress.warnings,
  }
}

export const createBackupArchive = (input: {
  env: Env
  snapshot: BackupSnapshot
  type: BackupType
  requester: { id: string; displayName: string }
  includeMyDrafts: boolean
}): { stream: ReadableStream<Uint8Array>; progress: ArchiveProgress } => {
  const progress: ArchiveProgress = { exportedMediaFiles: 0, missingMediaFiles: 0, exportedMediaBytes: 0, warnings: [] }
  const includedMedia: BackupMediaIndexV1[] = []
  const lastModified = new Date(input.snapshot.snapshotAt)

  const entries = async function* (): AsyncGenerator<ArchiveEntry> {
    yield file('README.txt', buildReadme({
      type: input.type,
      relationshipTitle: input.snapshot.data.relationship.title,
      createdAt: lastModified.toISOString(),
      includeMyDrafts: input.includeMyDrafts,
    }), lastModified)
    for (const entry of dataFiles(input.snapshot, lastModified)) yield entry

    for (const media of input.snapshot.mediaSources) {
      assertSafeArchivePath(media.archivePath)
      let object: R2ObjectBody | null = null
      let warningCode: BackupWarningV1['code'] = 'media-missing'
      try {
        object = await input.env.MEDIA.get(media.r2Key)
      } catch {
        warningCode = 'media-unavailable'
      }
      if (!object) {
        progress.missingMediaFiles += 1
        progress.warnings.push({ code: warningCode, mediaId: media.mediaId, plannedArchivePath: media.archivePath })
        includedMedia.push({ mediaId: media.mediaId, archivePath: media.archivePath, originalFilename: media.originalFilename, mimeType: media.mimeType, sizeBytes: media.sizeBytes, entityType: media.entityType, entityId: media.entityId, included: false })
        continue
      }
      yield { name: media.archivePath, input: object.body, size: Number(object.size), lastModified }
      progress.exportedMediaFiles += 1
      progress.exportedMediaBytes += media.sizeBytes
      includedMedia.push({ mediaId: media.mediaId, archivePath: media.archivePath, originalFilename: media.originalFilename, mimeType: media.mimeType, sizeBytes: media.sizeBytes, entityType: media.entityType, entityId: media.entityId, included: true })
    }

    if (progress.warnings.length > 0) {
      yield file('warnings/missing-media.json', json({ backupFormatVersion: BACKUP_FORMAT_VERSION, warnings: progress.warnings }), lastModified)
    }
    const manifest = createManifest({ ...input, progress, media: includedMedia })
    yield file('manifest.json', json(manifest), lastModified)
  }

  return { stream: makeZip(entries(), { buffersAreUTF8: true }), progress }
}
