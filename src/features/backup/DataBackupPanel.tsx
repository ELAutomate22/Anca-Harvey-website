import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Archive,
  Check,
  ChevronDown,
  CircleAlert,
  Database,
  Download,
  FileArchive,
  FileJson,
  HardDriveDownload,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ApiClientError } from '@/lib/api'
import {
  createBackup,
  loadBackupEstimate,
  loadBackupHistory,
  loadBackupJob,
  reauthenticateForBackup,
  startBrowserDownload,
} from './backup-service'
import type { BackupEstimate, BackupHistory, BackupJob, BackupType } from './types'

const formatBytes = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes)) return 'Unavailable'
  if (bytes === 0) return '0 bytes'
  const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** index)
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`
}

const formatTimestamp = (value: string): string => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value))

const jobStatusLabel: Record<BackupJob['status'], string> = {
  queued: 'Ready to download',
  preparing: 'Packaging and streaming',
  succeeded: 'Completed',
  failed: 'Could not complete',
  expired: 'Download window expired',
}

const initialEstimate: BackupEstimate = {
  estimatedBytes: 0,
  mediaFiles: 0,
  memories: 0,
  openedLetters: 0,
  estimateAvailable: false,
  recentAuthenticationValid: false,
}

const initialHistory: BackupHistory = { items: [], lastSuccessful: null }

const DataBackupPanel = () => {
  const [estimate, setEstimate] = useState(initialEstimate)
  const [history, setHistory] = useState(initialHistory)
  const [includeMyDrafts, setIncludeMyDrafts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<BackupType | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [activeJob, setActiveJob] = useState<BackupJob | null>(null)

  const refresh = useCallback(async () => {
    const [nextEstimate, nextHistory] = await Promise.all([
      loadBackupEstimate(includeMyDrafts),
      loadBackupHistory(),
    ])
    setEstimate(nextEstimate)
    setHistory(nextHistory)
  }, [includeMyDrafts])

  useEffect(() => {
    let active = true
    // This synchronizes the panel with authenticated server state; updates happen after the requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Backup information could not be loaded.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refresh])

  useEffect(() => {
    if (!activeJob || !['queued', 'preparing'].includes(activeJob.status)) return
    const timer = window.setInterval(() => {
      void loadBackupJob(activeJob.id).then((job) => {
        setActiveJob(job)
        if (job.status === 'succeeded') {
          setMessage(job.missingMediaFiles > 0
            ? `Backup completed with ${job.missingMediaFiles} missing media ${job.missingMediaFiles === 1 ? 'file' : 'files'}. The archive contains a warning report.`
            : 'Backup completed. Store this private archive somewhere you trust.')
          void refresh().catch(() => undefined)
        } else if (job.status === 'failed' || job.status === 'expired') {
          setError('We could not complete this backup. Your original memories have not been changed.')
          void refresh().catch(() => undefined)
        }
      }).catch(() => undefined)
    }, 1_500)
    return () => window.clearInterval(timer)
  }, [activeJob, refresh])

  const openFullConfirmation = () => {
    setPasswordRequired(!estimate.recentAuthenticationValid)
    setPassword('')
    setError('')
    setConfirmOpen(true)
  }

  const beginBackup = async (type: BackupType) => {
    setBusy(type)
    setError('')
    setMessage('')
    try {
      const result = await createBackup(type, includeMyDrafts)
      setActiveJob(result.job)
      if (!result.job.downloadUrl) {
        setMessage(result.reused
          ? 'A Full Backup is already being streamed for this relationship. Another large job was not started.'
          : 'This download request is no longer available. Create a new backup.')
        return
      }
      startBrowserDownload(result.job.downloadUrl)
      setConfirmOpen(false)
      setMessage(type === 'full'
        ? 'Your private Full Backup download has started. Keep this page open while the browser receives the archive.'
        : 'Your Data Only export has started. It contains JSON and CSV files without media binaries.')
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'RECENT_AUTH_REQUIRED') {
        setPasswordRequired(true)
        setConfirmOpen(true)
        setError('Please confirm your password before creating a Full Backup.')
      } else {
        setError(caught instanceof Error ? caught.message : 'The backup could not be started.')
      }
    } finally {
      setBusy(null)
    }
  }

  const confirmFullBackup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (passwordRequired) {
      setBusy('full')
      setError('')
      try {
        await reauthenticateForBackup(password)
        setEstimate((current) => ({ ...current, recentAuthenticationValid: true }))
        setPasswordRequired(false)
        setPassword('')
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Your password could not be confirmed.')
        setBusy(null)
        return
      }
      setBusy(null)
    }
    await beginBackup('full')
  }

  const historyItems = useMemo(() => history.items.slice(0, 5), [history.items])

  return (
    <div>
      <p className="editorial-rule">Data & Backup</p>
      <h2 className="balance mt-5 max-w-3xl font-display text-[clamp(2.8rem,7vw,5rem)] font-medium leading-[0.92]">Everything you add here belongs to you.</h2>
      <p className="mt-6 max-w-2xl text-muted">Download a portable, versioned copy of your shared relationship history. Backups are generated from explicit safe records—not a raw database dump.</p>

      <label className="mt-8 flex max-w-2xl cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-4">
        <input type="checkbox" checked={includeMyDrafts} onChange={(event) => { setLoading(true); setIncludeMyDrafts(event.target.checked) }} className="mt-1 size-5 accent-[var(--accent)]" />
        <span><span className="block font-bold">Include my private Letter drafts</span><span className="mt-1 block text-sm text-muted">Off by default. This can include only drafts created by the signed-in person—never the other partner’s drafts.</span></span>
      </label>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <article className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-6 sm:p-8">
          <FileJson size={25} className="text-accent" aria-hidden="true" />
          <h3 className="mt-5 font-display text-3xl sm:text-4xl">Export Data Only</h3>
          <p className="mt-3 text-sm leading-6 text-muted">Portable JSON and CSV relationship records without uploaded photo or video binaries.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.11em] text-muted"><span>Fast</span><span aria-hidden="true">·</span><span>Small download</span><span aria-hidden="true">·</span><span>Structured data</span></div>
          <CinematicButton onClick={() => void beginBackup('data')} variant="secondary" className="mt-8 w-full" disabled={busy !== null || loading}>
            {busy === 'data' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Export data
          </CinematicButton>
        </article>

        <article className="flex min-w-0 flex-col rounded-xl border border-accent/45 bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] p-6 sm:p-8">
          <HardDriveDownload size={25} className="text-accent" aria-hidden="true" />
          <h3 className="mt-5 font-display text-3xl sm:text-4xl">Download Full Backup</h3>
          <p className="mt-3 text-sm leading-6 text-muted">The same portable data together with every eligible original photo, video, and opened handwritten Letter page.</p>
          <div className="mt-6 grid grid-cols-2 gap-3 border-y border-line py-5 text-sm">
            <span className="text-muted">Estimated media</span><strong className="break-words text-right">{loading ? 'Loading…' : estimate.estimateAvailable ? formatBytes(estimate.estimatedBytes) : 'Unavailable'}</strong>
            <span className="text-muted">Eligible files</span><strong className="text-right">{loading ? '—' : estimate.mediaFiles}</strong>
            <span className="text-muted">Memories</span><strong className="text-right">{loading ? '—' : estimate.memories}</strong>
          </div>
          <CinematicButton onClick={openFullConfirmation} variant="romantic" className="mt-8 w-full" disabled={busy !== null || loading}>
            <FileArchive size={16} aria-hidden="true" /> Create Full Backup
          </CinematicButton>
        </article>
      </div>

      <details className="group mt-6 rounded-xl border border-line p-5 sm:p-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-bold"><span>What’s included—and what isn’t?</span><ChevronDown size={19} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
        <div className="mt-5 grid gap-6 border-t border-line pt-5 md:grid-cols-2">
          <div><h4 className="font-display text-2xl">Included</h4><ul className="mt-3 space-y-2 text-sm text-muted">{['Memories and original uploads', 'Timeline', 'Movie diary and watchlist', 'Game history', 'Relationship songs and links', 'Activities and Bucket List', 'Opened Future Letters', 'Safe metadata for sealed Letters'].map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{item}</li>)}</ul></div>
          <div><h4 className="font-display text-2xl">Never included</h4><ul className="mt-3 space-y-2 text-sm text-muted">{['Passwords or session information', 'Locked or unopened Letter content', 'The other partner’s private drafts', 'Developer website assets or source code', 'TMDB poster binaries', 'API credentials or private storage keys'].map((item) => <li key={item} className="flex gap-2"><X size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{item}</li>)}</ul></div>
        </div>
      </details>

      {activeJob && (
        <section aria-live="polite" aria-label="Current backup status" className="mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">Current backup</p><h3 className="mt-2 font-display text-2xl">{activeJob.type === 'full' ? 'Full Backup' : 'Data Only'}</h3></div><span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-bold"><Archive size={15} aria-hidden="true" />{jobStatusLabel[activeJob.status]}</span></div>
          {activeJob.status === 'preparing' && <p className="mt-4 flex items-center gap-2 text-sm text-muted"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />The Worker is packaging files one at a time and streaming them to your browser.</p>}
        </section>
      )}

      <section className="mt-8 border-y border-line py-6">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="editorial-rule">Backup history</p><h3 className="mt-3 font-display text-3xl">Recent requests</h3></div>{history.lastSuccessful && <p className="text-sm text-muted">Last successful: <strong className="text-foreground">{formatTimestamp(history.lastSuccessful.completedAt ?? history.lastSuccessful.createdAt)}</strong></p>}</div>
        {historyItems.length === 0 ? <p className="mt-5 text-sm text-muted">No backups have completed yet.</p> : <ul className="mt-5 divide-y divide-line">{historyItems.map((job) => <li key={job.id} className="grid min-w-0 gap-2 py-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-5"><span className="min-w-0"><strong className="block">{job.type === 'full' ? 'Full Backup' : 'Data Only'}</strong><span className="block break-words text-muted">Requested by {job.requestedBy.displayName} · format {job.formatVersion}</span></span><span className="text-muted">{formatBytes(job.archiveBytes ?? job.estimatedBytes)}</span><span className="font-bold">{jobStatusLabel[job.status]}</span></li>)}</ul>}
      </section>

      <div className="mt-6 grid gap-3 text-sm text-muted sm:grid-cols-3">
        <p className="flex gap-2"><Database size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />JSON is canonical; CSV is supplementary.</p>
        <p className="flex gap-2"><Video size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />Large media streams without whole-file buffering.</p>
        <p className="flex gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />Archives are private but not password-encrypted.</p>
      </div>

      <p role={error ? 'alert' : 'status'} aria-live="polite" className={`mt-7 min-h-6 text-sm font-semibold ${error ? 'text-[#8a2f2f]' : 'text-accent'}`}>{error || message}</p>

      <Modal open={confirmOpen} onClose={() => { if (!busy) setConfirmOpen(false) }} title="Download Full Backup?" panelClassName="max-w-2xl">
        <form onSubmit={(event) => void confirmFullBackup(event)}>
          <p className="text-muted">This private archive may contain photographs, videos, relationship notes, entertainment history, activities, and opened Future Letters.</p>
          <div className="mt-6 rounded-lg border border-line bg-surface p-5 text-sm"><p className="flex gap-2 font-bold"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />It will not contain passwords, locked Letter contents, the other partner’s drafts, or developer website assets.</p><p className="mt-3 text-muted">Estimated eligible media: {formatBytes(estimate.estimatedBytes)} across {estimate.mediaFiles} files.</p></div>
          {passwordRequired && <label className="mt-6 block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Confirm your password</span><input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /><span className="mt-2 block text-xs text-muted">Your password is verified by the existing authentication system and is never stored with the backup.</span></label>}
          <p className="mt-5 flex gap-2 text-sm text-muted"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />Direct streaming means an interrupted download must be started again with a new backup request.</p>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><CinematicButton type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy !== null}>Cancel</CinematicButton><CinematicButton type="submit" variant="romantic" disabled={busy !== null}>{busy === 'full' ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <HardDriveDownload size={16} aria-hidden="true" />} Create backup</CinematicButton></div>
        </form>
      </Modal>
    </div>
  )
}

export default DataBackupPanel
