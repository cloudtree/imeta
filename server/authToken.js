import crypto from 'crypto'
import { pool } from './db.js'
import { verifyPassword } from './userPassword.js'

const AUTH_USERNAME = process.env.AUTH_USERNAME?.trim() || 'cloudtree'
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'americano'
const AUTH_SECRET = process.env.AUTH_SECRET?.trim() || 'meta-auth-secret-change-in-production'
const TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS ?? 24 * 60 * 60 * 1000)

/**
 * DB 사용자 우선 검증. 성공 시 { username, role_cd }, 실패 시 null.
 * 테이블 미존재/미매칭 시 env 계정으로 폴백 (ADMIN).
 */
export async function verifyCredentials(username, password) {
  const name = username?.trim()
  if (!name || password == null || password === '') return null

  try {
    const { rows } = await pool.query(
      `SELECT username, password_hash, use_yn, role_cd
       FROM meta_users
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [name],
    )
    if (rows[0]) {
      if (rows[0].use_yn !== 'Y') return null
      const ok = await verifyPassword(password, rows[0].password_hash)
      if (!ok) return null
      return {
        username: rows[0].username,
        role_cd: rows[0].role_cd === 'ADMIN' ? 'ADMIN' : 'USER',
      }
    }
  } catch (err) {
    console.warn('[auth] meta_users lookup failed, falling back to env:', err.message)
  }

  if (name === AUTH_USERNAME && password === AUTH_PASSWORD) {
    return { username: AUTH_USERNAME, role_cd: 'ADMIN' }
  }
  return null
}

export function createToken(username, role_cd = 'USER') {
  const payload = JSON.stringify({
    sub: username,
    role: role_cd === 'ADMIN' ? 'ADMIN' : 'USER',
    exp: Date.now() + TOKEN_TTL_MS,
  })
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

/** @returns {{ username: string, role_cd: string } | null} */
export function verifyToken(token) {
  if (!token?.trim()) return null

  const [payloadPart, signature] = token.split('.')
  if (!payloadPart || !signature) return null

  let payload
  try {
    payload = Buffer.from(payloadPart, 'base64url').toString('utf8')
  } catch {
    return null
  }

  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('base64url')

  if (signature !== expected) return null

  try {
    const data = JSON.parse(payload)
    if (!data.sub || data.exp < Date.now()) return null
    return {
      username: data.sub,
      role_cd: data.role === 'ADMIN' ? 'ADMIN' : 'USER',
    }
  } catch {
    return null
  }
}
