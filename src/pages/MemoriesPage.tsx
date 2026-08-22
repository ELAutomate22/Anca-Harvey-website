import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Edit3, Heart, ImagePlus, LoaderCircle, Plus, Shuffle, Trash2, UploadCloud, X } from 'lucide-react'
import { formatDate } from '@/lib/date'
import {
  apiRequest,
  uploadMemoryMedia,
  type ApiMemory,
  type MemoryMedia,
  type MemoryPage,
} from '@/lib/api'
import { MemoryCard, type MemoryCardItem } from '@/components/media/MemoryCard'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition } from '@/components/ui/Page'

type Filter = 'All' | 'Photos' | 'Videos' | 'Favourites' | 'Trips' | 'Dates' | 'Funny' | 'Milestones'
const filters: Filter[] = ['All', 'Photos', 'Videos', 'Favourites', 'Trips', 'Dates', 'Funny', 'Milestones']

interface UploadState {
  id: string
  file: File
  progress: number
  status: 'waiting' | 'uploading' | 'complete' | 'error'
  error: string
}

interface MemoryFormState {
  title: string
  caption: string
  location: string
  date: string
  category: string
  favorite: boolean
}

const emptyForm = (): MemoryFormState => ({
  title: '',
  caption: '',
  location: '',
  date: new Date().toISOString().slice(0, 10),
  category: 'Dates',
  favorite: false,
})

const toCard = (memory: ApiMemory): MemoryCardItem => {
  const firstImage = memory.media.find((media) => media.type === 'image')
  const firstMedia = firstImage ?? memory.media[0]
  return {
    id: memory.id,
    title: memory.title,
    date: memory.date,
    category: memory.category,
    favorite: memory.favorite,
    mediaType: firstMedia?.type === 'video' ? 'video' : 'photo',
    image: firstMedia?.type === 'image' ? firstMedia.url : '',
    videoSrc: !firstImage && firstMedia?.type === 'video' ? firstMedia.url : undefined,
    alt: firstMedia?.altText || memory.title,
    aspect: firstMedia?.type === 'video' ? 'landscape' : 'portrait',
  }
}

const queryForFilter = (filter: string, cursor: string | null, sort: 'newest' | 'oldest') => {
  const params = new URLSearchParams({ limit: '20', sort })
  if (cursor) params.set('cursor', cursor)
  if (filter === 'Photos') params.set('mediaType', 'image')
  else if (filter === 'Videos') params.set('mediaType', 'video')
  else if (filter === 'Favourites') params.set('favorite', 'true')
  else if (!['All', 'Photos', 'Videos', 'Favourites'].includes(filter)) params.set('category', filter)
  return params
}

