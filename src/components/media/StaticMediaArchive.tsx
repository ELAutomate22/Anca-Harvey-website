import { useState } from 'react'
import { Camera, Film, Images, Play } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  staticArchiveMedia,
  staticArchivePhotos,
  staticArchiveVideos,
  type StaticArchiveMedia,
  type StaticArchiveMediaType,
} from '@/data/staticArchive'

type ArchiveFilter = 'all' | StaticArchiveMediaType

const filters: { id: ArchiveFilter; label: string; count: number }[] = [
  { id: 'all', label: 'Everything', count: staticArchiveMedia.length },
  { id: 'photo', label: 'Photographs', count: staticArchivePhotos.length },
  { id: 'video', label: 'Films', count: staticArchiveVideos.length },
]

const aspectClass = {
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
}

export const StaticMediaArchive = () => {
  const [filter, setFilter] = useState<ArchiveFilter>('all')
  const [selected, setSelected] = useState<StaticArchiveMedia | null>(null)
  const visibleMedia = filter === 'all' ? staticArchiveMedia : staticArchiveMedia.filter((item) => item.type === filter)

  return (
    <section className="cinematic-surface overflow-hidden border-y border-white/10 py-20 text-[#f8efe2] sm:py-28 lg:py-36">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-4xl">
            <p className="editorial-rule !text-[#d7b77e]">The complete archive</p>
            <h2 className="balance mt-5 font-display text-[clamp(3.4rem,8vw,7.5rem)] font-medium leading-[0.84] tracking-[-0.045em]">Every frame. Nothing left behind.</h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#d8cec2] sm:text-lg">All of the photographs and films chosen for this site, kept together in their original order.</p>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] bg-white/10 text-center">
            <div className="min-w-32 bg-[#241c19] px-5 py-5"><Camera className="mx-auto text-[#d7b77e]" size={19} aria-hidden="true" /><strong className="mt-3 block font-display text-4xl font-medium">{staticArchivePhotos.length}</strong><span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#bcaea0]">Photos</span></div>
            <div className="min-w-32 bg-[#241c19] px-5 py-5"><Film className="mx-auto text-[#d7b77e]" size={19} aria-hidden="true" /><strong className="mt-3 block font-display text-4xl font-medium">{staticArchiveVideos.length}</strong><span className="mt-1 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#bcaea0]">Films</span></div>
          </div>
        </div>

        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-7 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0" aria-label="Filter the complete archive">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${filter === item.id ? 'border-[#d7b77e] bg-[#d7b77e] text-[#241c19]' : 'border-white/15 text-[#d8cec2] hover:border-white/35 hover:text-white'}`}
            >
              {item.label} <span className="ml-1 opacity-70">{item.count}</span>
            </button>
          ))}
        </div>

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4" aria-live="polite">
          {visibleMedia.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="group mb-4 block w-full break-inside-avoid text-left"
              aria-label={`Open ${item.label.toLowerCase()}`}
            >
              <figure className="overflow-hidden rounded-[var(--radius-md)] border border-white/10 bg-[#2b211e] p-2 transition-colors group-hover:border-[#d7b77e]/55">
                <div className={`relative overflow-hidden rounded-[0.35rem] bg-[#171210] ${aspectClass[item.orientation]}`}>
                  <img
                    src={item.type === 'video' ? item.poster : item.src}
                    alt={item.type === 'photo' ? item.alt : ''}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                  {item.type === 'video' && <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-black/45 text-white backdrop-blur-sm transition-transform group-hover:scale-105"><Play size={20} fill="currentColor" aria-hidden="true" /></span>}
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white">{item.type === 'video' ? <Film size={14} aria-hidden="true" /> : <Images size={14} aria-hidden="true" />}{item.label}</span>
                </div>
              </figure>
            </button>
          ))}
        </div>
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.label ?? 'Archive'} panelClassName="sm:max-w-6xl !bg-[#211916] !text-[#f8efe2]">
        {selected && (
          <figure>
            <div className="grid min-h-56 max-h-[72dvh] place-items-center overflow-hidden rounded-lg bg-black/40">
              {selected.type === 'photo' ? (
                <img src={selected.src} alt={selected.alt} className="max-h-[72dvh] w-auto max-w-full object-contain" />
              ) : (
                <video src={selected.src} poster={selected.poster} controls playsInline preload="metadata" className="max-h-[72dvh] w-full object-contain" aria-label={selected.alt} />
              )}
            </div>
            <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#bcaea0]"><span>{selected.type === 'photo' ? 'Original photograph' : 'Original film'}</span><span>{selected.filename}</span></figcaption>
          </figure>
        )}
      </Modal>
    </section>
  )
}

