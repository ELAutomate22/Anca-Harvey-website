import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  calendarDaysBetween,
  completedRelationshipYears,
  dateInTimeZone,
  relationshipAgeLabelOn,
  relationshipAnniversaryDate,
  relationshipYearNumberOn,
  relationshipYearRange,
  relationshipYearState,
  startOfDateInTimeZone,
} from './relationship-years'

describe('relationship year boundaries', () => {
  it.each([
    ['2025-01-01', '2025-01-01', 1],
    ['2025-08-28', '2026-08-27', 1],
    ['2025-08-28', '2026-08-28', 2],
    ['2025-12-31', '2026-12-30', 1],
  ])('assigns %s through %s to the expected relationship year', (start, date, year) => {
    expect(relationshipYearNumberOn(start, date)).toBe(year)
  })

  it('uses inclusive anniversary-based ranges rather than calendar years', () => {
    expect(relationshipYearRange('2025-08-28', 1)).toEqual({
      yearNumber: 1,
      startDate: '2025-08-28',
      endDate: '2026-08-27',
      endExclusiveDate: '2026-08-28',
    })
  })

  it('reports completed and current states on the anniversary boundary', () => {
    expect(relationshipYearState('2025-08-28', 1, '2026-08-28')).toMatchObject({ completed: true, current: false })
    expect(relationshipYearState('2025-08-28', 2, '2026-08-28')).toMatchObject({ completed: false, current: true, daysIntoYear: 1 })
    expect(completedRelationshipYears('2025-08-28', '2026-08-27')).toBe(0)
    expect(completedRelationshipYears('2025-08-28', '2026-08-28')).toBe(1)
  })

  it('observes a 29 February anniversary on 28 February in non-leap years', () => {
    expect(relationshipAnniversaryDate('2024-02-29', 1)).toBe('2025-02-28')
    expect(relationshipAnniversaryDate('2024-02-29', 4)).toBe('2028-02-29')
    expect(relationshipYearRange('2024-02-29', 4).endDate).toBe('2028-02-28')
  })

  it('keeps leap-day arithmetic exact', () => {
    expect(addCalendarDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(calendarDaysBetween('2024-02-29', '2025-02-28')).toBe(365)
  })

  it('formats calendar-aware relationship age', () => {
    expect(relationshipAgeLabelOn('2025-08-28', '2025-08-28')).toBe('Day 1 of our first year')
    expect(relationshipAgeLabelOn('2025-08-28', '2026-08-28')).toBe('1 year together · day 1 of the next chapter')
  })
})

describe('Europe/London timezone safety', () => {
  it('finds the correct local date around the spring DST change', () => {
    expect(dateInTimeZone(Date.parse('2026-03-29T00:30:00Z'), 'Europe/London')).toBe('2026-03-29')
    expect(dateInTimeZone(Date.parse('2026-03-29T23:30:00Z'), 'Europe/London')).toBe('2026-03-30')
  })

  it('finds local midnight on both sides of daylight-saving time', () => {
    expect(startOfDateInTimeZone('2026-03-29', 'Europe/London')).toBe(Date.parse('2026-03-29T00:00:00Z'))
    expect(startOfDateInTimeZone('2026-03-30', 'Europe/London')).toBe(Date.parse('2026-03-29T23:00:00Z'))
    expect(startOfDateInTimeZone('2026-10-26', 'Europe/London')).toBe(Date.parse('2026-10-26T00:00:00Z'))
  })
})
