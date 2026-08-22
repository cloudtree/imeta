import {
  normalizeLogicalTerm,
  resolveLogicalSegments,
  findHomonyms,
  findSynonymTerm,
  suggestDomainFromClassifier,
  findDomainsByClassifier,
  findSimilarDomains,
} from '../../utils/termValidation'

/** 엔티티명 필수 접미사 → 테이블명 대체 약어 */
export const ENTITY_TYPE_SUFFIX_MAP = {
  기본: 'M',
  이력: 'H',
  상세: 'D',
  내역: 'L',
  코드: 'C',
  집계: 'A',
  채번: 'N',
  백업: 'B',
  임시: 'T',
  로그: 'G',
  연계: 'I',
}

export const ENTITY_TYPE_SUFFIXES = Object.keys(ENTITY_TYPE_SUFFIX_MAP)

function normPhysical(value) {
  return (value || '').trim().toUpperCase()
}

function bumpStatus(current, level) {
  if (level === 'error') return 'error'
  if (level === 'warning' && current !== 'error') return 'warning'
  return current
}

function addItem(items, item) {
  items.push(item)
  return item.level
}

function buildReviewSection(items, status) {
  return { status, items }
}

/**
 * 엔티티명 끝의 유형 접미사(기본/이력/…) 추출
 */
export function extractEntityTypeSuffix(entityName) {
  const normalized = normalizeLogicalTerm(entityName)
  if (!normalized) return null

  // 긴 접미사 우선 (예: '상세' vs 단음절)
  const sorted = [...ENTITY_TYPE_SUFFIXES].sort((a, b) => b.length - a.length)
  for (const suffix of sorted) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      return {
        suffix,
        code: ENTITY_TYPE_SUFFIX_MAP[suffix],
        body: normalized.slice(0, -suffix.length),
      }
    }
    if (normalized === suffix) {
      return {
        suffix,
        code: ENTITY_TYPE_SUFFIX_MAP[suffix],
        body: '',
      }
    }
  }
  return null
}

/**
 * 엔티티 본문(접미사 제외) + 유형 약어로 예상 테이블명 생성 (대문자)
 */
function buildExpectedTableName(bodyPhysical, typeCode) {
  const body = (bodyPhysical || '').replace(/^_+|_+$/g, '').toUpperCase()
  const code = (typeCode || '').toUpperCase()
  if (!body) return code
  return `${body}_${code}`
}

/**
 * 엔티티명 기준 테이블명 검토
 */
