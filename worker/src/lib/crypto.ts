const encoder = new TextEncoder()

export const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

export const base64UrlToBytes = (value: string): Uint8Array => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(`${normalized}${padding}`)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export const randomToken = (length = 32): string => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export const sha256 = async (value: string | ArrayBuffer): Promise<Uint8Array> => {
  const data = typeof value === 'string' ? encoder.encode(value) : value
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

export const hashText = async (value: string): Promise<string> => bytesToBase64Url(await sha256(value))

export const secureEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.byteLength !== right.byteLength) return false
  return crypto.subtle.timingSafeEqual(left, right)
}
