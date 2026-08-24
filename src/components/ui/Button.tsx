import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link, type LinkProps } from 'react-router-dom'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'
import { motionSpring } from '@/lib/motion'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'romantic' | 'danger'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-cinematic text-[#fff8ee] hover:bg-[#332925] border-cinematic',
  secondary: 'bg-transparent text-foreground border-line hover:bg-elevated',
  ghost: 'bg-transparent text-foreground border-transparent hover:bg-surface',
  romantic: 'bg-accent text-[#fff8ee] border-accent hover:bg-[#561925]',
  danger: 'bg-[#8a2f2f] text-white border-[#8a2f2f] hover:bg-[#702323]',
}

const baseClasses = 'cinematic-action inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-5 py-3 text-[0.76rem] font-bold uppercase tracking-[0.15em] transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45'

export type CinematicButtonProps = {
  variant?: ButtonVariant
} & Omit<ComponentPropsWithoutRef<typeof motion.button>, 'ref'>

export const CinematicButton = forwardRef<HTMLButtonElement, CinematicButtonProps>(
  ({ variant = 'primary', className = '', disabled, children, ...props }, ref) => {
    const reducedMotion = useReducedMotionPreference()
    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={disabled || reducedMotion ? undefined : { y: -1, scale: 1.008 }}
        whileTap={disabled || reducedMotion ? undefined : { scale: 0.975 }}
        transition={motionSpring.tactile}
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    )
  },
)

CinematicButton.displayName = 'CinematicButton'

interface CinematicLinkProps extends LinkProps {
  children: ReactNode
  variant?: ButtonVariant
  className?: string
}

export const CinematicLink = ({ children, variant = 'primary', className = '', ...props }: CinematicLinkProps) => (
  <Link className={`${baseClasses} ${variantClasses[variant]} ${className}`} {...props}>
    {children}
  </Link>
)
