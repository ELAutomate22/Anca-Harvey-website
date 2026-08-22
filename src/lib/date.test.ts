import { describe, expect, it } from 'vitest'
import {
  addCalendarMonths,
  differenceInCalendarDays,
  formatRelationshipDuration,
  getAnniversaryNumber,
  getNextSixMonthMilestone,
  getRelationshipDuration,
  parseLocalDate,
} from './date'

describe('relationship date utilities', () => {
  it('calculates calendar duration without timezone drift', () => {
    const duration = getRelationshipDuration(parseLocalDate('2024-02-29'), parseLocalDate('2025-03-01'))
    expect(duration).toEqual({ days: 366, totalMonths: 12, years: 1, months: 0 })
  })

  it('clamps month-end dates safely', () => {
    expect(addCalendarMonths(parseLocalDate('2024-08-31'), 6)).toEqual(parseLocalDate('2025-02-28'))
  })

  it('finds the next six-month milestone after an exact anniversary', () => {
    const milestone = getNextSixMonthMilestone(parseLocalDate('2024-08-20'), parseLocalDate('2025-08-20'))
    expect(milestone.label).toBe('1 year + 6 months')
    expect(milestone.date).toEqual(parseLocalDate('2026-02-20'))
    expect(milestone.daysRemaining).toBe(184)
  })

  it('returns the completed anniversary number', () => {
    expect(getAnniversaryNumber(parseLocalDate('2022-11-10'), parseLocalDate('2025-11-09'))).toBe(2)
  })

  it('formats a natural duration label', () => {
    expect(formatRelationshipDuration({ days: 428, totalMonths: 14, years: 1, months: 2 })).toBe('1 year, 2 months')
  })

  it('counts calendar days across daylight-saving changes', () => {
    expect(differenceInCalendarDays(parseLocalDate('2025-04-01'), parseLocalDate('2025-03-29'))).toBe(3)
  })
})
