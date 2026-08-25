const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu
const isControlCharacter = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0
  return code < 32 || code === 127
}

export const safeArchiveSegment = (value: string, fallback = 'item', maxLength = 80): string => {
  const normalized = value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .split('')
    .filter((character) => !isControlCharacter(character))
    .join('')
    .toLocaleLowerCase('en-GB')
    .replace(/[<>:"/\\|?*]+/gu, '-')
    .replace(/[^a-z0-9._ -]+/gu, '-')
    .replace(/[\s._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, maxLength)
    .replace(/[-. ]+$/gu, '')

  const candidate = normalized || fallback
  return WINDOWS_RESERVED.test(candidate) ? `item-${candidate}`.slice(0, maxLength) : candidate
}

const extensionByMimeType: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

export const safeMediaExtension = (mimeType: string): string => extensionByMimeType[mimeType] ?? 'bin'

export const shortStableId = (id: string): string => {
  const compact = id.replace(/[^a-zA-Z0-9]/gu, '').toLocaleLowerCase('en-GB')
  return compact.slice(-8) || 'unknown'
}

export const memoryMediaArchivePath = (input: {
  memoryId: string
  memoryDate: string
  memoryTitle: string
  mediaType: 'image' | 'video'
  mimeType: string
  sortOrder: number
}): string => {
  const folder = `${input.memoryDate}-${safeArchiveSegment(input.memoryTitle, 'memory', 64)}-${shortStableId(input.memoryId)}`
  const sequence = String(input.sortOrder + 1).padStart(2, '0')
  return `Our-Relationship-Backup/media/memories/${folder}/${input.mediaType}-${sequence}.${safeMediaExtension(input.mimeType)}`
}

export const letterMediaArchivePath = (input: {
  letterId: string
  letterTitle: string
  role: 'page' | 'cover'
  mimeType: string
  sortOrder: number
}): string => {
  const folder = `${safeArchiveSegment(input.letterTitle, 'letter', 64)}-${shortStableId(input.letterId)}`
  const sequence = String(input.sortOrder + 1).padStart(2, '0')
  return `Our-Relationship-Backup/media/letters/${folder}/${input.role}-${sequence}.${safeMediaExtension(input.mimeType)}`
}

export const assertSafeArchivePath = (path: string): void => {
  if (
    path.startsWith('/')
    || path.includes('\\')
    || path.split('/').some((segment) => segment === '..' || segment === '.' || segment.length === 0)
    || [...path].some(isControlCharacter)
  ) {
    throw new Error('Unsafe archive path.')
  }
}

export const backupDownloadFilename = (type: 'data' | 'full', createdAt: number): string => {
  const date = new Date(createdAt).toISOString().slice(0, 10)
  return type === 'full'
    ? `Our-Relationship-Backup-${date}.zip`
    : `Our-Relationship-Data-${date}.zip`
}
