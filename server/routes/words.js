import { Router } from 'express'
import { pool } from '../db.js'
import { lookupNaverDictionary, lookupNaverEnglishDictionary } from '../naverDict.js'
import { validateNoPluralEnglish } from '../wordAbbrev.js'

const router = Router()

// GET /api/words  - 목록 조회
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, subject_area_id, system_id, unassigned, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(`(w.std_word_nm ILIKE $${n} OR w.abb_word_nm ILIKE $${n} OR w.full_eng_nm ILIKE $${n})`)
    }
    if (use_yn)            { params.push(use_yn);            conditions.push(`w.use_yn = $${params.length}`) }
    if (subject_area_id)   { params.push(subject_area_id);   conditions.push(`w.subject_area_id = $${params.length}`) }
    if (system_id) {
      params.push(Number(system_id))
      conditions.push(`s.system_id = $${params.length}`)
    }
    if (unassigned === 'Y') {
      conditions.push(`w.subject_area_id IS NOT NULL AND s.system_id IS NULL`)
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)
    const fromJoin = `
       FROM meta_std_word_m w
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = w.subject_area_id
    `

    const countResult = await pool.query(`SELECT COUNT(*) ${fromJoin} ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT w.*, s.subject_area_nm, s.system_nm, s.system_id
       ${fromJoin}
       ${where}
       ORDER BY w.std_word_id DESC
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
      `SELECT std_word_nm, abb_word_nm, taxon_yn FROM meta_std_word_m ORDER BY std_word_nm`
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
        const std_word_nm    = r.std_word_nm?.trim()
        const abb_word_nm    = r.abb_word_nm?.trim().toUpperCase()
        const full_eng_nm    = r.full_eng_nm?.trim()
        const kor_synonym_nm = r.kor_synonym_nm?.trim() ?? ''
        const taxon_yn       = r.taxon_yn?.trim().toUpperCase() || 'N'
        const use_yn         = r.use_yn?.trim().toUpperCase() || 'Y'
        let std_word_desc    = r.std_word_desc?.trim() || null
        const subject_area_id = r.subject_area_id?.trim() || 'STD01'

        if (!std_word_nm)  throw new Error('단어명은 필수입니다.')
        if (!abb_word_nm)  throw new Error('영문약어는 필수입니다.')
        if (!full_eng_nm)  throw new Error('영문명은 필수입니다.')

        const pluralErr = validateNoPluralEnglish({ full_eng_nm, abb_word_nm })
        if (pluralErr) throw new Error(pluralErr)

        if (!std_word_desc) {
          try {
            const dict = await lookupNaverDictionary(std_word_nm)
            std_word_desc = dict.definition || null
          } catch {
            // 사전 조회 실패 시 설명 없이 등록
          }
        }

        await client.query(
          `INSERT INTO meta_std_word_m (std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn, subject_area_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn, subject_area_id]
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({ row: rowNum, std_word_nm })
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
      `SELECT w.*, s.subject_area_nm
       FROM meta_std_word_m w
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = w.subject_area_id
       WHERE w.std_word_id = $1`,
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
    const { std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn = 'Y' } = req.body

    if (!std_word_nm)     return res.status(400).json({ message: '단어명(std_word_nm)은 필수입니다.' })
    if (!abb_word_nm)     return res.status(400).json({ message: '영문약어(abb_word_nm)는 필수입니다.' })
    if (!full_eng_nm)     return res.status(400).json({ message: '영문명(full_eng_nm)은 필수입니다.' })
    if (!taxon_yn)        return res.status(400).json({ message: '분류어여부(taxon_yn)는 필수입니다.' })

    const pluralErr = validateNoPluralEnglish({ full_eng_nm, abb_word_nm })
    if (pluralErr) return res.status(400).json({ message: pluralErr })

    const dup = await pool.query(
      'SELECT std_word_id FROM meta_std_word_m WHERE UPPER(abb_word_nm) = UPPER($1)',
      [abb_word_nm]
    )
    if (dup.rows.length) {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }

    const { subject_area_id } = req.body
    const kor_synonym = (kor_synonym_nm?.trim?.() ?? kor_synonym_nm) || ''
    const { rows } = await pool.query(
      `INSERT INTO meta_std_word_m (std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn, subject_area_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [std_word_nm, abb_word_nm.toUpperCase(), full_eng_nm, kor_synonym, taxon_yn, std_word_desc ?? null, use_yn, subject_area_id ?? null]
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
    const { std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn } = req.body

    const pluralErr = validateNoPluralEnglish({ full_eng_nm, abb_word_nm })
    if (pluralErr) return res.status(400).json({ message: pluralErr })

    const dup = await pool.query(
      'SELECT std_word_id FROM meta_std_word_m WHERE UPPER(abb_word_nm) = UPPER($1) AND std_word_id <> $2',
      [abb_word_nm, req.params.id]
    )
    if (dup.rows.length) {
      return res.status(409).json({ message: `영문약어 "${abb_word_nm.toUpperCase()}"는 이미 등록된 약어입니다.` })
    }

    const { subject_area_id } = req.body
    const kor_synonym = (kor_synonym_nm?.trim?.() ?? kor_synonym_nm) || ''
    const { rows } = await pool.query(
      `UPDATE meta_std_word_m
       SET std_word_nm=$1, abb_word_nm=$2, full_eng_nm=$3, kor_synonym_nm=$4,
           taxon_yn=$5, std_word_desc=$6, use_yn=$7, subject_area_id=$8
       WHERE std_word_id=$9 RETURNING *`,
      [std_word_nm, abb_word_nm.toUpperCase(), full_eng_nm, kor_synonym, taxon_yn, std_word_desc ?? null, use_yn ?? 'Y', subject_area_id ?? null, req.params.id]
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
  const sorted = [...wordList].sort((a, b) => b.std_word_nm.length - a.std_word_nm.length)
  const result = []
  let pos = 0
  while (pos < text.length) {
    const match = sorted.find((w) => text.startsWith(w.std_word_nm, pos))
    if (match) {
      result.push({ word: match, matched: true })
      pos += match.std_word_nm.length
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
    'SELECT std_word_id, std_word_nm, abb_word_nm FROM meta_std_word_m WHERE std_word_id = $1',
    [wordId]
  )
  if (!wordRows.length) return { word: null, terms: [] }

  const word = wordRows[0]
  const abb  = word.abb_word_nm.toUpperCase()

  const { rows: byPhysical } = await pool.query(
    `SELECT std_term_id, logical_term_nm
     FROM meta_std_term_m
     WHERE $1 = ANY(string_to_array(UPPER(physical_term_nm), '_'))`,
    [abb]
  )

  const { rows: allTerms } = await pool.query('SELECT std_term_id, logical_term_nm FROM meta_std_term_m')
  const { rows: allWords } = await pool.query('SELECT std_word_nm, abb_word_nm FROM meta_std_word_m')

  const seen = new Set(byPhysical.map((t) => t.std_term_id))
  const terms = [...byPhysical]

  for (const term of allTerms) {
    if (seen.has(term.std_term_id)) continue
    const segs = matchWords(normalizeLogicalTerm(term.logical_term_nm), allWords)
    if (segs.some((s) => s.matched && s.word.std_word_nm === word.std_word_nm)) {
      seen.add(term.std_term_id)
      terms.push(term)
    }
  }

  return { word, terms }
}

function wordInUseMessage(word, terms) {
  const preview = terms.slice(0, 3).map((t) => `"${t.logical_term_nm}"`).join(', ')
  const suffix  = terms.length > 3 ? ` 외 ${terms.length - 3}건` : ''
  return `표준 용어 ${preview}${suffix}에서 "${word.std_word_nm}" 단어를 사용 중입니다. 해당 용어를 먼저 삭제한 후 표준 단어를 삭제하세요.`
}

// DELETE /api/words/all — 전체 삭제 (/:id 보다 먼저 등록)
router.delete('/all', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS cnt FROM meta_std_term_m')
    if (rows[0].cnt > 0) {
      return res.status(409).json({
        message: '등록된 표준 용어가 있습니다. 용어를 먼저 삭제한 후 표준 단어를 전체 삭제하세요.',
      })
    }
    const { rowCount } = await pool.query('DELETE FROM meta_std_word_m')
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

    const { rowCount } = await pool.query('DELETE FROM meta_std_word_m WHERE std_word_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '단어를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
