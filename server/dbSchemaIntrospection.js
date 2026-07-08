const SYSTEM_SCHEMAS = new Set(['information_schema', 'pg_catalog'])

function isUserSchema(schema) {
  return !SYSTEM_SCHEMAS.has(schema)
    && !schema.startsWith('pg_toast')
    && !schema.startsWith('pg_temp')
}

function formatDataType(column) {
  const type = column.udt_name || column.data_type
  if (column.character_maximum_length != null) {
    return `${type}(${column.character_maximum_length})`
  }
  if (
    ['numeric', 'decimal'].includes(column.data_type)
    && column.numeric_precision != null
  ) {
    if (column.numeric_scale != null) {
      return `${type}(${column.numeric_precision},${column.numeric_scale})`
    }
    return `${type}(${column.numeric_precision})`
  }
  return type
}

function formatLengthPrecision(column) {
  if (column.character_maximum_length != null) return String(column.character_maximum_length)
  if (
    ['numeric', 'decimal'].includes(column.data_type)
    && column.numeric_precision != null
  ) {
    if (column.numeric_scale != null) {
      return `${column.numeric_precision},${column.numeric_scale}`
    }
    return String(column.numeric_precision)
  }
  return '-'
}

async function fetchTableColumnIndex(client) {
  const { rows } = await client.query(
    `SELECT
       c.table_schema,
       c.table_name,
       c.column_name,
       col_description(
         (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
         c.ordinal_position
       ) AS column_comment
     FROM information_schema.columns c
     WHERE c.table_schema NOT IN ('information_schema', 'pg_catalog')
       AND c.table_schema NOT LIKE 'pg_%'
     ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
  )

  const columnMap = new Map()
  for (const row of rows) {
    if (!isUserSchema(row.table_schema)) continue
    const key = `${row.table_schema}.${row.table_name}`
    if (!columnMap.has(key)) columnMap.set(key, [])
    columnMap.get(key).push({
      column_name: row.column_name,
      column_comment: row.column_comment || '',
    })
  }
  return columnMap
}

export async function fetchUserTables(client) {
  const tables = await fetchUserTableSummaries(client)
  const columnMap = await fetchTableColumnIndex(client)

  return tables.map((table) => ({
    ...table,
    columns: columnMap.get(table.table_key) ?? [],
  }))
}

async function fetchUserTableSummaries(client) {
  const { rows } = await client.query(
    `WITH user_tables AS (
       SELECT table_schema, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('information_schema', 'pg_catalog')
         AND table_schema NOT LIKE 'pg_%'
     ),
     pk_cols AS (
       SELECT
         tc.table_schema,
         tc.table_name,
         string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS pk_columns
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_schema = kcu.constraint_schema
        AND tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
       GROUP BY tc.table_schema, tc.table_name
     ),
     col_counts AS (
       SELECT table_schema, table_name, count(*)::int AS column_count
       FROM information_schema.columns
       WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
         AND table_schema NOT LIKE 'pg_%'
       GROUP BY table_schema, table_name
     )
     SELECT
       ut.table_schema AS schema_name,
       ut.table_name,
       obj_description(
         (quote_ident(ut.table_schema) || '.' || quote_ident(ut.table_name))::regclass,
         'pg_class'
       ) AS table_comment,
       COALESCE(cc.column_count, 0) AS column_count,
       pk.pk_columns
     FROM user_tables ut
     LEFT JOIN col_counts cc
       ON cc.table_schema = ut.table_schema
      AND cc.table_name = ut.table_name
     LEFT JOIN pk_cols pk
       ON pk.table_schema = ut.table_schema
      AND pk.table_name = ut.table_name
     ORDER BY ut.table_schema, ut.table_name`,
  )

  return rows
    .filter((row) => isUserSchema(row.schema_name))
    .map((row) => ({
      schema_name: row.schema_name,
      table_name: row.table_name,
      table_comment: row.table_comment || '',
      column_count: row.column_count,
      pk_columns: row.pk_columns || '',
      table_key: `${row.schema_name}.${row.table_name}`,
    }))
}

export async function fetchTableDefinition(client, schemaName, tableName, { search } = {}) {
  const tableResult = await client.query(
    `SELECT
       $1::text AS schema_name,
       $2::text AS table_name,
       obj_description(
         (quote_ident($1) || '.' || quote_ident($2))::regclass,
         'pg_class'
       ) AS table_comment`,
    [schemaName, tableName],
  )

  if (!tableResult.rows.length) {
    return null
  }

  const columnsResult = await client.query(
    `SELECT
       c.ordinal_position,
       c.column_name,
       c.data_type,
       c.udt_name,
       c.character_maximum_length,
       c.numeric_precision,
       c.numeric_scale,
       c.is_nullable,
       c.column_default,
       col_description(
         (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
         c.ordinal_position
       ) AS column_comment
     FROM information_schema.columns c
     WHERE c.table_schema = $1
       AND c.table_name = $2
     ORDER BY c.ordinal_position`,
    [schemaName, tableName],
  )

  const pkResult = await client.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     WHERE tc.constraint_type = 'PRIMARY KEY'
       AND tc.table_schema = $1
       AND tc.table_name = $2
     ORDER BY kcu.ordinal_position`,
    [schemaName, tableName],
  )

  const fkResult = await client.query(
    `SELECT
       kcu.column_name,
       ccu.table_schema AS foreign_schema_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_schema = tc.constraint_schema
      AND ccu.constraint_name = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1
       AND tc.table_name = $2`,
    [schemaName, tableName],
  )

  const pkSet = new Set(pkResult.rows.map((row) => row.column_name))
  const fkMap = new Map(
    fkResult.rows.map((row) => [
      row.column_name,
      `${row.foreign_schema_name}.${row.foreign_table_name}(${row.foreign_column_name})`,
    ]),
  )

  const columns = columnsResult.rows.map((column) => ({
    seq_no: column.ordinal_position,
    column_name: column.column_name,
    column_comment: column.column_comment || '',
    data_type: formatDataType(column),
    length_precision: formatLengthPrecision(column),
    pk_yn: pkSet.has(column.column_name) ? 'Y' : 'N',
    fk_ref: fkMap.get(column.column_name) || '',
    nullable_yn: column.is_nullable === 'YES' ? 'Y' : 'N',
    default_value: column.column_default ?? '',
  }))

  const normalizedSearch = search?.trim().toLowerCase()
  const filteredColumns = normalizedSearch
    ? columns.filter((column) =>
      column.column_name.toLowerCase().includes(normalizedSearch)
      || column.column_comment.toLowerCase().includes(normalizedSearch)
      || column.data_type.toLowerCase().includes(normalizedSearch)
      || column.fk_ref.toLowerCase().includes(normalizedSearch),
    )
    : columns

  return {
    schema_name: schemaName,
    table_name: tableName,
    table_comment: tableResult.rows[0].table_comment || '',
    columns: filteredColumns,
    total_columns: columns.length,
  }
}
