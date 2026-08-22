/**
 * PostgreSQL 대상 서버용 튜닝 분석 데이터 수집.
 * oracleTuning.js와 동일한 결과 형태(rows/dictionary 필드명, 대문자 키)로 맞춰
 * tuningRules.js / sqlRewrite.js / comparePlans를 그대로 재사용한다.
 */

function up(v) {
  return v === null || v === undefined ? v : String(v).toUpperCase()
}

/** 분석 대상 스키마 전환 (SET search_path) */
export async function setSearchPath(client, schema) {
  const name = String(schema ?? '').trim()
  if (!name) return
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`유효하지 않은 스키마명입니다: ${schema}`)
  }
  await client.query(`SET search_path TO "${name}", public`)
}

/** information_schema / pg_catalog 기반 딕셔너리 수집 */
export async function collectDictionary(client, tableRefs) {
  const tableNames = [...new Set(tableRefs.map((t) => t.tableName.toLowerCase()))]
  if (!tableNames.length) {
    return { tables: [], columns: [], indexes: [], indexColumns: [], constraints: [], statistics: [] }
  }

  const tablesRes = await client.query(
    `SELECT n.nspname AS owner, c.relname AS table_name,
            COALESCE(s.n_live_tup, 0) AS num_rows,
            GREATEST(s.last_analyze, s.last_autoanalyze) AS last_analyzed,
            COALESCE(s.n_mod_since_analyze, 0) AS n_mod_since_analyze
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
     WHERE c.relname = ANY($1::text[]) AND c.relkind IN ('r','p')
     ORDER BY CASE WHEN n.nspname = current_schema() THEN 0 ELSE 1 END, n.nspname`,
    [tableNames],
  )

  const resolved = new Map()
  for (const row of tablesRes.rows) {
    if (!resolved.has(row.table_name)) resolved.set(row.table_name, row)
  }
  const resolvedTables = [...resolved.values()]
  if (!resolvedTables.length) {
    return { tables: [], columns: [], indexes: [], indexColumns: [], constraints: [], statistics: [] }
  }
  const resolvedNames = resolvedTables.map((t) => t.table_name)

  const [columnsRes, indexColumnsRes, constraintsRes] = await Promise.all([
    client.query(
      `SELECT table_schema AS owner, table_name, column_name, data_type,
              character_maximum_length AS data_length, numeric_precision AS data_precision,
              numeric_scale AS data_scale, is_nullable AS nullable
       FROM information_schema.columns
       WHERE table_name = ANY($1::text[])
       ORDER BY table_name, ordinal_position`,
      [resolvedNames],
    ),
    client.query(
      `SELECT n.nspname AS index_owner, i.relname AS index_name, t.relname AS table_name,
              a.attname AS column_name, k.ord AS column_position, ix.indisunique AS uniqueness
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = i.relnamespace
       JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
       WHERE t.relname = ANY($1::text[])
       ORDER BY i.relname, k.ord`,
      [resolvedNames],
    ),
    client.query(
      `SELECT tc.table_schema AS owner, tc.constraint_name,
              CASE tc.constraint_type
                WHEN 'PRIMARY KEY' THEN 'P'
                WHEN 'FOREIGN KEY' THEN 'R'
                WHEN 'UNIQUE' THEN 'U'
              END AS constraint_type,
              tc.table_name, kcu.column_name, kcu.ordinal_position AS position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
       WHERE tc.table_name = ANY($1::text[])
         AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
       ORDER BY tc.constraint_name, kcu.ordinal_position`,
      [resolvedNames],
    ),
  ])

  const tables = resolvedTables.map((t) => ({
    OWNER: up(t.owner),
    TABLE_NAME: up(t.table_name),
    NUM_ROWS: Number(t.num_rows) || 0,
    LAST_ANALYZED: t.last_analyzed,
  }))

  const columns = columnsRes.rows.map((c) => ({
    OWNER: up(c.owner),
    TABLE_NAME: up(c.table_name),
    COLUMN_NAME: up(c.column_name),
    DATA_TYPE: up(c.data_type),
    DATA_LENGTH: c.data_length,
    DATA_PRECISION: c.data_precision,
    DATA_SCALE: c.data_scale,
    NULLABLE: c.nullable === 'YES' ? 'Y' : 'N',
  }))

  const indexColumns = indexColumnsRes.rows.map((ic) => ({
    INDEX_OWNER: up(ic.index_owner),
    INDEX_NAME: up(ic.index_name),
    TABLE_NAME: up(ic.table_name),
    COLUMN_NAME: up(ic.column_name),
    COLUMN_POSITION: Number(ic.column_position),
  }))
  const indexNames = new Map()
  for (const ic of indexColumnsRes.rows) {
    indexNames.set(`${ic.table_name}|${ic.index_name}`, ic)
  }
  const indexes = [...indexNames.values()].map((ic) => ({
    OWNER: up(ic.index_owner),
    INDEX_NAME: up(ic.index_name),
    TABLE_OWNER: up(ic.index_owner),
    TABLE_NAME: up(ic.table_name),
    UNIQUENESS: ic.uniqueness ? 'UNIQUE' : 'NONUNIQUE',
    STATUS: 'VALID',
  }))

  const constraints = constraintsRes.rows.map((c) => ({
    OWNER: up(c.owner),
    CONSTRAINT_NAME: up(c.constraint_name),
    CONSTRAINT_TYPE: c.constraint_type,
    TABLE_NAME: up(c.table_name),
    COLUMN_NAME: up(c.column_name),
    POSITION: Number(c.position),
  }))

  const statistics = resolvedTables.map((t) => ({
    OWNER: up(t.owner),
    TABLE_NAME: up(t.table_name),
    NUM_ROWS: Number(t.num_rows) || 0,
    LAST_ANALYZED: t.last_analyzed,
    STALE_STATS: Number(t.n_mod_since_analyze) > 0.1 * Math.max(Number(t.num_rows), 1) ? 'YES' : 'NO',
  }))

  return { tables, columns, indexes, indexColumns, constraints, statistics }
}

