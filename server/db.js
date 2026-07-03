import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'dpg-d93k4ataeets73dt1jb0-a.singapore-postgres.render.com',
  port:     Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME     ?? 'imetadb',
  user:     process.env.DB_USER     ?? 'imetadb_user',
  password: process.env.DB_PASSWORD ?? 'mW1xR4ybBZZJTzsDuKRiTfv8wI7pJwUf',
  min:      Number(process.env.DB_POOL_MIN ?? 2),
  max:      Number(process.env.DB_POOL_MAX ?? 10),
  ssl: (process.env.DB_HOST ?? '').includes('render.com') || (process.env.DATABASE_URL ?? '').includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined,
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})
