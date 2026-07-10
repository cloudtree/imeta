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

    // rename 전(구명) / 후(신명) 모두 대응
    const domainTable = await resolveTable(client, ['domains', 'meta_std_domain_m'])
    const termTable = await resolveTable(client, ['terms', 'meta_std_term_m'])
    const lengthCol = domainTable === 'meta_std_domain_m' ? 'data_len' : 'data_length'
    const typeCol = domainTable === 'meta_std_domain_m' ? 'data_type_nm' : 'data_type'

    if (domainTable) {
      const domainCols = await client.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND column_name IN ($2, 'data_scale', 'data_length_new', 'data_length')
      `, [domainTable, lengthCol])
      const dCols = Object.fromEntries(domainCols.rows.map((r) => [r.column_name, r]))
      const lengthInfo = dCols[lengthCol] || dCols.data_length

      if (lengthInfo || dCols.data_length_new) {
        const lengthIsInt = lengthInfo?.data_type === 'integer'
        const hasScale = dCols.data_scale?.data_type === 'integer'
        const activeLength = lengthInfo ? lengthCol : 'data_length'

        if (lengthIsInt && !dCols.data_length_new) {
          await client.query(
            `ALTER TABLE ${domainTable} ADD COLUMN IF NOT EXISTS data_length_new VARCHAR(${VARCHAR_LEN})`,
          )
        }

        if (lengthIsInt) {
          await client.query(`
            UPDATE ${domainTable} SET data_length_new = CASE
              WHEN UPPER(COALESCE(${typeCol}, '')) IN ('NUMBER', 'INTEGER') AND ${activeLength} IS NOT NULL
                THEN ${activeLength}::varchar || ',' || COALESCE(data_scale, 0)::varchar
              WHEN ${activeLength} IS NOT NULL THEN ${activeLength}::varchar
              ELSE NULL
            END
            WHERE data_length_new IS NULL
          `)
        }

        if (hasScale) {
          await client.query(`ALTER TABLE ${domainTable} DROP COLUMN IF EXISTS data_scale`)
        }

        if (lengthIsInt) {
          await client.query(`ALTER TABLE ${domainTable} DROP COLUMN IF EXISTS ${activeLength}`)
          await client.query(
            `ALTER TABLE ${domainTable} RENAME COLUMN data_length_new TO ${lengthCol === 'data_len' ? 'data_len' : 'data_length'}`,
          )
        } else if (lengthInfo?.data_type === 'character varying') {
          const maxLen = Number(lengthInfo.character_maximum_length)
          if (!maxLen || maxLen < VARCHAR_LEN) {
            await client.query(
              `ALTER TABLE ${domainTable} ALTER COLUMN ${activeLength} TYPE VARCHAR(${VARCHAR_LEN})`,
            )
          }
        }
      }
    }

    if (termTable) {
      const termCol = await client.query(`
        SELECT character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'data_len'
      `, [termTable])
      if (termCol.rows.length) {
        const maxLen = Number(termCol.rows[0].character_maximum_length)
        if (!maxLen || maxLen !== VARCHAR_LEN) {
          await client.query(
            `ALTER TABLE ${termTable} ALTER COLUMN data_len TYPE VARCHAR(${VARCHAR_LEN})`,
          )
        }
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

async function resolveTable(client, names) {
  for (const name of names) {
    const { rows } = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
         AND table_type = 'BASE TABLE'`,
      [name],
    )
    if (rows.length) return name
  }
  return null
}
