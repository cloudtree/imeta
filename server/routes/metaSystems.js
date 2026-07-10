import { Router } from 'express'
import { pool } from '../db.js'
import { NAMING_RULE_SEED } from '../migrateNamingRules.js'

const router = Router()

function normalizeYn(v, fallback = 'Y') {
  const y = String(v ?? fallback).trim().toUpperCase()
  return y === 'N' ? 'N' : 'Y'
}

// GET /api/meta-systems — 인증 사용자 전체 조회 가능
router.get('/', async (req, res) => {
  try {
    const { search, use_yn } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(`(system_cd ILIKE $${n} OR system_nm ILIKE $${n})`)
    }
    if (use_yn) {
      params.push(normalizeYn(use_yn))
      conditions.push(`use_yn = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM meta_naming_rule_m r WHERE r.system_id = s.system_id) AS rule_count,
              (SELECT COUNT(*)::int FROM meta_subject_area_m sa WHERE sa.system_id = s.system_id) AS subject_count
       FROM meta_system_m s
       ${where}
       ORDER BY CASE WHEN s.system_cd = 'ENTERPRISE' THEN 0 ELSE 1 END, s.system_nm`,
      params,
    )
    res.json({ items: rows, total: rows.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/meta-systems
router.post('/', async (req, res) => {
  const client = await pool.connect()
  try {
    const system_cd = req.body?.system_cd?.trim()?.toUpperCase()
    const system_nm = req.body?.system_nm?.trim()
    const system_desc = req.body?.system_desc?.trim() || null
    const use_yn = normalizeYn(req.body?.use_yn)
    const copy_from_enterprise = !!req.body?.copy_from_enterprise

    if (!system_cd) return res.status(400).json({ message: '시스템 코드를 입력하세요.' })
    if (!/^[A-Z0-9_-]+$/.test(system_cd)) {
      return res.status(400).json({ message: '시스템 코드는 영문 대문자, 숫자, _, - 만 사용할 수 있습니다.' })
    }
    if (!system_nm) return res.status(400).json({ message: '시스템명을 입력하세요.' })

    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO meta_system_m (system_cd, system_nm, system_desc, use_yn)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [system_cd, system_nm, system_desc, use_yn],
    )
    const system = rows[0]

    if (copy_from_enterprise) {
      const ent = await client.query(
        `SELECT system_id FROM meta_system_m WHERE system_cd = 'ENTERPRISE' LIMIT 1`,
      )
      if (ent.rows[0]) {
        await client.query(
          `INSERT INTO meta_naming_rule_m
             (system_id, section_cd, object_type_nm, rule_title_nm, format_pattern_nm,
              parts_json, examples_json, rule_desc, sort_ord, use_yn)
           SELECT $1, section_cd, object_type_nm, rule_title_nm, format_pattern_nm,
                  parts_json, examples_json, rule_desc, sort_ord, use_yn
           FROM meta_naming_rule_m
           WHERE system_id = $2`,
          [system.system_id, ent.rows[0].system_id],
        )
      } else {
        for (const rule of NAMING_RULE_SEED) {
          await client.query(
            `INSERT INTO meta_naming_rule_m
               (system_id, section_cd, object_type_nm, rule_title_nm, format_pattern_nm,
                parts_json, examples_json, rule_desc, sort_ord, use_yn)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'Y')`,
            [
              system.system_id,
              rule.section_cd,
              rule.object_type,
              rule.title,
              rule.format_pattern,
              JSON.stringify(rule.parts),
              JSON.stringify(rule.examples),
              rule.notes || null,
              rule.sort_order,
            ],
          )
        }
      }
    }

    await client.query('COMMIT')
    const withCount = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM meta_naming_rule_m r WHERE r.system_id = s.system_id) AS rule_count
       FROM meta_system_m s WHERE s.system_id = $1`,
      [system.system_id],
    )
    res.status(201).json(withCount.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ message: `시스템 코드 "${req.body?.system_cd}"는 이미 등록되어 있습니다.` })
    }
    res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }
})

// PUT /api/meta-systems/:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    const system_cd = req.body?.system_cd?.trim()?.toUpperCase()
    const system_nm = req.body?.system_nm?.trim()
    const system_desc = req.body?.system_desc?.trim() || null
    const use_yn = normalizeYn(req.body?.use_yn)
    const cascade = req.body.cascade_children === true
      || req.body.cascade_children === 'Y'
      || req.body.cascade_children === 'y'

    if (!system_cd) return res.status(400).json({ message: '시스템 코드를 입력하세요.' })
    if (!system_nm) return res.status(400).json({ message: '시스템명을 입력하세요.' })

    await client.query('BEGIN')

    const existing = await client.query(
      `SELECT * FROM meta_system_m WHERE system_id = $1 FOR UPDATE`,
      [req.params.id],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: '시스템을 찾을 수 없습니다.' })
    }

    const childCounts = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM meta_subject_area_m WHERE system_id = $1) AS subject_count,
         (SELECT COUNT(*)::int FROM meta_naming_rule_m WHERE system_id = $1) AS rule_count`,
      [req.params.id],
    )
    const { subject_count, rule_count } = childCounts.rows[0]
    const nmChanged = existing.rows[0].system_nm !== system_nm

    const { rows } = await client.query(
      `UPDATE meta_system_m SET
         system_cd = $1, system_nm = $2, system_desc = $3, use_yn = $4, upd_dtm = NOW()
       WHERE system_id = $5
       RETURNING *`,
      [system_cd, system_nm, system_desc, use_yn, req.params.id],
    )

    let cascadedSubjects = 0
    if (cascade && nmChanged && subject_count > 0) {
      const upd = await client.query(
        `UPDATE meta_subject_area_m SET system_nm = $1 WHERE system_id = $2`,
        [system_nm, req.params.id],
      )
      cascadedSubjects = upd.rowCount
    }

    await client.query('COMMIT')
    res.json({
      ...rows[0],
      cascaded: cascade && cascadedSubjects > 0,
      cascaded_subjects: cascadedSubjects,
      counts: { subject_count, rule_count },
    })
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ message: `시스템 코드 "${req.body?.system_cd}"는 이미 등록되어 있습니다.` })
    }
    res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }
})

// DELETE /api/meta-systems/:id
router.delete('/:id', async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT system_cd FROM meta_system_m WHERE system_id = $1`,
      [req.params.id],
    )
    if (!check.rows[0]) return res.status(404).json({ message: '시스템을 찾을 수 없습니다.' })
    if (check.rows[0].system_cd === 'ENTERPRISE') {
      return res.status(409).json({ message: '전사표준 시스템은 삭제할 수 없습니다.' })
    }

    const childCounts = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM meta_subject_area_m WHERE system_id = $1) AS subject_count,
         (SELECT COUNT(*)::int FROM meta_naming_rule_m WHERE system_id = $1) AS rule_count`,
      [req.params.id],
    )
    const { subject_count, rule_count } = childCounts.rows[0]
    if (subject_count > 0 || rule_count > 0) {
      return res.status(409).json({
        code: 'HAS_CHILDREN',
        message: `하위 데이터가 있어 삭제할 수 없습니다. (주제영역 ${subject_count}건, 명명규칙 ${rule_count}건)`,
        counts: { subject_count, rule_count },
      })
    }

    await pool.query(`DELETE FROM meta_system_m WHERE system_id = $1`, [req.params.id])
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
