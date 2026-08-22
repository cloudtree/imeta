/**
 * 표준 용어 검증 (VB 한영변환 / stdCheck / Sort 대응)
 */

import {
  normalizeDataLengthInput,
  validateDataLength,
  mergeLegacyLengthScale,
  DATA_LENGTH_MAX,
} from './dataLength'

const VALID_DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

/** @deprecated 내부 변환용 — 신규 코드에서는 normalizeDataLengthInput 사용 */
export function parseDataLenNumber(data_len) {
  if (data_len == null || data_len === '') return null
  const digits = String(data_len).trim().replace(/,/g, '')
  if (!/^\d+$/.test(digits)) return null
  return parseInt(digits, 10)
}

/** data_len / data_len 통합 정규화 */
export function normalizeDataLenValue(value, dataType, data_scale) {
  const merged = mergeLegacyLengthScale(value, data_scale, dataType)
  return normalizeDataLengthInput(merged ?? value, dataType)
}

/** 표준용어 데이터 길이 검증 — data_type_nm 기준 */
export function validateDataLen(data_len, data_type_nm, data_scale) {
  return validateDataLength(data_len, data_type_nm, data_scale)
}

export { DATA_LENGTH_MAX }

/** VB korToEng: '_' 및 공백 제거 후 파싱 (비교·저장용) */
export function normalizeLogicalTerm(logical) {
  return (logical || '').replace(/_/g, '').replace(/\s+/g, '')
}

/** 사용자가 공백으로 단어 경계를 명시했는지 */
export function hasExplicitBoundaries(logical) {
  return /\s/.test(logical || '')
}

/** 공백 기준 구간 분리 (각 구간 내 연속 매칭) */
export function splitLogicalChunks(logical) {
  return (logical || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** 구간별 앞→뒤 매칭 후 병합 (예: "1학년 신청제한여부") */
export function matchWordsByChunks(logical, wordList, selections = {}) {
  const chunks = splitLogicalChunks(logical)
  if (chunks.length === 0) return []
  if (chunks.length === 1) return matchWords(chunks[0], wordList, selections)

  const segments = []
  for (const chunk of chunks) {
    segments.push(...matchWords(chunk, wordList, selections))
  }
  return segments
}

/**
 * 논리명 매칭 — 공백이 있으면 구간별 매칭, 없으면 전체 연속 매칭
 */
export function matchLogicalTerm(logical, wordList, selections = {}) {
  if (!logical?.trim() || !wordList?.length) return []
  if (hasExplicitBoundaries(logical)) return matchWordsByChunks(logical, wordList, selections)
  return matchWords(normalizeLogicalTerm(logical), wordList, selections)
}

/** 저장된 물리명에서 실제 선택됐던 동음이의어 후보를 역추론 (편집 시 드롭다운 복원용) */
export function inferWordSelections(logical, physical, wordList) {
  if (!logical?.trim() || !physical?.trim() || !wordList?.length) return {}
  const segments = matchLogicalTerm(logical, wordList)
  const physParts = physical.trim().toUpperCase().split('_')
  const selections = {}
  segments.filter((s) => s.matched).forEach((seg, i) => {
    if (!seg.candidates) return
    const match = seg.candidates.find((c) => c.abb_word_nm?.toUpperCase() === physParts[i])
    if (match) selections[seg.word.std_word_nm] = match.std_word_id
  })
  return selections
}

/** 앞/뒤 매칭 결과 및 모호성 판정 */
export function resolveLogicalSegments(logical, wordList, selections = {}) {
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

/** 매칭된 단어명과 동일한 단어명을 가진 모든 등록 항목(동음이의어 후보) */
function candidatesFor(matchedWord, wordList) {
  const same = wordList.filter((w) => w.std_word_nm === matchedWord.std_word_nm)
  return same.length > 1 ? same : undefined
}

/** 동음이의어 후보 중 선택된 항목(없으면 기본 매칭 결과 유지) */
function resolveCandidate(matchedWord, candidates, selections) {
  if (!candidates) return matchedWord
  const selectedId = selections?.[matchedWord.std_word_nm]
  if (selectedId == null) return matchedWord
  return candidates.find((c) => String(c.std_word_id) === String(selectedId)) ?? matchedWord
}

/** VB GetEng — 앞에서부터 최장 매칭 */
export function matchWords(text, wordList, selections = {}) {
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
      if (last && !last.matched) {
        last.text += text[pos]
      } else {
        result.push({ matched: false, text: text[pos] })
      }
      pos += 1
    }
  }
  return result
}

/** VB GetEngRev — 뒤에서부터 최장 매칭 */
export function matchWordsReverse(text, wordList, selections = {}) {
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
      if (first && !first.matched) {
        first.text = text[pos - 1] + first.text
      } else {
        result.unshift({ matched: false, text: text[pos - 1] })
      }
      pos -= 1
    }
  }
  return result
}

