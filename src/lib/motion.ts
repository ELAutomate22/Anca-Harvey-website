import type { Variants } from 'framer-motion'

export const motionDuration = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  reveal: 0.48,
  cinematic: 0.68,
} as const

export const motionEase = {
  premium: [0.22, 1, 0.36, 1],
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const

export const motionSpring = {
  gentle: { type: 'spring', stiffness: 170, damping: 24, mass: 0.8 },
  tactile: { type: 'spring', stiffness: 360, damping: 28, mass: 0.55 },
} as const

export const premiumEase = motionEase.premium

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: motionDuration.base, ease: premiumEase } },
  exit: { opacity: 0, y: -6, transition: { duration: motionDuration.fast, ease: motionEase.exit } },
}

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: motionDuration.reveal, ease: premiumEase } },
}

export const imageRevealVariants: Variants = {
  hidden: { opacity: 0, scale: 1.025 },
  visible: { opacity: 1, scale: 1, transition: { duration: motionDuration.cinematic, ease: premiumEase } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
}

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: motionDuration.reveal, ease: premiumEase } },
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: motionDuration.base, ease: premiumEase } },
  exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: motionDuration.fast, ease: motionEase.exit } },
}
