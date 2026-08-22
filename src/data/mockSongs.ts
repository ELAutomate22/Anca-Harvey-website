import type { Song } from '@/types/content'

export const mockSongs: Song[] = [
  { id: 'our-song', title: 'Where the Evening Stays', artist: 'The North Windows', note: 'The one that somehow became ours.', isOurSong: true, artwork: 'linear-gradient(145deg, #7a2a3a, #271719 70%)' },
  { id: 'soft-mile', title: 'A Soft Mile Home', artist: 'June Lantern', note: 'For late trains and shared headphones.', isOurSong: false, artwork: 'linear-gradient(145deg, #c7ad8c, #58645b)' },
  { id: 'blue-kitchen', title: 'Blue Kitchen Light', artist: 'Amelie Row', note: 'Sunday mornings, usually too loud.', isOurSong: false, artwork: 'linear-gradient(145deg, #9aafae, #26343a)' },
  { id: 'slow-weather', title: 'Slow Weather', artist: 'Common Hours', note: 'For when the rain improves the plan.', isOurSong: false, artwork: 'linear-gradient(145deg, #d0c1a7, #6f554a)' },
]
