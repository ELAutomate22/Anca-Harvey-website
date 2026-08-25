import { requireSession, type AuthSession } from '../auth/session'
import { ApiError, apiSuccess } from '../lib/http'
import {
  addCalendarDays,
  MAX_RELATIONSHIP_YEAR,
  completedRelationshipYears,
  dateInTimeZone,
  relationshipAgeLabelOn,
  relationshipAnniversaryDate,
  relationshipYearNumberOn,
  relationshipYearState,
  startOfDateInTimeZone,
} from '../../../src/lib/relationship-years'
import type {
  RecapActivityHighlight,
  RecapBucketHighlight,
  RecapComparison,
  RecapGameHighlight,
  RecapIndexResponse,
  RecapMediaPreview,
  RecapMemoryHighlight,
  RecapMilestone,
  RecapMovieHighlight,
  RecapOpenedLetterHighlight,
  RecapProfile,
  RecapRelationship,
  RecapSongHighlight,
  RecapYearResponse,
  RecapYearSummary,
  ThisDayItem,
  ThisDayResponse,
} from '../../../src/features/recap/types'

interface ProfileRow { id: string; display_name: string }
interface CountRow { count: number | null }
interface MemoryStatsRow { count: number; photo_count: number; video_count: number; favorite_count: number }
interface MemoryHighlightRow {
  id: string; title: string; caption: string; memory_date: string; category: string; favorite: number
  media_count: number; preview_media_id: string | null; preview_media_type: 'image' | 'video' | null
  preview_alt: string | null
}
interface MilestoneRow { title: string; description: string; event_date: string; eyebrow: string }
interface MovieTotalsRow { watch_count: number; unique_count: number; rated_watch_count: number }
interface MovieHighlightRow {
  tmdb_movie_id: number; title: string; poster_path: string | null; watch_count: number
  average_rating: number | null
}
interface MovieDisagreementRow { title: string; watched_on: string; difference: number }
interface GameTotalsRow { play_count: number; draws: number; cooperative_wins: number; no_winner_count: number }
interface PartnerWinRow { winner_user_id: string; wins: number }
interface GameHighlightRow {
  game_id: string; name: string; category: string; play_count: number; average_rating: number
}
interface SongRow {
  title: string; artist: string; why_it_matters: string; added_on: string
  spotify_url: string | null; youtube_url: string | null; is_our_song: number; artwork_media_id: string | null
  total_count: number
}
interface ActivityTotalsRow {
  completed_count: number; average_rating: number | null; repeated_count: number
  indoor_count: number; outdoor_count: number; free_count: number; adventurous_count: number
}
interface CategoryCountRow { category: string; count: number }
interface ActivityHighlightRow {
  name: string; category: string; completed_date: string; rating_half_steps: number | null
  linked_memory_id: string | null; memory_media_id: string | null; memory_alt: string | null
}
interface BucketTotalsRow { added_count: number; completed_count: number }
interface BucketHighlightRow {
  title: string; category: string; created_at: number; completed_at: string | null
  linked_memory_id: string | null; memory_media_id: string | null; memory_alt: string | null
}
interface LetterTotalsRow { opened_count: number; typed_count: number; uploaded_count: number; longest_wait_days: number | null }
interface LetterHighlightRow {
  title: string; letter_type: 'typed' | 'uploaded'; sender_name: string; recipient_name: string | null
  recipient_type: 'user' | 'both'; opened_at: number; sealed_at: number
}
type ThisDayMemoryRow = MemoryHighlightRow
interface ThisDayEntryRow { title: string; detail: string; event_date: string }

const yearWords = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'] as const
const yearLabel = (yearNumber: number): string =>
  `Year ${yearWords[yearNumber] ?? String(yearNumber)}`

const rows = <T>(result: D1Result<unknown> | undefined): T[] =>
  (result?.results ?? []) as T[]

const first = <T>(result: D1Result<unknown> | undefined): T | null => rows<T>(result)[0] ?? null

const toYearSummary = (startDate: string, yearNumber: number, serverDate: string): RecapYearSummary => ({
  ...relationshipYearState(startDate, yearNumber, serverDate),
  label: yearLabel(yearNumber),
})

