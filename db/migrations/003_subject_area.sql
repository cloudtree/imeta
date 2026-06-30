-- ============================================================
-- 003_subject_area.sql  –  주제영역 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS subject_area (
    subject_id   VARCHAR(20)   NOT NULL,
    subject_name VARCHAR(100)  NOT NULL,
    description  VARCHAR(1000) NULL,
    use_yn       CHAR(1)       DEFAULT 'Y' NOT NULL CHECK (use_yn IN ('Y', 'N')),
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_subject_area PRIMARY KEY (subject_id)
);

DROP TRIGGER IF EXISTS trg_subject_area_updated_at ON subject_area;
CREATE TRIGGER trg_subject_area_updated_at
    BEFORE UPDATE ON subject_area
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
