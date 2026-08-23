import { requireSession } from '../auth/session'
import { ApiError, apiSuccess, readJson } from '../lib/http'
import { optionalHttpsUrl, phaseThreeDate } from '../lib/phase-three'
import { asRecord, optionalString, requiredString } from '../lib/validation'

const SPOTIFY_HOSTS = new Set(['open.spotify.com', 'spotify.link'])
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'])

interface SongRow {
  id: string
  created_by_user_id: string
  title: string
  artist: string
  spotify_url: string | null
  youtube_url: string | null
  why_it_matters: string
  added_on: string
  associated_memory_id: string | null
  associated_memory_title: string | null
  artwork_media_id: string | null
  is_our_song: number
  created_at: number
  updated_at: number
}

const songResponse = (row: SongRow) => ({
  id: row.id,
  createdByUserId: row.created_by_user_id,
  title: row.title,
  artist: row.artist,
  spotifyUrl: row.spotify_url,
  youtubeUrl: row.youtube_url,
  whyItMatters: row.why_it_matters,
  addedOn: row.added_on,
  associatedMemoryId: row.associated_memory_id,
  associatedMemoryTitle: row.associated_memory_title,
  artworkMediaId: row.artwork_media_id,
  artworkUrl: row.artwork_media_id ? `/api/media/${encodeURIComponent(row.artwork_media_id)}` : null,
  isOurSong: Boolean(row.is_our_song),
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at),
})

const songSelect = `
  SELECT s.id, s.created_by_user_id, s.title, s.artist, s.spotify_url, s.youtube_url,
    s.why_it_matters, s.added_on, s.associated_memory_id, m.title AS associated_memory_title,
    s.artwork_media_id, s.is_our_song, s.created_at, s.updated_at
  FROM songs s LEFT JOIN memories m ON m.id = s.associated_memory_id
`

const ownedSong = async (env: Env, relationshipId: string, songId: string): Promise<SongRow> => {
  const row = await env.DB.prepare(`${songSelect} WHERE s.id = ? AND s.relationship_id = ? LIMIT 1`)
    .bind(songId, relationshipId).first<SongRow>()
  if (!row) throw new ApiError(404, 'SONG_NOT_FOUND', 'That soundtrack entry was not found.')
  return row
}

const optionalId = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null || value === '') return null
  return requiredString(value, field, 1, 100)
}

const validateAssociations = async (
  env: Env,
  relationshipId: string,
  associatedMemoryId: string | null,
  artworkMediaId: string | null,
): Promise<{ associatedMemoryTitle: string | null }> => {
  let associatedMemoryTitle: string | null = null
  if (associatedMemoryId) {
    const memory = await env.DB.prepare('SELECT title FROM memories WHERE id = ? AND relationship_id = ? LIMIT 1')
      .bind(associatedMemoryId, relationshipId).first<{ title: string }>()
    if (!memory) throw new ApiError(400, 'VALIDATION_ERROR', 'associatedMemoryId is not part of this relationship.')
    associatedMemoryTitle = memory.title
  }
  if (artworkMediaId) {
    const media = await env.DB.prepare(`
      SELECT mm.id FROM memory_media mm JOIN memories m ON m.id = mm.memory_id
      WHERE mm.id = ? AND mm.media_type = 'image' AND m.relationship_id = ? LIMIT 1
    `).bind(artworkMediaId, relationshipId).first<{ id: string }>()
    if (!media) throw new ApiError(400, 'VALIDATION_ERROR', 'artworkMediaId must be an authenticated image upload from this relationship.')
  }
  return { associatedMemoryTitle }
}

export const listSongs = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const result = await env.DB.prepare(`
    ${songSelect} WHERE s.relationship_id = ?
    ORDER BY s.is_our_song DESC, s.added_on DESC, s.created_at DESC
  `).bind(session.relationship.id).all<SongRow>()
  return apiSuccess(result.results.map(songResponse))
}