export function toPhysical(segments) {
  return segments
    .filter((s) => s.matched)
    .map((s) => s.word.abb_word_nm.toUpperCase())
    .join('_')
}

/** VB HasDup — 동일 단어명이 사전에 2건 이상 */
export function findHomonyms(matchedWords, allWords) {
  return matchedWords.filter(
    (w) => allWords.filter((x) => x.std_word_nm === w.std_word_nm).length > 1
  )
}

/** VB Sort — 분리 단어 정렬 후 연결한 키 */
export function getSortedWordKey(segments) {
  return segments
    .filter((s) => s.matched)
    .map((s) => s.word.std_word_nm)
    .sort()
    .join('')
}

/** VB Sort — 동의 용어(단어 구성 동일, 논리명 상이) 검토 */
export function findSynonymTerm(normalizedLogical, segments, existingTerms, wordList, excludeTermId = null) {
  const key = getSortedWordKey(segments)
  if (!key) return null

  for (const term of existingTerms) {
    if (excludeTermId != null && term.std_term_id === excludeTermId) continue
    const termNorm = normalizeLogicalTerm(term.logical_term_nm)
    if (termNorm === normalizedLogical) continue
    const termSegs = matchLogicalTerm(term.logical_term_nm, wordList)
    if (getSortedWordKey(termSegs) === key) return term
  }
  return null
}

/**
 * 표준 용어 통합 검증
 * @returns {{ errors: string[], segments, physForward, physReverse, firstError: string|null }}
 */
