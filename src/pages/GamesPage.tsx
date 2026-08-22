import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Dices, RotateCcw, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { mockGames } from '@/data/mockGames'
import type { Game } from '@/types/content'
import { CinematicButton } from '@/components/ui/Button'
import { PageHeader, PageTransition, Reveal } from '@/components/ui/Page'

const categories = ['All', 'Cosy', 'Competitive', 'Co-op', 'Quick'] as const

const GamesPage = () => {
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [result, setResult] = useState<Game>(mockGames[0]!)
  const [shuffling, setShuffling] = useState(false)
  const [chosen, setChosen] = useState(false)
  const timer = useRef<number | null>(null)
  const pool = useMemo(() => category === 'All' ? mockGames : mockGames.filter((game) => game.category === category), [category])

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current) }, [])

  const shuffle = () => {
    if (shuffling) return
    setChosen(false)
    setShuffling(true)
    let ticks = 0
    timer.current = window.setInterval(() => {
      const candidate = pool[Math.floor(Math.random() * pool.length)]
      if (candidate) setResult(candidate)
      ticks += 1
      if (ticks > 11) {
        if (timer.current) window.clearInterval(timer.current)
        timer.current = null
        setShuffling(false)
      }
    }, 92)
  }

  return (
    <PageTransition>
      <PageHeader eyebrow="Playful, never casino" title="Game Night" intro="A polished little picker for co-operative plans, tiny rivalries, and the nights when a screen is not the answer." />

      <section className="mx-auto max-w-[1350px] px-5 pb-28 sm:px-8 lg:px-12">
        <div className="mb-12 flex flex-wrap gap-2">
          {categories.map((item) => <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-11 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] ${category === item ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:bg-elevated'}`}>{item}</button>)}
        </div>

        <div className="grid items-center gap-14 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <Reveal>
            <p className="editorial-rule">Leave it to chance</p>
            <h2 className="balance mt-6 font-display text-[clamp(3.6rem,8vw,7.8rem)] font-medium leading-[0.82]">What are we playing tonight?</h2>
            <p className="mt-6 max-w-lg text-lg text-muted">Pick a mood, then let the cards settle. No flashing lights, no fake roulette—just a playful decision.</p>
            <CinematicButton onClick={shuffle} disabled={shuffling} variant="romantic" className="mt-8"><Dices size={17} /> {shuffling ? 'Shuffling…' : 'Shuffle the stack'}</CinematicButton>
          </Reveal>

          <div className="relative mx-auto min-h-[34rem] w-full max-w-2xl">
            <div className="paper-surface absolute inset-x-[12%] top-7 h-[28rem] rotate-6 rounded-[var(--radius-lg)] opacity-45" />
            <div className="paper-surface absolute inset-x-[8%] top-4 h-[29rem] -rotate-3 rounded-[var(--radius-lg)] opacity-70" />
            <AnimatePresence mode="wait">
              <motion.article key={result.id} initial={{ opacity: 0, x: shuffling ? 30 : 0, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: -1 }} exit={{ opacity: 0, x: -25, rotate: -3 }} className="paper-surface relative min-h-[30rem] overflow-hidden rounded-[var(--radius-lg)] p-7 sm:p-10">
                <div className="absolute right-[-4rem] top-[-4rem] grid size-52 place-items-center rounded-full border border-accent-soft/40 font-display text-8xl text-accent-soft/50" aria-hidden="true">{result.motif}</div>
                <p className="editorial-rule">{result.category}</p>
                <h3 className="mt-10 max-w-lg font-display text-[clamp(3.8rem,9vw,7.2rem)] font-medium leading-[0.78] tracking-[-0.04em]">{result.title}</h3>
                <p className="mt-7 max-w-lg text-lg text-muted">{result.note}</p>
                <div className="mt-10 flex flex-wrap gap-5 border-t border-line pt-6 text-sm font-semibold text-muted"><span className="flex items-center gap-2"><Users size={17} /> {result.players}</span><span>{result.duration}</span></div>
                <div className="mt-8 flex flex-wrap gap-3"><CinematicButton onClick={() => setChosen(true)} variant="romantic"><Check size={16} /> We’re playing this</CinematicButton><CinematicButton onClick={shuffle} disabled={shuffling} variant="ghost"><RotateCcw size={16} /> Again</CinematicButton></div>
                <p aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold text-accent">{chosen ? 'Game night is decided.' : ''}</p>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </PageTransition>
  )
}

export default GamesPage
