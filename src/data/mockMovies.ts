import type { Movie } from '@/types/content'

export const mockMovies: Movie[] = [
  { id: 'florence', title: 'The Last Train to Florence', year: 2023, runtime: '1h 47m', genres: ['Romance', 'Drama'], rating: 4.6, note: 'Slow, sunlit, and probably worth pasta first.', poster: 'linear-gradient(155deg, #d1ab7b, #6e2331 58%, #211815)' },
  { id: 'orbit', title: 'One Small Orbit', year: 2025, runtime: '2h 02m', genres: ['Sci-fi', 'Drama'], rating: 4.2, note: 'A quiet space story with a very human centre.', poster: 'radial-gradient(circle at 62% 28%, #d9c9a6 0 4%, transparent 5%), linear-gradient(160deg, #22323b, #101316 72%)' },
  { id: 'map', title: 'A Map of Small Things', year: 2024, runtime: '1h 36m', genres: ['Comedy', 'Romance'], rating: 4.4, note: 'Warm, odd, and exactly the right amount of silly.', poster: 'linear-gradient(135deg, #d4c7a8 0 38%, #9c7053 38% 48%, #48615a 48%)' },
  { id: 'house', title: 'The House With Two Lights', year: 2022, runtime: '1h 51m', genres: ['Mystery', 'Drama'], rating: 4.1, note: 'Atmospheric enough to justify making tea.', poster: 'linear-gradient(170deg, #172127, #3c3430 63%, #a47e49)' },
  { id: 'april', title: 'After April', year: 2025, runtime: '1h 42m', genres: ['Romance', 'Indie'], rating: 4.7, note: 'Beautifully observed and a little bit devastating.', poster: 'linear-gradient(145deg, #e1d8c4 0 52%, #a8867e 52% 68%, #713244 68%)' },
]
