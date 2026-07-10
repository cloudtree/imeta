/**
 * iMETA 내부 메타 스키마 물리명 매핑
 * DB / API / UI 모두 동일 표준 물리명 사용
 */

/** @type {Record<string, string>} oldTable → newTable */
export const TABLE_RENAME = {
  words: 'meta_std_word_m',
  domains: 'meta_std_domain_m',
  terms: 'meta_std_term_m',
  domain_groups: 'meta_domain_group_m',
  subject_area: 'meta_subject_area_m',
  db_servers: 'meta_db_server_m',
  table_definitions: 'meta_table_def_m',
  meta_systems: 'meta_system_m',
  meta_naming_rules: 'meta_naming_rule_m',
  meta_users: 'meta_user_m',
  meta_data_objects: 'meta_data_object_m',
}

/**
 * 테이블별 컬럼 매핑: oldCol → newCol (동일하면 생략 가능)
 * @type {Record<string, Record<string, string>>}
 */
export const COLUMN_RENAME = {
  words: {
    word_id: 'std_word_id',
    word_nm: 'std_word_nm',
    abb_word_nm: 'abb_word_nm',
    all_word_nm: 'full_eng_nm',
    kor_synonym_nm: 'kor_synonym_nm',
    taxon_yn: 'taxon_yn',
    word_desc: 'std_word_desc',
    subject_id: 'subject_area_id',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  domains: {
    domain_id: 'std_domain_id',
    domain_nm: 'std_domain_nm',
    data_type: 'data_type_nm',
    info_type: 'info_type_nm',
    domain_div_cd: 'domain_group_nm',
    data_length: 'data_len',
    domain_desc: 'std_domain_desc',
    subject_id: 'subject_area_id',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  terms: {
    term_id: 'std_term_id',
    logical_term: 'logical_term_nm',
    physical_term: 'physical_term_nm',
    domain_div_cd: 'domain_group_nm',
    domain_id: 'std_domain_id',
    data_type: 'data_type_nm',
    data_len: 'data_len',
    term_desc: 'std_term_desc',
    subject_id: 'subject_area_id',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  domain_groups: {
    group_id: 'domain_group_id',
    group_nm: 'domain_group_nm',
    group_desc: 'domain_group_desc',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  subject_area: {
    subject_id: 'subject_area_id',
    subject_name: 'subject_area_nm',
    description: 'subject_area_desc',
    system_id: 'system_id',
    system_nm: 'system_nm',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  db_servers: {
    server_id: 'db_server_id',
    server_name: 'db_server_nm',
    host: 'host_nm',
    port: 'port_no',
    database_name: 'database_nm',
    username: 'user_nm',
    password: 'password_val',
    ssl_enabled: 'ssl_yn',
    description: 'db_server_desc',
    use_yn: 'use_yn',
    last_test_at: 'last_test_dtm',
    last_test_ok: 'last_test_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  table_definitions: {
    def_id: 'table_def_id',
    schema_name: 'schema_nm',
    db_type: 'db_type_nm',
    entity_name: 'entity_nm',
    table_name: 'table_nm',
    attribute_name: 'attribute_nm',
    column_name: 'column_nm',
    column_order: 'column_ord',
    pk_yn: 'pk_yn',
    data_type: 'data_type_nm',
    data_length: 'data_len',
    domain_name: 'domain_nm',
    infotype: 'info_type_nm',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  meta_systems: {
    system_id: 'system_id',
    system_cd: 'system_cd',
    system_nm: 'system_nm',
    system_desc: 'system_desc',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  meta_naming_rules: {
    rule_id: 'naming_rule_id',
    system_id: 'system_id',
    section_cd: 'section_cd',
    object_type: 'object_type_nm',
    title: 'rule_title_nm',
    format_pattern: 'format_pattern_nm',
    parts_json: 'parts_json',
    examples_json: 'examples_json',
    notes: 'rule_desc',
    sort_order: 'sort_ord',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  meta_users: {
    user_id: 'user_id',
    username: 'login_id',
    password_hash: 'password_hash',
    user_nm: 'user_nm',
    email: 'email_nm',
    dept_nm: 'dept_nm',
    role_cd: 'role_cd',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
  meta_data_objects: {
    object_id: 'data_object_id',
    object_cd: 'data_object_cd',
    object_nm: 'data_object_nm',
    physical_nm: 'physical_nm',
    object_type: 'object_type_nm',
    subject_id: 'subject_area_id',
    owner_nm: 'owner_nm',
    object_desc: 'data_object_desc',
    use_yn: 'use_yn',
    created_at: 'reg_dtm',
    updated_at: 'upd_dtm',
  },
}

/** 논리 키(구 테이블명) → 현재 물리 테이블명 */
export function physTable(logicalKey) {
  return TABLE_RENAME[logicalKey] || logicalKey
}

/** 논리 키 + 구 컬럼명 → 현재 물리 컬럼명 */
export function physCol(logicalTableKey, oldCol) {
  const map = COLUMN_RENAME[logicalTableKey]
  if (!map) return oldCol
  return map[oldCol] || oldCol
}

/**
 * SELECT 절용: 물리 컬럼 목록 (별칭 없음)
 * @param {string} logicalTableKey
 * @param {string} [alias] 테이블 별칭
 */
export function selectCols(logicalTableKey, alias = '') {
  const map = COLUMN_RENAME[logicalTableKey]
  if (!map) return alias ? `${alias}.*` : '*'
  const prefix = alias ? `${alias}.` : ''
  return [...new Set(Object.values(map))]
    .map((phys) => `${prefix}${phys}`)
    .join(', ')
}
