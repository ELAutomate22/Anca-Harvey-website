import { apiRequest } from '@/lib/api'
import type { BucketCategory, BucketInput, BucketItem, BucketStats, BucketStatus } from './types'

const listPath = (filters: { category?: BucketCategory; status?: BucketStatus }) => {
  const search = new URLSearchParams()
  if (filters.category) search.set('category', filters.category)
  if (filters.status) search.set('status', filters.status)
  return `/api/bucket-list${search.size ? `?${search.toString()}` : ''}`
}

export const bucketListService = {
  list: (filters: { category?: BucketCategory; status?: BucketStatus } = {}) => apiRequest<BucketItem[]>(listPath(filters)),
  create: (input: BucketInput) => apiRequest<BucketItem>('/api/bucket-list', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<BucketInput> & { status?: Exclude<BucketStatus, 'completed'> }) =>
    apiRequest<BucketItem>(`/api/bucket-list/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => apiRequest<{ deleted: true; linkedMemoryId: string | null }>(`/api/bucket-list/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  complete: (id: string, input: { completedAt?: string; rating?: number | null; note?: string; createMemory?: boolean }) =>
    apiRequest<{ item: BucketItem; memoryId: string | null }>(`/api/bucket-list/${encodeURIComponent(id)}/complete`, { method: 'POST', body: JSON.stringify(input) }),
  random: () => apiRequest<BucketItem>('/api/bucket-list/random'),
  stats: () => apiRequest<BucketStats>('/api/bucket-list/stats'),
}