export function reviewEntityTableName(row, { words = [] } = {}) {
  const items = []
  let status = 'ok'

  const entityName = row.entity_nm?.trim() || ''
  const tableName = row.table_nm?.trim() || ''
  const typeInfo = extractEntityTypeSuffix(entityName)

  if (!entityName) {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'error',
      message: '엔티티명이 비어 있습니다.',
    }))
  } else if (!typeInfo) {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'error',
      message: `엔티티명 맨 끝에 유형 접미사가 없습니다. (${ENTITY_TYPE_SUFFIXES.join(', ')})`,
      detail: '예: 고객기본, 주문이력, 상품상세',
    }))
  } else {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'ok',
      message: `유형 접미사 "${typeInfo.suffix}" → 테이블 약어 "${typeInfo.code}"`,
    }))
  }

  const bodyLogical = typeInfo?.body || ''
  const {
    segments,
    isAmbiguous,
    physForward,
    physReverse,
  } = bodyLogical
    ? resolveLogicalSegments(bodyLogical, words)
    : { segments: [], isAmbiguous: false, physForward: '', physReverse: '' }

  const matchedWords = segments.filter((s) => s.matched).map((s) => s.word)
  const unmatched = segments.filter((s) => !s.matched)
  const expectedTableName = typeInfo && physForward
    ? buildExpectedTableName(physForward, typeInfo.code)
    : ''

  if (entityName && typeInfo) {
    if (!bodyLogical) {
      status = bumpStatus(status, addItem(items, {
        category: '엔티티명',
        level: 'error',
        message: `엔티티명이 유형 접미사("${typeInfo.suffix}")만으로 구성되어 있습니다.`,
      }))
    } else if (!words.length) {
      status = bumpStatus(status, addItem(items, {
        category: '엔티티명',
        level: 'warning',
        message: '표준단어 사전이 비어 있어 엔티티 본문을 검토할 수 없습니다.',
      }))
    } else if (unmatched.length > 0) {
      status = bumpStatus(status, addItem(items, {
        category: '엔티티명',
        level: 'error',
        message: `엔티티명(접미사 제외)에 미등록 단어가 있습니다: ${unmatched.map((s) => `"${s.text}"`).join(', ')}`,
      }))
    } else if (!physForward) {
      status = bumpStatus(status, addItem(items, {
        category: '엔티티명',
        level: 'error',
        message: '엔티티명 본문을 표준단어로 분해할 수 없습니다.',
      }))
    } else {
      const breakdown = [
        ...matchedWords.map((w) => `${w.std_word_nm}(${w.abb_word_nm})`),
        `${typeInfo.suffix}(${typeInfo.code})`,
      ].join(' + ')
      status = bumpStatus(status, addItem(items, {
        category: '엔티티명',
        level: 'ok',
        message: `엔티티명 단어 분해: ${breakdown}`,
        detail: `예상 테이블명: ${expectedTableName}`,
      }))

      if (isAmbiguous) {
        status = bumpStatus(status, addItem(items, {
          category: '엔티티명',
          level: 'warning',
          message: `엔티티명 단어 분리가 모호합니다. 앞→뒤: ${physForward} / 뒤→앞: ${physReverse}`,
        }))
      }

      const homonyms = findHomonyms(matchedWords, words)
      if (homonyms.length > 0) {
        status = bumpStatus(status, addItem(items, {
          category: '엔티티명',
          level: 'warning',
          message: `동음이의어 확인: ${homonyms.map((w) => `"${w.std_word_nm}"`).join(', ')}`,
        }))
      }
    }
  }

  if (!tableName) {
    status = bumpStatus(status, addItem(items, {
      category: '테이블명',
      level: 'error',
      message: '테이블명이 비어 있습니다.',
    }))
  } else {
    if (!/^[A-Z][A-Z0-9_]*$/.test(tableName)) {
      status = bumpStatus(status, addItem(items, {
        category: '테이블명',
        level: 'error',
        message: `테이블명 "${tableName}"은 대문자 영문·숫자·밑줄(SNAKE_CASE)로 작성해야 합니다.`,
      }))
    }

    if (typeInfo) {
      const actual = tableName.toUpperCase()
      const endsWithCode = new RegExp(`(^|_)${typeInfo.code.toUpperCase()}$`).test(actual)

      if (!endsWithCode) {
        status = bumpStatus(status, addItem(items, {
          category: '테이블명',
          level: 'error',
          message: `테이블명 끝이 유형 약어 "${typeInfo.code}"(${typeInfo.suffix})가 아닙니다.`,
          detail: `엔티티 접미사 "${typeInfo.suffix}"는 테이블명에서 "${typeInfo.code}"로 대체되어야 합니다.`,
        }))
      } else if (expectedTableName) {
        if (actual === expectedTableName) {
          status = bumpStatus(status, addItem(items, {
            category: '테이블명',
            level: 'ok',
            message: `테이블명이 엔티티 유형 규칙과 일치합니다. (${tableName})`,
            detail: `${typeInfo.suffix} → ${typeInfo.code}`,
          }))
        } else {
          status = bumpStatus(status, addItem(items, {
            category: '테이블명',
            level: 'error',
            message: `테이블명 "${tableName}"이 예상명(${expectedTableName})과 다릅니다.`,
            detail: `엔티티 본문 단어 약어 + "_${typeInfo.code}" 규칙을 확인하세요. (${typeInfo.suffix}→${typeInfo.code})`,
          }))
        }
      } else if (endsWithCode) {
        status = bumpStatus(status, addItem(items, {
          category: '테이블명',
          level: 'ok',
          message: `테이블명 끝이 유형 약어 "${typeInfo.code}"(${typeInfo.suffix})와 일치합니다.`,
        }))
      }
    }
  }

  return buildReviewSection(items, status)
}

/**
 * 속성명 기준 표준단어·표준용어·표준도메인 검토
 */
