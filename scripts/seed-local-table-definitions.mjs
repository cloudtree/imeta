import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'
import { fetchTableDefinition } from '../server/dbSchemaIntrospection.js'

const DB_TYPE = 'PostgreSQL'
const SCHEMA = process.env.LOCAL_DB_SCHEMA?.trim() || 'public'

const localConfig = {
  host: process.env.LOCAL_DB_HOST?.trim() || 'localhost',
  port: Number(process.env.LOCAL_DB_PORT ?? 5432),
  database: process.env.LOCAL_DB_NAME?.trim() || 'postgres',
  user: process.env.LOCAL_DB_USER?.trim() || 'postgres',
  password: process.env.LOCAL_DB_PASSWORD ?? 'coffee',
}

const ENTITY_NAMES = {
  words: '표준단어',
  domains: '표준도메인',
  terms: '표준용어',
  subject_area: '주제영역',
  domain_groups: '도메인그룹',
  db_servers: 'DB서버',
  table_definitions: '테이블정의서',
}

const ATTRIBUTE_NAMES = {
  word_id: '단어ID',
  word_nm: '단어명',
  abb_word_nm: '단어약어명',
  all_word_nm: '단어전체명',
  kor_synonym_nm: '한글동의어명',
  taxon_yn: '분류여부',
  word_desc: '단어설명',
  domain_id: '도메인ID',
  domain_nm: '도메인명',
  data_type: '데이터타입',
  info_type: '인포타입',
  domain_div_cd: '도메인구분코드',
  data_length: '데이터길이',
  data_scale: '데이터스케일',
  domain_desc: '도메인설명',
  term_id: '용어ID',
  logical_term: '논리용어명',
  physical_term: '물리용어명',
  data_len: '데이터길이',
  term_desc: '용어설명',
  subject_id: '주제영역ID',
  subject_name: '주제영역명',
  description: '설명',
  group_id: '그룹ID',
  group_name: '그룹명',
  infotype: '인포타입',
  server_id: '서버ID',
  server_name: '서버명',
  host: '호스트',
  port: '포트',
  database_name: '데이터베이스명',
  username: '사용자명',
  password: '비밀번호',
  ssl_enabled: 'SSL사용여부',
  last_test_at: '최종테스트일시',
  last_test_ok: '최종테스트성공여부',
  def_id: '정의ID',
  schema_name: '스키마명',
  db_type: 'DB종류',
  entity_name: '엔티티명',
  table_name: '테이블명',
  attribute_name: '속성명',
  column_name: '컬럼명',
  column_order: '컬럼명순서',
  pk_yn: 'PK여부',
  domain_name: '도메인명',
  use_yn: '사용여부',
  created_at: '생성일시',
  updated_at: '수정일시',
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
  return ATTRIBUTE_NAMES[columnName] || columnName
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
        schema_name: SCHEMA,
        db_type: DB_TYPE,
        entity_name: entityName,
        table_name: tableName,
        attribute_name: toAttributeName(column.column_name, column.column_comment),
        column_name: column.column_name,
        column_order: column.seq_no,
        pk_yn: column.pk_yn,
        data_type,
        data_length: length || null,
        domain_name: null,
        infotype: null,
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
        `INSERT INTO table_definitions
           (schema_name, db_type, entity_name, table_name, attribute_name, column_name,
            column_order, pk_yn, data_type, data_length, domain_name, infotype, use_yn)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (schema_name, db_type, table_name, column_name)
         DO UPDATE SET
           entity_name = EXCLUDED.entity_name,
           attribute_name = EXCLUDED.attribute_name,
           column_order = EXCLUDED.column_order,
           pk_yn = EXCLUDED.pk_yn,
           data_type = EXCLUDED.data_type,
           data_length = EXCLUDED.data_length,
           use_yn = EXCLUDED.use_yn`,
        [
          row.schema_name,
          row.db_type,
          row.entity_name,
          row.table_name,
          row.attribute_name,
          row.column_name,
          row.column_order,
          row.pk_yn,
          row.data_type,
          row.data_length,
          row.domain_name,
          row.infotype,
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
    `SELECT to_regclass('public.table_definitions') AS table_ref`,
  )
  if (!check.rows[0]?.table_ref) {
    throw new Error(
      'table_definitions 테이블이 없습니다. 먼저 db/migrations/009_table_definitions.sql 마이그레이션을 실행하세요.',
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

  const tableCount = new Set(rows.map((row) => row.table_name)).size
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
