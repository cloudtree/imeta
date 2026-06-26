import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/terms
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(t.logical_term ILIKE $${params.length} OR t.physical_term ILIKE $${params.length})`)
    }
    if (use_yn) {
      params.push(use_yn)
      conditions.push(`t.use_yn = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM terms t ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT t.*, d.domain_nm
       FROM terms t
       LEFT JOIN domains d ON d.domain_id = t.domain_id
       ${where}
       ORDER BY t.term_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/terms/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, d.domain_nm FROM terms t LEFT JOIN domains d ON d.domain_id = t.domain_id WHERE t.term_id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/terms
router.post('/', async (req, res) => {
  try {
    const { logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, term_desc, use_yn = 'Y' } = req.body

    if (!logical_term)  return res.status(400).json({ message: '논리명(logical_term)은 필수입니다.' })
    if (!physical_term) return res.status(400).json({ message: '물리명(physical_term)은 필수입니다.' })
    if (!domain_div_cd) return res.status(400).json({ message: '도메인구분코드(domain_div_cd)는 필수입니다.' })
    if (!data_type)     return res.status(400).json({ message: '데이터타입(data_type)은 필수입니다.' })
    if (!data_len)      return res.status(400).json({ message: '데이터길이(data_len)는 필수입니다.' })

    const { rows } = await pool.query(
      `INSERT INTO terms (logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, term_desc, use_yn)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [logical_term, physical_term, domain_div_cd, domain_id ?? null, data_type, data_len, term_desc ?? null, use_yn]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/terms/:id
router.put('/:id', async (req, res) => {
  try {
    const { logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, term_desc, use_yn } = req.body

    const { rows } = await pool.query(
      `UPDATE terms
       SET logical_term=$1, physical_term=$2, domain_div_cd=$3, domain_id=$4,
           data_type=$5, data_len=$6, term_desc=$7, use_yn=$8
       WHERE term_id=$9 RETURNING *`,
      [logical_term, physical_term, domain_div_cd, domain_id ?? null, data_type, data_len, term_desc ?? null, use_yn ?? 'Y', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/terms/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM terms WHERE term_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
