import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Check, Dices, Gamepad2, History, LoaderCircle, Pencil, Plus, RotateCcw, Trash2, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { CinematicButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { LoadingSkeleton, PageHeader, PageTransition, SectionHeader } from '@/components/ui/Page'
import { useAuth } from '@/features/auth/auth-context'
import { gameService } from '@/features/games/game-service'
import type { GameHistoryEntry, GameHistoryInput, GameInput, GameOutcome, GameStats, SharedGame } from '@/features/games/types'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'

type GamesSection = 'picker' | 'library' | 'history' | 'stats'
const fieldClass = 'mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4'
const emptyGame: GameInput = { name: '', category: 'Board', playerCount: '2 players', duration: '30 min', notes: '' }
const localDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const fetchGameNight = () => Promise.all([gameService.list(), gameService.history(), gameService.stats()])

interface GameFormProps {
  game?: SharedGame
  onCancel: () => void
  onSaved: (game: SharedGame) => void
}

const GameForm = ({ game, onCancel, onSaved }: GameFormProps) => {
  const [form, setForm] = useState<GameInput>(game ? { name: game.name, category: game.category, playerCount: game.playerCount, duration: game.duration, notes: game.notes } : emptyGame)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    try { onSaved(game ? await gameService.update(game.id, form) : await gameService.create(form)) } catch (caught) { setError(caught instanceof Error ? caught.message : 'The game could not be saved.') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
    <label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Game name</span><input required maxLength={150} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Category</span><input required maxLength={80} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Players</span><input maxLength={80} value={form.playerCount} onChange={(event) => setForm((current) => ({ ...current, playerCount: event.target.value }))} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Typical duration</span><input maxLength={80} value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} className={fieldClass} /></label>
    <label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Notes</span><textarea maxLength={5000} rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={`${fieldClass} py-3`} /></label>
    <p role="alert" className="min-h-6 text-sm font-semibold text-accent sm:col-span-2">{error}</p>
    <div className="flex flex-wrap gap-3 sm:col-span-2"><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving && <LoaderCircle size={16} className="animate-spin" />}{game ? 'Save game' : 'Add game'}</CinematicButton><CinematicButton type="button" variant="ghost" onClick={onCancel}>Cancel</CinematicButton></div>
  </form>
}

interface PlayFormProps {
  game: SharedGame
  entry?: GameHistoryEntry
  onCancel: () => void
  onSaved: (entry: GameHistoryEntry) => void
}

