export const activityCategories = ['food', 'adventure', 'relaxing', 'creative', 'outdoors', 'at_home', 'romantic', 'competitive', 'spontaneous', 'culture', 'fitness', 'travel', 'entertainment', 'exploring', 'seasonal', 'photography', 'shopping', 'learning', 'other'] as const
export const activityLocations = ['indoor', 'outdoor', 'either', 'home'] as const
export const activityBudgets = ['free', 'one', 'two', 'three'] as const
export const activityEnergies = ['lazy', 'normal', 'adventurous'] as const
export const activityDurations = ['under_1_hour', 'one_to_three_hours', 'half_day', 'whole_day'] as const

export type ActivityCategory = typeof activityCategories[number]
export type ActivityLocation = typeof activityLocations[number]
export type ActivityBudget = typeof activityBudgets[number]
export type ActivityEnergy = typeof activityEnergies[number]
export type ActivityDuration = typeof activityDurations[number]

export interface Activity {
  id: string
  name: string
  description: string
  category: ActivityCategory
  locationType: ActivityLocation
  budgetLevel: ActivityBudget
  energyLevel: ActivityEnergy
  durationCategory: ActivityDuration
  notes: string
  isBuiltin: boolean
  isSaved: boolean
  isHidden: boolean
  createdByUserId: string | null
  createdAt: number
  updatedAt: number
}

export interface ActivityFilters {
  category?: ActivityCategory
  locationType?: ActivityLocation
  budgetLevel?: ActivityBudget
  energyLevel?: ActivityEnergy
  durationCategory?: ActivityDuration
}

export interface ActivitySuggestion {
  suggestionId: string
  activity: Activity
  repeatedAfterExhaustion: boolean
}

export interface PlannedActivity {
  id: string
  activityId: string
  activityName: string
  activityCategory: ActivityCategory
  plannedDate: string
  plannedTime: string | null
  note: string
  status: 'planned' | 'completed' | 'cancelled'
  createdByUserId: string
  createdAt: number
  updatedAt: number
}

export interface ActivityHistoryEntry {
  id: string
  activityId: string
  activityName: string
  activityCategory: ActivityCategory
  plannedActivityId: string | null
  completedDate: string
  rating: number | null
  notes: string
  createdByUserId: string
  linkedMemoryId: string | null
  linkedMemoryTitle: string | null
  memoryImageUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface ActivityStats {
  completedCount: number
  averageRating: number | null
  savedCount: number
  plannedCount: number
  favoriteCategory: ActivityCategory | null
}

export interface ActivityInput extends ActivityFilters {
  name: string
  description?: string
  category: ActivityCategory
  locationType: ActivityLocation
  budgetLevel: ActivityBudget
  energyLevel: ActivityEnergy
  durationCategory: ActivityDuration
  notes?: string
}

export const activityLabels = {
  category: Object.fromEntries(activityCategories.map((value) => [value, value.replaceAll('_', ' ')])) as Record<ActivityCategory, string>,
  location: { indoor: 'Indoor', outdoor: 'Outdoor', either: 'Either', home: 'At home' } satisfies Record<ActivityLocation, string>,
  budget: { free: 'Free', one: '£', two: '££', three: '£££' } satisfies Record<ActivityBudget, string>,
  energy: { lazy: 'Lazy', normal: 'Normal', adventurous: 'Adventurous' } satisfies Record<ActivityEnergy, string>,
  duration: { under_1_hour: 'Under 1 hour', one_to_three_hours: '1–3 hours', half_day: 'Half day', whole_day: 'Whole day' } satisfies Record<ActivityDuration, string>,
}
