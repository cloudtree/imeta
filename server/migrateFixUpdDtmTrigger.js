import { pool } from './db.js'

/**
 * 레거시 update_timestamp_column() 트리거 수정
 * - migrateInternalSchemaRename 에서 updated_at → upd_dtm 컬럼명을 바꿨지만
 *   BEFORE UPDATE 트리거 함수(update_timestamp_column)는 여전히 NEW.updated_at 을
 *   참조하고 있어, upd_dtm 컬럼만 남은 테이블을 UPDATE 할 때
 *   '"new" 레코드에 "updated_at" 필드가 없음' 오류가 발생함
 * - upd_dtm 컬럼을 갖고 있는데 여전히 update_timestamp_column 트리거가 걸린
 *   테이블을 찾아 update_upd_dtm_column 트리거로 교체 (idempotent)
 */
export async function migrateFixUpdDtmTrigger() {
  const client = await pool.connect()
  let fixed = 0

  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE OR REPLACE FUNCTION update_upd_dtm_column()
      RETURNS trigger AS $$
      BEGIN
        NEW.upd_dtm = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)

    const { rows: staleTriggers } = await client.query(`
      SELECT t.tgname, t.tgrelid::regclass::text AS table_name,
             pg_get_triggerdef(t.oid) AS def
      FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN information_schema.columns c
        ON c.table_schema = 'public'
       AND c.table_name = t.tgrelid::regclass::text
       AND c.column_name = 'upd_dtm'
      WHERE NOT t.tgisinternal AND p.proname = 'update_timestamp_column'
    `)

    for (const { tgname, table_name, def } of staleTriggers) {
      const newDef = def.replace('update_timestamp_column()', 'update_upd_dtm_column()')
      await client.query(`DROP TRIGGER ${tgname} ON ${table_name}`)
      await client.query(newDef)
      fixed += 1
    }

    await client.query('COMMIT')
    console.log(`[migrateFixUpdDtmTrigger] fixed=${fixed}`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