const loadProfiles = async (env: Env, session: AuthSession): Promise<RecapProfile[]> => {
  const result = await env.DB.prepare(`
    SELECT id, display_name FROM users
    WHERE id IN (?, ?) AND active = 1
    ORDER BY CASE id WHEN ? THEN 0 ELSE 1 END
  `).bind(
    session.relationship.partner1UserId,
    session.relationship.partner2UserId,
    session.relationship.partner1UserId,
  ).all<ProfileRow>()
  return result.results.map((profile) => ({ id: profile.id, displayName: profile.display_name }))
}

const relationshipResponse = (session: AuthSession, profiles: RecapProfile[]): RecapRelationship => ({
  title: session.relationship.title,
  startDate: session.relationship.startDate,
  timeZone: session.relationship.timezone,
  profiles,
})

const timestampBounds = (startDate: string, endExclusiveDate: string, timeZone: string): [number, number] => [
  startOfDateInTimeZone(startDate, timeZone),
  startOfDateInTimeZone(endExclusiveDate, timeZone),
]

const metricStatements = (env: Env, relationshipId: string, start: string, endExclusive: string, startMs: number, endMs: number): D1PreparedStatement[] => [
  env.DB.prepare('SELECT COUNT(*) AS count FROM memories WHERE relationship_id = ? AND memory_date >= ? AND memory_date < ?').bind(relationshipId, start, endExclusive),
  env.DB.prepare('SELECT COUNT(*) AS count FROM movie_history WHERE relationship_id = ? AND watched_on >= ? AND watched_on < ?').bind(relationshipId, start, endExclusive),
  env.DB.prepare('SELECT COUNT(*) AS count FROM game_history WHERE relationship_id = ? AND played_on >= ? AND played_on < ?').bind(relationshipId, start, endExclusive),
  env.DB.prepare('SELECT COUNT(*) AS count FROM activity_history WHERE relationship_id = ? AND completed_date >= ? AND completed_date < ?').bind(relationshipId, start, endExclusive),
  env.DB.prepare("SELECT COUNT(*) AS count FROM bucket_list_items WHERE relationship_id = ? AND status = 'completed' AND completed_at >= ? AND completed_at < ?").bind(relationshipId, start, endExclusive),
  env.DB.prepare("SELECT COUNT(*) AS count FROM future_letters WHERE relationship_id = ? AND status = 'opened' AND opened_at >= ? AND opened_at < ?").bind(relationshipId, startMs, endMs),
]

const comparisonFor = async (
  env: Env,
  session: AuthSession,
  completedYears: number,
): Promise<RecapComparison | null> => {
  if (completedYears < 2) return null
  const earlierYear = completedYears - 1
  const laterYear = completedYears
  const earlier = relationshipYearState(session.relationship.startDate, earlierYear, '9999-12-31')
  const later = relationshipYearState(session.relationship.startDate, laterYear, '9999-12-31')
  const earlierMs = timestampBounds(earlier.startDate, earlier.endExclusiveDate, session.relationship.timezone)
  const laterMs = timestampBounds(later.startDate, later.endExclusiveDate, session.relationship.timezone)
  const result = await env.DB.batch([
    ...metricStatements(env, session.relationship.id, earlier.startDate, earlier.endExclusiveDate, ...earlierMs),
    ...metricStatements(env, session.relationship.id, later.startDate, later.endExclusiveDate, ...laterMs),
  ])
  const values = result.map((item) => Number(first<CountRow>(item)?.count ?? 0))
  const labels = [
    ['memories', 'Memories'], ['movies', 'Films watched'], ['games', 'Games played'],
    ['activities', 'Dates completed'], ['bucket', 'Dreams completed'], ['letters', 'Letters opened'],
  ] as const
  return {
    earlierYear,
    laterYear,
    metrics: labels.map(([key, label], index) => ({
      key,
      label,
      earlier: values[index] ?? 0,
      later: values[index + labels.length] ?? 0,
    })),
  }
}

