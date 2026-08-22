import { scryptSync } from 'node:crypto'

import { base64UrlToBytes, secureEqual } from './crypto'

export const SCRYPT_N = 32_768
export const SCRYPT_R = 8
export const SCRYPT_P = 3
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const PASSWORD_ALGORITHM = 'scrypt'
const DUMMY_PASSWORD_HASH = `${PASSWORD_ALGORITHM}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`

interface PasswordHashParts {
  salt: Uint8Array
  expected: Uint8Array
}

const parsePasswordHash = (storedHash: string): PasswordHashParts | null => {
  const [algorithm, nText, rText, pText, saltText, hashText] = storedHash.split('$')
  if (
    algorithm !== PASSWORD_ALGORITHM
    || Number(nText) !== SCRYPT_N
    || Number(rText) !== SCRYPT_R
    || Number(pText) !== SCRYPT_P
    || !saltText
    || !hashText
  ) return null

  try {
    const salt = base64UrlToBytes(saltText)
    const expected = base64UrlToBytes(hashText)
    if (salt.byteLength < 16 || expected.byteLength !== 32) return null
    return { salt, expected }
  } catch {
    return null
  }
}

export const verifyPassword = async (password: string, storedHash?: string | null): Promise<boolean> => {
  const parsed = parsePasswordHash(storedHash ?? DUMMY_PASSWORD_HASH) ?? parsePasswordHash(DUMMY_PASSWORD_HASH)
  if (!parsed) return false

  const derived = scryptSync(password, parsed.salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY,
  })
  return Boolean(storedHash) && secureEqual(derived, parsed.expected)
}
