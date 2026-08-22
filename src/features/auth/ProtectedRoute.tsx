import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoadingSkeleton } from '@/components/ui/Page'
import { useAuth } from './auth-context'

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading') {
    return <main className="grid min-h-dvh place-items-center bg-background px-5"><LoadingSkeleton className="min-h-72 w-full max-w-xl" /></main>
  }
  if (auth.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
