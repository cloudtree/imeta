import pg from 'pg'
import { resolveSslForHost } from './dbConfig.js'

const CONNECTION_TIMEOUT_MS = 10_000

export async function testPgConnection({
  host_nm,
  port_no = 5432,
  database_nm,
  user_nm,
  password_val,
  ssl_yn = 'Y',
}) {
  const client = new pg.Client({
    host: host_nm?.trim(),
    port: Number(port_no) || 5432,
    database: database_nm?.trim(),
    user: user_nm?.trim(),
    password: password_val,
    ssl: resolveSslForHost(host_nm?.trim(), ssl_yn),
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  })

  try {
    await client.connect()
    await client.query('SELECT 1')
    return { ok: true, message: '데이터베이스 연결에 성공했습니다.' }
  } catch (err) {
    return { ok: false, message: err.message || '데이터베이스 연결에 실패했습니다.' }
  } finally {
    await client.end().catch(() => {})
  }
}
