import {
  normalizeLogicalTerm,
  resolveLogicalSegments,
  toPhysical,
} from '../../utils/termValidation'
import { validateNoPluralEnglish } from '../../utils/wordValidation'
import { validateDataLength } from '../../utils/dataLength'

const STD_WORD_NM_MAX = 15
const PHYSICAL_TERM_MAX = 30

/** 표준 단어 지침 위반 여부 (POST /api/words/bulk가 실제로 검증하는 것과 동일한 규칙) */
export function getWordViolations(word, { existingWords = [], allWordRows = [] } = {}) {
  const issues = []
  if (!word.std_word_nm?.trim()) issues.push('단어명이 비어 있습니다.')
  else if (word.std_word_nm.length > STD_WORD_NM_MAX) issues.push(`단어명은 ${STD_WORD_NM_MAX}자 이내여야 합니다.`)
  if (!word.full_eng_nm?.trim()) issues.push('영문명이 비어 있습니다.')
  if (!word.abb_word_nm?.trim()) issues.push('영문약어가 비어 있습니다.')

  const abb = word.abb_word_nm?.trim().toUpperCase()
  if (abb) {
    if (existingWords.some((w) => w.abb_word_nm?.toUpperCase() === abb)) {
      issues.push(`영문약어 "${abb}"는 이미 등록되어 있습니다.`)
    } else if (allWordRows.some((w) => w._key !== word._key && w.abb_word_nm?.trim().toUpperCase() === abb)) {
      issues.push(`영문약어 "${abb}"가 다른 후보 단어와 중복됩니다.`)
    }
  }

  const pluralErr = validateNoPluralEnglish({ full_eng_nm: word.full_eng_nm, abb_word_nm: word.abb_word_nm })
  if (pluralErr) issues.push(pluralErr)

  return issues
}

/** 표준 도메인 지침 위반 여부 */
export function getDomainViolations(domain) {
  const issues = []
  if (!domain.std_domain_nm?.trim()) issues.push('도메인명이 비어 있습니다.')
  if (!domain.domain_group_nm?.trim()) issues.push('도메인그룹명이 비어 있습니다.')
  const lenErr = validateDataLength(domain.data_len, domain.data_type_nm)
  if (lenErr) issues.push(lenErr)
  return issues
}

/** 표준 용어 지침 위반 여부 */
export function getTermViolations(term) {
  const issues = []
  if (term._domainPending) issues.push('도메인이 아직 등록되지 않았습니다. 도메인 탭에서 먼저 등록하세요.')
  if (!term.domain_group_nm?.trim()) issues.push('도메인그룹명이 비어 있습니다.')
  const phys = (term.physical_term_nm || '').toUpperCase()
  if (phys.length > PHYSICAL_TERM_MAX) issues.push(`물리명이 ${PHYSICAL_TERM_MAX}자를 초과합니다. (${phys.length}자)`)
  const lenErr = validateDataLength(term.data_len, term.data_type_nm)
  if (lenErr) issues.push(lenErr)
  return issues
}

/** Postgres/Oracle 물리 데이터타입 → 표준 도메인/용어에서 쓰는 추상 데이터타입 */
const PG_TYPE_MAP = {
  varchar: 'VARCHAR', 'character varying': 'VARCHAR',
  text: 'CLOB',
  bpchar: 'CHAR', char: 'CHAR', character: 'CHAR',
  int2: 'INTEGER', int4: 'INTEGER', int8: 'INTEGER',
  serial: 'INTEGER', bigserial: 'INTEGER', smallserial: 'INTEGER',
  numeric: 'NUMBER', decimal: 'NUMBER', float4: 'NUMBER', float8: 'NUMBER', money: 'NUMBER',
  bool: 'BOOLEAN',
  date: 'DATE',
  timestamp: 'TIMESTAMP', timestamptz: 'TIMESTAMP',
}
const ORACLE_TYPE_MAP = {
  VARCHAR2: 'VARCHAR', NVARCHAR2: 'VARCHAR',
  CHAR: 'CHAR', NCHAR: 'CHAR',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
  TIMESTAMP: 'TIMESTAMP',
  CLOB: 'CLOB', LONG: 'CLOB', NCLOB: 'CLOB',
}
const NO_LENGTH_TYPES = new Set(['INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN'])

