import { useEffect, useState } from 'react'
import { ArrowRight, CalendarHeart, Clock3, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CinematicLink } from '@/components/ui/Button'
import { PageTransition, Reveal } from '@/components/ui/Page'
import { recapService } from '@/features/recap/recap-service'
import type { RecapIndexResponse } from '@/features/recap/types'
import { formatDate } from '@/lib/date'

const RecapPage = () => {
  const [data, setData] = useState<RecapIndexResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    recapService.index(controller.signal)
      .then(setData)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'The archive could not assemble your years.')
      })
    return () => controller.abort()
  }, [])

  if (!data && !error) {
    return <PageTransition className="grid min-h-[70dvh] place-items-center bg-cinematic text-[#f8efe2]"><LoaderCircle className="animate-spin motion-reduce:animate-none" /><span className="sr-only">Assembling relationship years</span></PageTransition>
  }

  if (!data) {
    return <PageTransition className="grid min-h-[70dvh] place-items-center px-5 text-center"><div><p className="editorial-rule mx-auto w-fit">The archive paused</p><h1 className="mt-6 font-display text-5xl">Our years could not be opened.</h1><p role="alert" className="mx-auto mt-5 max-w-xl text-muted">{error}</p></div></PageTransition>
  }

  const currentProgress = Math.min(100, Math.round((data.currentYear.daysIntoYear / data.currentYear.daysInYear) * 100))
  const comparison = data.comparison

  return (
    <PageTransition className="bg-cinematic text-[#f8efe2]">
      <section className="relative min-h-[calc(92dvh-var(--nav-height))] overflow-hidden px-5 py-24 sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgb(148_82_72/0.3),transparent_34%),radial-gradient(circle_at_10%_80%,rgb(198_160_104/0.17),transparent_32%)]" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[65dvh] max-w-[1500px] flex-col justify-between">
          <div className="flex items-center justify-between gap-6 border-b border-white/10 pb-5 text-xs font-bold uppercase tracking-[0.16em] text-[#d7b77e]">
            <span>Anniversary archive</span><span>{data.relationship.profiles.map((profile) => profile.displayName).join(' & ')}</span>
          </div>
          <div className="max-w-6xl py-20">
            <p className="editorial-rule !text-[#d7b77e]">Every chapter, counted from {formatDate(data.relationship.startDate)}</p>
            <h1 className="balance mt-8 font-display text-[clamp(5rem,14vw,13rem)] font-medium leading-[0.7] tracking-[-0.06em]">Our Years</h1>
            <p className="mt-10 max-w-2xl text-lg leading-8 text-[#d8cec2] sm:text-xl">Not calendar years. The chapters that begin and end on the date your story did.</p>
          </div>
          <a href="#chapters" className="inline-flex min-h-12 w-fit items-center gap-3 text-xs font-bold uppercase tracking-[0.15em] text-[#d7b77e]">Open the chapters <ArrowRight size={16} className="rotate-90" aria-hidden="true" /></a>
        </div>
      </section>

      <section id="chapters" className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
        <Reveal className="grid gap-8 rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.035] p-7 sm:p-10 lg:grid-cols-[1.2fr_0.8fr] lg:p-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Being written now</p>
            <h2 className="mt-6 font-display text-[clamp(4rem,9vw,8.5rem)] font-medium leading-[0.78]">{data.currentYear.label}</h2>
            <p className="mt-7 max-w-xl text-lg text-[#d8cec2]">{formatDate(data.currentYear.startDate)} — {formatDate(data.currentYear.endDate)}</p>
            <CinematicLink to={`/recap/year/${data.currentYear.yearNumber}`} variant="secondary" className="mt-9 !border-white/20 !text-white hover:!bg-white/5">Enter this chapter <ArrowRight size={16} aria-hidden="true" /></CinematicLink>
          </div>
          <div className="flex flex-col justify-end rounded-[var(--radius-md)] bg-[#efe4d3] p-7 text-foreground sm:p-9">
            <Clock3 size={22} className="text-accent" aria-hidden="true" />
            <strong className="mt-8 font-display text-7xl font-medium leading-none">{data.currentYear.daysIntoYear}</strong>
            <span className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">days in this chapter</span>
            <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`${data.currentYear.label} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={currentProgress}><span className="block h-full bg-accent" style={{ width: `${currentProgress}%` }} /></div>
            <span className="mt-3 text-sm text-muted">{currentProgress}% of the way to the next anniversary</span>
          </div>
        </Reveal>

        <div className="mt-24 border-t border-white/10 pt-14">
          <div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Completed volumes</p><h2 className="mt-4 font-display text-5xl font-medium sm:text-7xl">The years we can replay.</h2></div>

          {data.completedYears.length ? (
            <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-white/10 md:grid-cols-2">
              {data.completedYears.map((year) => (
                <Link key={year.yearNumber} to={`/recap/year/${year.yearNumber}`} className="group flex min-h-72 flex-col bg-cinematic p-7 transition-colors hover:bg-white/[0.05] sm:p-10">
                  <span className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.15em] text-[#d7b77e]"><span>Complete</span><CalendarHeart size={18} aria-hidden="true" /></span>
                  <strong className="mt-auto font-display text-6xl font-medium leading-none sm:text-7xl">{year.label}</strong>
                  <span className="mt-5 flex items-center justify-between gap-4 text-sm text-[#bcae9e]"><span>{formatDate(year.startDate)} — {formatDate(year.endDate)}</span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-12 rounded-[var(--radius-lg)] border border-dashed border-white/15 px-7 py-16 text-center sm:px-12">
              <CalendarHeart className="mx-auto text-[#d7b77e]" aria-hidden="true" />
              <h3 className="mt-6 font-display text-4xl sm:text-5xl">The first volume is still open.</h3>
              <p className="mx-auto mt-5 max-w-xl text-[#bcae9e]">On {formatDate(data.currentYear.endExclusiveDate)}, {data.currentYear.label.toLowerCase()} becomes a finished recap. Until then, its real moments keep gathering.</p>
            </div>
          )}
        </div>
      </section>

      {comparison && (
        <section className="border-t border-white/10 px-5 py-24 sm:px-8 lg:py-36">
          <Reveal className="mx-auto max-w-[1500px]">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Two chapters, side by side</p>
            <h2 className="mt-5 max-w-4xl font-display text-5xl font-medium leading-[0.9] sm:text-7xl">Year {comparison.earlierYear} &amp; Year {comparison.laterYear}, without keeping score.</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {comparison.metrics.map((metric) => <div key={metric.key} className="bg-cinematic p-7"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#bcae9e]">{metric.label}</span><div className="mt-6 flex items-end gap-7"><strong className="font-display text-5xl font-medium">{metric.earlier}</strong><span className="pb-2 text-[#d7b77e]">→</span><strong className="font-display text-5xl font-medium">{metric.later}</strong></div><span className="mt-3 block text-xs text-[#8f8276]">Year {comparison.earlierYear} · Year {comparison.laterYear}</span></div>)}
            </div>
          </Reveal>
        </section>
      )}
    </PageTransition>
  )
}

export default RecapPage
