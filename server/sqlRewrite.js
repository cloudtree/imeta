/**
 * 규칙 기반 SQL 재작성 — 튜닝 전/후 쿼리 생성
 * 텍스트 치환 가능한 규칙만 적용하고, DDL·통계 수집 등은 notes로 분리한다.
 */

// Oracle(VARCHAR2/CHAR/N...) + PostgreSQL(information_schema.columns.data_type, 대문자 정규화됨) 문자형
const CHAR_TYPES = new Set([
  'VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR',
  'CHARACTER VARYING', 'CHARACTER', 'TEXT', 'VARCHAR', 'BPCHAR', 'NAME',
])

function findCharNumericComparisons(sqlText, dictionary) {
  const hits = []
  if (!dictionary?.columns?.length) return hits
  const cleaned = String(sqlText)

  for (const col of dictionary.columns) {
    if (!CHAR_TYPES.has(col.DATA_TYPE)) continue
    const re = new RegExp(
      `\\b((?:[A-Za-z_][A-Za-z0-9_$#]*\\.)?${col.COLUMN_NAME})\\s*(=|<>|!=|>=|<=|>|<)\\s*(\\d+(?:\\.\\d+)?)`,
      'gi',
    )
    let m
    while ((m = re.exec(cleaned))) {
      hits.push({
        full: m[0],
        left: m[1],
        op: m[2],
        num: m[3],
        column: col.COLUMN_NAME,
        table: col.TABLE_NAME,
        index: m.index,
      })
    }
  }
  return hits
}

function rewriteImplicitConversion(sqlText, dictionary, transforms) {
  const hits = findCharNumericComparisons(sqlText, dictionary)
  if (!hits.length) return sqlText

  // 뒤에서부터 치환해 인덱스를 유지
  let result = sqlText
  const unique = [...hits].sort((a, b) => b.index - a.index)
  const seen = new Set()
  for (const h of unique) {
    const key = `${h.left}|${h.op}|${h.num}`
    if (seen.has(key)) continue
    seen.add(key)
    const replacement = `${h.left} ${h.op} '${h.num}'`
    result = result.slice(0, h.index) + replacement + result.slice(h.index + h.full.length)
    transforms.push({
      rule_id: 'D-01',
      title: '암시적 형변환 제거',
      description: `${h.table}.${h.column} 문자형 컬럼과 숫자 리터럴 비교를 문자 리터럴로 바꿨습니다.`,
      before: h.full,
      after: replacement,
    })
  }
  return result
}

