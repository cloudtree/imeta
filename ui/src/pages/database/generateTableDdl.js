/**
 * 테이블 정의서 → CREATE TABLE DDL (Oracle / PostgreSQL)
 */

function parseLength(dataLength) {
  const raw = String(dataLength ?? '').trim()
  if (!raw) return { precision: null, scale: null, raw: '' }
  const m = raw.match(/^(\d+)\s*,\s*(\d+)$/)
  if (m) return { precision: Number(m[1]), scale: Number(m[2]), raw }
  const n = raw.match(/^(\d+)$/)
  if (n) return { precision: Number(n[1]), scale: null, raw }
  return { precision: null, scale: null, raw }
}

function quoteIdent(dialect, name) {
  const n = String(name ?? '').trim()
  if (!n) return n
  if (dialect === 'oracle') {
    // Oracle: unquoted identifiers fold to UPPER; quote to preserve case if mixed
    if (/^[A-Z][A-Z0-9_$#]*$/.test(n)) return n
    return `"${n.replace(/"/g, '""')}"`
  }
  // PostgreSQL: quote always for safety with mixed case / reserved words
  return `"${n.replace(/"/g, '""')}"`
}

function qualifyTable(dialect, schemaName, tableName) {
  const table = quoteIdent(dialect, tableName)
  const schema = String(schemaName ?? '').trim()
  if (!schema) return table
  // PostgreSQL public 스키마는 생략
  if (dialect === 'postgresql' && schema.toLowerCase() === 'public') return table
  return `${quoteIdent(dialect, schema)}.${table}`
}

function mapPostgresType(dataType, dataLength) {
  const t = String(dataType ?? '').trim()
  const lower = t.toLowerCase()
  const { precision, scale, raw } = parseLength(dataLength)

  const aliases = {
    int2: 'SMALLINT',
    smallint: 'SMALLINT',
    int4: 'INTEGER',
    int: 'INTEGER',
    integer: 'INTEGER',
    int8: 'BIGINT',
    bigint: 'BIGINT',
    float4: 'REAL',
    float8: 'DOUBLE PRECISION',
    bool: 'BOOLEAN',
    boolean: 'BOOLEAN',
    bytea: 'BYTEA',
    uuid: 'UUID',
    json: 'JSON',
    jsonb: 'JSONB',
    text: 'TEXT',
    clob: 'TEXT',
    blob: 'BYTEA',
    date: 'DATE',
    time: 'TIME',
    timestamp: 'TIMESTAMP',
    timestamptz: 'TIMESTAMPTZ',
  }

  if (aliases[lower]) return aliases[lower]

  if (['varchar', 'character varying', 'varchar2'].includes(lower)) {
    return precision != null ? `VARCHAR(${precision})` : 'VARCHAR'
  }
  if (['char', 'character', 'nchar'].includes(lower)) {
    return precision != null ? `CHAR(${precision})` : 'CHAR(1)'
  }
  if (['number', 'numeric', 'decimal', 'dec'].includes(lower)) {
    if (precision != null && scale != null) return `NUMERIC(${precision},${scale})`
    if (precision != null) return `NUMERIC(${precision})`
    return 'NUMERIC'
  }
  if (['float', 'double', 'double precision', 'real'].includes(lower)) {
    return lower.includes('real') || lower === 'float4' ? 'REAL' : 'DOUBLE PRECISION'
  }

  // already has length in type string e.g. varchar(100)
  if (/\(.*\)/.test(t)) return t.toUpperCase().replace('VARCHAR2', 'VARCHAR')

  if (raw && !/\(.*\)/.test(t)) {
    if (['varchar', 'char'].some((x) => lower.startsWith(x))) {
      return `${t.toUpperCase()}(${raw})`
    }
  }

  return t.toUpperCase() || 'TEXT'
}

function mapOracleType(dataType, dataLength) {
  const t = String(dataType ?? '').trim()
  const lower = t.toLowerCase()
  const { precision, scale, raw } = parseLength(dataLength)

  if (['int2', 'smallint'].includes(lower)) return 'NUMBER(5)'
  if (['int4', 'int', 'integer'].includes(lower)) return 'NUMBER(10)'
  if (['int8', 'bigint'].includes(lower)) return 'NUMBER(19)'
  if (['bool', 'boolean'].includes(lower)) return 'CHAR(1)'
  if (['text', 'clob'].includes(lower)) return 'CLOB'
  if (['bytea', 'blob'].includes(lower)) return 'BLOB'
  if (['uuid'].includes(lower)) return 'VARCHAR2(36)'
  if (['json', 'jsonb'].includes(lower)) return 'CLOB'
  if (['date'].includes(lower)) return 'DATE'
  if (['time'].includes(lower)) return 'VARCHAR2(20)'
  if (['timestamp', 'timestamptz'].includes(lower)) return 'TIMESTAMP'
  if (['float4', 'real'].includes(lower)) return 'BINARY_FLOAT'
  if (['float8', 'double', 'double precision'].includes(lower)) return 'BINARY_DOUBLE'

  if (['varchar', 'character varying', 'varchar2'].includes(lower)) {
    const len = precision != null ? precision : 4000
    return `VARCHAR2(${Math.min(len, 4000)})`
  }
  if (['char', 'character', 'nchar'].includes(lower)) {
    return precision != null ? `CHAR(${precision})` : 'CHAR(1)'
  }
  if (['number', 'numeric', 'decimal', 'dec'].includes(lower)) {
    if (precision != null && scale != null) return `NUMBER(${precision},${scale})`
    if (precision != null) return `NUMBER(${precision})`
    return 'NUMBER'
  }

  if (/\(.*\)/.test(t)) {
    return t.toUpperCase()
      .replace(/\bVARCHAR\b/g, 'VARCHAR2')
      .replace(/\bNUMERIC\b/g, 'NUMBER')
      .replace(/\bDECIMAL\b/g, 'NUMBER')
      .replace(/\bINTEGER\b/g, 'NUMBER(10)')
      .replace(/\bBIGINT\b/g, 'NUMBER(19)')
      .replace(/\bSMALLINT\b/g, 'NUMBER(5)')
      .replace(/\bTEXT\b/g, 'CLOB')
  }

  if (raw && ['varchar', 'varchar2', 'char', 'number', 'numeric'].some((x) => lower.startsWith(x))) {
    const base = lower.startsWith('varchar') ? 'VARCHAR2'
      : lower.startsWith('char') ? 'CHAR'
        : 'NUMBER'
    return `${base}(${raw})`
  }

  return t.toUpperCase() || 'VARCHAR2(4000)'
}

function mapColumnType(dialect, col) {
  return dialect === 'oracle'
    ? mapOracleType(col.data_type_nm, col.data_len)
    : mapPostgresType(col.data_type_nm, col.data_len)
}

function sqlStringLiteral(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

function constraintName(prefix, tableName) {
  const base = String(tableName ?? 'TBL').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 27)
  return `${prefix}_${base}`.toUpperCase()
}

/**
 * UK 생성 후 USING INDEX 로 PK 연결
 * - Oracle: CREATE UNIQUE INDEX → ALTER TABLE ADD PK USING INDEX
 * - PostgreSQL: CREATE UNIQUE INDEX → ALTER TABLE ADD PK USING INDEX
 */
function buildUkThenPkStatements(dialect, qualified, tableName, pkCols) {
  if (!pkCols.length) return []

  const ukName = constraintName('UK', tableName)
  const pkName = constraintName('PK', tableName)
  const colList = pkCols.join(', ')

  const stmts = [
    `CREATE UNIQUE INDEX ${ukName} ON ${qualified} (${colList});`,
  ]

  if (dialect === 'oracle') {
    stmts.push(
      `ALTER TABLE ${qualified} ADD CONSTRAINT ${pkName} PRIMARY KEY (${colList}) USING INDEX ${ukName};`,
    )
  } else {
    stmts.push(
      `ALTER TABLE ${qualified} ADD CONSTRAINT ${pkName} PRIMARY KEY USING INDEX ${ukName};`,
    )
  }

  return stmts
}

/**
 * @param {'oracle'|'postgresql'} dialect
 * @param {{ schema_nm, table_nm, entity_nm, columns: Array }} table
 */
export function generateCreateTableDdl(dialect, table) {
  const columns = [...(table.columns || [])].sort(
    (a, b) => (Number(a.column_ord) || 0) - (Number(b.column_ord) || 0),
  )
  if (!columns.length) return `-- ${table.table_nm || 'TABLE'}: 컬럼 정의가 없습니다.`

  const qualified = qualifyTable(dialect, table.schema_nm, table.table_nm)
  const lines = columns.map((col) => {
    const name = quoteIdent(dialect, col.column_nm)
    const type = mapColumnType(dialect, col)
    const comment = col.attribute_nm ? `  /* ${col.attribute_nm} */` : ''
    return `  ${name} ${type}${comment}`
  })

  const pkCols = columns
    .filter((c) => String(c.pk_yn).toUpperCase() === 'Y')
    .map((c) => quoteIdent(dialect, c.column_nm))

  const header = table.entity_nm
    ? `-- ${table.entity_nm} (${table.table_nm})`
    : `-- ${table.table_nm}`

  const ddl = [
    header,
    `CREATE TABLE ${qualified} (`,
    lines.join(',\n'),
    ');',
    ...buildUkThenPkStatements(dialect, qualified, table.table_nm, pkCols),
  ]

  if (table.entity_nm) {
    ddl.push(`COMMENT ON TABLE ${qualified} IS ${sqlStringLiteral(table.entity_nm)};`)
  }
  for (const col of columns) {
    if (!col.attribute_nm) continue
    const colRef = `${qualified}.${quoteIdent(dialect, col.column_nm)}`
    ddl.push(`COMMENT ON COLUMN ${colRef} IS ${sqlStringLiteral(col.attribute_nm)};`)
  }

  return ddl.join('\n')
}

export function generateCreateTableScripts(dialect, tables) {
  if (!tables?.length) return ''
  return tables
    .map((t) => generateCreateTableDdl(dialect, t))
    .join('\n\n')
}

export const DDL_DIALECTS = [
  { id: 'oracle', label: 'Oracle' },
  { id: 'postgresql', label: 'PostgreSQL' },
]
