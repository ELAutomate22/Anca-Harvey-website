import { Headphones, Music2, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { mockSongs } from '@/data/mockSongs'
import { PageHeader, PageTransition, Reveal, SectionHeader } from '@/components/ui/Page'

const SoundtrackPage = () => {
  const ourSong = mockSongs.find((song) => song.isOurSong) ?? mockSongs[0]!
  const rest = mockSongs.filter((song) => !song.isOurSong)
  return (
    <PageTransition>
      <PageHeader eyebrow="Needle down" title="Our Soundtrack" intro="The songs that attached themselves to a place, a season, or one particular look across the room. Streaming comes later; the feeling is already here." />

      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8 lg:px-12">
        <div className="cinematic-surface grid overflow-hidden rounded-[var(--radius-lg)] lg:grid-cols-2">
          <Reveal className="relative min-h-[28rem] overflow-hidden p-8 sm:p-12 lg:min-h-[38rem]">
            <div className="absolute left-[28%] top-1/2 aspect-square w-[63%] -translate-y-1/2 rounded-full vinyl-disc shadow-2xl" aria-hidden="true" />
            <div className="absolute left-[8%] top-1/2 z-10 aspect-square w-[55%] -translate-y-1/2 border border-white/10 shadow-2xl" style={{ background: ourSong.artwork }}>
              <div className="absolute inset-5 border border-white/20" />
              <Music2 className="absolute bottom-7 left-7 text-white/70" size={36} strokeWidth={1.2} />
            </div>
          </Reveal>
          <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16">
            <p className="editorial-rule !text-[#d7b77e]">Our song</p>
            <h2 className="balance mt-6 font-display text-[clamp(3.5rem,7vw,6.8rem)] font-medium leading-[0.82]">{ourSong.title}</h2>
            <p className="mt-4 text-lg text-[#d8cec2]">{ourSong.artist}</p>
            <p className="mt-8 max-w-lg font-display text-3xl italic leading-tight text-[#eee1d4]">“{ourSong.note}”</p>
            <button disabled className="mt-9 inline-flex min-h-12 w-fit cursor-not-allowed items-center gap-3 rounded-sm border border-white/20 px-5 text-xs font-bold uppercase tracking-[0.14em] text-white/60"><Play size={16} /> Connect streaming later</button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8 lg:px-12 lg:pb-36">
        <SectionHeader eyebrow="Side B" title="Songs with a memory inside." description="Hover or tap into each sleeve; the vinyl detail is decorative, while every note stays readable without it." />
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((song) => (
            <motion.article key={song.id} whileHover="hover" className="group">
              <div className="relative mb-6 aspect-square">
                <motion.div variants={{ hover: { x: '22%' } }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className="vinyl-disc absolute inset-3 rounded-full shadow-xl" />
                <div className="absolute inset-y-0 left-0 w-[88%] border border-line shadow-[var(--shadow-soft)]" style={{ background: song.artwork }}><Headphones className="absolute bottom-6 left-6 text-white/70" size={30} strokeWidth={1.2} /></div>
              </div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">{song.artist}</p>
              <h3 className="mt-2 font-display text-3xl font-medium leading-none">{song.title}</h3>
              <p className="mt-4 text-muted">{song.note}</p>
            </motion.article>
          ))}
        </div>
      </section>
    </PageTransition>
  )
}

export default SoundtrackPage
