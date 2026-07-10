import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const OBJECT_SELECT = `
  o.data_object_id, o.data_object_cd, o.data_object_nm, o.physical_nm, o.object_type_nm,
  o.subject_area_id, o.owner_nm, o.data_object_desc, o.use_yn, o.reg_dtm, o.upd_dtm,
  s.subject_area_nm
`

const OBJECT_TYPES = new Set(['TABLE', 'VIEW', 'COLUMN', 'FILE', 'API', 'OTHER'])

function normalizeType(v) {
  const t = String(v ?? 'TABLE').trim().toUpperCase()
  return OBJECT_TYPES.has(t) ? t : null
}

function normalizeYn(v, fallback = 'Y') {
  const y = String(v ?? fallback).trim().toUpperCase()
  return y === 'N' ? 'N' : 'Y'
}

function validatePayload(body) {
  const data_object_cd = body.data_object_cd?.trim()
  const data_object_nm = body.data_object_nm?.trim()
  const physical_nm = body.physical_nm?.trim() || null
  const object_type_nm = normalizeType(body.object_type_nm)
  const subject_area_id = body.subject_area_id?.trim() || null
  const owner_nm = body.owner_nm?.trim() || null
  const data_object_desc = body.data_object_desc?.trim() || null
  const use_yn = normalizeYn(body.use_yn)

  if (!data_object_cd) return { error: '객체 코드를 입력하세요.' }
  if (data_object_cd.length > 50) return { error: '객체 코드는 최대 50자입니다.' }
  if (!/^[A-Za-z0-9._-]+$/.test(data_object_cd)) {
    return { error: '객체 코드는 영문, 숫자, . _ - 만 사용할 수 있습니다.' }
  }
  if (!data_object_nm) return { error: '객체명을 입력하세요.' }
  if (!object_type_nm) {
    return { error: '객체 유형은 TABLE, VIEW, COLUMN, FILE, API, OTHER 중 하나여야 합니다.' }
  }

  return {
    data: {
      data_object_cd,
      data_object_nm,
      physical_nm,
      object_type_nm,
      subject_area_id,
      owner_nm,
      data_object_desc,
      use_yn,
    },
  }
}

router.get('/', async (req, res) => {
  try {
    const { search, use_yn, object_type_nm, subject_area_id, page = 1, limit = 50 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(o.data_object_cd ILIKE $${n} OR o.data_object_nm ILIKE $${n} OR COALESCE(o.physical_nm, '') ILIKE $${n} OR COALESCE(o.owner_nm, '') ILIKE $${n})`,
      )
    }
    if (use_yn) {
      params.push(normalizeYn(use_yn))
      conditions.push(`o.use_yn = $${params.length}`)
    }
    if (object_type_nm) {
      const t = normalizeType(object_type_nm)
      if (t) {
        params.push(t)
        conditions.push(`o.object_type_nm = $${params.length}`)
      }
    }
    if (subject_area_id) {
      params.push(subject_area_id)
      conditions.push(`o.subject_area_id = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM meta_data_object_m o ${where}`,
      params,
    )
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT ${OBJECT_SELECT}
       FROM meta_data_object_m o
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = o.subject_area_id
       ${where}
       ORDER BY o.data_object_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

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
      const savepoint = `sp_obj_${i}`
      await client.query(`SAVEPOINT ${savepoint}`)

      try {
        const { error, data } = validatePayload(r)
        if (error) throw new Error(error)

        const { rows: inserted } = await client.query(
          `INSERT INTO meta_data_object_m
             (data_object_cd, data_object_nm, physical_nm, object_type_nm, subject_area_id, owner_nm, data_object_desc, use_yn)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING data_object_id, data_object_cd, data_object_nm, physical_nm, object_type_nm,
                     subject_area_id, owner_nm, data_object_desc, use_yn, reg_dtm, upd_dtm`,
          [
            data.data_object_cd,
            data.data_object_nm,
            data.physical_nm,
            data.object_type_nm,
            data.subject_area_id,
            data.owner_nm,
            data.data_object_desc,
            data.use_yn,
          ],
        )
        success.push(inserted[0])
      } catch (e) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        const message = e.code === '23505'
          ? `객체 코드 "${r.data_object_cd?.trim()}"는 이미 등록되어 있습니다.`
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

router.delete('/all', async (_req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM meta_data_object_m')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${OBJECT_SELECT}
       FROM meta_data_object_m o
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = o.subject_area_id
       WHERE o.data_object_id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ message: '데이터 객체를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { error, data } = validatePayload(req.body)
    if (error) return res.status(400).json({ message: error })

    const { rows } = await pool.query(
      `INSERT INTO meta_data_object_m
         (data_object_cd, data_object_nm, physical_nm, object_type_nm, subject_area_id, owner_nm, data_object_desc, use_yn)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING data_object_id, data_object_cd, data_object_nm, physical_nm, object_type_nm,
                 subject_area_id, owner_nm, data_object_desc, use_yn, reg_dtm, upd_dtm`,
      [
        data.data_object_cd,
        data.data_object_nm,
        data.physical_nm,
        data.object_type_nm,
        data.subject_area_id,
        data.owner_nm,
        data.data_object_desc,
        data.use_yn,
      ],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message: `객체 코드 "${req.body?.data_object_cd?.trim()}"는 이미 등록되어 있습니다.`,
      })
    }
    res.status(500).json({ message: err.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const { error, data } = validatePayload(req.body)
    if (error) return res.status(400).json({ message: error })

    const { rows } = await pool.query(
      `UPDATE meta_data_object_m SET
         data_object_cd = $1, data_object_nm = $2, physical_nm = $3, object_type_nm = $4,
         subject_area_id = $5, owner_nm = $6, data_object_desc = $7, use_yn = $8, upd_dtm = NOW()
       WHERE data_object_id = $9
       RETURNING data_object_id, data_object_cd, data_object_nm, physical_nm, object_type_nm,
                 subject_area_id, owner_nm, data_object_desc, use_yn, reg_dtm, upd_dtm`,
      [
        data.data_object_cd,
        data.data_object_nm,
        data.physical_nm,
        data.object_type_nm,
        data.subject_area_id,
        data.owner_nm,
        data.data_object_desc,
        data.use_yn,
        req.params.id,
      ],
    )
    if (!rows[0]) return res.status(404).json({ message: '데이터 객체를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message: `객체 코드 "${req.body?.data_object_cd?.trim()}"는 이미 등록되어 있습니다.`,
      })
    }
    res.status(500).json({ message: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM meta_data_object_m WHERE data_object_id = $1',
      [req.params.id],
    )
    if (!rowCount) return res.status(404).json({ message: '데이터 객체를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
