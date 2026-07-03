import { Router } from 'express'
import { pool } from '../db.js'
import { lookupWordDefinition } from '../googleAi.js'
import {
  mergeLegacyLengthScale,
  normalizeDataLengthInput,
  validateDataLength as checkDataLengthFormat,
  LENGTH_TYPES,
} from './_dataLength.js'

const router = Router()

const VALID_DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

function validateDataLength(value, dataType, data_scale) {
  const dt = dataType?.toUpperCase()
  const v  = normalizeDataLengthInput(value, dataType, data_scale)
  if (!LENGTH_TYPES.includes(dt)) return null
  if (!v) return '데이터 길이를 입력하세요.'
  return checkDataLengthFormat(v, dataType)
}

function normalizeTermDataLen(raw, dataType, data_scale) {
  const err = validateDataLength(raw, dataType, data_scale)
  if (err) throw new Error(err)
  return normalizeDataLengthInput(
    mergeLegacyLengthScale(raw, data_scale, dataType) ?? raw,
    dataType,
  ) || null
}

function normalizeLogicalTerm(logical) {
  return (logical || '').replace(/_/g, '').replace(/\s+/g, '')
}

function hasExplicitBoundaries(logical) {
  return /\s/.test(logical || '')
}

function splitLogicalChunks(logical) {
  return (logical || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
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

function matchWordsByChunks(logical, wordList) {
  const chunks = splitLogicalChunks(logical)
  if (chunks.length === 0) return []
  if (chunks.length === 1) return matchWords(chunks[0], wordList)
  const segments = []
  for (const chunk of chunks) segments.push(...matchWords(chunk, wordList))
  return segments
}

function matchLogicalTerm(logical, wordList) {
  if (!logical?.trim() || !wordList?.length) return []
  if (hasExplicitBoundaries(logical)) return matchWordsByChunks(logical, wordList)
  return matchWords(normalizeLogicalTerm(logical), wordList)
}

function resolveLogicalSegments(logical, wordList) {
  const hasBounds   = hasExplicitBoundaries(logical)
  const normalized  = normalizeLogicalTerm(logical)
  const segments    = normalized && wordList.length ? matchLogicalTerm(logical, wordList) : []
  const segmentsRev = !hasBounds && normalized && wordList.length
    ? matchWordsReverse(normalized, wordList)
    : []
  const physForward = toPhysical(segments)
  const physReverse = toPhysical(segmentsRev)
  const isAmbiguous = !hasBounds && !!physForward && !!physReverse && physForward !== physReverse
  return { segments, segmentsRev, hasBounds, isAmbiguous, physForward, physReverse }
}

function matchWordsReverse(text, wordList) {
  const sorted = [...wordList].sort((a, b) => b.word_nm.length - a.word_nm.length)
  const result = []
  let pos = text.length
  while (pos > 0) {
    const match = sorted.find(
      (w) => w.word_nm.length <= pos && text.slice(pos - w.word_nm.length, pos) === w.word_nm
    )
    if (match) {
      result.unshift({ word: match, matched: true })
      pos -= match.word_nm.length
    } else {
      const first = result[0]
      if (first && !first.matched) first.text = text[pos - 1] + first.text
      else result.unshift({ matched: false, text: text[pos - 1] })
      pos -= 1
    }
  }
  return result
}

function toPhysical(segments) {
  return segments.filter((s) => s.matched).map((s) => s.word.abb_word_nm.toUpperCase()).join('_')
}

function findHomonyms(matchedWords, allWords) {
  return matchedWords.filter((w) => allWords.filter((x) => x.word_nm === w.word_nm).length > 1)
}

function getSortedWordKey(segments) {
  return segments.filter((s) => s.matched).map((s) => s.word.word_nm).sort().join('')
}

function findSynonymTerm(normalizedLogical, segments, existingTerms, wordList, excludeTermId = null) {
  const key = getSortedWordKey(segments)
  if (!key) return null
  for (const term of existingTerms) {
    if (excludeTermId != null && term.term_id === excludeTermId) continue
    const termNorm = normalizeLogicalTerm(term.logical_term)
    if (termNorm === normalizedLogical) continue
    if (getSortedWordKey(matchLogicalTerm(term.logical_term, wordList)) === key) return term
  }
  return null
}

function validateTermFields(input, ctx = {}) {
  const {
    logical_term, physical_term, domain_div_cd, domain_id, infotype,
    data_type, data_len, subject_id, term_id,
  } = input
  const { words = [], domains = [], existingTerms = [], requireDomainGroup = false } = ctx
  const errors = []

  if (!subject_id?.trim()) errors.push('주제영역은 필수입니다.')
  if (!logical_term?.trim()) errors.push('논리명은 필수입니다.')
  if (!physical_term?.trim()) errors.push('물리명은 필수입니다.')
  if (requireDomainGroup && !domain_div_cd?.trim()) errors.push('도메인 그룹명은 필수입니다.')
  if (!data_type) errors.push('데이터타입은 필수입니다.')
  if (!data_len?.trim()) errors.push('데이터 길이를 입력하세요.')
  else {
    const dataLenErr = validateDataLength(data_len, data_type)
    if (dataLenErr) errors.push(dataLenErr)
  }

  const normalized = normalizeLogicalTerm(logical_term)
  const {
    segments,
    isAmbiguous,
    physForward,
    physReverse,
  } = resolveLogicalSegments(logical_term, words)
  const phys        = (physical_term || '').trim().toUpperCase()

  if (normalized && words.length) {
    const unmatched = segments.filter((s) => !s.matched)
    if (unmatched.length) {
      errors.push(`논리명에 표준단어에 등록되지 않은 단어가 포함되어 있습니다: ${unmatched.map((s) => `"${s.text}"`).join(', ')}`)
    } else if (!physForward) {
      errors.push('논리명을 표준단어로 변환할 수 없습니다.')
    }
  }

  if (isAmbiguous) {
    errors.push(`단어 분리가 모호합니다. 앞→뒤: ${physForward} / 뒤→앞: ${physReverse} — 공백으로 구분해 보세요. (예: "1학년 신청제한여부")`)
  }
  if (phys && !/^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(phys)) {
    errors.push('물리명은 영문/숫자를 "_"로 구분하는 형식이어야 합니다. (예: CUST_NO)')
  }
  if (phys.length > 30) errors.push(`물리명은 30자를 초과할 수 없습니다. (현재 ${phys.length}자)`)
  if (phys && physForward && phys !== physForward) {
    errors.push(`물리명이 논리명 변환 결과와 일치하지 않습니다. (예상: ${physForward}, 입력: ${phys})`)
  }
  if (phys && words.length) {
    const lastAbbr = phys.split('_').pop()
    const lastWord = words.find((w) => w.abb_word_nm?.toUpperCase() === lastAbbr)
    if (!lastWord) errors.push(`물리명의 마지막 단어 "${lastAbbr}"은 표준단어에 등록되지 않은 약어입니다.`)
    else if (lastWord.taxon_yn !== 'Y') {
      errors.push(`물리명의 마지막 단어 "${lastAbbr}"(${lastWord.word_nm})은 분류어가 아닙니다.`)
    }
  }

  const homonyms = findHomonyms(segments.filter((s) => s.matched).map((s) => s.word), words)
  if (homonyms.length) {
    errors.push(`동음이의어 확인 필요: ${homonyms.map((w) => `"${w.word_nm}"`).join(', ')}`)
  }

  const synonym = findSynonymTerm(normalized, segments, existingTerms, words, term_id ?? null)
  if (synonym) {
    errors.push(`동의 용어 검토 필요: 등록된 용어 "${synonym.logical_term}"과 단어 구성이 동일합니다.`)
  }

  if (domain_div_cd && domains.length && !domains.some((d) => d.info_type === domain_div_cd)) {
    errors.push(`도메인 그룹명 "${domain_div_cd}"에 해당하는 표준 도메인 그룹이 없습니다.`)
  }
  if (domain_div_cd && domain_div_cd !== '코드' && !domain_id && !infotype?.trim()) {
    errors.push('코드 그룹이 아닌 경우 도메인 인포타입을 입력해야 합니다.')
  }

  const dt = data_type?.trim().toUpperCase()
  if (dt && !VALID_DATA_TYPES.includes(dt)) {
    errors.push(`데이터타입 "${data_type}"은 허용되지 않습니다. (${VALID_DATA_TYPES.join(', ')})`)
  }

  return { firstError: errors[0] ?? null }
}

function assertTermValid(input, ctx) {
  const { firstError } = validateTermFields(input, ctx)
  if (firstError) throw new Error(firstError)
}

async function loadTermValidationContext(client) {
  const [wordsRes, domainsRes, termsRes] = await Promise.all([
    client.query(`SELECT word_nm, abb_word_nm, taxon_yn FROM words`),
    client.query(`SELECT info_type FROM domains`),
    client.query(`SELECT term_id, logical_term FROM terms`),
  ])
  return {
    words: wordsRes.rows,
    domains: domainsRes.rows,
    existingTerms: termsRes.rows,
  }
}

// GET /api/terms
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, subject_id, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(t.logical_term ILIKE $${params.length} OR t.physical_term ILIKE $${params.length} OR t.domain_div_cd ILIKE $${params.length})`)
    }
    if (use_yn)     { params.push(use_yn);     conditions.push(`t.use_yn = $${params.length}`) }
    if (subject_id) { params.push(subject_id); conditions.push(`t.subject_id = $${params.length}`) }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM terms t ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT t.*, d.domain_nm, s.subject_name
       FROM terms t
       LEFT JOIN domains d ON d.domain_id = t.domain_id
       LEFT JOIN subject_area s ON s.subject_id = t.subject_id
       ${where}
       ORDER BY t.term_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/terms/ai-desc  - Google AI 용어 정의 조회 (/:id 보다 먼저 등록)
router.get('/ai-desc', async (req, res) => {
  try {
    const q = req.query.q?.trim()
    if (!q) return res.status(400).json({ message: '검색할 논리명(q)을 입력하세요.' })

    const result = await lookupWordDefinition(q)
    res.json(result)
  } catch (err) {
    const status = err.status ?? 500
    res.status(status).json({ message: err.message })
  }
})

// GET /api/terms/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, d.domain_nm, s.subject_name
       FROM terms t
       LEFT JOIN domains d ON d.domain_id = t.domain_id
       LEFT JOIN subject_area s ON s.subject_id = t.subject_id
       WHERE t.term_id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// '코드' 그룹 도메인 자동 생성 헬퍼
async function ensureCodeDomain(client, { logical_term, data_type, data_len, subject_id }) {
  const TYPE_ABBR = { VARCHAR:'VC', CHAR:'CH', NUMBER:'NM', INTEGER:'IN', DATE:'DT', TIMESTAMP:'TS', BOOLEAN:'BL', CLOB:'CL' }
  const abbr     = TYPE_ABBR[data_type?.toUpperCase()] ?? (data_type ?? 'VC').slice(0, 2).toUpperCase()
  const lenPart = data_len != null ? String(data_len).trim() : ''
  const infotype = `${logical_term}${abbr}${lenPart}`

  // 이미 존재하면 재사용
  const existing = await client.query(
    `SELECT domain_id FROM domains WHERE infotype = $1 LIMIT 1`, [infotype]
  )
  if (existing.rows.length) return existing.rows[0].domain_id

  // 도메인 그룹 '코드' 자동 생성
  await client.query(
    `INSERT INTO domain_groups (group_nm, use_yn) VALUES ('코드', 'Y') ON CONFLICT (group_nm) DO NOTHING`
  )

  // 도메인 자동 생성
  const ins = await client.query(
    `INSERT INTO domains (domain_nm, data_type, info_type, domain_div_cd, data_length, use_yn, subject_id, infotype)
     VALUES ($1,$2,'코드','', $3,'Y',$4,$5) RETURNING domain_id`,
    [logical_term, data_type?.toUpperCase() ?? 'VARCHAR',
     lenPart || null,
     subject_id ?? null, infotype]
  )
  return ins.rows[0].domain_id
}

// POST /api/terms
router.post('/', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { logical_term, physical_term, domain_div_cd, data_type, term_desc, use_yn = 'Y', subject_id } = req.body
    const data_len = normalizeTermDataLen(req.body.data_len, data_type, req.body.data_scale) || null
    let { domain_id } = req.body

    const vctx = await loadTermValidationContext(client)
    assertTermValid(
      { logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, subject_id },
      { ...vctx, requireDomainGroup: true }
    )

    // '코드' 그룹이고 domain_id 없으면 자동 생성
    if (domain_div_cd === '코드' && !domain_id) {
      domain_id = await ensureCodeDomain(client, { logical_term, data_type, data_len, subject_id })
    }

    const { rows } = await client.query(
      `INSERT INTO terms (logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, term_desc, use_yn, subject_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [logical_term, physical_term, domain_div_cd ?? null, domain_id ?? null,
       data_type, data_len, term_desc ?? null, use_yn, subject_id ?? null]
    )
    await client.query('COMMIT')
    res.status(201).json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }
})

