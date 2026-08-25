import { letterMediaArchivePath, memoryMediaArchivePath, shortStableId } from './filenames'
import type {
  ActivityExclusionExportV1,
  ActivityExportV1,
  ActivityHistoryExportV1,
  BackupDataV1,
  BackupMediaSource,
  BackupSnapshot,
  BackupType,
  BucketListExportV1,
  GameExportV1,
  GameHistoryExportV1,
  LetterExportV1,
  LetterMediaExportV1,
  MemoryExportV1,
  MovieHistoryExportV1,
  MovieWatchlistExportV1,
  PlannedActivityExportV1,
  ProfileExportV1,
  RelationshipExportV1,
  SavedActivityExportV1,
  SongExportV1,
  TimelineExportV1,
} from './types'
import { BACKUP_FORMAT_VERSION } from './types'

interface RelationshipRow { id: string; title: string; start_date: string; timezone: string; partner_1_user_id: string; partner_2_user_id: string; created_at: number; updated_at: number }
interface ProfileRow { id: string; email: string; display_name: string; created_at: number; updated_at: number }
interface TimelineRow { id: string; created_by_user_id: string; title: string; description: string; event_date: string; eyebrow: string; created_at: number; updated_at: number }
interface MemoryRow { id: string; created_by_user_id: string; title: string; caption: string; location: string; memory_date: string; category: string; favorite: number; created_at: number; updated_at: number }
interface MemoryMediaRow { id: string; memory_id: string; memory_title: string; memory_date: string; r2_key: string; media_type: 'image' | 'video'; mime_type: string; size_bytes: number; width: number | null; height: number | null; duration_seconds: number | null; alt_text: string; original_filename: string; sort_order: number; created_at: number }
interface WatchlistRow { tmdb_movie_id: number; title: string; poster_path: string | null; release_year: number | null; added_by_user_id: string; created_at: number }
interface MovieHistoryRow { id: string; tmdb_movie_id: number; title: string; poster_path: string | null; release_year: number | null; watched_on: string; note: string; created_by_user_id: string; created_at: number; updated_at: number }
interface MovieRatingRow { history_id: string; user_id: string; display_name: string; rating_half_steps: number }
interface GameRow { id: string; created_by_user_id: string | null; name: string; category: string; player_count: string; duration: string; notes: string; built_in: number; created_at: number; updated_at: number }
interface GameHistoryRow { id: string; game_id: string; game_name: string; played_on: string; outcome: string; winner_user_id: string | null; winner_display_name: string | null; rating_half_steps: number; note: string; created_by_user_id: string; created_at: number; updated_at: number }
interface SongRow { id: string; created_by_user_id: string; title: string; artist: string; spotify_url: string | null; youtube_url: string | null; why_it_matters: string; added_on: string; associated_memory_id: string | null; artwork_media_id: string | null; is_our_song: number; created_at: number; updated_at: number }
interface ActivityRow { id: string; created_by_user_id: string | null; name: string; description: string; category: string; location_type: string; budget_level: string; energy_level: string; duration_category: string; notes: string; is_builtin: number; is_active: number; created_at: number; updated_at: number }
interface ActivityExclusionRow { activity_id: string; created_by_user_id: string; created_at: number }
interface SavedActivityRow { activity_id: string; saved_by_user_id: string; created_at: number }
interface PlannedActivityRow { id: string; activity_id: string; planned_date: string; planned_time: string | null; note: string; status: string; created_by_user_id: string; created_at: number; updated_at: number }
interface ActivityHistoryRow { id: string; activity_id: string; activity_name: string; planned_activity_id: string | null; completed_date: string; rating_half_steps: number | null; notes: string; created_by_user_id: string; linked_memory_id: string | null; created_at: number; updated_at: number }
interface BucketRow { id: string; created_by_user_id: string; completed_by_user_id: string | null; title: string; description: string; category: string; status: string; target_date: string | null; location: string; priority: string | null; completed_at: string | null; completion_rating_half_steps: number | null; completion_note: string; linked_memory_id: string | null; created_at: number; updated_at: number }
interface LetterRow { id: string; created_by_user_id: string; sender_display_name: string; recipient_type: 'user' | 'both' | null; recipient_user_id: string | null; recipient_display_name: string | null; title: string; letter_type: 'typed' | 'uploaded'; exportable_typed_content: string | null; teaser: string; status: 'draft' | 'sealed' | 'opened'; unlock_at: number | null; sealed_at: number | null; opened_at: number | null; first_opened_by_user_id: string | null; page_count: number; created_at: number; updated_at: number }
interface LetterMediaRow { id: string; future_letter_id: string; letter_title: string; media_role: 'page' | 'cover'; r2_key: string; original_filename: string; mime_type: string; size_bytes: number; width: number | null; height: number | null; alt_text: string; sort_order: number; created_at: number }

