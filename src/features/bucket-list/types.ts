export const bucketCategories = ['travel', 'food', 'experiences', 'places', 'adventure', 'romantic', 'small_things', 'big_dreams', 'learning', 'seasonal', 'life_goals', 'custom'] as const
export const bucketStatuses = ['dreaming', 'planning', 'booked', 'completed'] as const
export const bucketPriorities = ['someday', 'would_love_to', 'must_do'] as const
export type BucketCategory = typeof bucketCategories[number]
export type BucketStatus = typeof bucketStatuses[number]
export type BucketPriority = typeof bucketPriorities[number]

export interface BucketItem {
  id: string
  title: string
  description: string
  category: BucketCategory
  status: BucketStatus
  targetDate: string | null
  location: string
  priority: BucketPriority | null
  createdByUserId: string
  completedByUserId: string | null
  completedAt: string | null
  completionRating: number | null
  completionNote: string
  linkedMemoryId: string | null
  linkedMemoryTitle: string | null
  memoryImageUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface BucketInput {
  title: string
  description?: string
  category: BucketCategory
  status?: Exclude<BucketStatus, 'completed'>
  targetDate?: string | null
  location?: string
  priority?: BucketPriority | null
}

export interface BucketStats {
  totalCount: number
  completedCount: number
  planningCount: number
  bookedCount: number
  progressPercent: number
  categories: Array<{ category: BucketCategory; total: number; completed: number }>
}

export const bucketLabels = Object.fromEntries(bucketCategories.map((value) => [value, value.replaceAll('_', ' ')])) as Record<BucketCategory, string>
