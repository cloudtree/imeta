import crypto from 'crypto'

const AUTH_USERNAME = process.env.AUTH_USERNAME?.trim() || 'cloudtree'
const AUTH_PASSWORD = process.env.AUTH_PASSWORD ?? 'americano'
const AUTH_SECRET = process.env.AUTH_SECRET?.trim() || 'meta-auth-secret-change-in-production'
const TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS ?? 24 * 60 * 60 * 1000)

export function verifyCredentials(username, password) {
  return username?.trim() === AUTH_USERNAME && password === AUTH_PASSWORD
}

export function createToken(username) {
  const payload = JSON.stringify({
    sub: username,
    exp: Date.now() + TOKEN_TTL_MS,
  })
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payload)
    .digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${signature}`
}

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
    return data.sub
  } catch {
    return null
  }
}
