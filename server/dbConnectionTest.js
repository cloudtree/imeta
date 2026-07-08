import pg from 'pg'
import { resolveSslForHost } from './dbConfig.js'

const CONNECTION_TIMEOUT_MS = 10_000

export async function testPgConnection({
  host,
  port = 5432,
  database_name,
  username,
  password,
  ssl_enabled = 'Y',
}) {
  const client = new pg.Client({
    host: host?.trim(),
    port: Number(port) || 5432,
    database: database_name?.trim(),
    user: username?.trim(),
    password,
    ssl: resolveSslForHost(host?.trim(), ssl_enabled),
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
