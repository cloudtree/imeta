import fs from 'node:fs'
import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/apply-migration.mjs <sql-file>')
  process.exit(1)
}

const client = new pg.Client(getPgConfig())
await client.connect()
await client.query(fs.readFileSync(file, 'utf8'))
const { rows } = await client.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'meta_db_server_m' ORDER BY ordinal_position",
)
console.log('[migrate] applied:', file)
console.log('[migrate] meta_db_server_m columns:', rows.map((r) => r.column_name).join(', '))
await client.end()
