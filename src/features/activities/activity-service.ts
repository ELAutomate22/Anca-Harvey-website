import { apiRequest } from '@/lib/api'
import type { Activity, ActivityFilters, ActivityHistoryEntry, ActivityInput, ActivityStats, ActivitySuggestion, PlannedActivity } from './types'

const query = (path: string, params: object) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => value !== undefined && search.set(key, String(value)))
  return `${path}${search.size ? `?${search.toString()}` : ''}`
}

export const activityService = {
  list: (filters: ActivityFilters & { saved?: boolean; hidden?: boolean } = {}) =>
    apiRequest<Activity[]>(query('/api/activities', filters)),
  random: (filters: ActivityFilters) => apiRequest<ActivitySuggestion>('/api/activities/random', {
    method: 'POST', body: JSON.stringify(filters),
  }),
  create: (input: ActivityInput) => apiRequest<Activity>('/api/activities', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: ActivityInput) => apiRequest<Activity>(`/api/activities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiRequest<{ deleted: true }>(`/api/activities/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  hide: (id: string) => apiRequest<{ hidden: true }>(`/api/activities/${encodeURIComponent(id)}/hide`, { method: 'POST' }),
  restore: (id: string) => apiRequest<{ hidden: false }>(`/api/activities/${encodeURIComponent(id)}/hide`, { method: 'DELETE' }),
  save: (id: string) => apiRequest<{ saved: true }>(`/api/activities/${encodeURIComponent(id)}/save`, { method: 'POST' }),
  unsave: (id: string) => apiRequest<{ saved: false }>(`/api/activities/${encodeURIComponent(id)}/save`, { method: 'DELETE' }),
  plans: (status: PlannedActivity['status'] | 'all' = 'all') => apiRequest<PlannedActivity[]>(query('/api/planned-activities', { status })),
  createPlan: (input: { activityId: string; plannedDate: string; plannedTime?: string; note?: string; suggestionId?: string }) =>
    apiRequest<PlannedActivity>('/api/planned-activities', { method: 'POST', body: JSON.stringify(input) }),
  updatePlan: (id: string, input: { plannedDate?: string; plannedTime?: string | null; note?: string }) =>
    apiRequest<PlannedActivity>(`/api/planned-activities/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  cancelPlan: (id: string) => apiRequest<PlannedActivity>(`/api/planned-activities/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  completePlan: (id: string, input: { completedDate?: string; rating?: number | null; notes?: string; createMemory?: boolean }) =>
    apiRequest<{ history: ActivityHistoryEntry; memoryId: string | null }>(`/api/planned-activities/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify(input) }),
  history: () => apiRequest<ActivityHistoryEntry[]>('/api/activity-history'),
  updateHistory: (id: string, input: { completedDate?: string; rating?: number | null; notes?: string }) =>
    apiRequest<ActivityHistoryEntry>(`/api/activity-history/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteHistory: (id: string) => apiRequest<{ deleted: true; linkedMemoryId: string | null }>(`/api/activity-history/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  stats: () => apiRequest<ActivityStats>('/api/activities/stats'),
}
