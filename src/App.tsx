import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingSkeleton } from '@/components/ui/Page'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

const HomePage = lazy(() => import('@/pages/HomePage'))
const StoryPage = lazy(() => import('@/pages/StoryPage'))
const MemoriesPage = lazy(() => import('@/pages/MemoriesPage'))
const MoviesPage = lazy(() => import('@/pages/MoviesPage'))
const GamesPage = lazy(() => import('@/pages/GamesPage'))
const SoundtrackPage = lazy(() => import('@/pages/SoundtrackPage'))
const ActivitiesPage = lazy(() => import('@/pages/ActivitiesPage'))
const LettersPage = lazy(() => import('@/pages/LettersPage'))
const BucketListPage = lazy(() => import('@/pages/BucketListPage'))
const RecapPage = lazy(() => import('@/pages/RecapPage'))
const RecapYearPage = lazy(() => import('@/pages/RecapYearPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))

const App = () => {
  const location = useLocation()
  if (location.pathname === '/login') {
    return <Suspense fallback={<LoadingSkeleton className="min-h-dvh" />}><LoginPage /></Suspense>
  }
  return (
    <ProtectedRoute>
      <AppShell>
        <Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-24"><LoadingSkeleton className="min-h-[55dvh]" /></div>}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/story" element={<StoryPage />} />
            <Route path="/memories" element={<MemoriesPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route path="/soundtrack" element={<SoundtrackPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/letters" element={<LettersPage />} />
            <Route path="/bucket-list" element={<BucketListPage />} />
            <Route path="/recap" element={<RecapPage />} />
            <Route path="/recap/year/:yearNumber" element={<RecapYearPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppShell>
    </ProtectedRoute>
  )
}

export default App
