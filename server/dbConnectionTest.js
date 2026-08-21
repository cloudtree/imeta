import pg from 'pg'
import { resolveSslForHost } from './dbConfig.js'
import { buildOracleConnectOptions, enhanceOracleError } from './oracleConnectOptions.js'

const CONNECTION_TIMEOUT_MS = 10_000

function extractErrorCode(err) {
  // Oracle(ORA-xxxxx), 드라이버(NJS-xxx, DPI-xxxx) 코드가 메시지에 포함됨
  const match = String(err?.message || '').match(/\b(ORA-\d{5}|NJS-\d{3}|DPI-\d{4})\b/)
  if (match) return match[1]
  // pg 에러코드(28P01 등) 또는 시스템 에러코드(ECONNREFUSED 등)
  if (err?.code) return String(err.code)
  return null
}

export async function testOracleConnection(server) {
  let oracledb
  try {
    oracledb = (await import('oracledb')).default
  } catch {
    return { ok: false, code: 'DRIVER_MISSING', message: 'oracledb 드라이버가 설치되어 있지 않습니다. (npm install oracledb)' }
  }

  let connection
  try {
    connection = await oracledb.getConnection(
      buildOracleConnectOptions(server, oracledb, {
        connectTimeout: Math.floor(CONNECTION_TIMEOUT_MS / 1000),
      }),
    )
    await connection.execute('SELECT 1 FROM DUAL')
    return { ok: true, message: '접속되었습니다.' }
  } catch (err) {
    return {
      ok: false,
      code: extractErrorCode(err),
      message: enhanceOracleError(err, server),
    }
  } finally {
    await connection?.close().catch(() => {})
  }
}

export async function testDbConnection(server) {
  const dbType = (server.db_type_nm || 'POSTGRES').toUpperCase()
  if (dbType === 'ORACLE') return testOracleConnection(server)
  return testPgConnection(server)
}

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
    return { ok: true, message: '접속되었습니다.' }
  } catch (err) {
    return { ok: false, code: extractErrorCode(err), message: err.message || '데이터베이스 연결에 실패했습니다.' }
  } finally {
    await client.end().catch(() => {})
  }
}
