import { requireSession, type AuthSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { pageLimit, phaseThreeDate, ratingHalfSteps, validateOutcome } from '../lib/phase-three'
import { asRecord, optionalString, requiredString } from '../lib/validation'

interface GameRow {
  id: string
  relationship_id: string | null
  created_by_user_id: string | null
  name: string
  category: string
  player_count: string
  duration: string
  notes: string
  built_in: number
  created_at: number
  updated_at: number
}

const gameResponse = (row: GameRow) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  playerCount: row.player_count,
  duration: row.duration,
  notes: row.notes,
  builtIn: Boolean(row.built_in),
  createdByUserId: row.created_by_user_id,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const parseGame = (body: Record<string, unknown>, current?: GameRow) => ({
  name: body.name === undefined && current ? current.name : requiredString(body.name, 'name', 1, 150),
  category: body.category === undefined && current
    ? current.category
    : requiredString(body.category, 'category', 1, 80),
  playerCount: body.playerCount === undefined && current
    ? current.player_count
    : (optionalString(body.playerCount, 'playerCount', 80) ?? '2 players'),
  duration: body.duration === undefined && current
    ? current.duration
    : (optionalString(body.duration, 'duration', 80) ?? ''),
  notes: body.notes === undefined && current
    ? current.notes
    : (optionalString(body.notes, 'notes', 5_000) ?? ''),
})

const accessibleGame = async (env: Env, relationshipId: string, gameId: string): Promise<GameRow> => {
  const row = await env.DB.prepare(`
    SELECT id, relationship_id, created_by_user_id, name, category, player_count, duration,
      notes, built_in, created_at, updated_at
    FROM games WHERE id = ? AND (built_in = 1 OR relationship_id = ?) LIMIT 1
  `).bind(gameId, relationshipId).first<GameRow>()
  if (!row) throw new ApiError(404, 'GAME_NOT_FOUND', 'That game was not found.')
  return row
}

export const listGames = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const url = new URL(request.url)
  const category = url.searchParams.get('category')?.trim() ?? ''
  if (category.length > 80) throw new ApiError(400, 'VALIDATION_ERROR', 'category is too long.')
  const result = await env.DB.prepare(`
    SELECT id, relationship_id, created_by_user_id, name, category, player_count, duration,
      notes, built_in, created_at, updated_at
    FROM games
    WHERE (built_in = 1 OR relationship_id = ?) AND (? = '' OR category = ?)
    ORDER BY built_in DESC, name COLLATE NOCASE
    LIMIT ?
  `).bind(session.relationship.id, category, category, pageLimit(url, 100, 250)).all<GameRow>()
  return apiSuccess(result.results.map(gameResponse))
}

