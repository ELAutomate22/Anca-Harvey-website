import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, CalendarHeart, Gamepad2, Images, ListChecks, LoaderCircle, Mail, Music2, Star, Ticket } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageTransition, Reveal } from '@/components/ui/Page'
import { recapService } from '@/features/recap/recap-service'
import type { RecapMediaPreview, RecapYearResponse } from '@/features/recap/types'
import { tmdbImage } from '@/features/movies/movie-service'
import { formatDate } from '@/lib/date'

const Stat = ({ value, label, icon }: { value: number | string; label: string; icon: ReactNode }) => (
  <div className="border-white/10 py-7 sm:border-r sm:px-6 sm:last:border-r-0">
    <span className="text-[#d7b77e]" aria-hidden="true">{icon}</span>
    <strong className="mt-5 block font-display text-5xl font-medium sm:text-6xl">{value}</strong>
    <span className="mt-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#a99b8d]">{label}</span>
  </div>
)

const Media = ({ media, className = '' }: { media: RecapMediaPreview; className?: string }) => media.type === 'image'
  ? <img src={media.url} alt={media.alt} loading="lazy" className={className} />
  : <video src={media.url} aria-label={media.alt} controls playsInline preload="metadata" className={className} />

const RecapYearPage = () => {
  const params = useParams<{ yearNumber: string }>()
  const yearNumber = Number(params.yearNumber)
  const routeError = Number.isInteger(yearNumber) && yearNumber >= 1 ? '' : 'Choose a valid relationship year.'
  const [data, setData] = useState<RecapYearResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    if (routeError) return () => controller.abort()
    recapService.year(yearNumber, controller.signal)
      .then(setData)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'That relationship year could not be opened.')
      })
    return () => controller.abort()
  }, [routeError, yearNumber])

  const openingImage = useMemo(() => data?.memories.highlights.find((memory) => memory.preview?.type === 'image')?.preview ?? null, [data])

  if (!data && !error && !routeError) return <PageTransition className="grid min-h-[75dvh] place-items-center bg-cinematic text-white"><LoaderCircle className="animate-spin motion-reduce:animate-none" /><span className="sr-only">Opening anniversary recap</span></PageTransition>
  if (!data) return <PageTransition className="grid min-h-[70dvh] place-items-center px-5 text-center"><div><p className="editorial-rule mx-auto w-fit">This chapter stayed closed</p><h1 className="mt-6 font-display text-5xl">The recap is not available.</h1><p role="alert" className="mx-auto mt-5 max-w-xl text-muted">{routeError || error}</p><Link to="/recap" className="mt-8 inline-flex min-h-12 items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-accent"><ArrowLeft size={16} /> Back to our years</Link></div></PageTransition>

  const hasMovieRatings = data.movies.highestRated.length > 0
  const partnerNames = data.relationship.profiles.map((profile) => profile.displayName).join(' & ')

  return (
    <PageTransition className="bg-cinematic text-[#f8efe2]">
      <section className="relative grid min-h-[calc(100dvh-var(--nav-height))] place-items-end overflow-hidden px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        {openingImage && <img src={openingImage.url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
        <div className={`absolute inset-0 ${openingImage ? 'bg-gradient-to-b from-cinematic/35 via-cinematic/45 to-cinematic' : 'bg-[radial-gradient(circle_at_70%_20%,rgb(145_75_68/0.35),transparent_36%),radial-gradient(circle_at_20%_80%,rgb(189_150_90/0.18),transparent_35%)]'}`} />
        <div className="relative mx-auto w-full max-w-[1500px]">
          <Link to="/recap" className="inline-flex min-h-12 items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#d7b77e]"><ArrowLeft size={16} /> All our years</Link>
          <div className="mt-16 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7b77e]">{data.year.completed ? 'A completed anniversary volume' : 'This chapter is still being written'}</p><h1 className="mt-7 font-display text-[clamp(5rem,15vw,13rem)] font-medium leading-[0.68] tracking-[-0.06em]">{data.year.label}</h1></div>
            <div className="border-l border-white/20 pl-6 text-sm text-[#d8cec2]"><span className="block">{partnerNames}</span><span className="mt-2 block">{formatDate(data.year.startDate)} — {formatDate(data.year.endDate)}</span><span className="mt-2 block text-[#d7b77e]">{data.year.daysIntoYear} of {data.year.daysInYear} days gathered</span></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12 lg:py-32">
        <Reveal className="grid border-y border-white/10 sm:grid-cols-2 lg:grid-cols-6">
          <Stat value={data.memories.count} label="memories" icon={<Images size={19} />} />
          <Stat value={data.memories.photoCount} label="private photos" icon={<Images size={19} />} />
          <Stat value={data.movies.watchCount} label="films watched" icon={<Ticket size={19} />} />
          <Stat value={data.games.playCount} label="games played" icon={<Gamepad2 size={19} />} />
          <Stat value={data.activities.completedCount} label="dates completed" icon={<CalendarHeart size={19} />} />
          <Stat value={data.letters.openedCount} label="letters opened" icon={<Mail size={19} />} />
        </Reveal>
      </section>

      {data.memories.count > 0 && (
        <section className="mx-auto max-w-[1500px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-36">
          <Reveal><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">The scenes we kept</p><h2 className="mt-5 max-w-5xl font-display text-5xl font-medium leading-[0.88] sm:text-7xl">First, last, favourite—and the frames that held the most.</h2></Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-12">
            {data.memories.highlights.map((memory, index) => <Reveal key={memory.id} className={`relative min-h-[24rem] overflow-hidden rounded-[var(--radius-lg)] border border-white/10 ${index % 3 === 0 ? 'md:col-span-7' : 'md:col-span-5'}`}>
              {memory.preview ? <Media media={memory.preview} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-white/[0.035]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-7 sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#d7b77e]">{memory.favorite ? 'A favourite' : memory.category} · {formatDate(memory.date)}</p><h3 className="mt-4 font-display text-4xl font-medium leading-[0.9] sm:text-5xl">{memory.title}</h3><p className="mt-4 max-w-xl text-sm text-white/75">{memory.caption || `${memory.mediaCount} ${memory.mediaCount === 1 ? 'piece' : 'pieces'} of private media kept with this memory.`}</p></div>
            </Reveal>)}
          </div>
        </section>
      )}

      <section className="border-y border-white/10 px-5 py-24 sm:px-8 lg:py-36">
        <Reveal className="mx-auto max-w-[1200px]"><p className="text-center text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">The timeline</p><div className="mt-14 space-y-0">{data.milestones.map((milestone, index) => <article key={`${milestone.date}-${milestone.title}`} className="grid gap-5 border-t border-white/10 py-9 sm:grid-cols-[7rem_1fr] sm:py-12"><span className="font-display text-4xl text-[#d7b77e]">{String(index + 1).padStart(2, '0')}</span><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#a99b8d]">{milestone.eyebrow} · {formatDate(milestone.date)}</p><h2 className="mt-4 font-display text-4xl font-medium sm:text-6xl">{milestone.title}</h2>{milestone.description && <p className="mt-5 max-w-2xl text-[#bcae9e]">{milestone.description}</p>}</div></article>)}</div></Reveal>
      </section>

      {data.movies.watchCount > 0 && <section className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36"><Reveal className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]"><div><Ticket className="text-[#d7b77e]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Movie nights</p><h2 className="mt-5 font-display text-6xl font-medium leading-[0.82]">{data.movies.uniqueCount} stories on screen.</h2><p className="mt-6 text-[#bcae9e]">{data.movies.rewatchCount ? `${data.movies.rewatchCount} ${data.movies.rewatchCount === 1 ? 'rewatch' : 'rewatches'}, because some films deserved another night.` : 'Every film was a first watch in this chapter.'}</p>{data.movies.largestRatingDisagreement && <p className="mt-6 border-l border-[#d7b77e] pl-4 text-sm text-[#d8cec2]">Biggest rating gap: {data.movies.largestRatingDisagreement.title}, {data.movies.largestRatingDisagreement.difference.toFixed(1)} stars apart.</p>}</div><div className="grid gap-5 sm:grid-cols-2">{(hasMovieRatings ? data.movies.highestRated : data.movies.mostWatched ? [data.movies.mostWatched] : []).map((movie) => { const poster = tmdbImage(movie.posterPath, 'w500'); return <article key={movie.tmdbMovieId} className="rounded-[var(--radius-lg)] bg-[#eee4d4] p-6 text-foreground">{poster ? <img src={poster} alt={`${movie.title} poster`} loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover shadow-2xl" /> : <div className="grid aspect-[2/3] place-items-center rounded-lg bg-surface text-muted">No poster saved</div>}<h3 className="mt-6 font-display text-4xl font-medium">{movie.title}</h3><p className="mt-3 text-sm text-muted">{movie.averageRating !== null ? `${movie.averageRating.toFixed(1)} ★ · ` : ''}{movie.watchCount} {movie.watchCount === 1 ? 'watch' : 'watches'}</p></article>})}</div></Reveal></section>}

      {data.games.playCount > 0 && <section className="bg-accent px-5 py-24 sm:px-8 lg:py-32"><Reveal className="mx-auto grid max-w-[1500px] gap-12 lg:grid-cols-2"><div><Gamepad2 className="text-[#eed4d0]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#eed4d0]">Game nights</p><h2 className="mt-5 font-display text-6xl font-medium leading-[0.82]">Playful, competitive, cooperative.</h2><p className="mt-7 max-w-xl text-[#eadbd7]">{data.games.cooperativeWins} co-op wins, {data.games.draws} draws, and {data.games.noWinnerCount} nights where winning was beside the point.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-[var(--radius-md)] bg-black/10 p-7"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#eed4d0]">Most played</span><strong className="mt-5 block font-display text-5xl">{data.games.mostPlayed?.name ?? 'A little of everything'}</strong><span className="mt-3 block text-sm text-[#eadbd7]">{data.games.mostPlayed?.playCount ?? 0} plays</span></div>{data.games.partnerWins.map((winner) => <div key={winner.userId} className="rounded-[var(--radius-md)] bg-black/10 p-7"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#eed4d0]">Individual wins</span><strong className="mt-5 block font-display text-5xl">{winner.wins}</strong><span className="mt-3 block text-sm text-[#eadbd7]">{winner.displayName}</span></div>)}</div></Reveal></section>}

      {data.soundtrack.songsAdded > 0 && <section className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36"><Reveal><Music2 className="text-[#d7b77e]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">The soundtrack</p><h2 className="mt-5 max-w-5xl font-display text-6xl font-medium leading-[0.82]">{data.soundtrack.songsAdded} songs placed beside this chapter.</h2></Reveal><div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-white/10 md:grid-cols-2">{data.soundtrack.highlights.map((song) => <article key={`${song.title}-${song.artist}-${song.addedOn}`} className="relative min-h-64 overflow-hidden bg-cinematic p-7 sm:p-9">{song.artworkUrl && <img src={song.artworkUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-15" />}<div className="relative"><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#d7b77e]">{song.isOurSong ? 'Our Song' : formatDate(song.addedOn)}</span><h3 className="mt-5 font-display text-5xl font-medium leading-none">{song.title}</h3><p className="mt-3 text-[#bcae9e]">{song.artist}</p>{song.whyItMatters && <p className="mt-6 font-display text-2xl italic text-[#ded2c5]">{song.whyItMatters}</p>}</div></article>)}</div></section>}

      {data.activities.completedCount > 0 && <section className="border-y border-white/10 px-5 py-24 sm:px-8 lg:py-36"><Reveal className="mx-auto max-w-[1500px]"><CalendarHeart className="text-[#d7b77e]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Days we actually lived</p><h2 className="mt-5 max-w-5xl font-display text-6xl font-medium leading-[0.82]">{data.activities.completedCount} completed dates—not plans, the real history.</h2><div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat value={data.activities.indoorCount} label="indoors or at home" icon={<CalendarHeart size={18} />} /><Stat value={data.activities.outdoorCount} label="outdoors" icon={<CalendarHeart size={18} />} /><Stat value={data.activities.freeCount} label="free dates" icon={<CalendarHeart size={18} />} /><Stat value={data.activities.adventurousCount} label="adventurous" icon={<CalendarHeart size={18} />} /></div>{data.activities.topCategories.length > 0 && <p className="mt-8 text-[#bcae9e]">Most recurring: {data.activities.topCategories.map((category) => `${category.category.replaceAll('_', ' ')} (${category.count})`).join(' · ')}</p>}</Reveal></section>}

      {data.bucket.addedCount + data.bucket.completedCount > 0 && <section className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36"><Reveal><ListChecks className="text-[#d7b77e]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Dreams in motion</p><h2 className="mt-5 font-display text-6xl font-medium leading-[0.82]">{data.bucket.addedCount} added. {data.bucket.completedCount} made real.</h2></Reveal><div className="mt-12 grid gap-5 md:grid-cols-3">{data.bucket.highlights.map((item) => <article key={`${item.title}-${item.addedDate}-${item.dateContext}`} className="relative min-h-72 overflow-hidden rounded-[var(--radius-lg)] border border-white/10 p-7">{item.preview && <Media media={item.preview} className="absolute inset-0 h-full w-full object-cover opacity-35" />}<div className="absolute inset-0 bg-gradient-to-t from-cinematic via-cinematic/55 to-transparent" /><div className="relative flex h-full flex-col"><ListChecks className="text-[#d7b77e]" aria-hidden="true" /><h3 className="mt-auto font-display text-4xl font-medium">{item.title}</h3><p className="mt-4 text-sm text-[#bcae9e]">{item.dateContext === 'completed' ? `Completed ${formatDate(item.completedDate!)}` : `Added ${formatDate(item.addedDate)}`}</p></div></article>)}</div></section>}

      {data.letters.openedCount > 0 && <section className="border-t border-white/10 px-5 py-24 sm:px-8 lg:py-36"><Reveal className="mx-auto max-w-[1200px]"><Mail className="text-[#d7b77e]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">Words that reached their day</p><h2 className="mt-5 font-display text-6xl font-medium leading-[0.82]">{data.letters.openedCount} opened {data.letters.openedCount === 1 ? 'letter' : 'letters'} joined the archive.</h2>{data.letters.longestWaitDays !== null && <p className="mt-7 text-[#bcae9e]">The longest journey from sealing to opening was {data.letters.longestWaitDays} days.</p>}<div className="mt-12 space-y-3">{data.letters.highlights.map((letter) => <article key={`${letter.title}-${letter.openedAt}`} className="grid gap-5 rounded-[var(--radius-md)] border border-white/10 p-6 sm:grid-cols-[1fr_auto] sm:items-center"><div><span className="text-xs font-bold uppercase tracking-[0.14em] text-[#d7b77e]">{letter.letterType === 'typed' ? 'Typed letter' : 'Handwritten letter'} · for {letter.recipientName}</span><h3 className="mt-3 font-display text-4xl">{letter.title}</h3></div><p className="text-sm text-[#bcae9e]">From {letter.senderName}<br />Opened {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: data.relationship.timeZone }).format(letter.openedAt)}</p></article>)}</div></Reveal></section>}

      <section className="border-t border-white/10 px-5 py-28 text-center sm:px-8 lg:py-44"><Reveal><Star className="mx-auto text-[#d7b77e]" aria-hidden="true" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[#d7b77e]">{data.year.completed ? 'Volume complete' : 'To be continued'}</p><h2 className="balance mx-auto mt-7 max-w-5xl font-display text-[clamp(4rem,10vw,9rem)] font-medium italic leading-[0.8]">No ranking. Just the shape of the year we lived.</h2></Reveal></section>
    </PageTransition>
  )
}

export default RecapYearPage
