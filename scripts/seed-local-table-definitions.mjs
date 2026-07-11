import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'
import { fetchTableDefinition } from '../server/dbSchemaIntrospection.js'

const DB_TYPE = 'PostgreSQL'
const SCHEMA = process.env.LOCAL_DB_SCHEMA?.trim() || 'public'

const localConfig = {
  host: process.env.LOCAL_DB_HOST?.trim() || 'localhost',
  port: Number(process.env.LOCAL_DB_PORT ?? 5432),
  database: process.env.LOCAL_DB_NAME?.trim() || 'imetadb',
  user: process.env.LOCAL_DB_USER?.trim() || 'postgres',
  password: process.env.LOCAL_DB_PASSWORD ?? 'americano',
}

const ENTITY_NAMES = {
  meta_std_word_m: '표준단어기본',
  meta_std_domain_m: '표준도메인기본',
  meta_std_term_m: '표준용어기본',
  meta_subject_area_m: '주제영역기본',
  meta_domain_group_m: '도메인그룹기본',
  meta_db_server_m: 'DB서버기본',
  meta_table_def_m: '테이블정의기본',
  meta_system_m: '시스템기본',
  meta_naming_rule_m: '명명규칙기본',
  meta_user_m: '사용자기본',
  meta_data_object_m: '데이터객체기본',
}

const SKIP_TABLES = new Set([
  'schema_migrations',
])

function splitDataType(dataType) {
  const raw = String(dataType ?? '').trim()
  const match = raw.match(/^([^(]+)(?:\(([^)]+)\))?$/)
  if (!match) return { data_type: raw, data_length: null }
  const base = match[1].trim()
  const length = match[2]?.trim() || null
  return { data_type: base, data_length: length }
}

function toAttributeName(columnName, columnComment) {
  if (columnComment?.trim()) return columnComment.trim()
  return columnName
}

function toEntityName(tableName, tableComment) {
  if (tableComment?.trim()) return tableComment.trim()
  return ENTITY_NAMES[tableName] || tableName
}

async function listUserTables(client) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_type = 'BASE TABLE'
       AND table_schema = $1
     ORDER BY table_name`,
    [SCHEMA],
  )
  return rows.map((row) => row.table_name).filter((name) => !SKIP_TABLES.has(name))
}

async function buildRowsFromLocalDb(localClient) {
  const tableNames = await listUserTables(localClient)
  const rows = []

  for (const tableName of tableNames) {
    const definition = await fetchTableDefinition(localClient, SCHEMA, tableName)
    if (!definition) continue

    const entityName = toEntityName(tableName, definition.table_comment)

    for (const column of definition.columns) {
      const { data_type, data_length } = splitDataType(column.data_type)
      const length = column.length_precision !== '-' ? column.length_precision : data_length

      rows.push({
        schema_nm: SCHEMA,
        db_type_nm: DB_TYPE,
        entity_nm: entityName,
        table_nm: tableName,
        attribute_nm: toAttributeName(column.column_name, column.column_comment),
        column_nm: column.column_name,
        column_ord: column.seq_no,
        pk_yn: column.pk_yn,
        data_type_nm: data_type,
        data_len: length || null,
        domain_nm: null,
        info_type_nm: null,
        use_yn: 'Y',
      })
    }
  }

  return rows
}

async function upsertRows(metaClient, rows) {
  let inserted = 0
  let updated = 0

  await metaClient.query('BEGIN')
  try {
    for (const row of rows) {
      const result = await metaClient.query(
        `INSERT INTO meta_table_def_m
           (schema_nm, db_type_nm, entity_nm, table_nm, attribute_nm, column_nm,
            column_ord, pk_yn, data_type_nm, data_len, domain_nm, info_type_nm, use_yn)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (schema_nm, db_type_nm, table_nm, column_nm)
         DO UPDATE SET
           entity_nm = EXCLUDED.entity_nm,
           attribute_nm = EXCLUDED.attribute_nm,
           column_ord = EXCLUDED.column_ord,
           pk_yn = EXCLUDED.pk_yn,
           data_type_nm = EXCLUDED.data_type_nm,
           data_len = EXCLUDED.data_len,
           use_yn = EXCLUDED.use_yn`,
        [
          row.schema_nm,
          row.db_type_nm,
          row.entity_nm,
          row.table_nm,
          row.attribute_nm,
          row.column_nm,
          row.column_ord,
          row.pk_yn,
          row.data_type_nm,
          row.data_len,
          row.domain_nm,
          row.info_type_nm,
          row.use_yn,
        ],
      )
      if (result.rowCount === 1) inserted += 1
      else updated += 1
    }
    await metaClient.query('COMMIT')
  } catch (err) {
    await metaClient.query('ROLLBACK')
    throw err
  }

  return { inserted, updated }
}

async function ensureMigration(metaClient) {
  const check = await metaClient.query(
    `SELECT to_regclass('public.meta_table_def_m') AS table_ref`,
  )
  if (!check.rows[0]?.table_ref) {
    throw new Error(
      'meta_table_def_m 테이블이 없습니다. 먼저 마이그레이션을 실행하세요.',
    )
  }
}

const localClient = new pg.Client(localConfig)
const metaClient = new pg.Client(getPgConfig())

try {
  await localClient.connect()
  console.log('[seed] connected to local DB:', `${localConfig.host}:${localConfig.port}/${localConfig.database}`)

  await metaClient.connect()
  console.log('[seed] connected to metadata DB')

  await ensureMigration(metaClient)

  const rows = await buildRowsFromLocalDb(localClient)
  if (!rows.length) {
    console.log('[seed] no tables found in local schema:', SCHEMA)
    process.exit(0)
  }

  const tableCount = new Set(rows.map((row) => row.table_nm)).size
  const result = await upsertRows(metaClient, rows)

  console.log(
    JSON.stringify({
      schema: SCHEMA,
      db_type: DB_TYPE,
      tables: tableCount,
      columns: rows.length,
      ...result,
    }, null, 2),
  )
} finally {
  await localClient.end().catch(() => {})
  await metaClient.end().catch(() => {})
}
