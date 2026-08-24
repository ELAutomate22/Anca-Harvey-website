import { useEffect, useState } from 'react'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'

export type EffectTier = 'low' | 'medium' | 'high'

const measureTier = (): EffectTier => {
  if (typeof window === 'undefined') return 'medium'
  const compact = window.matchMedia('(max-width: 767px)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = 'deviceMemory' in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) : 4
  if (compact || coarse || cores <= 4 || memory <= 4) return 'low'
  if (cores >= 8 && memory >= 8 && window.devicePixelRatio <= 2) return 'high'
  return 'medium'
}

export const useEffectTier = (): EffectTier => {
  const reducedMotion = useReducedMotionPreference()
  const [tier, setTier] = useState<EffectTier>(measureTier)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setTier(measureTier())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion ? 'low' : tier
}