type DatabaseRow = RelationshipRow | ProfileRow | TimelineRow | MemoryRow | MemoryMediaRow | WatchlistRow
  | MovieHistoryRow | MovieRatingRow | GameRow | GameHistoryRow | SongRow | ActivityRow
  | ActivityExclusionRow | SavedActivityRow | PlannedActivityRow | ActivityHistoryRow | BucketRow
  | LetterRow | LetterMediaRow

const isoTimestamp = (value: number | null): string | null => value === null ? null : new Date(Number(value)).toISOString()
const halfSteps = (value: number): number => Number(value) / 2
const rows = <T extends DatabaseRow>(result: D1Result<DatabaseRow> | undefined): T[] => {
  if (!result) throw new Error('The backup snapshot query returned an incomplete result set.')
  return result.results as T[]
}

const uniqueArchivePath = (candidate: string, mediaId: string, used: Set<string>): string => {
  if (!used.has(candidate)) {
    used.add(candidate)
    return candidate
  }
  const dot = candidate.lastIndexOf('.')
  const suffix = `-${shortStableId(mediaId)}`
  const resolved = dot > candidate.lastIndexOf('/') ? `${candidate.slice(0, dot)}${suffix}${candidate.slice(dot)}` : `${candidate}${suffix}`
  used.add(resolved)
  return resolved
}

const indexBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const result = new Map<string, T[]>()
  for (const item of items) {
    const value = key(item)
    result.set(value, [...(result.get(value) ?? []), item])
  }
  return result
}

