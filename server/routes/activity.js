import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/activity/recent
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50)

    const { rows } = await pool.query(
      `(
         SELECT 'word'::text AS type,
                w.word_id::text AS id,
                w.word_nm AS label,
                COALESCE(w.abb_word_nm, '') AS detail,
                w.updated_at AS occurred_at,
                '표준 단어'::text AS category
         FROM words w
       )
       UNION ALL
       (
         SELECT 'term',
                t.term_id::text,
                t.logical_term,
                COALESCE(t.physical_term, ''),
                t.updated_at,
                '표준 용어'
         FROM terms t
       )
       UNION ALL
       (
         SELECT 'domain',
                d.domain_id::text,
                d.domain_nm,
                COALESCE(d.infotype, d.data_type, ''),
                d.updated_at,
                '표준 도메인'
         FROM domains d
       )
       UNION ALL
       (
         SELECT 'table',
                td.def_id::text,
                td.table_name,
                COALESCE(td.entity_name, td.column_name, ''),
                td.updated_at,
                '테이블 정의서'
         FROM table_definitions td
         WHERE td.use_yn = 'Y'
       )
       UNION ALL
       (
         SELECT 'subject',
                s.subject_id,
                s.subject_name,
                COALESCE(s.description, ''),
                s.updated_at,
                '주제영역'
         FROM subject_area s
       )
       ORDER BY occurred_at DESC NULLS LAST
       LIMIT $1`,
      [limit],
    )

    res.json({ items: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
