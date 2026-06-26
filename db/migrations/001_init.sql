-- ============================================================
-- 001_init.sql  –  초기 스키마 생성
-- ============================================================

-- -------------------------------------------------------
-- 1. 단어 (words)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS words (
    word_id        SERIAL       PRIMARY KEY,
    word_nm        VARCHAR(100) NOT NULL,
    abb_word_nm    VARCHAR(100) NOT NULL,
    all_word_nm    VARCHAR(100) NOT NULL,
    kor_synonym_nm VARCHAR(100) NOT NULL,
    taxon_yn       VARCHAR(1)   NOT NULL,
    word_desc      TEXT,
    use_yn         CHAR(1)      DEFAULT 'Y' CHECK (use_yn IN ('Y', 'N')),
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- 2. 도메인 (domains)  ← terms 가 참조하므로 먼저 생성
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS domains (
    domain_id     SERIAL       PRIMARY KEY,
    domain_nm     VARCHAR(100) NOT NULL,
    data_type     VARCHAR(50)  NOT NULL,
    info_type     VARCHAR(50)  NOT NULL,
    domain_div_cd VARCHAR(50)  NOT NULL,
    data_length   INT,
    data_scale    INT,
    domain_desc   TEXT,
    use_yn        CHAR(1)      DEFAULT 'Y' CHECK (use_yn IN ('Y', 'N')),
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- 3. 용어 (terms)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS terms (
    term_id       SERIAL       PRIMARY KEY,
    logical_term  VARCHAR(200) NOT NULL,
    physical_term VARCHAR(200) NOT NULL,
    domain_div_cd VARCHAR(200) NOT NULL,
    domain_id     INT          REFERENCES domains(domain_id) ON DELETE SET NULL,
    data_type     VARCHAR(50)  NOT NULL,
    data_len      VARCHAR(50)  NOT NULL,
    term_desc     TEXT,
    use_yn        CHAR(1)      DEFAULT 'Y' CHECK (use_yn IN ('Y', 'N')),
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- 4. updated_at 자동 갱신 트리거 함수
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------
-- 5. 각 테이블에 트리거 연결
-- -------------------------------------------------------
DROP TRIGGER IF EXISTS trg_words_updated_at   ON words;
CREATE TRIGGER trg_words_updated_at
    BEFORE UPDATE ON words
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_domains_updated_at ON domains;
CREATE TRIGGER trg_domains_updated_at
    BEFORE UPDATE ON domains
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_terms_updated_at   ON terms;
CREATE TRIGGER trg_terms_updated_at
    BEFORE UPDATE ON terms
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
