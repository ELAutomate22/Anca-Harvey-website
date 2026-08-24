import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'
import { motionDuration, premiumEase } from '@/lib/motion'

interface PhotoRevealProps {
  children: ReactNode
  className?: string
  delay?: number
  amount?: number
}

export const PhotoReveal = ({ children, className = '', delay = 0, amount = 0.2 }: PhotoRevealProps) => {
  const reducedMotion = useReducedMotionPreference()
  return (
    <motion.div
      initial={reducedMotion ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: { opacity: 0, scale: 1.018 },
        visible: { opacity: 1, scale: 1, transition: { duration: motionDuration.cinematic, delay, ease: premiumEase } },
      }}
      className={`photo-develop ${className}`}
    >
      {children}
      {!reducedMotion && (
        <motion.span
          aria-hidden="true"
          className="photo-develop__veil"
          initial={{ x: '0%' }}
          whileInView={{ x: '102%' }}
          viewport={{ once: true, amount }}
          transition={{ duration: motionDuration.cinematic, delay, ease: premiumEase }}
        />
      )}
    </motion.div>
  )
}