export function reviewAttributeStandards(row, { words = [], terms = [], domains = [] } = {}) {
  const items = []
  let status = 'ok'

  const attributeName = row.attribute_nm?.trim() || ''
  const columnName = row.column_nm?.trim() || ''
  const domainName = row.domain_nm?.trim() || ''
  const info_type_nm = row.info_type_nm?.trim() || ''
  const dataType = row.data_type_nm?.trim() || ''
  const dataLength = row.data_len?.trim() || ''

  const normalizedAttr = normalizeLogicalTerm(attributeName)
  const { segments, isAmbiguous, physForward, physReverse } = resolveLogicalSegments(attributeName, words)
  const matchedWords = segments.filter((s) => s.matched).map((s) => s.word)
  const unmatched = segments.filter((s) => !s.matched)

  if (!attributeName) {
    status = bumpStatus(status, addItem(items, {
      category: '표준단어',
      level: 'error',
      message: '속성명이 비어 있습니다.',
    }))
  } else if (!words.length) {
    status = bumpStatus(status, addItem(items, {
      category: '표준단어',
      level: 'warning',
      message: '표준단어 사전이 비어 있어 검토할 수 없습니다.',
    }))
  } else if (unmatched.length > 0) {
    status = bumpStatus(status, addItem(items, {
      category: '표준단어',
      level: 'error',
      message: `미등록 단어: ${unmatched.map((s) => `"${s.text}"`).join(', ')}`,
    }))
  } else if (!physForward) {
    status = bumpStatus(status, addItem(items, {
      category: '표준단어',
      level: 'error',
      message: '속성명을 표준단어로 분해할 수 없습니다.',
    }))
  } else {
    const breakdown = matchedWords
      .map((w) => `${w.std_word_nm}(${w.abb_word_nm}${w.taxon_yn === 'Y' ? ', 분류어' : ''})`)
      .join(' + ')
    status = bumpStatus(status, addItem(items, {
      category: '표준단어',
      level: 'ok',
      message: `단어 분해: ${breakdown}`,
      detail: `물리명 예상: ${physForward}`,
    }))

    const homonyms = findHomonyms(matchedWords, words)
    if (homonyms.length > 0) {
      status = bumpStatus(status, addItem(items, {
        category: '표준단어',
        level: 'warning',
        message: `동음이의어: ${homonyms.map((w) => `"${w.std_word_nm}"`).join(', ')}`,
      }))
    }

    if (isAmbiguous) {
      status = bumpStatus(status, addItem(items, {
        category: '표준단어',
        level: 'warning',
        message: `단어 분리 모호. 앞→뒤: ${physForward} / 뒤→앞: ${physReverse}`,
      }))
    }

    const lastWord = matchedWords[matchedWords.length - 1]
    if (lastWord && lastWord.taxon_yn !== 'Y') {
      status = bumpStatus(status, addItem(items, {
        category: '표준단어',
        level: 'warning',
        message: `마지막 단어 "${lastWord.std_word_nm}"은 분류어가 아닙니다.`,
      }))
    }
  }

  const exactTerm = terms.find(
    (t) => normalizeLogicalTerm(t.logical_term_nm) === normalizedAttr && (t.use_yn ?? 'Y') === 'Y',
  )

  if (!terms.length) {
    status = bumpStatus(status, addItem(items, {
      category: '표준용어',
      level: 'warning',
      message: '등록된 표준용어가 없습니다.',
    }))
  } else if (exactTerm) {
    status = bumpStatus(status, addItem(items, {
      category: '표준용어',
      level: 'ok',
      message: `표준용어 일치: "${exactTerm.logical_term_nm}"`,
      detail: [
        `물리명: ${exactTerm.physical_term_nm}`,
        exactTerm.domain_group_nm ? `도메인그룹: ${exactTerm.domain_group_nm}` : null,
        exactTerm.data_type_nm ? `데이터타입: ${exactTerm.data_type_nm}` : null,
        exactTerm.data_len ? `데이터길이: ${exactTerm.data_len}` : null,
      ].filter(Boolean).join(' · '),
    }))

    if (columnName && normPhysical(exactTerm.physical_term_nm) !== normPhysical(columnName)) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'error',
        message: `컬럼명 불일치 (정의서: ${columnName}, 표준: ${exactTerm.physical_term_nm})`,
      }))
    }
  } else {
    status = bumpStatus(status, addItem(items, {
      category: '표준용어',
      level: 'warning',
      message: `"${attributeName}"과 일치하는 표준용어가 없습니다.`,
      detail: physForward ? `권장 물리명: ${physForward}` : undefined,
    }))

    if (columnName && physForward && normPhysical(columnName) !== normPhysical(physForward)) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'error',
        message: `컬럼명 불일치 (정의서: ${columnName}, 예상: ${physForward})`,
      }))
    }

    const similarTerms = terms.filter((t) => {
      const termNorm = normalizeLogicalTerm(t.logical_term_nm)
      return termNorm.includes(normalizedAttr) || normalizedAttr.includes(termNorm)
    }).slice(0, 3)

    if (similarTerms.length > 0) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'info',
        message: `유사 용어: ${similarTerms.map((t) => `"${t.logical_term_nm}"(${t.physical_term_nm})`).join(', ')}`,
      }))
    }
  }

  if (words.length && matchedWords.length) {
    const synonym = findSynonymTerm(normalizedAttr, segments, terms, words)
    if (synonym) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'warning',
        message: `동의 용어: "${synonym.logical_term_nm}"(${synonym.physical_term_nm})`,
      }))
    }
  }

  if (!domains.length) {
    status = bumpStatus(status, addItem(items, {
      category: '표준도메인',
      level: 'warning',
      message: '등록된 표준도메인이 없습니다.',
    }))
  } else {
    if (domainName) {
      const byName = domains.filter(
        (d) => (d.use_yn ?? 'Y') === 'Y'
          && (d.std_domain_nm === domainName || (d.info_type_nm || '').includes(domainName)),
      )
      if (byName.length === 0) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'warning',
          message: `도메인명 "${domainName}" 매칭 없음`,
        }))
      } else if (byName.length === 1) {
        const dom = byName[0]
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'ok',
          message: `도메인명 매칭: ${dom.std_domain_nm} (${dom.info_type_nm || '-'})`,
        }))
      } else {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'warning',
          message: `도메인명 "${domainName}" ${byName.length}건 매칭`,
        }))
      }
    }

    if (info_type_nm) {
      const byInfotype = domains.filter(
        (d) => (d.use_yn ?? 'Y') === 'Y' && (d.info_type_nm || '').trim() === info_type_nm,
      )
      if (byInfotype.length === 0) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'error',
          message: `인포타입 "${info_type_nm}" 매칭 없음`,
        }))
      } else if (byInfotype.length === 1) {
        const dom = byInfotype[0]
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'ok',
          message: `인포타입 매칭: ${dom.info_type_nm} (${dom.std_domain_nm})`,
        }))

        if (dataType && dom.data_type_nm && dataType.toUpperCase() !== dom.data_type_nm.toUpperCase()) {
          status = bumpStatus(status, addItem(items, {
            category: '표준도메인',
            level: 'warning',
            message: `데이터타입 불일치 (정의서: ${dataType}, 표준: ${dom.data_type_nm})`,
          }))
        }
      }
    }

    const lastWord = matchedWords[matchedWords.length - 1]
    if (lastWord?.taxon_yn === 'Y') {
      const exactClassifier = findDomainsByClassifier(lastWord.std_word_nm, domains)
      if (exactClassifier.length > 0 && !domainName && !info_type_nm) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'info',
          message: `분류어 "${lastWord.std_word_nm}" 도메인: ${exactClassifier.map((d) => d.std_domain_nm).join(', ')}`,
        }))
      }

      const similar = findSimilarDomains(
        lastWord.std_word_nm,
        domains,
        new Set(exactClassifier.map((d) => d.std_domain_id)),
      )
      if (similar.length > 0 && !domainName && !info_type_nm) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'info',
          message: `유사 도메인: ${similar.slice(0, 3).map((d) => d.std_domain_nm).join(', ')}`,
        }))
      }

      const suggestion = suggestDomainFromClassifier(lastWord, domains)
      if (suggestion.autoSelected && suggestion.std_domain_id && !domainName && !info_type_nm) {
        const suggested = domains.find((d) => String(d.std_domain_id) === String(suggestion.std_domain_id))
        if (suggested) {
          status = bumpStatus(status, addItem(items, {
            category: '표준도메인',
            level: 'info',
            message: `권장 도메인: ${suggested.std_domain_nm} (${suggested.info_type_nm || '-'})`,
          }))
        }
      }
    }

    if (exactTerm?.std_domain_id) {
      const termDomain = domains.find((d) => d.std_domain_id === exactTerm.std_domain_id)
      if (termDomain && !info_type_nm && !domainName) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'info',
          message: `표준용어 연결 도메인: ${termDomain.std_domain_nm}`,
        }))
      }
    }
  }

  return buildReviewSection(items, status)
}

