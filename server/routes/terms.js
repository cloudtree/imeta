import { Router } from 'express'
import { pool } from '../db.js'
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

function candidatesFor(matchedWord, wordList) {
  const same = wordList.filter((w) => w.std_word_nm === matchedWord.std_word_nm)
  return same.length > 1 ? same : undefined
}

function resolveCandidate(matchedWord, candidates, selections) {
  if (!candidates) return matchedWord
  const selectedId = selections?.[matchedWord.std_word_nm]
  if (selectedId == null) return matchedWord
  return candidates.find((c) => String(c.std_word_id) === String(selectedId)) ?? matchedWord
}

function matchWords(text, wordList, selections = {}) {
  const sorted = [...wordList].sort((a, b) => b.std_word_nm.length - a.std_word_nm.length)
  const result = []
  let pos = 0
  while (pos < text.length) {
    const match = sorted.find((w) => text.startsWith(w.std_word_nm, pos))
    if (match) {
      const candidates = candidatesFor(match, wordList)
      const word = resolveCandidate(match, candidates, selections)
      result.push({ word, matched: true, candidates })
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

function matchWordsByChunks(logical, wordList, selections = {}) {
  const chunks = splitLogicalChunks(logical)
  if (chunks.length === 0) return []
  if (chunks.length === 1) return matchWords(chunks[0], wordList, selections)
  const segments = []
  for (const chunk of chunks) segments.push(...matchWords(chunk, wordList, selections))
  return segments
}

function matchLogicalTerm(logical, wordList, selections = {}) {
  if (!logical?.trim() || !wordList?.length) return []
  if (hasExplicitBoundaries(logical)) return matchWordsByChunks(logical, wordList, selections)
  return matchWords(normalizeLogicalTerm(logical), wordList, selections)
}

function resolveLogicalSegments(logical, wordList, selections = {}) {
  const hasBounds   = hasExplicitBoundaries(logical)
  const normalized  = normalizeLogicalTerm(logical)
  const segments    = normalized && wordList.length ? matchLogicalTerm(logical, wordList, selections) : []
  const segmentsRev = !hasBounds && normalized && wordList.length
    ? matchWordsReverse(normalized, wordList, selections)
    : []
  const physForward = toPhysical(segments)
  const physReverse = toPhysical(segmentsRev)
  const isAmbiguous = !hasBounds && !!physForward && !!physReverse && physForward !== physReverse
  return { segments, segmentsRev, hasBounds, isAmbiguous, physForward, physReverse }
}

function matchWordsReverse(text, wordList, selections = {}) {
  const sorted = [...wordList].sort((a, b) => b.std_word_nm.length - a.std_word_nm.length)
  const result = []
  let pos = text.length
  while (pos > 0) {
    const match = sorted.find(
      (w) => w.std_word_nm.length <= pos && text.slice(pos - w.std_word_nm.length, pos) === w.std_word_nm
    )
    if (match) {
      const candidates = candidatesFor(match, wordList)
      const word = resolveCandidate(match, candidates, selections)
      result.unshift({ word, matched: true, candidates })
      pos -= match.std_word_nm.length
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
  return matchedWords.filter((w) => allWords.filter((x) => x.std_word_nm === w.std_word_nm).length > 1)
}

function getSortedWordKey(segments) {
  return segments.filter((s) => s.matched).map((s) => s.word.std_word_nm).sort().join('')
}

function findSynonymTerm(normalizedLogical, segments, existingTerms, wordList, excludeTermId = null) {
  const key = getSortedWordKey(segments)
  if (!key) return null
  for (const term of existingTerms) {
    if (excludeTermId != null && term.std_term_id === excludeTermId) continue
    const termNorm = normalizeLogicalTerm(term.logical_term_nm)
    if (termNorm === normalizedLogical) continue
    if (getSortedWordKey(matchLogicalTerm(term.logical_term_nm, wordList)) === key) return term
  }
  return null
}

function validateTermFields(input, ctx = {}) {
  const {
    logical_term_nm, physical_term_nm, domain_group_nm, std_domain_id, info_type_nm,
    data_type_nm, data_len, subject_area_id, std_term_id, word_selections,
  } = input
  const { words = [], domains = [], existingTerms = [], requireDomainGroup = false } = ctx
  const wordSelections = word_selections || {}
  const errors = []

  if (!subject_area_id?.trim()) errors.push('주제영역은 필수입니다.')
  if (!logical_term_nm?.trim()) errors.push('논리명은 필수입니다.')
  if (!physical_term_nm?.trim()) errors.push('물리명은 필수입니다.')
  if (requireDomainGroup && !domain_group_nm?.trim()) errors.push('도메인 그룹명은 필수입니다.')
  if (!data_type_nm) errors.push('데이터타입은 필수입니다.')
  if (!data_len?.trim()) errors.push('데이터 길이를 입력하세요.')
  else {
    const dataLenErr = validateDataLength(data_len, data_type_nm)
    if (dataLenErr) errors.push(dataLenErr)
  }

  const normalized = normalizeLogicalTerm(logical_term_nm)
  const {
    segments,
    isAmbiguous,
    physForward,
    physReverse,
  } = resolveLogicalSegments(logical_term_nm, words, wordSelections)
  const phys        = (physical_term_nm || '').trim().toUpperCase()

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
      errors.push(`물리명의 마지막 단어 "${lastAbbr}"(${lastWord.std_word_nm})은 분류어가 아닙니다.`)
    }
  }

  const homonyms = findHomonyms(segments.filter((s) => s.matched).map((s) => s.word), words)
    .filter((w) => wordSelections[w.std_word_nm] == null)
  if (homonyms.length) {
    errors.push(`동음이의어 확인 필요: ${homonyms.map((w) => `"${w.std_word_nm}"`).join(', ')} — 매칭 결과의 선택 상자에서 사용할 항목을 선택하세요.`)
  }

  const synonym = findSynonymTerm(normalized, segments, existingTerms, words, std_term_id ?? null)
  if (synonym) {
    errors.push(`동의 용어 검토 필요: 등록된 용어 "${synonym.logical_term_nm}"과 단어 구성이 동일합니다.`)
  }

  if (domain_group_nm && domains.length && !domains.some((d) => d.domain_group_nm === domain_group_nm)) {
    errors.push(`도메인 그룹명 "${domain_group_nm}"에 해당하는 표준 도메인 그룹이 없습니다.`)
  }
  if (domain_group_nm && domain_group_nm !== '코드' && !std_domain_id && !info_type_nm?.trim()) {
    errors.push('코드 그룹이 아닌 경우 도메인 인포타입을 입력해야 합니다.')
  }

  const dt = data_type_nm?.trim().toUpperCase()
  if (dt && !VALID_DATA_TYPES.includes(dt)) {
    errors.push(`데이터타입 "${data_type_nm}"은 허용되지 않습니다. (${VALID_DATA_TYPES.join(', ')})`)
  }

  return { firstError: errors[0] ?? null }
}

function assertTermValid(input, ctx) {
  const { firstError } = validateTermFields(input, ctx)
  if (firstError) throw new Error(firstError)
}

async function loadTermValidationContext(client) {
  const [wordsRes, domainsRes, termsRes] = await Promise.all([
    client.query(`SELECT std_word_id, std_word_nm, abb_word_nm, taxon_yn FROM meta_std_word_m`),
    client.query(`SELECT domain_group_nm, info_type_nm FROM meta_std_domain_m`),
    client.query(`SELECT std_term_id, logical_term_nm FROM meta_std_term_m`),
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
    const { search, use_yn, subject_area_id, system_id, unassigned, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(t.logical_term_nm ILIKE $${params.length} OR t.physical_term_nm ILIKE $${params.length} OR t.domain_group_nm ILIKE $${params.length})`)
    }
    if (use_yn)            { params.push(use_yn);            conditions.push(`t.use_yn = $${params.length}`) }
    if (subject_area_id)   { params.push(subject_area_id);   conditions.push(`t.subject_area_id = $${params.length}`) }
    if (system_id) {
      params.push(Number(system_id))
      conditions.push(`s.system_id = $${params.length}`)
    }
    if (unassigned === 'Y') {
      conditions.push(`t.subject_area_id IS NOT NULL AND s.system_id IS NULL`)
    }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)
    const fromJoin = `
       FROM meta_std_term_m t
       LEFT JOIN meta_std_domain_m d ON d.std_domain_id = t.std_domain_id
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = t.subject_area_id
    `

    const countResult = await pool.query(`SELECT COUNT(*) ${fromJoin} ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT t.*, d.std_domain_nm, s.subject_area_nm, s.system_nm, s.system_id
       ${fromJoin}
       ${where}
       ORDER BY t.std_term_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/terms/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, d.std_domain_nm, s.subject_area_nm
       FROM meta_std_term_m t
       LEFT JOIN meta_std_domain_m d ON d.std_domain_id = t.std_domain_id
       LEFT JOIN meta_subject_area_m s ON s.subject_area_id = t.subject_area_id
       WHERE t.std_term_id = $1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ message: '용어를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// '코드' 그룹 도메인 자동 생성 헬퍼
async function ensureCodeDomain(client, { logical_term_nm, data_type_nm, data_len, subject_area_id }) {
  const TYPE_ABBR = { VARCHAR:'VC', CHAR:'CH', NUMBER:'NM', INTEGER:'IN', DATE:'DT', TIMESTAMP:'TS', BOOLEAN:'BL', CLOB:'CL' }
  const abbr     = TYPE_ABBR[data_type_nm?.toUpperCase()] ?? (data_type_nm ?? 'VC').slice(0, 2).toUpperCase()
  const lenPart = data_len != null ? String(data_len).trim() : ''
  const info_type_nm = `${logical_term_nm}${abbr}${lenPart}`

  const existing = await client.query(
    `SELECT std_domain_id FROM meta_std_domain_m WHERE info_type_nm = $1 LIMIT 1`, [info_type_nm]
  )
  if (existing.rows.length) return existing.rows[0].std_domain_id

  await client.query(
    `INSERT INTO meta_domain_group_m (domain_group_nm, use_yn) VALUES ('코드', 'Y') ON CONFLICT (domain_group_nm) DO NOTHING`
  )

  const ins = await client.query(
    `INSERT INTO meta_std_domain_m (std_domain_nm, data_type_nm, info_type_nm, domain_group_nm, data_len, use_yn, subject_area_id)
     VALUES ($1,$2,$3,'코드',$4,'Y',$5) RETURNING std_domain_id`,
    [logical_term_nm, data_type_nm?.toUpperCase() ?? 'VARCHAR', info_type_nm,
     lenPart || null,
     subject_area_id ?? null]
  )
  return ins.rows[0].std_domain_id
}

// POST /api/terms
router.post('/', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { logical_term_nm, physical_term_nm, domain_group_nm, data_type_nm, std_term_desc, use_yn = 'Y', subject_area_id, word_selections } = req.body
    const data_len = normalizeTermDataLen(req.body.data_len, data_type_nm, req.body.data_scale) || null
    let { std_domain_id } = req.body

    const vctx = await loadTermValidationContext(client)
    assertTermValid(
      { logical_term_nm, physical_term_nm, domain_group_nm, std_domain_id, data_type_nm, data_len, subject_area_id, word_selections },
      { ...vctx, requireDomainGroup: true }
    )

    if (domain_group_nm === '코드' && !std_domain_id) {
      std_domain_id = await ensureCodeDomain(client, { logical_term_nm, data_type_nm, data_len, subject_area_id })
    }

    const { rows } = await client.query(
      `INSERT INTO meta_std_term_m (logical_term_nm, physical_term_nm, domain_group_nm, std_domain_id, data_type_nm, data_len, std_term_desc, use_yn, subject_area_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [logical_term_nm, physical_term_nm, domain_group_nm ?? null, std_domain_id ?? null,
       data_type_nm, data_len, std_term_desc ?? null, use_yn, subject_area_id ?? null]
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
    const { logical_term_nm, physical_term_nm, domain_group_nm, data_type_nm, std_term_desc, use_yn, subject_area_id, word_selections } = req.body
    const data_len = normalizeTermDataLen(req.body.data_len, data_type_nm, req.body.data_scale) || null
    let { std_domain_id } = req.body

    const vctx = await loadTermValidationContext(client)
    assertTermValid(
      {
        logical_term_nm, physical_term_nm, domain_group_nm, std_domain_id,
        data_type_nm, data_len, subject_area_id, std_term_id: Number(req.params.id), word_selections,
      },
      { ...vctx, requireDomainGroup: true }
    )

    if (domain_group_nm === '코드' && !std_domain_id) {
      std_domain_id = await ensureCodeDomain(client, { logical_term_nm, data_type_nm, data_len, subject_area_id })
    }

    const { rows } = await client.query(
      `UPDATE meta_std_term_m
       SET logical_term_nm=$1, physical_term_nm=$2, domain_group_nm=$3, std_domain_id=$4,
           data_type_nm=$5, data_len=$6, std_term_desc=$7, use_yn=$8, subject_area_id=$9
       WHERE std_term_id=$10 RETURNING *`,
      [logical_term_nm, physical_term_nm, domain_group_nm ?? null, std_domain_id ?? null,
       data_type_nm, data_len, std_term_desc ?? null, use_yn ?? 'Y', subject_area_id ?? null, req.params.id]
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
    const { rowCount } = await pool.query('DELETE FROM meta_std_term_m')
    res.json({ deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/terms/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM meta_std_term_m WHERE std_term_id = $1', [req.params.id])
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
      const rowNum    = Number(r.__rowNum) || (i + 2)
      const savepoint = `sp_row_${i}`

      await client.query(`SAVEPOINT ${savepoint}`)
      try {
        const logical_term_nm  = r.logical_term_nm?.trim()
        const physical_term_nm = r.physical_term_nm?.trim().toUpperCase()
        const domain_group_nm  = r.domain_group_nm?.trim() || null
        const data_type_nm     = r.data_type_nm?.trim().toUpperCase() || 'VARCHAR'
        const data_len         = normalizeTermDataLen(r.data_len, data_type_nm, r.data_scale) || null
        const use_yn           = r.use_yn?.trim().toUpperCase() || 'Y'
        const std_term_desc    = r.std_term_desc?.trim() || null
        const subject_area_id  = r.subject_area_id?.trim() || 'STD01'
        const info_type_nm     = r.info_type_nm?.trim()

        assertTermValid(
          { logical_term_nm, physical_term_nm, domain_group_nm, info_type_nm, data_type_nm, data_len, subject_area_id },
          vctx
        )

        let std_domain_id = r.std_domain_id || null
        if (info_type_nm) {
          const domRes = await client.query(
            `SELECT std_domain_id FROM meta_std_domain_m WHERE info_type_nm = $1 LIMIT 1`,
            [info_type_nm]
          )
          if (domRes.rows.length === 0)
            throw new Error(`도메인 인포타입 "${info_type_nm}"을 찾을 수 없습니다.`)
          std_domain_id = domRes.rows[0].std_domain_id
        } else if (domain_group_nm === '코드' && !std_domain_id) {
          std_domain_id = await ensureCodeDomain(client, { logical_term_nm, data_type_nm, data_len, subject_area_id })
        }

        await client.query(
          `INSERT INTO meta_std_term_m (logical_term_nm, physical_term_nm, domain_group_nm, std_domain_id, data_type_nm, data_len, std_term_desc, use_yn, subject_area_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [logical_term_nm, physical_term_nm, domain_group_nm, std_domain_id, data_type_nm, data_len, std_term_desc, use_yn, subject_area_id]
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({ row: rowNum, logical_term_nm })
        vctx.existingTerms.push({ std_term_id: null, logical_term_nm })
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
