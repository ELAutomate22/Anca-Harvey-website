import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Clock3, Edit3, ImagePlus, LoaderCircle, LockKeyhole, Plus, Trash2, UploadCloud } from 'lucide-react'
import { motion, useScroll, useSpring } from 'framer-motion'
import { addCalendarMonths, formatDate, parseLocalDate } from '@/lib/date'
import { relationshipConfig } from '@/config/relationship'
import { useAuth } from '@/features/auth/auth-context'
import {
  apiRequest,
  uploadMemoryMedia,
  type ApiMemory,
  type ApiTimelineEntry,
  type MemoryPage,
} from '@/lib/api'
import type { TimelineEntry } from '@/types/content'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition, Reveal } from '@/components/ui/Page'
import { PhotoReveal } from '@/components/effects/PhotoReveal'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'

interface StoryEntry extends TimelineEntry {
  custom?: ApiTimelineEntry
  milestoneEditor?: boolean
  imageAlt?: string
}

interface TimelineForm {
  title: string
  description: string
  date: string
  eyebrow: string
}

const EIGHTEEN_MONTH_TITLE = 'One Year + Six Months'
const EIGHTEEN_MONTH_CATEGORY = 'Milestones'
const EIGHTEEN_MONTH_DESCRIPTION = 'Unwritten, waiting, and already ours to arrive at.'
const STORY_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const MAX_STORY_IMAGE_BYTES = 20 * 1024 * 1024

const findEighteenMonthMemory = async (): Promise<ApiMemory | null> => {
  let cursor: string | null = null
  do {
    const params = new URLSearchParams({ category: EIGHTEEN_MONTH_CATEGORY, limit: '50', sort: 'oldest' })
    if (cursor) params.set('cursor', cursor)
    const page: MemoryPage = await apiRequest<MemoryPage>(`/api/memories?${params.toString()}`)
    const match = page.items.find((memory) => memory.title === EIGHTEEN_MONTH_TITLE)
    if (match) return match
    cursor = page.nextCursor
  } while (cursor)
  return null
}

const toIsoDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const entryStatus = (date: string): TimelineEntry['status'] => {
  const difference = parseLocalDate(date).getTime() - new Date().setHours(0, 0, 0, 0)
  if (difference > 0) return 'upcoming'
  if (difference === 0) return 'current'
  return 'past'
}

const automaticTimeline = (startDate: string, eighteenMonthMemory: ApiMemory | null): StoryEntry[] => {
  const start = parseLocalDate(startDate)
  const eighteenMonthImage = eighteenMonthMemory?.media.find((media) => media.type === 'image')
  return [
    { id: 'automatic-beginning', title: 'The Beginning', eyebrow: 'Chapter I', date: toIsoDate(start), description: 'The day this shared story began—and the date every counter and milestone grows from.', image: '/assets/images/IMG-20260817-WA0032.jpg' },
    { id: 'automatic-six-months', title: 'Six Months', eyebrow: 'Chapter II', date: toIsoDate(addCalendarMonths(start, 6)), description: 'By then, the ordinary days had already become the part worth remembering.', image: '/assets/images/IMG-20260817-WA0013.jpg' },
    { id: 'automatic-one-year', title: 'One Year', eyebrow: 'Chapter III', date: toIsoDate(addCalendarMonths(start, 12)), description: 'A full year of shared routes, accidental traditions, and choosing each other again.', image: '/assets/images/IMG-20260817-WA0021.jpg' },
    {
      id: 'automatic-eighteen-months',
      title: EIGHTEEN_MONTH_TITLE,
      eyebrow: 'The next page',
      date: toIsoDate(addCalendarMonths(start, 18)),
      description: eighteenMonthMemory?.caption || EIGHTEEN_MONTH_DESCRIPTION,
      image: eighteenMonthImage?.url,
      imageAlt: eighteenMonthImage?.altText || eighteenMonthMemory?.caption || EIGHTEEN_MONTH_TITLE,
      milestoneEditor: true,
    },
  ].map((entry) => ({ ...entry, status: entryStatus(entry.date) }))
}

const emptyForm = (): TimelineForm => ({
  title: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  eyebrow: 'Our note',
})

