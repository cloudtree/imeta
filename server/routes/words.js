import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/words  - 목록 조회
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, subject_id, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(`(w.word_nm ILIKE $${n} OR w.abb_word_nm ILIKE $${n} OR w.all_word_nm ILIKE $${n})`)
    }
    if (use_yn)     { params.push(use_yn);     conditions.push(`w.use_yn = $${params.length}`) }
    if (subject_id) { params.push(subject_id); conditions.push(`w.subject_id = $${params.length}`) }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM words w ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT w.*, s.subject_name
       FROM words w
       LEFT JOIN subject_area s ON s.subject_id = w.subject_id
       ${where}
       ORDER BY w.word_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/words/:id  - 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, s.subject_name FROM words w LEFT JOIN subject_area s ON s.subject_id = w.subject_id WHERE w.word_id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/words  - 등록
router.post('/', async (req, res) => {
  try {
    const { word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn = 'Y' } = req.body

    if (!word_nm)        return res.status(400).json({ message: '단어명(word_nm)은 필수입니다.' })
    if (!abb_word_nm)    return res.status(400).json({ message: '영문약어(abb_word_nm)는 필수입니다.' })
    if (!all_word_nm)    return res.status(400).json({ message: '영문명(all_word_nm)은 필수입니다.' })
    if (!kor_synonym_nm) return res.status(400).json({ message: '한글동의어(kor_synonym_nm)는 필수입니다.' })
    if (!taxon_yn)       return res.status(400).json({ message: '분류어여부(taxon_yn)는 필수입니다.' })

    const dup = await pool.query(
      'SELECT word_id FROM words WHERE UPPER(abb_word_nm) = UPPER($1)',
      [abb_word_nm]
    )
    if (dup.rows.length) {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }

    const { subject_id } = req.body
    const { rows } = await pool.query(
      `INSERT INTO words (word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn, subject_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [word_nm, abb_word_nm.toUpperCase(), all_word_nm, kor_synonym_nm, taxon_yn, word_desc ?? null, use_yn, subject_id ?? null]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm?.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/words/:id  - 수정
router.put('/:id', async (req, res) => {
  try {
    const { word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn } = req.body

    const dup = await pool.query(
      'SELECT word_id FROM words WHERE UPPER(abb_word_nm) = UPPER($1) AND word_id <> $2',
      [abb_word_nm, req.params.id]
    )
    if (dup.rows.length) {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }

    const { subject_id } = req.body
    const { rows } = await pool.query(
      `UPDATE words
       SET word_nm=$1, abb_word_nm=$2, all_word_nm=$3, kor_synonym_nm=$4,
           taxon_yn=$5, word_desc=$6, use_yn=$7, subject_id=$8
       WHERE word_id=$9 RETURNING *`,
      [word_nm, abb_word_nm.toUpperCase(), all_word_nm, kor_synonym_nm, taxon_yn, word_desc ?? null, use_yn ?? 'Y', subject_id ?? null, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm?.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/words/:id  - 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM words WHERE word_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
