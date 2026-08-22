import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { pageVariants, revealVariants } from '@/lib/motion'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export const PageTransition = ({ children, className = '' }: PageTransitionProps) => {
  const reducedMotion = useReducedMotionPreference()
  return (
    <motion.div
      variants={pageVariants}
      initial={reducedMotion ? false : 'hidden'}
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  )
}

interface PageHeaderProps {
  eyebrow: string
  title: string
  intro: string
  aside?: ReactNode
  dark?: boolean
}

export const PageHeader = ({ eyebrow, title, intro, aside, dark = false }: PageHeaderProps) => (
  <header className={`mx-auto grid w-full max-w-[1500px] gap-8 px-5 pb-16 pt-16 sm:px-8 md:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:items-end lg:px-12 lg:pb-24 ${dark ? 'text-[#f8efe2]' : ''}`}>
    <div>
      <p className={`editorial-rule ${dark ? '!text-[#d7b77e]' : ''}`}>{eyebrow}</p>
      <h1 className="balance mt-6 max-w-4xl font-display text-[clamp(3.5rem,9vw,8.8rem)] font-medium leading-[0.82] tracking-[-0.045em]">
        {title}
      </h1>
    </div>
    <div className="lg:pb-2">
      <p className={`max-w-xl text-[1.02rem] leading-7 sm:text-lg ${dark ? 'text-[#d8cec2]' : 'text-muted'}`}>{intro}</p>
      {aside}
    </div>
  </header>
)

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
  light?: boolean
}

export const SectionHeader = ({ eyebrow, title, description, action, light = false }: SectionHeaderProps) => (
  <div className="mb-9 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
    <div className="max-w-3xl">
      {eyebrow && <p className={`editorial-rule ${light ? '!text-[#d7b77e]' : ''}`}>{eyebrow}</p>}
      <h2 className="balance mt-4 font-display text-[clamp(2.6rem,6vw,5.25rem)] font-medium leading-[0.92] tracking-[-0.035em]">{title}</h2>
      {description && <p className={`mt-5 max-w-2xl text-base sm:text-lg ${light ? 'text-[#d8cec2]' : 'text-muted'}`}>{description}</p>}
    </div>
    {action}
  </div>
)

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
}

export const Reveal = ({ children, className = '', delay = 0 }: RevealProps) => {
  const reducedMotion = useReducedMotionPreference()
  return (
    <motion.div
      variants={revealVariants}
      initial={reducedMotion ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.16 }}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export const LoadingSkeleton = ({ className = '' }: { className?: string }) => (
  <div aria-label="Loading" role="status" className={`skeleton relative min-h-40 overflow-hidden rounded-xl bg-surface ${className}`}>
    <span className="sr-only">Loading</span>
  </div>
)
