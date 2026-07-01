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
    const { search, use_yn, subject_id, info_type, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(d.domain_nm ILIKE $${params.length} OR d.infotype ILIKE $${params.length} OR d.data_type ILIKE $${params.length})`)
    }
    if (info_type)  { params.push(info_type);  conditions.push(`d.info_type = $${params.length}`) }
    if (use_yn)     { params.push(use_yn);     conditions.push(`d.use_yn = $${params.length}`) }
    if (subject_id) { params.push(subject_id); conditions.push(`d.subject_id = $${params.length}`) }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM domains d ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT d.*, s.subject_name
       FROM domains d
       LEFT JOIN subject_area s ON s.subject_id = d.subject_id
       ${where}
       ORDER BY d.domain_id DESC
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
      `SELECT d.*, s.subject_name FROM domains d LEFT JOIN subject_area s ON s.subject_id = d.subject_id WHERE d.domain_id = $1`,
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
    const { domain_nm, data_type, info_type, domain_div_cd, domain_desc, use_yn = 'Y', infotype } = req.body
    const rawLength = req.body.data_length
    const data_scale = req.body.data_scale

    if (!info_type) return res.status(400).json({ message: '정보유형(info_type)은 필수입니다.' })
    if (!domain_nm) return res.status(400).json({ message: '도메인명(domain_nm)은 필수입니다.' })
    if (!data_type) return res.status(400).json({ message: '데이터타입(data_type)은 필수입니다.' })

    let data_length
    try {
      data_length = normalizeDataLength(rawLength, data_type, data_scale)
    } catch (e) {
      return res.status(400).json({ message: e.message })
    }
    const lengthErr = validateDataLength(data_length, data_type, r.data_scale)
    if (lengthErr) return res.status(400).json({ message: lengthErr })

    const { subject_id } = req.body
    const resolvedInfotype = buildInfotype(domain_nm, data_type, data_length) || infotype || null
    const { rows } = await pool.query(
      `INSERT INTO domains (domain_nm, data_type, info_type, domain_div_cd, data_length, domain_desc, use_yn, subject_id, infotype)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [domain_nm, data_type, info_type, domain_div_cd, data_length, domain_desc ?? null, use_yn, subject_id ?? null, resolvedInfotype]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/domains/:id
router.put('/:id', async (req, res) => {
  try {
    const { domain_nm, data_type, info_type, domain_div_cd, domain_desc, use_yn, infotype } = req.body
    const rawLength = req.body.data_length
    const data_scale = req.body.data_scale

    let data_length
    try {
      data_length = normalizeDataLength(rawLength, data_type, data_scale)
    } catch (e) {
      return res.status(400).json({ message: e.message })
    }
    const lengthErr = validateDataLength(data_length, data_type, r.data_scale)
    if (lengthErr) return res.status(400).json({ message: lengthErr })

    const { subject_id } = req.body
    const resolvedInfotype = buildInfotype(domain_nm, data_type, data_length) || infotype || null
    const { rows } = await pool.query(
      `UPDATE domains
       SET domain_nm=$1, data_type=$2, info_type=$3, domain_div_cd=$4,
           data_length=$5, domain_desc=$6, use_yn=$7, subject_id=$8, infotype=$9
       WHERE domain_id=$10 RETURNING *`,
      [domain_nm, data_type, info_type, domain_div_cd, data_length, domain_desc ?? null, use_yn ?? 'Y', subject_id ?? null, resolvedInfotype, req.params.id]
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
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM terms WHERE domain_id IS NOT NULL')
    if (rows[0].cnt > 0) {
      return res.status(409).json({
        message: '표준 용어에서 사용 중인 도메인이 있습니다. 용어를 먼저 삭제한 후 표준 도메인을 전체 삭제하세요.',
      })
    }
    const { rowCount } = await pool.query('DELETE FROM domains')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/domains/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows: domainRows } = await pool.query(
      'SELECT domain_id, domain_nm, infotype FROM domains WHERE domain_id = $1',
      [req.params.id]
    )
    if (!domainRows.length) return res.status(404).json({ message: '도메인을 찾을 수 없습니다.' })

    const domain = domainRows[0]
    const { rows: usedTerms } = await pool.query(
      `SELECT term_id, logical_term FROM terms WHERE domain_id = $1 ORDER BY term_id LIMIT 10`,
      [req.params.id]
    )
    if (usedTerms.length > 0) {
      const preview = usedTerms.slice(0, 3).map((t) => `"${t.logical_term}"`).join(', ')
      const suffix  = usedTerms.length > 3 ? ` 외 ${usedTerms.length - 3}건` : ''
      const label   = domain.infotype || domain.domain_nm
      return res.status(409).json({
        message: `표준 용어 ${preview}${suffix}에서 "${label}" 도메인을 사용 중입니다. 해당 용어를 먼저 삭제한 후 표준 도메인을 삭제하세요.`,
      })
    }

    const { rowCount } = await pool.query('DELETE FROM domains WHERE domain_id = $1', [req.params.id])
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
        const domain_nm   = r.domain_nm?.trim()
        const info_type   = r.info_type?.trim()
        const data_type   = (r.data_type?.trim().toUpperCase()) || 'VARCHAR'
        const merged = mergeLegacyLengthScale(r.data_length, r.data_scale, data_type)
        const data_length = normalizeDataLengthInput(merged ?? r.data_length, data_type)
        const subject_id  = r.subject_id?.trim() || 'STD01'
        const use_yn      = r.use_yn?.trim().toUpperCase() || 'Y'
        const domain_desc = r.domain_desc?.trim() || null

        if (!info_type) throw new Error('도메인 그룹명은 필수입니다.')
        if (!domain_nm) throw new Error('도메인명은 필수입니다.')

        const lengthErr = validateDataLength(data_length, data_type, r.data_scale)
        if (lengthErr) throw new Error(lengthErr)

        await client.query(
          `INSERT INTO domain_groups (group_nm, use_yn) VALUES ($1, 'Y') ON CONFLICT (group_nm) DO NOTHING`,
          [info_type]
        )

        const infotype = buildInfotype(domain_nm, data_type, data_length)

        await client.query(
          `INSERT INTO domains
             (domain_nm, data_type, info_type, domain_div_cd, data_length,
              domain_desc, use_yn, subject_id, infotype)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [domain_nm, data_type, info_type, '', data_length, domain_desc, use_yn, subject_id, infotype]
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({ row: rowNum, domain_nm })
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
