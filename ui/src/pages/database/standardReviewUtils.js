import {
  normalizeLogicalTerm,
  resolveLogicalSegments,
  findHomonyms,
  findSynonymTerm,
  suggestDomainFromClassifier,
  findDomainsByClassifier,
  findSimilarDomains,
} from '../../utils/termValidation'

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
 * 엔티티명 기준 테이블명 검토
 */
export function reviewEntityTableName(row, { words = [] } = {}) {
  const items = []
  let status = 'ok'

  const entityName = row.entity_name?.trim() || ''
  const tableName = row.table_name?.trim() || ''
  const normalizedEntity = normalizeLogicalTerm(entityName)
  const { segments, isAmbiguous, physForward, physReverse } = resolveLogicalSegments(entityName, words)
  const matchedWords = segments.filter((s) => s.matched).map((s) => s.word)
  const unmatched = segments.filter((s) => !s.matched)

  if (!entityName) {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'error',
      message: '엔티티명이 비어 있습니다.',
    }))
  } else if (!words.length) {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'warning',
      message: '표준단어 사전이 비어 있어 엔티티명을 검토할 수 없습니다.',
    }))
  } else if (unmatched.length > 0) {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'error',
      message: `엔티티명에 미등록 단어가 있습니다: ${unmatched.map((s) => `"${s.text}"`).join(', ')}`,
    }))
  } else if (!physForward) {
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'error',
      message: '엔티티명을 표준단어로 분해할 수 없습니다.',
    }))
  } else {
    const breakdown = matchedWords
      .map((w) => `${w.word_nm}(${w.abb_word_nm})`)
      .join(' + ')
    status = bumpStatus(status, addItem(items, {
      category: '엔티티명',
      level: 'ok',
      message: `엔티티명 단어 분해: ${breakdown}`,
      detail: `단어 기반 물리명 예상: ${physForward}`,
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
        message: `동음이의어 확인: ${homonyms.map((w) => `"${w.word_nm}"`).join(', ')}`,
      }))
    }
  }

  if (!tableName) {
    status = bumpStatus(status, addItem(items, {
      category: '테이블명',
      level: 'error',
      message: '테이블명이 비어 있습니다.',
    }))
  } else {
    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
      status = bumpStatus(status, addItem(items, {
        category: '테이블명',
        level: 'warning',
        message: `테이블명 "${tableName}"은 소문자 영문·숫자·밑줄(snake_case) 형식을 권장합니다.`,
      }))
    }

    if (physForward) {
      const expected = physForward.toLowerCase()
      const actual = tableName.toLowerCase()
      if (actual === expected) {
        status = bumpStatus(status, addItem(items, {
          category: '테이블명',
          level: 'ok',
          message: `테이블명이 엔티티명 단어 분해 결과와 일치합니다. (${tableName})`,
        }))
      } else {
        const lastWord = matchedWords[matchedWords.length - 1]
        const lastAbbr = lastWord?.abb_word_nm?.toLowerCase()
        const containsLast = lastAbbr && actual.includes(lastAbbr)

        status = bumpStatus(status, addItem(items, {
          category: '테이블명',
          level: containsLast ? 'warning' : 'error',
          message: `테이블명 "${tableName}"이 엔티티명 기준 예상명(${physForward})과 다릅니다.`,
          detail: containsLast
            ? `테이블명에 분류어 약어 "${lastAbbr}"가 포함되어 있습니다.`
            : '엔티티명과 테이블명 명명 규칙을 확인하세요.',
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

  const attributeName = row.attribute_name?.trim() || ''
  const columnName = row.column_name?.trim() || ''
  const domainName = row.domain_name?.trim() || ''
  const infotype = row.infotype?.trim() || ''
  const dataType = row.data_type?.trim() || ''
  const dataLength = row.data_length?.trim() || ''

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
      .map((w) => `${w.word_nm}(${w.abb_word_nm}${w.taxon_yn === 'Y' ? ', 분류어' : ''})`)
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
        message: `동음이의어: ${homonyms.map((w) => `"${w.word_nm}"`).join(', ')}`,
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
        message: `마지막 단어 "${lastWord.word_nm}"은 분류어가 아닙니다.`,
      }))
    }
  }

  const exactTerm = terms.find(
    (t) => normalizeLogicalTerm(t.logical_term) === normalizedAttr && (t.use_yn ?? 'Y') === 'Y',
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
      message: `표준용어 일치: "${exactTerm.logical_term}"`,
      detail: [
        `물리명: ${exactTerm.physical_term}`,
        exactTerm.domain_div_cd ? `도메인그룹: ${exactTerm.domain_div_cd}` : null,
        exactTerm.data_type ? `데이터타입: ${exactTerm.data_type}` : null,
        exactTerm.data_len ? `데이터길이: ${exactTerm.data_len}` : null,
      ].filter(Boolean).join(' · '),
    }))

    if (columnName && normPhysical(exactTerm.physical_term) !== normPhysical(columnName)) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'error',
        message: `컬럼명 불일치 (정의서: ${columnName}, 표준: ${exactTerm.physical_term})`,
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
      const termNorm = normalizeLogicalTerm(t.logical_term)
      return termNorm.includes(normalizedAttr) || normalizedAttr.includes(termNorm)
    }).slice(0, 3)

    if (similarTerms.length > 0) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'info',
        message: `유사 용어: ${similarTerms.map((t) => `"${t.logical_term}"(${t.physical_term})`).join(', ')}`,
      }))
    }
  }

  if (words.length && matchedWords.length) {
    const synonym = findSynonymTerm(normalizedAttr, segments, terms, words)
    if (synonym) {
      status = bumpStatus(status, addItem(items, {
        category: '표준용어',
        level: 'warning',
        message: `동의 용어: "${synonym.logical_term}"(${synonym.physical_term})`,
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
          && (d.domain_nm === domainName || (d.infotype || '').includes(domainName)),
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
          message: `도메인명 매칭: ${dom.domain_nm} (${dom.infotype || '-'})`,
        }))
      } else {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'warning',
          message: `도메인명 "${domainName}" ${byName.length}건 매칭`,
        }))
      }
    }

    if (infotype) {
      const byInfotype = domains.filter(
        (d) => (d.use_yn ?? 'Y') === 'Y' && (d.infotype || '').trim() === infotype,
      )
      if (byInfotype.length === 0) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'error',
          message: `인포타입 "${infotype}" 매칭 없음`,
        }))
      } else if (byInfotype.length === 1) {
        const dom = byInfotype[0]
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'ok',
          message: `인포타입 매칭: ${dom.infotype} (${dom.domain_nm})`,
        }))

        if (dataType && dom.data_type && dataType.toUpperCase() !== dom.data_type.toUpperCase()) {
          status = bumpStatus(status, addItem(items, {
            category: '표준도메인',
            level: 'warning',
            message: `데이터타입 불일치 (정의서: ${dataType}, 표준: ${dom.data_type})`,
          }))
        }
      }
    }

    const lastWord = matchedWords[matchedWords.length - 1]
    if (lastWord?.taxon_yn === 'Y') {
      const exactClassifier = findDomainsByClassifier(lastWord.word_nm, domains)
      if (exactClassifier.length > 0 && !domainName && !infotype) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'info',
          message: `분류어 "${lastWord.word_nm}" 도메인: ${exactClassifier.map((d) => d.domain_nm).join(', ')}`,
        }))
      }

      const similar = findSimilarDomains(
        lastWord.word_nm,
        domains,
        new Set(exactClassifier.map((d) => d.domain_id)),
      )
      if (similar.length > 0 && !domainName && !infotype) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'info',
          message: `유사 도메인: ${similar.slice(0, 3).map((d) => d.domain_nm).join(', ')}`,
        }))
      }

      const suggestion = suggestDomainFromClassifier(lastWord, domains)
      if (suggestion.autoSelected && suggestion.domain_id && !domainName && !infotype) {
        const suggested = domains.find((d) => String(d.domain_id) === String(suggestion.domain_id))
        if (suggested) {
          status = bumpStatus(status, addItem(items, {
            category: '표준도메인',
            level: 'info',
            message: `권장 도메인: ${suggested.domain_nm} (${suggested.infotype || '-'})`,
          }))
        }
      }
    }

    if (exactTerm?.domain_id) {
      const termDomain = domains.find((d) => d.domain_id === exactTerm.domain_id)
      if (termDomain && !infotype && !domainName) {
        status = bumpStatus(status, addItem(items, {
          category: '표준도메인',
          level: 'info',
          message: `표준용어 연결 도메인: ${termDomain.domain_nm}`,
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
    def_id: row.def_id,
    entity_name: row.entity_name,
    table_name: row.table_name,
    attribute_name: row.attribute_name,
    column_name: row.column_name,
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
    const tableKey = `${row.schema_name}|${row.db_type}|${row.table_name}`
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
      def_id: row.def_id,
      attribute_name: row.attribute_name,
      column_name: row.column_name,
      status,
      attributeReview,
    }

    if (!groupMap.has(tableKey)) {
      const group = {
        tableKey,
        entity_name: row.entity_name,
        table_name: row.table_name,
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
