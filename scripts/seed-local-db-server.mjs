import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'
import { testPgConnection } from '../server/dbConnectionTest.js'

const local = {
  server_name: process.env.LOCAL_DB_SERVER_NAME?.trim() || '로컬 PostgreSQL',
  host: process.env.LOCAL_DB_HOST?.trim() || 'localhost',
  port: Number(process.env.LOCAL_DB_PORT ?? 5432),
  database_name: process.env.LOCAL_DB_NAME?.trim() || 'postgres',
  username: process.env.LOCAL_DB_USER?.trim() || 'postgres',
  password: process.env.LOCAL_DB_PASSWORD ?? 'coffee',
  ssl_enabled: process.env.LOCAL_DB_SSL?.trim() || 'N',
  description: process.env.LOCAL_DB_DESCRIPTION?.trim() || '개발용 로컬 PostgreSQL 서버',
  use_yn: 'Y',
}

const test = await testPgConnection(local)

const client = new pg.Client(getPgConfig())
await client.connect()

const dup = await client.query(
  'SELECT server_id FROM db_servers WHERE server_name = $1',
  [local.server_name],
)

let row
if (dup.rows.length) {
  const res = await client.query(
    `UPDATE db_servers
     SET host = $1, port = $2, database_name = $3, username = $4, password = $5,
         ssl_enabled = $6, description = $7, use_yn = $8,
         last_test_at = CURRENT_TIMESTAMP, last_test_ok = $9
     WHERE server_name = $10
     RETURNING server_id, server_name, host, port, database_name, username, last_test_ok`,
    [
      local.host,
      local.port,
      local.database_name,
      local.username,
      local.password,
      local.ssl_enabled,
      local.description,
      local.use_yn,
      test.ok ? 'Y' : 'N',
      local.server_name,
    ],
  )
  row = res.rows[0]
  console.log('[seed] updated existing local server registration')
} else {
  const res = await client.query(
    `INSERT INTO db_servers
       (server_name, host, port, database_name, username, password, ssl_enabled, description, use_yn, last_test_at, last_test_ok)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10)
     RETURNING server_id, server_name, host, port, database_name, username, last_test_ok`,
    [
      local.server_name,
      local.host,
      local.port,
      local.database_name,
      local.username,
      local.password,
      local.ssl_enabled,
      local.description,
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