const MemoriesPage = () => {
  const [filter, setFilter] = useState<string>('All')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [memories, setMemories] = useState<ApiMemory[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<ApiMemory | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApiMemory | null>(null)
  const [form, setForm] = useState<MemoryFormState>(emptyForm)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const [createdMemoryId, setCreatedMemoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formMessage, setFormMessage] = useState('')

  const load = useCallback(async (cursor: string | null = null) => {
    if (cursor) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const page = await apiRequest<MemoryPage>(`/api/memories?${queryForFilter(filter, cursor, sort)}`)
      setMemories((current) => cursor ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Memories could not be loaded.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filter, sort])

  useEffect(() => {
    // This begins an external request; state updates occur only after the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const takeMeBack = () => {
    const random = memories[Math.floor(Math.random() * memories.length)]
    if (random) setSelected(random)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setUploads([])
    setCreatedMemoryId(null)
    setFormMessage('')
    setFormOpen(true)
  }

  const openEdit = (memory: ApiMemory) => {
    setEditing(memory)
    setForm({ title: memory.title, caption: memory.caption, location: memory.location, date: memory.date, category: memory.category, favorite: memory.favorite })
    setUploads([])
    setCreatedMemoryId(memory.id)
    setFormMessage('')
    setSelected(null)
    setFormOpen(true)
  }

  const selectFiles = (files: FileList | null) => {
    if (!files) return
    setUploads((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ id: crypto.randomUUID(), file, progress: 0, status: 'waiting' as const, error: '' })),
    ].slice(0, 12))
  }

  const updateUpload = (id: string, changes: Partial<UploadState>) => {
    setUploads((current) => current.map((upload) => upload.id === id ? { ...upload, ...changes } : upload))
  }

  const runUploads = async (memoryId: string, source: UploadState[]) => {
    let failures = 0
    for (const upload of source.filter((item) => item.status !== 'complete')) {
      updateUpload(upload.id, { status: 'uploading', progress: 0, error: '' })
      try {
        await uploadMemoryMedia(memoryId, upload.file, form.title, (progress) => updateUpload(upload.id, { progress }))
        updateUpload(upload.id, { status: 'complete', progress: 100 })
      } catch (caught) {
        failures += 1
        updateUpload(upload.id, { status: 'error', error: caught instanceof Error ? caught.message : 'Upload failed.' })
      }
    }
    return failures
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormMessage('')
    try {
      let memoryId = createdMemoryId
      if (!memoryId) {
        const created = await apiRequest<ApiMemory>('/api/memories', {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID().replaceAll('-', '') },
          body: JSON.stringify(form),
        })
        memoryId = created.id
        setCreatedMemoryId(memoryId)
      } else {
        await apiRequest<ApiMemory>(`/api/memories/${memoryId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        })
      }

      const failures = await runUploads(memoryId, uploads)
      if (failures > 0) {
        setFormMessage(`${failures} file${failures === 1 ? '' : 's'} could not be uploaded. The memory is saved; retry the failed files below.`)
      } else {
        setFormOpen(false)
        await load()
      }
    } catch (caught) {
      setFormMessage(caught instanceof Error ? caught.message : 'The memory could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const updateFavorite = async (memory: ApiMemory) => {
    try {
      const updated = await apiRequest<ApiMemory>(`/api/memories/${memory.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite: !memory.favorite }),
      })
      setMemories((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSelected(updated)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Favourite status could not be changed.')
    }
  }

  const removeMemory = async (memory: ApiMemory) => {
    if (!window.confirm(`Delete “${memory.title}” and all of its uploaded media? This cannot be undone.`)) return
    try {
      await apiRequest<{ deleted: true }>(`/api/memories/${memory.id}`, { method: 'DELETE' })
      setSelected(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The memory could not be deleted.')
    }
  }

  const removeMedia = async (memory: ApiMemory, media: MemoryMedia) => {
    if (!window.confirm(`Remove ${media.originalFilename} from this memory?`)) return
    try {
      await apiRequest<{ deleted: true }>(`/api/memories/${memory.id}/media/${media.id}`, { method: 'DELETE' })
      const updated = { ...memory, media: memory.media.filter((item) => item.id !== media.id) }
      setSelected(updated)
      setMemories((current) => current.map((item) => item.id === memory.id ? updated : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The media item could not be removed.')
    }
  }

  const customCategories = useMemo(
    () => [...new Set(memories.map((memory) => memory.category))].filter((category) => !filters.includes(category as Filter)),
    [memories],
  )

  return (
    <PageTransition>
      <PageHeader
        eyebrow="The memory shelf"
        title="Memories"
        intro="Photographs, moving moments, and the tiny notes that bring the whole day back—stored privately for the two of you."
        aside={<div className="mt-7 flex flex-wrap gap-3"><CinematicButton onClick={openCreate} variant="romantic"><Plus size={16} /> Add a memory</CinematicButton><CinematicButton onClick={takeMeBack} variant="secondary" disabled={!memories.length}><Shuffle size={16} /> Take Me Back</CinematicButton></div>}
      />

      <section className="mx-auto max-w-[1500px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-36">
        <div className="mb-8 flex flex-col gap-4 border-y border-line py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0">
            {[...filters, ...customCategories].map((item) => <button key={item} onClick={() => setFilter(item)} aria-pressed={filter === item} className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${filter === item ? 'border-accent bg-accent text-[#fff8ee]' : 'border-line text-muted hover:bg-elevated hover:text-foreground'}`}>{item}</button>)}
          </div>
          <label className="flex shrink-0 items-center gap-3 text-xs font-bold uppercase tracking-[0.12em] text-muted">Order<select value={sort} onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')} className="min-h-11 rounded-md border border-line bg-elevated px-3 text-foreground"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </div>

        <p role="status" className="mb-6 min-h-6 text-sm font-semibold text-accent">{error}</p>
        {loading ? <div className="grid min-h-72 place-items-center text-muted"><LoaderCircle className="animate-spin" /><span className="sr-only">Loading memories</span></div> : memories.length === 0 ? (
          <div className="paper-surface rounded-[var(--radius-lg)] px-6 py-20 text-center"><ImagePlus className="mx-auto text-accent" /><h2 className="mt-5 font-display text-4xl">The shelf is waiting.</h2><p className="mx-auto mt-4 max-w-lg text-muted">Add the first real memory. Its details live in D1 and its media stays private in R2.</p><CinematicButton onClick={openCreate} variant="romantic" className="mt-7"><Plus size={16} /> Add the first memory</CinematicButton></div>
        ) : <div className="memory-columns">{memories.map((memory) => <MemoryCard key={memory.id} memory={toCard(memory)} onOpen={() => setSelected(memory)} />)}</div>}

        {nextCursor && <div className="mt-10 text-center"><CinematicButton onClick={() => void load(nextCursor)} variant="secondary" disabled={loadingMore}>{loadingMore ? <LoaderCircle size={16} className="animate-spin" /> : null}{loadingMore ? 'Loading…' : 'Load more'}</CinematicButton></div>}
      </section>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? 'Memory'} panelClassName="sm:max-w-6xl">
        {selected && <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">{selected.media.length ? selected.media.map((media) => <figure key={media.id} className="group relative overflow-hidden rounded-lg bg-surface">{media.type === 'image' ? <img src={media.url} alt={media.altText || selected.title} className="max-h-[67dvh] h-full w-full object-cover" /> : <video src={media.url} controls playsInline preload="metadata" className="max-h-[67dvh] h-full w-full object-contain" aria-label={media.altText || selected.title} />}<button type="button" onClick={() => void removeMedia(selected, media)} className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-cinematic/85 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${media.originalFilename}`}><X size={16} /></button></figure>) : <div className="grid aspect-[4/3] place-items-center rounded-lg bg-surface text-muted sm:col-span-2">No media attached yet.</div>}</div>
          <div><p className="editorial-rule">{selected.category}</p><p className="mt-6 font-display text-3xl italic leading-tight sm:text-4xl">“{selected.caption || 'A moment worth keeping.'}”</p><p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-muted">{formatDate(selected.date)}{selected.location ? ` · ${selected.location}` : ''}</p>{selected.favorite && <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-accent"><Heart size={17} fill="currentColor" /> One of our favourites</p>}<div className="mt-8 grid gap-3"><CinematicButton onClick={() => void updateFavorite(selected)} variant="secondary"><Heart size={16} /> {selected.favorite ? 'Remove favourite' : 'Make favourite'}</CinematicButton><CinematicButton onClick={() => openEdit(selected)} variant="secondary"><Edit3 size={16} /> Edit memory</CinematicButton><CinematicButton onClick={() => void removeMemory(selected)} variant="danger"><Trash2 size={16} /> Delete memory</CinematicButton></div></div>
        </div>}
      </Modal>

      <Modal open={formOpen} onClose={() => !saving && setFormOpen(false)} title={editing ? 'Edit memory' : 'Add a memory'} panelClassName="sm:max-w-3xl">
        <form onSubmit={submit} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Title</span><input required maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Date</span><input type="date" required value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Category</span><input required maxLength={60} list="memory-categories" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /><datalist id="memory-categories"><option value="Trips" /><option value="Dates" /><option value="Funny" /><option value="Milestones" /></datalist></label><label className="block sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Location <span className="normal-case tracking-normal">(optional)</span></span><input maxLength={250} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><label className="block sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Caption</span><textarea maxLength={2000} rows={4} value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} className="mt-2 w-full rounded-md border border-line bg-surface p-4" /></label></div>
          <label className="flex min-h-12 items-center gap-3 rounded-md border border-line px-4"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm((current) => ({ ...current, favorite: event.target.checked }))} className="size-5 accent-[var(--accent)]" /><span className="font-semibold">Mark as a favourite</span></label>
          <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Photos & videos</p><label className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-5 text-center transition-colors hover:border-accent"><UploadCloud className="text-accent" /><span className="mt-2 font-semibold">Choose multiple files</span><span className="mt-1 text-xs text-muted">JPEG, PNG, WebP, AVIF up to 20 MB · MP4 or WebM up to 80 MB</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" className="sr-only" onChange={(event) => selectFiles(event.target.files)} /></label></div>
          {uploads.length > 0 && <ul aria-label="Selected uploads" aria-live="polite" className="space-y-3">{uploads.map((upload) => <li key={upload.id} className="rounded-md border border-line p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold">{upload.file.name}</span><span className="shrink-0 text-muted">{upload.status === 'error' ? 'Failed' : `${upload.progress}%`}</span></div><div role="progressbar" aria-label={`Upload progress for ${upload.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={upload.status === 'waiting' ? 0 : upload.progress} className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><span className={`block h-full transition-[width] ${upload.status === 'error' ? 'bg-[#8a2f2f]' : 'bg-accent'}`} style={{ width: `${upload.status === 'waiting' ? 0 : upload.progress}%` }} /></div>{upload.error && <p role="alert" className="mt-2 text-xs font-semibold text-accent">{upload.error}</p>}</li>)}</ul>}
          <p role="status" className="min-h-6 text-sm font-semibold text-accent">{formMessage}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><CinematicButton type="button" onClick={() => setFormOpen(false)} variant="ghost" disabled={saving}>Cancel</CinematicButton><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : editing ? <Edit3 size={16} /> : <Plus size={16} />}{saving ? 'Saving…' : createdMemoryId && uploads.some((item) => item.status === 'error') ? 'Retry failed uploads' : editing ? 'Save changes' : 'Save memory'}</CinematicButton></div>
        </form>
      </Modal>
    </PageTransition>
  )
}

export default MemoriesPage
