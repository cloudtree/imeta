import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/words  - 목록 조회 (검색: word_nm, abb_word_nm, all_word_nm)
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(`(word_nm ILIKE $${n} OR abb_word_nm ILIKE $${n} OR all_word_nm ILIKE $${n})`)
    }
    if (use_yn) {
      params.push(use_yn)
      conditions.push(`use_yn = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM words ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT * FROM words ${where} ORDER BY word_id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
    const { rows } = await pool.query('SELECT * FROM words WHERE word_id = $1', [req.params.id])
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

    if (!word_nm)       return res.status(400).json({ message: '단어명(word_nm)은 필수입니다.' })
    if (!abb_word_nm)   return res.status(400).json({ message: '영문약어(abb_word_nm)는 필수입니다.' })
    if (!all_word_nm)   return res.status(400).json({ message: '영문명(all_word_nm)은 필수입니다.' })
    if (!kor_synonym_nm) return res.status(400).json({ message: '한글동의어(kor_synonym_nm)는 필수입니다.' })
    if (!taxon_yn)      return res.status(400).json({ message: '분류어여부(taxon_yn)는 필수입니다.' })

    const { rows } = await pool.query(
      `INSERT INTO words (word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc ?? null, use_yn]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/words/:id  - 수정
router.put('/:id', async (req, res) => {
  try {
    const { word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn } = req.body

    const { rows } = await pool.query(
      `UPDATE words
       SET word_nm=$1, abb_word_nm=$2, all_word_nm=$3, kor_synonym_nm=$4,
           taxon_yn=$5, word_desc=$6, use_yn=$7
       WHERE word_id=$8 RETURNING *`,
      [word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc ?? null, use_yn ?? 'Y', req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
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
