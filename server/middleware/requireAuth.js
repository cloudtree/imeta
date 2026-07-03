import { verifyToken } from '../authToken.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
  const username = verifyToken(token)

  if (!username) {
    return res.status(401).json({ message: '로그인이 필요합니다.' })
  }

  req.user = { username }
  next()
}
