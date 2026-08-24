import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  Clock3,
  FileImage,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  MailOpen,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/features/auth/auth-context'
import { letterService, uploadLetterMedia } from '@/features/letters/letter-service'
import type {
  FutureLetter,
  LetterDraftInput,
  LetterListResponse,
  LetterMedia,
  LetterMediaRole,
  LetterQuickDates,
  LetterStatus,
  LetterType,
} from '@/features/letters/types'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition } from '@/components/ui/Page'

const fieldClass = 'mt-2 min-h-12 w-full rounded-md border border-line bg-background px-4 text-base text-foreground'
const steps = ['Letter', 'Recipient', 'Delivery', 'Preview'] as const
type Filter = 'all' | LetterStatus
type SaveState = 'idle' | 'saving' | 'saved' | 'failed'
type UploadState = 'uploading' | 'complete' | 'failed'
interface UploadTask { id: string; file: File; role: LetterMediaRole; progress: number; state: UploadState; error: string }

const emptyDraft = (): LetterDraftInput => ({
  title: '', typedContent: '', teaser: '', recipientType: null, recipientUserId: null,
  unlockDate: null, unlockTime: '00:00',
})

const localParts = (epoch: number, timeZone: string): { date: string; time: string } => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(epoch))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` }
}

const formFromLetter = (letter: FutureLetter, timeZone: string): LetterDraftInput => {
  const unlock = letter.unlockAt === null ? null : localParts(letter.unlockAt, timeZone)
  return {
    title: letter.title,
    typedContent: letter.typedContent ?? '',
    teaser: letter.teaser,
    recipientType: letter.recipientType,
    recipientUserId: letter.recipientUserId,
    unlockDate: unlock?.date ?? null,
    unlockTime: unlock?.time ?? '00:00',
  }
}

const formatMoment = (epoch: number | null, timeZone: string): string => {
  if (epoch === null) return 'Date not chosen'
  return new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(epoch))
}

const naturalDuration = (from: number, to: number): string => {
  const days = Math.max(0, Math.floor((to - from) / 86_400_000))
  if (days >= 730) return `${Math.floor(days / 365)} years`
  if (days >= 365) return '1 year'
  if (days >= 60) return `${Math.floor(days / 30)} months`
  if (days >= 30) return '1 month'
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

const Countdown = ({ unlockAt, serverNow, onElapsed }: { unlockAt: number; serverNow: number; onElapsed: () => void }) => {
  const anchor = useRef<{ serverNow: number; performanceNow: number } | null>(null)
  const [remaining, setRemaining] = useState(() => Math.max(0, unlockAt - serverNow))
  const elapsed = useRef(false)

  useEffect(() => {
    anchor.current = { serverNow, performanceNow: performance.now() }
    elapsed.current = false
    const update = () => {
      if (!anchor.current) return
      const estimatedServerNow = anchor.current.serverNow + performance.now() - anchor.current.performanceNow
      const next = Math.max(0, unlockAt - estimatedServerNow)
      setRemaining(next)
      if (next === 0 && !elapsed.current) { elapsed.current = true; onElapsed() }
    }
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [onElapsed, serverNow, unlockAt])

  const totalSeconds = Math.ceil(remaining / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  return <span>{days > 0 ? `${days}d ` : ''}{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
}

const statusLabel = (letter: FutureLetter, currentUserId: string): string => {
  if (letter.status !== 'ready') return letter.status
  if (letter.canOpen) return 'Ready to open'
  if (letter.recipientType === 'user' && letter.recipientUserId !== currentUserId) return `Ready for ${letter.recipientName ?? 'your partner'}`
  return 'Ready'
}

const LetterCard = ({
  letter, timeZone, serverNow, currentUserId, onEdit, onOpen, onView, onDelete, onElapsed,
}: {
  letter: FutureLetter
  timeZone: string
  serverNow: number
  currentUserId: string
  onEdit: () => void
  onOpen: () => void
  onView: () => void
  onDelete: () => void
  onElapsed: () => void
}) => {
  const available = letter.status === 'ready' && letter.canOpen
  return <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`paper-surface relative flex min-h-[26rem] flex-col overflow-hidden rounded-[var(--radius-lg)] p-6 sm:p-8 ${letter.status === 'sealed' ? 'opacity-90' : ''}`}>
    <div className="flex items-center justify-between gap-3 text-[0.67rem] font-bold uppercase tracking-[0.14em] text-muted">
      <span>{letter.senderName} → {letter.recipientName ?? 'Not chosen'}</span>
      <span className={letter.status === 'ready' ? 'text-accent' : ''}>{statusLabel(letter, currentUserId)}</span>
    </div>
    <div className="relative mx-auto mt-8 aspect-[16/10] w-full max-w-sm overflow-hidden rounded-md border border-[#bda98f] bg-[#d9c9b3] shadow-inner" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-[64%] [clip-path:polygon(0_100%,0_0,50%_58%,100%_0,100%_100%)] bg-[#cdb99f]" />
      <div className="absolute inset-x-0 top-0 z-20 h-[58%] [clip-path:polygon(0_0,100%_0,50%_100%)] bg-[#e4d6c1]" />
      <div className="absolute inset-x-[9%] top-[36%] z-10 h-[64%] rounded-sm bg-[#fffaf0] p-5 shadow-md">
        <p className="font-display text-xl italic text-[#5d4d42]">{letter.status === 'opened' ? (letter.teaser || 'Opened, and kept safe.') : letter.status === 'draft' ? 'Still being written…' : 'For later…'}</p>
      </div>
      <span className="absolute left-1/2 top-[48%] z-30 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-white shadow-md">
        {letter.status === 'opened' ? <MailOpen size={19} /> : letter.status === 'draft' ? <PenLine size={19} /> : <LockKeyhole size={18} />}
      </span>
    </div>
    <div className="mt-auto pt-7">
      <h2 className="font-display text-[2.5rem] font-medium leading-[0.9]">{letter.title || 'Untitled letter'}</h2>
      <p className="mt-4 flex items-start gap-2 text-sm text-muted"><CalendarDays size={16} className="mt-1 shrink-0 text-accent" /> {formatMoment(letter.unlockAt, timeZone)}</p>
      {letter.sealedAt !== null && <p className="mt-2 text-xs text-muted">Sealed {formatMoment(letter.sealedAt, timeZone)}</p>}
      {letter.teaser && letter.status !== 'draft' && <p className="mt-3 border-l border-gold pl-3 font-display text-lg italic text-muted">“{letter.teaser}”</p>}
      {letter.status === 'sealed' && letter.unlockAt !== null && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-muted"><Clock3 size={15} /><Countdown unlockAt={letter.unlockAt} serverNow={serverNow} onElapsed={onElapsed} /></p>}
      {letter.status === 'ready' && <p className="mt-3 text-sm text-muted">Written {naturalDuration(letter.createdAt, serverNow)} ago.</p>}
      {letter.status === 'opened' && letter.openedAt !== null && <p className="mt-3 text-sm text-muted">Written {formatMoment(letter.createdAt, timeZone)} · opened after {naturalDuration(letter.createdAt, letter.openedAt)}</p>}
      {letter.letterType === 'uploaded' && <p className="mt-2 text-xs text-muted">{letter.pageCount} handwritten {letter.pageCount === 1 ? 'page' : 'pages'}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        {letter.status === 'draft' && <CinematicButton onClick={onEdit} variant="secondary"><PenLine size={14} /> Continue</CinematicButton>}
        {available && <CinematicButton onClick={onOpen} variant="romantic"><MailOpen size={14} /> Open letter</CinematicButton>}
        {letter.status === 'opened' && <CinematicButton onClick={onView} variant="secondary"><MailOpen size={14} /> Read again</CinematicButton>}
        {letter.isMine && <button type="button" onClick={onDelete} className="grid size-12 place-items-center rounded-md border border-line text-accent" aria-label={`Delete ${letter.title || 'untitled letter'}`}><Trash2 size={15} /></button>}
      </div>
    </div>
  </motion.article>
}

const LetterViewer = ({ letter, timeZone }: { letter: FutureLetter; timeZone: string }) => {
  const pages = useMemo(() => (letter.media ?? []).filter((item) => item.role === 'page'), [letter.media])
  const cover = (letter.media ?? []).find((item) => item.role === 'cover')
  const [page, setPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const active = pages[page]
  return <div>
    <div className="mb-7 border-y border-line py-4 text-sm text-muted">
      <p>From <strong className="text-foreground">{letter.senderName}</strong> to <strong className="text-foreground">{letter.recipientName}</strong></p>
      <p className="mt-1">Written {formatMoment(letter.createdAt, timeZone)} · sealed {formatMoment(letter.sealedAt, timeZone)}</p>
      <p className="mt-1">Opened {formatMoment(letter.openedAt, timeZone)}{letter.firstOpenedByName ? ` by ${letter.firstOpenedByName}` : ''}{letter.openedAt ? ` · waited ${naturalDuration(letter.createdAt, letter.openedAt)}` : ''}</p>
    </div>
    {letter.letterType === 'typed' ? <article className="mx-auto max-w-3xl rounded-sm bg-[#fffaf0] p-7 text-[#352a26] shadow-[var(--shadow-soft)] sm:p-12">
      {cover && <img src={cover.url} alt={cover.altText || ''} className="mb-9 max-h-96 w-full object-cover" />}
      <h3 className="font-display text-4xl font-medium sm:text-5xl">{letter.title}</h3>
      <p className="mt-9 whitespace-pre-wrap font-display text-2xl leading-relaxed">{letter.typedContent}</p>
      <p className="mt-12 text-right font-display text-2xl italic">— {letter.senderName}</p>
    </article> : <div>
      {active ? <><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold">Page {page + 1} of {pages.length}</p><div className="flex gap-2"><button type="button" onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))} className="grid size-11 place-items-center rounded-full border border-line" aria-label="Zoom out"><ZoomOut size={17} /></button><button type="button" onClick={() => setZoom((value) => Math.min(2, value + 0.25))} className="grid size-11 place-items-center rounded-full border border-line" aria-label="Zoom in"><ZoomIn size={17} /></button></div></div><div className="mt-4 max-h-[58dvh] overflow-auto rounded-md bg-[#2a2421] p-3 text-center"><img src={active.url} alt={active.altText || `Handwritten letter page ${page + 1}`} style={{ width: `${zoom * 100}%` }} className="mx-auto h-auto max-w-none" /></div><div className="mt-5 flex items-center justify-between"><CinematicButton onClick={() => { setPage((value) => Math.max(0, value - 1)); setZoom(1) }} disabled={page === 0} variant="secondary"><ArrowLeft size={15} /> Previous</CinematicButton><CinematicButton onClick={() => { setPage((value) => Math.min(pages.length - 1, value + 1)); setZoom(1) }} disabled={page === pages.length - 1} variant="secondary">Next <ArrowRight size={15} /></CinematicButton></div><div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-2">{pages.map((item, index) => <button key={item.id} type="button" onClick={() => { setPage(index); setZoom(1) }} aria-label={`Show page ${index + 1}`} aria-pressed={page === index} className={`h-20 w-16 shrink-0 overflow-hidden rounded border-2 ${page === index ? 'border-accent' : 'border-transparent'}`}><img src={item.url} alt="" className="h-full w-full object-cover" /></button>)}</div></> : <p className="py-20 text-center text-muted">No pages are available.</p>}
    </div>}
  </div>
}

const HandwrittenPreview = ({ pages }: { pages: LetterMedia[] }) => {
  const [page, setPage] = useState(0)
  const active = pages[page]
  if (!active) return <p className="py-12 text-center text-[#6d5d55]">Your uploaded pages will appear here.</p>
  return <div className="mt-8"><div className="mb-3 flex items-center justify-between text-sm"><strong>Page {page + 1} of {pages.length}</strong><span className="text-[#6d5d55]">Handwritten preview</span></div><img src={active.url} alt={active.altText || `Handwritten letter page ${page + 1}`} className="mx-auto max-h-[55dvh] w-auto rounded object-contain shadow-md" /><div className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-11 items-center gap-2 rounded border border-[#d7cab9] px-3 text-sm font-bold disabled:opacity-40"><ArrowLeft size={14} /> Previous</button><button type="button" disabled={page === pages.length - 1} onClick={() => setPage((value) => Math.min(pages.length - 1, value + 1))} className="inline-flex min-h-11 items-center gap-2 rounded border border-[#d7cab9] px-3 text-sm font-bold disabled:opacity-40">Next <ArrowRight size={14} /></button></div></div>
}

const LettersPage = () => {
  const auth = useAuth()
  const [data, setData] = useState<LetterListResponse | null>(null)
  const [quickDates, setQuickDates] = useState<LetterQuickDates | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [active, setActive] = useState<FutureLetter | null>(null)
  const [form, setForm] = useState<LetterDraftInput>(emptyDraft)
  const [step, setStep] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [uploads, setUploads] = useState<UploadTask[]>([])
  const [viewer, setViewer] = useState<FutureLetter | null>(null)
  const lastSaved = useRef('')

  const timeZone = data?.timeZone ?? auth.relationship?.timezone ?? 'Europe/London'
  const load = useCallback(async () => {
    try {
      const [letters, dates] = await Promise.all([letterService.list(), letterService.quickDates()])
      setData(letters); setQuickDates(dates); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The time capsule could not be loaded.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => data?.items.filter((letter) => filter === 'all' || letter.status === filter) ?? [], [data?.items, filter])
  const counts = useMemo(() => ({
    all: data?.items.length ?? 0,
    draft: data?.items.filter((item) => item.status === 'draft').length ?? 0,
    sealed: data?.summary.sealedCount ?? 0,
    ready: data?.summary.readyCount ?? 0,
    opened: data?.summary.openedCount ?? 0,
  }), [data])

  const begin = async (letterType: LetterType, anniversary = false) => {
    setWorking(true); setError('')
    try {
      const result = await letterService.create(letterType)
      const nextForm = anniversary && quickDates
        ? { ...formFromLetter(result.letter, timeZone), recipientType: 'both' as const, recipientUserId: null, unlockDate: quickDates.nextAnniversary }
        : formFromLetter(result.letter, timeZone)
      setActive(result.letter); setForm(nextForm); setStep(0); setUploads([])
      lastSaved.current = JSON.stringify(nextForm); setSaveState('saved')
      await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The draft could not be created.') }
    finally { setWorking(false) }
  }

  const edit = async (letter: FutureLetter) => {
    setComposerOpen(true); setWorking(true); setError('')
    try {
      const result = await letterService.get(letter.id)
      const nextForm = formFromLetter(result.letter, timeZone)
      setActive(result.letter); setForm(nextForm); setStep(0); setUploads([]); setSaveState('saved'); lastSaved.current = JSON.stringify(nextForm)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The draft could not be opened.'); setComposerOpen(false) }
    finally { setWorking(false) }
  }

  const persist = useCallback(async (quiet = false): Promise<FutureLetter | null> => {
    if (!active || active.status !== 'draft') return null
    if (!quiet) setMessage('')
    setSaveState('saving')
    try {
      const result = await letterService.update(active.id, form)
      lastSaved.current = JSON.stringify(form); setActive(result.letter); setSaveState('saved')
      if (!quiet) setMessage('Draft saved privately.')
      return result.letter
    } catch (caught) {
      setSaveState('failed'); if (!quiet) setError(caught instanceof Error ? caught.message : 'The draft could not be saved.')
      return null
    }
  }, [active, form])

  useEffect(() => {
    if (!active || active.status !== 'draft' || JSON.stringify(form) === lastSaved.current) return
    setSaveState('idle')
    const timer = window.setTimeout(() => { void persist(true) }, 900)
    return () => window.clearTimeout(timer)
  }, [active, form, persist])

  const finishClosingComposer = () => { setComposerOpen(false); setActive(null); setUploads([]); void load() }
  const closeComposer = () => {
    if (active?.status === 'draft' && JSON.stringify(form) !== lastSaved.current) {
      void persist(true).then((saved) => {
        if (saved) finishClosingComposer()
        else setError('The draft is still open because its latest changes could not be saved.')
      })
      return
    }
    finishClosingComposer()
  }
  const updateForm = <K extends keyof LetterDraftInput>(key: K, value: LetterDraftInput[K]) => setForm((current) => ({ ...current, [key]: value }))

  const runUpload = async (task: UploadTask) => {
    if (!active) return
    setUploads((current) => current.map((item) => item.id === task.id ? { ...item, state: 'uploading', progress: 0, error: '' } : item))
    try {
      const media = await uploadLetterMedia(active.id, task.file, task.role, task.role === 'page' ? `Handwritten letter page ${((active.media ?? []).filter((item) => item.role === 'page').length + 1)}` : 'Letter cover', (progress) => {
        setUploads((current) => current.map((item) => item.id === task.id ? { ...item, progress: progress.percent } : item))
      })
      setActive((current) => current ? { ...current, media: [...(current.media ?? []), media], pageCount: current.pageCount + (media.role === 'page' ? 1 : 0) } : current)
      setUploads((current) => current.map((item) => item.id === task.id ? { ...item, state: 'complete', progress: 100 } : item))
    } catch (caught) {
      setUploads((current) => current.map((item) => item.id === task.id ? { ...item, state: 'failed', error: caught instanceof Error ? caught.message : 'Upload failed.' } : item))
    }
  }

  const chooseFiles = (event: ChangeEvent<HTMLInputElement>, role: LetterMediaRole) => {
    const files = [...(event.target.files ?? [])]
    const tasks = files.map<UploadTask>((file) => ({ id: crypto.randomUUID(), file, role, progress: 0, state: 'uploading', error: '' }))
    setUploads((current) => [...current, ...tasks])
    void (async () => { for (const task of tasks) await runUpload(task) })()
    event.target.value = ''
  }

  const removeMedia = async (media: LetterMedia) => {
    if (!active || !window.confirm(`Remove “${media.filename}” from this draft?`)) return
    setWorking(true)
    try {
      await letterService.deleteMedia(active.id, media.id)
      setActive((current) => current ? { ...current, media: (current.media ?? []).filter((item) => item.id !== media.id), pageCount: current.pageCount - (media.role === 'page' ? 1 : 0) } : current)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The page could not be removed.') }
    finally { setWorking(false) }
  }

  const movePage = async (mediaId: string, direction: -1 | 1) => {
    if (!active) return
    const pages = (active.media ?? []).filter((item) => item.role === 'page')
    const index = pages.findIndex((item) => item.id === mediaId); const target = index + direction
    if (index < 0 || target < 0 || target >= pages.length) return
    const reordered = [...pages]; const [moved] = reordered.splice(index, 1); if (!moved) return; reordered.splice(target, 0, moved)
    setWorking(true)
    try {
      const result = await letterService.reorderPages(active.id, reordered.map((item) => item.id))
      setActive((current) => current ? { ...current, media: result.media } : current)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The page order could not be saved.') }
    finally { setWorking(false) }
  }

  const seal = async () => {
    if (!active || uploads.some((task) => task.state !== 'complete')) { setError('Finish or retry every upload before sealing.'); return }
    const saved = await persist(true); if (!saved) return
    if (!window.confirm('Seal this letter permanently? Its contents, recipient, and unlock time cannot be changed after this.')) return
    setWorking(true); setError('')
    try { await letterService.seal(active.id); setMessage('The letter is sealed. It can no longer be edited.'); closeComposer() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The letter could not be sealed.') }
    finally { setWorking(false) }
  }

  const openLetter = async (letter: FutureLetter) => {
    setWorking(true); setError('')
    try { const result = await letterService.open(letter.id); setViewer(result.letter); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The letter could not be opened.') }
    finally { setWorking(false) }
  }

  const viewLetter = async (letter: FutureLetter) => {
    setWorking(true); setError('')
    try { setViewer((await letterService.get(letter.id)).letter) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The letter could not be loaded.') }
    finally { setWorking(false) }
  }

  const removeLetter = async (letter: FutureLetter) => {
    const confirmation = window.prompt(`Permanently delete “${letter.title || 'Untitled letter'}”? Type DELETE to confirm.`)
    if (confirmation !== 'DELETE') return
    setWorking(true); setError('')
    try { await letterService.remove(letter.id, confirmation); setMessage('The letter and its private uploads were permanently deleted.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The letter could not be deleted.') }
    finally { setWorking(false) }
  }

  const pages = (active?.media ?? []).filter((media) => media.role === 'page')
  const cover = (active?.media ?? []).find((media) => media.role === 'cover')
  const quickOptions: Array<[string, string]> = quickDates ? [
    ['Next anniversary', quickDates.nextAnniversary], ['Next six-month milestone', quickDates.nextMilestone],
    ['Six months from now', quickDates.sixMonthsFromNow], ['One year from now', quickDates.oneYearFromNow],
  ] : []

  return <PageTransition>
    <PageHeader eyebrow="Our time capsule" title="Letters to the Future" intro="Write something for the two of you, seal it, and let the right day give it back. Drafts stay private to their writer; sealed letters obey the server clock." aside={<CinematicButton onClick={() => { setComposerOpen(true); setActive(null); setForm(emptyDraft()); setStep(0) }} variant="romantic" className="mt-7"><Plus size={16} /> Create a letter</CinematicButton>} />
    <section className="mx-auto max-w-[1450px] px-5 pb-28 sm:px-8 lg:px-12">
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-3">
        <div className="bg-elevated p-6"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Waiting safely</span><strong className="mt-2 block font-display text-5xl">{counts.sealed}</strong></div>
        <div className="bg-elevated p-6"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Ready now</span><strong className="mt-2 block font-display text-5xl text-accent">{counts.ready}</strong></div>
        <div className="bg-elevated p-6"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Opened together</span><strong className="mt-2 block font-display text-5xl">{counts.opened}</strong></div>
      </div>
      <p role="status" aria-live="polite" className="mt-6 min-h-6 text-sm font-semibold text-accent">{working ? 'Working…' : message}</p>
      {error && <div role="alert" className="mt-3 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm font-semibold text-accent">{error}</div>}
      <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-2" aria-label="Filter letters">{(['all', 'draft', 'sealed', 'ready', 'opened'] as Filter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold capitalize ${filter === value ? 'border-accent bg-accent text-white' : 'border-line text-muted'}`}>{value} · {counts[value]}</button>)}</div>
      {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-accent" aria-label="Loading letters" /></div> : visible.length > 0 ? <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{visible.map((letter) => <LetterCard key={letter.id} letter={letter} timeZone={timeZone} serverNow={data?.serverNow ?? Date.now()} currentUserId={auth.user?.id ?? ''} onEdit={() => void edit(letter)} onOpen={() => void openLetter(letter)} onView={() => void viewLetter(letter)} onDelete={() => void removeLetter(letter)} onElapsed={() => void load()} />)}</div> : <div className="mt-8 border-y border-line py-20 text-center"><Inbox className="mx-auto text-accent" /><h2 className="mt-5 font-display text-5xl">Nothing in this chapter yet.</h2><p className="mt-3 text-muted">Choose another filter or send a new letter forward.</p></div>}
    </section>

    <Modal open={composerOpen} onClose={closeComposer} title={active ? (active.title || 'Untitled draft') : 'Begin a future letter'} panelClassName="sm:max-w-5xl">
      {!active ? <div><p className="max-w-2xl text-muted">Choose how this letter begins. A private draft is created for your account only.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><button type="button" disabled={working} onClick={() => void begin('typed')} className="paper-surface min-h-52 rounded-[var(--radius-lg)] p-7 text-left transition-colors hover:border-accent"><PenLine className="text-accent" /><strong className="mt-8 block font-display text-4xl">Type a letter</strong><span className="mt-3 block text-sm text-muted">Write in the editor and optionally add a cover image.</span></button><button type="button" disabled={working} onClick={() => void begin('uploaded')} className="paper-surface min-h-52 rounded-[var(--radius-lg)] p-7 text-left transition-colors hover:border-accent"><FileImage className="text-accent" /><strong className="mt-8 block font-display text-4xl">Upload handwriting</strong><span className="mt-3 block text-sm text-muted">Add up to 12 scans or photographs and arrange their reading order.</span></button></div>{quickDates && <button type="button" disabled={working} onClick={() => void begin('typed', true)} className="mt-4 flex min-h-16 w-full items-center justify-between gap-4 rounded-lg border border-gold/50 bg-gold/10 px-5 text-left"><span><strong className="block">Write to us for our next anniversary</strong><span className="text-sm text-muted">Both of us · {quickDates.nextAnniversary}</span></span><ArrowRight size={18} className="text-gold" /></button>}</div> : <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (step < 3) setStep((value) => value + 1) }}>
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto border-y border-line py-3">{steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} aria-current={step === index ? 'step' : undefined} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold ${step === index ? 'bg-accent text-white' : 'text-muted'}`}>{index + 1}. {label}</button>)}</div>
        {step === 0 && <div className="space-y-6"><label className="block text-sm font-bold">Letter title<input value={form.title} onChange={(event) => updateForm('title', event.target.value)} maxLength={200} className={fieldClass} placeholder="For the day we need this" /></label>{active.letterType === 'typed' ? <><label className="block text-sm font-bold">Your letter<textarea value={form.typedContent ?? ''} onChange={(event) => updateForm('typedContent', event.target.value)} maxLength={100000} rows={12} className="mt-2 w-full rounded-md border border-line bg-background p-4 font-display text-xl leading-relaxed" placeholder="Dear future us…" /></label><div><span className="block text-sm font-bold">Optional cover image</span>{cover ? <div className="mt-3 flex items-center gap-4 rounded-md border border-line p-3"><img src={cover.url} alt="" className="size-20 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{cover.filename}</span><button type="button" onClick={() => void removeMedia(cover)} className="grid size-11 place-items-center rounded-full border border-line text-accent" aria-label="Remove cover"><Trash2 size={15} /></button></div> : <label className="mt-3 flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-line text-sm font-semibold text-muted"><Upload size={18} /> Add JPEG, PNG, WebP, or AVIF<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => chooseFiles(event, 'cover')} className="sr-only" /></label>}</div></> : <div><div className="flex items-end justify-between gap-4"><div><span className="block text-sm font-bold">Handwritten pages</span><span className="text-sm text-muted">{pages.length} of 12 pages</span></div><label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-accent bg-accent px-4 text-xs font-bold uppercase tracking-[0.12em] text-white"><Upload size={15} /> Add pages<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => chooseFiles(event, 'page')} className="sr-only" /></label></div><div className="mt-4 space-y-3">{pages.map((media, index) => <div key={media.id} className="flex items-center gap-3 rounded-md border border-line p-3"><img src={media.url} alt="" className="h-20 w-16 rounded object-cover" /><span className="min-w-0 flex-1"><strong className="block text-sm">Page {index + 1}</strong><span className="block truncate text-xs text-muted">{media.filename}</span></span><button type="button" onClick={() => void movePage(media.id, -1)} disabled={index === 0 || working} className="grid size-10 place-items-center rounded-full border border-line disabled:opacity-40" aria-label={`Move page ${index + 1} up`}><ArrowUp size={14} /></button><button type="button" onClick={() => void movePage(media.id, 1)} disabled={index === pages.length - 1 || working} className="grid size-10 place-items-center rounded-full border border-line disabled:opacity-40" aria-label={`Move page ${index + 1} down`}><ArrowDown size={14} /></button><button type="button" onClick={() => void removeMedia(media)} className="grid size-10 place-items-center rounded-full border border-line text-accent" aria-label={`Remove page ${index + 1}`}><Trash2 size={14} /></button></div>)}</div></div>}
          {uploads.length > 0 && <div className="rounded-md border border-line p-4"><strong className="text-sm">Upload status</strong><div className="mt-3 space-y-3">{uploads.map((task) => <div key={task.id} className="text-sm"><div className="flex items-center justify-between gap-3"><span className="truncate">{task.file.name}</span><span className={task.state === 'failed' ? 'text-accent' : 'text-muted'}>{task.state === 'uploading' ? `${task.progress}%` : task.state}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><span className={`block h-full ${task.state === 'failed' ? 'bg-[#8a2f2f]' : 'bg-accent'}`} style={{ width: `${task.progress}%` }} /></div>{task.state === 'failed' && <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-accent">{task.error}</span><button type="button" onClick={() => void runUpload(task)} className="inline-flex items-center gap-1 text-xs font-bold text-accent"><RotateCcw size={12} /> Retry</button></div>}</div>)}</div></div>}
        </div>}
        {step === 1 && <div><fieldset><legend className="text-sm font-bold">Who should open it?</legend><div className="mt-4 grid gap-3 sm:grid-cols-3"><button type="button" onClick={() => setForm((current) => ({ ...current, recipientType: 'both', recipientUserId: null }))} aria-pressed={form.recipientType === 'both'} className={`min-h-32 rounded-lg border p-5 text-left ${form.recipientType === 'both' ? 'border-accent bg-accent/5' : 'border-line'}`}><Users size={19} /><strong className="mt-5 block">Both of us</strong></button>{auth.profiles.map((profile) => <button key={profile.id} type="button" onClick={() => setForm((current) => ({ ...current, recipientType: 'user', recipientUserId: profile.id }))} aria-pressed={form.recipientType === 'user' && form.recipientUserId === profile.id} className={`min-h-32 rounded-lg border p-5 text-left ${form.recipientType === 'user' && form.recipientUserId === profile.id ? 'border-accent bg-accent/5' : 'border-line'}`}><MailOpen size={19} /><strong className="mt-5 block">{profile.displayName}</strong></button>)}</div></fieldset><label className="mt-7 block text-sm font-bold">A sealed-envelope teaser <span className="font-normal text-muted">(optional and visible before opening)</span><textarea value={form.teaser} onChange={(event) => updateForm('teaser', event.target.value)} maxLength={500} rows={3} className={`${fieldClass} py-3`} placeholder="A small hint, without giving the letter away…" /></label></div>}
        {step === 2 && <div><p className="text-sm text-muted">Dates and times use <strong className="text-foreground">{timeZone}</strong>. If you leave the time at 00:00, the letter unlocks at the start of that local day.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{quickOptions.map(([label, value]) => <button key={label} type="button" onClick={() => updateForm('unlockDate', value)} aria-pressed={form.unlockDate === value} className={`rounded-md border p-4 text-left ${form.unlockDate === value ? 'border-accent bg-accent/5' : 'border-line'}`}><strong className="block">{label}</strong><span className="text-sm text-muted">{value}</span></button>)}</div><div className="mt-7 grid gap-5 sm:grid-cols-2"><label className="text-sm font-bold">Custom unlock date<input type="date" value={form.unlockDate ?? ''} onChange={(event) => updateForm('unlockDate', event.target.value || null)} className={fieldClass} /></label><label className="text-sm font-bold">Exact local time <span className="font-normal text-muted">(optional)</span><input type="time" value={form.unlockTime ?? '00:00'} onChange={(event) => updateForm('unlockTime', event.target.value)} className={fieldClass} /></label></div><div className="mt-7 rounded-md border border-gold/40 bg-gold/10 p-4 text-sm"><LockKeyhole size={17} className="mb-2 text-gold" /><strong className="block">The server—not this device—decides when the seal can open.</strong><span className="text-muted">Changing a phone or computer clock cannot unlock the letter early.</span></div></div>}
        {step === 3 && <div><div className="mx-auto max-w-3xl rounded-sm bg-[#fffaf0] p-7 text-[#352a26] shadow-[var(--shadow-soft)] sm:p-10">{cover && <img src={cover.url} alt="" className="mb-8 max-h-72 w-full object-cover" />}<p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a6860]">From {auth.user?.displayName} · For {form.recipientType === 'both' ? 'both of us' : auth.profiles.find((profile) => profile.id === form.recipientUserId)?.displayName ?? 'recipient not chosen'}</p><h3 className="mt-5 font-display text-5xl font-medium">{form.title || 'Untitled letter'}</h3>{active.letterType === 'typed' ? <p className="mt-8 max-h-96 overflow-y-auto whitespace-pre-wrap font-display text-2xl leading-relaxed">{form.typedContent || 'Your words will appear here.'}</p> : <HandwrittenPreview pages={pages} />}<div className="mt-9 border-t border-[#d7cab9] pt-5 text-sm text-[#6d5d55]"><p>Unlocks: {form.unlockDate ? `${form.unlockDate} at ${form.unlockTime || '00:00'} (${timeZone})` : 'Not chosen'}</p><p className="mt-1">After sealing, this letter cannot be edited.</p></div></div></div>}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6"><div className="flex items-center gap-3"><CinematicButton type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} variant="ghost"><ArrowLeft size={15} /> Back</CinematicButton><span role="status" aria-live="polite" className={`text-xs font-bold ${saveState === 'failed' ? 'text-accent' : 'text-muted'}`}>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? <><Check size={13} className="mr-1 inline" />Saved</> : saveState === 'failed' ? 'Save failed' : 'Unsaved changes'}</span></div><div className="flex flex-wrap gap-3"><CinematicButton type="button" onClick={() => void persist()} variant="secondary"><Save size={15} /> Save draft</CinematicButton>{step < 3 ? <CinematicButton type="submit" variant="primary">Next <ArrowRight size={15} /></CinematicButton> : <CinematicButton type="button" onClick={() => void seal()} disabled={working || uploads.some((task) => task.state !== 'complete')} variant="romantic"><LockKeyhole size={15} /> Seal permanently</CinematicButton>}</div></div>
      </form>}
    </Modal>
    <Modal open={viewer !== null} onClose={() => setViewer(null)} title={viewer?.title ?? 'Opened letter'} panelClassName="sm:max-w-6xl">{viewer && <LetterViewer letter={viewer} timeZone={timeZone} />}</Modal>
  </PageTransition>
}

export default LettersPage
