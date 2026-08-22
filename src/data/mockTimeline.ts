import type { TimelineEntry } from '@/types/content'

export const mockTimeline: TimelineEntry[] = [
  { id: 'beginning', title: 'The Beginning', eyebrow: 'Chapter I', date: '2025-08-20', description: 'A first date that lasted longer than either of us planned, followed by the easiest walk home.', image: '/assets/images/lakeside.webp', status: 'past' },
  { id: 'six-months', title: 'Six Months', eyebrow: 'Chapter II', date: '2026-02-20', description: 'By then, our ordinary days had already become the part worth remembering.', image: '/assets/images/cafe-hands.webp', status: 'past' },
  { id: 'one-year', title: 'One Year', eyebrow: 'Chapter III', date: '2026-08-20', description: '365 days of shared routes, late calls, accidental traditions, and choosing each other again.', image: '/assets/images/blue-hour-beach.webp', status: 'current' },
  { id: 'eighteen-months', title: 'One Year + Six Months', eyebrow: 'The next page', date: '2027-02-20', description: 'Unwritten, waiting, and already ours to arrive at.', status: 'upcoming' },
]