// Postgres EXPLAIN 노드 타입 → Oracle 스타일 OPERATION/OPTIONS 매핑
// (tuningRules.js의 planRules()·oracleTuning.js의 comparePlans()를 그대로 재사용하기 위함)
function mapNodeType(nodeType) {
  switch (nodeType) {
    case 'Seq Scan': return { OPERATION: 'TABLE ACCESS', OPTIONS: 'FULL' }
    case 'Index Scan': return { OPERATION: 'TABLE ACCESS', OPTIONS: 'BY INDEX ROWID' }
    case 'Index Only Scan': return { OPERATION: 'INDEX', OPTIONS: 'ONLY SCAN' }
    case 'Bitmap Heap Scan': return { OPERATION: 'TABLE ACCESS', OPTIONS: 'BY INDEX ROWID (BITMAP)' }
    case 'Bitmap Index Scan': return { OPERATION: 'BITMAP', OPTIONS: 'CONVERSION' }
    case 'Nested Loop': return { OPERATION: 'NESTED LOOPS', OPTIONS: '' }
    case 'Hash Join': return { OPERATION: 'HASH JOIN', OPTIONS: '' }
    case 'Merge Join': return { OPERATION: 'MERGE JOIN', OPTIONS: '' }
    case 'Hash': return { OPERATION: 'HASH', OPTIONS: '' }
    case 'Sort': return { OPERATION: 'SORT', OPTIONS: '' }
    default: return { OPERATION: String(nodeType || '').toUpperCase(), OPTIONS: '' }
  }
}

/** EXPLAIN (FORMAT JSON/TEXT) 실행 — 실행하지 않고(ANALYZE 미사용) 추정 계획만 조회 */
export async function getExplainPlan(client, sqlText) {
  const sanitized = String(sqlText).trim().replace(/;+\s*$/, '')

  const [textRes, jsonRes] = await Promise.all([
    client.query(`EXPLAIN (FORMAT TEXT) ${sanitized}`),
    client.query(`EXPLAIN (FORMAT JSON) ${sanitized}`),
  ])

  const planRoot = jsonRes.rows[0]?.['QUERY PLAN']?.[0]?.Plan
  const rows = []
  let seq = 0

  function walk(node, parentId, depth) {
    if (!node) return
    const id = seq++
    const mapped = mapNodeType(node['Node Type'])
    rows.push({
      ID: id,
      PARENT_ID: parentId,
      DEPTH: depth,
      OPERATION: mapped.OPERATION,
      OPTIONS: mapped.OPTIONS,
      OBJECT_OWNER: up(node['Schema']) ?? null,
      OBJECT_NAME: up(node['Relation Name'] ?? node['Index Name']) ?? null,
      CARDINALITY: node['Plan Rows'] ?? null,
      BYTES: node['Plan Rows'] && node['Plan Width'] ? node['Plan Rows'] * node['Plan Width'] : null,
      COST: node['Total Cost'] ?? null,
      CPU_COST: null,
      IO_COST: null,
      ACCESS_PREDICATES: node['Index Cond'] ?? null,
      FILTER_PREDICATES: node['Filter'] ?? node['Recheck Cond'] ?? null,
    })
    for (const child of node['Plans'] ?? []) walk(child, id, depth + 1)
  }
  walk(planRoot, null, 0)

  return {
    text: textRes.rows.map((r) => r['QUERY PLAN']).join('\n'),
    rows,
    root_cost: rows[0]?.COST ?? null,
    root_cardinality: rows[0]?.CARDINALITY ?? null,
  }
}