function rewriteToCharDateEquals(sqlText, transforms) {
  // TO_CHAR(col, 'YYYY-MM-DD') = '2026-01-15'  →  col >= TO_DATE(...) AND col < TO_DATE(...)+1
  const re = /\bTO_CHAR\s*\(\s*([A-Za-z_][A-Za-z0-9_$#.]*)\s*,\s*'YYYY-MM-DD'\s*\)\s*=\s*'(\d{4}-\d{2}-\d{2})'/gi
  let result = sqlText
  let m
  const matches = []
  while ((m = re.exec(sqlText))) {
    matches.push({ full: m[0], col: m[1], date: m[2], index: m.index })
  }
  for (const hit of matches.reverse()) {
    const replacement =
      `${hit.col} >= TO_DATE('${hit.date}', 'YYYY-MM-DD')` +
      ` AND ${hit.col} < TO_DATE('${hit.date}', 'YYYY-MM-DD') + 1`
    result = result.slice(0, hit.index) + replacement + result.slice(hit.index + hit.full.length)
    transforms.push({
      rule_id: 'S-03',
      title: '날짜 함수 적용 제거 (범위 조건)',
      description: '인덱스 컬럼의 TO_CHAR 비교를 날짜 범위 조건으로 바꿨습니다.',
      before: hit.full,
      after: replacement,
    })
  }
  return result
}

function rewriteUpperEquals(sqlText, transforms) {
  // UPPER(col) = 'ABC'  (리터럴이 이미 대문자) → col = 'ABC'
  const re = /\bUPPER\s*\(\s*([A-Za-z_][A-Za-z0-9_$#.]*)\s*\)\s*=\s*'([^']*)'/gi
  let result = sqlText
  const matches = []
  let m
  while ((m = re.exec(sqlText))) {
    matches.push({ full: m[0], col: m[1], lit: m[2], index: m.index })
  }
  for (const hit of matches.reverse()) {
    if (hit.lit !== hit.lit.toUpperCase()) {
      transforms.push({
        rule_id: 'S-03',
        title: 'UPPER 함수 — 수동 검토',
        description: '비교 값이 대문자가 아니어서 자동 치환하지 않았습니다. 함수기반 인덱스 또는 비교 값 정규화를 검토하세요.',
        before: hit.full,
        after: hit.full,
      })
      continue
    }
    const replacement = `${hit.col} = '${hit.lit}'`
    result = result.slice(0, hit.index) + replacement + result.slice(hit.index + hit.full.length)
    transforms.push({
      rule_id: 'S-03',
      title: '컬럼 측 UPPER 제거',
      description: '비교 값이 이미 대문자이므로 컬럼 측 함수를 제거해 인덱스를 살렸습니다. (대소문자 구분 저장을 전제)',
      before: hit.full,
      after: replacement,
    })
  }
  return result
}

function rewriteLowerEquals(sqlText, transforms) {
  const re = /\bLOWER\s*\(\s*([A-Za-z_][A-Za-z0-9_$#.]*)\s*\)\s*=\s*'([^']*)'/gi
  let result = sqlText
  const matches = []
  let m
  while ((m = re.exec(sqlText))) {
    matches.push({ full: m[0], col: m[1], lit: m[2], index: m.index })
  }
  for (const hit of matches.reverse()) {
    if (hit.lit !== hit.lit.toLowerCase()) continue
    const replacement = `${hit.col} = '${hit.lit}'`
    result = result.slice(0, hit.index) + replacement + result.slice(hit.index + hit.full.length)
    transforms.push({
      rule_id: 'S-03',
      title: '컬럼 측 LOWER 제거',
      description: '비교 값이 이미 소문자이므로 컬럼 측 함수를 제거했습니다. (대소문자 구분 저장을 전제)',
      before: hit.full,
      after: replacement,
    })
  }
  return result
}

function rewriteNotInSubquery(sqlText, transforms) {
  // NOT IN (SELECT col FROM t WHERE ...) → NOT EXISTS (SELECT 1 FROM t WHERE ... AND outer_col = col)
  // 안전한 전체 파싱이 어려워, 단일 컬럼 NOT IN 패턴만 처리
  const re = /\b([A-Za-z_][A-Za-z0-9_$#.]*)\s+NOT\s+IN\s*\(\s*SELECT\s+([A-Za-z_][A-Za-z0-9_$#.]*)\s+FROM\s+([A-Za-z_][A-Za-z0-9_$#.]*)((?:\s+[A-Za-z_][A-Za-z0-9_$#]*)?)((?:\s+WHERE\s+[\s\S]*?)?)\s*\)/gi
  let result = sqlText
  const matches = []
  let m
  while ((m = re.exec(sqlText))) {
    matches.push({
      full: m[0],
      outerCol: m[1],
      innerCol: m[2],
      table: m[3],
      alias: (m[4] || '').trim(),
      where: (m[5] || '').trim(),
      index: m.index,
    })
  }
  for (const hit of matches.reverse()) {
    const alias = hit.alias || hit.table
    const whereInner = hit.where
      ? `${hit.where.replace(/^WHERE\s+/i, '')} AND ${alias}.${hit.innerCol.split('.').pop()} = ${hit.outerCol}`
      : `${alias}.${hit.innerCol.split('.').pop()} = ${hit.outerCol}`
    const replacement =
      `NOT EXISTS (SELECT 1 FROM ${hit.table}${hit.alias ? ` ${hit.alias}` : ''} WHERE ${whereInner})`
    result = result.slice(0, hit.index) + replacement + result.slice(hit.index + hit.full.length)
    transforms.push({
      rule_id: 'S-05',
      title: 'NOT IN → NOT EXISTS',
      description: 'NULL-safe하고 안티조인 최적화에 유리한 NOT EXISTS로 바꿨습니다.',
      before: hit.full,
      after: replacement,
    })
  }
  return result
}

function rewriteSelectStar(sqlText, dictionary, transforms) {
  // SELECT * FROM single_table [alias] ...  → 컬럼 나열 (JOIN·다중 테이블은 컬럼 순서가 모호해 대상에서 제외)
  if (/\bJOIN\b/i.test(sqlText)) return sqlText
  const re = /^(\s*SELECT\s+)\*(\s+FROM\s+)([A-Za-z_][A-Za-z0-9_$#]*(?:\.[A-Za-z_][A-Za-z0-9_$#]*)?)/i
  const m = sqlText.match(re)
  if (!m) return sqlText

  const parts = m[3].split('.')
  const tableName = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase()
  const cols = dictionary?.columns
    ?.filter((c) => c.TABLE_NAME === tableName)
    .map((c) => c.COLUMN_NAME) ?? []
  if (!cols.length) return sqlText

  const replacement = cols.join(', ')
  const result = m[1] + replacement + sqlText.slice(m[1].length + 1)
  transforms.push({
    rule_id: 'S-01',
    title: 'SELECT * → 명시적 컬럼',
    description: `${tableName} 테이블의 컬럼을 나열해 불필요한 I/O를 줄이고 커버링 인덱스 활용 가능성을 높였습니다.`,
    before: 'SELECT *',
    after: `SELECT ${replacement}`,
  })
  return result
}

function rewriteUnionToUnionAll(sqlText, transforms) {
  if (!/\bUNION\b(?!\s+ALL)/i.test(sqlText)) return sqlText
  const result = sqlText.replace(/\bUNION\b(?!\s+ALL)/gi, 'UNION ALL')
  if (result !== sqlText) {
    transforms.push({
      rule_id: 'S-06',
      title: 'UNION → UNION ALL',
      description: '중복 제거가 불필요하다는 전제로 SORT UNIQUE를 피하는 UNION ALL로 바꿨습니다. 중복 제거가 필요하면 원문을 유지하세요.',
      before: 'UNION',
      after: 'UNION ALL',
    })
  }
  return result
}

function rewriteLiteralsToBinds(sqlText, findings, transforms) {
  const hasBindFinding = findings.some((f) => f.rule_id === 'S-04')
  if (!hasBindFinding) return sqlText
  if (/:[A-Za-z][A-Za-z0-9_]*/.test(sqlText)) return sqlText

  // 날짜 포맷 마스크는 바인드화하지 않도록 잠시 보호
  const masks = []
  let result = sqlText.replace(/'([^']*(?:YYYY|MM|DD|HH24|HH|MI|SS|FF)[^']*)'/gi, (full) => {
    const token = `__FMT_${masks.length}__`
    masks.push(full)
    return token
  })

  let bindIdx = 1
  const replacements = []

  result = result.replace(/'([^']*)'/g, (full) => {
    const name = `:b${bindIdx++}`
    replacements.push({ before: full, after: name })
    return name
  })

  result = result.replace(/(=|<>|!=|>=|<=|>|<)\s*(\d+(?:\.\d+)?)\b/g, (_full, op, num) => {
    const name = `:b${bindIdx++}`
    replacements.push({ before: `${op} ${num}`, after: `${op} ${name}` })
    return `${op} ${name}`
  })

  result = result.replace(/__FMT_(\d+)__/g, (_m, i) => masks[Number(i)])

  if (replacements.length) {
    transforms.push({
      rule_id: 'S-04',
      title: '리터럴 → 바인드 변수',
      description: `반복 실행 시 하드파싱을 줄이기 위해 ${replacements.length}개 리터럴을 바인드 변수로 바꿨습니다.`,
      before: replacements.map((r) => r.before).join(', '),
      after: replacements.map((r) => r.after).join(', '),
    })
  }
  return result
}

export function buildRewriteNotes(findings, resolvedRuleIds = new Set()) {
  return collectNonRewriteNotes(findings, resolvedRuleIds)
}

function collectNonRewriteNotes(findings, resolvedRuleIds = new Set()) {
  const notes = []
  const seen = new Set()
  for (const f of findings) {
    if (!['D-02', 'D-03', 'D-04', 'P-01', 'P-02', 'P-03', 'P-04', 'S-01', 'S-02', 'S-05', 'S-06'].includes(f.rule_id)) continue
    if (resolvedRuleIds.has(f.rule_id)) continue
    const key = `${f.rule_id}|${f.title}|${f.recommendation}`
    if (seen.has(key)) continue
    seen.add(key)
    notes.push({
      rule_id: f.rule_id,
      severity: f.severity,
      title: f.title,
      note: f.recommendation,
      ddl: f.ddl ?? null,
    })
  }
  return notes
}

/**
 * @returns {{
 *   original_sql: string,
 *   tuned_sql: string,
 *   changed: boolean,
 *   transforms: Array<{rule_id, title, description, before, after}>,
 *   notes: Array<{rule_id, severity, title, note}>
 * }}
 */
export function rewriteSql({ sqlText, findings = [], dictionary = { columns: [] } }) {
  const original = String(sqlText ?? '')
  const transforms = []

  let tuned = original
  // 순서: 구조 변경 → 함수/형변환 → 바인드 (바인드는 마지막)
  tuned = rewriteNotInSubquery(tuned, transforms)
  tuned = rewriteUnionToUnionAll(tuned, transforms)
  tuned = rewriteSelectStar(tuned, dictionary, transforms)
  tuned = rewriteToCharDateEquals(tuned, transforms)
  tuned = rewriteUpperEquals(tuned, transforms)
  tuned = rewriteLowerEquals(tuned, transforms)
  tuned = rewriteImplicitConversion(tuned, dictionary, transforms)
  tuned = rewriteLiteralsToBinds(tuned, findings, transforms)

  const applied = transforms.filter((t) => t.before !== t.after)
  const appliedRuleIds = new Set(applied.map((t) => t.rule_id))
  const sqlChanged = tuned.trim() !== original.trim()

  return {
    original_sql: original,
    tuned_sql: sqlChanged ? tuned : original,
    changed: sqlChanged,
    transforms: applied,
    notes: collectNonRewriteNotes(findings, appliedRuleIds),
  }
}

/**
 * 데이터 결과가 항상 원본과 동일하게 보존되는 규칙만 사용해 후보 SQL을 생성한다.
 * (NOT IN→NOT EXISTS는 NULL 존재 시, UNION→UNION ALL은 중복 존재 시 결과가 달라질 수 있어 제외 — S-05/S-06 노트로만 안내)
 */
function applySafeRules(sqlText, dictionary, findings, transforms) {
  let sql = sqlText
  sql = rewriteSelectStar(sql, dictionary, transforms)
  sql = rewriteToCharDateEquals(sql, transforms)
  sql = rewriteUpperEquals(sql, transforms)
  sql = rewriteLowerEquals(sql, transforms)
  sql = rewriteImplicitConversion(sql, dictionary, transforms)
  sql = rewriteLiteralsToBinds(sql, findings, transforms)
  return sql
}

/**
 * 원본과 동일한 결과를 보장하는 규칙들로 여러 후보 SQL을 만든다.
 * 개별 규칙 단독 적용 + 전체 결합 적용을 후보로 두고, 호출측(EXPLAIN PLAN 접근 가능한 곳)에서
 * 실행계획 COST를 비교해 실제로 더 빠른 후보만 채택하도록 한다.
 * @returns {Array<{ sql: string, transforms: Array }>}
 */
export function generateRewriteCandidates({ sqlText, findings = [], dictionary = { columns: [] } }) {
  const original = String(sqlText ?? '')
  const candidates = new Map()

  const addCandidate = (sql, transforms) => {
    const applied = transforms.filter((t) => t.before !== t.after)
    if (!applied.length) return
    const trimmed = String(sql ?? '').trim()
    if (!trimmed || trimmed === original.trim()) return
    if (candidates.has(trimmed)) return
    candidates.set(trimmed, { sql, transforms: applied })
  }

  const individualRules = [
    (t) => rewriteSelectStar(original, dictionary, t),
    (t) => rewriteToCharDateEquals(original, t),
    (t) => rewriteUpperEquals(original, t),
    (t) => rewriteLowerEquals(original, t),
    (t) => rewriteImplicitConversion(original, dictionary, t),
    (t) => rewriteLiteralsToBinds(original, findings, t),
  ]
  for (const rule of individualRules) {
    const transforms = []
    addCandidate(rule(transforms), transforms)
  }

  const combinedTransforms = []
  addCandidate(applySafeRules(original, dictionary, findings, combinedTransforms), combinedTransforms)

  return [...candidates.values()]
}
