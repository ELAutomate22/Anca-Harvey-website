import { apiRequest } from '@/lib/api'
import type { SongInput, SoundtrackSong } from './types'

export const soundtrackService = {
  list: () => apiRequest<SoundtrackSong[]>('/api/songs'),
  create: (input: SongInput) => apiRequest<SoundtrackSong>('/api/songs', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  update: (id: string, input: Partial<SongInput>) => apiRequest<SoundtrackSong>(
    `/api/songs/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  ),
  delete: (id: string) => apiRequest<{ deleted: true; promotedSongId: string | null }>(
    `/api/songs/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  ),
}
