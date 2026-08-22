/**
 * Drop local PostgreSQL database imetadb.
 * Usage: node scripts/drop-local-imetadb.mjs
 */
import 'dotenv/config'
import pg from 'pg'

const password = process.env.DB_PASSWORD || process.env.LOCAL_DB_PASSWORD || 'coffee'
const client = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: 'postgres',
  user: process.env.DB_USER || 'postgres',
  password,
  connectionTimeoutMillis: 8000,
})

try {
  await client.connect()
  await client.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'imetadb' AND pid <> pg_backend_pid()
  `)
  await client.query('DROP DATABASE IF EXISTS imetadb')
  const { rows } = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'imetadb'`,
  )
  if (rows.length) {
    console.error('FAIL: imetadb still exists')
    process.exit(1)
  }
  console.log('OK: dropped database imetadb')
} catch (err) {
  console.error('FAIL:', err.message)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
