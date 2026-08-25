export type BackupType = 'data' | 'full'
export type BackupJobStatus = 'queued' | 'preparing' | 'succeeded' | 'failed' | 'expired'

export interface BackupEstimate {
  estimatedBytes: number
  mediaFiles: number
  memories: number
  openedLetters: number
  estimateAvailable: boolean
  recentAuthenticationValid: boolean
}

export interface BackupJob {
  id: string
  type: BackupType
  status: BackupJobStatus
  formatVersion: '1.0'
  requestedBy: { id: string; displayName: string }
  includeMyDrafts: boolean
  estimatedBytes: number | null
  archiveBytes: number | null
  plannedMediaFiles: number
  exportedMediaFiles: number
  missingMediaFiles: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  expiresAt: string
  downloadedAt: string | null
  downloadUrl: string | null
}

export interface BackupHistory {
  items: BackupJob[]
  lastSuccessful: BackupJob | null
}
