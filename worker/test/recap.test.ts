import { env, exports } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { SESSION_COOKIE } from '../src/auth/session'
import { hashText } from '../src/lib/crypto'
import { addCalendarDays, dateInTimeZone, startOfDateInTimeZone } from '../../src/lib/relationship-years'
import type { RecapIndexResponse, RecapYearResponse, ThisDayResponse } from '../../src/features/recap/types'

const ORIGIN = 'https://our-corner.test'
const TOKEN = 'phase-eight-session-token-that-is-long-enough-for-validation'
const COOKIE = `${SESSION_COOKIE}=${TOKEN}`

interface Envelope<T> { success: true; data: T }

const request = (path: string, authenticated = true): Promise<Response> => exports.default.fetch(`${ORIGIN}${path}`, {
  headers: authenticated ? { Cookie: COOKIE } : undefined,
})

const data = async <T>(path: string): Promise<T> => {
  const response = await request(path)
  expect(response.status).toBe(200)
  return (await response.json<Envelope<T>>()).data
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM backup_jobs'),
    env.DB.prepare('DELETE FROM movie_history_ratings'),
    env.DB.prepare('DELETE FROM movie_history'),
    env.DB.prepare('DELETE FROM movie_watchlist'),
    env.DB.prepare('DELETE FROM game_history'),
    env.DB.prepare('DELETE FROM songs'),
    env.DB.prepare('DELETE FROM future_letter_media'),
    env.DB.prepare('DELETE FROM future_letters'),
    env.DB.prepare('DELETE FROM bucket_list_items'),
    env.DB.prepare('DELETE FROM activity_history'),
    env.DB.prepare('DELETE FROM planned_activities'),
    env.DB.prepare('DELETE FROM activity_suggestions'),
    env.DB.prepare('DELETE FROM saved_activities'),
    env.DB.prepare('DELETE FROM activity_exclusions'),
    env.DB.prepare('DELETE FROM activities WHERE is_builtin = 0'),
    env.DB.prepare('DELETE FROM memory_media'),
    env.DB.prepare('DELETE FROM memories'),
    env.DB.prepare('DELETE FROM timeline_entries'),
    env.DB.prepare('DELETE FROM sessions'),
    env.DB.prepare('DELETE FROM relationships'),
    env.DB.prepare('DELETE FROM users'),
  ])
  const now = Date.now()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES ('partner-1', 'one@example.test', 'Partner One', 'unused', 1, ?, ?)").bind(now, now),
    env.DB.prepare("INSERT INTO users (id, email, display_name, password_hash, active, created_at, updated_at) VALUES ('partner-2', 'two@example.test', 'Partner Two', 'unused', 1, ?, ?)").bind(now, now),
  ])
  await env.DB.prepare(`
    INSERT INTO relationships (id, title, start_date, timezone, partner_1_user_id, partner_2_user_id, created_at, updated_at)
    VALUES ('primary', 'Our Corner', '2023-08-28', 'Europe/London', 'partner-1', 'partner-2', ?, ?)
  `).bind(now, now).run()
  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at, recent_auth_at)
    VALUES (?, 'partner-1', ?, ?, ?, ?)
  `).bind(await hashText(TOKEN), now + 86_400_000, now, now, now).run()
})

describe('Phase 8 relationship-year API', () => {
  it('requires authentication for every retrospective endpoint', async () => {
    for (const path of ['/api/recap', '/api/recap/current', '/api/recap/year/1', '/api/this-day']) {
      expect((await request(path, false)).status).toBe(401)
    }
  })

  it('returns empty, current, completed, and comparison states without mock data', async () => {
    const index = await data<RecapIndexResponse>('/api/recap')
    expect(index.currentYear.yearNumber).toBe(3)
    expect(index.completedYears.map((year) => year.yearNumber)).toEqual([2, 1])
    expect(index.comparison?.metrics.every((metric) => metric.earlier === 0 && metric.later === 0)).toBe(true)

    const current = await data<RecapYearResponse>('/api/recap/current')
    expect(current.year.current).toBe(true)
    expect(current.memories.count).toBe(0)
    expect(current.milestones[0]?.eyebrow).toBe('Anniversary')
  })

  it('keeps future-dated history out of the current relationship-year recap', async () => {
    const today = dateInTimeZone(Date.now(), 'Europe/London')
    const tomorrow = addCalendarDays(today, 1)
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at)
        VALUES ('today-memory', 'primary', 'partner-1', 'Today', '', ?, 'Dates', 0, 1, 1)
      `).bind(today),
      env.DB.prepare(`
        INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at)
        VALUES ('future-memory', 'primary', 'partner-1', 'Tomorrow', '', ?, 'Dates', 0, 2, 2)
      `).bind(tomorrow),
    ])
    const current = await data<RecapYearResponse>('/api/recap/current')
    expect(current.memories.count).toBe(1)
    expect(current.memories.highlights.map((memory) => memory.title)).toEqual(['Today'])
  })

  it('uses exact anniversary bounds and keeps highlights bounded on larger data', async () => {
    const statements: D1PreparedStatement[] = []
    const dates = ['2023-08-28', '2024-08-27', '2024-08-28']
    dates.forEach((date, index) => statements.push(env.DB.prepare(`
      INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at)
      VALUES (?, 'primary', 'partner-1', ?, '', ?, 'Milestones', ?, ?, ?)
    `).bind(`boundary-${index}`, `Boundary ${index}`, date, index === 0 ? 1 : 0, index + 1, index + 1)))
    for (let index = 0; index < 120; index += 1) {
      statements.push(env.DB.prepare(`
        INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at)
        VALUES (?, 'primary', 'partner-1', ?, '', '2023-09-01', 'Dates', 0, ?, ?)
      `).bind(`large-${index}`, `Large ${index}`, 1_000 + index, 1_000 + index))
    }
    for (let index = 0; index < 12; index += 1) {
      statements.push(env.DB.prepare(`
        INSERT INTO songs (id, relationship_id, created_by_user_id, title, artist, added_on, is_our_song, created_at, updated_at)
        VALUES (?, 'primary', 'partner-1', ?, 'Artist', '2023-09-01', 0, ?, ?)
      `).bind(`song-${index}`, `Song ${index}`, 2_000 + index, 2_000 + index))
    }
    await env.DB.batch(statements)
    const yearOne = await data<RecapYearResponse>('/api/recap/year/1')
    const yearTwo = await data<RecapYearResponse>('/api/recap/year/2')
    expect(yearOne.memories.count).toBe(122)
    expect(yearTwo.memories.count).toBe(1)
    expect(yearOne.memories.highlights.length).toBeLessThanOrEqual(6)
    expect(yearOne.soundtrack.songsAdded).toBe(12)
    expect(yearOne.soundtrack.highlights).toHaveLength(8)
  })

  it('calculates movie rewatches and only compares ratings when both partners rated one watch', async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO movie_history (id, relationship_id, tmdb_movie_id, title, watched_on, note, created_by_user_id, created_at, updated_at) VALUES ('movie-1', 'primary', 10, 'Repeat Film', '2023-09-01', '', 'partner-1', 1, 1)"),
      env.DB.prepare("INSERT INTO movie_history (id, relationship_id, tmdb_movie_id, title, watched_on, note, created_by_user_id, created_at, updated_at) VALUES ('movie-2', 'primary', 10, 'Repeat Film', '2023-09-02', '', 'partner-1', 2, 2)"),
      env.DB.prepare("INSERT INTO movie_history (id, relationship_id, tmdb_movie_id, title, watched_on, note, created_by_user_id, created_at, updated_at) VALUES ('movie-3', 'primary', 11, 'Solo Rating', '2023-09-03', '', 'partner-1', 3, 3)"),
      env.DB.prepare("INSERT INTO movie_history_ratings (history_id, user_id, rating_half_steps) VALUES ('movie-1', 'partner-1', 10)"),
      env.DB.prepare("INSERT INTO movie_history_ratings (history_id, user_id, rating_half_steps) VALUES ('movie-2', 'partner-1', 10)"),
      env.DB.prepare("INSERT INTO movie_history_ratings (history_id, user_id, rating_half_steps) VALUES ('movie-2', 'partner-2', 4)"),
      env.DB.prepare("INSERT INTO movie_history_ratings (history_id, user_id, rating_half_steps) VALUES ('movie-3', 'partner-1', 8)"),
    ])
    const recap = await data<RecapYearResponse>('/api/recap/year/1')
    expect(recap.movies).toMatchObject({ watchCount: 3, uniqueCount: 2, rewatchCount: 1, ratedWatchCount: 3 })
    expect(recap.movies.largestRatingDisagreement).toMatchObject({ title: 'Repeat Film', difference: 3 })
  })

  it('keeps cooperative wins out of individual win totals', async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO game_history (id, relationship_id, game_id, played_on, outcome, winner_user_id, rating_half_steps, note, created_by_user_id, created_at, updated_at) VALUES ('game-1', 'primary', 'builtin-uno', '2023-09-01', 'partner_win', 'partner-1', 8, '', 'partner-1', 1, 1)"),
      env.DB.prepare("INSERT INTO game_history (id, relationship_id, game_id, played_on, outcome, winner_user_id, rating_half_steps, note, created_by_user_id, created_at, updated_at) VALUES ('game-2', 'primary', 'builtin-uno', '2023-09-02', 'cooperative_win', NULL, 10, '', 'partner-1', 2, 2)"),
      env.DB.prepare("INSERT INTO game_history (id, relationship_id, game_id, played_on, outcome, winner_user_id, rating_half_steps, note, created_by_user_id, created_at, updated_at) VALUES ('game-3', 'primary', 'builtin-uno', '2023-09-03', 'draw', NULL, 6, '', 'partner-1', 3, 3)"),
    ])
    const recap = await data<RecapYearResponse>('/api/recap/year/1')
    expect(recap.games).toMatchObject({ playCount: 3, cooperativeWins: 1, draws: 1 })
    expect(recap.games.partnerWins).toEqual([{ userId: 'partner-1', displayName: 'Partner One', wins: 1 }])
  })

  it('attributes bucket addition and completion to their correct relationship years', async () => {
    const addedAt = startOfDateInTimeZone('2023-10-01', 'Europe/London')
    await env.DB.prepare(`
      INSERT INTO bucket_list_items (
        id, relationship_id, created_by_user_id, completed_by_user_id, title, description, category,
        status, location, completed_at, completion_note, created_at, updated_at
      ) VALUES ('bucket-cross-year', 'primary', 'partner-1', 'partner-2', 'See the coast', '', 'travel',
        'completed', '', '2024-09-01', '', ?, ?)
    `).bind(addedAt, addedAt).run()
    const yearOne = await data<RecapYearResponse>('/api/recap/year/1')
    const yearTwo = await data<RecapYearResponse>('/api/recap/year/2')
    expect(yearOne.bucket).toMatchObject({ addedCount: 1, completedCount: 0 })
    expect(yearTwo.bucket).toMatchObject({ addedCount: 0, completedCount: 1 })
  })

  it('includes only opened-letter metadata and never leaks protected Letter payloads', async () => {
    const openedAt = startOfDateInTimeZone('2023-09-10', 'Europe/London') + 43_200_000
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO future_letters (id, relationship_id, created_by_user_id, recipient_type, recipient_user_id, title, letter_type, typed_content, teaser, status, unlock_at, sealed_at, opened_at, first_opened_by_user_id, created_at, updated_at)
        VALUES ('opened-letter', 'primary', 'partner-1', 'user', 'partner-2', 'Open title', 'typed', 'OPENED_BODY_SECRET', '', 'opened', ?, ?, ?, 'partner-2', 1, 1)
      `).bind(openedAt - 1, openedAt - 172_800_000, openedAt),
      env.DB.prepare(`
        INSERT INTO future_letters (id, relationship_id, created_by_user_id, recipient_type, recipient_user_id, title, letter_type, typed_content, teaser, status, unlock_at, sealed_at, created_at, updated_at)
        VALUES ('locked-letter-id', 'primary', 'partner-1', 'user', 'partner-2', 'LOCKED_TITLE_SECRET', 'typed', 'LOCKED_BODY_SECRET', 'LOCKED_TEASER_SECRET', 'sealed', ?, ?, 2, 2)
      `).bind(openedAt - 1, openedAt - 172_800_000),
      env.DB.prepare(`
        INSERT INTO future_letters (id, relationship_id, created_by_user_id, title, letter_type, typed_content, teaser, status, created_at, updated_at)
        VALUES ('draft-letter-id', 'primary', 'partner-1', 'DRAFT_TITLE_SECRET', 'typed', 'DRAFT_BODY_SECRET', '', 'draft', 3, 3)
      `),
    ])
    const response = await request('/api/recap/year/1')
    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).toContain('Open title')
    expect(text).not.toContain('OPENED_BODY_SECRET')
    expect(text).not.toContain('LOCKED_')
    expect(text).not.toContain('locked-letter-id')
    expect(text).not.toContain('DRAFT_')
  })
})

describe('This Day privacy and date behavior', () => {
  it('returns exact prior-year month/day matches and ignores adjacent dates', async () => {
    const today = dateInTimeZone(Date.now(), 'Europe/London')
    const priorExact = `2025-${today.slice(5)}`
    const priorAdjacent = addCalendarDays(priorExact, -1)
    await env.DB.batch([
      env.DB.prepare("INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at) VALUES ('exact-day', 'primary', 'partner-1', 'Exact day', '', ?, 'Dates', 0, 1, 1)").bind(priorExact),
      env.DB.prepare("INSERT INTO memories (id, relationship_id, created_by_user_id, title, caption, memory_date, category, favorite, created_at, updated_at) VALUES ('adjacent-day', 'primary', 'partner-1', 'Adjacent day', '', ?, 'Dates', 0, 2, 2)").bind(priorAdjacent),
    ])
    const response = await data<ThisDayResponse>('/api/this-day')
    expect(response.items.map((item) => item.title)).toContain('Exact day')
    expect(response.items.map((item) => item.title)).not.toContain('Adjacent day')
  })

  it('hides year comparison until two relationship years are complete', async () => {
    await env.DB.prepare("UPDATE relationships SET start_date = '2025-08-28' WHERE id = 'primary'").run()
    const index = await data<RecapIndexResponse>('/api/recap')
    expect(index.completedYears).toHaveLength(0)
    expect(index.comparison).toBeNull()
  })
})