export function reviewStandardDefinitionRow(row, ctx) {
  const entityReview = reviewEntityTableName(row, ctx)
  const attributeReview = reviewAttributeStandards(row, ctx)
  const status = [entityReview.status, attributeReview.status].includes('error')
    ? 'error'
    : [entityReview.status, attributeReview.status].includes('warning')
      ? 'warning'
      : 'ok'

  return {
    table_def_id: row.table_def_id,
    entity_nm: row.entity_nm,
    table_nm: row.table_nm,
    attribute_nm: row.attribute_nm,
    column_nm: row.column_nm,
    status,
    entityReview,
    attributeReview,
  }
}

export function reviewSelectedDefinitions(rows, ctx) {
  const tableEntityCache = new Map()
  const groups = []
  const groupMap = new Map()

  for (const row of rows) {
    const tableKey = `${row.schema_nm}|${row.db_type_nm}|${row.table_nm}`
    if (!tableEntityCache.has(tableKey)) {
      tableEntityCache.set(tableKey, reviewEntityTableName(row, ctx))
    }

    const attributeReview = reviewAttributeStandards(row, ctx)
    const entityReview = tableEntityCache.get(tableKey)
    const status = [entityReview.status, attributeReview.status].includes('error')
      ? 'error'
      : [entityReview.status, attributeReview.status].includes('warning')
        ? 'warning'
        : 'ok'

    const item = {
      table_def_id: row.table_def_id,
      attribute_nm: row.attribute_nm,
      column_nm: row.column_nm,
      status,
      attributeReview,
    }

    if (!groupMap.has(tableKey)) {
      const group = {
        tableKey,
        schema_nm: row.schema_nm || '',
        entity_nm: row.entity_nm,
        table_nm: row.table_nm,
        entityReview,
        rows: [item],
      }
      groupMap.set(tableKey, group)
      groups.push(group)
    } else {
      groupMap.get(tableKey).rows.push(item)
    }
  }

  return groups
}