// PUT /api/terms/:id
router.put('/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { logical_term, physical_term, domain_div_cd, data_type, term_desc, use_yn, subject_id } = req.body
    const data_len = normalizeTermDataLen(req.body.data_len, data_type, req.body.data_scale) || null
    let { domain_id } = req.body

    const vctx = await loadTermValidationContext(client)
    assertTermValid(
      {
        logical_term, physical_term, domain_div_cd, domain_id,
        data_type, data_len, subject_id, term_id: Number(req.params.id),
      },
      { ...vctx, requireDomainGroup: true }
    )

    // '코드' 그룹이고 domain_id 없으면 자동 생성
    if (domain_div_cd === '코드' && !domain_id) {
      domain_id = await ensureCodeDomain(client, { logical_term, data_type, data_len, subject_id })
    }

    const { rows } = await client.query(
      `UPDATE terms
       SET logical_term=$1, physical_term=$2, domain_div_cd=$3, domain_id=$4,
           data_type=$5, data_len=$6, term_desc=$7, use_yn=$8, subject_id=$9
       WHERE term_id=$10 RETURNING *`,
      [logical_term, physical_term, domain_div_cd ?? null, domain_id ?? null,
       data_type, data_len, term_desc ?? null, use_yn ?? 'Y', subject_id ?? null, req.params.id]
    )
    if (!rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    }
    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }
})

