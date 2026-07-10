import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const OBJECT_TYPES = new Set([
  'BASIC', 'TABLE', 'COLUMN', 'DATABASE', 'USER', 'ROLE', 'TABLESPACE',
  'PARTITION', 'INDEX', 'CONSTRAINT', 'VIEW', 'SEQUENCE', 'PROCEDURE',
  'TRIGGER', 'DBLINK', 'SYNONYM',
])

function normalizeYn(v, fallback = 'Y') {
  const y = String(v ?? fallback).trim().toUpperCase()
  return y === 'N' ? 'N' : 'Y'
}

function parseJsonField(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function validateRule(body) {
  const section_cd = body.section_cd?.trim() || null
  const object_type_nm = String(body.object_type_nm ?? '').trim().toUpperCase()
  const rule_title_nm = body.rule_title_nm?.trim()
  const format_pattern_nm = body.format_pattern_nm?.trim() || null
  const parts = parseJsonField(body.parts_json ?? body.parts, [])
  const examples = parseJsonField(body.examples_json ?? body.examples, [])
  const rule_desc = body.rule_desc?.trim() || null
  const sort_ord = Number(body.sort_ord) || 0
  const use_yn = normalizeYn(body.use_yn)
  const system_id = Number(body.system_id)

  if (!system_id) return { error: '시스템을 선택하세요.' }
  if (!object_type_nm || !OBJECT_TYPES.has(object_type_nm)) {
    return { error: '유효한 객체 유형을 선택하세요.' }
  }
  if (!rule_title_nm) return { error: '규칙 제목을 입력하세요.' }
  if (!Array.isArray(parts)) return { error: '구성 요소(parts) 형식이 올바르지 않습니다.' }
  if (!Array.isArray(examples)) return { error: '예시(examples) 형식이 올바르지 않습니다.' }

  return {
    data: {
      system_id,
      section_cd,
      object_type_nm,
      rule_title_nm,
      format_pattern_nm,
      parts,
      examples,
      rule_desc,
      sort_ord,
      use_yn,
    },
  }
}

function mapRow(row) {
  return {
    ...row,
    parts: row.parts_json ?? [],
    examples: row.examples_json ?? [],
  }
}

// GET /api/naming-rules
router.get('/', async (req, res) => {
  try {
    const { system_id, object_type_nm, search, use_yn, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (system_id) {
      params.push(Number(system_id))
      conditions.push(`r.system_id = $${params.length}`)
    }
    if (object_type_nm) {
      params.push(String(object_type_nm).toUpperCase())
      conditions.push(`r.object_type_nm = $${params.length}`)
    }
    if (use_yn) {
      params.push(normalizeYn(use_yn))
      conditions.push(`r.use_yn = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(r.rule_title_nm ILIKE $${n} OR r.section_cd ILIKE $${n} OR COALESCE(r.format_pattern_nm, '') ILIKE $${n})`,
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM meta_naming_rule_m r ${where}`,
      params,
    )
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const { rows } = await pool.query(
      `SELECT r.*, s.system_cd, s.system_nm
       FROM meta_naming_rule_m r
       JOIN meta_system_m s ON s.system_id = r.system_id
       ${where}
       ORDER BY r.sort_ord ASC, r.section_cd ASC, r.naming_rule_id ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ items: rows.map(mapRow), total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/naming-rules/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, s.system_cd, s.system_nm
       FROM meta_naming_rule_m r
       JOIN meta_system_m s ON s.system_id = r.system_id
       WHERE r.naming_rule_id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ message: '명명규칙을 찾을 수 없습니다.' })
    res.json(mapRow(rows[0]))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/naming-rules
router.post('/', async (req, res) => {
  try {
    const { error, data } = validateRule(req.body)
    if (error) return res.status(400).json({ message: error })

    const { rows } = await pool.query(
      `INSERT INTO meta_naming_rule_m
         (system_id, section_cd, object_type_nm, rule_title_nm, format_pattern_nm,
          parts_json, examples_json, rule_desc, sort_ord, use_yn)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
       RETURNING *`,
      [
        data.system_id,
        data.section_cd,
        data.object_type_nm,
        data.rule_title_nm,
        data.format_pattern_nm,
        JSON.stringify(data.parts),
        JSON.stringify(data.examples),
        data.rule_desc,
        data.sort_ord,
        data.use_yn,
      ],
    )
    res.status(201).json(mapRow(rows[0]))
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: '동일 시스템·객체유형·섹션의 규칙이 이미 존재합니다.' })
    }
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/naming-rules/:id
router.put('/:id', async (req, res) => {
  try {
    const { error, data } = validateRule({ ...req.body, system_id: req.body.system_id })
    if (error) return res.status(400).json({ message: error })

    const { rows } = await pool.query(
      `UPDATE meta_naming_rule_m SET
         system_id = $1, section_cd = $2, object_type_nm = $3, rule_title_nm = $4,
         format_pattern_nm = $5, parts_json = $6::jsonb, examples_json = $7::jsonb,
         rule_desc = $8, sort_ord = $9, use_yn = $10, upd_dtm = NOW()
       WHERE naming_rule_id = $11
       RETURNING *`,
      [
        data.system_id,
        data.section_cd,
        data.object_type_nm,
        data.rule_title_nm,
        data.format_pattern_nm,
        JSON.stringify(data.parts),
        JSON.stringify(data.examples),
        data.rule_desc,
        data.sort_ord,
        data.use_yn,
        req.params.id,
      ],
    )
    if (!rows[0]) return res.status(404).json({ message: '명명규칙을 찾을 수 없습니다.' })
    res.json(mapRow(rows[0]))
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: '동일 시스템·객체유형·섹션의 규칙이 이미 존재합니다.' })
    }
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/naming-rules/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM meta_naming_rule_m WHERE naming_rule_id = $1`,
      [req.params.id],
    )
    if (!rowCount) return res.status(404).json({ message: '명명규칙을 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
