export type LetterType = 'typed' | 'uploaded'
export type RecipientType = 'user' | 'both'
export type StoredLetterStatus = 'draft' | 'sealed' | 'opened'
export type PublicLetterStatus = StoredLetterStatus | 'ready'
export type LetterMediaRole = 'page' | 'cover'

export interface FutureLetterRow {
  id: string
  relationship_id: string
  created_by_user_id: string
  recipient_type: RecipientType | null
  recipient_user_id: string | null
  title: string
  letter_type: LetterType
  typed_content: string | null
  teaser: string
  status: StoredLetterStatus
  unlock_at: number | null
  sealed_at: number | null
  opened_at: number | null
  first_opened_by_user_id: string | null
  created_at: number
  updated_at: number
  sender_name: string
  recipient_name: string | null
  first_opened_by_name: string | null
  page_count: number
  cover_count: number
}

export interface LetterMediaRow {
  id: string
  future_letter_id: string
  relationship_id: string
  uploaded_by_user_id: string
  media_role: LetterMediaRole
  media_type: 'image'
  r2_key: string
  original_filename: string
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
  size_bytes: number
  width: number | null
  height: number | null
  alt_text: string
  sort_order: number
  created_at: number
}