export const recapIndex = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const serverDate = dateInTimeZone(Date.now(), session.relationship.timezone)
  const completedCount = completedRelationshipYears(session.relationship.startDate, serverDate)
  const currentYearNumber = relationshipYearNumberOn(session.relationship.startDate, serverDate) ?? 1
  const [profiles, comparison] = await Promise.all([
    loadProfiles(env, session),
    comparisonFor(env, session, completedCount),
  ])
  const completedYears = Array.from({ length: completedCount }, (_, index) =>
    toYearSummary(session.relationship.startDate, index + 1, serverDate)).reverse()
  const anniversaryDate = completedCount > 0
    ? relationshipAnniversaryDate(session.relationship.startDate, completedCount)
    : null
  const response: RecapIndexResponse = {
    relationship: relationshipResponse(session, profiles),
    serverDate,
    currentYear: toYearSummary(session.relationship.startDate, currentYearNumber, serverDate),
    completedYears,
    comparison,
    anniversary: {
      isToday: anniversaryDate === serverDate,
      completedYearNumber: anniversaryDate === serverDate ? completedCount : null,
    },
  }
  return apiSuccess(response)
}

const memoryPreview = (id: string | null, type: 'image' | 'video' | null, alt: string | null): RecapMediaPreview | null =>
  id && type ? { type, url: `/api/media/${encodeURIComponent(id)}`, alt: alt ?? '' } : null

const imagePreview = (id: string | null, alt: string | null): RecapMediaPreview | null =>
  id ? { type: 'image', url: `/api/media/${encodeURIComponent(id)}`, alt: alt ?? '' } : null

const mapMovieHighlight = (row: MovieHighlightRow): RecapMovieHighlight => ({
  tmdbMovieId: Number(row.tmdb_movie_id),
  title: row.title,
  posterPath: row.poster_path,
  watchCount: Number(row.watch_count),
  averageRating: row.average_rating === null ? null : Number(row.average_rating),
})

const mapGameHighlight = (row: GameHighlightRow): RecapGameHighlight => ({
  gameId: row.game_id,
  name: row.name,
  category: row.category,
  playCount: Number(row.play_count),
  averageRating: Number(row.average_rating),
})

const mapSong = (row: SongRow): RecapSongHighlight => ({
  title: row.title,
  artist: row.artist,
  whyItMatters: row.why_it_matters,
  addedOn: row.added_on,
  spotifyUrl: row.spotify_url,
  youtubeUrl: row.youtube_url,
  isOurSong: Boolean(row.is_our_song),
  artworkUrl: row.artwork_media_id ? `/api/media/${encodeURIComponent(row.artwork_media_id)}` : null,
})

const validateRequestedYear = (value: string): number => {
  if (!/^\d{1,3}$/u.test(value)) throw new ApiError(400, 'INVALID_RELATIONSHIP_YEAR', 'Choose a valid relationship year.')
  const year = Number(value)
  if (!Number.isInteger(year) || year < 1 || year > MAX_RELATIONSHIP_YEAR) {
    throw new ApiError(400, 'INVALID_RELATIONSHIP_YEAR', `Relationship year must be between 1 and ${MAX_RELATIONSHIP_YEAR}.`)
  }
  return year
}

export const recapCurrentYear = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const serverDate = dateInTimeZone(Date.now(), session.relationship.timezone)
  const currentYear = relationshipYearNumberOn(session.relationship.startDate, serverDate) ?? 1
  return recapYearForSession(env, session, currentYear, serverDate)
}

export const recapYear = async (request: Request, env: Env, yearValue: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const serverDate = dateInTimeZone(Date.now(), session.relationship.timezone)
  return recapYearForSession(env, session, validateRequestedYear(yearValue), serverDate)
}

