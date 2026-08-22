import { queryRows } from './oracleClient.js'

/** EXPLAIN PLAN용 PLAN_TABLE (접속 사용자 스키마) — 없으면 생성 */
export async function ensurePlanTable(connection) {
  const exists = await queryRows(
    connection,
    `SELECT table_name FROM user_tables WHERE table_name = 'PLAN_TABLE'`,
  )
  if (exists.length) {
    return { created: false, message: 'PLAN_TABLE already exists' }
  }

  // Oracle 표준 utlxplan.sql 호환 DDL (12c+)
  await connection.execute(`
    CREATE TABLE PLAN_TABLE (
      statement_id       VARCHAR2(30),
      plan_id            NUMBER,
      timestamp          DATE,
      remarks            VARCHAR2(4000),
      operation          VARCHAR2(30),
      options            VARCHAR2(255),
      object_node        VARCHAR2(128),
      object_owner       VARCHAR2(128),
      object_name        VARCHAR2(128),
      object_alias       VARCHAR2(261),
      object_instance    NUMBER,
      object_type        VARCHAR2(30),
      optimizer          VARCHAR2(255),
      search_columns     NUMBER,
      id                 NUMBER,
      parent_id          NUMBER,
      depth              NUMBER,
      position           NUMBER,
      cost               NUMBER,
      cardinality        NUMBER,
      bytes              NUMBER,
      other_tag          VARCHAR2(255),
      partition_start    VARCHAR2(255),
      partition_stop     VARCHAR2(255),
      partition_id       NUMBER,
      other              LONG,
      other_xml          CLOB,
      distribution       VARCHAR2(30),
      cpu_cost           NUMBER,
      io_cost            NUMBER,
      temp_space         NUMBER,
      access_predicates  VARCHAR2(4000),
      filter_predicates  VARCHAR2(4000),
      projection         VARCHAR2(4000),
      time               NUMBER,
      qblock_name        VARCHAR2(128)
    )`)

  return { created: true, message: 'PLAN_TABLE created' }
}

/**
 * 접속 사용자 스키마의 사용자 테이블 통계 수집
 * (ORDERS/ORDER_ITEMS 등 의도적 미수집 대상은 skip 가능)
 */
export async function gatherUserTableStats(connection, { skipTables = [] } = {}) {
  const skip = new Set(skipTables.map((t) => String(t).toUpperCase()))
  const tables = await queryRows(
    connection,
    `SELECT table_name FROM user_tables
     WHERE temporary = 'N'
       AND table_name NOT IN ('PLAN_TABLE')
     ORDER BY table_name`,
  )

  const gathered = []
  const skipped = []
  for (const row of tables) {
    const name = row.TABLE_NAME
    if (skip.has(name)) {
      skipped.push(name)
      continue
    }
    await connection.execute(
      `BEGIN
         DBMS_STATS.GATHER_TABLE_STATS(
           ownname => USER,
           tabname => :t,
           cascade => TRUE,
           estimate_percent => DBMS_STATS.AUTO_SAMPLE_SIZE,
           method_opt => 'FOR ALL COLUMNS SIZE AUTO'
         );
       END;`,
      { t: name },
    )
    gathered.push(name)
  }
  return { gathered, skipped, total: tables.length }
}