/** 컬럼 정의서 행의 원시 데이터타입/길이를 표준 데이터타입 규격으로 정규화 */
export function normalizeIntrospectedType(dbTypeNm, rawType, rawLen) {
  const isOracle = String(dbTypeNm || '').toUpperCase().startsWith('ORA')
  const map = isOracle ? ORACLE_TYPE_MAP : PG_TYPE_MAP
  const key = isOracle ? String(rawType || '').toUpperCase() : String(rawType || '').toLowerCase()
  const data_type_nm = map[key] || 'VARCHAR'
  const data_len = NO_LENGTH_TYPES.has(data_type_nm) ? '' : (rawLen || '')
  return { data_type_nm, data_len }
}

function sourceKey(row) {
  return `${row.schema_nm}.${row.table_nm}.${row.column_nm}`
}

function addSource(candidate, row) {
  const key = sourceKey(row)
  if (candidate._sourceKeys.has(key)) return
  candidate._sourceKeys.add(key)
  candidate._sourceRows.push({ schema_nm: row.schema_nm, table_nm: row.table_nm, column_nm: row.column_nm })
}

/**
 * 선택된 컬럼(코멘트) 목록을 단어/도메인/용어 후보로 분해한다.
 * — 표준검토(standardReviewUtils.js)와 동일한 매칭 엔진(termValidation.js)을 쓰지만,
 *   비교가 아니라 "없으면 후보로 만든다"는 방향으로 동작한다.
 *
 * @returns {{ wordCandidates, domainCandidates, termCandidates, warnings }}
 */