export const createBackupSnapshot = async (input: {
  env: Env
  relationshipId: string
  requesterUserId: string
  backupType: BackupType
  includeMyDrafts: boolean
  snapshotAt: number
}): Promise<BackupSnapshot> => {
  const { env, relationshipId, requesterUserId, backupType, includeMyDrafts, snapshotAt } = input
  const includeDraftFlag = includeMyDrafts ? 1 : 0
  const result = await env.DB.batch<DatabaseRow>([
    env.DB.prepare(`SELECT id, title, start_date, timezone, partner_1_user_id, partner_2_user_id, created_at, updated_at FROM relationships WHERE id = ?`).bind(relationshipId),
    env.DB.prepare(`SELECT u.id, u.email, u.display_name, u.created_at, u.updated_at FROM relationships r JOIN users u ON u.id IN (r.partner_1_user_id, r.partner_2_user_id) WHERE r.id = ? ORDER BY CASE WHEN u.id = r.partner_1_user_id THEN 0 ELSE 1 END`).bind(relationshipId),
    env.DB.prepare(`SELECT id, created_by_user_id, title, description, event_date, eyebrow, created_at, updated_at FROM timeline_entries WHERE relationship_id = ? ORDER BY event_date, id`).bind(relationshipId),
    env.DB.prepare(`SELECT id, created_by_user_id, title, caption, location, memory_date, category, favorite, created_at, updated_at FROM memories WHERE relationship_id = ? ORDER BY memory_date, id`).bind(relationshipId),
    env.DB.prepare(`SELECT mm.id, mm.memory_id, m.title AS memory_title, m.memory_date, mm.r2_key, mm.media_type, mm.mime_type, mm.size_bytes, mm.width, mm.height, mm.duration_seconds, mm.alt_text, mm.original_filename, mm.sort_order, mm.created_at FROM memory_media mm JOIN memories m ON m.id = mm.memory_id WHERE m.relationship_id = ? ORDER BY m.memory_date, m.id, mm.sort_order, mm.created_at, mm.id`).bind(relationshipId),
    env.DB.prepare(`SELECT tmdb_movie_id, title, poster_path, release_year, added_by_user_id, created_at FROM movie_watchlist WHERE relationship_id = ? ORDER BY created_at, tmdb_movie_id`).bind(relationshipId),
    env.DB.prepare(`SELECT id, tmdb_movie_id, title, poster_path, release_year, watched_on, note, created_by_user_id, created_at, updated_at FROM movie_history WHERE relationship_id = ? ORDER BY watched_on, created_at, id`).bind(relationshipId),
    env.DB.prepare(`SELECT r.history_id, r.user_id, u.display_name, r.rating_half_steps FROM movie_history_ratings r JOIN movie_history h ON h.id = r.history_id JOIN users u ON u.id = r.user_id WHERE h.relationship_id = ? ORDER BY r.history_id, r.user_id`).bind(relationshipId),
    env.DB.prepare(`SELECT g.id, g.created_by_user_id, g.name, g.category, g.player_count, g.duration, g.notes, g.built_in, g.created_at, g.updated_at FROM games g WHERE g.relationship_id = ? OR (g.built_in = 1 AND EXISTS (SELECT 1 FROM game_history gh WHERE gh.relationship_id = ? AND gh.game_id = g.id)) ORDER BY g.built_in, g.name, g.id`).bind(relationshipId, relationshipId),
    env.DB.prepare(`SELECT gh.id, gh.game_id, g.name AS game_name, gh.played_on, gh.outcome, gh.winner_user_id, winner.display_name AS winner_display_name, gh.rating_half_steps, gh.note, gh.created_by_user_id, gh.created_at, gh.updated_at FROM game_history gh JOIN games g ON g.id = gh.game_id LEFT JOIN users winner ON winner.id = gh.winner_user_id WHERE gh.relationship_id = ? ORDER BY gh.played_on, gh.created_at, gh.id`).bind(relationshipId),
    env.DB.prepare(`SELECT id, created_by_user_id, title, artist, spotify_url, youtube_url, why_it_matters, added_on, associated_memory_id, artwork_media_id, is_our_song, created_at, updated_at FROM songs WHERE relationship_id = ? ORDER BY added_on, created_at, id`).bind(relationshipId),
    env.DB.prepare(`SELECT a.id, a.created_by_user_id, a.name, a.description, a.category, a.location_type, a.budget_level, a.energy_level, a.duration_category, a.notes, a.is_builtin, a.is_active, a.created_at, a.updated_at FROM activities a WHERE a.relationship_id = ? OR (a.is_builtin = 1 AND (EXISTS (SELECT 1 FROM saved_activities s WHERE s.relationship_id = ? AND s.activity_id = a.id) OR EXISTS (SELECT 1 FROM planned_activities p WHERE p.relationship_id = ? AND p.activity_id = a.id) OR EXISTS (SELECT 1 FROM activity_history h WHERE h.relationship_id = ? AND h.activity_id = a.id) OR EXISTS (SELECT 1 FROM activity_exclusions e WHERE e.relationship_id = ? AND e.activity_id = a.id))) ORDER BY a.is_builtin, a.name, a.id`).bind(relationshipId, relationshipId, relationshipId, relationshipId, relationshipId),
    env.DB.prepare(`SELECT activity_id, created_by_user_id, created_at FROM activity_exclusions WHERE relationship_id = ? ORDER BY created_at, activity_id`).bind(relationshipId),
    env.DB.prepare(`SELECT activity_id, saved_by_user_id, created_at FROM saved_activities WHERE relationship_id = ? ORDER BY created_at, activity_id`).bind(relationshipId),
    env.DB.prepare(`SELECT id, activity_id, planned_date, planned_time, note, status, created_by_user_id, created_at, updated_at FROM planned_activities WHERE relationship_id = ? ORDER BY planned_date, planned_time, id`).bind(relationshipId),
    env.DB.prepare(`SELECT h.id, h.activity_id, a.name AS activity_name, h.planned_activity_id, h.completed_date, h.rating_half_steps, h.notes, h.created_by_user_id, h.linked_memory_id, h.created_at, h.updated_at FROM activity_history h JOIN activities a ON a.id = h.activity_id WHERE h.relationship_id = ? ORDER BY h.completed_date, h.created_at, h.id`).bind(relationshipId),
    env.DB.prepare(`SELECT id, created_by_user_id, completed_by_user_id, title, description, category, status, target_date, location, priority, completed_at, completion_rating_half_steps, completion_note, linked_memory_id, created_at, updated_at FROM bucket_list_items WHERE relationship_id = ? ORDER BY created_at, id`).bind(relationshipId),
    env.DB.prepare(`SELECT fl.id, fl.created_by_user_id, sender.display_name AS sender_display_name, fl.recipient_type, fl.recipient_user_id, recipient.display_name AS recipient_display_name, fl.title, fl.letter_type, CASE WHEN fl.status = 'opened' OR (fl.status = 'draft' AND fl.created_by_user_id = ? AND ? = 1) THEN fl.typed_content ELSE NULL END AS exportable_typed_content, fl.teaser, fl.status, fl.unlock_at, fl.sealed_at, fl.opened_at, fl.first_opened_by_user_id, (SELECT COUNT(*) FROM future_letter_media fm WHERE fm.future_letter_id = fl.id AND fm.media_role = 'page') AS page_count, fl.created_at, fl.updated_at FROM future_letters fl JOIN users sender ON sender.id = fl.created_by_user_id LEFT JOIN users recipient ON recipient.id = fl.recipient_user_id WHERE fl.relationship_id = ? AND (fl.status <> 'draft' OR (fl.created_by_user_id = ? AND ? = 1)) ORDER BY fl.created_at, fl.id`).bind(requesterUserId, includeDraftFlag, relationshipId, requesterUserId, includeDraftFlag),
    env.DB.prepare(`SELECT fm.id, fm.future_letter_id, fl.title AS letter_title, fm.media_role, fm.r2_key, fm.original_filename, fm.mime_type, fm.size_bytes, fm.width, fm.height, fm.alt_text, fm.sort_order, fm.created_at FROM future_letter_media fm JOIN future_letters fl ON fl.id = fm.future_letter_id AND fl.relationship_id = fm.relationship_id WHERE fm.relationship_id = ? AND (fl.status = 'opened' OR (fl.status = 'draft' AND fl.created_by_user_id = ? AND ? = 1)) ORDER BY fl.created_at, fl.id, fm.media_role, fm.sort_order, fm.created_at, fm.id`).bind(relationshipId, requesterUserId, includeDraftFlag),
  ])

  const relationshipRow = rows<RelationshipRow>(result[0])[0]
  if (!relationshipRow) throw new Error('The relationship could not be found for backup.')
  const profileRows = rows<ProfileRow>(result[1])
  const profileNames = new Map(profileRows.map((profile) => [profile.id, profile.display_name]))
  const memoryRows = rows<MemoryRow>(result[3])
  const mediaRows = rows<MemoryMediaRow>(result[4])
  const activityHistoryRows = rows<ActivityHistoryRow>(result[15])
  const bucketRows = rows<BucketRow>(result[16])
  const usedPaths = new Set<string>()
  const mediaSources: BackupMediaSource[] = []

  const memoryMedia = indexBy(mediaRows, (media) => media.memory_id)
  const activityLinks = indexBy(activityHistoryRows.filter((item) => item.linked_memory_id !== null), (item) => item.linked_memory_id ?? '')
  const bucketLinks = indexBy(bucketRows.filter((item) => item.linked_memory_id !== null), (item) => item.linked_memory_id ?? '')
  const memories: MemoryExportV1[] = memoryRows.map((memory) => ({
    id: memory.id,
    title: memory.title,
    caption: memory.caption,
    location: memory.location,
    date: memory.memory_date,
    category: memory.category,
    favorite: Boolean(memory.favorite),
    createdByUserId: memory.created_by_user_id,
    createdAt: isoTimestamp(memory.created_at) ?? '',
    updatedAt: isoTimestamp(memory.updated_at) ?? '',
    linkedActivityHistoryIds: (activityLinks.get(memory.id) ?? []).map((item) => item.id),
    linkedBucketListItemIds: (bucketLinks.get(memory.id) ?? []).map((item) => item.id),
    media: (memoryMedia.get(memory.id) ?? []).map((media) => {
      const candidate = memoryMediaArchivePath({
        memoryId: memory.id,
        memoryDate: memory.memory_date,
        memoryTitle: memory.title,
        mediaType: media.media_type,
        mimeType: media.mime_type,
        sortOrder: Number(media.sort_order),
      })
      const archivePath = uniqueArchivePath(candidate, media.id, usedPaths)
      if (backupType === 'full') {
        mediaSources.push({ mediaId: media.id, r2Key: media.r2_key, archivePath, originalFilename: media.original_filename, mimeType: media.mime_type, sizeBytes: Number(media.size_bytes), entityType: 'memory', entityId: memory.id })
      }
      return {
        id: media.id,
        type: media.media_type,
        mimeType: media.mime_type,
        sizeBytes: Number(media.size_bytes),
        width: media.width === null ? null : Number(media.width),
        height: media.height === null ? null : Number(media.height),
        durationSeconds: media.duration_seconds === null ? null : Number(media.duration_seconds),
        altText: media.alt_text,
        originalFilename: media.original_filename,
        sortOrder: Number(media.sort_order),
        createdAt: isoTimestamp(media.created_at) ?? '',
        archivePath: backupType === 'full' ? archivePath : null,
      }
    }),
  }))

  const ratingRows = rows<MovieRatingRow>(result[7])
  const ratings = indexBy(ratingRows, (rating) => rating.history_id)
  const movieHistory: MovieHistoryExportV1[] = rows<MovieHistoryRow>(result[6]).map((movie) => ({
    id: movie.id, tmdbMovieId: Number(movie.tmdb_movie_id), title: movie.title, posterPath: movie.poster_path,
    releaseYear: movie.release_year === null ? null : Number(movie.release_year), watchedOn: movie.watched_on,
    note: movie.note, createdByUserId: movie.created_by_user_id,
    ratings: (ratings.get(movie.id) ?? []).map((rating) => ({ userId: rating.user_id, displayName: rating.display_name, rating: halfSteps(rating.rating_half_steps) })),
    createdAt: isoTimestamp(movie.created_at) ?? '', updatedAt: isoTimestamp(movie.updated_at) ?? '',
  }))
  const watchlist: MovieWatchlistExportV1[] = rows<WatchlistRow>(result[5]).map((movie) => ({
    tmdbMovieId: Number(movie.tmdb_movie_id), title: movie.title, posterPath: movie.poster_path,
    releaseYear: movie.release_year === null ? null : Number(movie.release_year), addedByUserId: movie.added_by_user_id,
    addedAt: isoTimestamp(movie.created_at) ?? '',
  }))

  const games: GameExportV1[] = rows<GameRow>(result[8]).map((game) => ({
    id: game.id, name: game.name, category: game.category, playerCount: game.player_count, duration: game.duration,
    notes: game.notes, builtIn: Boolean(game.built_in), createdByUserId: game.created_by_user_id,
    createdAt: isoTimestamp(game.created_at) ?? '', updatedAt: isoTimestamp(game.updated_at) ?? '',
  }))
  const gameHistory: GameHistoryExportV1[] = rows<GameHistoryRow>(result[9]).map((game) => ({
    id: game.id, gameId: game.game_id, gameNameSnapshot: game.game_name, playedOn: game.played_on,
    outcome: game.outcome, winnerUserId: game.winner_user_id, winnerDisplayName: game.winner_display_name,
    rating: halfSteps(game.rating_half_steps), note: game.note, createdByUserId: game.created_by_user_id,
    createdAt: isoTimestamp(game.created_at) ?? '', updatedAt: isoTimestamp(game.updated_at) ?? '',
  }))

  const songs: SongExportV1[] = rows<SongRow>(result[10]).map((song) => ({
    id: song.id, title: song.title, artist: song.artist, spotifyUrl: song.spotify_url, youtubeUrl: song.youtube_url,
    whyItMatters: song.why_it_matters, addedOn: song.added_on, createdByUserId: song.created_by_user_id,
    associatedMemoryId: song.associated_memory_id, artworkMediaId: song.artwork_media_id,
    isOurSong: Boolean(song.is_our_song), createdAt: isoTimestamp(song.created_at) ?? '', updatedAt: isoTimestamp(song.updated_at) ?? '',
  }))

  const activities: ActivityExportV1[] = rows<ActivityRow>(result[11]).map((activity) => ({
    id: activity.id, name: activity.name, description: activity.description, category: activity.category,
    locationType: activity.location_type, budgetLevel: activity.budget_level, energyLevel: activity.energy_level,
    durationCategory: activity.duration_category, notes: activity.notes, builtIn: Boolean(activity.is_builtin),
    active: Boolean(activity.is_active), createdByUserId: activity.created_by_user_id,
    createdAt: isoTimestamp(activity.created_at) ?? '', updatedAt: isoTimestamp(activity.updated_at) ?? '',
  }))
  const exclusions: ActivityExclusionExportV1[] = rows<ActivityExclusionRow>(result[12]).map((item) => ({ activityId: item.activity_id, createdByUserId: item.created_by_user_id, createdAt: isoTimestamp(item.created_at) ?? '' }))
  const saved: SavedActivityExportV1[] = rows<SavedActivityRow>(result[13]).map((item) => ({ activityId: item.activity_id, savedByUserId: item.saved_by_user_id, createdAt: isoTimestamp(item.created_at) ?? '' }))
  const planned: PlannedActivityExportV1[] = rows<PlannedActivityRow>(result[14]).map((item) => ({
    id: item.id, activityId: item.activity_id, plannedDate: item.planned_date, plannedTime: item.planned_time,
    note: item.note, status: item.status, createdByUserId: item.created_by_user_id,
    createdAt: isoTimestamp(item.created_at) ?? '', updatedAt: isoTimestamp(item.updated_at) ?? '',
  }))
  const activityHistory: ActivityHistoryExportV1[] = activityHistoryRows.map((item) => ({
    id: item.id, activityId: item.activity_id, activityNameSnapshot: item.activity_name,
    plannedActivityId: item.planned_activity_id, completedDate: item.completed_date,
    rating: item.rating_half_steps === null ? null : halfSteps(item.rating_half_steps), notes: item.notes,
    createdByUserId: item.created_by_user_id, linkedMemoryId: item.linked_memory_id,
    createdAt: isoTimestamp(item.created_at) ?? '', updatedAt: isoTimestamp(item.updated_at) ?? '',
  }))
  const bucketList: BucketListExportV1[] = bucketRows.map((item) => ({
    id: item.id, title: item.title, description: item.description, category: item.category, status: item.status,
    targetDate: item.target_date, location: item.location, priority: item.priority,
    createdByUserId: item.created_by_user_id, completedByUserId: item.completed_by_user_id,
    completedAt: item.completed_at, completionRating: item.completion_rating_half_steps === null ? null : halfSteps(item.completion_rating_half_steps),
    completionNote: item.completion_note, linkedMemoryId: item.linked_memory_id,
    createdAt: isoTimestamp(item.created_at) ?? '', updatedAt: isoTimestamp(item.updated_at) ?? '',
  }))

  const letterMediaRows = rows<LetterMediaRow>(result[18])
  const letterMedia = indexBy(letterMediaRows, (media) => media.future_letter_id)
  const letters: LetterExportV1[] = rows<LetterRow>(result[17]).map((letter) => {
    const isDraft = letter.status === 'draft'
    const isOpened = letter.status === 'opened'
    const statusAtSnapshot = isDraft ? 'draft' : isOpened ? 'opened' : Number(letter.unlock_at) <= snapshotAt ? 'ready-unopened' : 'sealed-locked'
    const contentPolicy = isDraft ? 'requester-draft-included' : isOpened ? 'opened-content-included' : 'metadata-only'
    const eligibleMedia: LetterMediaExportV1[] = (letterMedia.get(letter.id) ?? []).map((media) => {
      const candidate = letterMediaArchivePath({ letterId: letter.id, letterTitle: letter.title, role: media.media_role, mimeType: media.mime_type, sortOrder: Number(media.sort_order) })
      const archivePath = uniqueArchivePath(candidate, media.id, usedPaths)
      if (backupType === 'full') {
        mediaSources.push({ mediaId: media.id, r2Key: media.r2_key, archivePath, originalFilename: media.original_filename, mimeType: media.mime_type, sizeBytes: Number(media.size_bytes), entityType: 'letter', entityId: letter.id })
      }
      return { id: media.id, role: media.media_role, mimeType: media.mime_type, sizeBytes: Number(media.size_bytes), width: media.width === null ? null : Number(media.width), height: media.height === null ? null : Number(media.height), altText: media.alt_text, originalFilename: media.original_filename, sortOrder: Number(media.sort_order), createdAt: isoTimestamp(media.created_at) ?? '', archivePath: backupType === 'full' ? archivePath : null }
    })
    return {
      id: letter.id, title: letter.title, senderUserId: letter.created_by_user_id, senderDisplayName: letter.sender_display_name,
      recipientType: letter.recipient_type, recipientUserId: letter.recipient_user_id,
      recipientDisplayName: letter.recipient_type === 'both' ? 'Both partners' : letter.recipient_display_name,
      letterType: letter.letter_type, teaser: letter.teaser, statusAtSnapshot, contentPolicy,
      unlockAt: isoTimestamp(letter.unlock_at), sealedAt: isoTimestamp(letter.sealed_at), openedAt: isoTimestamp(letter.opened_at),
      firstOpenedByUserId: letter.first_opened_by_user_id, pageCount: Number(letter.page_count),
      ...(contentPolicy !== 'metadata-only' && letter.letter_type === 'typed' ? { typedContent: letter.exportable_typed_content ?? '' } : {}),
      ...(contentPolicy !== 'metadata-only' ? { media: eligibleMedia } : {}),
      createdAt: isoTimestamp(letter.created_at) ?? '', updatedAt: isoTimestamp(letter.updated_at) ?? '',
    }
  })

  const relationship: RelationshipExportV1 = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    id: relationshipRow.id,
    title: relationshipRow.title,
    startDate: relationshipRow.start_date,
    timezone: relationshipRow.timezone,
    partnerUserIds: [relationshipRow.partner_1_user_id, relationshipRow.partner_2_user_id],
    createdAt: isoTimestamp(relationshipRow.created_at) ?? '',
    updatedAt: isoTimestamp(relationshipRow.updated_at) ?? '',
  }
  const profiles: ProfileExportV1[] = profileRows.map((profile) => ({ id: profile.id, displayName: profile.display_name, email: profile.email, createdAt: isoTimestamp(profile.created_at) ?? '', updatedAt: isoTimestamp(profile.updated_at) ?? '' }))
  const timeline: TimelineExportV1[] = rows<TimelineRow>(result[2]).map((item) => ({ id: item.id, createdByUserId: item.created_by_user_id, title: item.title, description: item.description, date: item.event_date, eyebrow: item.eyebrow, createdAt: isoTimestamp(item.created_at) ?? '', updatedAt: isoTimestamp(item.updated_at) ?? '' }))
  const data: BackupDataV1 = {
    relationship,
    profiles,
    timeline,
    memories,
    movies: { watchlist, history: movieHistory },
    games: { catalogue: games, history: gameHistory },
    soundtrack: songs,
    activities: { catalogue: activities, exclusions, saved, planned, history: activityHistory },
    bucketList,
    letters,
  }
  if (!profileNames.has(requesterUserId)) throw new Error('The backup requester is not a relationship member.')
  return { snapshotAt, data, mediaSources }
}
