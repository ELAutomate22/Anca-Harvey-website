import type { Variants } from 'framer-motion'

export const premiumEase = [0.22, 1, 0.36, 1] as const

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: premiumEase } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: 'easeIn' } },
}

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.48, ease: premiumEase } },
}

export const imageRevealVariants: Variants = {
  hidden: { opacity: 0, scale: 1.025 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.58, ease: premiumEase } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
}

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: premiumEase } },
}

export const modalVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: premiumEase } },
  exit: { opacity: 0, y: 8, scale: 0.99, transition: { duration: 0.17, ease: 'easeIn' } },
}
