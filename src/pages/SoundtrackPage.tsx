import { useEffect, useState, type FormEvent } from 'react'
import { ExternalLink, LoaderCircle, Music2, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingSkeleton, PageHeader, PageTransition, SectionHeader } from '@/components/ui/Page'
import { apiRequest, type ApiMemory, type MemoryPage } from '@/lib/api'
import { soundtrackService } from '@/features/soundtrack/soundtrack-service'
import type { SongInput, SoundtrackSong } from '@/features/soundtrack/types'

const fieldClass = 'mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4'
const localDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const fetchSoundtrack = () => Promise.all([
  soundtrackService.list(),
  apiRequest<MemoryPage>('/api/memories?limit=50'),
])

interface SongFormProps {
  song?: SoundtrackSong
  memories: ApiMemory[]
  onCancel: () => void
  onSaved: (song: SoundtrackSong) => void
}

const SongForm = ({ song, memories, onCancel, onSaved }: SongFormProps) => {
  const [form, setForm] = useState<SongInput>({
    title: song?.title ?? '',
    artist: song?.artist ?? '',
    spotifyUrl: song?.spotifyUrl ?? '',
    youtubeUrl: song?.youtubeUrl ?? '',
    whyItMatters: song?.whyItMatters ?? '',
    addedOn: song?.addedOn ?? localDate(),
    associatedMemoryId: song?.associatedMemoryId ?? null,
    artworkMediaId: song?.artworkMediaId ?? null,
    isOurSong: song?.isOurSong ?? false,
  })
  const [useMemoryArtwork, setUseMemoryArtwork] = useState(Boolean(song?.artworkMediaId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedMemory = memories.find((memory) => memory.id === form.associatedMemoryId)
  const availableArtwork = selectedMemory?.media.find((media) => media.type === 'image')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    const input = { ...form, artworkMediaId: useMemoryArtwork ? (availableArtwork?.id ?? form.artworkMediaId ?? null) : null }
    try { onSaved(song ? await soundtrackService.update(song.id, input) : await soundtrackService.create(input)) } catch (caught) { setError(caught instanceof Error ? caught.message : 'The soundtrack entry could not be saved.') } finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Song title</span><input required maxLength={250} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Artist</span><input required maxLength={250} value={form.artist} onChange={(event) => setForm((current) => ({ ...current, artist: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Spotify link</span><input type="url" placeholder="https://open.spotify.com/…" maxLength={1000} value={form.spotifyUrl} onChange={(event) => setForm((current) => ({ ...current, spotifyUrl: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">YouTube link</span><input type="url" placeholder="https://www.youtube.com/…" maxLength={1000} value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Date added</span><input type="date" required value={form.addedOn} onChange={(event) => setForm((current) => ({ ...current, addedOn: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Associated memory</span><select value={form.associatedMemoryId ?? ''} onChange={(event) => { setForm((current) => ({ ...current, associatedMemoryId: event.target.value || null, artworkMediaId: null })); setUseMemoryArtwork(false) }} className={fieldClass}><option value="">No associated memory</option>{memories.map((memory) => <option key={memory.id} value={memory.id}>{memory.title} · {memory.date}</option>)}</select></label>
    {form.associatedMemoryId && <label className="flex min-h-12 items-center gap-3 sm:col-span-2"><input type="checkbox" checked={useMemoryArtwork} disabled={!availableArtwork} onChange={(event) => setUseMemoryArtwork(event.target.checked)} className="size-5 accent-[var(--accent)]" /><span className="text-sm">Use the first authenticated photo from this memory as the sleeve{!availableArtwork ? ' (no photo available)' : ''}</span></label>}
    <label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Why this song matters</span><textarea rows={5} maxLength={5000} value={form.whyItMatters} onChange={(event) => setForm((current) => ({ ...current, whyItMatters: event.target.value }))} className={`${fieldClass} py-3`} /></label>
    {!song?.isOurSong && <label className="flex min-h-12 items-center gap-3 sm:col-span-2"><input type="checkbox" checked={form.isOurSong} onChange={(event) => setForm((current) => ({ ...current, isOurSong: event.target.checked }))} className="size-5 accent-[var(--accent)]" /><span className="font-semibold">Make this Our Song</span></label>}
    <p role="alert" className="min-h-6 text-sm font-semibold text-accent sm:col-span-2">{error}</p>
    <div className="flex flex-wrap gap-3 sm:col-span-2"><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving && <LoaderCircle size={16} className="animate-spin" />}{song ? 'Save song' : 'Add to soundtrack'}</CinematicButton><CinematicButton type="button" variant="ghost" onClick={onCancel}>Cancel</CinematicButton></div>
  </form>
}

const Sleeve = ({ song, className = '' }: { song: SoundtrackSong; className?: string }) => (
  <div className={`relative overflow-hidden border border-white/10 bg-gradient-to-br from-[#7a2a3a] via-[#4a2830] to-[#211719] ${className}`}>
    {song.artworkUrl ? <img src={song.artworkUrl} alt={`Artwork associated with ${song.title}`} loading="lazy" className="h-full w-full object-cover" /> : <><div className="absolute inset-5 border border-white/20" /><Music2 className="absolute bottom-7 left-7 text-white/70" size={36} strokeWidth={1.2} /></>}
  </div>
)

const SoundtrackPage = () => {
  const [songs, setSongs] = useState<SoundtrackSong[]>([])
  const [memories, setMemories] = useState<ApiMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SoundtrackSong | null>(null)

  const load = async () => {
    try {
      const [nextSongs, memoryPage] = await fetchSoundtrack()
      setSongs(nextSongs); setMemories(memoryPage.items); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The soundtrack could not be loaded.') } finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    fetchSoundtrack().then(([nextSongs, memoryPage]) => {
      if (!active) return
      setSongs(nextSongs); setMemories(memoryPage.items); setLoading(false)
    }).catch((caught: unknown) => { if (active) { setError(caught instanceof Error ? caught.message : 'The soundtrack could not be loaded.'); setLoading(false) } })
    return () => { active = false }
  }, [])

  const ourSong = songs.find((song) => song.isOurSong) ?? null
  const rest = songs.filter((song) => !song.isOurSong)
  const saved = (song: SoundtrackSong) => {
    setSongs((current) => {
      const next = current.some((item) => item.id === song.id)
        ? current.map((item) => item.id === song.id ? song : item)
        : [...current, song]
      return next.map((item) => item.id === song.id ? song : (song.isOurSong ? { ...item, isOurSong: false } : item)).sort((a, b) => Number(b.isOurSong) - Number(a.isOurSong) || b.addedOn.localeCompare(a.addedOn))
    })
    setEditing(null); setFormOpen(false); setMessage(editing ? 'Soundtrack entry updated.' : 'Song added to your shared soundtrack.')
  }
  const makeOurSong = async (song: SoundtrackSong) => {
    try {
      const updated = await soundtrackService.update(song.id, { isOurSong: true })
      setSongs((current) => current.map((item) => item.id === updated.id ? updated : { ...item, isOurSong: false }).sort((a, b) => Number(b.isOurSong) - Number(a.isOurSong) || b.addedOn.localeCompare(a.addedOn)))
      setMessage(`“${updated.title}” is now Our Song.`)
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Our Song could not be changed.')
    }
  }
  const remove = async (song: SoundtrackSong) => {
    if (!window.confirm(`Remove “${song.title}” from your soundtrack?`)) return
    try { await soundtrackService.delete(song.id); await load(); setMessage('Song removed. If it was Our Song, the next entry was promoted automatically.') } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The song could not be removed.') }
  }

  return <PageTransition>
    <PageHeader eyebrow="Needle down" title="Our Soundtrack" intro="Real song metadata and approved streaming links—never copied audio—attached to the places, seasons, and memories that made the music ours." aside={<CinematicButton onClick={() => { setEditing(null); setFormOpen(true) }} variant="romantic" className="mt-7"><Plus size={16} /> Add a song</CinematicButton>} />
    <section className="mx-auto max-w-[1400px] px-5 pb-10 sm:px-8 lg:px-12"><p role="status" aria-live="polite" className="min-h-6 text-sm font-semibold text-accent">{message}</p></section>
    {loading && <section className="mx-auto max-w-[1400px] px-5 pb-28"><LoadingSkeleton className="min-h-[36rem]" /></section>}
    {!loading && error && <section className="mx-auto max-w-[1200px] px-5 pb-28"><div role="alert" className="rounded-xl border border-line p-8"><p>{error}</p><CinematicButton onClick={() => void load()} variant="secondary" className="mt-5">Try again</CinematicButton></div></section>}
    {!loading && !error && !songs.length && <section className="mx-auto max-w-[1000px] px-5 pb-32 sm:px-8"><div className="paper-surface rounded-[var(--radius-lg)] p-10 text-center sm:p-16"><div className="vinyl-disc mx-auto size-44 rounded-full shadow-xl" /><h2 className="mt-8 font-display text-5xl">The turntable is waiting.</h2><p className="mx-auto mt-5 max-w-xl text-muted">Add your first real song. The first entry becomes Our Song automatically, and either partner can change it later.</p><CinematicButton onClick={() => setFormOpen(true)} variant="romantic" className="mt-8"><Plus size={16} /> Add the first song</CinematicButton></div></section>}

    {!loading && !error && ourSong && <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8 lg:px-12"><div className="cinematic-surface grid overflow-hidden rounded-[var(--radius-lg)] lg:grid-cols-2"><div className="relative min-h-[28rem] overflow-hidden p-8 sm:p-12 lg:min-h-[38rem]"><div className="absolute left-[28%] top-1/2 aspect-square w-[63%] -translate-y-1/2 rounded-full vinyl-disc shadow-2xl" aria-hidden="true" /><Sleeve song={ourSong} className="absolute left-[8%] top-1/2 z-10 aspect-square w-[55%] -translate-y-1/2 shadow-2xl" /></div><div className="flex flex-col justify-center p-8 sm:p-12 lg:p-16"><p className="editorial-rule !text-[#d7b77e]">Our song</p><h2 className="balance mt-6 font-display text-[clamp(3.5rem,7vw,6.8rem)] font-medium leading-[0.82]">{ourSong.title}</h2><p className="mt-4 text-lg text-[#d8cec2]">{ourSong.artist}</p>{ourSong.whyItMatters && <p className="mt-8 max-w-lg font-display text-3xl italic leading-tight text-[#eee1d4]">“{ourSong.whyItMatters}”</p>}<div className="mt-8 flex flex-wrap gap-3">{ourSong.spotifyUrl && <a href={ourSong.spotifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-sm border border-white/20 px-5 text-xs font-bold uppercase tracking-[0.13em]"><ExternalLink size={15} /> Spotify</a>}{ourSong.youtubeUrl && <a href={ourSong.youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-sm border border-white/20 px-5 text-xs font-bold uppercase tracking-[0.13em]"><ExternalLink size={15} /> YouTube</a>}</div>{ourSong.associatedMemoryId && <Link to={`/memories?memory=${encodeURIComponent(ourSong.associatedMemoryId)}`} className="mt-6 w-fit text-sm font-semibold text-[#d7b77e]">Memory: {ourSong.associatedMemoryTitle ?? 'Open memory'} →</Link>}<div className="mt-7 flex gap-2"><button onClick={() => { setEditing(ourSong); setFormOpen(true) }} aria-label={`Edit ${ourSong.title}`} className="grid size-11 place-items-center rounded-full border border-white/20"><Pencil size={16} /></button><button onClick={() => void remove(ourSong)} aria-label={`Delete ${ourSong.title}`} className="grid size-11 place-items-center rounded-full border border-white/20"><Trash2 size={16} /></button></div></div></div></section>}

    {!loading && !error && rest.length > 0 && <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8 lg:px-12 lg:pb-36"><SectionHeader eyebrow="Side B" title="Songs with a memory inside." description="Each sleeve holds metadata and a safe outbound streaming link; no copyrighted recording is stored here." /><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{rest.map((song) => <motion.article key={song.id} whileHover="hover" className="group"><div className="relative mb-6 aspect-square"><motion.div variants={{ hover: { x: '22%' } }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} className="vinyl-disc absolute inset-3 rounded-full shadow-xl" /><Sleeve song={song} className="absolute inset-y-0 left-0 w-[88%] shadow-[var(--shadow-soft)]" /></div><div className="flex items-start justify-between gap-4"><div><p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-accent">{song.artist}</p><h3 className="mt-2 font-display text-3xl font-medium leading-none">{song.title}</h3></div><div className="flex gap-1"><button onClick={() => { setEditing(song); setFormOpen(true) }} aria-label={`Edit ${song.title}`} className="grid size-11 place-items-center rounded-full border border-line"><Pencil size={16} /></button><button onClick={() => void remove(song)} aria-label={`Delete ${song.title}`} className="grid size-11 place-items-center rounded-full border border-line"><Trash2 size={16} /></button></div></div><p className="mt-4 text-muted">{song.whyItMatters}</p><div className="mt-5 flex flex-wrap gap-3">{song.spotifyUrl && <a href={song.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent">Spotify ↗</a>}{song.youtubeUrl && <a href={song.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent">YouTube ↗</a>}{song.associatedMemoryId && <Link to={`/memories?memory=${encodeURIComponent(song.associatedMemoryId)}`} className="text-sm font-semibold text-accent">Memory →</Link>}</div><button onClick={() => void makeOurSong(song)} className="mt-5 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted"><Star size={15} /> Make Our Song</button></motion.article>)}</div></section>}

    <Modal open={formOpen} onClose={() => { setFormOpen(false); setEditing(null) }} title={editing ? `Edit ${editing.title}` : 'Add to Our Soundtrack'} panelClassName="max-w-3xl">{formOpen && <SongForm song={editing ?? undefined} memories={memories} onCancel={() => { setFormOpen(false); setEditing(null) }} onSaved={saved} />}</Modal>
  </PageTransition>
}

export default SoundtrackPage
