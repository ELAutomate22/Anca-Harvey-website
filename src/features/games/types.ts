export interface SharedGame {
  id: string
  name: string
  category: string
  playerCount: string
  duration: string
  notes: string
  builtIn: boolean
  createdByUserId: string | null
  createdAt: number
  updatedAt: number
}

export type GameOutcome = 'partner_win' | 'draw' | 'cooperative_win' | 'no_winner'

export interface GameHistoryEntry {
  id: string
  gameId: string
  gameName: string
  gameCategory: string
  playedOn: string
  outcome: GameOutcome
  winnerUserId: string | null
  rating: number
  note: string
  createdByUserId: string
  createdAt: number
  updatedAt: number
}

export interface GameStats {
  gamesPlayed: number
  averageRating: number | null
  draws: number
  cooperativeWins: number
  noWinner: number
  partnerWins: Array<{ userId: string; wins: number }>
  mostPlayed: { id: string; name: string; playCount: number } | null
}

export interface GameInput {
  name: string
  category: string
  playerCount: string
  duration: string
  notes: string
}

export interface GameHistoryInput {
  gameId: string
  playedOn: string
  outcome: GameOutcome
  winnerUserId: string | null
  rating: number
  note: string
}
