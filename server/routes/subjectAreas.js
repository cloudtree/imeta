import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const SUBJECT_SELECT = `
  s.*,
  COALESCE(s.system_nm, ms.system_nm) AS system_nm,
  COALESCE(s.system_id, ms.system_id) AS system_id,
  ms.system_cd,
  (SELECT COUNT(*) FROM meta_std_word_m   w WHERE w.subject_area_id = s.subject_area_id) AS word_count,
  (SELECT COUNT(*) FROM meta_std_term_m   t WHERE t.subject_area_id = s.subject_area_id) AS term_count,
  (SELECT COUNT(*) FROM meta_std_domain_m d WHERE d.subject_area_id = s.subject_area_id) AS domain_count,
  (
    SELECT COUNT(DISTINCT td.schema_nm || '|' || td.db_type_nm || '|' || td.table_nm)::int
    FROM meta_table_def_m td
    WHERE td.use_yn = 'Y'
      AND (
        EXISTS (
          SELECT 1 FROM meta_std_domain_m d
          WHERE d.subject_area_id = s.subject_area_id
            AND d.std_domain_nm IS NOT NULL
            AND d.std_domain_nm <> ''
            AND d.std_domain_nm = td.domain_nm
        )
        OR EXISTS (
          SELECT 1 FROM meta_std_term_m t
          WHERE t.subject_area_id = s.subject_area_id
            AND (
              (t.logical_term_nm IS NOT NULL AND t.logical_term_nm <> '' AND t.logical_term_nm = td.attribute_nm)
              OR (t.physical_term_nm IS NOT NULL AND t.physical_term_nm <> ''
                  AND UPPER(t.physical_term_nm) = UPPER(td.column_nm))
            )
        )
      )
  ) AS table_count,
  (
    SELECT COUNT(*)::int
    FROM meta_table_def_m td
    WHERE td.use_yn = 'Y'
      AND (
        EXISTS (
          SELECT 1 FROM meta_std_domain_m d
          WHERE d.subject_area_id = s.subject_area_id
            AND d.std_domain_nm IS NOT NULL
            AND d.std_domain_nm <> ''
            AND d.std_domain_nm = td.domain_nm
        )
        OR EXISTS (
          SELECT 1 FROM meta_std_term_m t
          WHERE t.subject_area_id = s.subject_area_id
            AND (
              (t.logical_term_nm IS NOT NULL AND t.logical_term_nm <> '' AND t.logical_term_nm = td.attribute_nm)
              OR (t.physical_term_nm IS NOT NULL AND t.physical_term_nm <> ''
                  AND UPPER(t.physical_term_nm) = UPPER(td.column_nm))
            )
        )
      )
  ) AS column_count
`

async function resolveSystemFields(body, { required = true } = {}) {
  const system_id = body.system_id != null && body.system_id !== ''
    ? Number(body.system_id)
    : null

  if (!system_id || !Number.isFinite(system_id)) {
    if (required) {
      const err = new Error('시스템을 선택하세요.')
      err.status = 400
      throw err
    }
    return { system_id: null, system_nm: null }
  }

  const { rows } = await pool.query(
    `SELECT system_id, system_nm FROM meta_system_m WHERE system_id = $1`,
    [system_id],
  )
  if (!rows[0]) {
    const err = new Error('선택한 시스템을 찾을 수 없습니다.')
    err.status = 400
    throw err
  }

  return { system_id: rows[0].system_id, system_nm: rows[0].system_nm }
}

