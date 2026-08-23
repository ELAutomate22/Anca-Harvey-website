export interface SoundtrackSong {
  id: string
  createdByUserId: string
  title: string
  artist: string
  spotifyUrl: string | null
  youtubeUrl: string | null
  whyItMatters: string
  addedOn: string
  associatedMemoryId: string | null
  associatedMemoryTitle: string | null
  artworkMediaId: string | null
  artworkUrl: string | null
  isOurSong: boolean
  createdAt: number
  updatedAt: number
}

export interface SongInput {
  title: string
  artist: string
  spotifyUrl: string
  youtubeUrl: string
  whyItMatters: string
  addedOn: string
  associatedMemoryId: string | null
  artworkMediaId?: string | null
  isOurSong: boolean
}
