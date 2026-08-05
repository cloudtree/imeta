-- ============================================================
-- 016_db_server_type.sql  –  DB 서버 등록에 DB 종류(db_type_nm) 추가
--   POSTGRES(기본) / ORACLE
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_db_server_m') THEN
    ALTER TABLE meta_db_server_m
      ADD COLUMN IF NOT EXISTS db_type_nm VARCHAR(20) NOT NULL DEFAULT 'POSTGRES';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_meta_db_server_m_db_type'
    ) THEN
      ALTER TABLE meta_db_server_m
        ADD CONSTRAINT chk_meta_db_server_m_db_type CHECK (db_type_nm IN ('POSTGRES', 'ORACLE'));
    END IF;

    COMMENT ON COLUMN meta_db_server_m.db_type_nm IS 'DB종류명 (POSTGRES/ORACLE)';
  END IF;
END $$;
