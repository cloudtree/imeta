-- ============================================================
-- 018_db_server_ora_privilege.sql
--   Oracle 접속 권한 모드 (SYS 계정 ORA-28009 대응)
--   NORMAL / SYSDBA / SYSOPER  (기본 NORMAL)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_db_server_m') THEN
    ALTER TABLE meta_db_server_m
      ADD COLUMN IF NOT EXISTS ora_privilege_cd VARCHAR(10) NOT NULL DEFAULT 'NORMAL';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_meta_db_server_m_ora_priv'
    ) THEN
      ALTER TABLE meta_db_server_m
        ADD CONSTRAINT chk_meta_db_server_m_ora_priv
        CHECK (ora_privilege_cd IN ('NORMAL', 'SYSDBA', 'SYSOPER'));
    END IF;

    COMMENT ON COLUMN meta_db_server_m.ora_privilege_cd IS 'Oracle 접속 권한 (NORMAL/SYSDBA/SYSOPER). SYS 계정은 SYSDBA 필요';
  END IF;
END $$;