const StoryPage = () => {
  const auth = useAuth()
  const reducedMotion = useReducedMotionPreference()
  const timelineRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: timelineRef, offset: ['start 72%', 'end 72%'] })
  const timelineProgress = useSpring(scrollYProgress, { stiffness: 95, damping: 24, mass: 0.45 })
  const startDate = auth.relationship?.startDate ?? relationshipConfig.startDate
  const [customEntries, setCustomEntries] = useState<ApiTimelineEntry[]>([])
  const [eighteenMonthMemory, setEighteenMonthMemory] = useState<ApiMemory | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [editing, setEditing] = useState<ApiTimelineEntry | null>(null)
  const [form, setForm] = useState<TimelineForm>(emptyForm)
  const [milestoneDescription, setMilestoneDescription] = useState(EIGHTEEN_MONTH_DESCRIPTION)
  const [milestoneFile, setMilestoneFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [timeline, milestone] = await Promise.all([
        apiRequest<ApiTimelineEntry[]>('/api/timeline'),
        findEighteenMonthMemory(),
      ])
      setCustomEntries(timeline)
      setEighteenMonthMemory(milestone)
      setMessage('')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Custom timeline entries could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // This begins an external request; state updates occur only after the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const entries = useMemo<StoryEntry[]>(() => [
    ...automaticTimeline(startDate, eighteenMonthMemory),
    ...customEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      eyebrow: entry.eyebrow,
      date: entry.date,
      description: entry.description,
      status: entryStatus(entry.date),
      custom: entry,
    })),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id)), [customEntries, eighteenMonthMemory, startDate])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setMessage('')
    setModalOpen(true)
  }

  const openEdit = (entry: ApiTimelineEntry) => {
    setEditing(entry)
    setForm({ title: entry.title, description: entry.description, date: entry.date, eyebrow: entry.eyebrow })
    setMessage('')
    setModalOpen(true)
  }

  const openMilestoneEditor = () => {
    setMilestoneDescription(eighteenMonthMemory?.caption || EIGHTEEN_MONTH_DESCRIPTION)
    setMilestoneFile(null)
    setUploadProgress(0)
    setMessage('')
    setMilestoneModalOpen(true)
  }

  const saveMilestone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!eighteenMonthMemory && !milestoneFile) {
      setMessage('Choose a photo for the one-year-and-six-month milestone.')
      return
    }
    if (milestoneFile && (!STORY_IMAGE_TYPES.has(milestoneFile.type) || milestoneFile.size > MAX_STORY_IMAGE_BYTES)) {
      setMessage('Choose a JPEG, PNG, WebP, or AVIF image no larger than 20 MB.')
      return
    }

    setSaving(true)
    setMessage('')
    const milestoneDate = toIsoDate(addCalendarMonths(parseLocalDate(startDate), 18))
    try {
      const memory = eighteenMonthMemory
        ? await apiRequest<ApiMemory>(`/api/memories/${encodeURIComponent(eighteenMonthMemory.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: EIGHTEEN_MONTH_TITLE,
              caption: milestoneDescription,
              date: milestoneDate,
              category: EIGHTEEN_MONTH_CATEGORY,
            }),
          })
        : await apiRequest<ApiMemory>('/api/memories', {
            method: 'POST',
            headers: { 'Idempotency-Key': crypto.randomUUID().replaceAll('-', '') },
            body: JSON.stringify({
              title: EIGHTEEN_MONTH_TITLE,
              caption: milestoneDescription,
              location: '',
              date: milestoneDate,
              category: EIGHTEEN_MONTH_CATEGORY,
              favorite: true,
            }),
          })

      if (milestoneFile) {
        const previousImage = eighteenMonthMemory?.media.find((media) => media.type === 'image')
        await uploadMemoryMedia(memory.id, milestoneFile, milestoneDescription || EIGHTEEN_MONTH_TITLE, setUploadProgress)
        if (previousImage) {
          await apiRequest<{ deleted: true }>(
            `/api/memories/${encodeURIComponent(memory.id)}/media/${encodeURIComponent(previousImage.id)}`,
            { method: 'DELETE' },
          )
        }
      }

      setEighteenMonthMemory(await apiRequest<ApiMemory>(`/api/memories/${encodeURIComponent(memory.id)}`))
      setMilestoneModalOpen(false)
      setMessage('The one-year-and-six-month chapter is saved in Our Story and Memories.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'The milestone could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      if (editing) {
        await apiRequest<ApiTimelineEntry>(`/api/timeline/${editing.id}`, { method: 'PATCH', body: JSON.stringify(form) })
      } else {
        await apiRequest<ApiTimelineEntry>('/api/timeline', { method: 'POST', body: JSON.stringify(form) })
      }
      setModalOpen(false)
      await load()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'The timeline entry could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (entry: ApiTimelineEntry) => {
    if (!window.confirm(`Delete “${entry.title}” from the timeline?`)) return
    try {
      await apiRequest<{ deleted: true }>(`/api/timeline/${entry.id}`, { method: 'DELETE' })
      await load()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'The timeline entry could not be deleted.')
    }
  }

  return (
    <PageTransition>
      <PageHeader eyebrow="The archive · Chapter by chapter" title="Our Story" intro="Automatic milestones grow from your saved relationship date. The routes, rooms, jokes, and quiet decisions in between are yours to add." aside={<CinematicButton onClick={openCreate} variant="romantic" className="mt-7"><Plus size={16} /> Add to our story</CinematicButton>} />
      <p role="status" className="mx-auto mb-6 min-h-6 max-w-[1400px] px-5 text-sm font-semibold text-accent sm:px-8 lg:px-12">{loading ? 'Opening the timeline…' : message}</p>

      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-36">
        <div ref={timelineRef} className="relative">
          <div className="absolute bottom-0 left-[0.78rem] top-0 w-px bg-line md:left-1/2" aria-hidden="true" />
          <motion.div style={{ scaleY: reducedMotion ? 1 : timelineProgress, transformOrigin: 'top' }} className="absolute bottom-0 left-[0.78rem] top-0 w-px bg-accent md:left-1/2" aria-hidden="true" />

          {entries.map((entry, index) => {
            const isLeft = index % 2 === 0
            const isUpcoming = entry.status === 'upcoming'
            return (
              <Reveal key={entry.id} className="relative grid gap-6 pb-20 pl-12 md:grid-cols-2 md:gap-20 md:pl-0 lg:pb-28">
                <div className={`timeline-node absolute left-0 top-1.5 z-10 grid size-7 place-items-center rounded-full border-2 bg-background md:left-1/2 md:-translate-x-1/2 ${isUpcoming ? 'timeline-node--future border-line text-muted' : 'border-accent text-accent'}`}><span className={`size-2 rounded-full ${isUpcoming ? 'bg-line' : 'bg-accent'}`} /></div>
                <article className={`${isLeft ? 'md:col-start-1 md:text-right' : 'md:col-start-2'} ${isUpcoming ? 'opacity-70' : ''}`}>
                  <p className="text-[0.7rem] font-bold uppercase tracking-[0.17em] text-accent">{entry.eyebrow}</p>
                  <h2 className="mt-3 font-display text-[clamp(2.7rem,6vw,5.3rem)] font-medium leading-[0.86]">{entry.title}</h2>
                  <p className="mt-4 text-sm font-semibold uppercase tracking-[0.12em] text-muted">{formatDate(entry.date)}</p>
                  <p className={`mt-5 max-w-xl text-base leading-7 text-muted md:text-lg ${isLeft ? 'md:ml-auto' : ''}`}>{entry.description}</p>
                  {isUpcoming && <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-muted"><LockKeyhole size={14} /> Upcoming</span>}
                  {entry.milestoneEditor && (
                    <div className={`mt-6 ${isLeft ? 'md:text-right' : ''}`}>
                      <CinematicButton type="button" onClick={openMilestoneEditor} variant={entry.image ? 'secondary' : 'romantic'}>
                        <ImagePlus size={16} /> {entry.image ? 'Edit photo & description' : 'Add photo & description'}
                      </CinematicButton>
                      <p className={`mt-2 text-xs text-muted ${isLeft ? 'md:ml-auto' : ''}`}>Saved privately with your shared Memories.</p>
                    </div>
                  )}
                  {entry.custom && <div className={`mt-6 flex flex-wrap gap-2 ${isLeft ? 'md:justify-end' : ''}`}><button type="button" onClick={() => openEdit(entry.custom!)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-xs font-bold uppercase tracking-[0.1em]"><Edit3 size={14} /> Edit</button><button type="button" onClick={() => void remove(entry.custom!)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-xs font-bold uppercase tracking-[0.1em] text-accent"><Trash2 size={14} /> Delete</button></div>}
                </article>
                {entry.image && <PhotoReveal delay={Math.min(index, 4) * 0.035} className={`mt-4 w-full max-w-md ${isLeft ? 'md:col-start-2 md:row-start-1' : 'md:col-start-1 md:row-start-1 md:ml-auto'}`}><motion.figure whileHover={reducedMotion ? undefined : { rotate: isLeft ? 1 : -1 }} className="paper-surface rounded-[var(--radius-md)] p-2.5"><div className="aspect-[4/3] overflow-hidden rounded-sm"><img src={entry.image} alt={entry.imageAlt ?? ''} loading="lazy" className="h-full w-full object-cover" /></div><figcaption className="flex items-center gap-2 px-2 pb-1 pt-3 font-display text-xl italic text-muted"><Clock3 size={15} /> {entry.eyebrow}</figcaption></motion.figure></PhotoReveal>}
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="cinematic-surface px-5 py-24 text-center sm:px-8 lg:py-36"><Reveal className="mx-auto max-w-4xl"><p className="editorial-rule mx-auto w-fit !text-[#d7b77e]">The line continues</p><h2 className="balance mt-7 font-display text-[clamp(3.5rem,8vw,7.5rem)] font-medium leading-[0.85]">The next chapter is still becoming a memory.</h2></Reveal></section>

      <Modal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Edit our note' : 'Add to our story'} panelClassName="sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-5"><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Title</span><input required maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Date</span><input type="date" required value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Small heading</span><input required maxLength={80} value={form.eyebrow} onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label></div><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">The story</span><textarea rows={5} maxLength={2000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-md border border-line bg-surface p-4" /></label><p role="status" className="min-h-6 text-sm font-semibold text-accent">{message}</p><div className="flex justify-end gap-3"><CinematicButton type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</CinematicButton><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{saving ? 'Saving…' : 'Save entry'}</CinematicButton></div></form>
      </Modal>

      <Modal open={milestoneModalOpen} onClose={() => !saving && setMilestoneModalOpen(false)} title="One Year + Six Months" panelClassName="sm:max-w-2xl">
        <form onSubmit={saveMilestone} className="space-y-5">
          <p className="text-sm leading-6 text-muted">Add the photo and words that should live directly on this chapter. The image is kept in private storage and also appears in Memories.</p>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Description</span>
            <textarea required rows={6} maxLength={2000} value={milestoneDescription} onChange={(event) => setMilestoneDescription(event.target.value)} className="mt-2 w-full rounded-md border border-line bg-surface p-4" placeholder="What did this chapter feel like?" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">{eighteenMonthMemory?.media.some((media) => media.type === 'image') ? 'Replace photo (optional)' : 'Milestone photo'}</span>
            <span className="mt-2 flex min-h-28 cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-line px-5 text-center text-sm font-semibold text-muted transition-colors hover:border-accent">
              <UploadCloud size={19} /> {milestoneFile ? milestoneFile.name : 'Choose JPEG, PNG, WebP, or AVIF'}
              <input type="file" required={!eighteenMonthMemory?.media.some((media) => media.type === 'image')} accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setMilestoneFile(event.target.files?.[0] ?? null)} className="sr-only" />
            </span>
          </label>
          {saving && milestoneFile && <div className="rounded-md border border-line p-4 text-sm"><div className="flex justify-between gap-4"><span>Uploading securely…</span><span>{uploadProgress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full bg-accent transition-[width]" style={{ width: `${uploadProgress}%` }} /></div></div>}
          <p role="status" aria-live="polite" className="min-h-6 text-sm font-semibold text-accent">{message}</p>
          <div className="flex flex-wrap justify-end gap-3"><CinematicButton type="button" variant="ghost" onClick={() => setMilestoneModalOpen(false)} disabled={saving}>Cancel</CinematicButton><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <ImagePlus size={16} />}{saving ? 'Saving chapter…' : 'Save chapter'}</CinematicButton></div>
        </form>
      </Modal>
    </PageTransition>
  )
}

export default StoryPage
