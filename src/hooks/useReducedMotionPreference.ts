import { useReducedMotion } from 'framer-motion'

export const useReducedMotionPreference = (): boolean => Boolean(useReducedMotion())
