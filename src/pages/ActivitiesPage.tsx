import { useMemo, useState } from 'react'
import { Check, Clock3, Compass, MapPin, RotateCcw, WalletCards } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { mockActivities } from '@/data/mockActivities'
import type { Activity, ActivityBudget, ActivityDuration, ActivityEnergy, ActivityPlace } from '@/types/content'
import { CinematicButton } from '@/components/ui/Button'
import { PageHeader, PageTransition, Reveal } from '@/components/ui/Page'

const Filters = <T extends string>({ label, values, value, onChange }: { label: string; values: readonly T[]; value: T; onChange: (value: T) => void }) => (
  <fieldset>
    <legend className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-muted">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {values.map((item) => <button type="button" key={item} onClick={() => onChange(item)} aria-pressed={value === item} className={`min-h-11 rounded-full border px-4 text-xs font-bold transition-colors ${value === item ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:bg-surface'}`}>{item}</button>)}
    </div>
  </fieldset>
)

const ActivitiesPage = () => {
  const [place, setPlace] = useState<ActivityPlace>('Either')
  const [budget, setBudget] = useState<ActivityBudget>('£')
  const [energy, setEnergy] = useState<ActivityEnergy>('Normal')
  const [duration, setDuration] = useState<ActivityDuration>('1–3 hours')
  const [result, setResult] = useState<Activity | null>(null)
  const [committed, setCommitted] = useState(false)

  const pool = useMemo(() => mockActivities.filter((activity) =>
    (place === 'Either' || activity.place === 'Either' || activity.place === place) &&
    activity.budget === budget && activity.energy === energy && activity.duration === duration,
  ), [place, budget, energy, duration])

  const plan = () => {
    const choices = pool.length ? pool : mockActivities.filter((activity) => place === 'Either' || activity.place === 'Either' || activity.place === place)
    const activity = choices[Math.floor(Math.random() * choices.length)] ?? mockActivities[0] ?? null
    setResult(activity)
    setCommitted(false)
  }

  return (
    <PageTransition>
      <PageHeader eyebrow="A plan, at last" title="Date Ideas" intro="Choose the shape of the day, then let the archive suggest something specific enough to actually do." />

      <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <Reveal className="paper-surface rounded-[var(--radius-lg)] p-6 sm:p-9">
            <h2 className="font-display text-4xl font-medium">Set the mood</h2>
            <div className="mt-8 space-y-7">
              <Filters label="Where" values={['Indoor', 'Outdoor', 'Either'] as const} value={place} onChange={setPlace} />
              <Filters label="Budget" values={['Free', '£', '££', '£££'] as const} value={budget} onChange={setBudget} />
              <Filters label="Energy" values={['Lazy', 'Normal', 'Adventurous'] as const} value={energy} onChange={setEnergy} />
              <Filters label="Duration" values={['Under 1 hour', '1–3 hours', 'Half day', 'Whole day'] as const} value={duration} onChange={setDuration} />
            </div>
            <CinematicButton onClick={plan} variant="romantic" className="mt-9 w-full"><Compass size={17} /> Plan our date</CinematicButton>
            <p className="mt-4 text-center text-xs text-muted">{pool.length ? `${pool.length} idea${pool.length === 1 ? '' : 's'} match exactly.` : 'No exact match; the reveal will make a nearby suggestion.'}</p>
          </Reveal>

          <div className="flex min-h-[38rem] items-center">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.article key={result.id} initial={{ opacity: 0, rotateX: 6, y: 22 }} animate={{ opacity: 1, rotateX: 0, y: 0 }} exit={{ opacity: 0, y: -12 }} className="cinematic-surface relative w-full overflow-hidden rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-deep)] sm:p-12">
                  <div className="absolute -right-14 -top-14 size-56 rounded-full border border-white/10" /><div className="absolute -right-5 -top-5 size-40 rounded-full border border-white/10" />
                  <p className="editorial-rule !text-[#d7b77e]">Tonight’s idea · {result.category}</p>
                  <h2 className="balance mt-8 max-w-3xl font-display text-[clamp(3.6rem,8vw,7.4rem)] font-medium leading-[0.8]">{result.title}</h2>
                  <p className="mt-7 max-w-2xl text-lg text-[#d8cec2]">{result.description}</p>
                  <div className="mt-10 grid gap-4 border-y border-white/10 py-6 text-sm text-[#d8cec2] sm:grid-cols-3"><span className="flex items-center gap-2"><MapPin size={17} /> {result.place}</span><span className="flex items-center gap-2"><WalletCards size={17} /> {result.budget}</span><span className="flex items-center gap-2"><Clock3 size={17} /> {result.duration}</span></div>
                  <div className="mt-8 flex flex-wrap gap-3"><CinematicButton onClick={() => setCommitted(true)} variant="romantic"><Check size={16} /> We’re doing it</CinematicButton><CinematicButton onClick={plan} variant="ghost" className="!text-white hover:!bg-white/5"><RotateCcw size={16} /> Another idea</CinematicButton></div>
                  <p aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold text-[#d7b77e]">{committed ? 'It’s a date. Saving arrives in Phase 2.' : ''}</p>
                </motion.article>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full border-y border-line py-20 text-center"><Compass className="mx-auto text-accent" size={28} strokeWidth={1.4} /><h2 className="mt-6 font-display text-5xl font-medium">A plan is waiting.</h2><p className="mx-auto mt-4 max-w-md text-muted">Set the mood, press the button, and reveal one locally selected idea.</p></motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </PageTransition>
  )
}

export default ActivitiesPage
