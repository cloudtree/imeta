import { buildOracleConnectOptions } from './oracleConnectOptions.js'

const CONNECT_TIMEOUT_SEC = 10

let oracledbPromise = null

async function loadOracledb() {
  if (!oracledbPromise) {
    oracledbPromise = import('oracledb').then((m) => {
      const oracledb = m.default
      oracledb.fetchAsString = [oracledb.CLOB]
      return oracledb
    })
  }
  return oracledbPromise
}

export async function withOracleConnection(server, fn) {
  const oracledb = await loadOracledb()
  const connection = await oracledb.getConnection(
    buildOracleConnectOptions(server, oracledb, { connectTimeout: CONNECT_TIMEOUT_SEC }),
  )
  try {
    return await fn(connection, oracledb)
  } finally {
    await connection.close().catch(() => {})
  }
}

export async function queryRows(connection, sql, binds = {}) {
  const oracledb = await loadOracledb()
  const result = await connection.execute(sql, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    maxRows: 5000,
  })
  return result.rows ?? []
}