const recapYearForSession = async (
  env: Env,
  session: AuthSession,
  yearNumber: number,
  serverDate: string,
): Promise<Response> => {
  const currentYear = relationshipYearNumberOn(session.relationship.startDate, serverDate) ?? 1
  if (yearNumber > currentYear) {
    throw new ApiError(404, 'RECAP_YEAR_NOT_AVAILABLE', 'That chapter has not begun yet.')
  }
  const yearSummary = toYearSummary(session.relationship.startDate, yearNumber, serverDate)
  const year = {
    ...yearSummary,
    endExclusiveDate: yearSummary.current
      ? addCalendarDays(serverDate, 1)
      : yearSummary.endExclusiveDate,
  }
  const [startMs, endMs] = timestampBounds(year.startDate, year.endExclusiveDate, session.relationship.timezone)
  const relationshipId = session.relationship.id
  const results = await env.DB.batch([
    env.DB.prepare(`
      WITH media_counts AS (
        SELECT memory_id,
          SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END) AS photos,
          SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) AS videos
        FROM memory_media GROUP BY memory_id
      )
      SELECT COUNT(*) AS count, COALESCE(SUM(mc.photos), 0) AS photo_count,
        COALESCE(SUM(mc.videos), 0) AS video_count,
        COALESCE(SUM(CASE WHEN m.favorite = 1 THEN 1 ELSE 0 END), 0) AS favorite_count
      FROM memories m LEFT JOIN media_counts mc ON mc.memory_id = m.id
      WHERE m.relationship_id = ? AND m.memory_date >= ? AND m.memory_date < ?
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      WITH base AS (
        SELECT m.id, m.title, m.caption, m.memory_date, m.category, m.favorite,
          (SELECT COUNT(*) FROM memory_media mm WHERE mm.memory_id = m.id) AS media_count,
          (SELECT mm.id FROM memory_media mm WHERE mm.memory_id = m.id
            ORDER BY CASE mm.media_type WHEN 'image' THEN 0 ELSE 1 END, mm.sort_order, mm.created_at, mm.id LIMIT 1) AS preview_media_id,
          (SELECT mm.media_type FROM memory_media mm WHERE mm.memory_id = m.id
            ORDER BY CASE mm.media_type WHEN 'image' THEN 0 ELSE 1 END, mm.sort_order, mm.created_at, mm.id LIMIT 1) AS preview_media_type,
          (SELECT mm.alt_text FROM memory_media mm WHERE mm.memory_id = m.id
            ORDER BY CASE mm.media_type WHEN 'image' THEN 0 ELSE 1 END, mm.sort_order, mm.created_at, mm.id LIMIT 1) AS preview_alt
        FROM memories m WHERE m.relationship_id = ? AND m.memory_date >= ? AND m.memory_date < ?
      ), ranked AS (
        SELECT base.*,
          ROW_NUMBER() OVER (ORDER BY memory_date, id) AS first_rank,
          ROW_NUMBER() OVER (ORDER BY memory_date DESC, id DESC) AS last_rank,
          ROW_NUMBER() OVER (ORDER BY media_count DESC, memory_date, id) AS media_rank
        FROM base
      )
      SELECT * FROM ranked
      WHERE favorite = 1 OR first_rank = 1 OR last_rank = 1 OR media_rank = 1
      ORDER BY favorite DESC, media_count DESC, memory_date, id LIMIT 6
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT title, description, event_date, eyebrow FROM timeline_entries
      WHERE relationship_id = ? AND event_date >= ? AND event_date < ?
      ORDER BY event_date, id LIMIT 8
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT COUNT(*) AS watch_count, COUNT(DISTINCT tmdb_movie_id) AS unique_count,
        COUNT(DISTINCT CASE WHEN EXISTS (SELECT 1 FROM movie_history_ratings r WHERE r.history_id = h.id) THEN h.id END) AS rated_watch_count
      FROM movie_history h WHERE relationship_id = ? AND watched_on >= ? AND watched_on < ?
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      WITH ranked AS (
        SELECT h.tmdb_movie_id, h.title, MAX(h.poster_path) AS poster_path,
          COUNT(DISTINCT h.id) AS watch_count, AVG(r.rating_half_steps) / 2.0 AS average_rating
        FROM movie_history h JOIN movie_history_ratings r ON r.history_id = h.id
        WHERE h.relationship_id = ? AND h.watched_on >= ? AND h.watched_on < ?
        GROUP BY h.tmdb_movie_id, h.title
      )
      SELECT * FROM ranked WHERE average_rating = (SELECT MAX(average_rating) FROM ranked)
      ORDER BY watch_count DESC, title COLLATE NOCASE LIMIT 5
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT h.tmdb_movie_id, h.title, MAX(h.poster_path) AS poster_path,
        COUNT(DISTINCT h.id) AS watch_count, AVG(r.rating_half_steps) / 2.0 AS average_rating
      FROM movie_history h LEFT JOIN movie_history_ratings r ON r.history_id = h.id
      WHERE h.relationship_id = ? AND h.watched_on >= ? AND h.watched_on < ?
      GROUP BY h.tmdb_movie_id, h.title
      ORDER BY watch_count DESC, MAX(h.watched_on) DESC, h.title COLLATE NOCASE LIMIT 1
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT h.title, h.watched_on,
        (MAX(r.rating_half_steps) - MIN(r.rating_half_steps)) / 2.0 AS difference
      FROM movie_history h JOIN movie_history_ratings r ON r.history_id = h.id
      WHERE h.relationship_id = ? AND h.watched_on >= ? AND h.watched_on < ?
      GROUP BY h.id, h.title, h.watched_on HAVING COUNT(DISTINCT r.user_id) = 2
      ORDER BY difference DESC, h.watched_on, h.id LIMIT 1
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT COUNT(*) AS play_count,
        SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws,
        SUM(CASE WHEN outcome = 'cooperative_win' THEN 1 ELSE 0 END) AS cooperative_wins,
        SUM(CASE WHEN outcome = 'no_winner' THEN 1 ELSE 0 END) AS no_winner_count
      FROM game_history WHERE relationship_id = ? AND played_on >= ? AND played_on < ?
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT winner_user_id, COUNT(*) AS wins FROM game_history
      WHERE relationship_id = ? AND played_on >= ? AND played_on < ? AND outcome = 'partner_win'
      GROUP BY winner_user_id ORDER BY winner_user_id
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT g.id AS game_id, g.name, g.category, COUNT(*) AS play_count,
        AVG(h.rating_half_steps) / 2.0 AS average_rating
      FROM game_history h JOIN games g ON g.id = h.game_id
      WHERE h.relationship_id = ? AND h.played_on >= ? AND h.played_on < ?
      GROUP BY g.id, g.name, g.category ORDER BY play_count DESC, MAX(h.played_on) DESC, g.name LIMIT 1
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      WITH ranked AS (
        SELECT g.id AS game_id, g.name, g.category, COUNT(*) AS play_count,
          AVG(h.rating_half_steps) / 2.0 AS average_rating
        FROM game_history h JOIN games g ON g.id = h.game_id
        WHERE h.relationship_id = ? AND h.played_on >= ? AND h.played_on < ?
        GROUP BY g.id, g.name, g.category
      )
      SELECT * FROM ranked WHERE average_rating = (SELECT MAX(average_rating) FROM ranked)
      ORDER BY play_count DESC, name COLLATE NOCASE LIMIT 5
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT title, artist, why_it_matters, added_on, spotify_url, youtube_url, is_our_song, artwork_media_id,
        COUNT(*) OVER () AS total_count
      FROM songs WHERE relationship_id = ? AND added_on >= ? AND added_on < ?
      ORDER BY is_our_song DESC, added_on, created_at, id LIMIT 8
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT COUNT(*) AS completed_count, AVG(ah.rating_half_steps) / 2.0 AS average_rating,
        COUNT(*) - COUNT(DISTINCT ah.activity_id) AS repeated_count,
        SUM(CASE WHEN a.location_type IN ('indoor', 'home') THEN 1 ELSE 0 END) AS indoor_count,
        SUM(CASE WHEN a.location_type = 'outdoor' THEN 1 ELSE 0 END) AS outdoor_count,
        SUM(CASE WHEN a.budget_level = 'free' THEN 1 ELSE 0 END) AS free_count,
        SUM(CASE WHEN a.energy_level = 'adventurous' THEN 1 ELSE 0 END) AS adventurous_count
      FROM activity_history ah JOIN activities a ON a.id = ah.activity_id
      WHERE ah.relationship_id = ? AND ah.completed_date >= ? AND ah.completed_date < ?
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT a.category, COUNT(*) AS count FROM activity_history ah JOIN activities a ON a.id = ah.activity_id
      WHERE ah.relationship_id = ? AND ah.completed_date >= ? AND ah.completed_date < ?
      GROUP BY a.category ORDER BY count DESC, a.category LIMIT 5
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT a.name, a.category, ah.completed_date, ah.rating_half_steps, ah.linked_memory_id,
        (SELECT mm.id FROM memory_media mm WHERE mm.memory_id = ah.linked_memory_id AND mm.media_type = 'image'
          ORDER BY mm.sort_order, mm.created_at, mm.id LIMIT 1) AS memory_media_id,
        (SELECT mm.alt_text FROM memory_media mm WHERE mm.memory_id = ah.linked_memory_id AND mm.media_type = 'image'
          ORDER BY mm.sort_order, mm.created_at, mm.id LIMIT 1) AS memory_alt
      FROM activity_history ah JOIN activities a ON a.id = ah.activity_id
      WHERE ah.relationship_id = ? AND ah.completed_date >= ? AND ah.completed_date < ?
      ORDER BY ah.rating_half_steps DESC, ah.completed_date, ah.id LIMIT 6
    `).bind(relationshipId, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT
        SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS added_count,
        SUM(CASE WHEN status = 'completed' AND completed_at >= ? AND completed_at < ? THEN 1 ELSE 0 END) AS completed_count
      FROM bucket_list_items WHERE relationship_id = ?
    `).bind(startMs, endMs, year.startDate, year.endExclusiveDate, relationshipId),
    env.DB.prepare(`
      SELECT b.title, b.category, b.created_at, b.completed_at, b.linked_memory_id,
        (SELECT mm.id FROM memory_media mm WHERE mm.memory_id = b.linked_memory_id AND mm.media_type = 'image'
          ORDER BY mm.sort_order, mm.created_at, mm.id LIMIT 1) AS memory_media_id,
        (SELECT mm.alt_text FROM memory_media mm WHERE mm.memory_id = b.linked_memory_id AND mm.media_type = 'image'
          ORDER BY mm.sort_order, mm.created_at, mm.id LIMIT 1) AS memory_alt
      FROM bucket_list_items b WHERE b.relationship_id = ? AND (
        (b.created_at >= ? AND b.created_at < ?)
        OR (b.status = 'completed' AND b.completed_at >= ? AND b.completed_at < ?)
      ) ORDER BY COALESCE(b.completed_at, '9999-12-31'), b.created_at, b.id LIMIT 8
    `).bind(relationshipId, startMs, endMs, year.startDate, year.endExclusiveDate),
    env.DB.prepare(`
      SELECT COUNT(*) AS opened_count,
        SUM(CASE WHEN letter_type = 'typed' THEN 1 ELSE 0 END) AS typed_count,
        SUM(CASE WHEN letter_type = 'uploaded' THEN 1 ELSE 0 END) AS uploaded_count,
        MAX(CAST((opened_at - sealed_at) / 86400000 AS INTEGER)) AS longest_wait_days
      FROM future_letters
      WHERE relationship_id = ? AND status = 'opened' AND opened_at >= ? AND opened_at < ?
    `).bind(relationshipId, startMs, endMs),
    env.DB.prepare(`
      SELECT fl.title, fl.letter_type, sender.display_name AS sender_name,
        recipient.display_name AS recipient_name, fl.recipient_type, fl.opened_at, fl.sealed_at
      FROM future_letters fl
      JOIN users sender ON sender.id = fl.created_by_user_id
      LEFT JOIN users recipient ON recipient.id = fl.recipient_user_id
      WHERE fl.relationship_id = ? AND fl.status = 'opened' AND fl.opened_at >= ? AND fl.opened_at < ?
      ORDER BY fl.opened_at, fl.title COLLATE NOCASE LIMIT 6
    `).bind(relationshipId, startMs, endMs),
  ])

  const profiles = await loadProfiles(env, session)
  const memoryStats = first<MemoryStatsRow>(results[0])
  const memoryHighlights: RecapMemoryHighlight[] = rows<MemoryHighlightRow>(results[1]).map((row) => ({
    id: row.id,
    title: row.title,
    caption: row.caption,
    date: row.memory_date,
    category: row.category,
    favorite: Boolean(row.favorite),
    mediaCount: Number(row.media_count),
    preview: memoryPreview(row.preview_media_id, row.preview_media_type, row.preview_alt || row.title),
  }))
  const milestones: RecapMilestone[] = rows<MilestoneRow>(results[2]).map((row) => ({
    title: row.title, description: row.description, date: row.event_date, eyebrow: row.eyebrow,
  }))
  if (yearNumber === 1) {
    milestones.unshift({
      title: 'Our story began',
      description: 'The date every chapter in this archive grows from.',
      date: session.relationship.startDate,
      eyebrow: 'The beginning',
    })
  } else {
    milestones.unshift({
      title: `${yearNumber - 1} ${yearNumber - 1 === 1 ? 'year' : 'years'} together`,
      description: 'Another full relationship year, and the first day of the next chapter.',
      date: year.startDate,
      eyebrow: 'Anniversary',
    })
  }
  const movieTotals = first<MovieTotalsRow>(results[3])
  const gameTotals = first<GameTotalsRow>(results[7])
  const profileNames = new Map(profiles.map((profile) => [profile.id, profile.displayName]))
  const songRows = rows<SongRow>(results[11])
  const songs = songRows.map(mapSong)
  const activityTotals = first<ActivityTotalsRow>(results[12])
  const bucketTotals = first<BucketTotalsRow>(results[15])
  const letterTotals = first<LetterTotalsRow>(results[17])
  const response: RecapYearResponse = {
    relationship: relationshipResponse(session, profiles),
    serverDate,
    year: yearSummary,
    memories: {
      count: Number(memoryStats?.count ?? 0),
      photoCount: Number(memoryStats?.photo_count ?? 0),
      videoCount: Number(memoryStats?.video_count ?? 0),
      favoriteCount: Number(memoryStats?.favorite_count ?? 0),
      highlights: memoryHighlights,
    },
    milestones,
    movies: {
      watchCount: Number(movieTotals?.watch_count ?? 0),
      uniqueCount: Number(movieTotals?.unique_count ?? 0),
      rewatchCount: Math.max(0, Number(movieTotals?.watch_count ?? 0) - Number(movieTotals?.unique_count ?? 0)),
      ratedWatchCount: Number(movieTotals?.rated_watch_count ?? 0),
      highestRated: rows<MovieHighlightRow>(results[4]).map(mapMovieHighlight),
      mostWatched: first<MovieHighlightRow>(results[5]) ? mapMovieHighlight(first<MovieHighlightRow>(results[5])!) : null,
      largestRatingDisagreement: first<MovieDisagreementRow>(results[6]) ? {
        title: first<MovieDisagreementRow>(results[6])!.title,
        watchedOn: first<MovieDisagreementRow>(results[6])!.watched_on,
        difference: Number(first<MovieDisagreementRow>(results[6])!.difference),
      } : null,
    },
    games: {
      playCount: Number(gameTotals?.play_count ?? 0),
      draws: Number(gameTotals?.draws ?? 0),
      cooperativeWins: Number(gameTotals?.cooperative_wins ?? 0),
      noWinnerCount: Number(gameTotals?.no_winner_count ?? 0),
      partnerWins: rows<PartnerWinRow>(results[8]).map((row) => ({
        userId: row.winner_user_id,
        displayName: profileNames.get(row.winner_user_id) ?? 'Partner',
        wins: Number(row.wins),
      })),
      mostPlayed: first<GameHighlightRow>(results[9]) ? mapGameHighlight(first<GameHighlightRow>(results[9])!) : null,
      highestRated: rows<GameHighlightRow>(results[10]).map(mapGameHighlight),
    },
    soundtrack: {
      songsAdded: Number(songRows[0]?.total_count ?? 0),
      ourSong: songs.find((song) => song.isOurSong) ?? null,
      highlights: songs,
    },
    activities: {
      completedCount: Number(activityTotals?.completed_count ?? 0),
      averageRating: activityTotals?.average_rating === null || activityTotals?.average_rating === undefined
        ? null : Number(activityTotals.average_rating),
      repeatedCount: Number(activityTotals?.repeated_count ?? 0),
      indoorCount: Number(activityTotals?.indoor_count ?? 0),
      outdoorCount: Number(activityTotals?.outdoor_count ?? 0),
      freeCount: Number(activityTotals?.free_count ?? 0),
      adventurousCount: Number(activityTotals?.adventurous_count ?? 0),
      topCategories: rows<CategoryCountRow>(results[13]).map((row) => ({ category: row.category, count: Number(row.count) })),
      highlights: rows<ActivityHighlightRow>(results[14]).map((row): RecapActivityHighlight => ({
        name: row.name,
        category: row.category,
        completedDate: row.completed_date,
        rating: row.rating_half_steps === null ? null : Number(row.rating_half_steps) / 2,
        linkedMemoryId: row.linked_memory_id,
        preview: imagePreview(row.memory_media_id, row.memory_alt || row.name),
      })),
    },
    bucket: {
      addedCount: Number(bucketTotals?.added_count ?? 0),
      completedCount: Number(bucketTotals?.completed_count ?? 0),
      highlights: rows<BucketHighlightRow>(results[16]).map((row): RecapBucketHighlight => {
        const completedInYear = row.completed_at !== null
          && row.completed_at >= year.startDate && row.completed_at < year.endExclusiveDate
        return {
          title: row.title,
          category: row.category,
          addedDate: dateInTimeZone(Number(row.created_at), session.relationship.timezone),
          completedDate: row.completed_at,
          dateContext: completedInYear ? 'completed' : 'added',
          linkedMemoryId: row.linked_memory_id,
          preview: imagePreview(row.memory_media_id, row.memory_alt || row.title),
        }
      }),
    },
    letters: {
      openedCount: Number(letterTotals?.opened_count ?? 0),
      typedCount: Number(letterTotals?.typed_count ?? 0),
      uploadedCount: Number(letterTotals?.uploaded_count ?? 0),
      longestWaitDays: letterTotals?.longest_wait_days === null || letterTotals?.longest_wait_days === undefined
        ? null : Number(letterTotals.longest_wait_days),
      highlights: rows<LetterHighlightRow>(results[18]).map((row): RecapOpenedLetterHighlight => ({
        title: row.title,
        letterType: row.letter_type,
        senderName: row.sender_name,
        recipientName: row.recipient_type === 'both' ? 'Both of us' : (row.recipient_name ?? 'Partner'),
        openedAt: Number(row.opened_at),
        waitDays: Math.max(0, Math.floor((Number(row.opened_at) - Number(row.sealed_at)) / 86_400_000)),
      })),
    },
  }
  return apiSuccess(response)
}

export const thisDay = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const today = dateInTimeZone(Date.now(), session.relationship.timezone)
  const monthDay = today.slice(5)
  const id = session.relationship.id
  const results = await env.DB.batch([
    env.DB.prepare(`
      SELECT m.id, m.title, m.caption, m.memory_date, m.category, m.favorite,
        (SELECT COUNT(*) FROM memory_media mm WHERE mm.memory_id = m.id) AS media_count,
        (SELECT mm.id FROM memory_media mm WHERE mm.memory_id = m.id ORDER BY CASE mm.media_type WHEN 'image' THEN 0 ELSE 1 END, mm.sort_order, mm.created_at LIMIT 1) AS preview_media_id,
        (SELECT mm.media_type FROM memory_media mm WHERE mm.memory_id = m.id ORDER BY CASE mm.media_type WHEN 'image' THEN 0 ELSE 1 END, mm.sort_order, mm.created_at LIMIT 1) AS preview_media_type,
        (SELECT mm.alt_text FROM memory_media mm WHERE mm.memory_id = m.id ORDER BY CASE mm.media_type WHEN 'image' THEN 0 ELSE 1 END, mm.sort_order, mm.created_at LIMIT 1) AS preview_alt
      FROM memories m WHERE relationship_id = ? AND substr(memory_date, 6, 5) = ? AND memory_date < ?
      ORDER BY favorite DESC, memory_date DESC, id LIMIT 6
    `).bind(id, monthDay, today),
    env.DB.prepare(`
      SELECT title, description AS detail, event_date FROM timeline_entries
      WHERE relationship_id = ? AND substr(event_date, 6, 5) = ? AND event_date < ?
      ORDER BY event_date DESC, id LIMIT 4
    `).bind(id, monthDay, today),
  ])
  const items: ThisDayItem[] = rows<ThisDayMemoryRow>(results[0]).map((row) => ({
    kind: 'memory', title: row.title, detail: row.caption || row.category, date: row.memory_date,
    href: `/memories?memory=${encodeURIComponent(row.id)}`,
    media: memoryPreview(row.preview_media_id, row.preview_media_type, row.preview_alt || row.title),
  }))
  rows<ThisDayEntryRow>(results[1]).forEach((row) => items.push({
    kind: 'milestone', title: row.title, detail: row.detail, date: row.event_date, href: '/story', media: null,
  }))
  if (session.relationship.startDate.slice(5) === monthDay && session.relationship.startDate < today) {
    items.push({
      kind: 'milestone',
      title: 'Our story began',
      detail: relationshipAgeLabelOn(session.relationship.startDate, today),
      date: session.relationship.startDate,
      href: '/story',
      media: null,
    })
  }
  const response: ThisDayResponse = { date: today, items }
  return apiSuccess(response)
}