export function buildStandardCandidates(rows, { words = [], domains = [], terms = [], subjectAreaId } = {}) {
  const wordCandidates = new Map()   // std_word_nm -> candidate
  const domainCandidates = new Map() // std_domain_nm|data_type|data_len -> candidate
  const termCandidates = new Map()   // logical_term_nm -> candidate
  const warnings = []

  const existingTermKeys = new Set(terms.map((t) => normalizeLogicalTerm(t.logical_term_nm)))

  for (const row of rows) {
    const attributeNm = row.attribute_nm?.trim()
    if (!attributeNm) {
      warnings.push({ row, reason: '컬럼 코멘트가 비어 있습니다.' })
      continue
    }

    // 컬럼 코멘트는 종종 "(AWR/ASH/ADDM, 유료 라이선스 필요)" 같은 설명형 문구를 포함한다.
    // 이런 문구는 공백이 있으면 구간별로 쪼개 매칭하는 로직(resolveLogicalSegments)에 넣으면
    // 영어 단어 하나하나까지 "미등록 단어"로 폭발적으로 생성되므로, 순수 한글/영문/숫자/공백
    // 조합이 아닌(괄호·쉼표·슬래시 등 설명 부호가 섞인) 코멘트는 아예 후보 생성에서 제외한다.
    if (!/^[가-힣a-zA-Z0-9\s]+$/.test(attributeNm)) {
      warnings.push({ row, reason: `"${attributeNm}" — 설명이 포함된 코멘트로 보여 건너뜁니다.` })
      continue
    }

    // 이미 이번 분석에서 후보로 잡힌 단어도 매칭 대상에 포함해야
    // 같은 컬럼 안에서도 최장 매칭이 일관되게 동작한다.
    const wordPool = [...words, ...wordCandidates.values()]
    const { segments, isAmbiguous } = resolveLogicalSegments(attributeNm, wordPool)

    if (isAmbiguous) {
      warnings.push({ row, reason: `단어 분리가 모호합니다: "${attributeNm}" — 공백으로 구분해 보세요. (예: "1학년 신청제한여부")` })
      continue
    }
    if (!segments.length) {
      warnings.push({ row, reason: `"${attributeNm}"을(를) 단어로 분해할 수 없습니다.` })
      continue
    }

    const unmatched = segments.filter((s) => !s.matched)
    unmatched.forEach((s) => {
      const nm = s.text.trim()
      if (!nm) return
      if (!wordCandidates.has(nm)) {
        wordCandidates.set(nm, {
          _key: nm,
          _sourceKeys: new Set(),
          _sourceRows: [],
          std_word_nm: nm,
          full_eng_nm: '',
          abb_word_nm: '',
          kor_synonym_nm: '',
          taxon_yn: 'N',
          std_word_desc: '',
          use_yn: 'Y',
          subject_area_id: subjectAreaId,
        })
      }
      addSource(wordCandidates.get(nm), row)
    })

    if (unmatched.length > 0) {
      // 새 단어가 등록되기 전까지는 이 컬럼의 도메인·용어를 확정할 수 없음
      warnings.push({ row, reason: `"${attributeNm}" — 미등록 단어(${unmatched.map((s) => `"${s.text}"`).join(', ')})를 먼저 단어 탭에서 등록하세요.` })
      continue
    }

    const matchedWords = segments.map((s) => s.word)
    const lastWord = matchedWords[matchedWords.length - 1]
    const classifierNm = lastWord.std_word_nm
    const classifierCandidate = wordCandidates.get(classifierNm)

    if (lastWord.taxon_yn !== 'Y' && !classifierCandidate) {
      warnings.push({ row, reason: `"${attributeNm}"의 마지막 단어 "${classifierNm}"이(가) 분류어가 아닙니다.` })
      continue
    }
    // 신규 후보 단어가 용어의 마지막(분류어) 자리에 쓰였다면 분류어로 표시
    if (classifierCandidate) classifierCandidate.taxon_yn = 'Y'

    const { data_type_nm: dataTypeNm, data_len: dataLen } = normalizeIntrospectedType(row.db_type_nm, row.data_type_nm, row.data_len)
    // 이 앱의 표준 도메인은 분류어별 전용이 아니라 "데이터타입+길이" 모양 단위로 재사용된다
    // (예: 명칭도메인=VARCHAR(200)은 명/제목/코드명 등 여러 분류어에서 함께 쓰임).
    // 그래서 분류어 이름이 아니라 실제 shape(type+len)가 같은 기존 도메인이 있는지로 매칭한다.
    const matchedDomain = domains.find(
      (d) => (d.use_yn ?? 'Y') === 'Y'
        && (d.data_type_nm || '').toUpperCase() === dataTypeNm
        && String(d.data_len ?? '') === String(dataLen || ''),
    )

    let domainGroupNm = matchedDomain?.domain_group_nm ?? classifierNm
    let domainPending = !matchedDomain

    if (!matchedDomain) {
      const domainKey = `${classifierNm}|${dataTypeNm}|${dataLen}`
      if (!domainCandidates.has(domainKey)) {
        domainCandidates.set(domainKey, {
          _key: domainKey,
          _sourceKeys: new Set(),
          _sourceRows: [],
          std_domain_nm: classifierNm,
          domain_group_nm: classifierNm,
          data_type_nm: dataTypeNm || 'VARCHAR',
          data_len: dataLen,
          std_domain_desc: '',
          use_yn: 'Y',
          subject_area_id: subjectAreaId,
        })
      }
      addSource(domainCandidates.get(domainKey), row)
    }

    if (existingTermKeys.has(normalizeLogicalTerm(attributeNm))) continue

    if (!termCandidates.has(attributeNm)) {
      termCandidates.set(attributeNm, {
        _key: attributeNm,
        _sourceKeys: new Set(),
        _sourceRows: [],
        logical_term_nm: attributeNm,
        physical_term_nm: toPhysical(segments),
        domain_group_nm: domainGroupNm,
        data_type_nm: dataTypeNm || 'VARCHAR',
        data_len: dataLen,
        std_term_desc: attributeNm,
        use_yn: 'Y',
        subject_area_id: subjectAreaId,
        _domainPending: domainPending,
      })
    }
    addSource(termCandidates.get(attributeNm), row)
  }

  const strip = (c) => {
    const { _sourceKeys, ...rest } = c
    return rest
  }

  return {
    wordCandidates: [...wordCandidates.values()].map(strip),
    domainCandidates: [...domainCandidates.values()].map(strip),
    termCandidates: [...termCandidates.values()].map(strip),
    warnings,
  }
}

export function formatSourceRows(sourceRows, max = 3) {
  const preview = sourceRows.slice(0, max).map((r) => `${r.table_nm}.${r.column_nm}`).join(', ')
  const rest = sourceRows.length - max
  return rest > 0 ? `${preview} 외 ${rest}건` : preview
}
