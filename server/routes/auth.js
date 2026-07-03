import { Router } from 'express'
import { createToken, verifyCredentials } from '../authToken.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/login', (req, res) => {
  const username = req.body?.username?.trim()
  const password = req.body?.password ?? ''

  if (!username || !password) {
    return res.status(400).json({ message: '사용자명과 비밀번호를 입력하세요.' })
  }

  if (!verifyCredentials(username, password)) {
    return res.status(401).json({ message: '사용자명 또는 비밀번호가 올바르지 않습니다.' })
  }

  res.json({
    token: createToken(username),
    username,
  })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username })
})

export default router
