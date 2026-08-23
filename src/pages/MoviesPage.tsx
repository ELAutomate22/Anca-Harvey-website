import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { BarChart3, Check, ChevronDown, Clapperboard, Clock3, History, ListPlus, LoaderCircle, Pencil, Play, Popcorn, RefreshCcw, Search, Sparkles, Star, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingSkeleton, PageHeader, PageTransition, SectionHeader } from '@/components/ui/Page'
import { useAuth } from '@/features/auth/auth-context'
import { movieService, movieSnapshot, tmdbImage } from '@/features/movies/movie-service'
import type { MovieDetails, MovieGenre, MovieHistoryEntry, MovieHistoryInput, MoviePage, MovieStats, MovieSummary, MovieVideo, WatchlistMovie } from '@/features/movies/types'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'

type MovieSection = 'discover' | 'watchlist' | 'diary' | 'stats'
type CatalogueMode = 'popular' | 'top-rated' | 'discover' | 'search'

const fieldClass = 'mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4 text-foreground'
const today = () => {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
const releaseYear = (movie: MovieSummary) => movie.releaseDate?.slice(0, 4) ?? 'Date unknown'
const formatRuntime = (minutes: number | null) => minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'Runtime unavailable'

const PosterFallback = ({ title }: { title: string }) => (
  <div className="grid h-full place-items-center bg-gradient-to-br from-[#50313a] to-[#181311] p-5 text-center text-[#f8efe2]">
    <Clapperboard size={32} strokeWidth={1.3} aria-hidden="true" />
    <span className="font-display text-2xl leading-none">{title}</span>
  </div>
)

const MoviePoster = ({ movie, onOpen }: { movie: MovieSummary; onOpen: (movie: MovieSummary) => void }) => {
  const poster = tmdbImage(movie.posterPath, 'w342')
  return (
    <motion.button whileHover={{ y: -5 }} whileTap={{ scale: 0.985 }} onClick={() => onOpen(movie)} className="group w-full text-left" aria-label={`Open ${movie.title} details`}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-[#251d1a] shadow-[var(--shadow-deep)]">
        {poster ? <img src={poster} alt={`Poster for ${movie.title}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /> : <PosterFallback title={movie.title} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-[#fff8ee]">
          <h3 className="font-display text-[1.7rem] font-medium leading-[0.9]">{movie.title}</h3>
          <div className="mt-3 flex items-center justify-between text-xs text-white/75"><span>{releaseYear(movie)}</span><span className="flex items-center gap-1"><Star size={13} fill="currentColor" /> {movie.voteAverage.toFixed(1)}</span></div>
        </div>
      </div>
    </motion.button>
  )
}

interface DiaryFormProps {
  movie: MovieSummary
  entry?: MovieHistoryEntry
  onCancel: () => void
  onSaved: (entry: MovieHistoryEntry) => void
}

const DiaryForm = ({ movie, entry, onCancel, onSaved }: DiaryFormProps) => {
  const auth = useAuth()
  const [watchedOn, setWatchedOn] = useState(entry?.watchedOn ?? today())
  const [note, setNote] = useState(entry?.note ?? '')
  const [ratings, setRatings] = useState<Record<string, number>>(entry?.ratings ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const input: MovieHistoryInput = { ...movieSnapshot(movie), watchedOn, note, ratings }
      const saved = entry ? await movieService.updateHistory(entry.id, { watchedOn, note, ratings }) : await movieService.createHistory(input)
      onSaved(saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The diary entry could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Watched on</span><input type="date" required value={watchedOn} onChange={(event) => setWatchedOn(event.target.value)} className={fieldClass} /></label>
      <fieldset>
        <legend className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Partner ratings</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {auth.profiles.map((profile) => (
            <label key={profile.id} className="block"><span className="text-sm font-semibold">{profile.displayName}</span>
              <select aria-label={`${profile.displayName} rating`} value={ratings[profile.id] ?? ''} onChange={(event) => setRatings((current) => { const next = { ...current }; if (!event.target.value) delete next[profile.id]; else next[profile.id] = Number(event.target.value); return next })} className={fieldClass}>
                <option value="">Not rated</option>
                {Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((rating) => <option key={rating} value={rating}>{rating.toFixed(1)} / 5</option>)}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">A note for the diary</span><textarea maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className={`${fieldClass} py-3`} /></label>
      <p role="alert" className="min-h-6 text-sm font-semibold text-accent">{error}</p>
      <div className="flex flex-wrap gap-3"><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{entry ? 'Save changes' : 'Add to our diary'}</CinematicButton><CinematicButton type="button" variant="ghost" onClick={onCancel}>Cancel</CinematicButton></div>
    </form>
  )
}

const MoviesPage = () => {
  const auth = useAuth()
  const reducedMotion = useReducedMotionPreference()
  const [section, setSection] = useState<MovieSection>('discover')
  const [mode, setMode] = useState<CatalogueMode>('popular')
  const [catalogue, setCatalogue] = useState<MoviePage | null>(null)
  const [genres, setGenres] = useState<MovieGenre[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistMovie[]>([])
  const [history, setHistory] = useState<MovieHistoryEntry[]>([])
  const [stats, setStats] = useState<MovieStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<MovieSummary | null>(null)
  const [details, setDetails] = useState<MovieDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [trailer, setTrailer] = useState<MovieVideo | null>(null)
  const [trailerLoading, setTrailerLoading] = useState(false)
  const [diaryMovie, setDiaryMovie] = useState<MovieSummary | null>(null)
  const [editingEntry, setEditingEntry] = useState<MovieHistoryEntry | null>(null)
  const [randomPick, setRandomPick] = useState<MovieSummary | null>(null)
  const [randomLoading, setRandomLoading] = useState(false)
  const [filters, setFilters] = useState({ genreId: '', minRating: '6', maxRuntime: '', year: '', sortBy: 'popularity.desc' })
  const catalogueAbortRef = useRef<AbortController | null>(null)

  const loadSharedData = useCallback(async () => {
    const [nextWatchlist, nextHistory, nextStats] = await Promise.all([movieService.watchlist(), movieService.history(), movieService.stats()])
    setWatchlist(nextWatchlist)
    setHistory(nextHistory)
    setStats(nextStats)
  }, [])

  const fetchCatalogue = useCallback(async (nextMode: CatalogueMode, page: number, append = false, searchQuery = query) => {
    catalogueAbortRef.current?.abort()
    const controller = new AbortController()
    catalogueAbortRef.current = controller
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      let next: MoviePage
      if (nextMode === 'popular') next = await movieService.popular(page, controller.signal)
      else if (nextMode === 'top-rated') next = await movieService.topRated(page, controller.signal)
      else if (nextMode === 'search') next = await movieService.search(searchQuery.trim(), page, controller.signal)
      else next = await movieService.discover({ page, genreId: filters.genreId ? Number(filters.genreId) : undefined, minRating: filters.minRating ? Number(filters.minRating) : undefined, minVotes: filters.sortBy === 'vote_average.desc' ? 200 : undefined, maxRuntime: filters.maxRuntime ? Number(filters.maxRuntime) : undefined, year: filters.year ? Number(filters.year) : undefined, sortBy: filters.sortBy }, controller.signal)
      if (catalogueAbortRef.current !== controller) return
      setCatalogue((current) => append && current ? { ...next, results: [...current.results, ...next.results] } : next)
      setMode(nextMode)
    } catch (caught) {
      if (controller.signal.aborted) return
      setError(caught instanceof Error ? caught.message : 'The movie catalogue could not be loaded.')
    } finally {
      if (catalogueAbortRef.current === controller) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [filters, query])

  useEffect(() => {
    let active = true
    Promise.all([movieService.genres(), movieService.popular()]).then(([nextGenres, nextCatalogue]) => {
      if (!active) return
      setGenres(nextGenres); setCatalogue(nextCatalogue); setLoading(false)
    }).catch((caught: unknown) => { if (active) { setError(caught instanceof Error ? caught.message : 'The movie catalogue could not be loaded.'); setLoading(false) } })
    Promise.all([movieService.watchlist(), movieService.history(), movieService.stats()]).then(([nextWatchlist, nextHistory, nextStats]) => {
      if (!active) return
      setWatchlist(nextWatchlist); setHistory(nextHistory); setStats(nextStats)
    }).catch((caught: unknown) => { if (active) setMessage(caught instanceof Error ? caught.message : 'Shared movie data could not be loaded.') })
    return () => { active = false; catalogueAbortRef.current?.abort() }
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = window.setTimeout(() => { void fetchCatalogue('search', 1, false, query) }, 450)
    return () => window.clearTimeout(timer)
  }, [fetchCatalogue, query])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    movieService.details(selected.id, controller.signal).then(setDetails).catch((caught: unknown) => { if (!controller.signal.aborted) setMessage(caught instanceof Error ? caught.message : 'Movie details are unavailable.') }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selected])

  const openMovie = (movie: MovieSummary) => {
    setDetails(null)
    setTrailer(null)
    setDetailLoading(true)
    setSelected(movie)
  }

  const openTrailer = async () => {
    if (!selected || trailerLoading) return
    setTrailerLoading(true)
    try {
      const videos = await movieService.videos(selected.id)
      setTrailer(videos.find((video) => video.type === 'Trailer' && video.official) ?? videos[0] ?? null)
      if (!videos.length) setMessage('No trailer is available for this film.')
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The trailer could not be loaded.') } finally { setTrailerLoading(false) }
  }

  const addToWatchlist = async (movie: MovieSummary) => {
    setMessage('')
    try { const item = await movieService.addWatchlist(movieSnapshot(movie)); setWatchlist((current) => [item, ...current]); setMessage(`${movie.title} is on your shared watchlist.`) } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The film could not be added.') }
  }
  const removeFromWatchlist = async (movieId: number) => {
    try { await movieService.removeWatchlist(movieId); setWatchlist((current) => current.filter((item) => item.tmdbMovieId !== movieId)); setMessage('Removed from the shared watchlist.') } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The film could not be removed.') }
  }

  const randomize = async () => {
    setRandomLoading(true); setMessage('')
    try {
      const page = Math.floor(Math.random() * Math.max(1, Math.min(catalogue?.totalPages ?? 20, 50))) + 1
      const result = await movieService.discover({ page, genreId: filters.genreId ? Number(filters.genreId) : undefined, minRating: filters.minRating ? Number(filters.minRating) : 6, minVotes: 50, maxRuntime: filters.maxRuntime ? Number(filters.maxRuntime) : undefined, year: filters.year ? Number(filters.year) : undefined, sortBy: filters.sortBy })
      const candidate = result.results[Math.floor(Math.random() * result.results.length)]
      if (!candidate) throw new Error('No films matched those randomizer filters.')
      setRandomPick(candidate)
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The randomizer could not choose a film.') } finally { setRandomLoading(false) }
  }

  const onDiarySaved = async (entry: MovieHistoryEntry) => {
    const wasEditing = Boolean(editingEntry)
    setHistory((current) => wasEditing ? current.map((item) => item.id === entry.id ? entry : item) : [entry, ...current])
    setDiaryMovie(null); setEditingEntry(null); setMessage(wasEditing ? 'Diary entry updated.' : 'Added to your shared movie diary.')
    if (!wasEditing && watchlist.some((item) => item.tmdbMovieId === entry.tmdbMovieId) && window.confirm('This film is on the watchlist. Remove it now that you have watched it?')) await removeFromWatchlist(entry.tmdbMovieId)
    await loadSharedData()
  }
  const deleteDiary = async (entry: MovieHistoryEntry) => {
    if (!window.confirm(`Delete the ${entry.title} diary entry from ${entry.watchedOn}?`)) return
    try { await movieService.deleteHistory(entry.id); setHistory((current) => current.filter((item) => item.id !== entry.id)); setMessage('Diary entry deleted.'); setStats(await movieService.stats()) } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The diary entry could not be deleted.') }
  }

  const selectedOnWatchlist = selected ? watchlist.some((item) => item.tmdbMovieId === selected.id) : false
  const sectionTabs = [
    { id: 'discover' as const, label: 'Discover', icon: Popcorn },
    { id: 'watchlist' as const, label: `Watchlist · ${watchlist.length}`, icon: ListPlus },
    { id: 'diary' as const, label: `Diary · ${history.length}`, icon: History },
    { id: 'stats' as const, label: 'Our stats', icon: BarChart3 },
  ]

  return (
    <PageTransition className="cinematic-surface min-h-dvh">
      <PageHeader dark eyebrow="Lights down · Volume up" title="Movie Night" intro="Live cinema discovery, a shared watchlist, and every rewatch remembered—kept private for the two of you." />
      <section className="mx-auto max-w-[1500px] px-5 pb-16 sm:px-8 lg:px-12">
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-white/10 pb-4" role="tablist" aria-label="Movie Night sections">
          {sectionTabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)} className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] ${section === id ? 'border-[#d7b77e] bg-[#d7b77e] text-cinematic' : 'border-white/20 text-[#d8cec2]'}`}><Icon size={15} aria-hidden="true" /> {label}</button>)}
        </div>
        <p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold text-[#d7b77e]">{message}</p>
      </section>

      {section === 'discover' && <>
        <section className="mx-auto max-w-[1500px] px-5 pb-24 sm:px-8 lg:px-12">
          <form onSubmit={(event) => { event.preventDefault(); if (query.trim()) void fetchCatalogue('search', 1, false, query) }} role="search" className="mb-6 flex gap-2">
            <label className="relative block flex-1"><span className="sr-only">Search films</span><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#bbae9f]" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the live TMDB catalogue…" maxLength={200} className="min-h-12 w-full rounded-md border border-white/20 bg-white/[0.06] pl-11 pr-11 text-white placeholder:text-white/45" />{query && <button type="button" onClick={() => { setQuery(''); void fetchCatalogue('popular', 1, false, '') }} aria-label="Clear movie search" className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full"><X size={17} /></button>}</label>
            <CinematicButton type="submit" variant="secondary" className="!border-white/20 !text-white">Search</CinematicButton>
          </form>
          <div className="mb-8 flex flex-wrap gap-2">{[['popular', 'Popular now'], ['top-rated', 'Top rated'], ['discover', 'Filtered discovery']].map(([id, label]) => <button key={id} onClick={() => void fetchCatalogue(id as CatalogueMode, 1)} aria-pressed={mode === id} className={`min-h-11 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.11em] ${mode === id ? 'border-[#d7b77e] text-[#d7b77e]' : 'border-white/15 text-[#d8cec2]'}`}>{label}</button>)}</div>
          <details className="mb-10 rounded-xl border border-white/10 bg-white/[0.04] p-5" open={mode === 'discover'}><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold"><span>Discovery filters</span><ChevronDown size={18} /></summary><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#bbae9f]">Genre</span><select value={filters.genreId} onChange={(event) => setFilters((current) => ({ ...current, genreId: event.target.value }))} className={`${fieldClass} !border-white/15 !bg-black/15 !text-white`}><option value="">Any genre</option>{genres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#bbae9f]">Minimum score</span><select value={filters.minRating} onChange={(event) => setFilters((current) => ({ ...current, minRating: event.target.value }))} className={`${fieldClass} !border-white/15 !bg-black/15 !text-white`}><option value="">Any</option><option value="6">6+</option><option value="7">7+</option><option value="8">8+</option></select></label>
            <label><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#bbae9f]">Max runtime</span><select value={filters.maxRuntime} onChange={(event) => setFilters((current) => ({ ...current, maxRuntime: event.target.value }))} className={`${fieldClass} !border-white/15 !bg-black/15 !text-white`}><option value="">Any</option><option value="90">90 min</option><option value="120">2 hours</option><option value="150">2.5 hours</option></select></label>
            <label><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#bbae9f]">Release year</span><input type="number" min="1870" max="2200" value={filters.year} onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))} placeholder="Any year" className={`${fieldClass} !border-white/15 !bg-black/15 !text-white`} /></label>
            <label><span className="text-xs font-bold uppercase tracking-[0.12em] text-[#bbae9f]">Sort</span><select value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value }))} className={`${fieldClass} !border-white/15 !bg-black/15 !text-white`}><option value="popularity.desc">Popularity</option><option value="vote_average.desc">Rating</option><option value="primary_release_date.desc">Newest</option></select></label>
          </div><CinematicButton onClick={() => void fetchCatalogue('discover', 1)} variant="secondary" className="mt-5 !border-white/20 !text-white">Apply filters</CinematicButton></details>
          {loading && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 10 }, (_, index) => <LoadingSkeleton key={index} className="aspect-[2/3]" />)}</div>}
          {!loading && error && <div role="alert" className="rounded-xl border border-[#d7b77e]/40 bg-white/[0.04] p-8"><p className="text-lg">{error}</p><CinematicButton onClick={() => void fetchCatalogue(mode === 'search' && !query.trim() ? 'popular' : mode, 1)} variant="secondary" className="mt-5 !text-white">Try again</CinematicButton></div>}
          {!loading && !error && catalogue?.results.length === 0 && <p className="rounded-xl border border-white/10 p-8 text-[#d8cec2]">No films matched. Loosen a filter or try another search.</p>}
          {!loading && catalogue && catalogue.results.length > 0 && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">{catalogue.results.map((movie) => <MoviePoster key={`${movie.id}-${movie.releaseDate}`} movie={movie} onOpen={openMovie} />)}</div>}
          {catalogue && catalogue.page < catalogue.totalPages && !error && <div className="mt-10 text-center"><CinematicButton onClick={() => void fetchCatalogue(mode, catalogue.page + 1, true)} disabled={loadingMore} variant="secondary" className="!border-white/20 !text-white">{loadingMore && <LoaderCircle size={16} className="animate-spin" />} Load more films</CinematicButton></div>}
        </section>
        <section className="border-y border-white/10 bg-black/15 px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto grid max-w-[1300px] items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="editorial-rule !text-[#d7b77e]">The final decision</p><h2 className="balance mt-6 font-display text-[clamp(3.5rem,7.5vw,7.5rem)] font-medium leading-[0.82]">What are we watching tonight?</h2><p className="mt-6 max-w-xl text-lg text-[#d8cec2]">The randomizer reaches beyond page one and respects the discovery filters above.</p><CinematicButton onClick={() => void randomize()} disabled={randomLoading} variant="secondary" className="mt-8 !border-[#867668] !text-white">{randomLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />} {randomLoading ? 'Looking…' : 'Choose our film'}</CinematicButton></div><div className="min-h-[25rem] rounded-[var(--radius-lg)] border border-white/10 bg-white/[0.045] p-6 shadow-[var(--shadow-deep)] sm:p-8">
          {randomPick ? <AnimatePresence mode="wait"><motion.div key={randomPick.id} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid items-center gap-7 sm:grid-cols-[10rem_1fr]"><div className="aspect-[2/3] overflow-hidden rounded-lg">{tmdbImage(randomPick.posterPath, 'w342') ? <img src={tmdbImage(randomPick.posterPath, 'w342')!} alt={`Poster for ${randomPick.title}`} className="h-full w-full object-cover" /> : <PosterFallback title={randomPick.title} />}</div><div><p className="text-xs uppercase tracking-[0.16em] text-[#bbae9f]">Tonight’s pick</p><h3 className="mt-3 font-display text-[clamp(2.8rem,7vw,5.4rem)] font-medium leading-[0.83]">{randomPick.title}</h3><p className="mt-5 line-clamp-4 text-[#d8cec2]">{randomPick.overview || 'Open the film for the full details.'}</p><div className="mt-7 flex flex-wrap gap-3"><CinematicButton onClick={() => openMovie(randomPick)} variant="romantic"><Check size={16} /> That’s the one</CinematicButton><CinematicButton onClick={() => void randomize()} variant="ghost" className="!text-white"><RefreshCcw size={16} /> Again</CinematicButton></div></div></motion.div></AnimatePresence> : <div className="grid min-h-[22rem] place-items-center text-center text-[#d8cec2]"><div><Popcorn className="mx-auto mb-4 text-[#d7b77e]" size={38} strokeWidth={1.3} /><p>Set the filters, then let the archive pick.</p></div></div>}
        </div></div></section>
      </>}

      {section === 'watchlist' && <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8 lg:px-12"><SectionHeader light eyebrow="Saved for later" title="Our shared watchlist." description="Anything either of you adds appears here for both partners." />{watchlist.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{watchlist.map((item) => <article key={item.tmdbMovieId} className="grid grid-cols-[5rem_1fr_auto] gap-4 rounded-xl border border-white/10 bg-white/[0.045] p-4"><div className="aspect-[2/3] overflow-hidden rounded-md">{tmdbImage(item.posterPath, 'w342') ? <img src={tmdbImage(item.posterPath, 'w342')!} alt="" loading="lazy" className="h-full w-full object-cover" /> : <PosterFallback title={item.title} />}</div><div><h3 className="font-display text-2xl leading-none">{item.title}</h3><p className="mt-2 text-sm text-[#bbae9f]">{item.releaseYear ?? 'Year unknown'} · {item.watched ? 'Watched before' : 'Not watched yet'}</p><button onClick={() => setDiaryMovie({ id: item.tmdbMovieId, title: item.title, overview: '', posterPath: item.posterPath, backdropPath: null, releaseDate: item.releaseYear ? `${item.releaseYear}-01-01` : null, genreIds: [], voteAverage: 0, voteCount: 0 })} className="mt-4 text-sm font-semibold text-[#d7b77e]">Mark watched</button></div><button onClick={() => void removeFromWatchlist(item.tmdbMovieId)} aria-label={`Remove ${item.title} from watchlist`} className="grid size-11 place-items-center rounded-full border border-white/15"><Trash2 size={16} /></button></article>)}</div> : <p className="rounded-xl border border-white/10 p-8 text-[#d8cec2]">Your watchlist is empty. Open a film in Discover and add the first one.</p>}</section>}

      {section === 'diary' && <section className="mx-auto max-w-[1200px] px-5 pb-28 sm:px-8 lg:px-12"><SectionHeader light eyebrow="Watched together" title="Our movie diary." description="Each viewing stays separate, so rewatches count as part of the story." />{history.length ? <div className="space-y-4">{history.map((entry) => <article key={entry.id} className="grid gap-5 rounded-xl border border-white/10 bg-white/[0.045] p-5 sm:grid-cols-[5rem_1fr_auto]"><div className="aspect-[2/3] overflow-hidden rounded-md">{tmdbImage(entry.posterPath, 'w342') ? <img src={tmdbImage(entry.posterPath, 'w342')!} alt="" loading="lazy" className="h-full w-full object-cover" /> : <PosterFallback title={entry.title} />}</div><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#d7b77e]">{entry.watchedOn}</p><h3 className="mt-2 font-display text-3xl leading-none">{entry.title}</h3><div className="mt-3 flex flex-wrap gap-3 text-sm text-[#d8cec2]">{auth.profiles.map((profile) => entry.ratings[profile.id] ? <span key={profile.id}>{profile.displayName}: {entry.ratings[profile.id]?.toFixed(1)} ★</span> : null)}</div>{entry.note && <p className="mt-3 text-[#d8cec2]">{entry.note}</p>}</div><div className="flex gap-2 sm:flex-col"><button onClick={() => { setEditingEntry(entry); setDiaryMovie({ id: entry.tmdbMovieId, title: entry.title, overview: '', posterPath: entry.posterPath, backdropPath: null, releaseDate: entry.releaseYear ? `${entry.releaseYear}-01-01` : null, genreIds: [], voteAverage: 0, voteCount: 0 }) }} aria-label={`Edit ${entry.title} diary entry`} className="grid size-11 place-items-center rounded-full border border-white/15"><Pencil size={16} /></button><button onClick={() => void deleteDiary(entry)} aria-label={`Delete ${entry.title} diary entry`} className="grid size-11 place-items-center rounded-full border border-white/15"><Trash2 size={16} /></button></div></article>)}</div> : <p className="rounded-xl border border-white/10 p-8 text-[#d8cec2]">No watched films yet. Mark a catalogue or watchlist film as watched to begin.</p>}</section>}

      {section === 'stats' && <section className="mx-auto max-w-[1200px] px-5 pb-28 sm:px-8 lg:px-12"><SectionHeader light eyebrow="Only real history" title="Our cinema in numbers." description="These figures are calculated from your shared diary—never from placeholder data." />{stats ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[String(stats.totalWatches), 'Total watches'], [String(stats.uniqueMovies), 'Unique films'], [String(stats.rewatches), 'Rewatches'], [String(stats.watchlistCount), 'Still on the list']].map(([value, label]) => <div key={label} className="rounded-xl border border-white/10 bg-white/[0.045] p-6"><p className="font-display text-6xl text-[#d7b77e]">{value}</p><p className="mt-2 text-sm uppercase tracking-[0.13em] text-[#d8cec2]">{label}</p></div>)}<div className="rounded-xl border border-white/10 bg-white/[0.045] p-6 sm:col-span-2"><h3 className="font-display text-3xl">Partner averages</h3><div className="mt-4 space-y-2">{auth.profiles.map((profile) => { const rating = stats.ratingsByUser.find((item) => item.userId === profile.id); return <p key={profile.id} className="flex justify-between"><span>{profile.displayName}</span><span className="text-[#d7b77e]">{rating ? `${rating.averageRating.toFixed(1)} ★ · ${rating.ratingCount}` : 'No ratings yet'}</span></p> })}</div></div><div className="rounded-xl border border-white/10 bg-white/[0.045] p-6 sm:col-span-2"><h3 className="font-display text-3xl">Most watched</h3><p className="mt-4 text-[#d8cec2]">{stats.mostWatched ? `${stats.mostWatched.title} · ${stats.mostWatched.watchCount} watches` : 'The first favourite is still waiting.'}</p></div></div> : <LoadingSkeleton className="min-h-72 !bg-white/[0.05]" />}</section>}

      <Modal open={Boolean(selected)} onClose={() => { setSelected(null); setDetails(null); setTrailer(null); setDetailLoading(false) }} title={selected?.title ?? 'Movie details'}>
        {selected && <div>{detailLoading ? <LoadingSkeleton className="min-h-80" /> : <div className="grid gap-8 sm:grid-cols-[12rem_1fr]"><div className="aspect-[2/3] overflow-hidden rounded-lg shadow-xl">{tmdbImage(selected.posterPath, 'w342') ? <img src={tmdbImage(selected.posterPath, 'w342')!} alt={`Poster for ${selected.title}`} className="h-full w-full object-cover" /> : <PosterFallback title={selected.title} />}</div><div><p className="editorial-rule">{details?.genres.map((item) => item.name).join(' · ') || releaseYear(selected)}</p>{details?.tagline && <p className="mt-5 font-display text-2xl italic">{details.tagline}</p>}<p className="mt-5 text-muted">{details?.overview || selected.overview || 'No overview is available.'}</p><div className="mt-5 flex flex-wrap gap-4 text-sm text-muted"><span>{releaseYear(selected)}</span><span className="flex items-center gap-1"><Clock3 size={15} /> {formatRuntime(details?.runtime ?? null)}</span><span>{selected.voteAverage.toFixed(1)} / 10 TMDB</span></div><div className="mt-7 flex flex-wrap gap-3">{selectedOnWatchlist ? <CinematicButton onClick={() => void removeFromWatchlist(selected.id)} variant="secondary"><Trash2 size={16} /> Remove watchlist</CinematicButton> : <CinematicButton onClick={() => void addToWatchlist(selected)} variant="secondary"><ListPlus size={16} /> Add to watchlist</CinematicButton>}<CinematicButton onClick={() => { setDiaryMovie(selected); setSelected(null); setDetails(null); setTrailer(null) }} variant="romantic"><Check size={16} /> We watched this</CinematicButton><CinematicButton onClick={() => void openTrailer()} variant="ghost" disabled={trailerLoading}>{trailerLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />} Trailer</CinematicButton></div></div></div>}{trailer && <div className="mt-8"><div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe title={`${trailer.name} for ${selected.title}`} src={`https://www.youtube-nocookie.com/embed/${trailer.key}`} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen /></div><p className="mt-2 text-sm text-muted">{trailer.name} · loaded only after you requested it</p></div>}</div>}
      </Modal>
      <Modal open={Boolean(diaryMovie)} onClose={() => { setDiaryMovie(null); setEditingEntry(null) }} title={editingEntry ? `Edit ${editingEntry.title}` : `We watched ${diaryMovie?.title ?? ''}`} panelClassName="max-w-2xl">
        {diaryMovie && <DiaryForm movie={diaryMovie} entry={editingEntry ?? undefined} onCancel={() => { setDiaryMovie(null); setEditingEntry(null) }} onSaved={(entry) => void onDiarySaved(entry)} />}
      </Modal>
    </PageTransition>
  )
}

export default MoviesPage