// GET /api/subject-areas
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, system_id, system_nm, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(s.subject_area_id ILIKE $${n} OR s.subject_area_nm ILIKE $${n} OR COALESCE(s.system_nm, ms.system_nm, '') ILIKE $${n})`,
      )
    }
    if (use_yn) {
      params.push(use_yn)
      conditions.push(`s.use_yn = $${params.length}`)
    }
    if (system_id) {
      params.push(Number(system_id))
      conditions.push(`s.system_id = $${params.length}`)
    }
    if (system_nm) {
      params.push(system_nm)
      conditions.push(`COALESCE(s.system_nm, ms.system_nm) = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(
      `SELECT COUNT(*)
       FROM meta_subject_area_m s
       LEFT JOIN meta_system_m ms ON ms.system_id = s.system_id
       ${where}`,
      params,
    )
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT ${SUBJECT_SELECT}
       FROM meta_subject_area_m s
       LEFT JOIN meta_system_m ms ON ms.system_id = s.system_id
       ${where}
       ORDER BY COALESCE(s.system_nm, ms.system_nm, '') ASC, s.subject_area_id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/subject-areas/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SUBJECT_SELECT}
       FROM meta_subject_area_m s
       LEFT JOIN meta_system_m ms ON ms.system_id = s.system_id
       WHERE s.subject_area_id = $1`,
      [req.params.id],
    )
    if (!rows.length) return res.status(404).json({ message: '주제영역을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/subject-areas
router.post('/', async (req, res) => {
  try {
    const { subject_area_id, subject_area_nm, subject_area_desc, use_yn = 'Y' } = req.body

    if (!subject_area_id?.trim()) return res.status(400).json({ message: '주제영역 ID(subject_area_id)는 필수입니다.' })
    if (!subject_area_nm?.trim()) return res.status(400).json({ message: '주제영역명(subject_area_nm)은 필수입니다.' })

    const dup = await pool.query('SELECT 1 FROM meta_subject_area_m WHERE subject_area_id = $1', [subject_area_id.trim()])
    if (dup.rows.length) {
      return res.status(409).json({ message: `주제영역 ID "${subject_area_id}"는 이미 존재합니다.` })
    }

    const { system_id, system_nm } = await resolveSystemFields(req.body)

    const { rows } = await pool.query(
      `INSERT INTO meta_subject_area_m (subject_area_id, subject_area_nm, subject_area_desc, use_yn, system_id, system_nm)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [subject_area_id.trim(), subject_area_nm.trim(), subject_area_desc ?? null, use_yn, system_id, system_nm],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message })
    if (err.code === '23505') {
      return res.status(409).json({ message: `주제영역 ID "${req.body.subject_area_id}"는 이미 존재합니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/subject-areas/:id
router.put('/:id', async (req, res) => {
  try {
    const { subject_area_id: new_id, subject_area_nm, subject_area_desc, use_yn } = req.body
    const old_id = req.params.id
    const cascade = req.body.cascade_children === true
      || req.body.cascade_children === 'Y'
      || req.body.cascade_children === 'y'

    if (!subject_area_nm?.trim()) return res.status(400).json({ message: '주제영역명(subject_area_nm)은 필수입니다.' })
    if (!new_id?.trim()) return res.status(400).json({ message: '주제영역 ID(subject_area_id)는 필수입니다.' })

    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM meta_std_word_m   WHERE subject_area_id = $1)::int AS word_count,
         (SELECT COUNT(*) FROM meta_std_term_m   WHERE subject_area_id = $1)::int AS term_count,
         (SELECT COUNT(*) FROM meta_std_domain_m WHERE subject_area_id = $1)::int AS domain_count`,
      [old_id],
    )
    const { word_count, term_count, domain_count } = counts.rows[0]
    const linked = word_count + term_count + domain_count
    const idChanged = new_id.trim() !== old_id

    if (idChanged && linked > 0 && !cascade) {
      return res.status(409).json({
        code: 'CASCADE_REQUIRED',
        message: `하위 데이터가 있어 주제영역 ID를 변경하려면 전체 변경에 동의해야 합니다. (단어 ${word_count}건, 용어 ${term_count}건, 도메인 ${domain_count}건)`,
        counts: { word_count, term_count, domain_count },
      })
    }

    if (idChanged) {
      const dup = await pool.query('SELECT 1 FROM meta_subject_area_m WHERE subject_area_id = $1', [new_id.trim()])
      if (dup.rows.length) {
        return res.status(409).json({ message: `주제영역 ID "${new_id}"는 이미 존재합니다.` })
      }
    }

    const { system_id, system_nm } = await resolveSystemFields(req.body)

    const { rows } = await pool.query(
      `UPDATE meta_subject_area_m
       SET subject_area_id=$1, subject_area_nm=$2, subject_area_desc=$3, use_yn=$4,
           system_id=$5, system_nm=$6
       WHERE subject_area_id=$7 RETURNING *`,
      [
        new_id.trim(),
        subject_area_nm.trim(),
        subject_area_desc ?? null,
        use_yn ?? 'Y',
        system_id,
        system_nm,
        old_id,
      ],
    )
    if (!rows.length) return res.status(404).json({ message: '주제영역을 찾을 수 없습니다.' })

    res.json({
      ...rows[0],
      cascaded: cascade && idChanged,
      counts: { word_count, term_count, domain_count },
    })
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message })
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/subject-areas/:id
router.delete('/:id', async (req, res) => {
  try {
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM meta_std_word_m   WHERE subject_area_id = $1)::int AS word_count,
         (SELECT COUNT(*) FROM meta_std_term_m   WHERE subject_area_id = $1)::int AS term_count,
         (SELECT COUNT(*) FROM meta_std_domain_m WHERE subject_area_id = $1)::int AS domain_count`,
      [req.params.id],
    )
    const { word_count, term_count, domain_count } = counts.rows[0]
    const linked = word_count + term_count + domain_count

    if (linked > 0) {
      return res.status(409).json({
        code: 'HAS_CHILDREN',
        message: `하위 데이터가 있어 삭제할 수 없습니다. (단어 ${word_count}건, 용어 ${term_count}건, 도메인 ${domain_count}건)`,
        counts: { word_count, term_count, domain_count },
      })
    }

    const { rowCount } = await pool.query('DELETE FROM meta_subject_area_m WHERE subject_area_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '주제영역을 찾을 수 없습니다.' })

    res.json({ message: '삭제 완료.' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
