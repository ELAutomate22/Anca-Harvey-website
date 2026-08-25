export const FEBRUARY_29_ANNIVERSARY_POLICY = 'february-28' as const
export const MAX_RELATIONSHIP_YEAR = 100

export interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface RelationshipYearRange {
  yearNumber: number
  startDate: string
  endDate: string
  endExclusiveDate: string
}

export interface RelationshipYearState extends RelationshipYearRange {
  completed: boolean
  current: boolean
  daysIntoYear: number
  daysInYear: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u
const MS_PER_DAY = 86_400_000

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate()

export const parseIsoCalendarDate = (value: string): CalendarDate => {
  const match = ISO_DATE.exec(value)
  if (!match) throw new Error(`Invalid ISO date: ${value}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  return { year, month, day }
}

export const toIsoCalendarDate = ({ year, month, day }: CalendarDate): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export const compareIsoDates = (left: string, right: string): number => left.localeCompare(right)

export const addCalendarDays = (value: string, days: number): string => {
  const date = parseIsoCalendarDate(value)
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return toIsoCalendarDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  })
}

export const calendarDaysBetween = (earlier: string, later: string): number => {
  const start = parseIsoCalendarDate(earlier)
  const end = parseIsoCalendarDate(later)
  return Math.round((
    Date.UTC(end.year, end.month - 1, end.day) - Date.UTC(start.year, start.month - 1, start.day)
  ) / MS_PER_DAY)
}

/**
 * Returns the relationship anniversary after `years` completed years.
 * A 29 February start is observed on 28 February in non-leap years.
 */
export const relationshipAnniversaryDate = (startDate: string, years: number): string => {
  if (!Number.isInteger(years) || years < 0 || years > MAX_RELATIONSHIP_YEAR) {
    throw new Error(`Anniversary years must be between 0 and ${MAX_RELATIONSHIP_YEAR}.`)
  }
  const start = parseIsoCalendarDate(startDate)
  const targetYear = start.year + years
  const targetDay = start.month === 2 && start.day === 29 && daysInMonth(targetYear, 2) === 28
    ? 28
    : start.day
  return toIsoCalendarDate({ year: targetYear, month: start.month, day: targetDay })
}

export const relationshipYearRange = (startDate: string, yearNumber: number): RelationshipYearRange => {
  if (!Number.isInteger(yearNumber) || yearNumber < 1 || yearNumber > MAX_RELATIONSHIP_YEAR) {
    throw new Error(`Relationship year must be between 1 and ${MAX_RELATIONSHIP_YEAR}.`)
  }
  const start = relationshipAnniversaryDate(startDate, yearNumber - 1)
  const endExclusive = relationshipAnniversaryDate(startDate, yearNumber)
  return {
    yearNumber,
    startDate: start,
    endDate: addCalendarDays(endExclusive, -1),
    endExclusiveDate: endExclusive,
  }
}

export const completedRelationshipYears = (startDate: string, asOfDate: string): number => {
  if (compareIsoDates(asOfDate, startDate) < 0) return 0
  const start = parseIsoCalendarDate(startDate)
  const asOf = parseIsoCalendarDate(asOfDate)
  let completed = Math.min(MAX_RELATIONSHIP_YEAR, Math.max(0, asOf.year - start.year))
  while (completed > 0 && compareIsoDates(asOfDate, relationshipAnniversaryDate(startDate, completed)) < 0) {
    completed -= 1
  }
  while (
    completed < MAX_RELATIONSHIP_YEAR
    && compareIsoDates(asOfDate, relationshipAnniversaryDate(startDate, completed + 1)) >= 0
  ) {
    completed += 1
  }
  return completed
}

export const relationshipYearNumberOn = (startDate: string, date: string): number | null => {
  if (compareIsoDates(date, startDate) < 0) return null
  return Math.min(MAX_RELATIONSHIP_YEAR, completedRelationshipYears(startDate, date) + 1)
}

export const relationshipYearState = (
  startDate: string,
  yearNumber: number,
  asOfDate: string,
): RelationshipYearState => {
  const range = relationshipYearRange(startDate, yearNumber)
  const completed = compareIsoDates(asOfDate, range.endExclusiveDate) >= 0
  const currentYear = relationshipYearNumberOn(startDate, asOfDate)
  const current = currentYear === yearNumber
  const daysInYear = calendarDaysBetween(range.startDate, range.endExclusiveDate)
  const elapsedEnd = compareIsoDates(asOfDate, range.endDate) > 0 ? range.endDate : asOfDate
  const daysIntoYear = compareIsoDates(elapsedEnd, range.startDate) < 0
    ? 0
    : Math.min(daysInYear, calendarDaysBetween(range.startDate, elapsedEnd) + 1)
  return { ...range, completed, current, daysIntoYear, daysInYear }
}

export const dateInTimeZone = (instant: Date | number, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const zonedParts = (instant: number, timeZone: string): Required<CalendarDate> & { hour: number; minute: number; second: number } => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
  }
}

/** Returns the UTC instant for local midnight at the start of an ISO date. */
export const startOfDateInTimeZone = (date: string, timeZone: string): number => {
  const desired = parseIsoCalendarDate(date)
  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day)
  let instant = desiredAsUtc
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(instant, timeZone)
    const actualAsUtc = Date.UTC(
      actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second,
    )
    const correction = desiredAsUtc - actualAsUtc
    instant += correction
    if (correction === 0) break
  }
  return instant
}

export const relationshipAgeLabelOn = (startDate: string, date: string): string => {
  const yearNumber = relationshipYearNumberOn(startDate, date)
  if (yearNumber === null) return 'Before our story began'
  const completedYears = yearNumber - 1
  const range = relationshipYearRange(startDate, yearNumber)
  const daysIntoChapter = calendarDaysBetween(range.startDate, date) + 1
  if (completedYears === 0) return `Day ${daysIntoChapter} of our first year`
  return `${completedYears} ${completedYears === 1 ? 'year' : 'years'} together · day ${daysIntoChapter} of the next chapter`
}
