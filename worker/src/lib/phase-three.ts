import { ApiError } from './http'
import { isoDate, optionalString, requiredString, type JsonRecord } from './validation'

export const positiveInteger = (value: unknown, field: string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a positive integer.`)
  }
  return parsed
}

export const optionalYear = (value: unknown, field = 'releaseYear'): number | null => {
  if (value === undefined || value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 1870 || parsed > 2200) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid year.`)
  }
  return parsed
}

export const nullableText = (value: unknown, field: string, max: number): string | null => {
  const text = optionalString(value, field, max)
  return text ? text : null
}

export const ratingHalfSteps = (value: unknown, field = 'rating'): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a number from 0.5 to 5.`)
  }
  const halfSteps = value * 2
  if (!Number.isInteger(halfSteps) || halfSteps < 1 || halfSteps > 10) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be from 0.5 to 5 in half-star steps.`)
  }
  return halfSteps
}

export const optionalRatingHalfSteps = (value: unknown, field = 'rating'): number | undefined =>
  value === undefined ? undefined : ratingHalfSteps(value, field)

export const movieSnapshot = (body: JsonRecord) => ({
  tmdbMovieId: positiveInteger(body.tmdbMovieId, 'tmdbMovieId'),
  title: requiredString(body.title, 'title', 1, 250),
  posterPath: nullableText(body.posterPath, 'posterPath', 250),
  releaseYear: optionalYear(body.releaseYear),
})

export const pageLimit = (url: URL, fallback = 50, maximum = 100): number => {
  const raw = url.searchParams.get('limit')
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new ApiError(400, 'VALIDATION_ERROR', `limit must be between 1 and ${maximum}.`)
  }
  return value
}

export const validateOutcome = (value: unknown): 'partner_win' | 'draw' | 'cooperative_win' | 'no_winner' => {
  const outcome = requiredString(value, 'outcome', 1, 30)
  if (!['partner_win', 'draw', 'cooperative_win', 'no_winner'].includes(outcome)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'outcome is not supported.')
  }
  return outcome as 'partner_win' | 'draw' | 'cooperative_win' | 'no_winner'
}

export const optionalHttpsUrl = (
  value: unknown,
  field: string,
  allowedHosts: ReadonlySet<string>,
): string | null => {
  const text = nullableText(value, field, 1_000)
  if (!text) return null
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a valid HTTPS URL.`)
  }
  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must use an approved HTTPS link.`)
  }
  return parsed.toString()
}

export const phaseThreeDate = (body: JsonRecord, key: string): string => isoDate(body[key], key)
