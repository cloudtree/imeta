import { Router } from 'express'
import { pool } from '../db.js'
import { lookupNaverDictionary, lookupNaverEnglishDictionary } from '../naverDict.js'

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

// GET /api/words/dictionary-en  - 네이버 영어사전 영문명·약어 조회 (/:id 보다 먼저 등록)
router.get('/dictionary-en', async (req, res) => {
  try {
    const q = req.query.q?.trim()
    if (!q) return res.status(400).json({ message: '검색할 단어명(q)을 입력하세요.' })

    const result = await lookupNaverEnglishDictionary(q)
    res.json(result)
  } catch (err) {
    const status = err.status ?? 500
    res.status(status).json({ message: err.message })
  }
})

// GET /api/words/dictionary-desc  - 네이버 국어사전 뜻풀이 조회 (/:id 보다 먼저 등록)
router.get('/dictionary-desc', async (req, res) => {
  try {
    const q = req.query.q?.trim()
    if (!q) return res.status(400).json({ message: '검색할 단어명(q)을 입력하세요.' })

    const result = await lookupNaverDictionary(q)
    res.json(result)
  } catch (err) {
    const status = err.status ?? 500
    res.status(status).json({ message: err.message })
  }
})

// GET /api/words/dictionary  - 용어 매칭용 전체 단어 (/:id 보다 먼저 등록)
router.get('/dictionary', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT word_nm, abb_word_nm, taxon_yn FROM words ORDER BY word_nm`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/words/bulk  - 엑셀 대량 등록 (/:id 보다 먼저 등록)
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
      const rowNum    = Number(r.__rowNum) || (i + 2)
      const savepoint = `sp_row_${i}`

      await client.query(`SAVEPOINT ${savepoint}`)
      try {
        const word_nm        = r.word_nm?.trim()
        const abb_word_nm    = r.abb_word_nm?.trim().toUpperCase()
        const all_word_nm    = r.all_word_nm?.trim()
        const kor_synonym_nm = r.kor_synonym_nm?.trim() ?? ''
        const taxon_yn       = r.taxon_yn?.trim().toUpperCase() || 'N'
        const use_yn         = r.use_yn?.trim().toUpperCase() || 'Y'
        let word_desc        = r.word_desc?.trim() || null
        const subject_id     = r.subject_id?.trim() || 'STD01'

        if (!word_nm)     throw new Error('단어명은 필수입니다.')
        if (!abb_word_nm) throw new Error('영문약어는 필수입니다.')
        if (!all_word_nm) throw new Error('영문명은 필수입니다.')

        if (!word_desc) {
          try {
            const dict = await lookupNaverDictionary(word_nm)
            word_desc = dict.definition || null
          } catch {
            // 사전 조회 실패 시 설명 없이 등록
          }
        }

        await client.query(
          `INSERT INTO words (word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn, subject_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn, subject_id]
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({ row: rowNum, word_nm })
      } catch (rowErr) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        const msg = rowErr.code === '23505'
          ? `영문약어 "${r.abb_word_nm?.toUpperCase()}"는 이미 등록된 약어입니다.`
          : rowErr.message
        errors.push({ row: rowNum, data: r, message: msg })
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
    if (!taxon_yn)       return res.status(400).json({ message: '분류어여부(taxon_yn)는 필수입니다.' })

    const dup = await pool.query(
      'SELECT word_id FROM words WHERE UPPER(abb_word_nm) = UPPER($1)',
      [abb_word_nm]
    )
    if (dup.rows.length) {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }

    const { subject_id } = req.body
    const kor_synonym = (kor_synonym_nm?.trim?.() ?? kor_synonym_nm) || ''
    const { rows } = await pool.query(
      `INSERT INTO words (word_nm, abb_word_nm, all_word_nm, kor_synonym_nm, taxon_yn, word_desc, use_yn, subject_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [word_nm, abb_word_nm.toUpperCase(), all_word_nm, kor_synonym, taxon_yn, word_desc ?? null, use_yn, subject_id ?? null]
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
    const kor_synonym = (kor_synonym_nm?.trim?.() ?? kor_synonym_nm) || ''
    const { rows } = await pool.query(
      `UPDATE words
       SET word_nm=$1, abb_word_nm=$2, all_word_nm=$3, kor_synonym_nm=$4,
           taxon_yn=$5, word_desc=$6, use_yn=$7, subject_id=$8
       WHERE word_id=$9 RETURNING *`,
      [word_nm, abb_word_nm.toUpperCase(), all_word_nm, kor_synonym, taxon_yn, word_desc ?? null, use_yn ?? 'Y', subject_id ?? null, req.params.id]
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

function normalizeLogicalTerm(logical) {
  return (logical || '').replace(/_/g, '').replace(/\s+/g, '')
}

function matchWords(text, wordList) {
  const sorted = [...wordList].sort((a, b) => b.word_nm.length - a.word_nm.length)
  const result = []
  let pos = 0
  while (pos < text.length) {
    const match = sorted.find((w) => text.startsWith(w.word_nm, pos))
    if (match) {
      result.push({ word: match, matched: true })
      pos += match.word_nm.length
    } else {
      const last = result[result.length - 1]
      if (last && !last.matched) last.text += text[pos]
      else result.push({ matched: false, text: text[pos] })
      pos += 1
    }
  }
  return result
}

/** 표준 용어에서 해당 단어 사용 여부 조회 */
async function findTermsUsingWord(wordId) {
  const { rows: wordRows } = await pool.query(
    'SELECT word_id, word_nm, abb_word_nm FROM words WHERE word_id = $1',
    [wordId]
  )
  if (!wordRows.length) return { word: null, terms: [] }

  const word = wordRows[0]
  const abb  = word.abb_word_nm.toUpperCase()

  const { rows: byPhysical } = await pool.query(
    `SELECT term_id, logical_term
     FROM terms
     WHERE $1 = ANY(string_to_array(UPPER(physical_term), '_'))`,
    [abb]
  )

  const { rows: allTerms } = await pool.query('SELECT term_id, logical_term FROM terms')
  const { rows: allWords } = await pool.query('SELECT word_nm, abb_word_nm FROM words')

  const seen = new Set(byPhysical.map((t) => t.term_id))
  const terms = [...byPhysical]

  for (const term of allTerms) {
    if (seen.has(term.term_id)) continue
    const segs = matchWords(normalizeLogicalTerm(term.logical_term), allWords)
    if (segs.some((s) => s.matched && s.word.word_nm === word.word_nm)) {
      seen.add(term.term_id)
      terms.push(term)
    }
  }

  return { word, terms }
}

function wordInUseMessage(word, terms) {
  const preview = terms.slice(0, 3).map((t) => `"${t.logical_term}"`).join(', ')
  const suffix  = terms.length > 3 ? ` 외 ${terms.length - 3}건` : ''
  return `표준 용어 ${preview}${suffix}에서 "${word.word_nm}" 단어를 사용 중입니다. 해당 용어를 먼저 삭제한 후 표준 단어를 삭제하세요.`
}

// DELETE /api/words/all — 전체 삭제 (/:id 보다 먼저 등록)
router.delete('/all', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM terms')
    if (rows[0].cnt > 0) {
      return res.status(409).json({
        message: '등록된 표준 용어가 있습니다. 용어를 먼저 삭제한 후 표준 단어를 전체 삭제하세요.',
      })
    }
    const { rowCount } = await pool.query('DELETE FROM words')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/words/:id  - 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { word, terms } = await findTermsUsingWord(req.params.id)
    if (!word) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    if (terms.length > 0) {
      return res.status(409).json({ message: wordInUseMessage(word, terms) })
    }

    const { rowCount } = await pool.query('DELETE FROM words WHERE word_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
