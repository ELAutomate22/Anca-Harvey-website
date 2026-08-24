import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Check, CircleDot, Dices, LoaderCircle, MapPinned, Pencil, Plane, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '@/features/auth/auth-context'
import { bucketListService } from '@/features/bucket-list/bucket-list-service'
import { bucketCategories, bucketLabels, bucketPriorities, bucketStatuses, type BucketInput, type BucketItem, type BucketStats, type BucketStatus } from '@/features/bucket-list/types'
import { uploadMemoryMedia } from '@/lib/api'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition } from '@/components/ui/Page'

type CategoryFilter = 'all' | BucketItem['category']
const fieldClass = 'mt-2 min-h-12 w-full rounded-md border border-line bg-background px-3 text-base text-foreground'
const today = () => new Date().toISOString().slice(0, 10)
const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase())
const emptyForm: BucketInput = { title: '', description: '', category: 'travel', status: 'dreaming', targetDate: null, location: '', priority: null }
const statusStyles: Record<BucketStatus, string> = {
  dreaming: 'border-accent-soft bg-accent-soft/15 text-accent', planning: 'border-gold bg-gold/10 text-[#765b31]', booked: 'border-[#556b65] bg-[#556b65]/10 text-[#455b55]', completed: 'border-accent bg-accent text-white',
}
const SelectField = ({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) => <label className="block text-sm font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>{children}</select></label>

const BucketListPage = () => {
  const auth = useAuth()
  const [items, setItems] = useState<BucketItem[]>([])
  const [stats, setStats] = useState<BucketStats | null>(null)
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [status, setStatus] = useState<'all' | BucketStatus>('all')
  const [randomPick, setRandomPick] = useState<BucketItem | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BucketItem | null>(null)
  const [form, setForm] = useState<BucketInput>(emptyForm)
  const [completing, setCompleting] = useState<BucketItem | null>(null)
  const [completion, setCompletion] = useState({ completedAt: today(), rating: '', note: '' })
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const profileName = useCallback((id: string | null) => auth.profiles.find((profile) => profile.id === id)?.displayName ?? 'Partner', [auth.profiles])
  const load = useCallback(async () => {
    setLoading(true)
    try { const [next, summary] = await Promise.all([bucketListService.list(), bucketListService.stats()]); setItems(next); setStats(summary); setError('') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The bucket list could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    // The state updates happen after the external requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  const visible = useMemo(() => items.filter((item) => (category === 'all' || item.category === category) && (status === 'all' || item.status === status)), [category, items, status])
  const run = async (action: () => Promise<void>, success?: string) => {
    setWorking(true); setError(''); setMessage('')
    try { await action(); if (success) setMessage(success) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'That change could not be saved.') }
    finally { setWorking(false) }
  }
  const openForm = (item?: BucketItem) => {
    setEditing(item ?? null)
    setForm(item ? { title: item.title, description: item.description, category: item.category,
      status: item.status === 'completed' ? undefined : item.status, targetDate: item.targetDate,
      location: item.location, priority: item.priority } : emptyForm)
    setFormOpen(true)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault(); void run(async () => {
      if (editing) await bucketListService.update(editing.id, form); else await bucketListService.create(form)
      setFormOpen(false); await load()
    }, editing ? 'Dream updated.' : 'A new dream joined the list.')
  }
  const remove = (item: BucketItem) => {
    if (window.confirm(`Delete “${item.title}”? Any linked Memory will stay in Memories.`)) void run(async () => { await bucketListService.remove(item.id); await load() }, 'Dream removed.')
  }
  const changeStatus = (item: BucketItem, next: Exclude<BucketStatus, 'completed'>) => run(async () => { await bucketListService.update(item.id, { status: next }); await load() }, `Moved to ${pretty(next)}.`)
  const pick = () => run(async () => { setRandomPick(await bucketListService.random()) })
  const submitCompletion = (event: FormEvent) => {
    event.preventDefault(); if (!completing) return
    void run(async () => {
      const result = await bucketListService.complete(completing.id, { completedAt: completion.completedAt,
        rating: completion.rating ? Number(completion.rating) : null, note: completion.note, createMemory: files.length > 0 })
      if (result.memoryId) for (const file of files) await uploadMemoryMedia(result.memoryId, file, completing.title, () => undefined)
      setCompleting(null); setFiles([]); await load()
    }, files.length ? 'Completed and added to Memories.' : 'Another dream became real.')
  }

  return <PageTransition>
    <PageHeader eyebrow="Someday, soon, done" title="Our Bucket List" intro="Big journeys, tiny rituals, and every dream that deserves a real place in your shared story." aside={<div className="mt-7 flex flex-wrap gap-3"><CinematicButton onClick={() => openForm()} variant="romantic"><Plus size={16} /> Add a dream</CinematicButton><CinematicButton onClick={() => void pick()} variant="secondary"><Dices size={16} /> Pick one</CinematicButton></div>} />
    <section className="mx-auto max-w-[1450px] px-5 pb-28 sm:px-8 lg:px-12">
      <div className="grid gap-8 border-y border-line py-7 lg:grid-cols-[1fr_2fr] lg:items-center"><div><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Dreams realised</span><strong className="mt-2 block font-display text-6xl">{stats?.completedCount ?? 0}<span className="text-3xl text-muted"> / {stats?.totalCount ?? 0}</span></strong></div><div><div className="flex justify-between text-xs font-bold uppercase tracking-[0.1em] text-muted"><span>Shared progress</span><span>{stats?.progressPercent ?? 0}%</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-line"><motion.span initial={{ width: 0 }} animate={{ width: `${stats?.progressPercent ?? 0}%` }} className="block h-full rounded-full bg-accent" /></div><p className="mt-3 text-sm text-muted">{stats?.planningCount ?? 0} planning · {stats?.bookedCount ?? 0} booked</p></div></div>
      <p role="status" aria-live="polite" className="mt-6 min-h-6 text-sm font-semibold text-accent">{message}</p>{error && <div role="alert" className="mt-4 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm font-semibold text-accent">{error}</div>}
      {randomPick && <motion.aside initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="cinematic-surface relative mt-6 overflow-hidden rounded-[var(--radius-lg)] p-7 sm:p-9"><Sparkles className="text-[#d7b77e]" /><p className="editorial-rule mt-5 !text-[#d7b77e]">Make this one happen</p><h2 className="mt-4 font-display text-5xl">{randomPick.title}</h2><p className="mt-4 max-w-2xl text-[#d8cec2]">{randomPick.description || 'Maybe today is the day to take the first step.'}</p><div className="mt-6 flex flex-wrap gap-3"><CinematicButton onClick={() => openForm(randomPick)} variant="romantic"><Pencil size={15} />Start planning</CinematicButton><CinematicButton onClick={() => void pick()} variant="ghost" className="!text-white"><Dices size={15} />Another pick</CinematicButton></div></motion.aside>}

      <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_auto]"><div className="no-scrollbar flex gap-2 overflow-x-auto pb-2"><button onClick={() => setCategory('all')} aria-pressed={category === 'all'} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold ${category === 'all' ? 'border-accent bg-accent text-white' : 'border-line text-muted'}`}>All</button>{bucketCategories.map((value) => <button key={value} onClick={() => setCategory(value)} aria-pressed={category === value} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold capitalize ${category === value ? 'border-accent bg-accent text-white' : 'border-line text-muted'}`}>{bucketLabels[value]}</button>)}</div><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="min-h-11 rounded-full border border-line bg-background px-4 text-sm"><option value="all">Every status</option>{bucketStatuses.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></div>
      {loading ? <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-accent" aria-label="Loading bucket list" /></div> : <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((item, index) => <motion.article key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }} className={`paper-surface relative flex min-h-[22rem] flex-col overflow-hidden rounded-[var(--radius-lg)] ${item.memoryImageUrl ? 'text-white' : 'p-7'}`}>
        {item.memoryImageUrl && <><img src={item.memoryImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#1b1412]/95 via-[#1b1412]/35 to-transparent" /></>}
        <div className={`relative z-10 flex h-full flex-col ${item.memoryImageUrl ? 'p-7' : ''}`}><div className="flex items-start justify-between gap-4"><span className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.11em] ${item.memoryImageUrl ? 'border-white/40 bg-black/20 text-white' : statusStyles[item.status]}`}>{pretty(item.status)}</span>{item.status === 'completed' ? <Check size={20} /> : item.category === 'travel' ? <Plane size={20} /> : <CircleDot size={20} />}</div><div className="mt-auto pt-14"><p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] opacity-70">{bucketLabels[item.category]}{item.priority ? ` · ${pretty(item.priority)}` : ''}</p><h2 className="mt-3 font-display text-[2.7rem] font-medium leading-[0.88]">{item.title}</h2><p className={`mt-4 text-sm ${item.memoryImageUrl ? 'text-white/75' : 'text-muted'}`}>{item.description || item.completionNote || `Added by ${profileName(item.createdByUserId)}`}</p>{item.targetDate && <p className="mt-3 text-xs font-bold">Target · {item.targetDate}</p>}
          <div className="mt-6 flex flex-wrap gap-2">{item.status !== 'completed' && <><select aria-label={`Move ${item.title} to status`} value={item.status} onChange={(event) => void changeStatus(item, event.target.value as Exclude<BucketStatus, 'completed'>)} className={`min-h-11 rounded-full border px-3 text-xs font-bold ${item.memoryImageUrl ? 'border-white/30 bg-black/30 text-white' : 'border-line bg-background'}`}>{bucketStatuses.filter((value) => value !== 'completed').map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select><button type="button" onClick={() => { setCompleting(item); setCompletion({ completedAt: today(), rating: '', note: '' }); setFiles([]) }} className={`min-h-11 rounded-full border px-4 text-xs font-bold ${item.memoryImageUrl ? 'border-white/30' : 'border-line'}`}><Check size={14} className="mr-2 inline" />Complete</button></>}<button type="button" onClick={() => openForm(item)} className={`grid size-11 place-items-center rounded-full border ${item.memoryImageUrl ? 'border-white/30' : 'border-line'}`} aria-label={`Edit ${item.title}`}><Pencil size={15} /></button><button type="button" onClick={() => remove(item)} className={`grid size-11 place-items-center rounded-full border ${item.memoryImageUrl ? 'border-white/30' : 'border-line text-accent'}`} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button></div>
        </div></div>
      </motion.article>)}</div>}
      {!loading && visible.length === 0 && <div className="mt-8 border-y border-line py-20 text-center"><MapPinned className="mx-auto text-accent" /><h2 className="mt-5 font-display text-5xl">A dream belongs here.</h2><p className="mt-3 text-muted">Change the filters or add the first one.</p></div>}
      {stats && stats.categories.length > 0 && <details className="mt-12 border-y border-line py-6"><summary className="cursor-pointer font-bold">Progress by category</summary><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{stats.categories.map((entry) => <div key={entry.category} className="rounded-md border border-line p-4"><span className="text-sm capitalize">{bucketLabels[entry.category]}</span><strong className="float-right">{entry.completed}/{entry.total}</strong></div>)}</div></details>}
    </section>

    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit the dream' : 'Add a dream'}><form onSubmit={submit} className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold sm:col-span-2">Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={fieldClass} /></label><label className="block text-sm font-bold sm:col-span-2">Description<textarea rows={4} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${fieldClass} py-3`} /></label><SelectField label="Category" value={form.category} onChange={(value) => setForm({ ...form, category: value as BucketInput['category'] })}>{bucketCategories.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</SelectField>{editing?.status === 'completed' ? <div className="rounded-md border border-line p-4 text-sm"><strong className="block">Completed</strong><span className="text-muted">Completion details stay intact unless reopened.</span></div> : <SelectField label="Status" value={form.status ?? 'dreaming'} onChange={(value) => setForm({ ...form, status: value as BucketInput['status'] })}>{bucketStatuses.filter((value) => value !== 'completed').map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</SelectField>}<label className="block text-sm font-bold">Target date (optional)<input type="date" value={form.targetDate ?? ''} onChange={(event) => setForm({ ...form, targetDate: event.target.value || null })} className={fieldClass} /></label><SelectField label="Priority" value={form.priority ?? ''} onChange={(value) => setForm({ ...form, priority: value ? value as BucketInput['priority'] : null })}><option value="">No priority</option>{bucketPriorities.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</SelectField><label className="block text-sm font-bold sm:col-span-2">Location (optional)<input maxLength={250} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className={fieldClass} /></label>{editing?.status === 'completed' && <label className="flex items-start gap-3 rounded-md border border-line p-4 text-sm sm:col-span-2"><input type="checkbox" className="mt-1" checked={form.status === 'dreaming'} onChange={(event) => setForm({ ...form, status: event.target.checked ? 'dreaming' : undefined })} /><span><strong className="block">Reopen this dream</strong>Saving as Dreaming removes completion details but keeps its linked Memory.</span></label>}<div className="sm:col-span-2 flex justify-end"><CinematicButton type="submit" variant="romantic" disabled={working}><Save size={16} />Save dream</CinematicButton></div></form></Modal>

    <Modal open={Boolean(completing)} onClose={() => setCompleting(null)} title={`Complete ${completing?.title ?? 'this dream'}`}><form onSubmit={submitCompletion} className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold">Completed on<input required type="date" value={completion.completedAt} onChange={(event) => setCompletion({ ...completion, completedAt: event.target.value })} className={fieldClass} /></label><SelectField label="Rating (optional)" value={completion.rating} onChange={(value) => setCompletion({ ...completion, rating: value })}><option value="">Not rated</option>{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</SelectField><label className="block text-sm font-bold sm:col-span-2">What made it special?<textarea rows={4} maxLength={5000} value={completion.note} onChange={(event) => setCompletion({ ...completion, note: event.target.value })} className={`${fieldClass} py-3`} /></label><label className="block rounded-md border border-dashed border-line p-5 text-sm font-bold sm:col-span-2"><Upload size={18} className="mb-3 text-accent" />Add photos to Memories (optional)<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="mt-3 block w-full text-sm font-normal" /><span className="mt-2 block font-normal text-muted">One private shared Memory is created for these files.</span></label><div className="sm:col-span-2 flex justify-end"><CinematicButton type="submit" variant="romantic" disabled={working}><Check size={16} />Mark complete</CinematicButton></div></form></Modal>
  </PageTransition>
}

export default BucketListPage
