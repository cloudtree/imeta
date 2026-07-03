import 'dotenv/config'
import { pool } from '../server/db.js'

const tables = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
)
console.log('tables:', tables.rows.map((r) => r.tablename).join(', '))

for (const t of ['subject_area', 'domain_groups', 'words', 'domains', 'terms']) {
  const c = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`)
  console.log(`${t}: ${c.rows[0].n}`)
}

const subjects = await pool.query('SELECT subject_id, subject_name FROM subject_area ORDER BY subject_id')
console.log('subject_area rows:', subjects.rows)

await pool.end()