export const createSong = async (request: Request, env: Env): Promise<Response> => {
  const session = await requireSession(request, env)
  const body = asRecord(await readJson(request))
  const title = requiredString(body.title, 'title', 1, 250)
  const artist = requiredString(body.artist, 'artist', 1, 250)
  const spotifyUrl = optionalHttpsUrl(body.spotifyUrl, 'spotifyUrl', SPOTIFY_HOSTS)
  const youtubeUrl = optionalHttpsUrl(body.youtubeUrl, 'youtubeUrl', YOUTUBE_HOSTS)
  const whyItMatters = optionalString(body.whyItMatters, 'whyItMatters', 5_000) ?? ''
  const addedOn = phaseThreeDate(body, 'addedOn')
  const associatedMemoryId = optionalId(body.associatedMemoryId, 'associatedMemoryId')
  const artworkMediaId = optionalId(body.artworkMediaId, 'artworkMediaId')
  const association = await validateAssociations(
    env,
    session.relationship.id,
    associatedMemoryId,
    artworkMediaId,
  )
  const currentOurSong = await env.DB.prepare(
    'SELECT id FROM songs WHERE relationship_id = ? AND is_our_song = 1 LIMIT 1',
  ).bind(session.relationship.id).first<{ id: string }>()
  const isOurSong = body.isOurSong === true || !currentOurSong
  const id = crypto.randomUUID()
  const now = Date.now()
  const insert = env.DB.prepare(`
    INSERT INTO songs (
      id, relationship_id, created_by_user_id, title, artist, spotify_url, youtube_url,
      why_it_matters, added_on, associated_memory_id, artwork_media_id, is_our_song,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, session.relationship.id, session.user.id, title, artist, spotifyUrl, youtubeUrl,
    whyItMatters, addedOn, associatedMemoryId, artworkMediaId, isOurSong ? 1 : 0, now, now,
  )
  if (isOurSong && currentOurSong) {
    await env.DB.batch([
      env.DB.prepare('UPDATE songs SET is_our_song = 0, updated_at = ? WHERE relationship_id = ? AND is_our_song = 1')
        .bind(now, session.relationship.id),
      insert,
    ])
  } else {
    await insert.run()
  }
  return apiSuccess(songResponse({
    id,
    created_by_user_id: session.user.id,
    title,
    artist,
    spotify_url: spotifyUrl,
    youtube_url: youtubeUrl,
    why_it_matters: whyItMatters,
    added_on: addedOn,
    associated_memory_id: associatedMemoryId,
    associated_memory_title: association.associatedMemoryTitle,
    artwork_media_id: artworkMediaId,
    is_our_song: isOurSong ? 1 : 0,
    created_at: now,
    updated_at: now,
  }), { status: 201 })
}

export const updateSong = async (request: Request, env: Env, songId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await ownedSong(env, session.relationship.id, songId)
  const body = asRecord(await readJson(request))
  if (body.isOurSong === false && current.is_our_song) {
    throw new ApiError(409, 'OUR_SONG_REQUIRED', 'Choose another entry as Our Song instead of clearing this one.')
  }
  const title = body.title === undefined ? current.title : requiredString(body.title, 'title', 1, 250)
  const artist = body.artist === undefined ? current.artist : requiredString(body.artist, 'artist', 1, 250)
  const spotifyUrl = body.spotifyUrl === undefined
    ? current.spotify_url
    : optionalHttpsUrl(body.spotifyUrl, 'spotifyUrl', SPOTIFY_HOSTS)
  const youtubeUrl = body.youtubeUrl === undefined
    ? current.youtube_url
    : optionalHttpsUrl(body.youtubeUrl, 'youtubeUrl', YOUTUBE_HOSTS)
  const whyItMatters = body.whyItMatters === undefined
    ? current.why_it_matters
    : (optionalString(body.whyItMatters, 'whyItMatters', 5_000) ?? '')
  const addedOn = body.addedOn === undefined ? current.added_on : phaseThreeDate(body, 'addedOn')
  const associatedMemoryId = body.associatedMemoryId === undefined
    ? current.associated_memory_id
    : optionalId(body.associatedMemoryId, 'associatedMemoryId')
  const artworkMediaId = body.artworkMediaId === undefined
    ? current.artwork_media_id
    : optionalId(body.artworkMediaId, 'artworkMediaId')
  const association = await validateAssociations(
    env,
    session.relationship.id,
    associatedMemoryId,
    artworkMediaId,
  )
  const makeOurSong = body.isOurSong === true
  const now = Date.now()
  const update = env.DB.prepare(`
    UPDATE songs SET title = ?, artist = ?, spotify_url = ?, youtube_url = ?, why_it_matters = ?,
      added_on = ?, associated_memory_id = ?, artwork_media_id = ?,
      is_our_song = CASE WHEN ? = 1 THEN 1 ELSE is_our_song END, updated_at = ?
    WHERE id = ? AND relationship_id = ?
  `).bind(
    title, artist, spotifyUrl, youtubeUrl, whyItMatters, addedOn, associatedMemoryId,
    artworkMediaId, makeOurSong ? 1 : 0, now, songId, session.relationship.id,
  )
  if (makeOurSong && !current.is_our_song) {
    await env.DB.batch([
      env.DB.prepare('UPDATE songs SET is_our_song = 0, updated_at = ? WHERE relationship_id = ? AND is_our_song = 1')
        .bind(now, session.relationship.id),
      update,
    ])
  } else {
    await update.run()
  }
  return apiSuccess(songResponse({
    ...current,
    title,
    artist,
    spotify_url: spotifyUrl,
    youtube_url: youtubeUrl,
    why_it_matters: whyItMatters,
    added_on: addedOn,
    associated_memory_id: associatedMemoryId,
    associated_memory_title: association.associatedMemoryTitle,
    artwork_media_id: artworkMediaId,
    is_our_song: makeOurSong ? 1 : current.is_our_song,
    updated_at: now,
  }))
}

export const deleteSong = async (request: Request, env: Env, songId: string): Promise<Response> => {
  const session = await requireSession(request, env)
  const current = await ownedSong(env, session.relationship.id, songId)
  if (!current.is_our_song) {
    await env.DB.prepare('DELETE FROM songs WHERE id = ? AND relationship_id = ?')
      .bind(songId, session.relationship.id).run()
    return apiSuccess({ deleted: true })
  }
  const successor = await env.DB.prepare(`
    SELECT id FROM songs WHERE relationship_id = ? AND id <> ?
    ORDER BY added_on DESC, created_at DESC LIMIT 1
  `).bind(session.relationship.id, songId).first<{ id: string }>()
  if (successor) {
    const now = Date.now()
    await env.DB.batch([
      env.DB.prepare('DELETE FROM songs WHERE id = ? AND relationship_id = ?')
        .bind(songId, session.relationship.id),
      env.DB.prepare('UPDATE songs SET is_our_song = 1, updated_at = ? WHERE id = ? AND relationship_id = ?')
        .bind(now, successor.id, session.relationship.id),
    ])
  } else {
    await env.DB.prepare('DELETE FROM songs WHERE id = ? AND relationship_id = ?')
      .bind(songId, session.relationship.id).run()
  }
  return apiSuccess({ deleted: true, promotedSongId: successor?.id ?? null })
}
