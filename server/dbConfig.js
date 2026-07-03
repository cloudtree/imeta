import 'dotenv/config'

const RENDER_INTERNAL_HOST = /^dpg-[a-z0-9-]+(-a)?$/i

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `환경 변수 ${name}이(가) 설정되지 않았습니다. Render에서는 PostgreSQL을 Web Service에 Link Database 하면 DATABASE_URL이 자동 설정됩니다.`,
    )
  }
  return value
}

function resolveSsl(source = '') {
  const flag = process.env.DB_SSL?.trim().toLowerCase()
  if (flag === 'true' || flag === '1') return { rejectUnauthorized: false }
  if (flag === 'false' || flag === '0') return undefined
  if (source.includes('render.com')) return { rejectUnauthorized: false }
  if (RENDER_INTERNAL_HOST.test(source)) return undefined
  return undefined
}

function parseDatabaseUrl(url) {
  try {
    const normalized = url.replace(/^postgres:\/\//, 'postgresql://')
    const parsed = new URL(normalized)
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || ''),
      user: decodeURIComponent(parsed.username || ''),
    }
  } catch {
    return null
  }
}

function validateDatabaseName(database, user) {
  if (!database) return

  if (database === user && database.endsWith('_user')) {
    throw new Error(
      `PostgreSQL database name "${database}" is the username, not the database. `
      + 'Set DB_NAME=imetadb (database) and DB_USER=imetadb_user (user), '
      + 'or Link Database on Render so DATABASE_URL is injected automatically.',
    )
  }
}

function pickDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim()
    || process.env.DATABASE_URL_INTERNAL?.trim()
    || process.env.RENDER_DATABASE_URL?.trim()
    || null
  )
}

function pickPgEnvConfig() {
  const host = process.env.PGHOST?.trim()
  const database = process.env.PGDATABASE?.trim()
  const user = process.env.PGUSER?.trim()
  const password = process.env.PGPASSWORD

  if (!host || !database || !user || password == null || password === '') return null

  validateDatabaseName(database, user)
  return {
    host,
    port:     Number(process.env.PGPORT ?? 5432),
    database,
    user,
    password,
    ssl:      resolveSsl(host),
  }
}

export function assertDbConfigured() {
  if (pickDatabaseUrl() || pickPgEnvConfig()) return

  const missing = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].filter(
    (key) => !process.env[key]?.trim(),
  )

  if (missing.length === 0) return

  throw new Error(
    `Database environment variables are missing (${missing.join(', ')}). `
    + 'On Render: Web Service → Environment → Link Database, or set DATABASE_URL / DB_* and redeploy.',
  )
}

export function describeDbTarget() {
  const databaseUrl = pickDatabaseUrl()
  if (databaseUrl) {
    const parsed = parseDatabaseUrl(databaseUrl)
    return parsed
      ? { source: 'DATABASE_URL', host: parsed.host, database: parsed.database, user: parsed.user }
      : { source: 'DATABASE_URL', host: '(parsed failed)', database: '?', user: '?' }
  }

  const pg = pickPgEnvConfig()
  if (pg) {
    return { source: 'PG*', host: pg.host, database: pg.database, user: pg.user }
  }

  return {
    source: 'DB_*',
    host: process.env.DB_HOST?.trim() || '?',
    database: process.env.DB_NAME?.trim() || '?',
    user: process.env.DB_USER?.trim() || '?',
  }
}

export function getPgConfig() {
  const databaseUrl = pickDatabaseUrl()
  if (databaseUrl) {
    const parsed = parseDatabaseUrl(databaseUrl)
    if (parsed) validateDatabaseName(parsed.database, parsed.user)
    return {
      connectionString: databaseUrl,
      ssl: resolveSsl(databaseUrl),
    }
  }

  const pgConfig = pickPgEnvConfig()
  if (pgConfig) return pgConfig

  const host = requireEnv('DB_HOST')
  const database = requireEnv('DB_NAME')
  const user = requireEnv('DB_USER')
  validateDatabaseName(database, user)

  return {
    host,
    port:     Number(process.env.DB_PORT ?? 5432),
    database,
    user,
    password: requireEnv('DB_PASSWORD'),
    ssl:      resolveSsl(host),
  }
}

export function getPoolOptions() {
  assertDbConfigured()
  return {
    ...getPgConfig(),
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  }
}
