import { Router } from 'express'
import { createToken, verifyCredentials } from '../authToken.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()

router.post('/login', async (req, res) => {
  const login_id = req.body?.login_id?.trim()
  const password = req.body?.password ?? ''

  if (!login_id || !password) {
    return res.status(400).json({ message: '사용자명과 비밀번호를 입력하세요.' })
  }

  try {
    const user = await verifyCredentials(login_id, password)
    if (!user) {
      return res.status(401).json({ message: '사용자명 또는 비밀번호가 올바르지 않습니다.' })
    }

    res.json({
      token: createToken(user.login_id, user.role_cd),
      login_id: user.login_id,
      role_cd: user.role_cd,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message || '로그인 처리 중 오류가 발생했습니다.' })
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({
    login_id: req.user.login_id,
    role_cd: req.user.role_cd,
  })
})

export default router
