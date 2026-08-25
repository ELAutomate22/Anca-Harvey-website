import { useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Heart, Play } from 'lucide-react'
import { formatDate } from '@/lib/date'

export interface MemoryCardItem {
  id: string
  title: string
  date: string
  category: string
  favorite: boolean
  mediaType: 'photo' | 'video'
  image: string
  videoSrc?: string
  alt: string
  aspect: 'portrait' | 'landscape' | 'square'
}

interface MemoryCardProps {
  memory: MemoryCardItem
  onOpen: () => void
  priority?: boolean
}

const aspectClasses = {
  portrait: 'aspect-[4/5]',
  landscape: 'aspect-[4/3]',
  square: 'aspect-square',
}

export const MemoryCard = ({ memory, onOpen, priority = false }: MemoryCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  const startPreview = useCallback(() => {
    if (!videoRef.current) return
    void videoRef.current.play().catch(() => undefined)
  }, [])

  const stopPreview = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.pause()
    videoRef.current.currentTime = 0
  }, [])

  return (
    <motion.button
      type="button"
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => { stopPreview(); onOpen() }}
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
      onFocus={startPreview}
      onBlur={stopPreview}
      className="group block w-full text-left"
      aria-label={`Open memory: ${memory.title}`}
    >
      <figure className="paper-surface overflow-hidden rounded-[var(--radius-md)] p-2.5">
        <div className={`image-wash relative overflow-hidden rounded-[0.35rem] bg-surface ${aspectClasses[memory.aspect]}`}>
          {memory.videoSrc ? (
            <video ref={videoRef} src={memory.videoSrc} aria-label={memory.alt} muted loop playsInline preload="metadata" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035] group-focus-visible:scale-[1.035]" />
          ) : memory.image ? (
            <img src={memory.image} alt={memory.alt} loading={priority ? 'eager' : 'lazy'} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035] group-focus-visible:scale-[1.035]" />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_top,#d6aaa8_0,transparent_55%),#ebe1d1] px-5 text-center font-display text-2xl italic text-muted">Waiting for a photograph</div>
          )}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-4 text-[#fff8ee]">
            <span className="text-xs font-bold uppercase tracking-[0.15em]">{memory.category}</span>
            <span className="flex items-center gap-2">
              {memory.mediaType === 'video' && <Play size={16} fill="currentColor" aria-label="Video" />}
              {memory.favorite && <Heart size={17} fill="currentColor" aria-label="Favourite" />}
            </span>
          </div>
        </div>
        <figcaption className="px-2 pb-1 pt-4">
          <h3 className="font-display text-[1.7rem] font-medium leading-none">{memory.title}</h3>
          <p className="mt-2 text-sm text-muted">{formatDate(memory.date)}</p>
        </figcaption>
      </figure>
    </motion.button>
  )
}
