import type { BucketItem } from '@/types/content'

export const mockBucketList: BucketItem[] = [
  { id: 'night-train', title: 'Take a night train across Europe', category: 'Travel', status: 'Dreaming', note: 'Window seats, one small suitcase each.' },
  { id: 'pasta', title: 'Learn to make pasta properly', category: 'Food', status: 'Planning', note: 'Flour everywhere is part of the brief.' },
  { id: 'northern-lights', title: 'See the northern lights', category: 'Adventures', status: 'Booked', note: 'Warm socks already on the list.' },
  { id: 'blue-hour', title: 'Swim at sunset', category: 'Small Things', status: 'Completed', note: 'Colder than promised. Better than expected.', image: '/assets/images/blue-hour-beach.webp' },
  { id: 'tiny-cinema', title: 'Find the tiniest cinema in the city', category: 'Places', status: 'Planning', note: 'Bonus points for velvet seats.' },
  { id: 'letters', title: 'Write letters for our future selves', category: 'Experiences', status: 'Dreaming', note: 'Open when we need the reminder.' },
]
