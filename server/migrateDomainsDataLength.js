import { pool } from './db.js'

/**
 * domains.data_length(INT) + data_scale(INT) → data_length VARCHAR(20) ("100" | "7,2")
 * idempotent — safe to run on every server start
 */
export async function migrateDomainsDataLength() {
  const client = await pool.connect()
  try {
    const col = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'domains'
        AND column_name IN ('data_length', 'data_scale', 'data_length_new')
    `)
    const cols = Object.fromEntries(col.rows.map((r) => [r.column_name, r.data_type]))

    if (!cols.data_length && !cols.data_length_new) return

    const lengthIsInt = cols.data_length === 'integer'
    const hasScale    = cols.data_scale === 'integer'

    if (!lengthIsInt && !hasScale) return

    await client.query('BEGIN')

    if (lengthIsInt && !cols.data_length_new) {
      await client.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS data_length_new VARCHAR(20)`)
    }

    if (lengthIsInt) {
      await client.query(`
        UPDATE domains SET data_length_new = CASE
          WHEN UPPER(COALESCE(data_type, '')) IN ('NUMBER', 'INTEGER') AND data_length IS NOT NULL
            THEN data_length::varchar || ',' || COALESCE(data_scale, 0)::varchar
          WHEN data_length IS NOT NULL THEN data_length::varchar
          ELSE NULL
        END
        WHERE data_length_new IS NULL
      `)
    }

    if (hasScale) {
      await client.query(`ALTER TABLE domains DROP COLUMN IF EXISTS data_scale`)
    }

    if (lengthIsInt) {
      await client.query(`ALTER TABLE domains DROP COLUMN IF EXISTS data_length`)
      await client.query(`ALTER TABLE domains RENAME COLUMN data_length_new TO data_length`)
    }

    await client.query('COMMIT')
    console.log('[migrate] domains.data_length → VARCHAR(20) (7,2 형식) 완료')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[migrate] domains.data_length migration failed:', err.message)
  } finally {
    client.release()
  }
}
