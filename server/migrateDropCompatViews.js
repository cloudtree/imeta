import { pool } from './db.js'
import { TABLE_RENAME } from './metaSchema.js'

/**
 * API/UI 표준 물리명 전환 후 불필요해진 호환 VIEW 삭제
 */
export async function migrateDropCompatViews() {
  const client = await pool.connect()
  let dropped = 0
  try {
    for (const oldName of Object.keys(TABLE_RENAME)) {
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.views
         WHERE table_schema = 'public' AND table_name = $1`,
        [oldName],
      )
      if (!rows.length) continue
      await client.query(`DROP VIEW IF EXISTS ${oldName} CASCADE`)
      dropped += 1
    }
    console.log(`[migrateDropCompatViews] dropped=${dropped}`)
  } finally {
    client.release()
  }
}
