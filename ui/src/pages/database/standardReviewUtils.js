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

const ERROR_CATEGORY_ORDER = ['엔티티명', '테이블명', '표준단어', '표준용어', '표준도메인']

/**
 * 검토 결과에서 오류(level=error)를 카테고리별로 집계
 */
export function classifyStandardReviewErrors(groups) {
  const map = new Map()

  const bump = (category, message, sample) => {
    if (!map.has(category)) {
      map.set(category, { category, count: 0, messages: new Map(), samples: [] })
    }
    const entry = map.get(category)
    entry.count += 1
    if (message) {
      entry.messages.set(message, (entry.messages.get(message) || 0) + 1)
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

  const categories = ERROR_CATEGORY_ORDER
    .map((category) => {
      const entry = map.get(category)
      if (!entry) {
        return {
          category,
          count: 0,
          topMessages: [],
          samples: [],
        }
      }
      const topMessages = [...entry.messages.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([message, count]) => ({ message, count }))
      return {
        category,
        count: entry.count,
        topMessages,
        samples: entry.samples,
      }
    })
    .concat(
      [...map.keys()]
        .filter((key) => !ERROR_CATEGORY_ORDER.includes(key))
        .map((category) => {
          const entry = map.get(category)
          const topMessages = [...entry.messages.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([message, count]) => ({ message, count }))
          return {
            category,
            count: entry.count,
            topMessages,
            samples: entry.samples,
          }
        }),
    )

  const totalErrors = categories.reduce((sum, c) => sum + c.count, 0)
  return { categories, totalErrors }
}
