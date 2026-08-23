import { apiRequest } from '@/lib/api'
import type { GameHistoryEntry, GameHistoryInput, GameInput, GameStats, SharedGame } from './types'

export const gameService = {
  list: () => apiRequest<SharedGame[]>('/api/games?limit=250'),
  create: (input: GameInput) => apiRequest<SharedGame>('/api/games', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  update: (id: string, input: GameInput) => apiRequest<SharedGame>(`/api/games/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
  delete: (id: string) => apiRequest<{ deleted: true }>(`/api/games/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  history: () => apiRequest<GameHistoryEntry[]>('/api/games/history?limit=250'),
  createHistory: (input: GameHistoryInput) => apiRequest<GameHistoryEntry>('/api/games/history', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updateHistory: (id: string, input: GameHistoryInput) => apiRequest<GameHistoryEntry>(
    `/api/games/history/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  ),
  deleteHistory: (id: string) => apiRequest<{ deleted: true }>(
    `/api/games/history/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  ),
  stats: () => apiRequest<GameStats>('/api/games/stats'),
}
