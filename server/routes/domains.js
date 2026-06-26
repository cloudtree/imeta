import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/domains
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(domain_nm ILIKE $${params.length} OR domain_div_cd ILIKE $${params.length})`)
    }
    if (use_yn) {
      params.push(use_yn)
      conditions.push(`use_yn = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM domains ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT * FROM domains ${where} ORDER BY domain_id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/domains/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM domains WHERE domain_id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/domains
router.post('/', async (req, res) => {
  try {
    const { domain_nm, data_type, info_type, domain_div_cd, data_length, data_scale, domain_desc, use_yn = 'Y' } = req.body

    if (!domain_nm)     return res.status(400).json({ message: '도메인명(domain_nm)은 필수입니다.' })
    if (!data_type)     return res.status(400).json({ message: '데이터타입(data_type)은 필수입니다.' })
    if (!info_type)     return res.status(400).json({ message: '정보유형(info_type)은 필수입니다.' })
    if (!domain_div_cd) return res.status(400).json({ message: '도메인구분코드(domain_div_cd)는 필수입니다.' })

    const { rows } = await pool.query(
      `INSERT INTO domains (domain_nm, data_type, info_type, domain_div_cd, data_length, data_scale, domain_desc, use_yn)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [domain_nm, data_type, info_type, domain_div_cd, data_length ?? null, data_scale ?? null, domain_desc ?? null, use_yn]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/domains/:id
router.put('/:id', async (req, res) => {
  try {
    const { domain_nm, data_type, info_type, domain_div_cd, data_length, data_scale, domain_desc, use_yn } = req.body

    const { rows } = await pool.query(
      `UPDATE domains
       SET domain_nm=$1, data_type=$2, info_type=$3, domain_div_cd=$4,
           data_length=$5, data_scale=$6, domain_desc=$7, use_yn=$8
       WHERE domain_id=$9 RETURNING *`,
      [domain_nm, data_type, info_type, domain_div_cd, data_length ?? null, data_scale ?? null, domain_desc ?? null, use_yn ?? 'Y', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/domains/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM domains WHERE domain_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
