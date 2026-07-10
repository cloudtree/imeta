import { Router } from 'express'
import { pool } from '../db.js'
import { hashPassword } from '../userPassword.js'

const router = Router()

const USER_SELECT = `
  user_id, login_id, user_nm, email_nm, dept_nm, role_cd, use_yn, reg_dtm, upd_dtm
`

function normalizeRole(v) {
  const r = String(v ?? 'USER').trim().toUpperCase()
  return r === 'ADMIN' ? 'ADMIN' : 'USER'
}

function normalizeYn(v, fallback = 'Y') {
  const y = String(v ?? fallback).trim().toUpperCase()
  return y === 'N' ? 'N' : 'Y'
}

function validateUserPayload(body, { requirePassword = true } = {}) {
  const login_id = body.login_id?.trim()
  const password = body.password ?? ''
  const user_nm = body.user_nm?.trim() ?? ''
  const email_nm = body.email_nm?.trim() || null
  const dept_nm = body.dept_nm?.trim() || null
  const role_cd = normalizeRole(body.role_cd)
  const use_yn = normalizeYn(body.use_yn)

  if (!login_id) return { error: '사용자 ID를 입력하세요.' }
  if (login_id.length > 50) return { error: '사용자 ID는 최대 50자입니다.' }
  if (!/^[A-Za-z0-9._@-]+$/.test(login_id)) {
    return { error: '사용자 ID는 영문, 숫자, . _ @ - 만 사용할 수 있습니다.' }
  }
  if (!user_nm) return { error: '사용자명을 입력하세요.' }
  if (requirePassword) {
    if (!password) return { error: '비밀번호를 입력하세요.' }
    if (String(password).length < 4) return { error: '비밀번호는 4자 이상이어야 합니다.' }
  } else if (password && String(password).length < 4) {
    return { error: '비밀번호는 4자 이상이어야 합니다.' }
  }
  if (email_nm && email_nm.length > 200) return { error: '이메일은 최대 200자입니다.' }

  return {
    data: {
      login_id,
      password: password || null,
      user_nm,
      email_nm,
      dept_nm,
      role_cd,
      use_yn,
    },
  }
}

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, role_cd, page = 1, limit = 50 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(login_id ILIKE $${n} OR user_nm ILIKE $${n} OR COALESCE(email_nm, '') ILIKE $${n} OR COALESCE(dept_nm, '') ILIKE $${n})`,
      )
    }
    if (use_yn) {
      params.push(normalizeYn(use_yn))
      conditions.push(`use_yn = $${params.length}`)
    }
    if (role_cd) {
      params.push(normalizeRole(role_cd))
      conditions.push(`role_cd = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM meta_user_m ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT ${USER_SELECT}
       FROM meta_user_m
       ${where}
       ORDER BY user_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users/bulk
router.post('/bulk', async (req, res) => {
  const rows = req.body
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: '등록할 데이터가 없습니다.' })
  }

  const success = []
  const errors = []
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rowNum = Number(r.__rowNum) || (i + 2)
      const savepoint = `sp_user_${i}`
      await client.query(`SAVEPOINT ${savepoint}`)

      try {
        const { error, data } = validateUserPayload(r, { requirePassword: true })
        if (error) throw new Error(error)

        const password_hash = await hashPassword(data.password)
        const { rows: inserted } = await client.query(
          `INSERT INTO meta_user_m
             (login_id, password_hash, user_nm, email_nm, dept_nm, role_cd, use_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING ${USER_SELECT}`,
          [
            data.login_id,
            password_hash,
            data.user_nm,
            data.email_nm,
            data.dept_nm,
            data.role_cd,
            data.use_yn,
          ],
        )
        success.push(inserted[0])
      } catch (e) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        const message = e.code === '23505'
          ? `사용자 ID "${r.login_id?.trim()}"는 이미 등록되어 있습니다.`
          : e.message
        errors.push({ row: rowNum, data: r, message })
      }
    }

    await client.query('COMMIT')
    res.json({ success, errors })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }
})

// DELETE /api/users/all
router.delete('/all', async (_req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM meta_user_m')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${USER_SELECT} FROM meta_user_m WHERE user_id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { error, data } = validateUserPayload(req.body, { requirePassword: true })
    if (error) return res.status(400).json({ message: error })

    const password_hash = await hashPassword(data.password)
    const { rows } = await pool.query(
      `INSERT INTO meta_user_m
         (login_id, password_hash, user_nm, email_nm, dept_nm, role_cd, use_yn)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${USER_SELECT}`,
      [
        data.login_id,
        password_hash,
        data.user_nm,
        data.email_nm,
        data.dept_nm,
        data.role_cd,
        data.use_yn,
      ],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `사용자 ID "${req.body?.login_id?.trim()}"는 이미 등록되어 있습니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { error, data } = validateUserPayload(req.body, { requirePassword: false })
    if (error) return res.status(400).json({ message: error })

    const existing = await pool.query(
      'SELECT user_id FROM meta_user_m WHERE user_id = $1',
      [req.params.id],
    )
    if (!existing.rows[0]) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    let rows
    if (data.password) {
      const password_hash = await hashPassword(data.password)
      ;({ rows } = await pool.query(
        `UPDATE meta_user_m SET
           login_id = $1, password_hash = $2, user_nm = $3, email_nm = $4,
           dept_nm = $5, role_cd = $6, use_yn = $7, upd_dtm = NOW()
         WHERE user_id = $8
         RETURNING ${USER_SELECT}`,
        [
          data.login_id,
          password_hash,
          data.user_nm,
          data.email_nm,
          data.dept_nm,
          data.role_cd,
          data.use_yn,
          req.params.id,
        ],
      ))
    } else {
      ;({ rows } = await pool.query(
        `UPDATE meta_user_m SET
           login_id = $1, user_nm = $2, email_nm = $3,
           dept_nm = $4, role_cd = $5, use_yn = $6, upd_dtm = NOW()
         WHERE user_id = $7
         RETURNING ${USER_SELECT}`,
        [
          data.login_id,
          data.user_nm,
          data.email_nm,
          data.dept_nm,
          data.role_cd,
          data.use_yn,
          req.params.id,
        ],
      ))
    }

    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `사용자 ID "${req.body?.login_id?.trim()}"는 이미 등록되어 있습니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM meta_user_m WHERE user_id = $1',
      [req.params.id],
    )
    if (!rowCount) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
