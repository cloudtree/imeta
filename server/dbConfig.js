import 'dotenv/config'

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`환경 변수 ${name}이(가) 설정되지 않았습니다. .env 파일을 확인하세요.`)
  }
  return value
}

function resolveSsl() {
  const v = process.env.DB_SSL?.trim().toLowerCase()
  if (v === 'true' || v === '1') return { rejectUnauthorized: false }
  return undefined
}

export function getPgConfig() {
  return {
    host:     requireEnv('DB_HOST'),
    port:     Number(process.env.DB_PORT ?? 5432),
    database: requireEnv('DB_NAME'),
    user:     requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    ssl:      resolveSsl(),
  }
}

export function getPoolOptions() {
  return {
    ...getPgConfig(),
    min: Number(process.env.DB_POOL_MIN ?? 2),
    max: Number(process.env.DB_POOL_MAX ?? 10),
  }
}
