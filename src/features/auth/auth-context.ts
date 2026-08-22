import { createContext, useContext } from 'react'
import type { ApiProfile, ApiRelationship, ApiUser } from '@/lib/api'

export interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  user: ApiUser | null
  relationship: ApiRelationship | null
  profiles: ApiProfile[]
  error: string
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
