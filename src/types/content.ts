export type MemoryCategory = 'Trips' | 'Dates' | 'Funny' | 'Milestones'

export interface Memory {
  id: string
  title: string
  caption: string
  date: string
  category: MemoryCategory
  mediaType: 'photo' | 'video'
  favorite: boolean
  image: string
  alt: string
  aspect: 'portrait' | 'landscape' | 'square'
}

export interface Movie {
  id: string
  title: string
  year: number
  runtime: string
  genres: string[]
  rating: number
  note: string
  poster: string
}

export interface Game {
  id: string
  title: string
  category: 'Cosy' | 'Competitive' | 'Co-op' | 'Quick'
  players: string
  duration: string
  note: string
  motif: string
}

export interface Song {
  id: string
  title: string
  artist: string
  note: string
  isOurSong: boolean
  artwork: string
}

export type ActivityPlace = 'Indoor' | 'Outdoor' | 'Either'
export type ActivityBudget = 'Free' | '£' | '££' | '£££'
export type ActivityEnergy = 'Lazy' | 'Normal' | 'Adventurous'
export type ActivityDuration = 'Under 1 hour' | '1–3 hours' | 'Half day' | 'Whole day'

export interface Activity {
  id: string
  title: string
  description: string
  place: ActivityPlace
  budget: ActivityBudget
  energy: ActivityEnergy
  duration: ActivityDuration
  category: string
}

export interface TimelineEntry {
  id: string
  title: string
  date: string
  eyebrow: string
  description: string
  image?: string
  status: 'past' | 'current' | 'upcoming'
}

export type BucketStatus = 'Dreaming' | 'Planning' | 'Booked' | 'Completed'

export interface BucketItem {
  id: string
  title: string
  category: 'Travel' | 'Food' | 'Experiences' | 'Places' | 'Adventures' | 'Small Things' | 'Custom'
  status: BucketStatus
  note: string
  image?: string
}

export interface FutureLetter {
  id: string
  title: string
  recipient: string
  unlockDate: string
  state: 'sealed' | 'ready' | 'opened'
  preview: string
}
