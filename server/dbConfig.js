import 'dotenv/config'

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `환경 변수 ${name}이(가) 설정되지 않았습니다. .env 또는 Render 환경 변수(DATABASE_URL 또는 DB_*)를 확인하세요.`,
    )
  }
  return value
}

function resolveSsl(source = '') {
  const flag = process.env.DB_SSL?.trim().toLowerCase()
  if (flag === 'true' || flag === '1') return { rejectUnauthorized: false }
  if (flag === 'false' || flag === '0') return undefined
  if (source.includes('render.com')) return { rejectUnauthorized: false }
  return undefined
}

export function getPgConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: resolveSsl(databaseUrl),
    }
  }

  const host = requireEnv('DB_HOST')
  return {
    host,
    port:     Number(process.env.DB_PORT ?? 5432),
    database: requireEnv('DB_NAME'),
    user:     requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    ssl:      resolveSsl(host),
  }
}

export function getPoolOptions() {
  return {
    ...getPgConfig(),
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  }
}
