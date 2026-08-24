import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarCheck, Check, Clock3, Compass, EyeOff, Heart, History, LibraryBig, LoaderCircle, MapPin, Pencil, Plus, RotateCcw, Save, Trash2, Upload, WalletCards, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/features/auth/auth-context'
import { activityService } from '@/features/activities/activity-service'
import {
  activityBudgets, activityCategories, activityDurations, activityEnergies, activityLabels,
  activityLocations, type Activity, type ActivityFilters, type ActivityHistoryEntry,
  type ActivityInput, type ActivityStats, type ActivitySuggestion, type PlannedActivity,
} from '@/features/activities/types'
import { uploadMemoryMedia } from '@/lib/api'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition, Reveal } from '@/components/ui/Page'

type View = 'generator' | 'catalogue' | 'saved' | 'plans' | 'history'
const views: Array<{ id: View; label: string; icon: typeof Compass }> = [
  { id: 'generator', label: 'Generator', icon: Compass },
  { id: 'catalogue', label: 'Catalogue', icon: LibraryBig },
  { id: 'saved', label: 'Saved', icon: Heart },
  { id: 'plans', label: 'Plans', icon: CalendarCheck },
  { id: 'history', label: 'History', icon: History },
]
const emptyActivity: ActivityInput = { name: '', description: '', category: 'romantic', locationType: 'either', budgetLevel: 'one', energyLevel: 'normal', durationCategory: 'one_to_three_hours', notes: '' }
const today = () => new Date().toISOString().slice(0, 10)
const fieldClass = 'mt-2 min-h-12 w-full rounded-md border border-line bg-background px-3 text-base text-foreground'
const pretty = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase())

const SelectField = ({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) => (
  <label className="block text-sm font-bold">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>{children}</select></label>
)
const RatingField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <SelectField label="Rating (optional)" value={value} onChange={onChange}><option value="">Not rated</option>{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((rating) => <option key={rating} value={rating}>{rating} / 5</option>)}</SelectField>
)

