import { pool } from './db.js'

/**
 * meta_data_object_m 테이블 생성 (idempotent)
 */
export async function migrateDataObjects() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meta_data_object_m (
      data_object_id   SERIAL PRIMARY KEY,
      data_object_cd   VARCHAR(50)  NOT NULL,
      data_object_nm   VARCHAR(200) NOT NULL,
      physical_nm      VARCHAR(200),
      object_type_nm   VARCHAR(30)  NOT NULL DEFAULT 'TABLE',
      subject_area_id  VARCHAR(50),
      owner_nm         VARCHAR(100),
      data_object_desc TEXT,
      use_yn           CHAR(1)      NOT NULL DEFAULT 'Y',
      reg_dtm          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      upd_dtm          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT meta_data_object_m_cd_uk UNIQUE (data_object_cd),
      CONSTRAINT meta_data_object_m_use_yn_ck CHECK (use_yn IN ('Y', 'N')),
      CONSTRAINT meta_data_object_m_type_ck CHECK (
        object_type_nm IN ('TABLE', 'VIEW', 'COLUMN', 'FILE', 'API', 'OTHER')
      )
    )
  `)
}
