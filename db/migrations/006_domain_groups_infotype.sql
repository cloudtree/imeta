-- ============================================================
-- 006_domain_groups_infotype.sql
-- domain_groups 테이블 및 domains.infotype 컬럼 추가
-- ============================================================

CREATE TABLE IF NOT EXISTS domain_groups (
    group_id   SERIAL       PRIMARY KEY,
    group_nm   VARCHAR(100) NOT NULL UNIQUE,
    group_desc TEXT,
    use_yn     CHAR(1)      DEFAULT 'Y' CHECK (use_yn IN ('Y', 'N')),
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_domain_groups_updated_at ON domain_groups;
CREATE TRIGGER trg_domain_groups_updated_at
    BEFORE UPDATE ON domain_groups
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

ALTER TABLE domains
    ADD COLUMN IF NOT EXISTS infotype VARCHAR(100);
