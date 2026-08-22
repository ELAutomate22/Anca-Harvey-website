export interface RelationshipDuration {
  days: number
  totalMonths: number
  years: number
  months: number
}

export interface RelationshipMilestone {
  date: Date
  halfYears: number
  label: string
  daysRemaining: number
}

const MS_PER_DAY = 86_400_000

export const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) throw new Error(`Invalid ISO date: ${value}`)
  return new Date(year, month - 1, day)
}

const utcDay = (date: Date): number => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())

export const differenceInCalendarDays = (later: Date, earlier: Date): number =>
  Math.floor((utcDay(later) - utcDay(earlier)) / MS_PER_DAY)

const daysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate()

export const addCalendarMonths = (date: Date, months: number): Date => {
  const targetMonth = date.getMonth() + months
  const year = date.getFullYear() + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const day = Math.min(date.getDate(), daysInMonth(year, normalizedMonth))
  return new Date(year, normalizedMonth, day)
}

const fullMonthsBetween = (start: Date, end: Date): number => {
  if (end < start) return 0
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
  if (addCalendarMonths(start, months) > end) months -= 1
  return Math.max(0, months)
}

export const getRelationshipDuration = (start: Date, asOf = new Date()): RelationshipDuration => {
  const totalMonths = fullMonthsBetween(start, asOf)
  return {
    days: Math.max(0, differenceInCalendarDays(asOf, start)),
    totalMonths,
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  }
}

export const getAnniversaryNumber = (start: Date, asOf = new Date()): number =>
  Math.floor(fullMonthsBetween(start, asOf) / 12)

const milestoneLabel = (halfYears: number): string => {
  const years = halfYears / 2
  if (Number.isInteger(years)) return `${years} year${years === 1 ? '' : 's'}`
  return `${Math.floor(years)} year${years < 2 ? '' : 's'} + 6 months`
}

export const getNextSixMonthMilestone = (start: Date, asOf = new Date()): RelationshipMilestone => {
  const fullMonths = fullMonthsBetween(start, asOf)
  const nextHalfYears = Math.floor(fullMonths / 6) + 1
  const date = addCalendarMonths(start, nextHalfYears * 6)
  return {
    date,
    halfYears: nextHalfYears,
    label: milestoneLabel(nextHalfYears),
    daysRemaining: Math.max(0, differenceInCalendarDays(date, asOf)),
  }
}

export const formatRelationshipDuration = ({ years, months, days }: RelationshipDuration): string => {
  if (years > 0) return `${years} year${years === 1 ? '' : 's'}${months ? `, ${months} month${months === 1 ? '' : 's'}` : ''}`
  if (months > 0) return `${months} month${months === 1 ? '' : 's'}`
  return `${days} day${days === 1 ? '' : 's'}`
}

export const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
  const value = typeof date === 'string' ? parseLocalDate(date) : date
  return new Intl.DateTimeFormat('en-GB', options ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(value)
}