export function summarizeStandardReviewGroups(groups) {
  let total = 0
  let ok = 0
  let warning = 0
  let error = 0

  for (const group of groups) {
    for (const row of group.rows) {
      total += 1
      if (row.status === 'error') error += 1
      else if (row.status === 'warning') warning += 1
      else ok += 1
    }
  }

  return { total, ok, warning, error }
}

function bumpStatusCounts(bucket, status) {
  bucket.total += 1
  if (status === 'error') bucket.error += 1
  else if (status === 'warning') bucket.warning += 1
  else bucket.ok += 1
}

function scoreFromCounts({ total, ok, warning }) {
  if (!total) return null
  return Math.round(((ok + warning * 0.5) / total) * 100)
}

function worstStatus(...statuses) {
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('warning')) return 'warning'
  return 'ok'
}

/**
 * 서버 내 테이블·컬럼 단위 정상/주의(부분비표준)/오류(비표준) 집계
 */
export function summarizeUnitHealth(groups) {
  const tables = { total: 0, ok: 0, warning: 0, error: 0, score: null }
  const columns = { total: 0, ok: 0, warning: 0, error: 0, score: null }

  for (const group of groups || []) {
    const rowStatuses = (group.rows || []).map((row) => row.status || 'ok')
    const tableStatus = worstStatus(group.entityReview?.status || 'ok', ...rowStatuses)
    bumpStatusCounts(tables, tableStatus)

    for (const status of rowStatuses) {
      bumpStatusCounts(columns, status)
    }
  }

  tables.score = scoreFromCounts(tables)
  columns.score = scoreFromCounts(columns)

  return {
    tables,
    columns,
    legend: [
      { key: 'ok', label: '정상', desc: '표준 준수', color: '#34c759' },
      { key: 'warning', label: '주의', desc: '부분 비표준', color: '#ff9f0a' },
      { key: 'error', label: '오류', desc: '비표준', color: '#ff3b30' },
    ],
  }
}

const ERROR_CATEGORY_ORDER = ['엔티티명', '테이블명', '표준단어', '표준용어', '표준도메인']

const CATEGORY_CHART_COLORS = {
  엔티티명: '#ff3b30',
  테이블명: '#ff6b00',
  표준단어: '#ff9f0a',
  표준용어: '#af52de',
  표준도메인: '#5856d6',
  기타: '#8e8e93',
}

/**
 * 분류(카테고리)별 정상/주의/오류 건수와 준수율 집계 — 건강도 그래프용
 */
