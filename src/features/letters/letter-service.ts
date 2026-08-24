import { ApiClientError, apiRequest } from '@/lib/api'
import type {
  LetterDetailResponse,
  LetterDraftInput,
  LetterListResponse,
  LetterMedia,
  LetterMediaRole,
  LetterQuickDates,
  LetterSummary,
  LetterType,
  LetterUploadProgress,
} from './types'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

const parseUpload = <T>(status: number, text: string): T => {
  let payload: ApiEnvelope<T>
  try { payload = JSON.parse(text) as ApiEnvelope<T> }
  catch { throw new ApiClientError(status, 'INVALID_RESPONSE', 'The server returned an unreadable response.') }
  if (!payload.success || payload.data === undefined) {
    throw new ApiClientError(status, payload.error?.code ?? 'UPLOAD_FAILED', payload.error?.message ?? 'The upload failed.', payload.error?.details)
  }
  return payload.data
}

export const uploadLetterMedia = (
  letterId: string,
  file: File,
  role: LetterMediaRole,
  altText: string,
  onProgress: (progress: LetterUploadProgress) => void,
): Promise<LetterMedia> => new Promise((resolve, reject) => {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('role', role)
  formData.set('altText', altText)
  const request = new XMLHttpRequest()
  request.open('POST', `/api/letters/${encodeURIComponent(letterId)}/media`)
  request.withCredentials = true
  request.upload.addEventListener('progress', (event) => {
    if (!event.lengthComputable) return
    onProgress({ loaded: event.loaded, total: event.total, percent: Math.round((event.loaded / event.total) * 100) })
  })
  request.addEventListener('load', () => {
    try { resolve(parseUpload<{ media: LetterMedia }>(request.status, request.responseText).media) }
    catch (error) { reject(error) }
  })
  request.addEventListener('error', () => reject(new ApiClientError(0, 'NETWORK_ERROR', 'The upload could not reach the server.')))
  request.addEventListener('abort', () => reject(new ApiClientError(0, 'UPLOAD_ABORTED', 'The upload was cancelled.')))
  request.send(formData)
})

export const letterService = {
  list: () => apiRequest<LetterListResponse>('/api/letters'),
  summary: () => apiRequest<LetterSummary & { serverNow: number; timeZone: string }>('/api/letters/summary'),
  quickDates: () => apiRequest<LetterQuickDates>('/api/letters/quick-dates'),
  get: (id: string) => apiRequest<LetterDetailResponse>(`/api/letters/${encodeURIComponent(id)}`),
  create: (letterType: LetterType) => apiRequest<LetterDetailResponse>('/api/letters', {
    method: 'POST', body: JSON.stringify({ letterType }),
  }),
  update: (id: string, input: LetterDraftInput) => apiRequest<LetterDetailResponse>(`/api/letters/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }),
  seal: (id: string) => apiRequest<LetterDetailResponse>(`/api/letters/${encodeURIComponent(id)}/seal`, { method: 'POST' }),
  open: (id: string) => apiRequest<LetterDetailResponse>(`/api/letters/${encodeURIComponent(id)}/open`, { method: 'POST' }),
  remove: (id: string, confirmation: string) => apiRequest<{ deleted: true }>(`/api/letters/${encodeURIComponent(id)}`, {
    method: 'DELETE', body: JSON.stringify({ confirmation }),
  }),
  deleteMedia: (letterId: string, mediaId: string) => apiRequest<{ deleted: true }>(`/api/letters/${encodeURIComponent(letterId)}/media/${encodeURIComponent(mediaId)}`, { method: 'DELETE' }),
  reorderPages: (letterId: string, pageIds: string[]) => apiRequest<{ media: LetterMedia[] }>(`/api/letters/${encodeURIComponent(letterId)}/media/order`, {
    method: 'PATCH', body: JSON.stringify({ pageIds }),
  }),
}
