import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getClientConfig() {
  return getPgConfig()
}

async function run() {
  const client = new Client(getClientConfig())
  await client.connect()
  console.log('[migrate] connected to', process.env.DB_HOST)

  const dir = path.join(__dirname, 'migrations')
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    console.log(`[migrate] running ${file}...`)
    await client.query(sql)
    console.log(`[migrate] done ${file}`)
  }

  await client.end()
  console.log('[migrate] all migrations completed')
}

run().catch((err) => {
  console.error('[migrate] failed:', err.message)
  process.exit(1)
})
