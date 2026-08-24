import { ArrowDown, CalendarHeart, Gamepad2, Images, Music2, Ticket } from 'lucide-react'
import { mockActivities } from '@/data/mockActivities'
import { mockGames } from '@/data/mockGames'
import { mockMemories } from '@/data/mockMemories'
import { mockMovies } from '@/data/mockMovies'
import { mockSongs } from '@/data/mockSongs'
import { PageTransition, Reveal } from '@/components/ui/Page'

const RecapPage = () => {
  const movie = mockMovies[0]!
  const activity = mockActivities[1]!
  const song = mockSongs.find((item) => item.isOurSong) ?? mockSongs[0]!
  const stats = [
    { value: mockMemories.length, label: 'mock memories', icon: Images },
    { value: mockMovies.length, label: 'mock movies', icon: Ticket },
    { value: mockActivities.length, label: 'date ideas', icon: CalendarHeart },
    { value: mockGames.length, label: 'game nights', icon: Gamepad2 },
    { value: mockSongs.length, label: 'songs', icon: Music2 },
  ]
  return (
    <PageTransition className="bg-cinematic text-[#f8efe2]">
      <section className="relative grid min-h-[calc(100dvh-var(--nav-height))] place-items-center overflow-hidden px-5 py-20 text-center">
        <img
          src="/assets/our-year/our-year-background.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[55%_center] opacity-70 sm:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-cinematic/35 via-cinematic/50 to-cinematic" />
        <div className="relative mx-auto max-w-6xl">
          <p className="editorial-rule mx-auto w-fit !text-[#d7b77e]">Mock anniversary recap</p>
          <h1 className="balance mt-7 font-display text-[clamp(4.6rem,15vw,13rem)] font-medium leading-[0.7] tracking-[-0.055em]">Our First Year</h1>
          <p className="mt-10 text-lg text-[#ded2c5]">A visual foundation. Every figure below is explicitly drawn from Phase 1 mock data.</p>
          <ArrowDown className="mx-auto mt-12 animate-bounce text-[#d7b77e] motion-reduce:animate-none" size={24} aria-hidden="true" />
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-12 lg:py-36">
        <Reveal className="grid items-end gap-10 border-b border-white/10 pb-20 lg:grid-cols-[1fr_1.2fr]">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7b77e]">The opening number</p><strong className="block font-display text-[clamp(8rem,24vw,22rem)] font-medium leading-[0.62] tracking-[-0.06em]">365</strong></div>
          <p className="max-w-2xl pb-4 font-display text-[clamp(2.8rem,6vw,5.5rem)] italic leading-[0.95] text-[#ded2c5]">days of becoming part of each other’s ordinary.</p>
        </Reveal>
        <div className="grid border-b border-white/10 sm:grid-cols-2 lg:grid-cols-5">{stats.map(({ value, label, icon: Icon }) => <div key={label} className="border-white/10 py-9 sm:border-r sm:px-6"><Icon size={19} className="mb-5 text-[#d7b77e]" /><strong className="font-display text-6xl font-medium">{value}</strong><span className="mt-2 block text-xs uppercase tracking-[0.13em] text-[#bbae9f]">{label}</span></div>)}</div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-6 px-5 pb-24 sm:px-8 md:grid-cols-12 lg:px-12 lg:pb-36">
        <Reveal className="relative min-h-[36rem] overflow-hidden rounded-[var(--radius-lg)] md:col-span-7"><img src="/assets/images/IMG-20260817-WA0021.jpg" alt="The couple sitting together outside" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" /><div className="absolute inset-x-0 bottom-0 p-8 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d7b77e]">The scene we kept</p><h2 className="mt-4 max-w-xl font-display text-5xl font-medium leading-[0.88] sm:text-7xl">The long way home.</h2></div></Reveal>
        <Reveal className="rounded-[var(--radius-lg)] bg-[#eee4d4] p-7 text-foreground md:col-span-5 sm:p-10"><p className="editorial-rule">The film</p><div className="mx-auto mt-9 aspect-[2/3] w-[58%] rounded-lg shadow-2xl" style={{ background: movie.poster }} /><h2 className="mt-8 font-display text-4xl font-medium leading-none">{movie.title}</h2><p className="mt-4 text-muted">{movie.note}</p></Reveal>
        <Reveal className="rounded-[var(--radius-lg)] bg-accent p-8 md:col-span-5 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e4c9c7]">Favourite idea</p><h2 className="mt-8 font-display text-6xl font-medium leading-[0.82]">{activity.title}</h2><p className="mt-6 text-[#eadbd7]">{activity.description}</p></Reveal>
        <Reveal className="relative overflow-hidden rounded-[var(--radius-lg)] border border-white/10 p-8 md:col-span-7 sm:p-10"><div className="vinyl-disc absolute -right-16 top-1/2 aspect-square w-[55%] -translate-y-1/2 rounded-full opacity-45" /><div className="relative max-w-md"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#d7b77e]">The song</p><h2 className="mt-8 font-display text-6xl font-medium leading-[0.82]">{song.title}</h2><p className="mt-4 text-lg text-[#d8cec2]">{song.artist}</p><p className="mt-8 font-display text-3xl italic text-[#eee1d4]">{song.note}</p></div></Reveal>
      </section>

      <section className="border-t border-white/10 px-5 py-28 text-center sm:px-8 lg:py-44"><Reveal><p className="editorial-rule mx-auto w-fit !text-[#d7b77e]">Year two starts here</p><h2 className="balance mx-auto mt-8 max-w-5xl font-display text-[clamp(4rem,11vw,10rem)] font-medium italic leading-[0.78]">Still choosing. Still curious. Still us.</h2></Reveal></section>
    </PageTransition>
  )
}

export default RecapPage
