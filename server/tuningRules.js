/**
 * SQL 튜닝 규칙 엔진 — 3계층 (전부 오프라인)
 *  1) STATIC     : SQL 텍스트 정적 분석
 *  2) DICTIONARY : 딕셔너리(인덱스/통계/타입) 대조
 *  3) PLAN       : EXPLAIN PLAN 결과 분석
 */

const STALE_STATS_DAYS = 90
const LARGE_TABLE_ROWS = 100_000
const MEDIUM_TABLE_ROWS = 10_000

function stripLiteralsAndComments(sqlText) {
  return String(sqlText)
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'[^']*'/g, "'L'")
}

function extractWhereClause(cleaned) {
  const match = cleaned.match(/\bWHERE\b([\s\S]*?)(\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bUNION\b|\bMINUS\b|\bINTERSECT\b|$)/i)
  return match ? match[1] : ''
}

/** WHERE/JOIN 절에서 비교 대상 컬럼명을 추출 (alias.col → col) */
function extractPredicateColumns(cleaned) {
  const scope = extractWhereClause(cleaned) + ' ' + (cleaned.match(/\bON\b([\s\S]*?)(\bWHERE\b|\bJOIN\b|$)/gi)?.join(' ') ?? '')
  const columns = new Set()
  const re = /([A-Za-z_][A-Za-z0-9_$#]*)\s*(?:=|<>|!=|>=|<=|>|<|\bLIKE\b|\bIN\b|\bBETWEEN\b)/gi
  let m
  while ((m = re.exec(scope))) {
    const token = m[1].toUpperCase()
    if (/^(AND|OR|NOT|IN|LIKE|BETWEEN|EXISTS|NULL|SELECT|WHERE|ON|IS|CASE|WHEN|THEN|ELSE|END)$/.test(token)) continue
    columns.add(token)
  }
  return [...columns]
}

function daysSince(date) {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
}

function finding(ruleId, severity, source, title, description, evidence, recommendation, match = {}) {
  // match: 실행계획 노드 매칭 힌트 { plan_node_id, table, predicate_hint }
  return { rule_id: ruleId, severity, source, title, description, evidence, recommendation, ...match }
}

function staticRules(sqlText) {
  const findings = []
  const cleaned = stripLiteralsAndComments(sqlText)
  const original = String(sqlText)

  if (/\bSELECT\s+(?:\/\*.*?\*\/\s*)?\*/i.test(cleaned) && !/\bCOUNT\s*\(\s*\*\s*\)/i.test(cleaned)) {
    findings.push(finding('S-01', 'warning', 'STATIC', 'SELECT * 사용',
      '필요한 컬럼만 명시하지 않으면 불필요한 I/O와 네트워크 전송이 발생하고, 커버링 인덱스 활용이 불가능합니다.',
      'SELECT * 구문 감지',
      '조회에 필요한 컬럼만 명시하세요.'))
  }

  if (/\bLIKE\s+'%/i.test(original)) {
    findings.push(finding('S-02', 'error', 'STATIC', "선행 와일드카드 LIKE '%...'",
      '패턴이 %로 시작하면 일반 B*Tree 인덱스를 사용할 수 없어 FULL SCAN이 발생합니다.',
      original.match(/\bLIKE\s+'%[^']*'/i)?.[0] ?? "LIKE '%...' 감지",
      "후행 와일드카드(LIKE 'ABC%')로 변경하거나, 전문검색(Oracle Text) 인덱스를 검토하세요.",
      { predicate_hint: "LIKE '%" }))
  }

  const funcOnColumn = extractWhereClause(cleaned).match(/\b(UPPER|LOWER|TRUNC|TO_CHAR|TO_DATE|SUBSTR|NVL|ROUND|TO_NUMBER)\s*\(\s*[A-Za-z_][A-Za-z0-9_$#.]*\s*[,)]/i)
  if (funcOnColumn) {
    findings.push(finding('S-03', 'error', 'STATIC', 'WHERE 절 컬럼에 함수 적용',
      '인덱스 컬럼에 함수를 적용하면 해당 인덱스를 사용할 수 없습니다 (인덱스 무효화).',
      `감지된 패턴: ${funcOnColumn[0].trim()}`,
      '함수 기반 인덱스(FBI)를 생성하거나, 비교 값 쪽에 함수를 적용하도록 조건식을 변경하세요.',
      { predicate_hint: `${funcOnColumn[1].toUpperCase()}(` }))
  }

  const whereClause = extractWhereClause(stripLiteralsAndComments(original).replace(/'L'/g, "'LITERAL'"))
  const hasLiteral = /(?:=|<>|!=|>=|<=|>|<)\s*(?:'LITERAL'|\d)/.test(whereClause) || /(?:=|<>|!=|>=|<=|>|<)\s*'/.test(extractWhereClause(original))
  const hasBind = /:[A-Za-z0-9_]+/.test(original)
  if (hasLiteral && !hasBind) {
    findings.push(finding('S-04', 'warning', 'STATIC', '바인드 변수 미사용',
      '리터럴 상수를 사용하면 값마다 하드 파싱이 발생해 라이브러리 캐시 경합과 파싱 부하를 유발합니다.',
      'WHERE 절에 리터럴 비교 감지, 바인드 변수(:var) 없음',
      '반복 실행되는 SQL은 바인드 변수를 사용하세요.'))
  }

  if (/\bNOT\s+IN\s*\(\s*SELECT\b/i.test(cleaned)) {
    findings.push(finding('S-05', 'warning', 'STATIC', 'NOT IN + 서브쿼리',
      'NOT IN은 서브쿼리 결과에 NULL이 포함되면 전체가 공집합이 되고, 안티조인 최적화가 제한될 수 있습니다.',
      'NOT IN (SELECT ...) 패턴 감지',
      'NOT EXISTS로 변경을 검토하세요.'))
  }

  if (/\bUNION\b(?!\s+ALL)/i.test(cleaned)) {
    findings.push(finding('S-06', 'info', 'STATIC', 'UNION 사용 (중복 제거 정렬 발생)',
      'UNION은 중복 제거를 위해 SORT UNIQUE가 수행됩니다. 중복이 없거나 허용된다면 UNION ALL이 유리합니다.',
      'UNION (ALL 아님) 감지',
      '중복 제거가 불필요하면 UNION ALL을 사용하세요.'))
  }

  return findings
}

function dictionaryRules(sqlText, dictionary) {
  const findings = []
  const cleaned = stripLiteralsAndComments(sqlText)
  const predicateColumns = extractPredicateColumns(cleaned)

  const columnsByTable = new Map()
  for (const col of dictionary.columns) {
    const key = col.TABLE_NAME
    if (!columnsByTable.has(key)) columnsByTable.set(key, [])
    columnsByTable.get(key).push(col)
  }

  // 인덱스 선두 컬럼 집합 (테이블별)
  const leadingIndexColumns = new Map()
  const indexedColumns = new Map()
  for (const ic of dictionary.indexColumns) {
    const key = ic.TABLE_NAME
    if (!indexedColumns.has(key)) indexedColumns.set(key, new Set())
    indexedColumns.get(key).add(ic.COLUMN_NAME)
    if (Number(ic.COLUMN_POSITION) === 1) {
      if (!leadingIndexColumns.has(key)) leadingIndexColumns.set(key, new Set())
      leadingIndexColumns.get(key).add(ic.COLUMN_NAME)
    }
  }

  // D-01: 암시적 형변환 — 문자형 컬럼 = 숫자 리터럴
  for (const [tableName, cols] of columnsByTable) {
    for (const col of cols) {
      if (!['VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR'].includes(col.DATA_TYPE)) continue
      const re = new RegExp(`\\b${col.COLUMN_NAME}\\s*(?:=|<>|!=|>=|<=|>|<|\\bIN\\b)\\s*\\(?\\s*\\d`, 'i')
      if (re.test(cleaned)) {
        findings.push(finding('D-01', 'error', 'DICTIONARY', '암시적 형변환 (문자 컬럼 = 숫자 리터럴)',
          `${tableName}.${col.COLUMN_NAME}은(는) ${col.DATA_TYPE} 타입인데 숫자 리터럴과 비교합니다. Oracle이 TO_NUMBER(${col.COLUMN_NAME})로 내부 변환하여 인덱스를 사용할 수 없습니다.`,
          `${tableName}.${col.COLUMN_NAME} (${col.DATA_TYPE}) = 숫자 비교 감지`,
          `비교 값을 문자 리터럴('123')로 변경하세요.`,
          { table: tableName, predicate_hint: `TO_NUMBER("${col.COLUMN_NAME}")` }))
      }
    }
  }

  // D-02: WHERE 절 컬럼에 인덱스 부재
  for (const [tableName, cols] of columnsByTable) {
    const colNames = new Set(cols.map((c) => c.COLUMN_NAME))
    const leading = leadingIndexColumns.get(tableName) ?? new Set()
    const table = dictionary.tables.find((t) => t.TABLE_NAME === tableName)
    for (const pc of predicateColumns) {
      if (!colNames.has(pc)) continue
      if (leading.has(pc)) continue
      const anyIndex = indexedColumns.get(tableName)?.has(pc)
      findings.push(finding('D-02', anyIndex ? 'info' : 'warning', 'DICTIONARY',
        anyIndex ? 'WHERE 절 컬럼이 인덱스 선두 컬럼이 아님' : 'WHERE 절 컬럼에 인덱스 부재',
        anyIndex
          ? `${tableName}.${pc}은(는) 결합 인덱스의 후행 컬럼에만 포함되어 있어 단독 조건으로는 인덱스 효율이 떨어질 수 있습니다.`
          : `${tableName}.${pc} 컬럼을 조건으로 사용하지만 어떤 인덱스에도 포함되어 있지 않습니다.` +
            (table?.NUM_ROWS ? ` (테이블 행수: ${Number(table.NUM_ROWS).toLocaleString()})` : ''),
        `조건 컬럼: ${tableName}.${pc}`,
        anyIndex ? '자주 쓰는 조건이라면 선두 컬럼으로 하는 인덱스를 검토하세요.' : `CREATE INDEX ... ON ${tableName}(${pc}) 생성을 검토하세요.`,
        { table: tableName, predicate_hint: `"${pc}"` }))
    }
  }

  // D-03: FK에 인덱스 없음
  const fkGroups = new Map()
  for (const c of dictionary.constraints) {
    if (c.CONSTRAINT_TYPE !== 'R') continue
    const key = `${c.TABLE_NAME}|${c.CONSTRAINT_NAME}`
    if (!fkGroups.has(key)) fkGroups.set(key, [])
    fkGroups.get(key).push(c.COLUMN_NAME)
  }
  for (const [key, fkCols] of fkGroups) {
    const [tableName, constraintName] = key.split('|')
    const leading = leadingIndexColumns.get(tableName) ?? new Set()
    if (!leading.has(fkCols[0])) {
      findings.push(finding('D-03', 'warning', 'DICTIONARY', 'FK 컬럼에 인덱스 없음',
        `${tableName}의 외래키 ${constraintName}(${fkCols.join(', ')})에 인덱스가 없습니다. 조인 성능 저하와 부모 테이블 갱신 시 자식 테이블 전체 잠금(TM Lock) 위험이 있습니다.`,
        `FK: ${constraintName} → 컬럼 ${fkCols.join(', ')}`,
        `CREATE INDEX ... ON ${tableName}(${fkCols.join(', ')}) 생성을 검토하세요.`,
        { table: tableName }))
    }
  }

  // D-04: 통계 미수집 / 노후
  for (const t of dictionary.tables) {
    const staleFlag = dictionary.statistics.find((s) => s.TABLE_NAME === t.TABLE_NAME)?.STALE_STATS
    const age = daysSince(t.LAST_ANALYZED)
    if (!t.LAST_ANALYZED) {
      findings.push(finding('D-04', 'error', 'DICTIONARY', '옵티마이저 통계 미수집',
        `${t.TABLE_NAME} 테이블에 통계가 없습니다. 옵티마이저가 잘못된 실행계획을 선택할 가능성이 높습니다.`,
        `LAST_ANALYZED = NULL`,
        `EXEC DBMS_STATS.GATHER_TABLE_STATS('${t.OWNER}', '${t.TABLE_NAME}') 실행을 권고합니다.`,
        { table: t.TABLE_NAME }))
    } else if (staleFlag === 'YES' || (age !== null && age > STALE_STATS_DAYS)) {
      findings.push(finding('D-04', 'warning', 'DICTIONARY', '옵티마이저 통계 노후',
        `${t.TABLE_NAME} 통계가 ${age}일 전에 수집되었습니다${staleFlag === 'YES' ? ' (STALE_STATS=YES)' : ''}. 데이터 변화가 반영되지 않았을 수 있습니다.`,
        `LAST_ANALYZED = ${new Date(t.LAST_ANALYZED).toISOString().slice(0, 10)}`,
        `DBMS_STATS.GATHER_TABLE_STATS 재수집을 검토하세요.`,
        { table: t.TABLE_NAME }))
    }
  }

  return findings
}

function planRules(planRows, dictionary) {
  const findings = []
  if (!planRows?.length) return findings

  const rowsByTable = new Map(dictionary.tables.map((t) => [t.TABLE_NAME, Number(t.NUM_ROWS ?? 0)]))

  for (const row of planRows) {
    const op = `${row.OPERATION ?? ''} ${row.OPTIONS ?? ''}`.trim()

    if (row.OPERATION === 'TABLE ACCESS' && String(row.OPTIONS ?? '').includes('FULL')) {
      const numRows = rowsByTable.get(row.OBJECT_NAME) ?? null
      const severity = numRows !== null && numRows >= LARGE_TABLE_ROWS ? 'error'
        : numRows !== null && numRows >= MEDIUM_TABLE_ROWS ? 'warning' : 'info'
      findings.push(finding('P-01', severity, 'PLAN', 'FULL TABLE SCAN 발생',
        `${row.OBJECT_NAME ?? '테이블'} 전체 스캔이 실행계획에 포함되어 있습니다.` +
          (numRows !== null ? ` 테이블 행수 약 ${numRows.toLocaleString()}건${numRows >= LARGE_TABLE_ROWS ? ' — 대용량 테이블로 심각한 성능 저하 우려' : ''}.` : ''),
        `계획 단계 #${row.ID}: ${op} ${row.OBJECT_NAME ?? ''} (예상 ${Number(row.CARDINALITY ?? 0).toLocaleString()}행, COST ${row.COST ?? '-'})`,
        '조건 컬럼 인덱스 생성 또는 조건 재작성으로 인덱스 스캔 유도를 검토하세요.',
        { plan_node_id: row.ID }))
    }

    if (row.OPERATION === 'MERGE JOIN' && String(row.OPTIONS ?? '') === 'CARTESIAN') {
      findings.push(finding('P-02', 'error', 'PLAN', '카티전 곱 조인 (조인 조건 누락)',
        '실행계획에 MERGE JOIN CARTESIAN이 있습니다. 조인 조건이 누락되어 두 집합의 곱집합이 생성됩니다.',
        `계획 단계 #${row.ID}: ${op} (COST ${row.COST ?? '-'})`,
        'FROM 절 테이블 간 조인 조건을 명시하세요.',
        { plan_node_id: row.ID }))
    }

    if (row.OPERATION === 'INDEX' && String(row.OPTIONS ?? '').includes('FULL SCAN')) {
      findings.push(finding('P-03', 'info', 'PLAN', 'INDEX FULL SCAN',
        `${row.OBJECT_NAME ?? '인덱스'} 전체 스캔이 수행됩니다. 조건이 인덱스 선두 컬럼과 맞지 않을 때 나타납니다.`,
        `계획 단계 #${row.ID}: ${op} ${row.OBJECT_NAME ?? ''}`,
        '조건절이 인덱스 선두 컬럼을 사용하도록 재작성하거나 인덱스 구성을 검토하세요.',
        { plan_node_id: row.ID }))
    }
  }

  const totalCost = Number(planRows[0]?.COST ?? 0)
  if (totalCost > 10_000) {
    findings.push(finding('P-04', 'warning', 'PLAN', '실행계획 총 비용 높음',
      `옵티마이저 추정 총 비용(COST)이 ${totalCost.toLocaleString()}으로 높습니다.`,
      `계획 루트 COST = ${totalCost.toLocaleString()}`,
      '조인 순서, 인덱스 활용, 조건 선택도를 전반적으로 재검토하세요.',
      { plan_node_id: planRows[0]?.ID }))
  }

  return findings
}

/**
 * 발견사항을 실행계획 노드에 매핑 → { [노드ID]: [{severity, rule_id, title, note}] }
 * 우선순위: ① plan_node_id 직접 지정 ② 조건절(predicate) 패턴 매칭 ③ 테이블 접근 노드
 */
export function annotatePlanNodes(findings, planRows) {
  const annotations = {}
  if (!planRows?.length) return annotations

  const add = (nodeId, f) => {
    if (nodeId === null || nodeId === undefined) return
    if (!annotations[nodeId]) annotations[nodeId] = []
    if (annotations[nodeId].some((a) => a.rule_id === f.rule_id && a.title === f.title)) return
    annotations[nodeId].push({
      severity: f.severity,
      rule_id: f.rule_id,
      title: f.title,
      note: f.recommendation,
    })
  }

  for (const f of findings) {
    if (f.plan_node_id !== null && f.plan_node_id !== undefined) {
      add(f.plan_node_id, f)
      continue
    }

    let matched = false
    if (f.predicate_hint) {
      const hint = f.predicate_hint.toUpperCase()
      for (const row of planRows) {
        const preds = `${row.ACCESS_PREDICATES ?? ''} ${row.FILTER_PREDICATES ?? ''}`.toUpperCase()
        const tableOk = !f.table || row.OBJECT_NAME === f.table
        if (tableOk && preds.includes(hint)) {
          add(row.ID, f)
          matched = true
        }
      }
    }

    if (!matched && f.table) {
      const node = planRows.find(
        (row) => row.OBJECT_NAME === f.table && String(row.OPERATION ?? '').startsWith('TABLE ACCESS'),
      ) ?? planRows.find((row) => row.OBJECT_NAME === f.table)
      if (node) add(node.ID, f)
    }
  }
  return annotations
}

/** 전체 규칙 실행 → 심각도순 정렬된 findings */
export function analyzeSql({ sqlText, dictionary, planRows }) {
  const findings = [
    ...staticRules(sqlText),
    ...dictionaryRules(sqlText, dictionary),
    ...planRules(planRows, dictionary),
  ]
  const order = { error: 0, warning: 1, info: 2 }
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))
  return findings
}
