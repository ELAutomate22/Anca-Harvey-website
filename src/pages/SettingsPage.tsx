import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Download, HardDriveDownload, LoaderCircle, LockKeyhole, ShieldCheck, Users } from 'lucide-react'
import { relationshipConfig } from '@/config/relationship'
import { useAuth } from '@/features/auth/auth-context'
import { apiRequest, type ApiRelationship, type ApiUser } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { CinematicButton } from '@/components/ui/Button'
import { PageHeader, PageTransition } from '@/components/ui/Page'

const tabs = ['Account', 'Relationship', 'Appearance', 'Data & Backup'] as const
type Tab = (typeof tabs)[number]

const SettingsPage = () => {
  const auth = useAuth()
  const [tab, setTab] = useState<Tab>('Account')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState(auth.user?.displayName ?? '')
  const [relationshipForm, setRelationshipForm] = useState({
    title: auth.relationship?.title ?? relationshipConfig.title,
    startDate: auth.relationship?.startDate ?? relationshipConfig.startDate,
    timezone: auth.relationship?.timezone ?? relationshipConfig.timezone,
  })

  const partnerNames = useMemo(() => {
    const relationship = auth.relationship
    const first = auth.profiles.find((profile) => profile.id === relationship?.partner1UserId)?.displayName ?? relationshipConfig.partner1Name
    const second = auth.profiles.find((profile) => profile.id === relationship?.partner2UserId)?.displayName ?? relationshipConfig.partner2Name
    return `${first} & ${second}`
  }, [auth.profiles, auth.relationship])

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await apiRequest<ApiUser>('/api/profiles/me', { method: 'PATCH', body: JSON.stringify({ displayName }) })
      await auth.refresh()
      setMessage('Your profile name has been saved.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Your profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const saveRelationship = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const dateChanged = relationshipForm.startDate !== auth.relationship?.startDate
    if (dateChanged && !window.confirm('Change the relationship start date? This recalculates every counter and automatic milestone.')) return
    setSaving(true)
    setMessage('')
    try {
      await apiRequest<ApiRelationship>('/api/relationship', {
        method: 'PATCH',
        body: JSON.stringify({ ...relationshipForm, confirmStartDateChange: dateChanged }),
      })
      await auth.refresh()
      setMessage('Relationship details have been saved.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Relationship details could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const demoExport = (kind: string) => setMessage(`${kind} remains scheduled for a later phase. No file was created, and static website assets will never be included.`)

  return (
    <PageTransition>
      <PageHeader eyebrow="Private by design" title="Settings" intro="Manage the two private profiles and the single relationship record that powers names, counters, and milestones across the archive." />
      <section className="mx-auto grid max-w-[1350px] gap-8 px-5 pb-28 sm:px-8 lg:grid-cols-[17rem_1fr] lg:px-12">
        <nav aria-label="Settings sections" className="h-fit border-y border-line py-3 lg:sticky lg:top-28">{tabs.map((item) => <button key={item} onClick={() => { setTab(item); setMessage('') }} aria-current={tab === item ? 'page' : undefined} className={`flex min-h-12 w-full items-center justify-between px-3 text-left text-sm font-bold transition-colors ${tab === item ? 'text-accent' : 'text-muted hover:text-foreground'}`}><span>{item}</span>{tab === item && <span className="h-px w-8 bg-accent" />}</button>)}</nav>

        <div className="paper-surface min-h-[38rem] rounded-[var(--radius-lg)] p-6 sm:p-10 lg:p-12">
          {tab === 'Account' && <div><p className="editorial-rule">Account</p><h2 className="mt-5 font-display text-5xl font-medium">Two people. One private place.</h2><p className="mt-6 max-w-2xl text-muted">You are signed in through a server-side session. There is no public registration, password reset, or invitation endpoint.</p><div className="mt-10 grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-line p-6"><Users className="text-accent" size={22} /><h3 className="mt-5 font-display text-3xl">Couple access</h3><p className="mt-3 text-sm text-muted">Exactly two provisioned accounts belong to this relationship.</p></div><div className="rounded-lg border border-line p-6"><LockKeyhole className="text-accent" size={22} /><h3 className="mt-5 font-display text-3xl">Private session</h3><p className="mt-3 text-sm text-muted">Signing out invalidates the current session on the server.</p></div></div><form onSubmit={saveProfile} className="mt-8 max-w-xl space-y-5 rounded-lg border border-line p-6"><h3 className="font-display text-3xl">Your profile</h3><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Display name</span><input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Email</span><input readOnly value={auth.user?.email ?? ''} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4 text-muted" /></label><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving && <LoaderCircle size={16} className="animate-spin" />} Save profile</CinematicButton></form></div>}

          {tab === 'Relationship' && <div><p className="editorial-rule">Relationship</p><h2 className="mt-5 font-display text-5xl font-medium">The details everything grows from.</h2><div className="mt-10 divide-y divide-line rounded-lg border border-line">{[[Users, 'Partners', partnerNames], [CalendarDays, 'Together since', formatDate(auth.relationship?.startDate ?? relationshipConfig.startDate)], [ShieldCheck, 'Archive title', auth.relationship?.title ?? relationshipConfig.title]].map(([Icon, label, value]) => { const IconComponent = Icon as typeof Users; return <div key={String(label)} className="grid gap-2 p-5 sm:grid-cols-[3rem_10rem_1fr] sm:items-center"><IconComponent size={19} className="text-accent" /><span className="text-sm font-bold">{String(label)}</span><span className="text-muted">{String(value)}</span></div> })}</div><form onSubmit={saveRelationship} className="mt-8 grid gap-5 rounded-lg border border-line p-6 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Archive title</span><input required maxLength={100} value={relationshipForm.title} onChange={(event) => setRelationshipForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /></label><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Together since</span><input type="date" required value={relationshipForm.startDate} onChange={(event) => setRelationshipForm((current) => ({ ...current, startDate: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /><span className="mt-2 block text-xs text-muted">Changing this requires a separate confirmation.</span></label><label className="block"><span className="text-xs font-bold uppercase tracking-[0.13em] text-muted">Timezone</span><input required maxLength={80} value={relationshipForm.timezone} onChange={(event) => setRelationshipForm((current) => ({ ...current, timezone: event.target.value }))} className="mt-2 min-h-12 w-full rounded-md border border-line bg-surface px-4" /><span className="mt-2 block text-xs text-muted">Use an IANA timezone such as Europe/London.</span></label><div className="sm:col-span-2"><CinematicButton type="submit" variant="romantic" disabled={saving}>{saving && <LoaderCircle size={16} className="animate-spin" />} Save relationship</CinematicButton></div></form></div>}

          {tab === 'Appearance' && <div><p className="editorial-rule">Appearance</p><h2 className="mt-5 font-display text-5xl font-medium">The same world, in a different light.</h2><p className="mt-6 max-w-2xl text-muted">The warm editorial theme remains the active design system. Theme persistence is outside this backend phase.</p><div className="mt-10 grid gap-4 sm:grid-cols-3">{[['Warm Ivory', '#f3eee4', true], ['After Dark', '#211b19', false], ['Dusty Rose', '#d6aaa8', false]].map(([name, color, active]) => <button key={String(name)} onClick={() => setMessage(active ? 'Warm Ivory is already active.' : `${name} is a visual preview; theme switching arrives later.`)} className={`rounded-lg border p-4 text-left ${active ? 'border-accent' : 'border-line'}`}><span className="block aspect-[4/3] rounded-md" style={{ background: String(color) }} /><span className="mt-4 flex items-center justify-between font-semibold">{String(name)} {active && <Check size={16} className="text-accent" />}</span></button>)}</div></div>}

          {tab === 'Data & Backup' && <div><p className="editorial-rule">Data & Backup</p><h2 className="mt-5 font-display text-5xl font-medium">Your history should stay yours.</h2><p className="mt-6 max-w-2xl text-muted">Backups remain intentionally deferred. Future exports will include relationship data and eligible user-uploaded media, never developer-provided static site assets.</p><div className="mt-10 grid gap-5 sm:grid-cols-2"><div className="rounded-lg border border-line p-6"><HardDriveDownload size={23} className="text-accent" /><h3 className="mt-5 font-display text-3xl">Download Full Backup</h3><p className="mt-3 text-sm text-muted">Data plus eligible user-uploaded photos and videos.</p><CinematicButton onClick={() => demoExport('Full backup')} variant="secondary" className="mt-6 w-full"><Download size={16} /> Later phase</CinematicButton></div><div className="rounded-lg border border-line p-6"><Download size={23} className="text-accent" /><h3 className="mt-5 font-display text-3xl">Export Data Only</h3><p className="mt-3 text-sm text-muted">Portable structured data without uploaded media.</p><CinematicButton onClick={() => demoExport('Data export')} variant="secondary" className="mt-6 w-full"><Download size={16} /> Later phase</CinematicButton></div></div><div className="mt-6 flex items-center justify-between border-y border-line py-5 text-sm"><span className="font-bold">Last backup</span><span className="text-muted">No backups yet</span></div></div>}

          <p role="status" aria-live="polite" className="mt-7 min-h-6 text-sm font-semibold text-accent">{message}</p>
        </div>
      </section>
    </PageTransition>
  )
}

export default SettingsPage
