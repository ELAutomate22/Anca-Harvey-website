import type { Memory } from '@/types/content'

export const mockMemories: Memory[] = [
  {
    id: 'lake-gold', title: 'The long way home', caption: 'We missed the turning and kept walking anyway.', date: '2025-09-07',
    category: 'Dates', mediaType: 'photo', favorite: true, image: '/assets/images/lakeside.webp',
    alt: 'A fictional couple embracing beside a lake at golden hour', aspect: 'landscape',
  },
  {
    id: 'rain-cafe', title: 'Rain at four', caption: 'Two coffees, one camera, nowhere else to be.', date: '2025-11-16',
    category: 'Dates', mediaType: 'photo', favorite: true, image: '/assets/images/cafe-hands.webp',
    alt: 'Two people holding hands across a cafe table on a rainy day', aspect: 'portrait',
  },
  {
    id: 'blue-hour', title: 'Last ones on the beach', caption: 'Cold feet. Good idea.', date: '2026-02-14',
    category: 'Trips', mediaType: 'video', favorite: false, image: '/assets/images/blue-hour-beach.webp',
    alt: 'A fictional couple running together on a quiet beach at dusk', aspect: 'landscape',
  },
  {
    id: 'first-six', title: 'Six months, quietly', caption: 'No grand plan. Just dinner and the feeling that this mattered.', date: '2026-02-28',
    category: 'Milestones', mediaType: 'photo', favorite: true, image: '/assets/images/cafe-hands.webp',
    alt: 'Hands touching beside coffee cups and a film camera', aspect: 'square',
  },
  {
    id: 'wrong-train', title: 'The wrong train', caption: 'Correct company, incorrect platform.', date: '2026-04-05',
    category: 'Funny', mediaType: 'photo', favorite: false, image: '/assets/images/lakeside.webp',
    alt: 'A couple standing close beside calm water', aspect: 'portrait',
  },
  {
    id: 'coast-again', title: 'Back to the sea', caption: 'The wind took every sensible photograph.', date: '2026-06-28',
    category: 'Trips', mediaType: 'video', favorite: true, image: '/assets/images/blue-hour-beach.webp',
    alt: 'A couple running barefoot along a blue-hour shoreline', aspect: 'portrait',
  },
]
