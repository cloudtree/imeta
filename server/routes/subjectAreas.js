import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/subject-areas
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(s.subject_id ILIKE $${params.length} OR s.subject_name ILIKE $${params.length})`)
    }
    if (use_yn) {
      params.push(use_yn)
      conditions.push(`s.use_yn = $${params.length}`)
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM subject_area s ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    // 연결된 단어/용어/도메인 건수 + 정의서 테이블/컬럼 건수(도메인·용어 매칭)
    const dataResult = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM words   w WHERE w.subject_id = s.subject_id) AS word_count,
              (SELECT COUNT(*) FROM terms   t WHERE t.subject_id = s.subject_id) AS term_count,
              (SELECT COUNT(*) FROM domains d WHERE d.subject_id = s.subject_id) AS domain_count,
              (
                SELECT COUNT(DISTINCT td.schema_name || '|' || td.db_type || '|' || td.table_name)::int
                FROM table_definitions td
                WHERE td.use_yn = 'Y'
                  AND (
                    EXISTS (
                      SELECT 1 FROM domains d
                      WHERE d.subject_id = s.subject_id
                        AND d.domain_nm IS NOT NULL
                        AND d.domain_nm <> ''
                        AND d.domain_nm = td.domain_name
                    )
                    OR EXISTS (
                      SELECT 1 FROM terms t
                      WHERE t.subject_id = s.subject_id
                        AND (
                          (t.logical_term IS NOT NULL AND t.logical_term <> '' AND t.logical_term = td.attribute_name)
                          OR (t.physical_term IS NOT NULL AND t.physical_term <> ''
                              AND UPPER(t.physical_term) = UPPER(td.column_name))
                        )
                    )
                  )
              ) AS table_count,
              (
                SELECT COUNT(*)::int
                FROM table_definitions td
                WHERE td.use_yn = 'Y'
                  AND (
                    EXISTS (
                      SELECT 1 FROM domains d
                      WHERE d.subject_id = s.subject_id
                        AND d.domain_nm IS NOT NULL
                        AND d.domain_nm <> ''
                        AND d.domain_nm = td.domain_name
                    )
                    OR EXISTS (
                      SELECT 1 FROM terms t
                      WHERE t.subject_id = s.subject_id
                        AND (
                          (t.logical_term IS NOT NULL AND t.logical_term <> '' AND t.logical_term = td.attribute_name)
                          OR (t.physical_term IS NOT NULL AND t.physical_term <> ''
                              AND UPPER(t.physical_term) = UPPER(td.column_name))
                        )
                    )
                  )
              ) AS column_count
       FROM subject_area s
       ${where}
       ORDER BY s.subject_id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
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
      `SELECT s.*,
              (SELECT COUNT(*) FROM words   w WHERE w.subject_id = s.subject_id) AS word_count,
              (SELECT COUNT(*) FROM terms   t WHERE t.subject_id = s.subject_id) AS term_count,
              (SELECT COUNT(*) FROM domains d WHERE d.subject_id = s.subject_id) AS domain_count,
              (
                SELECT COUNT(DISTINCT td.schema_name || '|' || td.db_type || '|' || td.table_name)::int
                FROM table_definitions td
                WHERE td.use_yn = 'Y'
                  AND (
                    EXISTS (
                      SELECT 1 FROM domains d
                      WHERE d.subject_id = s.subject_id
                        AND d.domain_nm IS NOT NULL
                        AND d.domain_nm <> ''
                        AND d.domain_nm = td.domain_name
                    )
                    OR EXISTS (
                      SELECT 1 FROM terms t
                      WHERE t.subject_id = s.subject_id
                        AND (
                          (t.logical_term IS NOT NULL AND t.logical_term <> '' AND t.logical_term = td.attribute_name)
                          OR (t.physical_term IS NOT NULL AND t.physical_term <> ''
                              AND UPPER(t.physical_term) = UPPER(td.column_name))
                        )
                    )
                  )
              ) AS table_count,
              (
                SELECT COUNT(*)::int
                FROM table_definitions td
                WHERE td.use_yn = 'Y'
                  AND (
                    EXISTS (
                      SELECT 1 FROM domains d
                      WHERE d.subject_id = s.subject_id
                        AND d.domain_nm IS NOT NULL
                        AND d.domain_nm <> ''
                        AND d.domain_nm = td.domain_name
                    )
                    OR EXISTS (
                      SELECT 1 FROM terms t
                      WHERE t.subject_id = s.subject_id
                        AND (
                          (t.logical_term IS NOT NULL AND t.logical_term <> '' AND t.logical_term = td.attribute_name)
                          OR (t.physical_term IS NOT NULL AND t.physical_term <> ''
                              AND UPPER(t.physical_term) = UPPER(td.column_name))
                        )
                    )
                  )
              ) AS column_count
       FROM subject_area s WHERE s.subject_id = $1`,
      [req.params.id]
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
    const { subject_id, subject_name, description, use_yn = 'Y' } = req.body

    if (!subject_id?.trim())   return res.status(400).json({ message: '주제영역 ID(subject_id)는 필수입니다.' })
    if (!subject_name?.trim()) return res.status(400).json({ message: '주제영역명(subject_name)은 필수입니다.' })

    const dup = await pool.query('SELECT 1 FROM subject_area WHERE subject_id = $1', [subject_id.trim()])
    if (dup.rows.length) {
      return res.status(409).json({ message: `주제영역 ID "${subject_id}"는 이미 존재합니다.` })
    }

    const { rows } = await pool.query(
      `INSERT INTO subject_area (subject_id, subject_name, description, use_yn)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [subject_id.trim(), subject_name.trim(), description ?? null, use_yn]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `주제영역 ID "${req.body.subject_id}"는 이미 존재합니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/subject-areas/:id  — subject_id(PK) 변경 포함, ON UPDATE CASCADE 로 연쇄 반영
router.put('/:id', async (req, res) => {
  try {
    const { subject_id: new_id, subject_name, description, use_yn } = req.body
    const old_id = req.params.id

    if (!subject_name?.trim()) return res.status(400).json({ message: '주제영역명(subject_name)은 필수입니다.' })
    if (!new_id?.trim())       return res.status(400).json({ message: '주제영역 ID(subject_id)는 필수입니다.' })

    // ID 변경 시 새 ID 중복 확인
    if (new_id.trim() !== old_id) {
      const dup = await pool.query('SELECT 1 FROM subject_area WHERE subject_id = $1', [new_id.trim()])
      if (dup.rows.length) {
        return res.status(409).json({ message: `주제영역 ID "${new_id}"는 이미 존재합니다.` })
      }
    }

    const { rows } = await pool.query(
      `UPDATE subject_area
       SET subject_id=$1, subject_name=$2, description=$3, use_yn=$4
       WHERE subject_id=$5 RETURNING *`,
      [new_id.trim(), subject_name.trim(), description ?? null, use_yn ?? 'Y', old_id]
    )
    if (!rows.length) return res.status(404).json({ message: '주제영역을 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/subject-areas/:id  — 연결 데이터 건수 확인 후 삭제 (SET NULL)
router.delete('/:id', async (req, res) => {
  try {
    const counts = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM words   WHERE subject_id = $1)::int AS word_count,
         (SELECT COUNT(*) FROM terms   WHERE subject_id = $1)::int AS term_count,
         (SELECT COUNT(*) FROM domains WHERE subject_id = $1)::int AS domain_count`,
      [req.params.id]
    )
    const { word_count, term_count, domain_count } = counts.rows[0]
    const linked = word_count + term_count + domain_count

    const { rowCount } = await pool.query('DELETE FROM subject_area WHERE subject_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '주제영역을 찾을 수 없습니다.' })

    res.json({
      message: linked > 0
        ? `삭제 완료. 연결된 단어 ${word_count}건, 용어 ${term_count}건, 도메인 ${domain_count}건의 주제영역이 해제되었습니다.`
        : '삭제 완료.',
      unlinked: { word_count, term_count, domain_count },
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
