import { apiRequest } from '@/lib/api'
import type { RecapIndexResponse, RecapYearResponse, ThisDayResponse } from './types'

export const recapService = {
  index: (signal?: AbortSignal) => apiRequest<RecapIndexResponse>('/api/recap', { signal }),
  current: (signal?: AbortSignal) => apiRequest<RecapYearResponse>('/api/recap/current', { signal }),
  year: (yearNumber: number, signal?: AbortSignal) => apiRequest<RecapYearResponse>(
    `/api/recap/year/${yearNumber}`,
    { signal },
  ),
  thisDay: (signal?: AbortSignal) => apiRequest<ThisDayResponse>('/api/this-day', { signal }),
}