export function summarizeCategoryHealth(groups) {
  const map = new Map(
    ERROR_CATEGORY_ORDER.map((category) => [
      category,
      { category, ok: 0, warning: 0, error: 0, total: 0, score: null, color: CATEGORY_CHART_COLORS[category] },
    ]),
  )

  const bump = (category, level) => {
    const key = map.has(category) ? category : '기타'
    if (!map.has(key)) {
      map.set(key, {
        category: key,
        ok: 0,
        warning: 0,
        error: 0,
        total: 0,
        score: null,
        color: CATEGORY_CHART_COLORS[key] || CATEGORY_CHART_COLORS['기타'],
      })
    }
    const entry = map.get(key)
    if (level === 'error') entry.error += 1
    else if (level === 'warning') entry.warning += 1
    else if (level === 'ok') entry.ok += 1
    else return
    entry.total += 1
  }

  for (const group of groups || []) {
    for (const item of group.entityReview?.items || []) {
      bump(item.category || '기타', item.level)
    }
    for (const row of group.rows || []) {
      for (const item of row.attributeReview?.items || []) {
        bump(item.category || '기타', item.level)
      }
    }
  }

  const items = [...map.values()]
    .filter((item) => item.total > 0 || ERROR_CATEGORY_ORDER.includes(item.category))
    .map((item) => {
      const score =
        item.total > 0
          ? Math.round(((item.ok + item.warning * 0.5) / item.total) * 100)
          : null
      return { ...item, score }
    })
    .sort((a, b) => {
      const ai = ERROR_CATEGORY_ORDER.indexOf(a.category)
      const bi = ERROR_CATEGORY_ORDER.indexOf(b.category)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })

  return { items, categories: ERROR_CATEGORY_ORDER }
}

/**
 * 개별 오류 메시지를 짧은 분류 라벨로 정규화 (집계용)
 */
export function classifyFindingKind(category, message = '') {
  const msg = String(message)

  if (category === '표준단어') {
    if (msg.startsWith('미등록 단어') || msg.includes('미등록 단어가 있습니다')) return '미등록 단어'
    if (msg.includes('분해할 수 없습니다')) return '단어 분해 실패'
    if (msg.includes('비어 있습니다') || msg.includes('속성명이 비어')) return '속성명 누락'
    if (msg.includes('사전이 비어')) return '사전 없음'
    if (msg.includes('동음이의어')) return '동음이의어'
    if (msg.includes('모호')) return '분리 모호'
    if (msg.includes('분류어가 아닙니다')) return '분류어 아님'
  }

  if (category === '표준용어') {
    if (msg.includes('일치하는 표준용어가 없습니다')) return '용어 미매칭'
    if (msg.includes('컬럼명 불일치')) return '컬럼명 불일치'
    if (msg.includes('등록된 표준용어가 없습니다')) return '용어 사전 없음'
    if (msg.startsWith('유사 용어')) return '유사 용어'
    if (msg.startsWith('동의 용어')) return '동의 용어'
  }

  if (category === '표준도메인') {
    if (msg.includes('도메인명') && msg.includes('매칭 없음')) return '도메인명 미매칭'
    if (msg.includes('인포타입') && msg.includes('매칭 없음')) return '인포타입 미매칭'
    if (msg.includes('데이터타입 불일치')) return '데이터타입 불일치'
    if (msg.includes('등록된 표준도메인이 없습니다')) return '도메인 사전 없음'
    if (msg.startsWith('유사 도메인')) return '유사 도메인'
    if (msg.startsWith('권장 도메인')) return '권장 도메인'
    if (msg.includes('분류어') && msg.includes('도메인')) return '분류어 도메인'
    if (msg.includes('표준용어 연결 도메인')) return '용어 연결 도메인'
    if (msg.includes('건 매칭')) return '도메인 복수 매칭'
  }

  if (category === '엔티티명') {
    if (msg.includes('비어 있습니다')) return '엔티티명 누락'
    if (msg.includes('유형 접미사가 없습니다')) return '유형 접미사 누락'
    if (msg.includes('미등록 단어')) return '미등록 단어'
    if (msg.includes('분해할 수 없습니다')) return '단어 분해 실패'
    if (msg.includes('접미사') && msg.includes('만으로')) return '접미사만 구성'
    if (msg.includes('동음이의어')) return '동음이의어'
    if (msg.includes('모호')) return '분리 모호'
    if (msg.includes('사전이 비어')) return '사전 없음'
  }

  if (category === '테이블명') {
    if (msg.includes('비어 있습니다')) return '테이블명 누락'
    if (msg.includes('SNAKE_CASE')) return '명명규칙 위반'
    if (msg.includes('유형 약어')) return '유형 약어 불일치'
    if (msg.includes('예상명')) return '예상명 불일치'
  }

  const short = msg.replace(/\s+/g, ' ').trim()
  return short.length > 28 ? `${short.slice(0, 28)}…` : short || '기타'
}

