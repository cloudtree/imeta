import crypto from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(crypto.scrypt)
const SALT_LEN = 16
const KEY_LEN = 64

/** scrypt 해시 문자열: salt:hash (hex) */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN)
  const derived = await scrypt(password, salt, KEY_LEN)
  return `${salt.toString('hex')}:${Buffer.from(derived).toString('hex')}`
}

export async function verifyPassword(password, stored) {
  if (!password || !stored || !stored.includes(':')) return false
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const derived = await scrypt(password, salt, expected.length)
    return crypto.timingSafeEqual(Buffer.from(derived), expected)
  } catch {
    return false
  }
}