export function validateTermFields(input, ctx = {}) {
  const {
    subject_area_id,
    logical_term_nm,
    physical_term_nm,
    domain_group_nm,
    std_domain_id,
    info_type_nm,
    data_type_nm,
    data_len: rawDataLen,
    use_yn,
    std_term_id,
  } = input

  const data_len = normalizeDataLenValue(
    mergeLegacyLengthScale(rawDataLen, input.data_scale, data_type_nm) ?? rawDataLen,
    data_type_nm,
  )

  const { words = [], domains = [], existingTerms = [], requireDomainGroup = true } = ctx
  const errors = []

  if (!subject_area_id?.trim()) errors.push('주제영역을 선택하세요.')
  if (!logical_term_nm?.trim()) errors.push('논리명을 입력하세요.')
  if (!physical_term_nm?.trim()) errors.push('물리명을 입력하세요.')
  if (requireDomainGroup && !domain_group_nm?.trim()) errors.push('도메인 그룹명을 선택하세요.')
  if (!data_type_nm) errors.push('데이터 타입을 선택하세요.')
  if (!data_len?.trim()) errors.push('데이터 길이를 입력하세요.')
  else {
    const dataLenErr = validateDataLen(data_len, data_type_nm, input.data_scale)
    if (dataLenErr) errors.push(dataLenErr)
  }

  const normalized = normalizeLogicalTerm(logical_term_nm)
  const wordSelections = input._wordSelections || {}
  const {
    segments,
    isAmbiguous,
    physForward,
    physReverse,
  } = resolveLogicalSegments(logical_term_nm, words, wordSelections)
  const phys         = (physical_term_nm || '').trim().toUpperCase()

  // VB FindDicEng — 비표준 단어
  if (normalized && words.length > 0) {
    const unmatched = segments.filter((s) => !s.matched)
    if (unmatched.length > 0) {
      errors.push(
        `논리명에 표준단어에 등록되지 않은 단어가 포함되어 있습니다: ${unmatched.map((s) => `"${s.text}"`).join(', ')}`
      )
    } else if (!physForward) {
      errors.push('논리명을 표준단어로 변환할 수 없습니다.')
    }
  }

  // VB column 25 — 앞/뒤 파싱 결과 비교 (공백으로 경계를 지정한 경우는 제외)
  if (isAmbiguous) {
    errors.push(`단어 분리가 모호합니다. 앞→뒤: ${physForward} / 뒤→앞: ${physReverse} — 공백으로 구분해 보세요. (예: "1학년 신청제한여부")`)
  }

  if (phys && !/^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(phys)) {
    errors.push('물리명은 영문/숫자를 "_"로 구분하는 형식이어야 합니다. (예: CUST_NO)')
  }

  // VB Len(engAtt) > 30
  if (phys.length > 30) {
    errors.push(`물리명은 30자를 초과할 수 없습니다. (현재 ${phys.length}자)`)
  }

  // 논리명 변환 결과와 물리명 일치
  if (phys && physForward && phys !== physForward) {
    errors.push(`물리명이 논리명 변환 결과와 일치하지 않습니다. (예상: ${physForward}, 입력: ${phys})`)
  }

  // VB stdCheck — 마지막 단어 분류어
  if (phys && words.length > 0) {
    const lastAbbr = phys.split('_').pop()
    const lastWord = words.find((w) => w.abb_word_nm?.toUpperCase() === lastAbbr)
    if (!lastWord) {
      errors.push(`물리명의 마지막 단어 "${lastAbbr}"은 표준단어에 등록되지 않은 약어입니다.`)
    } else if (lastWord.taxon_yn !== 'Y') {
      errors.push(
        `물리명의 마지막 단어 "${lastAbbr}"(${lastWord.std_word_nm})은 분류어가 아닙니다. 분류어로 지정된 단어만 사용 가능합니다.`
      )
    }
  }

  // VB HasDup — 동음이의어 (이미 선택한 항목은 통과)
  const matchedWords = segments.filter((s) => s.matched).map((s) => s.word)
  const homonyms     = findHomonyms(matchedWords, words)
    .filter((w) => wordSelections[w.std_word_nm] == null)
  if (homonyms.length > 0) {
    errors.push(`동음이의어 확인 필요: ${homonyms.map((w) => `"${w.std_word_nm}"`).join(', ')} — 매칭 결과의 선택 상자에서 사용할 항목을 선택하세요.`)
  }

  // VB Sort — 동의 용어 검토
  const synonym = findSynonymTerm(normalized, segments, existingTerms, words, std_term_id ?? null)
  if (synonym) {
    errors.push(`동의 용어 검토 필요: 등록된 용어 "${synonym.logical_term_nm}"과 단어 구성이 동일합니다.`)
  }

  if (domain_group_nm && domains.length > 0) {
    if (!domains.some((d) => d.domain_group_nm === domain_group_nm)) {
      errors.push(`도메인 그룹명 "${domain_group_nm}"에 해당하는 표준 도메인 그룹이 없습니다.`)
    }
  }

  if (domain_group_nm && domain_group_nm !== '코드' && !std_domain_id && !info_type_nm?.trim()) {
    errors.push('코드 그룹이 아닌 경우 도메인 인포타입을 입력해야 합니다.')
  }

  const dt = data_type_nm?.trim().toUpperCase()
  if (dt && !VALID_DATA_TYPES.includes(dt)) {
    errors.push(`데이터타입 "${data_type_nm}"은 허용되지 않습니다. (${VALID_DATA_TYPES.join(', ')})`)
  }

  const yn = use_yn?.trim().toUpperCase()
  if (yn && yn !== 'Y' && yn !== 'N') {
    errors.push('사용여부는 Y 또는 N 만 입력 가능합니다.')
  }

  return {
    errors,
    segments,
    physForward,
    physReverse,
    firstError: errors[0] ?? null,
  }
}

