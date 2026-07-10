import { pool } from './db.js'
import { TABLE_RENAME, COLUMN_RENAME } from './metaSchema.js'

/**
 * imetadb 내부 메타 테이블/컬럼을 표준 물리명으로 ALTER (idempotent)
 * - 구명 존재 & 신명 없음 → RENAME
 * - domains.infotype 은 info_type 으로 병합 후 삭제
 */

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
       AND table_type = 'BASE TABLE'`,
    [tableName],
  )
  return rows.length > 0
}

async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName],
  )
  return rows.length > 0
}

async function mergeDomainsInfotype(client, tableName) {
  // 구 테이블명 또는 신 테이블명 모두 대응
  if (!(await tableExists(client, tableName))) return
  const hasInfotype = await columnExists(client, tableName, 'infotype')
  const hasInfoType = await columnExists(client, tableName, 'info_type')
  const hasInfoTypeNm = await columnExists(client, tableName, 'info_type_nm')

  if (hasInfotype && hasInfoType && !hasInfoTypeNm) {
    await client.query(`
      UPDATE ${tableName}
      SET info_type = COALESCE(NULLIF(TRIM(info_type), ''), infotype)
      WHERE infotype IS NOT NULL
        AND (info_type IS NULL OR TRIM(info_type) = '')
    `)
    await client.query(`ALTER TABLE ${tableName} DROP COLUMN IF EXISTS infotype`)
  } else if (hasInfotype && hasInfoTypeNm) {
    await client.query(`
      UPDATE ${tableName}
      SET info_type_nm = COALESCE(NULLIF(TRIM(info_type_nm), ''), infotype)
      WHERE infotype IS NOT NULL
        AND (info_type_nm IS NULL OR TRIM(info_type_nm) = '')
    `)
    await client.query(`ALTER TABLE ${tableName} DROP COLUMN IF EXISTS infotype`)
  } else if (hasInfotype && !hasInfoType && !hasInfoTypeNm) {
    await client.query(
      `ALTER TABLE ${tableName} RENAME COLUMN infotype TO info_type_nm`,
    )
  }
}

async function renameColumns(client, oldTableKey, currentTableName) {
  const colMap = COLUMN_RENAME[oldTableKey]
  if (!colMap) return { renamed: 0 }

  let renamed = 0
  for (const [oldCol, newCol] of Object.entries(colMap)) {
    if (oldCol === newCol) continue
    const hasOld = await columnExists(client, currentTableName, oldCol)
    const hasNew = await columnExists(client, currentTableName, newCol)
    if (hasOld && !hasNew) {
      await client.query(
        `ALTER TABLE ${currentTableName} RENAME COLUMN ${oldCol} TO ${newCol}`,
      )
      renamed += 1
    }
  }
  return { renamed }
}

async function renameTable(client, oldName, newName) {
  if (oldName === newName) return false
  const hasOld = await tableExists(client, oldName)
  const hasNew = await tableExists(client, newName)
  if (hasOld && !hasNew) {
    await client.query(`ALTER TABLE ${oldName} RENAME TO ${newName}`)
    return true
  }
  return false
}

export async function migrateInternalSchemaRename() {
  const client = await pool.connect()
  let tablesRenamed = 0
  let columnsRenamed = 0

  try {
    await client.query('BEGIN')

    // 1) domains infotype 병합 (구 테이블명 기준)
    await mergeDomainsInfotype(client, 'domains')
    await mergeDomainsInfotype(client, 'meta_std_domain_m')

    // 2) 컬럼 먼저 (구 테이블명에 대해), 이후 테이블명
    for (const [oldTable, newTable] of Object.entries(TABLE_RENAME)) {
      const workingName = (await tableExists(client, oldTable))
        ? oldTable
        : ((await tableExists(client, newTable)) ? newTable : null)
      if (!workingName) continue

      const { renamed } = await renameColumns(client, oldTable, workingName)
      columnsRenamed += renamed

      if (await renameTable(client, workingName, newTable)) {
        tablesRenamed += 1
      }
    }

    // 3) 테이블 개명 후 남은 infotype 정리
    await mergeDomainsInfotype(client, 'meta_std_domain_m')

    await client.query('COMMIT')
    console.log(
      `[migrateInternalSchemaRename] tables=${tablesRenamed} columns=${columnsRenamed}`,
    )
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