/**
 * 카테고리별 오류 분류(kind) + 건수 집계 — 주요 발견 사항용
 * reasons: 원문 메시지별 건수 (표준단어/용어/도메인 상세 표시용)
 */
export function summarizeFindingKinds(groups, { levels = ['error'] } = {}) {
  const levelSet = new Set(levels)
  const byCategory = new Map()

  const bump = (category, message) => {
    const kind = classifyFindingKind(category, message)
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        category,
        total: 0,
        kinds: new Map(),
        reasons: new Map(),
      })
    }
    const entry = byCategory.get(category)
    entry.total += 1
    entry.kinds.set(kind, (entry.kinds.get(kind) || 0) + 1)
    const reason = String(message || '').replace(/\s+/g, ' ').trim() || kind
    entry.reasons.set(reason, (entry.reasons.get(reason) || 0) + 1)
  }

  for (const group of groups) {
    for (const item of group.entityReview?.items || []) {
      if (!levelSet.has(item.level)) continue
      bump(item.category || '기타', item.message)
    }
    for (const row of group.rows || []) {
      for (const item of row.attributeReview?.items || []) {
        if (!levelSet.has(item.level)) continue
        bump(item.category || '기타', item.message)
      }
    }
  }

  const orderIndex = (name) => {
    const i = ERROR_CATEGORY_ORDER.indexOf(name)
    return i === -1 ? 999 : i
  }

  return [...byCategory.values()]
    .map((entry) => ({
      category: entry.category,
      total: entry.total,
      kinds: [...entry.kinds.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .map(([kind, count]) => ({ kind, count })),
      reasons: [...entry.reasons.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
        .map(([message, count]) => ({
          message,
          count,
          kind: classifyFindingKind(entry.category, message),
        })),
    }))
    .sort((a, b) => orderIndex(a.category) - orderIndex(b.category) || b.total - a.total)
}

/**
 * 오류 분류별 지식그래프 노드 수집
 * 주제영역(스키마) → 엔티티명 → 테이블명 [→ 속성/컬럼]
 */
export function collectFindingGraphNodes(groups, { category, kind, message = null } = {}) {
  if (!category || !kind) return []

  const nodes = []
  const seen = new Set()
  const wantMessage = message ? String(message).replace(/\s+/g, ' ').trim() : null

  const matchesItem = (item) => {
    if (!(item.level === 'error' || item.level === 'warning')) return false
    if ((item.category || '') !== category) return false
    if (classifyFindingKind(category, item.message) !== kind) return false
    if (!wantMessage) return true
    return String(item.message || '').replace(/\s+/g, ' ').trim() === wantMessage
  }

  const pushNode = ({
    id,
    subjectArea,
    entityName,
    tableName,
    attributeName = null,
    columnName = null,
    messages = [],
  }) => {
    const key = [
      subjectArea,
      entityName || '(누락)',
      tableName,
      attributeName || '',
      columnName || '',
      kind,
      wantMessage || '',
      messages[0] || '',
    ].join('|')
    if (seen.has(key)) return
    seen.add(key)
    nodes.push({
      id: id || key,
      subjectArea,
      entityName: entityName || null,
      tableName,
      attributeName: attributeName || null,
      columnName: columnName || null,
      kind,
      messages,
      reason: messages[0] || kind,
    })
  }

  for (const group of groups || []) {
    const schema = (group.schema_nm || group.rows?.[0]?.schema_nm || '').trim() || '—'
    const entity = (group.entity_nm || '').trim()
    const table = (group.table_nm || '').trim() || '—'

    const entityMatched = (group.entityReview?.items || []).filter(matchesItem)
    if (entityMatched.length) {
      pushNode({
        id: `${group.tableKey || table}::entity::${kind}::${wantMessage || ''}`,
        subjectArea: schema,
        entityName: entity,
        tableName: table,
        messages: entityMatched.map((m) => m.message),
      })
    }

    for (const row of group.rows || []) {
      const attrMatched = (row.attributeReview?.items || []).filter(matchesItem)
      if (!attrMatched.length) continue

      pushNode({
        id: `${group.tableKey || table}::${row.column_nm || row.attribute_nm || 'col'}::${kind}::${wantMessage || attrMatched[0]?.message || ''}`,
        subjectArea: schema,
        entityName: entity,
        tableName: table,
        attributeName: (row.attribute_nm || '').trim() || null,
        columnName: (row.column_nm || '').trim() || null,
        messages: attrMatched.map((m) => m.message),
      })
    }
  }

  return nodes.sort((a, b) =>
    a.subjectArea.localeCompare(b.subjectArea, 'ko')
    || a.tableName.localeCompare(b.tableName, 'ko')
    || String(a.columnName || '').localeCompare(String(b.columnName || ''), 'ko'),
  )
}

/** @deprecated use collectFindingGraphNodes */
export function collectEntityNameGraphNodes(groups, { kind = '엔티티명 누락' } = {}) {
  return collectFindingGraphNodes(groups, { category: '엔티티명', kind })
}

/**
 * 테이블 그룹의 오류/주의 상세 항목 수집
 */
export function collectTableIssueDetails(group) {
  if (!group) return { entityItems: [], attributeItems: [] }

  const entityItems = (group.entityReview?.items || [])
    .filter((item) => item.level === 'error' || item.level === 'warning')
    .map((item) => ({
      scope: '엔티티/테이블',
      category: item.category,
      level: item.level,
      message: item.message,
      detail: item.detail || '',
    }))

  const attributeItems = []
  for (const row of group.rows || []) {
    for (const item of row.attributeReview?.items || []) {
      if (item.level !== 'error' && item.level !== 'warning') continue
      attributeItems.push({
        scope: row.column_nm || row.attribute_nm || '—',
        attribute: row.attribute_nm || '',
        column: row.column_nm || '',
        category: item.category,
        level: item.level,
        message: item.message,
        detail: item.detail || '',
      })
    }
  }

  return { entityItems, attributeItems }
}

/**
 * 검토 결과에서 오류(level=error)를 카테고리별로 집계
 */
export function classifyStandardReviewErrors(groups) {
  const map = new Map()

  const bump = (category, message, sample) => {
    if (!map.has(category)) {
      map.set(category, { category, count: 0, messages: new Map(), kinds: new Map(), samples: [] })
    }
    const entry = map.get(category)
    entry.count += 1
    if (message) {
      entry.messages.set(message, (entry.messages.get(message) || 0) + 1)
      const kind = classifyFindingKind(category, message)
      entry.kinds.set(kind, (entry.kinds.get(kind) || 0) + 1)
    }
    if (sample && entry.samples.length < 5) {
      entry.samples.push(sample)
    }
  }

  for (const group of groups) {
    const entityItems = group.entityReview?.items || []
    for (const item of entityItems) {
      if (item.level !== 'error') continue
      bump(item.category || '기타', item.message, {
        table: group.table_nm,
        entity: group.entity_nm,
        message: item.message,
      })
    }

    for (const row of group.rows) {
      const attrItems = row.attributeReview?.items || []
      for (const item of attrItems) {
        if (item.level !== 'error') continue
        bump(item.category || '기타', item.message, {
          table: group.table_nm,
          column: row.column_nm,
          attribute: row.attribute_nm,
          message: item.message,
        })
      }
    }
  }

  const toCategoryResult = (entry) => {
    const topMessages = [...entry.messages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([message, count]) => ({ message, count }))
    const kinds = [...entry.kinds.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .map(([kind, count]) => ({ kind, count }))
    return {
      category: entry.category,
      count: entry.count,
      topMessages,
      kinds,
      samples: entry.samples,
    }
  }

  const emptyCategory = (category) => ({
    category,
    count: 0,
    topMessages: [],
    kinds: [],
    samples: [],
  })

  const categories = ERROR_CATEGORY_ORDER
    .map((category) => {
      const entry = map.get(category)
      return entry ? toCategoryResult(entry) : emptyCategory(category)
    })
    .concat(
      [...map.keys()]
        .filter((key) => !ERROR_CATEGORY_ORDER.includes(key))
        .map((category) => toCategoryResult(map.get(category))),
    )

  const totalErrors = categories.reduce((sum, c) => sum + c.count, 0)
  return { categories, totalErrors }
}
