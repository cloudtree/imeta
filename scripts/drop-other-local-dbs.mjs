/**
 * Keep only imetadb (+ system DBs). Drop other user databases on local Postgres.
 * Usage: node scripts/drop-other-local-dbs.mjs
 */
import 'dotenv/config'
import pg from 'pg'

const KEEP = new Set(['imetadb', 'postgres', 'template0', 'template1'])
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
  const { rows } = await client.query(
    `SELECT datname FROM pg_database
     WHERE datistemplate = false
     ORDER BY datname`,
  )
  const all = rows.map((r) => r.datname)
  const toDrop = all.filter((name) => !KEEP.has(name))

  console.log('databases:', all.join(', ') || '(none)')
  console.log('keep:', [...KEEP].filter((n) => all.includes(n) || n.startsWith('template')).join(', '))
  console.log('drop:', toDrop.join(', ') || '(none)')

  if (!all.includes('imetadb')) {
    console.warn('WARN: imetadb does not exist yet — will still drop others')
  }

  for (const name of toDrop) {
    // identifiers only from pg_database listing — quote safely
    const quoted = `"${name.replace(/"/g, '""')}"`
    await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [name],
    )
    await client.query(`DROP DATABASE IF EXISTS ${quoted}`)
    console.log(`dropped: ${name}`)
  }

  const after = await client.query(
    `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY 1`,
  )
  console.log('remaining:', after.rows.map((r) => r.datname).join(', '))
  console.log('OK')
} catch (err) {
  console.error('FAIL:', err.message)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
