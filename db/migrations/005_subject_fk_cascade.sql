-- ============================================================
-- 005_subject_fk_cascade.sql
-- subject_id FK를 ON UPDATE CASCADE 로 재설정
-- "기본" 주제영역 기본 데이터 삽입
-- ============================================================

-- 1. 기존 FK 제거 후 ON UPDATE CASCADE 로 재생성
ALTER TABLE words
    DROP CONSTRAINT IF EXISTS words_subject_id_fkey,
    ADD  CONSTRAINT words_subject_id_fkey
         FOREIGN KEY (subject_id)
         REFERENCES subject_area(subject_id)
         ON UPDATE CASCADE
         ON DELETE SET NULL;

ALTER TABLE terms
    DROP CONSTRAINT IF EXISTS terms_subject_id_fkey,
    ADD  CONSTRAINT terms_subject_id_fkey
         FOREIGN KEY (subject_id)
         REFERENCES subject_area(subject_id)
         ON UPDATE CASCADE
         ON DELETE SET NULL;

ALTER TABLE domains
    DROP CONSTRAINT IF EXISTS domains_subject_id_fkey,
    ADD  CONSTRAINT domains_subject_id_fkey
         FOREIGN KEY (subject_id)
         REFERENCES subject_area(subject_id)
         ON UPDATE CASCADE
         ON DELETE SET NULL;

-- 2. "기본" 주제영역 기본 데이터 삽입
INSERT INTO subject_area (subject_id, subject_name, description, use_yn)
VALUES ('DEFAULT', '기본', '기본 주제영역', 'Y')
ON CONFLICT (subject_id) DO NOTHING;
