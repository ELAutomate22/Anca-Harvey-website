import { ApiError } from './http'

export type JsonRecord = Record<string, unknown>

export const asRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'The request body must be an object.')
  }
  return value as JsonRecord
}

export const requiredString = (
  value: unknown,
  field: string,
  min: number,
  max: number,
): string => {
  if (typeof value !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', `${field} is required.`)
  const normalized = value.trim()
  if (normalized.length < min || normalized.length > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be between ${min} and ${max} characters.`)
  }
  return normalized
}

export const optionalString = (value: unknown, field: string, max: number): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be text.`)
  const normalized = value.trim()
  if (normalized.length > max) throw new ApiError(400, 'VALIDATION_ERROR', `${field} is too long.`)
  return normalized
}

export const optionalBoolean = (value: unknown, field: string): boolean | undefined => {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be true or false.`)
  return value
}

export const isoDate = (value: unknown, field: string): string => {
  const date = requiredString(value, field, 10, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must use YYYY-MM-DD.`)
  }
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== (month ?? 1) - 1 || parsed.getUTCDate() !== day) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} is not a valid calendar date.`)
  }
  return date
}

export const validateTimeZone = (value: unknown): string => {
  const zone = requiredString(value, 'timezone', 1, 80)
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone }).format()
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'timezone must be a valid IANA timezone.')
  }
  return zone
}
