export interface ApiErrorPayload {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

interface ApiSuccessPayload<T> {
  success: true
  data: T
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

const parsePayload = <T>(status: number, text: string): T => {
  let payload: ApiSuccessPayload<T> | ApiErrorPayload
  try {
    payload = JSON.parse(text) as ApiSuccessPayload<T> | ApiErrorPayload
  } catch {
    throw new ApiClientError(status, 'INVALID_RESPONSE', 'The server returned an unreadable response.')
  }
  if (!payload.success) {
    throw new ApiClientError(status, payload.error.code, payload.error.message, payload.error.details)
  }
  return payload.data
}

export const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers)
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  const text = await response.text()
  return parsePayload<T>(response.status, text)
}

export interface ApiUser {
  id: string
  email: string
  displayName: string
}

export type ApiProfile = ApiUser

export interface ApiRelationship {
  id: string
  title: string
  startDate: string
  timezone: string
  partner1UserId: string
  partner2UserId: string
}

export interface AuthSnapshot {
  user: ApiUser
  relationship: ApiRelationship
  profiles: ApiProfile[]
}

export interface MemoryMedia {
  id: string
  memoryId: string
  type: 'image' | 'video'
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  durationSeconds: number | null
  altText: string
  originalFilename: string
  sortOrder: number
  createdAt: number
  url: string
}

export interface ApiMemory {
  id: string
  title: string
  caption: string
  location: string
  date: string
  category: string
  favorite: boolean
  createdByUserId: string
  createdAt: number
  updatedAt: number
  media: MemoryMedia[]
}

export interface MemoryPage {
  items: ApiMemory[]
  nextCursor: string | null
}

export interface ApiTimelineEntry {
  id: string
  createdByUserId: string
  title: string
  description: string
  date: string
  eyebrow: string
  createdAt: number
  updatedAt: number
}

export const uploadMemoryMedia = (
  memoryId: string,
  file: File,
  altText: string,
  onProgress: (progress: number) => void,
): Promise<MemoryMedia> => new Promise((resolve, reject) => {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('altText', altText)

  const request = new XMLHttpRequest()
  request.open('POST', `/api/memories/${encodeURIComponent(memoryId)}/media`)
  request.withCredentials = true
  request.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
  })
  request.addEventListener('load', () => {
    try {
      resolve(parsePayload<MemoryMedia>(request.status, request.responseText))
    } catch (error) {
      reject(error)
    }
  })
  request.addEventListener('error', () => reject(new ApiClientError(0, 'NETWORK_ERROR', 'The upload could not reach the server.')))
  request.addEventListener('abort', () => reject(new ApiClientError(0, 'UPLOAD_ABORTED', 'The upload was cancelled.')))
  request.send(formData)
})