export const createGame = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const parsed = parseGame(asRecord(await readJson(request)))
  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(`
    INSERT INTO games (
      id, relationship_id, created_by_user_id, name, category, player_count, duration,
      notes, built_in, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).bind(
    id, session.relationship.id, session.user.id, parsed.name, parsed.category,
    parsed.playerCount, parsed.duration, parsed.notes, now, now,
  ).run()
  return apiSuccess({
    id,
    ...parsed,
    builtIn: false,
    createdByUserId: session.user.id,
    createdAt: now,
    updatedAt: now,
  }, { status: 201 })
}

export const updateGame = async (request: Request, env: Env, gameId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await accessibleGame(env, session.relationship.id, gameId)
  if (current.built_in) throw new ApiError(409, 'BUILT_IN_GAME_IMMUTABLE', 'Starter games cannot be edited.')
  const parsed = parseGame(asRecord(await readJson(request)), current)
  const now = Date.now()
  await env.DB.prepare(`
    UPDATE games SET name = ?, category = ?, player_count = ?, duration = ?, notes = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ? AND built_in = 0
  `).bind(
    parsed.name, parsed.category, parsed.playerCount, parsed.duration, parsed.notes,
    now, gameId, session.relationship.id,
  ).run()
  return apiSuccess(gameResponse({
    ...current,
    name: parsed.name,
    category: parsed.category,
    player_count: parsed.playerCount,
    duration: parsed.duration,
    notes: parsed.notes,
    updated_at: now,
  }))
}

export const deleteGame = async (request: Request, env: Env, gameId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await accessibleGame(env, session.relationship.id, gameId)
  if (current.built_in) throw new ApiError(409, 'BUILT_IN_GAME_IMMUTABLE', 'Starter games cannot be deleted.')
  const use = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM game_history WHERE relationship_id = ? AND game_id = ?',
  ).bind(session.relationship.id, gameId).first<{ count: number }>()
  if (Number(use?.count ?? 0) > 0) {
    throw new ApiError(409, 'GAME_HAS_HISTORY', 'Delete this game’s play history before deleting the game.')
  }
  await env.DB.prepare('DELETE FROM games WHERE id = ? AND relationship_id = ? AND built_in = 0')
    .bind(gameId, session.relationship.id).run()
  return apiSuccess({ deleted: true })
}

interface GameHistoryRow {
  id: string
  game_id: string
  game_name: string
  game_category: string
  played_on: string
  outcome: 'partner_win' | 'draw' | 'cooperative_win' | 'no_winner'
  winner_user_id: string | null
  rating_half_steps: number
  note: string
  created_by_user_id: string
  created_at: number
  updated_at: number
}

const historyResponse = (row: GameHistoryRow) => ({
  id: row.id,
  gameId: row.game_id,
  gameName: row.game_name,
  gameCategory: row.game_category,
  playedOn: row.played_on,
  outcome: row.outcome,
  winnerUserId: row.winner_user_id,
  rating: Number(row.rating_half_steps) / 2,
  note: row.note,
  createdByUserId: row.created_by_user_id,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const ownedHistory = async (env: Env, relationshipId: string, historyId: string): Promise<GameHistoryRow> => {
  const row = await env.DB.prepare(`
    SELECT h.id, h.game_id, g.name AS game_name, g.category AS game_category, h.played_on,
      h.outcome, h.winner_user_id, h.rating_half_steps, h.note, h.created_by_user_id,
      h.created_at, h.updated_at
    FROM game_history h JOIN games g ON g.id = h.game_id
    WHERE h.id = ? AND h.relationship_id = ? LIMIT 1
  `).bind(historyId, relationshipId).first<GameHistoryRow>()
  if (!row) throw new ApiError(404, 'GAME_HISTORY_NOT_FOUND', 'That game night entry was not found.')
  return row
}

const validateWinner = (
  session: AuthSession,
  outcome: GameHistoryRow['outcome'],
  winnerValue: unknown,
): string | null => {
  if (outcome !== 'partner_win') {
    if (winnerValue !== undefined && winnerValue !== null && winnerValue !== '') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Only a partner win can have a winner.')
    }
    return null
  }
  const winner = requiredString(winnerValue, 'winnerUserId', 1, 100)
  if (![session.relationship.partner1UserId, session.relationship.partner2UserId].includes(winner)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'winnerUserId must be one of the two partners.')
  }
  return winner
}

export const listGameHistory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const result = await env.DB.prepare(`
    SELECT h.id, h.game_id, g.name AS game_name, g.category AS game_category, h.played_on,
      h.outcome, h.winner_user_id, h.rating_half_steps, h.note, h.created_by_user_id,
      h.created_at, h.updated_at
    FROM game_history h JOIN games g ON g.id = h.game_id
    WHERE h.relationship_id = ? ORDER BY h.played_on DESC, h.created_at DESC LIMIT ?
  `).bind(
    session.relationship.id,
    pageLimit(new URL(request.url), 100, 250),
  ).all<GameHistoryRow>()
  return apiSuccess(result.results.map(historyResponse))
}

export const createGameHistory = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const gameId = requiredString(body.gameId, 'gameId', 1, 100)
  const game = await accessibleGame(env, session.relationship.id, gameId)
  const playedOn = phaseThreeDate(body, 'playedOn')
  const outcome = validateOutcome(body.outcome)
  const winnerUserId = validateWinner(session, outcome, body.winnerUserId)
  const halfSteps = ratingHalfSteps(body.rating)
  const note = optionalString(body.note, 'note', 5_000) ?? ''
  const id = crypto.randomUUID()
  const now = Date.now()
  await env.DB.prepare(`
    INSERT INTO game_history (
      id, relationship_id, game_id, played_on, outcome, winner_user_id, rating_half_steps,
      note, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, session.relationship.id, gameId, playedOn, outcome, winnerUserId, halfSteps,
    note, session.user.id, now, now,
  ).run()
  return apiSuccess(historyResponse({
    id,
    game_id: gameId,
    game_name: game.name,
    game_category: game.category,
    played_on: playedOn,
    outcome,
    winner_user_id: winnerUserId,
    rating_half_steps: halfSteps,
    note,
    created_by_user_id: session.user.id,
    created_at: now,
    updated_at: now,
  }), { status: 201 })
}

