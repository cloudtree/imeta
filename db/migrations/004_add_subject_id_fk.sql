-- ============================================================
-- 004_add_subject_id_fk.sql
-- words / terms / domains 에 subject_id (FK → subject_area) 추가
-- ============================================================

ALTER TABLE words
    ADD COLUMN IF NOT EXISTS subject_id VARCHAR(20) NULL
        REFERENCES subject_area(subject_id) ON DELETE SET NULL;

ALTER TABLE terms
    ADD COLUMN IF NOT EXISTS subject_id VARCHAR(20) NULL
        REFERENCES subject_area(subject_id) ON DELETE SET NULL;

ALTER TABLE domains
    ADD COLUMN IF NOT EXISTS subject_id VARCHAR(20) NULL
        REFERENCES subject_area(subject_id) ON DELETE SET NULL;
