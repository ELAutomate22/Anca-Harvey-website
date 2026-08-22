import { base64UrlToBytes, secureEqual } from './crypto'

export const PASSWORD_ITERATIONS = 600_000
const PASSWORD_ALGORITHM = 'pbkdf2-sha256'
const DUMMY_PASSWORD_HASH = `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`

interface PasswordHashParts {
  iterations: number
  salt: Uint8Array
  expected: Uint8Array
}

const parsePasswordHash = (storedHash: string): PasswordHashParts | null => {
  const [algorithm, iterationsText, saltText, hashText] = storedHash.split('$')
  const iterations = Number(iterationsText)
  if (
    algorithm !== PASSWORD_ALGORITHM
    || !Number.isInteger(iterations)
    || iterations < 100_000
    || iterations > 2_000_000
    || !saltText
    || !hashText
  ) return null

  try {
    const salt = base64UrlToBytes(saltText)
    const expected = base64UrlToBytes(hashText)
    if (salt.byteLength < 16 || expected.byteLength !== 32) return null
    return { iterations, salt, expected }
  } catch {
    return null
  }
}

export const verifyPassword = async (password: string, storedHash?: string | null): Promise<boolean> => {
  const parsed = parsePasswordHash(storedHash ?? DUMMY_PASSWORD_HASH) ?? parsePasswordHash(DUMMY_PASSWORD_HASH)
  if (!parsed) return false

  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: parsed.salt, iterations: parsed.iterations },
    material,
    256,
  ))
  return Boolean(storedHash) && secureEqual(derived, parsed.expected)
}
