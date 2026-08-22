import { useMemo, useState } from 'react'
import { Check, CircleDot, MapPinned, Plane, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { mockBucketList } from '@/data/mockBucketList'
import type { BucketItem } from '@/types/content'
import { CinematicButton } from '@/components/ui/Button'
import { PageHeader, PageTransition } from '@/components/ui/Page'

const categories = ['All', 'Travel', 'Food', 'Experiences', 'Places', 'Adventures', 'Small Things', 'Custom'] as const
const statusStyles: Record<BucketItem['status'], string> = {
  Dreaming: 'border-accent-soft bg-accent-soft/15 text-accent', Planning: 'border-gold bg-gold/10 text-[#765b31]', Booked: 'border-[#556b65] bg-[#556b65]/10 text-[#455b55]', Completed: 'border-accent bg-accent text-white',
}

const BucketListPage = () => {
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [message, setMessage] = useState('')
  const visible = useMemo(() => category === 'All' ? mockBucketList : mockBucketList.filter((item) => item.category === category), [category])
  return (
    <PageTransition>
      <PageHeader eyebrow="Someday, soon, done" title="Our Bucket List" intro="Big journeys, tiny rituals, and all the things that deserve to move from “one day” into a real date on the calendar." aside={<CinematicButton onClick={() => setMessage('Adding and saving items arrives with the Phase 2 data layer.')} variant="romantic" className="mt-7"><Plus size={16} /> Add a dream</CinematicButton>} />

      <section className="mx-auto max-w-[1450px] px-5 pb-28 sm:px-8 lg:px-12">
        <p role="status" aria-live="polite" className="mb-5 min-h-6 text-sm font-semibold text-accent">{message}</p>
        <div className="no-scrollbar mb-10 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-11 whitespace-nowrap rounded-full border px-4 text-xs font-bold uppercase tracking-[0.1em] ${category === item ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:bg-elevated'}`}>{item}</button>)}</div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item, index) => (
            <motion.article key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className={`paper-surface relative overflow-hidden rounded-[var(--radius-lg)] ${item.image ? 'min-h-[26rem] text-white' : 'min-h-[20rem] p-7 sm:p-8'}`}>
              {item.image && <><img src={item.image} alt={`Completed bucket list memory for ${item.title}`} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#1b1412]/90 via-[#1b1412]/20 to-transparent" /></>}
              <div className={`relative z-10 flex h-full flex-col ${item.image ? 'p-7 sm:p-8' : ''}`}>
                <div className="flex items-center justify-between gap-4"><span className={`rounded-full border px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.11em] ${item.image ? 'border-white/40 bg-black/20 text-white' : statusStyles[item.status]}`}>{item.status}</span>{item.status === 'Completed' ? <Check size={20} /> : item.category === 'Travel' ? <Plane size={20} /> : <CircleDot size={20} />}</div>
                <div className="mt-auto pt-16"><p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] opacity-70">{item.category}</p><h2 className="mt-3 font-display text-[2.7rem] font-medium leading-[0.88]">{item.title}</h2><p className={`mt-5 ${item.image ? 'text-white/75' : 'text-muted'}`}>{item.note}</p></div>
              </div>
            </motion.article>
          ))}
        </div>
        <div className="mt-10 flex items-center justify-center gap-3 border-y border-line py-8 text-sm text-muted"><MapPinned size={18} className="text-accent" /> {mockBucketList.filter((item) => item.status === 'Completed').length} dream already became a memory.</div>
      </section>
    </PageTransition>
  )
}

export default BucketListPage
