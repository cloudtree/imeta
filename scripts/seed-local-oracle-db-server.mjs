import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'
import { testOracleConnection } from '../server/dbConnectionTest.js'

const oracle = {
  db_server_nm: process.env.LOCAL_ORACLE_SERVER_NAME?.trim() || '로컬 Oracle',
  db_type_nm: 'ORACLE',
  host_nm: process.env.LOCAL_ORACLE_HOST?.trim() || 'localhost',
  port_no: Number(process.env.LOCAL_ORACLE_PORT ?? 1521),
  database_nm: process.env.LOCAL_ORACLE_SERVICE?.trim() || 'XEPDB1',
  user_nm: process.env.LOCAL_ORACLE_USER?.trim() || 'system',
  password_val: process.env.LOCAL_ORACLE_PASSWORD ?? 'oracle',
  ssl_yn: 'N',
  db_server_desc: process.env.LOCAL_ORACLE_DESCRIPTION?.trim() || '개발용 로컬 Oracle 서버',
  use_yn: 'Y',
}

// 서비스명 후보를 순서대로 시도 (XE 기본 구성 대응)
const serviceCandidates = process.env.LOCAL_ORACLE_SERVICE
  ? [oracle.database_nm]
  : [oracle.database_nm, 'XE', 'ORCLPDB1', 'ORCL', 'FREEPDB1']

let test = { ok: false, message: '연결 테스트를 수행하지 않았습니다.' }
for (const service of serviceCandidates) {
  test = await testOracleConnection({ ...oracle, database_nm: service })
  console.log(`[seed] oracle connect test (${service}): ${test.ok ? 'OK' : test.message}`)
  if (test.ok) {
    oracle.database_nm = service
    break
  }
}

const client = new pg.Client(getPgConfig())
await client.connect()

// db_type_nm 컬럼 마이그레이션(016) 적용 보장
const migrationSql = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations/016_db_server_type.sql'),
  'utf8',
)
await client.query(migrationSql)

const dup = await client.query(
  'SELECT db_server_id FROM meta_db_server_m WHERE db_server_nm = $1',
  [oracle.db_server_nm],
)

let row
if (dup.rows.length) {
  const res = await client.query(
    `UPDATE meta_db_server_m
     SET db_type_nm = $1, host_nm = $2, port_no = $3, database_nm = $4, user_nm = $5, password_val = $6,
         ssl_yn = $7, db_server_desc = $8, use_yn = $9,
         last_test_dtm = CURRENT_TIMESTAMP, last_test_yn = $10
     WHERE db_server_nm = $11
     RETURNING db_server_id, db_server_nm, db_type_nm, host_nm, port_no, database_nm, user_nm, last_test_yn`,
    [
      oracle.db_type_nm,
      oracle.host_nm,
      oracle.port_no,
      oracle.database_nm,
      oracle.user_nm,
      oracle.password_val,
      oracle.ssl_yn,
      oracle.db_server_desc,
      oracle.use_yn,
      test.ok ? 'Y' : 'N',
      oracle.db_server_nm,
    ],
  )
  row = res.rows[0]
  console.log('[seed] updated existing local oracle server registration')
} else {
  const res = await client.query(
    `INSERT INTO meta_db_server_m
       (db_server_nm, db_type_nm, host_nm, port_no, database_nm, user_nm, password_val, ssl_yn, db_server_desc, use_yn, last_test_dtm, last_test_yn)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, $11)
     RETURNING db_server_id, db_server_nm, db_type_nm, host_nm, port_no, database_nm, user_nm, last_test_yn`,
    [
      oracle.db_server_nm,
      oracle.db_type_nm,
      oracle.host_nm,
      oracle.port_no,
      oracle.database_nm,
      oracle.user_nm,
      oracle.password_val,
      oracle.ssl_yn,
      oracle.db_server_desc,
      oracle.use_yn,
      test.ok ? 'Y' : 'N',
    ],
  )
  row = res.rows[0]
  console.log('[seed] inserted local oracle server registration')
}

console.log(
  JSON.stringify({
    ...row,
    connectionTest: test.ok,
    connectionMessage: test.message,
  }),
)

await client.end()
