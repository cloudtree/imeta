-- ============================================================
-- 008_db_servers.sql  –  DB 서버 등록 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS db_servers (
    server_id     SERIAL        PRIMARY KEY,
    server_name   VARCHAR(100)  NOT NULL,
    host          VARCHAR(255)  NOT NULL,
    port          INT           NOT NULL DEFAULT 5432,
    database_name VARCHAR(100)  NOT NULL,
    username      VARCHAR(100)  NOT NULL,
    password      VARCHAR(500)  NOT NULL,
    ssl_enabled   CHAR(1)       DEFAULT 'Y' NOT NULL CHECK (ssl_enabled IN ('Y', 'N')),
    description   TEXT          NULL,
    use_yn        CHAR(1)       DEFAULT 'Y' NOT NULL CHECK (use_yn IN ('Y', 'N')),
    last_test_at  TIMESTAMP     NULL,
    last_test_ok  CHAR(1)       NULL CHECK (last_test_ok IN ('Y', 'N')),
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_db_servers_name UNIQUE (server_name)
);

DROP TRIGGER IF EXISTS trg_db_servers_updated_at ON db_servers;
CREATE TRIGGER trg_db_servers_updated_at
    BEFORE UPDATE ON db_servers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
