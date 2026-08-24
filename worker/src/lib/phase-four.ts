import { ApiError } from './http'
import { isoDate, optionalString, requiredString } from './validation'

export const ACTIVITY_CATEGORIES = [
  'food', 'adventure', 'relaxing', 'creative', 'outdoors', 'at_home', 'romantic',
  'competitive', 'spontaneous', 'culture', 'fitness', 'travel', 'entertainment',
  'exploring', 'seasonal', 'photography', 'shopping', 'learning', 'other',
] as const
export const ACTIVITY_LOCATIONS = ['indoor', 'outdoor', 'either', 'home'] as const
export const ACTIVITY_BUDGETS = ['free', 'one', 'two', 'three'] as const
export const ACTIVITY_ENERGIES = ['lazy', 'normal', 'adventurous'] as const
export const ACTIVITY_DURATIONS = ['under_1_hour', 'one_to_three_hours', 'half_day', 'whole_day'] as const
export const PLAN_STATUSES = ['planned', 'completed', 'cancelled'] as const
export const BUCKET_CATEGORIES = [
  'travel', 'food', 'experiences', 'places', 'adventure', 'romantic', 'small_things',
  'big_dreams', 'learning', 'seasonal', 'life_goals', 'custom',
] as const
export const BUCKET_STATUSES = ['dreaming', 'planning', 'booked', 'completed'] as const
export const BUCKET_PRIORITIES = ['someday', 'would_love_to', 'must_do'] as const

type StringChoice = readonly string[]

export const enumValue = <T extends StringChoice>(
  value: unknown,
  field: string,
  choices: T,
): T[number] => {
  if (typeof value !== 'string' || !choices.includes(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be one of: ${choices.join(', ')}.`)
  }
  return value as T[number]
}

export const optionalEnumValue = <T extends StringChoice>(
  value: unknown,
  field: string,
  choices: T,
): T[number] | undefined => value === undefined ? undefined : enumValue(value, field, choices)

export const nullableEnumValue = <T extends StringChoice>(
  value: unknown,
  field: string,
  choices: T,
): T[number] | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return enumValue(value, field, choices)
}

export const optionalIsoDate = (value: unknown, field: string): string | undefined =>
  value === undefined ? undefined : isoDate(value, field)

export const nullableIsoDate = (value: unknown, field: string): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return isoDate(value, field)
}

export const optionalTime = (value: unknown, field: string): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const time = requiredString(value, field, 5, 5)
  const match = /^(\d{2}):(\d{2})$/u.exec(time)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must use 24-hour HH:MM.`)
  }
  return time
}

export const optionalRatingHalfSteps = (value: unknown, field = 'rating'): number | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.5 || value > 5 || value * 2 % 1 !== 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be from 0.5 to 5 in half-star steps.`)
  }
  return Math.round(value * 2)
}

export const optionalTrimmed = (value: unknown, field: string, max: number): string | undefined =>
  optionalString(value, field, max)

export const assertId = (value: string, label: string): string => {
  if (!/^[A-Za-z0-9_-]{1,100}$/u.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${label} is invalid.`)
  }
  return value
}

export const todayInTimeZone = (timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}
