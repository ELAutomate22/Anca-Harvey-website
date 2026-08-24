import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarHeart,
  Gamepad2,
  Heart,
  Home,
  Images,
  ListChecks,
  Mail,
  Menu,
  MoreHorizontal,
  Music2,
  Settings,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { relationshipConfig } from '@/config/relationship'
import { useAuth } from '@/features/auth/auth-context'
import { Modal } from '@/components/ui/Modal'
import { CinematicAtmosphere } from '@/components/effects/CinematicAtmosphere'

const desktopPrimary = [
  ['/', 'Home'], ['/story', 'Our Story'], ['/memories', 'Memories'], ['/movies', 'Movie Night'],
  ['/games', 'Game Night'], ['/soundtrack', 'Our Soundtrack'], ['/activities', 'Date Ideas'],
] as const

const secondary = [
  { to: '/games', label: 'Game Night', icon: Gamepad2 },
  { to: '/soundtrack', label: 'Our Soundtrack', icon: Music2 },
  { to: '/activities', label: 'Date Ideas', icon: CalendarHeart },
  { to: '/letters', label: 'Letters', icon: Mail },
  { to: '/bucket-list', label: 'Bucket List', icon: ListChecks },
  { to: '/recap', label: 'Our Year', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

const mobilePrimary = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/story', label: 'Story', icon: Heart },
  { to: '/memories', label: 'Memories', icon: Images },
  { to: '/movies', label: 'Movies', icon: Ticket },
] as const

const NavItem = ({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) => (
  <NavLink
    to={to}
    end={to === '/'}
    onClick={onClick}
    className={({ isActive }) => `relative flex min-h-11 items-center whitespace-nowrap px-1 text-[0.66rem] font-bold uppercase tracking-[0.12em] transition-colors ${isActive ? 'text-accent' : 'text-muted hover:text-foreground'}`}
  >
    {({ isActive }) => (
      <>
        {label}
        {isActive && <motion.span layoutId="desktop-nav-indicator" className="absolute inset-x-0 -bottom-px h-px bg-accent" />}
      </>
    )}
  </NavLink>
)

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const auth = useAuth()
  const archiveTitle = auth.relationship?.title ?? relationshipConfig.title

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    if (previousPath.current !== location.pathname) {
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
    previousPath.current = location.pathname
  }, [location.pathname])

  const closeMore = useCallback(() => setMoreOpen(false), [])

  return (
    <div className="min-h-dvh">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <CinematicAtmosphere />

      <header className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-300 ${scrolled ? 'border-line/70 bg-background/92 shadow-[0_8px_30px_rgb(42_28_22/0.06)] backdrop-blur-xl' : 'border-transparent bg-background/72 backdrop-blur-md'}`}>
        <div className="mx-auto flex h-[var(--nav-height)] max-w-[1580px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <NavLink to="/" end className="flex items-center gap-3" aria-label={`${archiveTitle} home`}>
            <span className="grid size-9 place-items-center rounded-full border border-accent text-accent"><Heart size={15} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{archiveTitle}</span>
          </NavLink>

          <nav aria-label="Primary navigation" className="hidden min-[1200px]:flex min-[1200px]:items-center min-[1200px]:gap-5 min-[1440px]:gap-7">
            {desktopPrimary.map(([to, label]) => <NavItem key={to} to={to} label={label} />)}
            <button onClick={() => setMoreOpen(true)} aria-label="Open additional navigation" className="flex min-h-11 items-center gap-2 text-[0.66rem] font-bold uppercase tracking-[0.12em] text-muted transition-colors hover:text-foreground">
              <Menu size={16} aria-hidden="true" /> More
            </button>
          </nav>

          <button onClick={() => setMoreOpen(true)} aria-label="Open menu" className="grid size-12 place-items-center rounded-full border border-line min-[1200px]:hidden">
            <Menu size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 pt-[var(--nav-height)] pb-[calc(6.5rem+env(safe-area-inset-bottom))] outline-none min-[1200px]:pb-0">
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-line px-5 py-12 text-center min-[1200px]:block">
        <p className="font-display text-2xl italic text-muted">A place for everything we keep becoming.</p>
        <p className="mt-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted">Private by design · Our living archive</p>
      </footer>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-elevated/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_35px_rgb(45_31_24/0.08)] backdrop-blur-xl min-[1200px]:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {mobilePrimary.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `relative flex min-h-[4.65rem] flex-col items-center justify-center gap-1 text-[0.61rem] font-bold tracking-[0.04em] ${isActive ? 'text-accent' : 'text-muted'}`}>
              {({ isActive }) => <><Icon size={20} strokeWidth={isActive ? 2 : 1.6} aria-hidden="true" /><span>{label}</span>{isActive && <motion.span layoutId="mobile-nav-indicator" className="absolute top-0 h-0.5 w-8 bg-accent" />}</>}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} className="relative flex min-h-[4.65rem] flex-col items-center justify-center gap-1 text-[0.61rem] font-bold tracking-[0.04em] text-muted" aria-label="Open more sections">
            <MoreHorizontal size={21} aria-hidden="true" /><span>More</span>
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={closeMore} title="More of our world" panelClassName="sm:max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4 border-y border-line py-4 text-sm">
          <span><strong className="block">{auth.user?.displayName}</strong><span className="text-muted">Signed in privately</span></span>
          <button type="button" onClick={() => { closeMore(); void auth.logout() }} className="min-h-11 rounded-md border border-line px-4 text-xs font-bold uppercase tracking-[0.12em] transition-colors hover:bg-surface">Sign out</button>
        </div>
        <nav aria-label="Additional navigation" className="grid gap-2 sm:grid-cols-2">
          {secondary.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={closeMore} className={({ isActive }) => `flex min-h-16 items-center gap-4 rounded-lg border px-4 transition-colors ${isActive ? 'border-accent bg-accent/5 text-accent' : 'border-line hover:bg-surface'}`}>
              <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
              <span className="font-semibold">{label}</span>
            </NavLink>
          ))}
        </nav>
      </Modal>
    </div>
  )
}
