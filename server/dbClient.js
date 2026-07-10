import pg from 'pg'
import { resolveSslForHost } from './dbConfig.js'

const CONNECTION_TIMEOUT_MS = 15_000

export function createPgClient(server) {
  return new pg.Client({
    host: server.host_nm?.trim(),
    port: Number(server.port_no) || 5432,
    database: server.database_nm?.trim(),
    user: server.user_nm?.trim(),
    password: server.password_val,
    ssl: resolveSslForHost(server.host_nm?.trim(), server.ssl_yn),
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  })
}

export async function withDbServerClient(server, fn) {
  const client = createPgClient(server)
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end().catch(() => {})
  }
}
