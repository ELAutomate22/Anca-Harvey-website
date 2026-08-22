import type { Game } from '@/types/content'

export const mockGames: Game[] = [
  { id: 'lanterns', title: 'Lantern Keepers', category: 'Co-op', players: '2 players', duration: '35 min', note: 'Keep the village glowing before the last bell.', motif: '✦' },
  { id: 'postcards', title: 'Postcards From Elsewhere', category: 'Cosy', players: '2 players', duration: '45 min', note: 'Build a shared journey from illustrated places.', motif: '◌' },
  { id: 'foxglove', title: 'Foxglove', category: 'Competitive', players: '2 players', duration: '25 min', note: 'A small strategy duel with very pretty consequences.', motif: '◇' },
  { id: 'midnight', title: 'Midnight Questions', category: 'Quick', players: '2 players', duration: '15 min', note: 'Unexpected prompts, no keeping score.', motif: '☾' },
]
