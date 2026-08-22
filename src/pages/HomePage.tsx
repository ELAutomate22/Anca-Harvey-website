import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowRight, CalendarHeart, Gamepad2, Heart, Images, Mail, Music2, Ticket } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { relationshipConfig } from '@/config/relationship'
import { useAuth } from '@/features/auth/auth-context'
import { MemoryCard, type MemoryCardItem } from '@/components/media/MemoryCard'
import { apiRequest, type ApiMemory, type MemoryPage } from '@/lib/api'
import { RelationshipCounter } from '@/components/relationship/RelationshipCounter'
import { CinematicLink } from '@/components/ui/Button'
import { PageTransition, Reveal, SectionHeader } from '@/components/ui/Page'

const features = [
  { to: '/story', index: '01', title: 'Our Story', copy: 'The chapters, turning points, and ordinary days that became ours.', icon: Heart, className: 'md:col-span-7', image: '/assets/images/blue-hour-beach.webp' },
  { to: '/memories', index: '02', title: 'Memories', copy: 'Photographs, small notes, and moments worth stepping back into.', icon: Images, className: 'md:col-span-5', image: '/assets/images/cafe-hands.webp' },
  { to: '/movies', index: '03', title: 'Movie Night', copy: 'A shared watchlist and a cure for choosing forever.', icon: Ticket, className: 'md:col-span-4', image: undefined },
  { to: '/games', index: '04', title: 'Game Night', copy: 'Something playful for the evenings that need a little chaos.', icon: Gamepad2, className: 'md:col-span-4', image: undefined },
  { to: '/soundtrack', index: '05', title: 'Our Soundtrack', copy: 'The songs that know exactly where we were.', icon: Music2, className: 'md:col-span-4', image: undefined },
  { to: '/activities', index: '06', title: 'Date Ideas', copy: 'Plans for when “what should we do?” needs a better answer.', icon: CalendarHeart, className: 'md:col-span-7', image: undefined },
  { to: '/letters', index: '07', title: 'Letters to the Future', copy: 'Words sent ahead, waiting for the right day.', icon: Mail, className: 'md:col-span-5', image: undefined },
] as const

