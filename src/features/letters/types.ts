export type LetterType = 'typed' | 'uploaded'
export type LetterStatus = 'draft' | 'sealed' | 'ready' | 'opened'
export type LetterRecipientType = 'user' | 'both'
export type LetterMediaRole = 'page' | 'cover'

export interface LetterMedia {
  id: string
  role: LetterMediaRole
  filename: string
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  altText: string
  sortOrder: number
  createdAt: number
  url: string
}

export interface FutureLetter {
  id: string
  title: string
  letterType: LetterType
  teaser: string
  status: LetterStatus
  senderUserId: string
  senderName: string
  recipientType: LetterRecipientType | null
  recipientUserId: string | null
  recipientName: string | null
  unlockAt: number | null
  sealedAt: number | null
  openedAt: number | null
  firstOpenedByUserId: string | null
  firstOpenedByName: string | null
  createdAt: number
  updatedAt: number
  pageCount: number
  canOpen: boolean
  isMine: boolean
  typedContent?: string | null
  media?: LetterMedia[]
}

export interface LetterSummary {
  sealedCount: number
  readyCount: number
  openedCount: number
  nextUnlockAt: number | null
}

export interface LetterListResponse {
  items: FutureLetter[]
  summary: LetterSummary
  serverNow: number
  timeZone: string
}

export interface LetterDetailResponse {
  letter: FutureLetter
  serverNow: number
}

export interface LetterQuickDates {
  serverNow: number
  timeZone: string
  nextAnniversary: string
  nextMilestone: string
  sixMonthsFromNow: string
  oneYearFromNow: string
}

export interface LetterDraftInput {
  title: string
  typedContent?: string
  teaser: string
  recipientType: LetterRecipientType | null
  recipientUserId: string | null
  unlockDate: string | null
  unlockTime?: string
}

export interface LetterUploadProgress {
  loaded: number
  total: number
  percent: number
}
