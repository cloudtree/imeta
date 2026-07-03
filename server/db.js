import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

export const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME     ?? 'postgres',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  min:      Number(process.env.DB_POOL_MIN ?? 2),
  max:      Number(process.env.DB_POOL_MAX ?? 10),
  ssl: (process.env.DB_HOST ?? '').includes('render.com') || (process.env.DATABASE_URL ?? '').includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined,
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err)
})
