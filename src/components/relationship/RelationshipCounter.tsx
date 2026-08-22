import { CalendarDays, Flag } from 'lucide-react'
import { RELATIONSHIP_START_DATE } from '@/config/relationship'
import { formatDate, getNextSixMonthMilestone, getRelationshipDuration, parseLocalDate } from '@/lib/date'

export const RelationshipCounter = ({ startDate = RELATIONSHIP_START_DATE }: { startDate?: string }) => {
  const start = parseLocalDate(startDate)
  const duration = getRelationshipDuration(start)
  const milestone = getNextSixMonthMilestone(start)

  return (
    <section aria-labelledby="together-heading" className="paper-surface relative overflow-hidden rounded-[var(--radius-lg)] p-6 sm:p-8 lg:p-10">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-accent-soft/25" aria-hidden="true" />
      <p id="together-heading" className="editorial-rule">Together for</p>
      <div className="mt-8 grid grid-cols-3 gap-3 border-b border-line pb-8 sm:gap-6">
        {[
          [duration.days.toLocaleString('en-GB'), 'days'],
          [duration.totalMonths.toLocaleString('en-GB'), 'months'],
          [duration.years.toLocaleString('en-GB'), 'years'],
        ].map(([value, label]) => (
          <div key={label}>
            <strong className="block font-display text-[clamp(2.5rem,7vw,5rem)] font-medium leading-none tabular-nums">{value}</strong>
            <span className="mt-2 block text-[0.67rem] font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-5 text-sm text-muted sm:grid-cols-2">
        <div className="flex gap-3">
          <Flag className="mt-0.5 shrink-0 text-accent" size={18} aria-hidden="true" />
          <span><strong className="block text-foreground">Next: {milestone.label}</strong>{milestone.daysRemaining} days to go</span>
        </div>
        <div className="flex gap-3">
          <CalendarDays className="mt-0.5 shrink-0 text-accent" size={18} aria-hidden="true" />
          <span><strong className="block text-foreground">Milestone date</strong>{formatDate(milestone.date)}</span>
        </div>
      </div>
    </section>
  )
}