const PlayForm = ({ game, entry, onCancel, onSaved }: PlayFormProps) => {
  const auth = useAuth()
  const [playedOn, setPlayedOn] = useState(entry?.playedOn ?? localDate())
  const [outcome, setOutcome] = useState<GameOutcome>(entry?.outcome ?? 'partner_win')
  const [winnerUserId, setWinnerUserId] = useState(entry?.winnerUserId ?? auth.user?.id ?? '')
  const [rating, setRating] = useState(entry?.rating ?? 4)
  const [note, setNote] = useState(entry?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('')
    const input: GameHistoryInput = { gameId: game.id, playedOn, outcome, winnerUserId: outcome === 'partner_win' ? winnerUserId : null, rating, note }
    try { onSaved(entry ? await gameService.updateHistory(entry.id, input) : await gameService.createHistory(input)) } catch (caught) { setError(caught instanceof Error ? caught.message : 'Game night could not be saved.') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Played on</span><input type="date" required value={playedOn} onChange={(event) => setPlayedOn(event.target.value)} className={fieldClass} /></label>
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Outcome</span><select value={outcome} onChange={(event) => setOutcome(event.target.value as GameOutcome)} className={fieldClass}><option value="partner_win">Partner win</option><option value="draw">Draw</option><option value="cooperative_win">Cooperative win</option><option value="no_winner">No winner / just played</option></select></label>
    {outcome === 'partner_win' && <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Winner</span><select required value={winnerUserId} onChange={(event) => setWinnerUserId(event.target.value)} className={fieldClass}>{auth.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></label>}
    <label><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Night rating</span><select value={rating} onChange={(event) => setRating(Number(event.target.value))} className={fieldClass}>{Array.from({ length: 10 }, (_, index) => (index + 1) / 2).map((value) => <option key={value} value={value}>{value.toFixed(1)} / 5</option>)}</select></label>
    <label className="sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">A note about the night</span><textarea maxLength={5000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className={`${fieldClass} py-3`} /></label>
    <p role="alert" className="min-h-6 text-sm font-semibold text-accent sm:col-span-2">{error}</p>
    <div className="flex flex-wrap gap-3 sm:col-span-2"><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{entry ? 'Save history' : 'Save game night'}</CinematicButton><CinematicButton type="button" variant="ghost" onClick={onCancel}>Cancel</CinematicButton></div>
  </form>
}

const GamesPage = () => {
  const auth = useAuth()
  const reducedMotion = useReducedMotionPreference()
  const [section, setSection] = useState<GamesSection>('picker')
  const [games, setGames] = useState<SharedGame[]>([])
  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [stats, setStats] = useState<GameStats | null>(null)
  const [category, setCategory] = useState('All')
  const [result, setResult] = useState<SharedGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [shuffling, setShuffling] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingGame, setEditingGame] = useState<SharedGame | null>(null)
  const [gameFormOpen, setGameFormOpen] = useState(false)
  const [playingGame, setPlayingGame] = useState<SharedGame | null>(null)
  const [editingHistory, setEditingHistory] = useState<GameHistoryEntry | null>(null)

  const load = async () => {
    try {
      const [nextGames, nextHistory, nextStats] = await fetchGameNight()
      setGames(nextGames); setHistory(nextHistory); setStats(nextStats); setResult((current) => current ?? nextGames[0] ?? null); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Game Night could not be loaded.') } finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    fetchGameNight().then(([nextGames, nextHistory, nextStats]) => {
      if (!active) return
      setGames(nextGames); setHistory(nextHistory); setStats(nextStats); setResult(nextGames[0] ?? null); setLoading(false)
    }).catch((caught: unknown) => { if (active) { setError(caught instanceof Error ? caught.message : 'Game Night could not be loaded.'); setLoading(false) } })
    return () => { active = false }
  }, [])

  const categories = useMemo(() => ['All', ...new Set(games.map((game) => game.category))], [games])
  const pool = useMemo(() => category === 'All' ? games : games.filter((game) => game.category === category), [category, games])
  const shuffle = () => {
    if (shuffling || !pool.length) return
    setShuffling(true); setMessage('')
    const finish = () => { const candidate = pool[Math.floor(Math.random() * pool.length)]; if (candidate) setResult(candidate); setShuffling(false) }
    if (reducedMotion) finish(); else window.setTimeout(finish, 480)
  }
  const winnerLabel = (entry: GameHistoryEntry) => {
    if (entry.outcome === 'partner_win') return `${auth.profiles.find((profile) => profile.id === entry.winnerUserId)?.displayName ?? 'Partner'} won`
    if (entry.outcome === 'cooperative_win') return 'Won together'
    if (entry.outcome === 'draw') return 'A draw'
    return 'No winner'
  }
  const saveGame = (saved: SharedGame) => { setGames((current) => editingGame ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved].sort((a, b) => a.name.localeCompare(b.name))); setEditingGame(null); setGameFormOpen(false); setMessage(editingGame ? 'Custom game updated.' : 'Custom game added.') }
  const deleteGame = async (game: SharedGame) => {
    if (!window.confirm(`Delete ${game.name} from your custom games?`)) return
    try { await gameService.delete(game.id); setGames((current) => current.filter((item) => item.id !== game.id)); setMessage('Custom game deleted.') } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'The game could not be deleted.') }
  }
  const saveHistory = async (saved: GameHistoryEntry) => { setHistory((current) => editingHistory ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]); setPlayingGame(null); setEditingHistory(null); setStats(await gameService.stats()); setMessage(editingHistory ? 'Game history updated.' : 'Game night saved.') }
  const deleteHistory = async (entry: GameHistoryEntry) => {
    if (!window.confirm(`Delete the ${entry.gameName} game night from ${entry.playedOn}?`)) return
    try { await gameService.deleteHistory(entry.id); setHistory((current) => current.filter((item) => item.id !== entry.id)); setStats(await gameService.stats()); setMessage('Game history deleted.') } catch (caught) { setMessage(caught instanceof Error ? caught.message : 'Game history could not be deleted.') }
  }

  const tabs = [
    { id: 'picker' as const, label: 'Tonight’s picker', icon: Dices },
    { id: 'library' as const, label: `Games · ${games.length}`, icon: Gamepad2 },
    { id: 'history' as const, label: `History · ${history.length}`, icon: History },
    { id: 'stats' as const, label: 'Our stats', icon: BarChart3 },
  ]

  return <PageTransition>
    <PageHeader eyebrow="Playful, never casino" title="Game Night" intro="A shared shelf for favourites and custom games, with every win, draw, and cooperative victory remembered." />
    <section className="mx-auto max-w-[1350px] px-5 pb-14 sm:px-8 lg:px-12"><div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-line pb-4" role="tablist" aria-label="Game Night sections">{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={section === id} onClick={() => setSection(id)} className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.11em] ${section === id ? 'border-accent bg-accent text-white' : 'border-line text-muted'}`}><Icon size={15} /> {label}</button>)}</div><p role="status" aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold text-accent">{message}</p></section>

    {loading && <section className="mx-auto max-w-[1200px] px-5 pb-28"><LoadingSkeleton className="min-h-[30rem]" /></section>}
    {!loading && error && <section className="mx-auto max-w-[1200px] px-5 pb-28"><div role="alert" className="rounded-xl border border-line p-8"><p>{error}</p><CinematicButton onClick={() => void load()} variant="secondary" className="mt-5">Try again</CinematicButton></div></section>}

    {!loading && !error && section === 'picker' && <section className="mx-auto max-w-[1350px] px-5 pb-28 sm:px-8 lg:px-12"><div className="mb-12 flex flex-wrap gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-11 rounded-full border px-4 text-xs font-bold uppercase tracking-[0.12em] ${category === item ? 'border-accent bg-accent text-white' : 'border-line text-muted hover:bg-elevated'}`}>{item}</button>)}</div><div className="grid items-center gap-14 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24"><div><p className="editorial-rule">Leave it to chance</p><h2 className="balance mt-6 font-display text-[clamp(3.6rem,8vw,7.8rem)] font-medium leading-[0.82]">What are we playing tonight?</h2><p className="mt-6 max-w-lg text-lg text-muted">Pick a category, then let the shared game shelf settle it.</p><CinematicButton onClick={shuffle} disabled={shuffling || !pool.length} variant="romantic" className="mt-8"><Dices size={17} /> {shuffling ? 'Shuffling…' : 'Shuffle the stack'}</CinematicButton></div><div className="relative mx-auto min-h-[34rem] w-full max-w-2xl"><div className="paper-surface absolute inset-x-[12%] top-7 h-[28rem] rotate-6 rounded-[var(--radius-lg)] opacity-45" /><div className="paper-surface absolute inset-x-[8%] top-4 h-[29rem] -rotate-3 rounded-[var(--radius-lg)] opacity-70" />{result ? <AnimatePresence mode="wait"><motion.article key={result.id} initial={reducedMotion ? false : { opacity: 0, x: shuffling ? 30 : 0, rotate: 2 }} animate={{ opacity: 1, x: 0, rotate: -1 }} className="paper-surface relative min-h-[30rem] overflow-hidden rounded-[var(--radius-lg)] p-7 sm:p-10"><div className="absolute right-[-4rem] top-[-4rem] grid size-52 place-items-center rounded-full border border-accent-soft/40 font-display text-8xl text-accent-soft/50" aria-hidden="true">✦</div><p className="editorial-rule">{result.category}</p><h3 className="mt-10 max-w-lg font-display text-[clamp(3.8rem,9vw,7.2rem)] font-medium leading-[0.78] tracking-[-0.04em]">{result.name}</h3><p className="mt-7 max-w-lg text-lg text-muted">{result.notes || 'A place on the shelf, ready for tonight.'}</p><div className="mt-10 flex flex-wrap gap-5 border-t border-line pt-6 text-sm font-semibold text-muted"><span className="flex items-center gap-2"><Users size={17} /> {result.playerCount}</span><span>{result.duration}</span></div><div className="mt-8 flex flex-wrap gap-3"><CinematicButton onClick={() => setPlayingGame(result)} variant="romantic"><Check size={16} /> We played this</CinematicButton><CinematicButton onClick={shuffle} disabled={shuffling} variant="ghost"><RotateCcw size={16} /> Again</CinematicButton></div></motion.article></AnimatePresence> : <div className="paper-surface relative grid min-h-[30rem] place-items-center rounded-[var(--radius-lg)] p-8 text-center text-muted">No games match this category.</div>}</div></div></section>}

    {!loading && !error && section === 'library' && <section className="mx-auto max-w-[1300px] px-5 pb-28 sm:px-8 lg:px-12"><SectionHeader eyebrow="Shared shelf" title="Games for every kind of evening." description="Starter games stay intact; anything you add can be shaped by either partner." action={<CinematicButton onClick={() => { setEditingGame(null); setGameFormOpen(true) }} variant="romantic"><Plus size={16} /> Add custom game</CinematicButton>} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{games.map((game) => <article key={game.id} className="paper-surface rounded-xl p-6"><div className="flex items-start justify-between gap-4"><div><p className="editorial-rule">{game.category}</p><h3 className="mt-4 font-display text-4xl leading-none">{game.name}</h3></div>{game.builtIn ? <span className="rounded-full border border-line px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted">Starter</span> : <div className="flex gap-1"><button onClick={() => { setEditingGame(game); setGameFormOpen(true) }} aria-label={`Edit ${game.name}`} className="grid size-11 place-items-center rounded-full border border-line"><Pencil size={16} /></button><button onClick={() => void deleteGame(game)} aria-label={`Delete ${game.name}`} className="grid size-11 place-items-center rounded-full border border-line"><Trash2 size={16} /></button></div>}</div><p className="mt-5 text-muted">{game.notes}</p><p className="mt-5 text-sm font-semibold text-muted">{game.playerCount} · {game.duration}</p><CinematicButton onClick={() => setPlayingGame(game)} variant="secondary" className="mt-6 w-full">Record a game night</CinematicButton></article>)}</div></section>}

    {!loading && !error && section === 'history' && <section className="mx-auto max-w-[1100px] px-5 pb-28 sm:px-8 lg:px-12"><SectionHeader eyebrow="Scorebook" title="Every game night, without the casino." description="Wins use the real profile names; cooperative nights and no-winner games count too." />{history.length ? <div className="space-y-4">{history.map((entry) => <article key={entry.id} className="paper-surface grid gap-5 rounded-xl p-6 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-bold uppercase tracking-[0.13em] text-accent">{entry.playedOn} · {entry.gameCategory}</p><h3 className="mt-2 font-display text-4xl leading-none">{entry.gameName}</h3><p className="mt-3 font-semibold">{winnerLabel(entry)} · {entry.rating.toFixed(1)} ★</p>{entry.note && <p className="mt-3 text-muted">{entry.note}</p>}</div><div className="flex gap-2"><button onClick={() => { setEditingHistory(entry); setPlayingGame(games.find((game) => game.id === entry.gameId) ?? null) }} aria-label={`Edit ${entry.gameName} history`} className="grid size-11 place-items-center rounded-full border border-line"><Pencil size={16} /></button><button onClick={() => void deleteHistory(entry)} aria-label={`Delete ${entry.gameName} history`} className="grid size-11 place-items-center rounded-full border border-line"><Trash2 size={16} /></button></div></article>)}</div> : <p className="rounded-xl border border-line p-8 text-muted">No game nights recorded yet. Choose a game and save the first one.</p>}</section>}

    {!loading && !error && section === 'stats' && <section className="mx-auto max-w-[1100px] px-5 pb-28 sm:px-8 lg:px-12"><SectionHeader eyebrow="Real scorebook" title="The shape of our game nights." description="Every number comes directly from the shared history." />{stats && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[String(stats.gamesPlayed), 'Games played'], [stats.averageRating?.toFixed(1) ?? '—', 'Average night'], [String(stats.draws), 'Draws'], [String(stats.cooperativeWins), 'Won together']].map(([value, label]) => <div key={label} className="paper-surface rounded-xl p-6"><p className="font-display text-6xl text-accent">{value}</p><p className="mt-2 text-sm uppercase tracking-[0.12em] text-muted">{label}</p></div>)}<div className="paper-surface rounded-xl p-6 sm:col-span-2"><h3 className="font-display text-3xl">Partner wins</h3><div className="mt-4 space-y-2">{auth.profiles.map((profile) => <p key={profile.id} className="flex justify-between"><span>{profile.displayName}</span><span className="font-semibold text-accent">{stats.partnerWins.find((item) => item.userId === profile.id)?.wins ?? 0}</span></p>)}</div></div><div className="paper-surface rounded-xl p-6 sm:col-span-2"><h3 className="font-display text-3xl">Most played</h3><p className="mt-4 text-muted">{stats.mostPlayed ? `${stats.mostPlayed.name} · ${stats.mostPlayed.playCount} nights` : 'No favourite has emerged yet.'}</p></div></div>}</section>}

    <Modal open={gameFormOpen} onClose={() => { setGameFormOpen(false); setEditingGame(null) }} title={editingGame ? `Edit ${editingGame.name}` : 'Add a custom game'} panelClassName="max-w-2xl">{gameFormOpen && <GameForm game={editingGame ?? undefined} onCancel={() => { setGameFormOpen(false); setEditingGame(null) }} onSaved={saveGame} />}</Modal>
    <Modal open={Boolean(playingGame)} onClose={() => { setPlayingGame(null); setEditingHistory(null) }} title={editingHistory ? `Edit ${editingHistory.gameName}` : `We played ${playingGame?.name ?? ''}`} panelClassName="max-w-2xl">{playingGame && <PlayForm game={playingGame} entry={editingHistory ?? undefined} onCancel={() => { setPlayingGame(null); setEditingHistory(null) }} onSaved={(entry) => void saveHistory(entry)} />}</Modal>
  </PageTransition>
}

export default GamesPage
