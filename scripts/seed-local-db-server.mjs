import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'
import { testPgConnection } from '../server/dbConnectionTest.js'

const local = {
  db_server_nm: process.env.LOCAL_DB_SERVER_NAME?.trim() || '로컬 PostgreSQL',
  host_nm: process.env.LOCAL_DB_HOST?.trim() || 'localhost',
  port_no: Number(process.env.LOCAL_DB_PORT ?? 5432),
  database_nm: process.env.LOCAL_DB_NAME?.trim() || 'imetadb',
  user_nm: process.env.LOCAL_DB_USER?.trim() || 'postgres',
  password_val: process.env.LOCAL_DB_PASSWORD ?? 'americano',
  ssl_yn: process.env.LOCAL_DB_SSL?.trim() || 'N',
  db_server_desc: process.env.LOCAL_DB_DESCRIPTION?.trim() || '개발용 로컬 PostgreSQL 서버',
  use_yn: 'Y',
}

const test = await testPgConnection(local)

const client = new pg.Client(getPgConfig())
await client.connect()

const dup = await client.query(
  'SELECT db_server_id FROM meta_db_server_m WHERE db_server_nm = $1',
  [local.db_server_nm],
)

let row
if (dup.rows.length) {
  const res = await client.query(
    `UPDATE meta_db_server_m
     SET host_nm = $1, port_no = $2, database_nm = $3, user_nm = $4, password_val = $5,
         ssl_yn = $6, db_server_desc = $7, use_yn = $8,
         last_test_dtm = CURRENT_TIMESTAMP, last_test_yn = $9
     WHERE db_server_nm = $10
     RETURNING db_server_id, db_server_nm, host_nm, port_no, database_nm, user_nm, last_test_yn`,
    [
      local.host_nm,
      local.port_no,
      local.database_nm,
      local.user_nm,
      local.password_val,
      local.ssl_yn,
      local.db_server_desc,
      local.use_yn,
      test.ok ? 'Y' : 'N',
      local.db_server_nm,
    ],
  )
  row = res.rows[0]
  console.log('[seed] updated existing local server registration')
} else {
  const res = await client.query(
    `INSERT INTO meta_db_server_m
       (db_server_nm, host_nm, port_no, database_nm, user_nm, password_val, ssl_yn, db_server_desc, use_yn, last_test_dtm, last_test_yn)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)
     RETURNING db_server_id, db_server_nm, host_nm, port_no, database_nm, user_nm, last_test_yn`,
    [
      local.db_server_nm,
      local.host_nm,
      local.port_no,
      local.database_nm,
      local.user_nm,
      local.password_val,
      local.ssl_yn,
      local.db_server_desc,
      local.use_yn,
      test.ok ? 'Y' : 'N',
    ],
  )
  row = res.rows[0]
  console.log('[seed] inserted local server registration')
}

console.log(
  JSON.stringify({
    ...row,
    connectionTest: test.ok,
    connectionMessage: test.message,
  }),
)

await client.end()
