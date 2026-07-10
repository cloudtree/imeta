import { Router } from 'express'
import { pool } from '../db.js'
import {
  buildInfotype,
  mergeLegacyLengthScale,
  normalizeDataLengthInput,
  validateDataLength as checkDataLengthFormat,
  LENGTH_TYPES,
} from './_dataLength.js'

const router = Router()

function validateDataLength(value, dataType, data_scale) {
  const dt = dataType?.toUpperCase()
  const v  = normalizeDataLengthInput(value, dataType, data_scale)
  if (!LENGTH_TYPES.includes(dt)) return null
  if (!v) return '데이터 길이를 입력하세요.'
  return checkDataLengthFormat(v, dataType)
}

function normalizeDataLength(value, dataType, data_scale) {
  const err = validateDataLength(value, dataType, data_scale)
  if (err) throw new Error(err)
  const v = normalizeDataLengthInput(value, dataType, data_scale)
  return v || null
}

// GET /api/domains
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, subject_area_id, system_id, unassigned, info_type_nm, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(d.std_domain_nm ILIKE $${params.length} OR d.info_type_nm ILIKE $${params.length} OR d.data_type_nm ILIKE $${params.length} OR d.domain_group_nm ILIKE $${params.length})`)
    }
    if (info_type_nm)     { params.push(info_type_nm);     conditions.push(`d.info_type_nm = $${params.length}`) }
    if (req.query.domain_group_nm) {
      params.push(req.query.domain_group_nm)
      conditions.push(`d.domain_group_nm = $${params.length}`)
    }
    if (use_yn)           { params.push(use_yn);           conditions.push(`d.use_yn = $${params.length}`) }
    if (subject_area_id)  { params.push(subject_area_id);  conditions.push(`d.subject_area_id = $${params.length}`) }
    if (system_id) {
      params.push(Number(system_id))
      conditions.push(`s.system_id = $${params.length}`)
    }
    if (unassigned === 'Y') {
      conditions.push(`d.subject_area_id IS NOT NULL AND s.system_id IS NULL`)
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)
    const fromJoin = `
       FROM meta_std_domain_m d
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = d.subject_area_id
    `

    const countResult = await pool.query(`SELECT COUNT(*) ${fromJoin} ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT d.*, s.subject_area_nm, s.system_nm, s.system_id
       ${fromJoin}
       ${where}
       ORDER BY d.std_domain_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
    const { rows } = await pool.query(
      `SELECT d.*, s.subject_area_nm
       FROM meta_std_domain_m d
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = d.subject_area_id
       WHERE d.std_domain_id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/domains
router.post('/', async (req, res) => {
  try {
    const { std_domain_nm, data_type_nm, domain_group_nm, std_domain_desc, use_yn = 'Y' } = req.body
    const rawLength = req.body.data_len
    const data_scale = req.body.data_scale

    if (!domain_group_nm) return res.status(400).json({ message: '도메인 그룹명(domain_group_nm)은 필수입니다.' })
    if (!std_domain_nm) return res.status(400).json({ message: '도메인명(std_domain_nm)은 필수입니다.' })
    if (!data_type_nm) return res.status(400).json({ message: '데이터타입(data_type_nm)은 필수입니다.' })

    let data_len
    try {
      data_len = normalizeDataLength(rawLength, data_type_nm, data_scale)
    } catch (e) {
      return res.status(400).json({ message: e.message })
    }
    const lengthErr = validateDataLength(data_len, data_type_nm, data_scale)
    if (lengthErr) return res.status(400).json({ message: lengthErr })

    const { subject_area_id } = req.body
    const info_type_nm = buildInfotype(std_domain_nm, data_type_nm, data_len) || req.body.info_type_nm || null
    const { rows } = await pool.query(
      `INSERT INTO meta_std_domain_m (std_domain_nm, data_type_nm, info_type_nm, domain_group_nm, data_len, std_domain_desc, use_yn, subject_area_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [std_domain_nm, data_type_nm, info_type_nm, domain_group_nm, data_len, std_domain_desc ?? null, use_yn, subject_area_id ?? null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/domains/:id
router.put('/:id', async (req, res) => {
  try {
    const { std_domain_nm, data_type_nm, domain_group_nm, std_domain_desc, use_yn } = req.body
    const rawLength = req.body.data_len
    const data_scale = req.body.data_scale

    let data_len
    try {
      data_len = normalizeDataLength(rawLength, data_type_nm, data_scale)
    } catch (e) {
      return res.status(400).json({ message: e.message })
    }
    const lengthErr = validateDataLength(data_len, data_type_nm, data_scale)
    if (lengthErr) return res.status(400).json({ message: lengthErr })

    const { subject_area_id } = req.body
    const info_type_nm = buildInfotype(std_domain_nm, data_type_nm, data_len) || req.body.info_type_nm || null
    const { rows } = await pool.query(
      `UPDATE meta_std_domain_m
       SET std_domain_nm=$1, data_type_nm=$2, info_type_nm=$3, domain_group_nm=$4,
           data_len=$5, std_domain_desc=$6, use_yn=$7, subject_area_id=$8
       WHERE std_domain_id=$9 RETURNING *`,
      [std_domain_nm, data_type_nm, info_type_nm, domain_group_nm, data_len, std_domain_desc ?? null, use_yn ?? 'Y', subject_area_id ?? null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/domains/all — 전체 삭제 (/:id 보다 먼저 등록)
router.delete('/all', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM meta_std_term_m WHERE std_domain_id IS NOT NULL')
    if (rows[0].cnt > 0) {
      return res.status(409).json({
        message: '표준 용어에서 사용 중인 도메인이 있습니다. 용어를 먼저 삭제한 후 표준 도메인을 전체 삭제하세요.',
      })
    }
    const { rowCount } = await pool.query('DELETE FROM meta_std_domain_m')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/domains/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows: domainRows } = await pool.query(
      'SELECT std_domain_id, std_domain_nm, info_type_nm FROM meta_std_domain_m WHERE std_domain_id = $1',
      [req.params.id]
    )
    if (!domainRows.length) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })

    const domain = domainRows[0]
    const { rows: usedTerms } = await pool.query(
      `SELECT std_term_id, logical_term_nm FROM meta_std_term_m WHERE std_domain_id = $1 ORDER BY std_term_id LIMIT 10`,
      [req.params.id]
    )
    if (usedTerms.length > 0) {
      const preview = usedTerms.slice(0, 3).map((t) => `"${t.logical_term_nm}"`).join(', ')
      const suffix  = usedTerms.length > 3 ? ` 외 ${usedTerms.length - 3}건` : ''
      const label   = domain.info_type_nm || domain.std_domain_nm
      return res.status(409).json({
        message: `표준 용어 ${preview}${suffix}에서 "${label}" 도메인을 사용 중입니다. 해당 용어를 먼저 삭제한 후 표준 도메인을 삭제하세요.`,
      })
    }

    const { rowCount } = await pool.query('DELETE FROM meta_std_domain_m WHERE std_domain_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/domains/bulk
router.post('/bulk', async (req, res) => {
  const rows = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: '등록할 데이터가 없습니다.' })

  const success = []
  const errors  = []
  const client  = await pool.connect()

  try {
    await client.query('BEGIN')

    for (let i = 0; i < rows.length; i++) {
      const r         = rows[i]
      const rowNum    = i + 2
      const savepoint = `sp_row_${i}`

      await client.query(`SAVEPOINT ${savepoint}`)
      try {
        const std_domain_nm = r.std_domain_nm?.trim()
        const domain_group_nm = r.domain_group_nm?.trim()
        const data_type_nm  = (r.data_type_nm?.trim().toUpperCase()) || 'VARCHAR'
        const merged = mergeLegacyLengthScale(r.data_len, r.data_scale, data_type_nm)
        const data_len = normalizeDataLengthInput(merged ?? r.data_len, data_type_nm)
        const subject_area_id = r.subject_area_id?.trim() || 'STD01'
        const use_yn = r.use_yn?.trim().toUpperCase() || 'Y'
        const std_domain_desc = r.std_domain_desc?.trim() || null

        if (!domain_group_nm) throw new Error('도메인 그룹명은 필수입니다.')
        if (!std_domain_nm) throw new Error('도메인명은 필수입니다.')

        const lengthErr = validateDataLength(data_len, data_type_nm, r.data_scale)
        if (lengthErr) throw new Error(lengthErr)

        await client.query(
          `INSERT INTO meta_domain_group_m (domain_group_nm, use_yn) VALUES ($1, 'Y') ON CONFLICT (domain_group_nm) DO NOTHING`,
          [domain_group_nm]
        )

        const info_type_nm = buildInfotype(std_domain_nm, data_type_nm, data_len)

        await client.query(
          `INSERT INTO meta_std_domain_m
             (std_domain_nm, data_type_nm, info_type_nm, domain_group_nm, data_len,
              std_domain_desc, use_yn, subject_area_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [std_domain_nm, data_type_nm, info_type_nm, domain_group_nm, data_len, std_domain_desc, use_yn, subject_area_id]
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({ row: rowNum, std_domain_nm })
      } catch (rowErr) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        errors.push({ row: rowNum, data: r, message: rowErr.message })
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }

  res.json({ success, errors })
})

export default router
