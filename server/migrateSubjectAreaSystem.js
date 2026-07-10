import { pool } from './db.js'

/**
 * meta_subject_area_m 에 시스템 연계 컬럼 추가 (idempotent)
 */
export async function migrateSubjectAreaSystem() {
  const hasSubject = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'meta_subject_area_m'
  `)
  if (!hasSubject.rows.length) return

  await pool.query(`
    ALTER TABLE meta_subject_area_m
      ADD COLUMN IF NOT EXISTS system_id INTEGER,
      ADD COLUMN IF NOT EXISTS system_nm VARCHAR(200)
  `)

  const fk = await pool.query(`
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'meta_subject_area_m'
      AND constraint_name = 'meta_subject_area_m_system_id_fkey'
  `)
  if (!fk.rows.length) {
    const sys = await pool.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'meta_system_m'
    `)
    if (sys.rows.length) {
      await pool.query(`
        ALTER TABLE meta_subject_area_m
          ADD CONSTRAINT meta_subject_area_m_system_id_fkey
          FOREIGN KEY (system_id) REFERENCES meta_system_m(system_id)
          ON DELETE SET NULL
      `)
    }
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_subject_area_m_system_id
      ON meta_subject_area_m(system_id)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_meta_subject_area_m_system_nm
      ON meta_subject_area_m(system_nm)
  `)
}
