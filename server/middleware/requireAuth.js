import { verifyToken } from '../authToken.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null
  const user = verifyToken(token)

  if (!user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' })
  }

  req.user = user
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user?.role_cd !== 'ADMIN') {
    return res.status(403).json({ message: '관리자 권한이 필요합니다.' })
  }
  next()
}
