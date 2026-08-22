import { ArrowLeft } from 'lucide-react'
import { CinematicLink } from '@/components/ui/Button'
import { PageTransition } from '@/components/ui/Page'

const NotFoundPage = () => (
  <PageTransition className="grid min-h-[70dvh] place-items-center px-5 py-20 text-center">
    <div><p className="editorial-rule mx-auto w-fit">A page went wandering</p><h1 className="mt-7 font-display text-[clamp(5rem,16vw,12rem)] font-medium leading-[0.7]">404</h1><p className="mx-auto mt-8 max-w-md text-lg text-muted">This room is not part of the archive. The way home is still close.</p><CinematicLink to="/" variant="romantic" className="mt-8"><ArrowLeft size={16} /> Back home</CinematicLink></div>
  </PageTransition>
)

export default NotFoundPage
