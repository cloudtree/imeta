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
                w.std_word_id::text AS id,
                w.std_word_nm AS label,
                COALESCE(w.abb_word_nm, '') AS detail,
                w.upd_dtm AS occurred_at,
                '표준 단어'::text AS category
         FROM meta_std_word_m w
       )
       UNION ALL
       (
         SELECT 'term',
                t.std_term_id::text,
                t.logical_term_nm,
                COALESCE(t.physical_term_nm, ''),
                t.upd_dtm,
                '표준 용어'
         FROM meta_std_term_m t
       )
       UNION ALL
       (
         SELECT 'domain',
                d.std_domain_id::text,
                d.std_domain_nm,
                COALESCE(d.info_type_nm, d.data_type_nm, ''),
                d.upd_dtm,
                '표준 도메인'
         FROM meta_std_domain_m d
       )
       UNION ALL
       (
         SELECT 'table',
                td.table_def_id::text,
                td.table_nm,
                COALESCE(td.entity_nm, td.column_nm, ''),
                td.upd_dtm,
                '테이블 정의서'
         FROM meta_table_def_m td
         WHERE td.use_yn = 'Y'
       )
       UNION ALL
       (
         SELECT 'subject',
                s.subject_area_id,
                s.subject_area_nm,
                COALESCE(s.subject_area_desc, ''),
                s.upd_dtm,
                '주제영역'
         FROM meta_subject_area_m s
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
