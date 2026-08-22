import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, LockKeyhole, MailOpen, PenLine, Plus, Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import { mockLetters } from '@/data/mockLetters'
import type { FutureLetter } from '@/types/content'
import { differenceInCalendarDays, formatDate, parseLocalDate } from '@/lib/date'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader, PageTransition, Reveal } from '@/components/ui/Page'

const EnvelopeCard = ({ letter, opened, onOpen }: { letter: FutureLetter; opened: boolean; onOpen: () => void }) => {
  const ready = letter.state === 'ready'
  const days = Math.max(0, differenceInCalendarDays(parseLocalDate(letter.unlockDate), new Date()))
  return (
    <article className={`paper-surface group relative overflow-hidden rounded-[var(--radius-lg)] p-6 sm:p-8 ${letter.state === 'sealed' ? 'opacity-85' : ''}`}>
      <div className="mb-7 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-[0.14em] text-muted"><span>{letter.recipient}</span><span>{letter.state}</span></div>
      <button onClick={ready ? onOpen : undefined} disabled={!ready} aria-expanded={ready ? opened : undefined} className={`relative block aspect-[16/10] w-full overflow-hidden rounded-md border border-[#bda98f] bg-[#d9c9b3] text-left shadow-inner ${ready ? 'cursor-pointer' : 'cursor-default'}`}>
        <div className="absolute inset-x-0 bottom-0 h-[62%] [clip-path:polygon(0_100%,0_0,50%_58%,100%_0,100%_100%)] bg-[#cdb99f]" />
        <motion.div animate={{ rotateX: opened ? 180 : 0 }} transition={{ duration: 0.42 }} style={{ transformOrigin: 'top' }} className="absolute inset-x-0 top-0 z-20 h-[58%] [clip-path:polygon(0_0,100%_0,50%_100%)] bg-[#e4d6c1]" />
        <motion.div animate={{ y: opened ? '-24%' : '46%' }} transition={{ duration: 0.42 }} className="absolute inset-x-[9%] top-[18%] z-10 h-[78%] rounded-sm bg-[#fffaf0] p-5 shadow-md">
          <p className="font-display text-xl italic text-[#5d4d42]">{opened ? letter.preview : 'For later…'}</p>
        </motion.div>
        {ready && !opened && <span className="absolute inset-0 z-30 grid place-items-center"><span className="rounded-full bg-accent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">Open letter</span></span>}
      </button>
      <h2 className="mt-7 font-display text-3xl font-medium leading-none sm:text-4xl">{letter.title}</h2>
      <div className="mt-5 flex items-center gap-3 text-sm text-muted"><CalendarDays size={17} className="text-accent" /> {formatDate(letter.unlockDate)}</div>
      {letter.state === 'sealed' && <p className="mt-3 flex items-center gap-2 text-sm text-muted"><LockKeyhole size={16} /> {days} days until this sample unlocks</p>}
      {letter.state === 'opened' && <p className="mt-3 flex items-center gap-2 text-sm text-accent"><MailOpen size={16} /> Opened in this visual prototype</p>}
    </article>
  )
}

const LettersPage = () => {
  const [modalOpen, setModalOpen] = useState(false)
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<'typed' | 'uploaded'>('typed')
  const [message, setMessage] = useState('')
  const readyCount = useMemo(() => mockLetters.filter((letter) => letter.state === 'ready').length, [])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setModalOpen(false)
    setMessage('A local demo draft was created for this session. It is not securely stored or locked yet.')
  }

  return (
    <PageTransition>
      <PageHeader eyebrow="Postmarked for later" title="Letters to the Future" intro="Write something now and let a future date give it back. Phase 1 demonstrates the experience only—these samples are not securely locked or persisted yet." aside={<CinematicButton onClick={() => setModalOpen(true)} variant="romantic" className="mt-7"><Plus size={16} /> Create a letter</CinematicButton>} />

      <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8 lg:px-12">
        <div role="status" aria-live="polite" className="mb-8 min-h-6 text-sm font-semibold text-accent">{message}</div>
        <div className="mb-10 flex items-center justify-between border-y border-line py-4 text-sm text-muted"><span>{mockLetters.length} sample letters</span><span>{readyCount} ready to open</span></div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {mockLetters.map((letter, index) => <Reveal key={letter.id} delay={index * 0.04}><EnvelopeCard letter={letter} opened={letter.state === 'opened' || openedIds.has(letter.id)} onOpen={() => setOpenedIds((current) => new Set(current).add(letter.id))} /></Reveal>)}
        </div>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Send a letter forward" panelClassName="sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <p className="rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-muted"><strong className="text-foreground">Prototype note:</strong> this form keeps temporary component state only. Real locking and secure storage are intentionally deferred.</p>
          <fieldset><legend className="mb-3 text-sm font-bold">Letter format</legend><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setFormat('typed')} aria-pressed={format === 'typed'} className={`min-h-24 rounded-lg border p-4 text-left ${format === 'typed' ? 'border-accent bg-accent/5' : 'border-line'}`}><PenLine size={20} className="mb-3" /><span className="font-semibold">Type a letter</span></button><button type="button" onClick={() => setFormat('uploaded')} aria-pressed={format === 'uploaded'} className={`min-h-24 rounded-lg border p-4 text-left ${format === 'uploaded' ? 'border-accent bg-accent/5' : 'border-line'}`}><Upload size={20} className="mb-3" /><span className="font-semibold">Upload a scan</span></button></div></fieldset>
          <label className="block"><span className="mb-2 block text-sm font-bold">Letter title</span><input required name="title" className="min-h-12 w-full rounded-md border border-line bg-background px-4 text-base" placeholder="For a day we’ll need this" /></label>
          {format === 'typed' ? <label className="block"><span className="mb-2 block text-sm font-bold">Your letter</span><textarea required name="body" rows={5} className="w-full rounded-md border border-line bg-background p-4 text-base" placeholder="Dear future us…" /></label> : <div className="rounded-lg border border-dashed border-line p-7 text-center text-sm text-muted"><Upload className="mx-auto mb-3" size={22} /><strong className="block text-foreground">Real uploads are disabled in Phase 1</strong>The future R2 integration point belongs here.</div>}
          <div className="grid gap-5 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">Open date</span><input required type="date" name="date" className="min-h-12 w-full rounded-md border border-line bg-background px-4 text-base" /></label><label><span className="mb-2 block text-sm font-bold">Recipient</span><select name="recipient" className="min-h-12 w-full rounded-md border border-line bg-background px-4 text-base"><option>Both of us</option><option>Partner One</option><option>Partner Two</option></select></label></div>
          <CinematicButton type="submit" variant="romantic" className="w-full">Create demo letter</CinematicButton>
        </form>
      </Modal>
    </PageTransition>
  )
}

export default LettersPage
