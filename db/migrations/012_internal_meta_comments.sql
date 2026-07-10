-- ============================================================
-- 012_internal_meta_comments.sql
-- 내부 메타 테이블/컬럼 COMMENT (표준 엔티티명·속성명)
-- 데이터베이스검토: table_comment→엔티티명, column_comment→속성명
-- ============================================================

COMMENT ON TABLE words IS '표준단어기본';
COMMENT ON COLUMN words.word_id IS '표준단어ID';
COMMENT ON COLUMN words.word_nm IS '표준단어명';
COMMENT ON COLUMN words.abb_word_nm IS '영문약어명';
COMMENT ON COLUMN words.all_word_nm IS '영문전체명';
COMMENT ON COLUMN words.kor_synonym_nm IS '한글동의어명';
COMMENT ON COLUMN words.taxon_yn IS '분류어여부';
COMMENT ON COLUMN words.word_desc IS '표준단어설명';
COMMENT ON COLUMN words.use_yn IS '사용여부';
COMMENT ON COLUMN words.created_at IS '등록일시';
COMMENT ON COLUMN words.updated_at IS '수정일시';

COMMENT ON TABLE domains IS '표준도메인기본';
COMMENT ON COLUMN domains.domain_id IS '표준도메인ID';
COMMENT ON COLUMN domains.domain_nm IS '표준도메인명';
COMMENT ON COLUMN domains.data_type IS '데이터타입명';
COMMENT ON COLUMN domains.info_type IS '인포타입명';
COMMENT ON COLUMN domains.domain_div_cd IS '도메인그룹명';
COMMENT ON COLUMN domains.domain_desc IS '표준도메인설명';
COMMENT ON COLUMN domains.use_yn IS '사용여부';
COMMENT ON COLUMN domains.created_at IS '등록일시';
COMMENT ON COLUMN domains.updated_at IS '수정일시';

COMMENT ON TABLE terms IS '표준용어기본';
COMMENT ON COLUMN terms.term_id IS '표준용어ID';
COMMENT ON COLUMN terms.logical_term IS '논리용어명';
COMMENT ON COLUMN terms.physical_term IS '물리용어명';
COMMENT ON COLUMN terms.domain_div_cd IS '도메인그룹명';
COMMENT ON COLUMN terms.domain_id IS '표준도메인ID';
COMMENT ON COLUMN terms.data_type IS '데이터타입명';
COMMENT ON COLUMN terms.data_len IS '데이터길이';
COMMENT ON COLUMN terms.term_desc IS '표준용어설명';
COMMENT ON COLUMN terms.use_yn IS '사용여부';
COMMENT ON COLUMN terms.created_at IS '등록일시';
COMMENT ON COLUMN terms.updated_at IS '수정일시';

COMMENT ON TABLE domain_groups IS '도메인그룹기본';
COMMENT ON COLUMN domain_groups.group_id IS '도메인그룹ID';
COMMENT ON COLUMN domain_groups.group_nm IS '도메인그룹명';
COMMENT ON COLUMN domain_groups.group_desc IS '도메인그룹설명';
COMMENT ON COLUMN domain_groups.use_yn IS '사용여부';
COMMENT ON COLUMN domain_groups.created_at IS '등록일시';
COMMENT ON COLUMN domain_groups.updated_at IS '수정일시';

COMMENT ON TABLE subject_area IS '주제영역기본';
COMMENT ON COLUMN subject_area.subject_id IS '주제영역ID';
COMMENT ON COLUMN subject_area.subject_name IS '주제영역명';
COMMENT ON COLUMN subject_area.description IS '주제영역설명';
COMMENT ON COLUMN subject_area.use_yn IS '사용여부';
COMMENT ON COLUMN subject_area.created_at IS '등록일시';
COMMENT ON COLUMN subject_area.updated_at IS '수정일시';

COMMENT ON TABLE db_servers IS 'DB서버기본';
COMMENT ON COLUMN db_servers.server_id IS 'DB서버ID';
COMMENT ON COLUMN db_servers.server_name IS 'DB서버명';
COMMENT ON COLUMN db_servers.host IS '호스트명';
COMMENT ON COLUMN db_servers.port IS '포트번호';
COMMENT ON COLUMN db_servers.database_name IS '데이터베이스명';
COMMENT ON COLUMN db_servers.username IS '사용자명';
COMMENT ON COLUMN db_servers.password IS '비밀번호';
COMMENT ON COLUMN db_servers.ssl_enabled IS 'SSL사용여부';
COMMENT ON COLUMN db_servers.description IS 'DB서버설명';
COMMENT ON COLUMN db_servers.use_yn IS '사용여부';
COMMENT ON COLUMN db_servers.last_test_at IS '최종테스트일시';
COMMENT ON COLUMN db_servers.last_test_ok IS '최종테스트성공여부';
COMMENT ON COLUMN db_servers.created_at IS '등록일시';
COMMENT ON COLUMN db_servers.updated_at IS '수정일시';

COMMENT ON TABLE table_definitions IS '테이블정의기본';
COMMENT ON COLUMN table_definitions.def_id IS '테이블정의ID';
COMMENT ON COLUMN table_definitions.schema_name IS '스키마명';
COMMENT ON COLUMN table_definitions.db_type IS 'DB종류명';
COMMENT ON COLUMN table_definitions.entity_name IS '엔티티명';
COMMENT ON COLUMN table_definitions.table_name IS '테이블명';
COMMENT ON COLUMN table_definitions.attribute_name IS '속성명';
COMMENT ON COLUMN table_definitions.column_name IS '컬럼명';
COMMENT ON COLUMN table_definitions.column_order IS '컬럼순서';
COMMENT ON COLUMN table_definitions.pk_yn IS 'PK여부';
COMMENT ON COLUMN table_definitions.data_type IS '데이터타입명';
COMMENT ON COLUMN table_definitions.data_length IS '데이터길이';
COMMENT ON COLUMN table_definitions.domain_name IS '도메인명';
COMMENT ON COLUMN table_definitions.infotype IS '인포타입명';
COMMENT ON COLUMN table_definitions.use_yn IS '사용여부';
COMMENT ON COLUMN table_definitions.created_at IS '등록일시';
COMMENT ON COLUMN table_definitions.updated_at IS '수정일시';
