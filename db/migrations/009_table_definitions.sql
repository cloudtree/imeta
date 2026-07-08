-- ============================================================
-- 009_table_definitions.sql  –  테이블 정의서(엑셀 등록) 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS table_definitions (
    def_id          SERIAL        PRIMARY KEY,
    schema_name     VARCHAR(100)  NOT NULL,
    db_type         VARCHAR(50)   NOT NULL,
    entity_name     VARCHAR(100)  NOT NULL,
    table_name      VARCHAR(100)  NOT NULL,
    attribute_name  VARCHAR(100)  NOT NULL,
    column_name     VARCHAR(100)  NOT NULL,
    column_order    INT           NOT NULL,
    pk_yn           CHAR(1)       DEFAULT 'N' NOT NULL CHECK (pk_yn IN ('Y', 'N')),
    data_type       VARCHAR(50)   NOT NULL,
    data_length     VARCHAR(50),
    domain_name     VARCHAR(100),
    infotype        VARCHAR(50),
    use_yn          CHAR(1)       DEFAULT 'Y' NOT NULL CHECK (use_yn IN ('Y', 'N')),
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_table_definitions_column UNIQUE (schema_name, db_type, table_name, column_name)
);

DROP TRIGGER IF EXISTS trg_table_definitions_updated_at ON table_definitions;
CREATE TRIGGER trg_table_definitions_updated_at
    BEFORE UPDATE ON table_definitions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
