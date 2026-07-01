import { pool } from './db.js'

const VARCHAR_LEN = 100

/**
 * domains.data_length(INT+scale) → VARCHAR(100)
 * terms.data_len → VARCHAR(100)
 * idempotent — 서버 시작 시 실행
 */
export async function migrateDomainsDataLength() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const domainCols = await client.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'domains'
        AND column_name IN ('data_length', 'data_scale', 'data_length_new')
    `)
    const dCols = Object.fromEntries(domainCols.rows.map((r) => [r.column_name, r]))

    if (dCols.data_length || dCols.data_length_new) {
      const lengthIsInt = dCols.data_length?.data_type === 'integer'
      const hasScale    = dCols.data_scale?.data_type === 'integer'

      if (lengthIsInt && !dCols.data_length_new) {
        await client.query(`ALTER TABLE domains ADD COLUMN IF NOT EXISTS data_length_new VARCHAR(${VARCHAR_LEN})`)
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
      } else if (dCols.data_length?.data_type === 'character varying') {
        const maxLen = Number(dCols.data_length.character_maximum_length)
        if (!maxLen || maxLen < VARCHAR_LEN) {
          await client.query(`ALTER TABLE domains ALTER COLUMN data_length TYPE VARCHAR(${VARCHAR_LEN})`)
        }
      }
    }

    const termCol = await client.query(`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'terms' AND column_name = 'data_len'
    `)
    if (termCol.rows.length) {
      const maxLen = Number(termCol.rows[0].character_maximum_length)
      if (!maxLen || maxLen !== VARCHAR_LEN) {
        await client.query(`ALTER TABLE terms ALTER COLUMN data_len TYPE VARCHAR(${VARCHAR_LEN})`)
      }
    }

    await client.query('COMMIT')
    console.log(`[migrate] data_length/data_len → VARCHAR(${VARCHAR_LEN}) (7,2 형식) 완료`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[migrate] data_length migration failed:', err.message)
  } finally {
    client.release()
  }
}
