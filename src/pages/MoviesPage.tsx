import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock3, ListPlus, Popcorn, RotateCcw, Sparkles, Star } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { mockMovies } from '@/data/mockMovies'
import type { Movie } from '@/types/content'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition, Reveal } from '@/components/ui/Page'

const genres = ['All', ...new Set(mockMovies.flatMap((movie) => movie.genres))]

const MoviePoster = ({ movie, onOpen }: { movie: Movie; onOpen: (movie: Movie) => void }) => (
  <motion.button whileHover={{ y: -6 }} whileTap={{ scale: 0.985 }} onClick={() => onOpen(movie)} className="group w-full text-left" aria-label={`Open ${movie.title} details`}>
    <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-md)] border border-white/10 shadow-[var(--shadow-deep)]" style={{ background: movie.poster }}>
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-white/5" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-[#fff8ee]">
        <p className="text-[0.64rem] font-bold uppercase tracking-[0.17em] opacity-70">{movie.genres.join(' · ')}</p>
        <h3 className="mt-2 font-display text-[2.1rem] font-medium leading-[0.88]">{movie.title}</h3>
        <div className="mt-4 flex items-center justify-between text-xs opacity-80"><span>{movie.year}</span><span>{movie.runtime}</span></div>
      </div>
    </div>
  </motion.button>
)

const MoviesPage = () => {
  const [genre, setGenre] = useState('All')
  const [selected, setSelected] = useState<Movie | null>(null)
  const [result, setResult] = useState<Movie>(mockMovies[0]!)
  const [spinning, setSpinning] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const intervalRef = useRef<number | null>(null)

  const visible = useMemo(() => genre === 'All' ? mockMovies : mockMovies.filter((movie) => movie.genres.includes(genre)), [genre])

  useEffect(() => () => {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
  }, [])

  const spin = () => {
    if (spinning) return
    setConfirmed(false)
    setSpinning(true)
    let ticks = 0
    const pool = visible.length ? visible : mockMovies
    intervalRef.current = window.setInterval(() => {
      const candidate = pool[Math.floor(Math.random() * pool.length)]
      if (candidate) setResult(candidate)
      ticks += 1
      if (ticks >= 13) {
        if (intervalRef.current) window.clearInterval(intervalRef.current)
        intervalRef.current = null
        setSpinning(false)
      }
    }, 85)
  }

  return (
    <PageTransition className="cinematic-surface min-h-dvh">
      <PageHeader dark eyebrow="Lights down · Volume up" title="Movie Night" intro="A cinematic shelf for future favourites, familiar comforts, and the film neither of us can decide on. Mock titles keep this prototype API-free." />

      <section className="mx-auto max-w-[1500px] px-5 pb-24 sm:px-8 lg:px-12">
        <h2 className="sr-only">Movie shelf</h2>
        <div className="no-scrollbar mb-10 flex gap-2 overflow-x-auto pb-2">
          {genres.map((item) => <button key={item} onClick={() => setGenre(item)} aria-pressed={genre === item} className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] ${genre === item ? 'border-[#d7b77e] bg-[#d7b77e] text-cinematic' : 'border-white/20 text-[#d8cec2] hover:bg-white/5'}`}>{item}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
          {visible.map((movie) => <MoviePoster key={movie.id} movie={movie} onOpen={setSelected} />)}
        </div>
      </section>

      <section className="border-y border-white/10 bg-black/15 px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1300px] items-center gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <p className="editorial-rule !text-[#d7b77e]">The final decision</p>
            <h2 className="balance mt-6 font-display text-[clamp(3.5rem,7.5vw,7.5rem)] font-medium leading-[0.82]">What are we watching tonight?</h2>
            <p className="mt-6 max-w-xl text-lg text-[#d8cec2]">Let the archive pick. The shuffle works entirely against local mock data and is ready for a future TMDB repository.</p>
            <CinematicButton onClick={spin} disabled={spinning} variant="secondary" className="mt-8 !border-[#867668] !text-white hover:!bg-white/5">
              {spinning ? <Sparkles className="animate-pulse" size={16} aria-hidden="true" /> : <Popcorn size={16} aria-hidden="true" />}
              {spinning ? 'Shuffling…' : 'Choose our film'}
            </CinematicButton>
          </Reveal>

          <div className="relative mx-auto w-full max-w-3xl rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.045] p-5 shadow-[var(--shadow-deep)] sm:p-8">
            <p className="text-center text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#bbae9f]">Tonight you’re watching…</p>
            <AnimatePresence mode="wait">
              <motion.div key={result.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-7 grid items-center gap-7 sm:grid-cols-[11rem_1fr]">
                <div className="aspect-[2/3] rounded-lg shadow-2xl" style={{ background: result.poster }} />
                <div>
                  <h3 className="font-display text-[clamp(2.8rem,7vw,5.4rem)] font-medium leading-[0.83]">{result.title}</h3>
                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-[#d8cec2]"><span className="flex items-center gap-2"><Star size={16} fill="currentColor" className="text-[#d7b77e]" /> {result.rating}</span><span className="flex items-center gap-2"><Clock3 size={16} /> {result.runtime}</span></div>
                  <p className="mt-5 text-[#d8cec2]">{result.note}</p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <CinematicButton onClick={() => setConfirmed(true)} variant="romantic"><Check size={16} /> That’s the one</CinematicButton>
                    <CinematicButton onClick={spin} disabled={spinning} variant="ghost" className="!text-white hover:!bg-white/5"><RotateCcw size={16} /> Spin again</CinematicButton>
                  </div>
                  <p aria-live="polite" className="mt-4 min-h-6 text-sm text-[#d7b77e]">{confirmed ? 'Tonight’s choice is settled.' : ''}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.title ?? 'Movie details'}>
        {selected && <div className="grid gap-8 sm:grid-cols-[13rem_1fr]"><div className="aspect-[2/3] rounded-lg shadow-xl" style={{ background: selected.poster }} /><div><p className="editorial-rule">{selected.genres.join(' · ')}</p><p className="mt-6 text-lg text-muted">{selected.note}</p><div className="mt-6 flex gap-4 text-sm text-muted"><span>{selected.year}</span><span>{selected.runtime}</span><span>{selected.rating}/5</span></div><div className="mt-8 flex flex-wrap gap-3"><CinematicButton variant="secondary"><ListPlus size={16} /> Add to watchlist</CinematicButton><CinematicButton variant="romantic"><Check size={16} /> We watched this</CinematicButton></div><p className="mt-5 text-xs text-muted">Demo controls only. Persistence arrives with the future data layer.</p></div></div>}
      </Modal>
    </PageTransition>
  )
}

export default MoviesPage