// DELETE /api/terms/all — 전체 삭제 (/:id 보다 먼저 등록)
router.delete('/all', async (_req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM terms')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/terms/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM terms WHERE term_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/terms/bulk  - 엑셀 대량 등록
router.post('/bulk', async (req, res) => {
  const rows = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: '등록할 데이터가 없습니다.' })

  const success = []
  const errors  = []
  const client  = await pool.connect()

  try {
    await client.query('BEGIN')

    const vctx = await loadTermValidationContext(client)

    for (let i = 0; i < rows.length; i++) {
      const r         = rows[i]
      const rowNum    = i + 2
      const savepoint = `sp_row_${i}`

      await client.query(`SAVEPOINT ${savepoint}`)
      try {
        const logical_term  = r.logical_term?.trim()
        const physical_term = r.physical_term?.trim().toUpperCase()
        const domain_div_cd = r.domain_div_cd?.trim() || null
        const data_type     = r.data_type?.trim().toUpperCase() || 'VARCHAR'
        const data_len      = normalizeTermDataLen(r.data_len ?? r.data_length, data_type, r.data_scale) || null
        const use_yn        = r.use_yn?.trim().toUpperCase() || 'Y'
        const term_desc     = r.term_desc?.trim() || null
        const subject_id    = r.subject_id?.trim() || 'STD01'
        const infotype      = r.infotype?.trim()

        assertTermValid(
          { logical_term, physical_term, domain_div_cd, infotype, data_type, data_len, subject_id },
          vctx
        )

        // 인포타입으로 domain_id 조회
        let domain_id = r.domain_id || null
        if (infotype) {
          const domRes = await client.query(
            `SELECT domain_id FROM domains WHERE infotype = $1 LIMIT 1`,
            [infotype]
          )
          if (domRes.rows.length === 0)
            throw new Error(`도메인 인포타입 "${infotype}"을 찾을 수 없습니다.`)
          domain_id = domRes.rows[0].domain_id
        } else if (domain_div_cd === '코드' && !domain_id) {
          // '코드' 그룹이고 인포타입 미지정 → 자동 생성
          domain_id = await ensureCodeDomain(client, { logical_term, data_type, data_len, subject_id })
        }

        await client.query(
          `INSERT INTO terms (logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, term_desc, use_yn, subject_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [logical_term, physical_term, domain_div_cd, domain_id, data_type, data_len, term_desc, use_yn, subject_id]
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({ row: rowNum, logical_term })
        vctx.existingTerms.push({ term_id: null, logical_term })
      } catch (rowErr) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        errors.push({ row: rowNum, data: r, message: rowErr.message })
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

export default router
