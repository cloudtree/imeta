import { pool } from './db.js'
import { findPluralEnglishWords } from './wordAbbrev.js'
import { TABLE_RENAME, COLUMN_RENAME, physTable, physCol } from './metaSchema.js'

/**
 * 내부 메타 테이블/컬럼에 표준 엔티티명·속성명 COMMENT 부여
 * + COMMENT에 쓰인 논리명이 표준사전(단어/도메인/용어)에 없으면 등록
 */

const DEFAULT_SUBJECT_ID = 'STD01'

const TABLE_COMMENTS = {
  words: '표준단어기본',
  domains: '표준도메인기본',
  terms: '표준용어기본',
  domain_groups: '도메인그룹기본',
  subject_area: '주제영역기본',
  db_servers: 'DB서버기본',
  table_definitions: '테이블정의기본',
  meta_systems: '시스템기본',
  meta_naming_rules: '명명규칙기본',
  meta_users: '사용자기본',
  meta_data_objects: '데이터객체기본',
}

const COLUMN_COMMENTS = {
  words: {
    word_id: '표준단어ID',
    word_nm: '표준단어명',
    abb_word_nm: '영문약어명',
    all_word_nm: '영문전체명',
    kor_synonym_nm: '한글동의어명',
    taxon_yn: '분류어여부',
    word_desc: '표준단어설명',
    subject_id: '주제영역ID',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  domains: {
    domain_id: '표준도메인ID',
    domain_nm: '표준도메인명',
    data_type: '데이터타입명',
    info_type: '인포타입명',
    infotype: '인포타입명',
    domain_div_cd: '도메인그룹명',
    data_length: '데이터길이',
    data_scale: '데이터스케일',
    domain_desc: '표준도메인설명',
    subject_id: '주제영역ID',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  terms: {
    term_id: '표준용어ID',
    logical_term: '논리용어명',
    physical_term: '물리용어명',
    domain_div_cd: '도메인그룹명',
    domain_id: '표준도메인ID',
    data_type: '데이터타입명',
    data_len: '데이터길이',
    term_desc: '표준용어설명',
    subject_id: '주제영역ID',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  domain_groups: {
    group_id: '도메인그룹ID',
    group_nm: '도메인그룹명',
    group_desc: '도메인그룹설명',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  subject_area: {
    subject_id: '주제영역ID',
    subject_name: '주제영역명',
    description: '주제영역설명',
    system_id: '시스템ID',
    system_nm: '시스템명',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  db_servers: {
    server_id: 'DB서버ID',
    server_name: 'DB서버명',
    host: '호스트명',
    port: '포트번호',
    database_name: '데이터베이스명',
    username: '사용자명',
    password: '비밀번호',
    ssl_enabled: 'SSL사용여부',
    description: 'DB서버설명',
    use_yn: '사용여부',
    last_test_at: '최종테스트일시',
    last_test_ok: '최종테스트성공여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  table_definitions: {
    def_id: '테이블정의ID',
    schema_name: '스키마명',
    db_type: 'DB종류명',
    entity_name: '엔티티명',
    table_name: '테이블명',
    attribute_name: '속성명',
    column_name: '컬럼명',
    column_order: '컬럼순서',
    pk_yn: 'PK여부',
    data_type: '데이터타입명',
    data_length: '데이터길이',
    domain_name: '도메인명',
    infotype: '인포타입명',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  meta_systems: {
    system_id: '시스템ID',
    system_cd: '시스템코드',
    system_nm: '시스템명',
    system_desc: '시스템설명',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  meta_naming_rules: {
    rule_id: '명명규칙ID',
    system_id: '시스템ID',
    section_cd: '섹션코드',
    object_type: '객체유형명',
    title: '규칙제목명',
    format_pattern: '형식패턴명',
    parts_json: '구성요소JSON',
    examples_json: '예제JSON',
    notes: '규칙설명',
    sort_order: '정렬순서',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  meta_users: {
    user_id: '사용자ID',
    username: '로그인ID',
    password_hash: '비밀번호해시',
    user_nm: '사용자명',
    email: '이메일주소',
    dept_nm: '부서명',
    role_cd: '역할코드',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
  meta_data_objects: {
    object_id: '데이터객체ID',
    object_cd: '데이터객체코드',
    object_nm: '데이터객체명',
    physical_nm: '물리명',
    object_type: '객체유형명',
    subject_id: '주제영역ID',
    owner_nm: '소유자명',
    object_desc: '데이터객체설명',
    use_yn: '사용여부',
    created_at: '등록일시',
    updated_at: '수정일시',
  },
}

/**
 * 테이블(엔티티) 유형 분류어 — standardReviewUtils.ENTITY_TYPE_SUFFIX_MAP 과 동일
 * 속성 분류어(명/ID/여부…)와 별도로 반드시 표준단어(taxon_yn=Y)로 등록
 */
const ENTITY_SUFFIX_WORDS = [
  { word_nm: '기본', abb: 'M', eng: 'Master', altAbb: ['BAS', 'BASIC'] },
  { word_nm: '이력', abb: 'H', eng: 'History', altAbb: ['HIS'] },
  { word_nm: '상세', abb: 'D', eng: 'Detail', altAbb: ['DTL'] },
  { word_nm: '내역', abb: 'L', eng: 'Transaction', altAbb: ['TXN'] },
  { word_nm: '코드', abb: 'C', eng: 'Code', altAbb: ['CD'] },
  { word_nm: '집계', abb: 'A', eng: 'Aggregate', altAbb: ['AGG'] },
  { word_nm: '채번', abb: 'N', eng: 'Numbering', altAbb: ['SEQ', 'GVNO'] },
  { word_nm: '백업', abb: 'B', eng: 'Backup', altAbb: ['BKUP'] },
  { word_nm: '임시', abb: 'T', eng: 'Temp', altAbb: ['TMP'] },
  { word_nm: '로그', abb: 'G', eng: 'Log', altAbb: ['LOG'] },
  { word_nm: '연계', abb: 'I', eng: 'Interface', altAbb: ['LNK', 'IF'] },
]

/** 원자 표준단어 시드 (속성 분류어 포함 — 테이블 유형 분류어는 ensureEntityTypeWords 에서 별도 처리) */
const WORD_SEED = [
  { word_nm: '표준', abb: 'STD', eng: 'Standard', taxon: 'N' },
  { word_nm: '단어', abb: 'WORD', eng: 'Word', taxon: 'N' },
  { word_nm: '도메인', abb: 'DOMAIN', eng: 'Domain', taxon: 'N' },
  { word_nm: '용어', abb: 'TERM', eng: 'Term', taxon: 'N' },
  { word_nm: '그룹', abb: 'GROUP', eng: 'Group', taxon: 'N' },
  { word_nm: '주제', abb: 'SUBJECT', eng: 'Subject', taxon: 'N' },
  { word_nm: '영역', abb: 'AREA', eng: 'Area', taxon: 'N' },
  { word_nm: '시스템', abb: 'SYSTEM', eng: 'System', taxon: 'N' },
  { word_nm: '서버', abb: 'SERVER', eng: 'Server', taxon: 'N' },
  { word_nm: '테이블', abb: 'TABLE', eng: 'Table', taxon: 'N' },
  { word_nm: '정의', abb: 'DEF', eng: 'Definition', taxon: 'N' },
  { word_nm: '규칙', abb: 'RULE', eng: 'Rule', taxon: 'N' },
  { word_nm: '명명', abb: 'NAMING', eng: 'Naming', taxon: 'N' },
  { word_nm: '사용자', abb: 'USER', eng: 'User', taxon: 'N' },
  { word_nm: '데이터', abb: 'DATA', eng: 'Data', taxon: 'N' },
  { word_nm: '객체', abb: 'OBJECT', eng: 'Object', taxon: 'N' },
  { word_nm: '영문', abb: 'ENG', eng: 'English', taxon: 'N' },
  { word_nm: '약어', abb: 'ABB', eng: 'Abbreviation', taxon: 'N' },
  { word_nm: '전체', abb: 'FULL', eng: 'Full', taxon: 'N' },
  { word_nm: '한글', abb: 'KOR', eng: 'Korean', taxon: 'N' },
  { word_nm: '동의어', abb: 'SYNONYM', eng: 'Synonym', taxon: 'N' },
  { word_nm: '분류어', abb: 'TAXON', eng: 'Taxon', taxon: 'N' },
  { word_nm: '논리', abb: 'LOGICAL', eng: 'Logical', taxon: 'N' },
  { word_nm: '물리', abb: 'PHYSICAL', eng: 'Physical', taxon: 'N' },
  { word_nm: '호스트', abb: 'HOST', eng: 'Host', taxon: 'N' },
  { word_nm: '포트', abb: 'PORT', eng: 'Port', taxon: 'N' },
  { word_nm: '데이터베이스', abb: 'DATABASE', eng: 'Database', taxon: 'N' },
  { word_nm: '비밀번호', abb: 'PASSWORD', eng: 'Password', taxon: 'N' },
  { word_nm: 'SSL', abb: 'SSL', eng: 'Ssl', taxon: 'N' },
  { word_nm: '사용', abb: 'USE', eng: 'Use', taxon: 'N' },
  { word_nm: '최종', abb: 'LAST', eng: 'Last', taxon: 'N' },
  { word_nm: '테스트', abb: 'TEST', eng: 'Test', taxon: 'N' },
  { word_nm: '성공', abb: 'OK', eng: 'Ok', taxon: 'N' },
  { word_nm: '스키마', abb: 'SCHEMA', eng: 'Schema', taxon: 'N' },
  { word_nm: '종류', abb: 'KIND', eng: 'Kind', taxon: 'N' },
  { word_nm: '엔티티', abb: 'ENTITY', eng: 'Entity', taxon: 'N' },
  { word_nm: '속성', abb: 'ATTR', eng: 'Attribute', taxon: 'N' },
  { word_nm: '컬럼', abb: 'COLUMN', eng: 'Column', taxon: 'N' },
  { word_nm: '순서', abb: 'ORD', eng: 'Order', taxon: 'N' },
  { word_nm: 'PK', abb: 'PK', eng: 'Pk', taxon: 'N' },
  { word_nm: '로그인', abb: 'LOGIN', eng: 'Login', taxon: 'N' },
  { word_nm: '해시', abb: 'HASH', eng: 'Hash', taxon: 'N' },
  { word_nm: '이메일', abb: 'EMAIL', eng: 'Email', taxon: 'N' },
  { word_nm: '주소', abb: 'ADDR', eng: 'Address', taxon: 'N' },
  { word_nm: '부서', abb: 'DEPT', eng: 'Department', taxon: 'N' },
  { word_nm: '역할', abb: 'ROLE', eng: 'Role', taxon: 'N' },
  { word_nm: '섹션', abb: 'SECTION', eng: 'Section', taxon: 'N' },
  { word_nm: '제목', abb: 'TITLE', eng: 'Title', taxon: 'N' },
  { word_nm: '형식', abb: 'FORMAT', eng: 'Format', taxon: 'N' },
  { word_nm: '패턴', abb: 'PATTERN', eng: 'Pattern', taxon: 'N' },
  { word_nm: '구성', abb: 'PART', eng: 'Part', taxon: 'N' },
  { word_nm: '요소', abb: 'ELEMENT', eng: 'Element', taxon: 'N' },
  { word_nm: '예제', abb: 'EXAMPLE', eng: 'Example', taxon: 'N' },
  { word_nm: '정렬', abb: 'SORT', eng: 'Sort', taxon: 'N' },
  { word_nm: '소유자', abb: 'OWNER', eng: 'Owner', taxon: 'N' },
  { word_nm: '등록', abb: 'REG', eng: 'Register', taxon: 'N' },
  { word_nm: '수정', abb: 'UPD', eng: 'Update', taxon: 'N' },
  { word_nm: 'DB', abb: 'DB', eng: 'Db', taxon: 'N' },
  { word_nm: '스케일', abb: 'SCALE', eng: 'Scale', taxon: 'N' },
  { word_nm: '길이', abb: 'LEN', eng: 'Length', taxon: 'N' },
  { word_nm: '타입', abb: 'TYPE', eng: 'Type', taxon: 'N' },
  { word_nm: '인포', abb: 'INFO', eng: 'Info', taxon: 'N' },
  { word_nm: '번호', abb: 'NO', eng: 'Number', taxon: 'Y' },
  { word_nm: 'ID', abb: 'ID', eng: 'Id', taxon: 'Y' },
  { word_nm: '명', abb: 'NM', eng: 'Name', taxon: 'Y' },
  { word_nm: '설명', abb: 'DESC', eng: 'Description', taxon: 'Y' },
  { word_nm: '여부', abb: 'YN', eng: 'Yn', taxon: 'Y' },
  { word_nm: '코드', abb: 'CD', eng: 'Code', taxon: 'Y' },
  { word_nm: '일시', abb: 'DTM', eng: 'Datetime', taxon: 'Y' },
]

const DOMAIN_GROUP_SEED = [
  { group_nm: 'ID', group_desc: '식별자 도메인 그룹' },
  { group_nm: '명칭', group_desc: '명칭 도메인 그룹' },
  { group_nm: '여부', group_desc: '여부 도메인 그룹' },
  { group_nm: '코드', group_desc: '코드 도메인 그룹' },
  { group_nm: '일시', group_desc: '일시 도메인 그룹' },
  { group_nm: '설명', group_desc: '설명 도메인 그룹' },
  { group_nm: '수량', group_desc: '수량·길이 도메인 그룹' },
]

/** 분류어 기준 표준도메인 */
const DOMAIN_SEED = [
  { std_domain_nm: 'ID도메인', data_type_nm: 'INTEGER', info_type_nm: 'ID', domain_group_nm: 'ID', data_len: null },
  { std_domain_nm: '명칭도메인', data_type_nm: 'VARCHAR', info_type_nm: '명칭VC200', domain_group_nm: '명칭', data_len: '200' },
  { std_domain_nm: '여부도메인', data_type_nm: 'CHAR', info_type_nm: '여부C1', domain_group_nm: '여부', data_len: '1' },
  { std_domain_nm: '코드도메인', data_type_nm: 'VARCHAR', info_type_nm: '코드VC50', domain_group_nm: '코드', data_len: '50' },
  { std_domain_nm: '일시도메인', data_type_nm: 'TIMESTAMP', info_type_nm: '일시', domain_group_nm: '일시', data_len: null },
  { std_domain_nm: '설명도메인', data_type_nm: 'VARCHAR', info_type_nm: '설명VC1000', domain_group_nm: '설명', data_len: '1000' },
  { std_domain_nm: '수량도메인', data_type_nm: 'INTEGER', info_type_nm: '수량', domain_group_nm: '수량', data_len: null },
]

/**
 * 속성명(논리용어) → 물리명 조합 규칙
 * words 시드의 abb 를 긴 단어 우선으로 매칭
 */
function buildPhysicalFromLogical(logical, wordMap) {
  const sorted = [...wordMap.keys()].sort((a, b) => b.length - a.length)
  let rest = logical
  const parts = []
  while (rest.length) {
    let matched = false
    for (const w of sorted) {
      if (rest.startsWith(w)) {
        parts.push(wordMap.get(w).abb)
        rest = rest.slice(w.length)
        matched = true
        break
      }
    }
    if (!matched) {
      // 미매칭 1글자 스킵 (시드 누락 방지용)
      rest = rest.slice(1)
    }
  }
  return parts.join('_') || logical
}

function classifierOf(logical) {
  const attrClassifiers = ['여부', '일시', '설명', '코드', '번호', 'ID', '명']
  const entityClassifiers = ENTITY_SUFFIX_WORDS.map((w) => w.word_nm)
  const classifiers = [...attrClassifiers, ...entityClassifiers]
  for (const c of classifiers.sort((a, b) => b.length - a.length)) {
    if (logical.endsWith(c)) return c
  }
  return null
}

function domainForClassifier(classifier) {
  const map = {
    ID: 'ID도메인',
    명: '명칭도메인',
    여부: '여부도메인',
    코드: '코드도메인',
    일시: '일시도메인',
    설명: '설명도메인',
    번호: '수량도메인',
  }
  // 테이블 유형 분류어(기본/상세/…)는 엔티티명 접미사 → 명칭도메인
  if (ENTITY_SUFFIX_WORDS.some((w) => w.word_nm === classifier)) {
    return '명칭도메인'
  }
  return map[classifier] || '명칭도메인'
}

function collectLogicalNames() {
  const names = new Set()
  for (const entity of Object.values(TABLE_COMMENTS)) names.add(entity)
  for (const cols of Object.values(COLUMN_COMMENTS)) {
    for (const attr of Object.values(cols)) names.add(attr)
  }
  return [...names]
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1
       AND table_type = 'BASE TABLE'`,
    [tableName],
  )
  return rows.length > 0
}

async function columnExists(client, tableName, columnName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tableName, columnName],
  )
  return rows.length > 0
}

async function ensureSubjectArea(client) {
  if (!(await tableExists(client, 'meta_subject_area_m'))) return
  await client.query(
    `INSERT INTO meta_subject_area_m (subject_area_id, subject_area_nm, subject_area_desc, use_yn)
     VALUES ($1, '표준', '내부 메타 표준화용 주제영역', 'Y')
     ON CONFLICT (subject_area_id) DO NOTHING`,
    [DEFAULT_SUBJECT_ID],
  )
}

async function ensureDomainGroups(client) {
  if (!(await tableExists(client, 'meta_domain_group_m'))) return 0
  let n = 0
  for (const g of DOMAIN_GROUP_SEED) {
    const r = await client.query(
      `INSERT INTO meta_domain_group_m (domain_group_nm, domain_group_desc, use_yn)
       VALUES ($1, $2, 'Y')
       ON CONFLICT (domain_group_nm) DO NOTHING`,
      [g.group_nm, g.group_desc],
    )
    n += r.rowCount
  }
  return n
}

async function ensureWords(client) {
  if (!(await tableExists(client, 'meta_std_word_m'))) return { inserted: 0, map: new Map() }
  let inserted = 0
  for (const w of WORD_SEED) {
    const existing = await client.query(
      `SELECT std_word_id, std_word_nm, abb_word_nm FROM meta_std_word_m
       WHERE std_word_nm = $1 OR UPPER(abb_word_nm) = UPPER($2)
       LIMIT 1`,
      [w.word_nm, w.abb],
    )
    if (existing.rows[0]) continue
    try {
      await client.query(
        `INSERT INTO meta_std_word_m
           (std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn, subject_area_id)
         VALUES ($1, $2, $3, '', $4, $5, 'Y', $6)`,
        [
          w.word_nm,
          w.abb.toUpperCase(),
          w.eng,
          w.taxon,
          `내부 메타 표준화 시드 (${w.word_nm})`,
          DEFAULT_SUBJECT_ID,
        ],
      )
      inserted += 1
    } catch {
      // 약어 충돌 등 무시
    }
  }
  const { rows } = await client.query(`SELECT std_word_nm, abb_word_nm, taxon_yn FROM meta_std_word_m`)
  const map = new Map(rows.map((r) => [r.std_word_nm, { abb: r.abb_word_nm, taxon: r.taxon_yn }]))
  return { inserted, map }
}

/**
 * 테이블 유형 분류어(기본/상세/이력…) 보장
 * - 없으면 등록 (약어 충돌 시 대체 약어 사용)
 * - 있으면 분류어여부 Y 보정 + 복수형 영문/약어(~S) 단수화
 */
async function ensureEntityTypeWords(client) {
  if (!(await tableExists(client, 'meta_std_word_m'))) return { inserted: 0, updated: 0 }

  const takenAbb = new Set()
  {
    const { rows } = await client.query(`SELECT UPPER(abb_word_nm) AS abb FROM meta_std_word_m`)
    for (const r of rows) {
      if (r.abb) takenAbb.add(r.abb)
    }
  }

  let inserted = 0
  let updated = 0

  for (const w of ENTITY_SUFFIX_WORDS) {
    const existing = await client.query(
      `SELECT std_word_id, taxon_yn, abb_word_nm, full_eng_nm FROM meta_std_word_m WHERE std_word_nm = $1 LIMIT 1`,
      [w.word_nm],
    )

    if (existing.rows[0]) {
      const row = existing.rows[0]
      const patches = []
      const vals = []

      if (row.taxon_yn !== 'Y') {
        vals.push('Y')
        patches.push(`taxon_yn = $${vals.length}`)
      }

      // 복수형 영문명 보정 (DETAILS → Transaction 등)
      const engPlurals = findPluralEnglishWords(row.full_eng_nm)
      if (engPlurals.length) {
        vals.push(w.eng)
        patches.push(`full_eng_nm = $${vals.length}`)
      }

      // 복수형 약어 보정 (DTLS → L/TXN 등) — 용어에서 미사용일 때만
      const curAbb = String(row.abb_word_nm || '').toUpperCase()
      const pluralAbb = curAbb.endsWith('S') && curAbb.length >= 4
        && /^[A-Z]+$/.test(curAbb.slice(0, -1))
      if (pluralAbb) {
        const { rows: used } = await client.query(
          `SELECT 1 FROM meta_std_term_m WHERE UPPER(physical_term_nm) LIKE '%' || $1 || '%' LIMIT 1`,
          [curAbb],
        )
        if (!used.length) {
          const candidates = [w.abb, ...(w.altAbb || []), w.eng.toUpperCase().slice(0, 8)]
          const nextAbb = candidates
            .map((a) => String(a).toUpperCase())
            .find((a) => a && (a === curAbb || !takenAbb.has(a)))
          if (nextAbb && nextAbb !== curAbb) {
            vals.push(nextAbb)
            patches.push(`abb_word_nm = $${vals.length}`)
            takenAbb.delete(curAbb)
            takenAbb.add(nextAbb)
          }
        }
      }

      if (patches.length) {
        vals.push(row.std_word_id)
        await client.query(
          `UPDATE meta_std_word_m SET ${patches.join(', ')}, upd_dtm = NOW() WHERE std_word_id = $${vals.length}`,
          vals,
        )
        updated += 1
      }
      continue
    }

    const candidates = [w.abb, ...(w.altAbb || []), w.eng.toUpperCase().slice(0, 8)]
    const abb = candidates.map((a) => String(a).toUpperCase()).find((a) => a && !takenAbb.has(a))
    if (!abb) continue

    try {
      await client.query(
        `INSERT INTO meta_std_word_m
           (std_word_nm, abb_word_nm, full_eng_nm, kor_synonym_nm, taxon_yn, std_word_desc, use_yn, subject_area_id)
         VALUES ($1, $2, $3, '', 'Y', $4, 'Y', $5)`,
        [
          w.word_nm,
          abb,
          w.eng,
          `테이블 유형 분류어 시드 (${w.word_nm})`,
          DEFAULT_SUBJECT_ID,
        ],
      )
      takenAbb.add(abb)
      inserted += 1
    } catch {
      // 충돌 등 무시
    }
  }

  return { inserted, updated }
}

async function ensureDomains(client) {
  if (!(await tableExists(client, 'meta_std_domain_m'))) return { inserted: 0, byName: new Map() }
  const hasSubject = await columnExists(client, 'meta_std_domain_m', 'subject_area_id')
  let inserted = 0

  for (const d of DOMAIN_SEED) {
    const existing = await client.query(
      `SELECT std_domain_id FROM meta_std_domain_m WHERE std_domain_nm = $1 LIMIT 1`,
      [d.std_domain_nm],
    )
    if (existing.rows[0]) continue

    const cols = ['std_domain_nm', 'data_type_nm', 'info_type_nm', 'domain_group_nm', 'data_len', 'use_yn']
    const vals = [d.std_domain_nm, d.data_type_nm, d.info_type_nm, d.domain_group_nm, d.data_len, 'Y']
    if (hasSubject) {
      cols.push('subject_area_id')
      vals.push(DEFAULT_SUBJECT_ID)
    }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',')
    await client.query(
      `INSERT INTO meta_std_domain_m (${cols.join(',')}) VALUES (${placeholders})`,
      vals,
    )
    inserted += 1
  }

  const { rows } = await client.query(
    `SELECT std_domain_id, std_domain_nm, data_type_nm, data_len, domain_group_nm FROM meta_std_domain_m`,
  )
  const byName = new Map(rows.map((r) => [r.std_domain_nm, r]))
  return { inserted, byName }
}

async function ensureTerms(client, wordMap, domainByName) {
  if (!(await tableExists(client, 'meta_std_term_m'))) return 0
  const hasSubject = await columnExists(client, 'meta_std_term_m', 'subject_area_id')
  let inserted = 0

  for (const logical of collectLogicalNames()) {
    const existing = await client.query(
      `SELECT std_term_id FROM meta_std_term_m WHERE logical_term_nm = $1 LIMIT 1`,
      [logical],
    )
    if (existing.rows[0]) continue

    const physical = buildPhysicalFromLogical(logical, wordMap)
    const classifier = classifierOf(logical)
    const domainNm = domainForClassifier(classifier)
    const domain = domainByName.get(domainNm)
    const data_type_nm = domain?.data_type_nm || 'VARCHAR'
    const data_len = domain?.data_len != null ? String(domain.data_len) : (data_type_nm === 'VARCHAR' ? '200' : '')
    const domain_group_nm = domain?.domain_group_nm || '명칭'
    const std_domain_id = domain?.std_domain_id || null

    const cols = [
      'logical_term_nm', 'physical_term_nm', 'domain_group_nm', 'std_domain_id',
      'data_type_nm', 'data_len', 'std_term_desc', 'use_yn',
    ]
    const vals = [
      logical,
      physical.toUpperCase(),
      domain_group_nm,
      std_domain_id,
      data_type_nm,
      data_len || '',
      `내부 메타 표준화 시드 (${logical})`,
      'Y',
    ]
    if (hasSubject) {
      cols.push('subject_area_id')
      vals.push(DEFAULT_SUBJECT_ID)
    }

    try {
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(',')
      await client.query(
        `INSERT INTO meta_std_term_m (${cols.join(',')}) VALUES (${placeholders})`,
        vals,
      )
      inserted += 1
    } catch {
      // 중복 등 무시
    }
  }
  return inserted
}

async function applyComments(client) {
  let tableCount = 0
  let columnCount = 0

  const quote = (value) => `'${String(value).replace(/'/g, "''")}'`

  // COMMENT ON targets NEW physical names; Korean strings stay keyed by logical old names
  for (const logicalTable of Object.keys(TABLE_RENAME)) {
    const physicalTable = physTable(logicalTable)
    const entityName = TABLE_COMMENTS[logicalTable]
    if (!entityName) continue
    if (!(await tableExists(client, physicalTable))) continue
    await client.query(`COMMENT ON TABLE ${physicalTable} IS ${quote(entityName)}`)
    tableCount += 1

    const logicalCols = COLUMN_COMMENTS[logicalTable] || {}
    const renameMap = COLUMN_RENAME[logicalTable] || {}
    for (const [logicalCol, attributeName] of Object.entries(logicalCols)) {
      const physicalCol = renameMap[logicalCol] || physCol(logicalTable, logicalCol)
      if (!(await columnExists(client, physicalTable, physicalCol))) continue
      await client.query(
        `COMMENT ON COLUMN ${physicalTable}.${physicalCol} IS ${quote(attributeName)}`,
      )
      columnCount += 1
    }
  }
  return { tableCount, columnCount }
}

export async function migrateInternalComments() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { tableCount, columnCount } = await applyComments(client)

    await ensureSubjectArea(client)
    const groupsInserted = await ensureDomainGroups(client)
    const { inserted: wordsInserted } = await ensureWords(client)
    const { inserted: entityWordsInserted, updated: entityWordsUpdated } =
      await ensureEntityTypeWords(client)
    const { rows: wordRows } = await client.query(
      `SELECT std_word_nm, abb_word_nm, taxon_yn FROM meta_std_word_m`,
    )
    const wordMap = new Map(
      wordRows.map((r) => [r.std_word_nm, { abb: r.abb_word_nm, taxon: r.taxon_yn }]),
    )
    const { inserted: domainsInserted, byName: domainByName } = await ensureDomains(client)
    const termsInserted = await ensureTerms(client, wordMap, domainByName)

    await client.query('COMMIT')
    console.log(
      `[migrateInternalComments] comments tables=${tableCount} columns=${columnCount}`
      + ` | seeded words=${wordsInserted} entity_type_words=+${entityWordsInserted}/~${entityWordsUpdated}`
      + ` domains=${domainsInserted} terms=${termsInserted} domain_groups=${groupsInserted}`,
    )
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