const HomePage = () => {
  const navigate = useNavigate()
  const auth = useAuth()
  const [memory, setMemory] = useState<ApiMemory | null>(null)
  const relationship = auth.relationship
  const partner1Name = auth.profiles.find((profile) => profile.id === relationship?.partner1UserId)?.displayName ?? relationshipConfig.partner1Name
  const partner2Name = auth.profiles.find((profile) => profile.id === relationship?.partner2UserId)?.displayName ?? relationshipConfig.partner2Name
  const relationshipTitle = relationship?.title ?? relationshipConfig.title
  const startDate = relationship?.startDate ?? relationshipConfig.startDate

  useEffect(() => {
    const loadFeaturedMemory = async () => {
      try {
        const favorites = await apiRequest<MemoryPage>('/api/memories?limit=1&favorite=true&sort=newest')
        if (favorites.items[0]) {
          setMemory(favorites.items[0])
          return
        }
        const recent = await apiRequest<MemoryPage>('/api/memories?limit=1&sort=newest')
        setMemory(recent.items[0] ?? null)
      } catch {
        setMemory(null)
      }
    }
    void loadFeaturedMemory()
  }, [])

  const memoryCard: MemoryCardItem | null = memory ? (() => {
    const firstImage = memory.media.find((media) => media.type === 'image')
    const firstMedia = firstImage ?? memory.media[0]
    return {
      id: memory.id,
      title: memory.title,
      date: memory.date,
      category: memory.category,
      favorite: memory.favorite,
      mediaType: firstMedia?.type === 'video' ? 'video' : 'photo',
      image: firstMedia?.type === 'image' ? firstMedia.url : '',
      videoSrc: !firstImage && firstMedia?.type === 'video' ? firstMedia.url : undefined,
      alt: firstMedia?.altText || memory.title,
      aspect: 'landscape',
    }
  })() : null

  return (
    <PageTransition>
      <section className="relative mx-auto grid min-h-[calc(100dvh-var(--nav-height))] max-w-[1600px] items-center gap-10 overflow-hidden px-5 py-14 sm:px-8 md:py-20 lg:grid-cols-[minmax(0,0.93fr)_minmax(30rem,1.07fr)] lg:px-12 xl:gap-20">
        <div className="relative z-10 max-w-3xl lg:pb-16">
          <p className="editorial-rule">{relationshipTitle} · Vol. I</p>
          <h1 className="balance mt-7 font-display text-[clamp(4.4rem,10vw,10.5rem)] font-medium leading-[0.72] tracking-[-0.055em]">
            <span className="block">{partner1Name}</span>
            <span className="ml-[0.45em] block italic text-accent">&amp; {partner2Name}</span>
          </h1>
          <p className="mt-9 max-w-md text-lg leading-8 text-muted sm:text-xl">Our little corner of the world—made for the things we never want to lose.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <CinematicLink to="/story" variant="romantic">Begin our story <ArrowRight size={16} aria-hidden="true" /></CinematicLink>
            <a href="#together" className="inline-flex min-h-12 items-center gap-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted transition-colors hover:text-accent">Together, in numbers <ArrowDownRight size={16} aria-hidden="true" /></a>
          </div>
        </div>

        <div className="relative mx-auto min-h-[31rem] w-full max-w-[42rem] sm:min-h-[40rem] lg:min-h-[48rem]">
          <motion.figure initial={{ opacity: 0, rotate: 1.5, y: 20 }} animate={{ opacity: 1, rotate: 1.5, y: 0 }} transition={{ delay: 0.12, duration: 0.62 }} className="paper-surface absolute right-[2%] top-[2%] w-[79%] rotate-[1.5deg] p-2.5 sm:p-3">
            <div className="aspect-[4/5] overflow-hidden"><img src="/assets/images/lakeside.webp" alt="A fictional couple embracing by a lake at golden hour" className="h-full w-full object-cover object-[58%_center]" /></div>
            <figcaption className="px-2 pb-1 pt-3 font-display text-xl italic text-muted">The long way home</figcaption>
          </motion.figure>
          <motion.figure initial={{ opacity: 0, rotate: -6, x: -15 }} animate={{ opacity: 1, rotate: -6, x: 0 }} transition={{ delay: 0.28, duration: 0.58 }} className="paper-surface absolute bottom-[1%] left-[1%] w-[47%] -rotate-6 p-2.5 sm:left-[-2%] sm:w-[44%]">
            <div className="aspect-[4/5] overflow-hidden"><img src="/assets/images/cafe-hands.webp" alt="Two people holding hands at a cafe table" className="h-full w-full object-cover" /></div>
            <figcaption className="px-1 pt-3 font-display text-lg italic text-muted">Rain at four</figcaption>
          </motion.figure>
          <div className="absolute bottom-[7%] right-[3%] z-10 hidden w-40 border-l border-gold pl-4 text-xs uppercase tracking-[0.14em] text-muted sm:block">An archive of<br />the life between<br />the milestones</div>
        </div>
      </section>

      <Reveal className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-28" delay={0.05}>
        <div id="together" className="grid items-center gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <p className="editorial-rule">The running total</p>
            <h2 className="balance mt-5 font-display text-[clamp(3.2rem,6vw,6rem)] font-medium leading-[0.88] tracking-[-0.04em]">Every day has counted.</h2>
            <p className="mt-6 max-w-lg text-lg text-muted">The counter is calculated from one central relationship date, ready to keep growing through every next chapter.</p>
          </div>
          <RelationshipCounter startDate={startDate} />
        </div>
      </Reveal>

      {memory && memoryCard && (
        <section className="cinematic-surface overflow-hidden py-20 sm:py-28">
          <div className="mx-auto grid max-w-[1500px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)] lg:px-12">
            <Reveal>
              <p className="editorial-rule !text-[#d7b77e]">Memory of the day</p>
              <h2 className="balance mt-5 font-display text-[clamp(3.2rem,7vw,6.5rem)] font-medium leading-[0.86] tracking-[-0.04em]">{memory.title}</h2>
              <p className="mt-6 max-w-lg text-lg text-[#d8cec2]">{memory.caption || 'A moment worth keeping.'}</p>
              <CinematicLink to="/memories" variant="secondary" className="mt-8 !border-[#675a52] !text-[#fff8ee] hover:!bg-white/5">Open the memory shelf <ArrowRight size={16} aria-hidden="true" /></CinematicLink>
            </Reveal>
            <Reveal className="mx-auto w-full max-w-lg rotate-[2deg] lg:max-w-xl">
              <MemoryCard memory={memoryCard} onOpen={() => navigate('/memories')} priority />
            </Reveal>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1500px] px-5 py-20 sm:px-8 lg:px-12 lg:py-32">
        <SectionHeader eyebrow="Inside our world" title="Made to be lived in, not finished." description="Every room has its own character, while every detail still belongs to the same story." />
        <div className="grid gap-4 md:grid-cols-12 lg:gap-6">
          {features.map(({ to, index, title, copy, icon: Icon, className, image }) => (
            <Link key={to} to={to} className={className}>
              <motion.article whileHover={{ y: -5 }} className={`group relative flex min-h-[20rem] h-full overflow-hidden rounded-[var(--radius-lg)] border border-line p-6 sm:p-8 ${image ? 'text-[#fff8ee]' : 'paper-surface'}`}>
                {image && <><img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" /><div className="absolute inset-0 bg-gradient-to-t from-[#1d1512]/90 via-[#1d1512]/20 to-transparent" /></>}
                <div className="relative z-10 flex w-full flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{index}</span>
                    <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <div className="mt-auto">
                    <h3 className="font-display text-[clamp(2.4rem,5vw,4.2rem)] font-medium leading-[0.9]">{title}</h3>
                    <p className={`mt-4 max-w-md ${image ? 'text-[#e4d9cc]' : 'text-muted'}`}>{copy}</p>
                  </div>
                </div>
              </motion.article>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-line px-5 py-28 text-center sm:px-8 lg:py-44">
        <img src="/assets/images/blue-hour-beach.webp" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-[0.16] grayscale" />
        <div className="absolute inset-0 bg-background/70" />
        <Reveal className="relative mx-auto max-w-5xl">
          <Heart className="mx-auto text-accent" size={24} strokeWidth={1.4} aria-hidden="true" />
          <h2 className="balance mt-7 font-display text-[clamp(4rem,10vw,9rem)] font-medium italic leading-[0.82] tracking-[-0.05em]">And we’re still writing it.</h2>
        </Reveal>
      </section>
    </PageTransition>
  )
}

export default HomePage
