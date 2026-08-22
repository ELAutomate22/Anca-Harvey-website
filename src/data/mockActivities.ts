import type { Activity } from '@/types/content'

export const mockActivities: Activity[] = [
  { id: 'blind-menu', title: 'Cook a mystery three-course menu', description: 'Choose one ingredient each, then build dinner without checking a recipe until the end.', place: 'Indoor', budget: '££', energy: 'Normal', duration: '1–3 hours', category: 'Food' },
  { id: 'sunrise-flask', title: 'Take breakfast to sunrise', description: 'Fill a flask, pick the nearest east-facing hill, and leave before the streets wake up.', place: 'Outdoor', budget: '£', energy: 'Adventurous', duration: 'Half day', category: 'Outside' },
  { id: 'film-swap', title: 'Photograph each other’s ordinary day', description: 'Twelve frames each. No retakes. Compare the tiny things you noticed over dessert.', place: 'Either', budget: 'Free', energy: 'Normal', duration: 'Whole day', category: 'Creative' },
  { id: 'blanket-cinema', title: 'Build a blanket cinema', description: 'One comfort film, homemade tickets, and the best snacks hidden until the trailers.', place: 'Indoor', budget: '£', energy: 'Lazy', duration: '1–3 hours', category: 'Cosy' },
  { id: 'coin-walk', title: 'Let a coin choose the walk', description: 'Heads left, tails right. Stop when you find somewhere worth sitting for ten minutes.', place: 'Outdoor', budget: 'Free', energy: 'Normal', duration: 'Under 1 hour', category: 'Spontaneous' },
  { id: 'train-town', title: 'Take the next train somewhere small', description: 'Pick a departure under an hour away and arrive with only one rule: try the local bakery.', place: 'Outdoor', budget: '£££', energy: 'Adventurous', duration: 'Whole day', category: 'Mini trip' },
  { id: 'portrait-hour', title: 'Draw terrible portraits of each other', description: 'Ten minutes, one continuous line, and absolutely no artistic ability required.', place: 'Indoor', budget: 'Free', energy: 'Lazy', duration: 'Under 1 hour', category: 'Creative' },
  { id: 'garden-evening', title: 'Find an evening garden', description: 'Walk somewhere green near closing time, then choose a flower for the next shared playlist cover.', place: 'Either', budget: '£', energy: 'Normal', duration: '1–3 hours', category: 'Slow date' },
]
