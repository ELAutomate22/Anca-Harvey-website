import { useState, type FormEvent } from 'react'
import { Heart, LockKeyhole } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { relationshipConfig } from '@/config/relationship'
import { useAuth } from '@/features/auth/auth-context'
import { ApiClientError } from '@/lib/api'
import { CinematicButton } from '@/components/ui/Button'

interface LoginLocationState {
  from?: string
}

const LoginPage = () => {
  const auth = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const state = location.state as LoginLocationState | null

  if (auth.status === 'authenticated') return <Navigate to={state?.from ?? '/'} replace />

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      await auth.login(email, password)
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? caught.message : 'Sign in is temporarily unavailable.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-cinematic px-5 py-10 text-[#f8efe2] sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:p-0">
      <div className="absolute inset-0 opacity-25"><img src="/assets/images/blue-hour-beach.webp" alt="" className="h-full w-full object-cover grayscale" /></div>
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(22,17,15,.98)_8%,rgba(22,17,15,.78)_55%,rgba(22,17,15,.5))]" />
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 flex max-w-4xl flex-col justify-between py-6 lg:min-h-dvh lg:p-16 xl:p-24">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full border border-[#d7b77e]"><Heart size={16} /></span><span className="font-display text-2xl">{relationshipConfig.title}</span></div>
        <div className="my-16 lg:my-10">
          <p className="editorial-rule !text-[#d7b77e]">Private by design</p>
          <h1 className="balance mt-7 max-w-3xl font-display text-[clamp(4rem,9vw,9rem)] font-medium leading-[0.78] tracking-[-0.05em]">Come back to <span className="italic text-[#d7b77e]">our corner.</span></h1>
          <p className="mt-8 max-w-lg text-lg text-[#d8cec2]">A quiet place for two people, the life between the milestones, and everything still ahead.</p>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a99d91]">No public registration · Two private accounts</p>
      </motion.section>

      <div className="relative z-10 flex items-center justify-center lg:min-h-dvh lg:bg-[#f3eee4]/96 lg:px-10">
        <motion.section initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }} className="paper-surface w-full max-w-lg rounded-[var(--radius-lg)] p-6 text-foreground sm:p-10 lg:p-12">
          <LockKeyhole className="text-accent" size={24} />
          <h2 className="mt-6 font-display text-5xl font-medium">Welcome home.</h2>
          <p className="mt-4 text-muted">Use one of the two private partner accounts to enter.</p>
          <form onSubmit={submit} className="mt-9 space-y-5">
            <label className="block"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-line bg-elevated px-4 outline-none transition-colors focus:border-accent" /></label>
            <label className="block"><span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-md border border-line bg-elevated px-4 outline-none transition-colors focus:border-accent" /></label>
            <p role="alert" className="min-h-6 text-sm font-semibold text-accent">{message || auth.error}</p>
            <CinematicButton type="submit" variant="romantic" disabled={submitting} className="w-full">{submitting ? 'Opening…' : 'Enter our corner'}</CinematicButton>
          </form>
        </motion.section>
      </div>
    </main>
  )
}

export default LoginPage