export const updateGameHistory = async (request: Request, env: Env, historyId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await ownedHistory(env, session.relationship.id, historyId)
  const body = asRecord(await readJson(request))
  const gameId = body.gameId === undefined ? current.game_id : requiredString(body.gameId, 'gameId', 1, 100)
  const game = await accessibleGame(env, session.relationship.id, gameId)
  const playedOn = body.playedOn === undefined ? current.played_on : phaseThreeDate(body, 'playedOn')
  const outcome = body.outcome === undefined ? current.outcome : validateOutcome(body.outcome)
  const winnerInput = body.winnerUserId === undefined ? current.winner_user_id : body.winnerUserId
  const winnerUserId = validateWinner(session, outcome, winnerInput)
  const halfSteps = body.rating === undefined ? current.rating_half_steps : ratingHalfSteps(body.rating)
  const note = body.note === undefined ? current.note : (optionalString(body.note, 'note', 5_000) ?? '')
  const now = Date.now()
  await env.DB.prepare(`
    UPDATE game_history SET game_id = ?, played_on = ?, outcome = ?, winner_user_id = ?,
      rating_half_steps = ?, note = ?, updated_at = ?
    WHERE id = ? AND relationship_id = ?
  `).bind(
    gameId, playedOn, outcome, winnerUserId, halfSteps, note, now, historyId, session.relationship.id,
  ).run()
  return apiSuccess(historyResponse({
    ...current,
    game_id: gameId,
    game_name: game.name,
    game_category: game.category,
    played_on: playedOn,
    outcome,
    winner_user_id: winnerUserId,
    rating_half_steps: halfSteps,
    note,
    updated_at: now,
  }))
}

export const deleteGameHistory = async (request: Request, env: Env, historyId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  await ownedHistory(env, session.relationship.id, historyId)
  await env.DB.prepare('DELETE FROM game_history WHERE id = ? AND relationship_id = ?')
    .bind(historyId, session.relationship.id).run()
  return apiSuccess({ deleted: true })
}

export const gameStats = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const [totals, wins, favourite] = await Promise.all([
    env.DB.prepare(`
      SELECT COUNT(*) AS games_played, AVG(rating_half_steps) / 2.0 AS average_rating,
        SUM(CASE WHEN outcome = 'draw' THEN 1 ELSE 0 END) AS draws,
        SUM(CASE WHEN outcome = 'cooperative_win' THEN 1 ELSE 0 END) AS cooperative_wins,
        SUM(CASE WHEN outcome = 'no_winner' THEN 1 ELSE 0 END) AS no_winner
      FROM game_history WHERE relationship_id = ?
    `).bind(session.relationship.id).first<{
      games_played: number
      average_rating: number | null
      draws: number
      cooperative_wins: number
      no_winner: number
    }>(),
    env.DB.prepare(`
      SELECT winner_user_id, COUNT(*) AS wins FROM game_history
      WHERE relationship_id = ? AND outcome = 'partner_win'
      GROUP BY winner_user_id
    `).bind(session.relationship.id).all<{ winner_user_id: string; wins: number }>(),
    env.DB.prepare(`
      SELECT g.id, g.name, COUNT(*) AS play_count
      FROM game_history h JOIN games g ON g.id = h.game_id
      WHERE h.relationship_id = ? GROUP BY g.id, g.name
      ORDER BY play_count DESC, MAX(h.played_on) DESC LIMIT 1
    `).bind(session.relationship.id).first<{ id: string; name: string; play_count: number }>(),
  ])
  return apiSuccess({
    gamesPlayed: Number(totals?.games_played ?? 0),
    averageRating: totals?.average_rating === null || totals?.average_rating === undefined
      ? null
      : Number(totals.average_rating),
    draws: Number(totals?.draws ?? 0),
    cooperativeWins: Number(totals?.cooperative_wins ?? 0),
    noWinner: Number(totals?.no_winner ?? 0),
    partnerWins: wins.results.map((row) => ({ userId: row.winner_user_id, wins: Number(row.wins) })),
    mostPlayed: favourite ? { id: favourite.id, name: favourite.name, playCount: Number(favourite.play_count) } : null,
  })
}
