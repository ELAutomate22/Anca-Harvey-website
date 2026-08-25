import { apiRequest } from '@/lib/api'
import type { BackupEstimate, BackupHistory, BackupJob, BackupType } from './types'

export const loadBackupEstimate = (includeMyDrafts: boolean): Promise<BackupEstimate> =>
  apiRequest<BackupEstimate>(`/api/backup/estimate?includeMyDrafts=${includeMyDrafts ? 'true' : 'false'}`)

export const loadBackupHistory = (): Promise<BackupHistory> =>
  apiRequest<BackupHistory>('/api/backup/history')

export const loadBackupJob = (jobId: string): Promise<BackupJob> =>
  apiRequest<BackupJob>(`/api/backup/jobs/${encodeURIComponent(jobId)}`)

export const reauthenticateForBackup = (password: string): Promise<{ recentAuthenticationValid: true; validUntil: string }> =>
  apiRequest('/api/backup/reauthenticate', { method: 'POST', body: JSON.stringify({ password }) })

export const createBackup = (
  type: BackupType,
  includeMyDrafts: boolean,
): Promise<{ job: BackupJob; reused: boolean }> => apiRequest(`/api/backup/${type}`, {
  method: 'POST',
  body: JSON.stringify({ includeMyDrafts }),
})

export const startBrowserDownload = (url: string): void => {
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
}
