import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiClientError, apiRequest, type AuthSnapshot } from '@/lib/api'
import { AuthContext, type AuthContextValue } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [snapshot, setSnapshot] = useState<AuthSnapshot | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const next = await apiRequest<AuthSnapshot>('/api/auth/me')
      setSnapshot(next)
      setStatus('authenticated')
      setError('')
    } catch (caught) {
      setSnapshot(null)
      setStatus('unauthenticated')
      if (caught instanceof ApiClientError && caught.status === 401) {
        setError('')
      } else {
        setError(caught instanceof Error ? caught.message : 'The private archive is temporarily unavailable.')
      }
    }
  }, [])

  useEffect(() => {
    // This begins an external request; state updates occur only after the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    await apiRequest<{ authenticated: true }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    await refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ authenticated: false }>('/api/auth/logout', { method: 'POST' })
    } finally {
      setSnapshot(null)
      setStatus('unauthenticated')
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user: snapshot?.user ?? null,
    relationship: snapshot?.relationship ?? null,
    profiles: snapshot?.profiles ?? [],
    error,
    login,
    logout,
    refresh,
  }), [error, login, logout, refresh, snapshot, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
