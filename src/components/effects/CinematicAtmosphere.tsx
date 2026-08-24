import { useLocation } from 'react-router-dom'

const emotionalRoutes = new Set(['/', '/story', '/memories', '/letters', '/recap'])

export const CinematicAtmosphere = () => {
  const location = useLocation()
  return (
    <div
      aria-hidden="true"
      className={`cinematic-atmosphere ${emotionalRoutes.has(location.pathname) ? 'cinematic-atmosphere--warm' : ''}`}
    />
  )
}