/** 분류어(단어명)와 도메인명이 일치하는 표준 도메인 목록 */
export function findDomainsByClassifier(classifierWordNm, domains) {
  if (!classifierWordNm?.trim()) return []
  const nm = classifierWordNm.trim()
  return domains.filter(
    (d) => d.std_domain_nm === nm && (d.use_yn ?? 'Y') === 'Y'
  )
}

/** 분류어와 유사한 인포타입(접두·포함) 도메인 목록 — exact 제외 */
export function findSimilarDomains(classifierWordNm, domains, excludeIds = new Set()) {
  if (!classifierWordNm?.trim()) return []
  const nm = classifierWordNm.trim()
  return domains.filter((d) => {
    if ((d.use_yn ?? 'Y') !== 'Y') return false
    if (excludeIds.has(d.std_domain_id)) return false
    if (d.std_domain_nm === nm) return false
    const info_type_nm = (d.info_type_nm || '').trim()
    const domainNm = (d.std_domain_nm || '').trim()
    return info_type_nm.startsWith(nm) || domainNm.startsWith(nm) || info_type_nm.includes(nm)
  })
}

/**
 * 논리명 마지막 분류어 기준 도메인·그룹 자동 제안
 * @returns {{ suggested, domain_group_nm?, std_domain_id?, data_type_nm?, data_len?, autoSelected }}
 */
export function suggestDomainFromClassifier(lastWord, domains) {
  if (!lastWord || lastWord.taxon_yn !== 'Y') {
    return { suggested: [], autoSelected: false }
  }

  const suggested = findDomainsByClassifier(lastWord.std_word_nm, domains)

  // '코드' 분류어 — 그룹만 지정, 인포타입은 저장 시 자동 생성
  if (lastWord.std_word_nm === '코드') {
    return {
      suggested,
      domain_group_nm: '코드',
      std_domain_id:     '',
      autoSelected:  true,
    }
  }

  if (suggested.length === 0) {
    return { suggested, autoSelected: false }
  }

  if (suggested.length === 1) {
    const dom = suggested[0]
    return {
      suggested,
      domain_group_nm: dom.domain_group_nm ?? '',
      std_domain_id:     dom.std_domain_id != null ? String(dom.std_domain_id) : '',
      data_type_nm:     dom.data_type_nm ?? 'VARCHAR',
      data_len:      dom.data_len != null ? String(dom.data_len) : '',
      autoSelected:  true,
    }
  }

  const groups = [...new Set(suggested.map((d) => d.domain_group_nm).filter(Boolean))]
  if (groups.length === 1) {
    return {
      suggested,
      domain_group_nm: groups[0],
      std_domain_id:     '',
      autoSelected:  'partial',
    }
  }

  return { suggested, autoSelected: false }
}

/** 엑셀/폼용 — 첫 번째 오류 메시지 반환 */
export function validateTermRow(row, ctx) {
  const data_type_nm = row.data_type_nm?.trim().toUpperCase()
  const data_len = normalizeDataLenValue(
    mergeLegacyLengthScale(row.data_len ?? row.data_len, row.data_scale, data_type_nm)
      ?? row.data_len ?? row.data_len,
    data_type_nm,
  )
  return validateTermFields({ ...row, data_type_nm, data_len }, ctx).firstError
}
