import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/domain-groups
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM meta_domain_group_m ORDER BY domain_group_nm ASC`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/domain-groups
router.post('/', async (req, res) => {
  try {
    const { domain_group_nm, domain_group_desc, use_yn = 'Y' } = req.body
    if (!domain_group_nm?.trim())
      return res.status(400).json({ message: '그룹명(domain_group_nm)은 필수입니다.' })

    const { rows } = await pool.query(
      `INSERT INTO meta_domain_group_m (domain_group_nm, domain_group_desc, use_yn)
       VALUES ($1, $2, $3) RETURNING *`,
      [domain_group_nm.trim(), domain_group_desc ?? null, use_yn]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ message: `그룹명 "${req.body.domain_group_nm}"은 이미 존재합니다.` })
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/domain-groups/:id
router.put('/:id', async (req, res) => {
  try {
    const { domain_group_nm, domain_group_desc, use_yn } = req.body
    if (!domain_group_nm?.trim())
      return res.status(400).json({ message: '그룹명(domain_group_nm)은 필수입니다.' })

    const { rows } = await pool.query(
      `UPDATE meta_domain_group_m
       SET domain_group_nm=$1, domain_group_desc=$2, use_yn=$3
       WHERE domain_group_id=$4 RETURNING *`,
      [domain_group_nm.trim(), domain_group_desc ?? null, use_yn ?? 'Y', req.params.id]
    )
    if (!rows.length)
      return res.status(404).json({ message: '도메인 그룹을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ message: `그룹명 "${req.body.domain_group_nm}"은 이미 존재합니다.` })
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/domain-groups/:id
router.delete('/:id', async (req, res) => {
  try {
    // 해당 그룹을 사용 중인 도메인이 있으면 삭제 불가
    const { rows: used } = await pool.query(
      `SELECT COUNT(*) FROM meta_std_domain_m
       WHERE info_type_nm = (SELECT domain_group_nm FROM meta_domain_group_m WHERE domain_group_id=$1)`,
      [req.params.id]
    )
    if (Number(used[0].count) > 0)
      return res.status(409).json({ message: '해당 그룹을 사용 중인 도메인이 있어 삭제할 수 없습니다.' })

    const { rowCount } = await pool.query(
      `DELETE FROM meta_domain_group_m WHERE domain_group_id=$1`, [req.params.id]
    )
    if (!rowCount)
      return res.status(404).json({ message: '도메인 그룹을 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
