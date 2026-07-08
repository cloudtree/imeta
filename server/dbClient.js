import pg from 'pg'
import { resolveSslForHost } from './dbConfig.js'

const CONNECTION_TIMEOUT_MS = 15_000

export function createPgClient(server) {
  return new pg.Client({
    host: server.host?.trim(),
    port: Number(server.port) || 5432,
    database: server.database_name?.trim(),
    user: server.username?.trim(),
    password: server.password,
    ssl: resolveSslForHost(server.host?.trim(), server.ssl_enabled),
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
