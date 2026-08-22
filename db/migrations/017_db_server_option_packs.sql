-- ============================================================
-- 017_db_server_option_packs.sql
--   Oracle 유료 옵션 팩 사용 여부 (서버별 설정)
--   - diag_pack_yn   : Diagnostics Pack (AWR/ASH/ADDM)  기본 'N'
--   - tuning_pack_yn : Tuning Pack (SQL Tuning Advisor) 기본 'N'
--   ※ 'Y' 설정은 해당 Oracle 라이선스 보유가 전제됨
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_db_server_m') THEN
    ALTER TABLE meta_db_server_m
      ADD COLUMN IF NOT EXISTS diag_pack_yn CHAR(1) NOT NULL DEFAULT 'N',
      ADD COLUMN IF NOT EXISTS tuning_pack_yn CHAR(1) NOT NULL DEFAULT 'N';

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_meta_db_server_m_diag_pack') THEN
      ALTER TABLE meta_db_server_m
        ADD CONSTRAINT chk_meta_db_server_m_diag_pack CHECK (diag_pack_yn IN ('Y', 'N'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_meta_db_server_m_tuning_pack') THEN
      ALTER TABLE meta_db_server_m
        ADD CONSTRAINT chk_meta_db_server_m_tuning_pack CHECK (tuning_pack_yn IN ('Y', 'N'));
    END IF;

    COMMENT ON COLUMN meta_db_server_m.diag_pack_yn IS 'Diagnostics Pack 사용여부 (AWR/ASH/ADDM, 유료 라이선스 필요)';
    COMMENT ON COLUMN meta_db_server_m.tuning_pack_yn IS 'Tuning Pack 사용여부 (SQL Tuning Advisor, 유료 라이선스 필요)';
  END IF;
END $$;