/** 분석 대상 스키마 전환 (ALTER SESSION SET CURRENT_SCHEMA) */
export async function setCurrentSchema(connection, schema) {
  const name = String(schema ?? '').trim().toUpperCase()
  if (!name) return
  if (!/^[A-Z][A-Z0-9_$#]*$/.test(name)) {
    throw new Error(`유효하지 않은 스키마명입니다: ${schema}`)
  }
  await connection.execute(`ALTER SESSION SET CURRENT_SCHEMA = "${name}"`)
}

/** SQL 텍스트에서 FROM/JOIN 절의 테이블명을 추출한다 (경량 파서). */
export function extractTableNames(sqlText) {
  const cleaned = String(sqlText)
    .replace(/--.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'[^']*'/g, "''")

  const names = new Set()
  const pattern = /\b(?:FROM|JOIN|INTO|UPDATE|MERGE\s+INTO)\s+([A-Za-z0-9_$#."]+(?:\s*,\s*[A-Za-z0-9_$#."]+)*)/gi
  let match
  while ((match = pattern.exec(cleaned))) {
    for (const raw of match[1].split(',')) {
      const token = raw.trim().replace(/"/g, '')
      if (!token || token.startsWith('(')) continue
      const first = token.split(/\s+/)[0]
      if (!first || /^(SELECT|DUAL|TABLE|LATERAL)$/i.test(first)) continue
      const parts = first.split('.')
      const tableName = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase()
      const owner = parts.length > 1 ? parts[0].toUpperCase() : null
      if (/^[A-Z][A-Z0-9_$#]*$/.test(tableName)) {
        names.add(JSON.stringify({ owner, tableName }))
      }
    }
  }
  return [...names].map((s) => JSON.parse(s))
}

function bindList(items, prefix) {
  const binds = {}
  const placeholders = items.map((value, i) => {
    binds[`${prefix}${i}`] = value
    return `:${prefix}${i}`
  })
  return { binds, placeholders: placeholders.join(', ') }
}

/**
 * 딕셔너리 수집: ALL_TABLES / ALL_TAB_COLUMNS / ALL_INDEXES / ALL_IND_COLUMNS /
 * ALL_CONSTRAINTS / ALL_TAB_STATISTICS
 */
export async function collectDictionary(connection, tableRefs) {
  const tableNames = [...new Set(tableRefs.map((t) => t.tableName))]
  if (!tableNames.length) {
    return { tables: [], columns: [], indexes: [], indexColumns: [], constraints: [], statistics: [] }
  }
  const { binds, placeholders } = bindList(tableNames, 't')

  const tables = await queryRows(
    connection,
    `SELECT owner, table_name, num_rows, blocks, avg_row_len, last_analyzed, partitioned, temporary
     FROM all_tables WHERE table_name IN (${placeholders})
     ORDER BY CASE WHEN owner = SYS_CONTEXT('USERENV','CURRENT_SCHEMA') THEN 0 ELSE 1 END, owner`,
    binds,
  )

  // 동일 테이블명이 여러 스키마에 있으면 현재 스키마 우선으로 1개만 채택
  const resolved = new Map()
  for (const row of tables) {
    if (!resolved.has(row.TABLE_NAME)) resolved.set(row.TABLE_NAME, row)
  }
  const resolvedTables = [...resolved.values()]
  if (!resolvedTables.length) {
    return { tables: [], columns: [], indexes: [], indexColumns: [], constraints: [], statistics: [] }
  }

  const ownerPairs = resolvedTables.map((t) => `${t.OWNER}.${t.TABLE_NAME}`)
  const { binds: pairBinds, placeholders: pairPh } = bindList(ownerPairs, 'p')
  const pairFilter = `owner || '.' || table_name IN (${pairPh})`

  const [columns, indexes, indexColumns, constraints, statistics] = await Promise.all([
    queryRows(
      connection,
      `SELECT owner, table_name, column_name, data_type, data_length, data_precision, data_scale, nullable, num_distinct, num_nulls
       FROM all_tab_columns WHERE ${pairFilter} ORDER BY table_name, column_id`,
      pairBinds,
    ),
    queryRows(
      connection,
      `SELECT owner, index_name, table_owner, table_name, uniqueness, status, distinct_keys, leaf_blocks, last_analyzed
       FROM all_indexes WHERE table_owner || '.' || table_name IN (${pairPh})`,
      pairBinds,
    ),
    queryRows(
      connection,
      `SELECT ic.index_owner, ic.index_name, ic.table_name, ic.column_name, ic.column_position
       FROM all_ind_columns ic
       WHERE ic.table_owner || '.' || ic.table_name IN (${pairPh})
       ORDER BY ic.index_name, ic.column_position`,
      pairBinds,
    ),
    queryRows(
      connection,
      `SELECT c.owner, c.constraint_name, c.constraint_type, c.table_name, c.r_constraint_name, c.status,
              cc.column_name, cc.position
       FROM all_constraints c
       JOIN all_cons_columns cc
         ON cc.owner = c.owner AND cc.constraint_name = c.constraint_name
       WHERE c.constraint_type IN ('P','R','U')
         AND c.owner || '.' || c.table_name IN (${pairPh})
       ORDER BY c.constraint_name, cc.position`,
      pairBinds,
    ),
    queryRows(
      connection,
      `SELECT owner, table_name, num_rows, blocks, sample_size, last_analyzed, stale_stats
       FROM all_tab_statistics WHERE object_type = 'TABLE' AND ${pairFilter}`,
      pairBinds,
    ),
  ])

  return { tables: resolvedTables, columns, indexes, indexColumns, constraints, statistics }
}

let explainSeq = 0

/** EXPLAIN PLAN 실행 + DBMS_XPLAN.DISPLAY 텍스트 + PLAN_TABLE 구조 행 반환 */
export async function getExplainPlan(connection, sqlText) {
  // PLAN_TABLE 없으면 생성 (ORA-02404 등 방지)
  await ensurePlanTable(connection)

  explainSeq = (explainSeq + 1) % 1_000_000
  const statementId = `IMETA_${Date.now().toString(36).toUpperCase()}_${explainSeq}`
  const sanitized = String(sqlText).trim().replace(/;+\s*$/, '')

  // node-oracledb가 :bind 를 바인드 플레이스홀더로 해석하므로 더미 값을 넘긴다.
  // EXPLAIN PLAN은 실행하지 않으므로 값은 옵티마이저 추정에만 영향을 준다.
  const bindNames = new Set()
  const withoutLiterals = sanitized.replace(/'[^']*'/g, "''")
  const bindRe = /:([A-Za-z][A-Za-z0-9_]*)/g
  let bm
  while ((bm = bindRe.exec(withoutLiterals))) bindNames.add(bm[1])
  const binds = Object.fromEntries([...bindNames].map((name) => [name, null]))

  await connection.execute(
    `EXPLAIN PLAN SET STATEMENT_ID = '${statementId}' FOR ${sanitized}`,
    binds,
  )

  try {
    const textRows = await queryRows(
      connection,
      `SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', :sid, 'TYPICAL'))`,
      { sid: statementId },
    )
    const rows = await queryRows(
      connection,
      `SELECT id, parent_id, depth, operation, options, object_owner, object_name,
              cardinality, bytes, cost, cpu_cost, io_cost, access_predicates, filter_predicates
       FROM plan_table WHERE statement_id = :sid ORDER BY id`,
      { sid: statementId },
    )

    // DEPTH 미기록 환경 대비: PARENT_ID 체인으로 계층 깊이 보정
    if (rows.some((r) => r.DEPTH === null || r.DEPTH === undefined)) {
      const byId = new Map(rows.map((r) => [r.ID, r]))
      for (const row of rows) {
        let depth = 0
        let current = row
        while (current?.PARENT_ID !== null && current?.PARENT_ID !== undefined && depth < 64) {
          depth += 1
          current = byId.get(current.PARENT_ID)
        }
        row.DEPTH = depth
      }
    }

    return {
      text: textRows.map((r) => r.PLAN_TABLE_OUTPUT).join('\n'),
      rows,
      root_cost: rows[0]?.COST ?? null,
      root_cardinality: rows[0]?.CARDINALITY ?? null,
    }
  } finally {
    await connection
      .execute('DELETE FROM plan_table WHERE statement_id = :sid', { sid: statementId })
      .then(() => connection.commit())
      .catch(() => {})
  }
}

/** 튜닝 전/후 실행계획 요약 비교 */
export function comparePlans(before, after) {
  if (!before?.rows?.length || !after?.rows?.length) return null
  const beforeCost = Number(before.rows[0]?.COST ?? 0)
  const afterCost = Number(after.rows[0]?.COST ?? 0)
  const beforeCard = Number(before.rows[0]?.CARDINALITY ?? 0)
  const afterCard = Number(after.rows[0]?.CARDINALITY ?? 0)
  const beforeFull = before.rows.filter(
    (r) => r.OPERATION === 'TABLE ACCESS' && String(r.OPTIONS ?? '').includes('FULL'),
  ).length
  const afterFull = after.rows.filter(
    (r) => r.OPERATION === 'TABLE ACCESS' && String(r.OPTIONS ?? '').includes('FULL'),
  ).length
  const costDelta = afterCost - beforeCost
  const costRatio = beforeCost > 0 ? afterCost / beforeCost : null
  return {
    before_cost: beforeCost,
    after_cost: afterCost,
    cost_delta: costDelta,
    cost_ratio: costRatio,
    improved: costDelta < 0,
    before_cardinality: beforeCard,
    after_cardinality: afterCard,
    before_full_scans: beforeFull,
    after_full_scans: afterFull,
  }
}

const TOP_SQL_METRICS = {
  elapsed_time: 's.elapsed_time',
  elapsed_per_exec: 's.elapsed_time / GREATEST(s.executions, 1)',
  cpu_time: 's.cpu_time',
  buffer_gets: 's.buffer_gets',
  disk_reads: 's.disk_reads',
  executions: 's.executions',
}

const EXCLUDED_SCHEMAS = [
  'SYS', 'SYSTEM', 'MDSYS', 'CTXSYS', 'XDB', 'ORDSYS', 'DBSNMP', 'WMSYS',
  'AUDSYS', 'GSMADMIN_INTERNAL', 'DVSYS', 'LBACSYS', 'OJVMSYS', 'APPQOSSYS',
]

/** 커서 캐시(V$SQLAREA) 기반 Top N 문제 SQL (무료 — 라이선스 불필요) */
export async function getTopSql(connection, { metric = 'elapsed_time', limit = 10, includeSys = false } = {}) {
  const orderExpr = TOP_SQL_METRICS[metric] ?? TOP_SQL_METRICS.elapsed_time
  const sysFilter = includeSys
    ? ''
    : `AND s.parsing_schema_name NOT IN (${EXCLUDED_SCHEMAS.map((s) => `'${s}'`).join(', ')})`

  return queryRows(
    connection,
    `SELECT * FROM (
       SELECT s.sql_id,
              s.plan_hash_value,
              s.parsing_schema_name,
              s.module,
              s.sql_text,
              s.executions,
              s.elapsed_time,
              ROUND(s.elapsed_time / GREATEST(s.executions, 1)) AS elapsed_per_exec,
              s.cpu_time,
              s.buffer_gets,
              ROUND(s.buffer_gets / GREATEST(s.executions, 1)) AS buffer_gets_per_exec,
              s.disk_reads,
              s.rows_processed,
              s.last_active_time
       FROM v$sqlarea s
       WHERE s.executions > 0
         AND s.command_type IN (1, 2, 3, 6, 7)  -- CREATE TABLE AS/INSERT/SELECT/UPDATE/DELETE
         ${sysFilter}
       ORDER BY ${orderExpr} DESC
     ) WHERE ROWNUM <= :n`,
    { n: Math.min(Math.max(Number(limit) || 10, 1), 50) },
  )
}

/** AWR 이력 기반 Top N SQL — Diagnostics Pack 라이선스 필요 */
export async function getAwrTopSql(connection, { metric = 'elapsed_time', limit = 10, days = 7 } = {}) {
  const metricCol = {
    elapsed_time: 'SUM(st.elapsed_time_delta)',
    cpu_time: 'SUM(st.cpu_time_delta)',
    buffer_gets: 'SUM(st.buffer_gets_delta)',
    disk_reads: 'SUM(st.disk_reads_delta)',
    executions: 'SUM(st.executions_delta)',
    elapsed_per_exec: 'SUM(st.elapsed_time_delta) / GREATEST(SUM(st.executions_delta), 1)',
  }[metric] ?? 'SUM(st.elapsed_time_delta)'

  return queryRows(
    connection,
    `SELECT * FROM (
       SELECT st.sql_id,
              MAX(txt.sql_text) AS sql_text,
              SUM(st.executions_delta) AS executions,
              SUM(st.elapsed_time_delta) AS elapsed_time,
              ROUND(SUM(st.elapsed_time_delta) / GREATEST(SUM(st.executions_delta), 1)) AS elapsed_per_exec,
              SUM(st.cpu_time_delta) AS cpu_time,
              SUM(st.buffer_gets_delta) AS buffer_gets,
              SUM(st.disk_reads_delta) AS disk_reads,
              MAX(sn.end_interval_time) AS last_snapshot
       FROM dba_hist_sqlstat st
       JOIN dba_hist_snapshot sn
         ON sn.snap_id = st.snap_id AND sn.dbid = st.dbid AND sn.instance_number = st.instance_number
       LEFT JOIN (
         SELECT sql_id, DBMS_LOB.SUBSTR(sql_text, 1000, 1) AS sql_text FROM dba_hist_sqltext
       ) txt ON txt.sql_id = st.sql_id
       WHERE sn.end_interval_time >= SYSTIMESTAMP - NUMTODSINTERVAL(:days, 'DAY')
       GROUP BY st.sql_id
       ORDER BY ${metricCol} DESC
     ) WHERE ROWNUM <= :n`,
    { n: Math.min(Math.max(Number(limit) || 10, 1), 50), days: Math.min(Math.max(Number(days) || 7, 1), 60) },
  )
}

/** Diagnostics Pack(AWR) 가용성 점검 */
export async function checkAwrAvailability(connection) {
  try {
    const rows = await queryRows(
      connection,
      `SELECT MAX(snap_id) AS max_snap, MAX(end_interval_time) AS latest, COUNT(*) AS snap_count
       FROM dba_hist_snapshot`,
    )
    const row = rows[0]
    return {
      available: Number(row?.SNAP_COUNT ?? 0) > 0,
      snapCount: Number(row?.SNAP_COUNT ?? 0),
      latestSnapshot: row?.LATEST ?? null,
    }
  } catch (err) {
    return { available: false, error: err.message }
  }
}