const ActivitiesPage = () => {
  const auth = useAuth()
  const [view, setView] = useState<View>('generator')
  const [activities, setActivities] = useState<Activity[]>([])
  const [hidden, setHidden] = useState<Activity[]>([])
  const [plans, setPlans] = useState<PlannedActivity[]>([])
  const [history, setHistory] = useState<ActivityHistoryEntry[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [filters, setFilters] = useState<ActivityFilters>({ locationType: 'either' })
  const [suggestion, setSuggestion] = useState<ActivitySuggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [activityOpen, setActivityOpen] = useState(false)
  const [activityForm, setActivityForm] = useState<ActivityInput>(emptyActivity)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [planActivity, setPlanActivity] = useState<Activity | null>(null)
  const [editingPlan, setEditingPlan] = useState<PlannedActivity | null>(null)
  const [planForm, setPlanForm] = useState({ plannedDate: today(), plannedTime: '', note: '' })
  const [completionPlan, setCompletionPlan] = useState<PlannedActivity | null>(null)
  const [completionForm, setCompletionForm] = useState({ completedDate: today(), rating: '', notes: '' })
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [editingHistory, setEditingHistory] = useState<ActivityHistoryEntry | null>(null)

  const profileName = useCallback((id: string | null) => auth.profiles.find((profile) => profile.id === id)?.displayName ?? 'Partner', [auth.profiles])
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [catalogue, hiddenItems, planned, completed, summary] = await Promise.all([
        activityService.list(), activityService.list({ hidden: true }), activityService.plans('all'), activityService.history(), activityService.stats(),
      ])
      setActivities(catalogue); setHidden(hiddenItems); setPlans(planned); setHistory(completed); setStats(summary); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Date ideas could not be loaded.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    // The state updates happen after the external requests settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const saved = useMemo(() => activities.filter((activity) => activity.isSaved), [activities])
  const upcoming = useMemo(() => plans.filter((plan) => plan.status === 'planned'), [plans])
  const run = async (action: () => Promise<void>, success?: string) => {
    setWorking(true); setError(''); setMessage('')
    try { await action(); if (success) setMessage(success) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'That change could not be saved.') }
    finally { setWorking(false) }
  }
  const generate = () => run(async () => { setSuggestion(await activityService.random(filters)) })
  const toggleSaved = (activity: Activity) => run(async () => {
    if (activity.isSaved) await activityService.unsave(activity.id); else await activityService.save(activity.id)
    await load(); setSuggestion((current) => current?.activity.id === activity.id ? { ...current, activity: { ...current.activity, isSaved: !activity.isSaved } } : current)
  }, activity.isSaved ? 'Removed from saved ideas.' : 'Saved for later.')
  const hideIdea = (activity: Activity) => run(async () => { await activityService.hide(activity.id); setSuggestion(null); await load() }, 'Hidden from future suggestions.')

  const openActivityForm = (activity?: Activity) => {
    setEditingActivity(activity ?? null)
    setActivityForm(activity ? { name: activity.name, description: activity.description, category: activity.category, locationType: activity.locationType, budgetLevel: activity.budgetLevel, energyLevel: activity.energyLevel, durationCategory: activity.durationCategory, notes: activity.notes } : emptyActivity)
    setActivityOpen(true)
  }
  const submitActivity = (event: FormEvent) => {
    event.preventDefault(); void run(async () => {
      if (editingActivity) await activityService.update(editingActivity.id, activityForm); else await activityService.create(activityForm)
      setActivityOpen(false); await load()
    }, editingActivity ? 'Custom idea updated.' : 'Custom idea added.')
  }
  const removeActivity = (activity: Activity) => {
    if (window.confirm(`Delete “${activity.name}”? Existing plan and history references will stay intact.`)) void run(async () => { await activityService.remove(activity.id); await load() }, 'Custom idea removed.')
  }
  const openPlan = (activity: Activity, existing?: PlannedActivity) => {
    setPlanActivity(activity); setEditingPlan(existing ?? null)
    setPlanForm(existing ? { plannedDate: existing.plannedDate, plannedTime: existing.plannedTime ?? '', note: existing.note } : { plannedDate: today(), plannedTime: '', note: '' })
  }
  const submitPlan = (event: FormEvent) => {
    event.preventDefault(); if (!planActivity) return
    void run(async () => {
      if (editingPlan) await activityService.updatePlan(editingPlan.id, { ...planForm, plannedTime: planForm.plannedTime || null })
      else await activityService.createPlan({ activityId: planActivity.id, ...planForm, suggestionId: suggestion?.activity.id === planActivity.id ? suggestion.suggestionId : undefined })
      setPlanActivity(null); setEditingPlan(null); await load(); setView('plans')
    }, editingPlan ? 'Plan updated.' : 'It is in the calendar.')
  }
  const submitCompletion = (event: FormEvent) => {
    event.preventDefault(); if (!completionPlan) return
    void run(async () => {
      const result = await activityService.completePlan(completionPlan.id, { completedDate: completionForm.completedDate, rating: completionForm.rating ? Number(completionForm.rating) : null, notes: completionForm.notes, createMemory: completionFiles.length > 0 })
      if (result.memoryId) for (const file of completionFiles) await uploadMemoryMedia(result.memoryId, file, completionPlan.activityName, () => undefined)
      setCompletionPlan(null); setCompletionFiles([]); await load(); setView('history')
    }, completionFiles.length ? 'Completed and added to Memories.' : 'Activity marked complete.')
  }
  const editHistory = (entry: ActivityHistoryEntry) => { setEditingHistory(entry); setCompletionForm({ completedDate: entry.completedDate, rating: entry.rating?.toString() ?? '', notes: entry.notes }) }
  const submitHistory = (event: FormEvent) => {
    event.preventDefault(); if (!editingHistory) return
    void run(async () => { await activityService.updateHistory(editingHistory.id, { completedDate: completionForm.completedDate, rating: completionForm.rating ? Number(completionForm.rating) : null, notes: completionForm.notes }); setEditingHistory(null); await load() }, 'History updated.')
  }

  const card = (activity: Activity, catalogue: boolean) => <article key={activity.id} className="paper-surface flex min-h-64 flex-col rounded-[var(--radius-lg)] p-6">
    <div className="flex items-start justify-between gap-4"><span className="rounded-full border border-line px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">{activityLabels.category[activity.category]}</span><span className="text-xs text-muted">{activity.isBuiltin ? 'Starter' : `By ${profileName(activity.createdByUserId)}`}</span></div>
    <h3 className="mt-5 font-display text-4xl font-medium leading-[0.92]">{activity.name}</h3><p className="mt-4 text-sm text-muted">{activity.description || 'A blank page ready for the two of you.'}</p>
    <div className="mt-auto flex flex-wrap gap-2 pt-6"><button type="button" onClick={() => void toggleSaved(activity)} className="min-h-11 rounded-full border border-line px-4 text-xs font-bold"><Heart size={15} className="mr-2 inline" fill={activity.isSaved ? 'currentColor' : 'none'} />{activity.isSaved ? 'Saved' : 'Save'}</button><button type="button" onClick={() => openPlan(activity)} className="min-h-11 rounded-full border border-line px-4 text-xs font-bold"><CalendarCheck size={15} className="mr-2 inline" />Plan</button>{catalogue && !activity.isBuiltin && <><button type="button" aria-label={`Edit ${activity.name}`} onClick={() => openActivityForm(activity)} className="grid size-11 place-items-center rounded-full border border-line"><Pencil size={15} /></button><button type="button" aria-label={`Delete ${activity.name}`} onClick={() => removeActivity(activity)} className="grid size-11 place-items-center rounded-full border border-line text-accent"><Trash2 size={15} /></button></>}{catalogue && <button type="button" aria-label={`Hide ${activity.name}`} onClick={() => void hideIdea(activity)} className="grid size-11 place-items-center rounded-full border border-line"><EyeOff size={15} /></button>}</div>
  </article>

  return <PageTransition>
    <PageHeader eyebrow="A plan, at last" title="Date Ideas" intro="A shared catalogue that remembers what you love, what you hide, what you plan, and what became part of your story." aside={<CinematicButton onClick={() => openActivityForm()} variant="romantic" className="mt-7"><Plus size={16} /> Add your own</CinematicButton>} />
    <section className="mx-auto max-w-[1450px] px-5 pb-28 sm:px-8 lg:px-12">
      <div className="grid gap-3 border-y border-line py-6 sm:grid-cols-4">{[['Completed', stats?.completedCount ?? 0], ['Upcoming', stats?.plannedCount ?? 0], ['Average', stats?.averageRating ? `${stats.averageRating}/5` : '—'], ['Favourite mood', stats?.favoriteCategory ? pretty(stats.favoriteCategory) : 'Still discovering']].map(([label, value]) => <div key={label}><span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</span><strong className="mt-2 block font-display text-3xl">{value}</strong></div>)}</div>
      <div className="no-scrollbar my-8 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Date ideas views">{views.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-5 text-xs font-bold uppercase tracking-[0.1em] ${view === id ? 'border-accent bg-accent text-white' : 'border-line text-muted'}`}><Icon size={15} />{label}</button>)}</div>
      <p role="status" aria-live="polite" className="mb-5 min-h-6 text-sm font-semibold text-accent">{message}</p>{error && <div role="alert" className="mb-6 rounded-md border border-accent/30 bg-accent/5 p-4 text-sm font-semibold text-accent">{error}</div>}{loading && <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-accent" aria-label="Loading date ideas" /></div>}

      {!loading && view === 'generator' && <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
        <Reveal className="paper-surface rounded-[var(--radius-lg)] p-6 sm:p-8"><p className="editorial-rule">Set the mood</p><h2 className="mt-5 font-display text-4xl">What feels right?</h2><div className="mt-7 grid gap-5 sm:grid-cols-2">
          <SelectField label="Where" value={filters.locationType ?? 'either'} onChange={(value) => setFilters({ ...filters, locationType: value as ActivityFilters['locationType'] })}>{activityLocations.map((value) => <option key={value} value={value}>{activityLabels.location[value]}</option>)}</SelectField>
          <SelectField label="Budget" value={filters.budgetLevel ?? ''} onChange={(value) => setFilters({ ...filters, budgetLevel: value ? value as ActivityFilters['budgetLevel'] : undefined })}><option value="">Any budget</option>{activityBudgets.map((value) => <option key={value} value={value}>{activityLabels.budget[value]}</option>)}</SelectField>
          <SelectField label="Energy" value={filters.energyLevel ?? ''} onChange={(value) => setFilters({ ...filters, energyLevel: value ? value as ActivityFilters['energyLevel'] : undefined })}><option value="">Any energy</option>{activityEnergies.map((value) => <option key={value} value={value}>{activityLabels.energy[value]}</option>)}</SelectField>
          <SelectField label="Duration" value={filters.durationCategory ?? ''} onChange={(value) => setFilters({ ...filters, durationCategory: value ? value as ActivityFilters['durationCategory'] : undefined })}><option value="">Any length</option>{activityDurations.map((value) => <option key={value} value={value}>{activityLabels.duration[value]}</option>)}</SelectField>
          <div className="sm:col-span-2"><SelectField label="Category" value={filters.category ?? ''} onChange={(value) => setFilters({ ...filters, category: value ? value as ActivityFilters['category'] : undefined })}><option value="">Surprise us</option>{activityCategories.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</SelectField></div>
        </div><CinematicButton onClick={() => void generate()} disabled={working} variant="romantic" className="mt-8 w-full">{working ? <LoaderCircle size={17} className="animate-spin" /> : <Compass size={17} />} Find our date</CinematicButton></Reveal>
        <div className="flex min-h-[36rem] items-center"><AnimatePresence mode="wait">{suggestion ? <motion.article key={suggestion.suggestionId} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="cinematic-surface w-full rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-deep)] sm:p-12"><p className="editorial-rule !text-[#d7b77e]">Tonight’s idea · {pretty(suggestion.activity.category)}</p><h2 className="balance mt-7 font-display text-[clamp(3.5rem,7vw,7rem)] font-medium leading-[0.8]">{suggestion.activity.name}</h2><p className="mt-7 max-w-2xl text-lg text-[#d8cec2]">{suggestion.activity.description}</p><div className="mt-9 grid gap-3 border-y border-white/10 py-5 text-sm text-[#d8cec2] sm:grid-cols-3"><span><MapPin size={16} className="mr-2 inline" />{activityLabels.location[suggestion.activity.locationType]}</span><span><WalletCards size={16} className="mr-2 inline" />{activityLabels.budget[suggestion.activity.budgetLevel]}</span><span><Clock3 size={16} className="mr-2 inline" />{activityLabels.duration[suggestion.activity.durationCategory]}</span></div><div className="mt-8 flex flex-wrap gap-3"><CinematicButton onClick={() => openPlan(suggestion.activity)} variant="romantic"><Check size={16} /> We’re doing it</CinematicButton><CinematicButton onClick={() => void toggleSaved(suggestion.activity)} variant="ghost" className="!text-white"><Save size={16} />Save</CinematicButton><CinematicButton onClick={() => void generate()} variant="ghost" className="!text-white"><RotateCcw size={16} /> Another idea</CinematicButton><button type="button" onClick={() => void hideIdea(suggestion.activity)} className="min-h-12 px-3 text-xs font-bold uppercase text-white/60"><EyeOff size={15} className="mr-2 inline" />Hide</button></div></motion.article> : <div className="w-full border-y border-line py-24 text-center"><Compass className="mx-auto text-accent" /><h2 className="mt-6 font-display text-5xl">A plan is waiting.</h2><p className="mx-auto mt-4 max-w-md text-muted">Choose a mood, then let the shared catalogue do the rest.</p></div>}</AnimatePresence></div>
      </div>}

      {!loading && (view === 'catalogue' || view === 'saved') && <><p className="editorial-rule">{view === 'saved' ? 'Kept close' : 'The full archive'}</p><h2 className="mt-4 font-display text-5xl">{view === 'saved' ? `${saved.length} saved ideas` : `${activities.length} visible ideas`}</h2><div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{(view === 'saved' ? saved : activities).map((activity) => card(activity, view === 'catalogue'))}</div>{view === 'catalogue' && hidden.length > 0 && <details className="mt-12 border-y border-line py-6"><summary className="cursor-pointer font-bold">Hidden ideas ({hidden.length})</summary><div className="mt-5 grid gap-3 sm:grid-cols-2">{hidden.map((activity) => <div key={activity.id} className="flex items-center justify-between rounded-md border border-line p-4"><span>{activity.name}</span><button type="button" onClick={() => void run(async () => { await activityService.restore(activity.id); await load() }, 'Idea restored.')} className="min-h-11 rounded-full border border-line px-4 text-xs font-bold">Restore</button></div>)}</div></details>}</>}

      {!loading && view === 'plans' && <div><p className="editorial-rule">On the calendar</p><h2 className="mt-4 font-display text-5xl">{upcoming.length ? `${upcoming.length} dates ahead` : 'Nothing planned yet'}</h2><div className="mt-8 space-y-4">{plans.map((plan) => <article key={plan.id} className={`paper-surface grid gap-5 rounded-[var(--radius-lg)] p-6 md:grid-cols-[1fr_auto] ${plan.status !== 'planned' ? 'opacity-65' : ''}`}><div><span className="text-xs font-bold uppercase tracking-[0.13em] text-accent">{plan.status} · {plan.plannedDate}{plan.plannedTime ? ` at ${plan.plannedTime}` : ''}</span><h3 className="mt-3 font-display text-4xl">{plan.activityName}</h3><p className="mt-2 text-sm text-muted">{plan.note || `Planned by ${profileName(plan.createdByUserId)}`}</p></div>{plan.status === 'planned' && <div className="flex flex-wrap items-center gap-2"><CinematicButton variant="romantic" onClick={() => { setCompletionPlan(plan); setCompletionForm({ completedDate: today(), rating: '', notes: '' }); setCompletionFiles([]) }}><Check size={15} />Complete</CinematicButton><button type="button" aria-label={`Edit ${plan.activityName} plan`} onClick={() => { const activity = activities.find((item) => item.id === plan.activityId); if (activity) openPlan(activity, plan) }} className="grid size-12 place-items-center rounded-md border border-line"><Pencil size={16} /></button><button type="button" aria-label={`Cancel ${plan.activityName} plan`} onClick={() => void run(async () => { await activityService.cancelPlan(plan.id); await load() }, 'Plan cancelled.')} className="grid size-12 place-items-center rounded-md border border-line"><X size={17} /></button></div>}</article>)}</div></div>}

      {!loading && view === 'history' && <div><p className="editorial-rule">Dates we did</p><h2 className="mt-4 font-display text-5xl">Our activity history</h2><div className="mt-8 grid gap-5 md:grid-cols-2">{history.map((entry) => <article key={entry.id} className="paper-surface overflow-hidden rounded-[var(--radius-lg)]">{entry.memoryImageUrl && <img src={entry.memoryImageUrl} alt="" className="aspect-[16/8] w-full object-cover" />}<div className="p-6"><span className="text-xs font-bold uppercase tracking-[0.13em] text-accent">{entry.completedDate} · {entry.rating ? `${entry.rating}/5` : 'Not rated'}</span><h3 className="mt-3 font-display text-4xl">{entry.activityName}</h3><p className="mt-3 text-sm text-muted">{entry.notes || `Completed by ${profileName(entry.createdByUserId)}`}</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => editHistory(entry)} className="min-h-11 rounded-full border border-line px-4 text-xs font-bold"><Pencil size={14} className="mr-2 inline" />Edit</button><button type="button" onClick={() => { if (window.confirm('Delete this history entry? Any linked Memory stays in Memories.')) void run(async () => { await activityService.deleteHistory(entry.id); await load() }, 'History entry deleted.') }} className="grid size-11 place-items-center rounded-full border border-line text-accent" aria-label={`Delete history for ${entry.activityName}`}><Trash2 size={15} /></button></div></div></article>)}</div>{history.length === 0 && <p className="mt-8 text-muted">Completed plans will gather here.</p>}</div>}
    </section>

    <Modal open={activityOpen} onClose={() => setActivityOpen(false)} title={editingActivity ? 'Edit your idea' : 'Add your own idea'}><form onSubmit={submitActivity} className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold sm:col-span-2">Name<input required maxLength={150} value={activityForm.name} onChange={(event) => setActivityForm({ ...activityForm, name: event.target.value })} className={fieldClass} /></label><label className="block text-sm font-bold sm:col-span-2">Description<textarea rows={3} maxLength={2000} value={activityForm.description} onChange={(event) => setActivityForm({ ...activityForm, description: event.target.value })} className={`${fieldClass} py-3`} /></label><SelectField label="Category" value={activityForm.category} onChange={(value) => setActivityForm({ ...activityForm, category: value as ActivityInput['category'] })}>{activityCategories.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</SelectField><SelectField label="Where" value={activityForm.locationType} onChange={(value) => setActivityForm({ ...activityForm, locationType: value as ActivityInput['locationType'] })}>{activityLocations.map((value) => <option key={value} value={value}>{activityLabels.location[value]}</option>)}</SelectField><SelectField label="Budget" value={activityForm.budgetLevel} onChange={(value) => setActivityForm({ ...activityForm, budgetLevel: value as ActivityInput['budgetLevel'] })}>{activityBudgets.map((value) => <option key={value} value={value}>{activityLabels.budget[value]}</option>)}</SelectField><SelectField label="Energy" value={activityForm.energyLevel} onChange={(value) => setActivityForm({ ...activityForm, energyLevel: value as ActivityInput['energyLevel'] })}>{activityEnergies.map((value) => <option key={value} value={value}>{activityLabels.energy[value]}</option>)}</SelectField><SelectField label="Duration" value={activityForm.durationCategory} onChange={(value) => setActivityForm({ ...activityForm, durationCategory: value as ActivityInput['durationCategory'] })}>{activityDurations.map((value) => <option key={value} value={value}>{activityLabels.duration[value]}</option>)}</SelectField><label className="block text-sm font-bold sm:col-span-2">Private notes<textarea rows={3} maxLength={5000} value={activityForm.notes} onChange={(event) => setActivityForm({ ...activityForm, notes: event.target.value })} className={`${fieldClass} py-3`} /></label><div className="sm:col-span-2 flex justify-end"><CinematicButton type="submit" variant="romantic" disabled={working}><Save size={16} />Save idea</CinematicButton></div></form></Modal>
    <Modal open={Boolean(planActivity)} onClose={() => setPlanActivity(null)} title={editingPlan ? 'Edit the plan' : `Plan ${planActivity?.name ?? 'this date'}`}><form onSubmit={submitPlan} className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold">Date<input required type="date" value={planForm.plannedDate} onChange={(event) => setPlanForm((current) => ({ ...current, plannedDate: event.target.value }))} className={fieldClass} /></label><label className="block text-sm font-bold">Time (optional)<input type="time" value={planForm.plannedTime} onChange={(event) => setPlanForm((current) => ({ ...current, plannedTime: event.target.value }))} className={fieldClass} /></label><label className="block text-sm font-bold sm:col-span-2">Plan note<textarea rows={4} value={planForm.note} onChange={(event) => setPlanForm((current) => ({ ...current, note: event.target.value }))} className={`${fieldClass} py-3`} /></label><div className="sm:col-span-2 flex justify-end"><CinematicButton type="submit" variant="romantic" disabled={working}><CalendarCheck size={16} />Save the date</CinematicButton></div></form></Modal>
    <Modal open={Boolean(completionPlan)} onClose={() => setCompletionPlan(null)} title={`Complete ${completionPlan?.activityName ?? 'activity'}`}><form onSubmit={submitCompletion} className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold">Completed on<input required type="date" value={completionForm.completedDate} onChange={(event) => setCompletionForm({ ...completionForm, completedDate: event.target.value })} className={fieldClass} /></label><RatingField value={completionForm.rating} onChange={(value) => setCompletionForm({ ...completionForm, rating: value })} /><label className="block text-sm font-bold sm:col-span-2">A note<textarea rows={4} value={completionForm.notes} onChange={(event) => setCompletionForm({ ...completionForm, notes: event.target.value })} className={`${fieldClass} py-3`} /></label><label className="block rounded-md border border-dashed border-line p-5 text-sm font-bold sm:col-span-2"><Upload size={18} className="mb-3 text-accent" />Add photos to Memories (optional)<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setCompletionFiles(Array.from(event.target.files ?? []))} className="mt-3 block w-full text-sm font-normal" /><span className="mt-2 block font-normal text-muted">Files are attached to one shared private Memory.</span></label><div className="sm:col-span-2 flex justify-end"><CinematicButton type="submit" variant="romantic" disabled={working}><Check size={16} />Complete date</CinematicButton></div></form></Modal>
    <Modal open={Boolean(editingHistory)} onClose={() => setEditingHistory(null)} title="Edit activity history"><form onSubmit={submitHistory} className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-bold">Completed on<input required type="date" value={completionForm.completedDate} onChange={(event) => setCompletionForm({ ...completionForm, completedDate: event.target.value })} className={fieldClass} /></label><RatingField value={completionForm.rating} onChange={(value) => setCompletionForm({ ...completionForm, rating: value })} /><label className="block text-sm font-bold sm:col-span-2">Notes<textarea rows={4} value={completionForm.notes} onChange={(event) => setCompletionForm({ ...completionForm, notes: event.target.value })} className={`${fieldClass} py-3`} /></label><div className="sm:col-span-2 flex justify-end"><CinematicButton type="submit" variant="romantic">Save history</CinematicButton></div></form></Modal>
  </PageTransition>
}

export default ActivitiesPage
