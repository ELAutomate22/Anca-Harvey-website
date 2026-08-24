import type { AuthSession } from '../auth/session'
import { ApiError } from '../lib/http'
import { isoDate, requiredString } from '../lib/validation'
import type { FutureLetterRow, PublicLetterStatus } from './types'

export const MAX_LETTER_BODY = 100_000
export const MAX_LETTER_PAGES = 12
export const MAX_LETTER_IMAGE_BYTES = 20 * 1024 * 1024

interface CalendarDate { year: number; month: number; day: number }
interface CalendarDateTime extends CalendarDate { hour: number; minute: number }

const dateText = ({ year, month, day }: CalendarDate): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const parseDate = (value: string): CalendarDate => {
  const [year, month, day] = value.split('-').map(Number)
  return { year: year ?? 0, month: month ?? 0, day: day ?? 0 }
}

const compareDates = (left: CalendarDate, right: CalendarDate): number =>
  dateText(left).localeCompare(dateText(right))

const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

const clampDate = (year: number, month: number, day: number): CalendarDate => ({
  year,
  month,
  day: Math.min(day, daysInMonth(year, month)),
})

const addMonths = (date: CalendarDate, months: number): CalendarDate => {
  const zeroBased = date.month - 1 + months
  const year = date.year + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12 + 1
  return clampDate(year, month, date.day)
}

const zonedParts = (epochMs: number, timeZone: string): CalendarDateTime => {
  const entries = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(epochMs))
  const values = Object.fromEntries(entries.map((part) => [part.type, Number(part.value)]))
  return { year: values.year ?? 0, month: values.month ?? 0, day: values.day ?? 0,
    hour: values.hour ?? 0, minute: values.minute ?? 0 }
}

export const localDateTimeToEpoch = (
  dateValue: unknown,
  timeValue: unknown,
  timeZone: string,
): { unlockAt: number; localDate: string; localTime: string } => {
  const localDate = isoDate(dateValue, 'unlockDate')
  const localTime = timeValue === undefined || timeValue === null || timeValue === ''
    ? '00:00'
    : requiredString(timeValue, 'unlockTime', 5, 5)
  const match = /^(\d{2}):(\d{2})$/u.exec(localTime)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'unlockTime must use 24-hour HH:MM.')
  }
  const date = parseDate(localDate)
  const requested: CalendarDateTime = { ...date, hour: Number(match[1]), minute: Number(match[2]) }
  const utcShape = Date.UTC(requested.year, requested.month - 1, requested.day, requested.hour, requested.minute)
  let candidate = utcShape
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const represented = zonedParts(candidate, timeZone)
    const representedUtcShape = Date.UTC(represented.year, represented.month - 1, represented.day, represented.hour, represented.minute)
    const adjustment = utcShape - representedUtcShape
    candidate += adjustment
    if (adjustment === 0) break
  }
  const finalParts = zonedParts(candidate, timeZone)
  if (finalParts.year !== requested.year || finalParts.month !== requested.month || finalParts.day !== requested.day
    || finalParts.hour !== requested.hour || finalParts.minute !== requested.minute) {
    throw new ApiError(400, 'INVALID_LOCAL_TIME', 'That local time does not exist in the relationship timezone.')
  }
  return { unlockAt: candidate, localDate, localTime }
}

export const quickUnlockDates = (startDate: string, timeZone: string, now: number) => {
  const today = zonedParts(now, timeZone)
  const current: CalendarDate = { year: today.year, month: today.month, day: today.day }
  const start = parseDate(startDate)
  let anniversary = clampDate(current.year, start.month, start.day)
  if (compareDates(anniversary, current) <= 0) anniversary = clampDate(current.year + 1, start.month, start.day)

  const monthDifference = (current.year - start.year) * 12 + current.month - start.month
  let milestone = addMonths(start, Math.max(1, Math.floor(monthDifference / 6) + 1) * 6)
  while (compareDates(milestone, current) <= 0) milestone = addMonths(milestone, 6)

  return {
    serverNow: now,
    timeZone,
    nextAnniversary: dateText(anniversary),
    nextMilestone: dateText(milestone),
    sixMonthsFromNow: dateText(addMonths(current, 6)),
    oneYearFromNow: dateText(clampDate(current.year + 1, current.month, current.day)),
  }
}

export const publicLetterStatus = (letter: FutureLetterRow, serverNow: number): PublicLetterStatus =>
  letter.status === 'sealed' && letter.unlock_at !== null && serverNow >= Number(letter.unlock_at)
    ? 'ready'
    : letter.status

export const canInitiallyOpen = (session: AuthSession, letter: FutureLetterRow): boolean => {
  if (letter.status === 'opened') return true
  if (letter.recipient_type === 'both') return true
  return letter.recipient_type === 'user' && letter.recipient_user_id === session.user.id
}

export const assertDraftOwner = (session: AuthSession, letter: FutureLetterRow): void => {
  if (letter.status !== 'draft' || letter.created_by_user_id !== session.user.id) {
    throw new ApiError(404, 'LETTER_NOT_FOUND', 'That future letter was not found.')
  }
}

export const assertSealReady = (letter: FutureLetterRow, pageCount: number, serverNow: number): void => {
  if (letter.status !== 'draft') throw new ApiError(409, 'LETTER_IMMUTABLE', 'A sealed letter cannot be changed.')
  if (!letter.title.trim()) throw new ApiError(400, 'LETTER_TITLE_REQUIRED', 'Give the letter a title before sealing.')
  if (!letter.recipient_type) throw new ApiError(400, 'LETTER_RECIPIENT_REQUIRED', 'Choose who the letter is for.')
  if (letter.unlock_at === null || Number(letter.unlock_at) <= serverNow) {
    throw new ApiError(400, 'LETTER_UNLOCK_MUST_BE_FUTURE', 'Choose an unlock time in the future.')
  }
  if (letter.letter_type === 'typed' && !letter.typed_content?.trim()) {
    throw new ApiError(400, 'LETTER_CONTENT_REQUIRED', 'Write the letter before sealing it.')
  }
  if (letter.letter_type === 'uploaded' && pageCount < 1) {
    throw new ApiError(400, 'LETTER_PAGE_REQUIRED', 'Upload at least one handwritten page before sealing.')
  }
}

// This serializer is also the mandatory boundary for future backup/export work.
// It intentionally has no typed_content, media IDs, object keys, or media URLs.
export const safeLetterMetadata = (session: AuthSession, letter: FutureLetterRow, serverNow: number) => ({
  id: letter.id,
  title: letter.title,
  letterType: letter.letter_type,
  teaser: letter.teaser,
  status: publicLetterStatus(letter, serverNow),
  senderUserId: letter.created_by_user_id,
  senderName: letter.sender_name,
  recipientType: letter.recipient_type,
  recipientUserId: letter.recipient_user_id,
  recipientName: letter.recipient_type === 'both' ? 'Both of us' : letter.recipient_name,
  unlockAt: letter.unlock_at === null ? null : Number(letter.unlock_at),
  sealedAt: letter.sealed_at === null ? null : Number(letter.sealed_at),
  openedAt: letter.opened_at === null ? null : Number(letter.opened_at),
  firstOpenedByUserId: letter.first_opened_by_user_id,
  firstOpenedByName: letter.first_opened_by_name,
  createdAt: Number(letter.created_at),
  updatedAt: Number(letter.updated_at),
  pageCount: Number(letter.page_count),
  canOpen: publicLetterStatus(letter, serverNow) === 'ready' && canInitiallyOpen(session, letter),
  isMine: letter.created_by_user_id === session.user.id,
})
