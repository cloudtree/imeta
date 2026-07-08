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

function hostFromSource(source = '') {
  if (!source) return ''
  if (source.includes('@') || source.includes('://')) {
    return parseDatabaseUrl(source)?.host || ''
  }
  return source
}

function resolveSsl(source = '') {
  const host = hostFromSource(source)
  // Render 내부 네트워크(dpg-xxx-a)는 SSL 불필요
  if (RENDER_INTERNAL_HOST.test(host)) return undefined

  const flag = process.env.DB_SSL?.trim().toLowerCase()
  if (flag === 'false' || flag === '0') return undefined
  if (flag === 'true' || flag === '1') return { rejectUnauthorized: false }
  if (host.includes('render.com')) return { rejectUnauthorized: false }
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
      password: decodeURIComponent(parsed.password || ''),
    }
  } catch {
    return null
  }
}

/** DB_NAME을 사용자명(imetadb_user)으로 잘못 넣은 경우 자동 보정 */
function normalizeDatabaseName(database, user) {
  if (database === user && database.endsWith('_user')) {
    const corrected = database.slice(0, -'_user'.length)
    console.warn(`[db] DB name "${database}" looks like a username; using "${corrected}" instead.`)
    return corrected
  }
  return database
}

function pickDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim()
    || process.env.DATABASE_URL_INTERNAL?.trim()
    || process.env.RENDER_DATABASE_URL?.trim()
    || null
  )
}

function configFromUrl(url) {
  const parsed = parseDatabaseUrl(url)
  if (!parsed) {
    return { connectionString: url, ssl: resolveSsl(url) }
  }

  const database = normalizeDatabaseName(parsed.database, parsed.user)
  if (database === parsed.database) {
    return { connectionString: url, ssl: resolveSsl(url) }
  }

  return {
    host: parsed.host,
    port: Number(parsed.port),
    database,
    user: parsed.user,
    password: parsed.password,
    ssl: resolveSsl(parsed.host),
  }
}

function pickPgEnvConfig() {
  const host = process.env.PGHOST?.trim()
  const database = normalizeDatabaseName(
    process.env.PGDATABASE?.trim() || '',
    process.env.PGUSER?.trim() || '',
  )
  const user = process.env.PGUSER?.trim()
  const password = process.env.PGPASSWORD

  if (!host || !database || !user || password == null || password === '') return null

  return {
    host,
    port:     Number(process.env.PGPORT ?? 5432),
    database,
    user,
    password,
    ssl:      resolveSsl(host),
  }
}

function pickDbEnvConfig() {
  const host = requireEnv('DB_HOST')
  const user = requireEnv('DB_USER')
  const database = normalizeDatabaseName(requireEnv('DB_NAME'), user)

  return {
    host,
    port:     Number(process.env.DB_PORT ?? 5432),
    database,
    user,
    password: requireEnv('DB_PASSWORD'),
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
    if (parsed) {
      return {
        source: 'DATABASE_URL',
        host: parsed.host,
        database: normalizeDatabaseName(parsed.database, parsed.user),
        user: parsed.user,
      }
    }
    return { source: 'DATABASE_URL', host: '?', database: '?', user: '?' }
  }

  const pg = pickPgEnvConfig()
  if (pg) {
    return { source: 'PG*', host: pg.host, database: pg.database, user: pg.user }
  }

  const user = process.env.DB_USER?.trim() || '?'
  return {
    source: 'DB_*',
    host: process.env.DB_HOST?.trim() || '?',
    database: normalizeDatabaseName(process.env.DB_NAME?.trim() || '?', user),
    user,
  }
}

export function resolveSslForHost(host, sslEnabled = 'Y') {
  if (sslEnabled === 'N' || sslEnabled === 'n') return undefined
  return resolveSsl(host)
}

export function getPgConfig() {
  const databaseUrl = pickDatabaseUrl()
  if (databaseUrl) return configFromUrl(databaseUrl)

  const pgConfig = pickPgEnvConfig()
  if (pgConfig) return pgConfig

  return pickDbEnvConfig()
}

export function getPoolOptions() {
  assertDbConfigured()
  return {
    ...getPgConfig(),
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  }
}
