import { pool } from './db.js'

/** 6.3 물리 데이터 객체 명명규칙 — 전사표준 시드 */
export const ENTERPRISE_SYSTEM = {
  system_cd: 'ENTERPRISE',
  system_nm: '전사표준',
  system_desc: '전사 데이터 표준화 지침 6.3 물리 데이터 객체 명명규칙',
}

export const NAMING_RULE_SEED = [
  {
    section_cd: '6.3.1',
    object_type: 'BASIC',
    title: 'DB 객체 기본 명명규칙',
    format_pattern: '영문자 + 숫자 + 구분자(_) / 대문자 / 영문자 시작 / 30자 이내',
    sort_order: 10,
    parts: [
      {
        code: '공통',
        name: '기본 규칙',
        rules: [
          '모든 항목은 영문자, 숫자, 구분자(\'_\')로만 구성되며, 영문자는 모두 대문자를 사용한다.',
          '영문자로 시작되어야 하며, 가급적 30자 이내로 정의한다.',
          '특정 시스템 영역의 환경적 특성을 반영한 별도의 명명규칙이 존재하는 경우 해당 시스템 영역의 "DB 객체 명명규칙 정의서"를 준용한다.',
          '해당 시스템 영역의 "DB 객체 명명규칙 정의서"에 존재하지 않는 내용은 전사 데이터 표준화 지침을 따른다.',
        ],
      },
    ],
    examples: [],
    notes: '',
  },
  {
    section_cd: '6.3.2',
    object_type: 'TABLE',
    title: 'Table 명명규칙',
    format_pattern: "주제영역대분류(P1) + '_' + 엔터티영문물리명(P2)",
    sort_order: 20,
    parts: [
      {
        code: 'P1',
        name: '주제영역대분류',
        rules: [
          '데이터 주제영역 대분류 코드를 사용한다. (예: 계정 AC, 청구 BL, 수납 PY)',
          '생략 가능하지만 동일 시스템 영역은 동일하게 적용해야 한다.',
        ],
      },
      {
        code: 'P2',
        name: '엔터티영문물리명',
        rules: [
          '엔터티명을 구성하는 표준단어의 영문물리명을 순차적으로 결합하여 정의한다.',
          '테이블명이 30자를 초과하면 두 단어 이상의 영문약어를 축약할 수 있다. (예: COMPN_PROD → CPROD)',
          '축약 시 자주 결합하는 단어를 우선 선택하고, 동일 업무 내 동일 축약어를 사용해 일관성을 부여한다.',
          '테이블명은 테이블의 소유자 계정 내에서 유일하게 정의되어야 한다.',
        ],
      },
    ],
    examples: [
      'AC_SVC_CONT_BAS (계정영역의 서비스계약기본)',
      'BL_INET_ROAM_USE_TXN (청구영역의 지능망로밍이용내역)',
      'COMPN_PROD_CHARGE_ITEM_DTL → CPROD_CHARGE_ITEM_DTL',
    ],
    notes: '',
  },
  {
    section_cd: '6.3.3',
    object_type: 'COLUMN',
    title: 'Column 명명규칙',
    format_pattern: '속성영문물리명(P1) [ + 일련번호(P2) ]',
    sort_order: 30,
    parts: [
      {
        code: 'P1',
        name: '속성영문물리명',
        rules: [
          '컬럼명은 해당 컬럼에 대응되는 속성명으로 사용된 표준용어의 물리명으로 정의한다.',
          '별도의 컬럼 명명규칙은 존재하지 않고 용어의 물리명 정의 지침을 준수한다.',
          '속성명은 표준용어로 정의되어야 하며, 반드시 속성 분류어로 종료되어야 한다.',
          '컬럼명은 컬럼이 속한 테이블 내에 유일하도록 정의한다.',
        ],
      },
      {
        code: 'P2',
        name: '일련번호',
        rules: [
          '하나의 테이블 내에 동일한 컬럼이 반복되는 경우 일련번호를 부여한다.',
          '반복되지 않는 경우는 사용하지 않는다.',
        ],
      },
    ],
    examples: ['EV_RCV_AGREE_YN (이벤트수신동의여부)'],
    notes: '',
  },
  {
    section_cd: '6.3.4',
    object_type: 'DATABASE',
    title: 'Database 명명규칙',
    format_pattern: '시스템구분(P1) + 서비스축약명(P2) + 서버구분(P3)',
    sort_order: 40,
    parts: [
      {
        code: 'P1',
        name: '시스템구분',
        rules: ['P : PROD', 'T : TEST', 'D : DEV'],
      },
      {
        code: 'P2',
        name: '서비스구분',
        rules: ['서비스를 구분하는 영문약어로 3자리 이내로 구성한다. (예: OM, BL)'],
      },
      {
        code: 'P3',
        name: '서버구분',
        rules: [
          '데이터 관리 목적을 구분하는 영문약어로 4자리 이내로 구성한다.',
          '예: DB (OLTP), DW (DataWarehouse), MART (DataMart)',
        ],
      },
    ],
    examples: ['POMDB', 'DBIDW', 'DBIMART', 'RAC: POMDB1, POMDB2, POMDB3'],
    notes:
      "P1, P2, P3 연결 시 구분자('_')를 사용하지 않고, 자릿수는 가능한 8문자 이내로 정의한다. 인스턴스명은 데이터베이스명과 동일하게 구성하며, Oracle RAC의 SID는 데이터베이스명 뒤에 구분자 없이 1자리 숫자를 붙인다.",
  },
  {
    section_cd: '6.3.5',
    object_type: 'USER',
    title: 'User(User Schema) 명명규칙',
    format_pattern: '서비스구분(P1) + 용도구분(P2) [ + 일련번호(P3) ]',
    sort_order: 50,
    parts: [
      {
        code: 'P1',
        name: '서비스구분',
        rules: ['서비스를 구분하는 영문약어로 3자리 이내로 구성한다. (예: OM, BL)'],
      },
      {
        code: 'P2',
        name: '용도구분',
        rules: ['OWN : 소유데이터', 'REF : 참조데이터', 'APP : Application 사용', 'IF : 인터페이스', 'READ : 읽기 전용'],
      },
      {
        code: 'P3',
        name: '일련번호',
        rules: [
          '동일 데이터베이스 인스턴스 내에 계정을 분리하거나 복제하는 경우에 일련번호를 부여한다.',
          '일반적인 경우에는 생략한다.',
        ],
      },
    ],
    examples: ['OMOWN', 'OMREF', 'OMAPP'],
    notes:
      '데이터베이스에 액세스할 수 있는 권한을 부여한 사용자 계정으로서 각각의 User Name에는 권한(Privilege)을 정의할 수 있다. 단, 패키지 계정이나 이름이 고정된 계정은 원래 이름 그대로 사용한다.',
  },
  {
    section_cd: '6.3.6',
    object_type: 'ROLE',
    title: 'Role 명명규칙',
    format_pattern: "객체구분(P1) + '_' + 서비스구분(P2) + '_' + 권한구분(P3)",
    sort_order: 60,
    parts: [
      { code: 'P1', name: '객체구분', rules: ['RL : Role'] },
      {
        code: 'P2',
        name: '서비스구분',
        rules: [
          '서비스를 구분하는 영문약어로 3자리 이내로 구성한다. (예: OM, BL)',
          'Role을 부여하고자 하는 서비스를 의미한다.',
        ],
      },
      {
        code: 'P3',
        name: '권한구분',
        rules: [
          'ALL : SELECT, INSERT, UPDATE, DELETE, EXECUTE',
          'CRUD : SELECT, INSERT, UPDATE, DELETE',
          'S : SELECT ONLY',
        ],
      },
    ],
    examples: ['RL_OM_ALL', 'RL_OM_S'],
    notes: '',
  },
  {
    section_cd: '6.3.7',
    object_type: 'TABLESPACE',
    title: 'Tablespace/File Group 명명규칙',
    format_pattern: "객체구분(P1) + '_' + 주제영역대분류(P2) + '_' + 용도구분(P3) + 일련번호(P4)",
    sort_order: 70,
    parts: [
      {
        code: 'P1',
        name: '객체구분',
        rules: [
          'TS : Tablespace',
          'FG : File Group (SQL Server, Primary File Group명은 변경하지 않음)',
        ],
      },
      {
        code: 'P2',
        name: '주제영역대분류',
        rules: ['데이터 주제영역 대분류 코드를 사용한다. (예: AC, BL, PY)'],
      },
      {
        code: 'P3',
        name: '용도구분',
        rules: [
          'DATA : Table Data (업무데이터)',
          'INDX : Index Data',
          'UNDO : Undo Tablespace',
          'BTCH : Batch Data (배치작업 전용)',
          'TEMP : Temporary',
        ],
      },
      { code: 'P4', name: '일련번호', rules: ['일련번호 2자리'] },
    ],
    examples: ['TS_OM_DATA01', 'TS_OM_INDX01'],
    notes: '',
  },
  {
    section_cd: '6.3.8',
    object_type: 'PARTITION',
    title: 'Partition 명명규칙',
    format_pattern: "PT/PI + '_' + 파티션적용명 | PF/PS + '_' + 파티션컬럼명 + 일련번호",
    sort_order: 80,
    parts: [
      {
        code: 'PT/PI',
        name: 'Partition Table/Index',
        rules: [
          'PT : Partition Table, PI : Partition Index (Global Index Partition만 제한적 사용)',
          "RANGE : Partition Key Value (날짜는 년도부터, 예: 201412)",
          "HASH : 'H1', 'H2', 'H3' 형태",
          'LIST : 의미 있는 약어 부여',
        ],
      },
      {
        code: 'PF',
        name: 'Partition Function (SQL Server)',
        rules: ["형식: PF + '_' + 파티션컬럼명 + PF일련번호(2자리)"],
      },
      {
        code: 'PS',
        name: 'Partition Scheme (SQL Server)',
        rules: ["형식: PS + '_' + 파티션컬럼명 + PF일련번호 + '_' + PS일련번호"],
      },
    ],
    examples: [
      'PT_201403 (Range Partition)',
      'PT_H1 (Hash Partition)',
      'PF_BL_ADS_SUM_DATE01',
      'PS_BL_ADS_SUM_DATE01_01',
    ],
    notes: '',
  },
  {
    section_cd: '6.3.9',
    object_type: 'INDEX',
    title: 'Index 명명규칙',
    format_pattern: "테이블명(P1) + '_' + 인덱스유형(P2) + 일련번호(P3)",
    sort_order: 90,
    parts: [
      { code: 'P1', name: '테이블명', rules: ['인덱스를 적용할 테이블명'] },
      {
        code: 'P2',
        name: '인덱스유형',
        rules: [
          'PK : Primary Key Constraint를 가지는 Index',
          'UX : Unique Key Constraint를 가지는 Index',
          'IX : PK, UK를 제외한 Index',
        ],
      },
      {
        code: 'P3',
        name: '일련번호',
        rules: ['일련번호 2자리', 'PK constraint 인덱스는 일련번호 없음'],
      },
    ],
    examples: ['CS_CUST_BAS_PK', 'CS_CUST_BAS_UX01'],
    notes: '',
  },
  {
    section_cd: '6.3.10',
    object_type: 'CONSTRAINT',
    title: 'Constraint 명명규칙',
    format_pattern: "테이블명(P1) + '_' + 객체구분(P2) + 일련번호(P3)",
    sort_order: 100,
    parts: [
      { code: 'P1', name: '테이블명', rules: ['Constraint를 적용할 테이블명'] },
      {
        code: 'P2',
        name: '객체구분',
        rules: ['PK : Primary Key', 'UX : Unique Key', 'FK : Foreign Key', 'CK : Check Constraint'],
      },
      { code: 'P3', name: '일련번호', rules: ['일련번호 2자리'] },
    ],
    examples: ['CS_CUST_BAS_FK01', 'CS_CUST_BAS_CK01'],
    notes: '',
  },
  {
    section_cd: '6.3.11',
    object_type: 'VIEW',
    title: 'View 명명규칙',
    format_pattern: "객체구분(P1) + '_' + 주제영역대분류 + '_' + 업무특성명(P2)",
    sort_order: 110,
    parts: [
      {
        code: 'P1',
        name: '객체구분',
        rules: ['VW : View', 'MV : Materialized View (Oracle Only)'],
      },
      {
        code: 'P2',
        name: '주제영역대분류',
        rules: [
          '데이터 주제영역 대분류 코드를 사용한다. (예: AC, BL, PY)',
          '생략 가능하지만 동일 시스템 영역은 동일하게 적용해야 한다.',
        ],
      },
      {
        code: 'P3',
        name: '업무특성명',
        rules: [
          '표준단어의 물리명을 조합하여 View의 데이터 성격에 적합한 명칭으로 정의한다.',
          '엔터티 명명규칙을 준용하여 한글 용어를 먼저 정의한 후 물리명으로 전환한다.',
          '뷰의 원천이 되는 엔터티 중 대표적인 엔터티명을 이용하여 정의할 수 있다.',
        ],
      },
    ],
    examples: ['VW_AC_CUST_SVC_USE_INFO (계정영역의 고객서비스사용정보)'],
    notes: '',
  },
  {
    section_cd: '6.3.12',
    object_type: 'SEQUENCE',
    title: 'Sequence 명명규칙',
    format_pattern: "객체구분(P1) + '_' + 테이블명(P2) + 일련번호(P3)",
    sort_order: 120,
    parts: [
      { code: 'P1', name: '객체구분', rules: ['SQ : Sequence'] },
      { code: 'P2', name: '테이블명', rules: ['Sequence를 사용하는 테이블명을 사용한다.'] },
      { code: 'P3', name: '일련번호', rules: ['일련번호는 2자리로 정의한다.'] },
    ],
    examples: ['SQ_CS_CUST_INFO_BAS01'],
    notes: '',
  },
  {
    section_cd: '6.3.13',
    object_type: 'PROCEDURE',
    title: 'Procedure/Function/Package 명명규칙',
    format_pattern: "객체구분(P1) + '_' + 업무특성명(P2)",
    sort_order: 130,
    parts: [
      {
        code: 'P1',
        name: '객체구분',
        rules: [
          'SP : User Stored Procedure',
          'USP : User Stored Procedure (SQL Server Only)',
          'FN : User Defined Function',
          'PG : Package',
          "SQL Server는 시스템 SP와 구분하기 위해 'USP'로 명명한다.",
        ],
      },
      {
        code: 'P2',
        name: '업무특성명',
        rules: [
          '표준단어의 물리명을 조합하여 업무 성격 및 기능에 적합한 명칭으로 정의한다.',
          "약어명과 약어명 연결은 '_'를 사용한다.",
        ],
      },
    ],
    examples: [
      'SP_CUST_TYPE_STAT',
      'USP_CUST_TYPE_STAT',
      'FN_GET_LAST_CONN_DATE',
      'PG_SVC_USE_STAT',
    ],
    notes: '',
  },
  {
    section_cd: '6.3.14',
    object_type: 'TRIGGER',
    title: 'Trigger 명명규칙',
    format_pattern: "TR + '_' + 테이블명 + '_' + TIME + TRANSACTION + ACCESS",
    sort_order: 140,
    parts: [
      { code: 'P1', name: '객체구분', rules: ['TR : Trigger'] },
      { code: 'P2', name: '테이블명', rules: ['Trigger 동작을 발생시키는 테이블명'] },
      { code: 'P3', name: 'TIME구분', rules: ['A : AFTER', 'B : BEFORE', 'I : INSTEAD OF'] },
      {
        code: 'P4',
        name: 'TRANSACTION구분',
        rules: [
          'I : INSERT',
          'U : UPDATE',
          'D : DELETE',
          'M : INSERT OR UPDATE OR DELETE 혼합',
        ],
      },
      {
        code: 'P5',
        name: 'ACCESS방식',
        rules: [
          'R : Row (for each row)',
          'S : Statement',
          'SQL Server: M(DML), D(DDL), L(Logon)',
        ],
      },
    ],
    examples: ['TR_CS_CUST_BAS_AIR (CS_CUST_BAS INSERT 후 ROW LEVEL TRIGGER)'],
    notes:
      'Row Trigger: 영향받는 행마다 실행. Statement Trigger: 트리거링 명령문당 한 번 실행.',
  },
  {
    section_cd: '6.3.15',
    object_type: 'DBLINK',
    title: 'Database Link 명명규칙',
    format_pattern: "객체구분(P1) + '_' + 데이터베이스명(P2) + '_' + USER명(P3)",
    sort_order: 150,
    parts: [
      { code: 'P1', name: '객체구분', rules: ['DL : Database Link'] },
      { code: 'P2', name: '데이터베이스명', rules: ['접속 대상 데이터베이스명'] },
      { code: 'P3', name: 'USER명', rules: ['접속 대상 데이터베이스의 User명'] },
    ],
    examples: ['DL_PTABDB_OM'],
    notes:
      'Database link는 시스템간 표준 데이터 연결방식이 아니므로 정보보호 보안성 심사를 통해 승인 받아야 하며 제한적으로 사용한다.',
  },
  {
    section_cd: '6.3.16',
    object_type: 'SYNONYM',
    title: 'Synonym 명명규칙',
    format_pattern: '대상 객체명과 동일',
    sort_order: 160,
    parts: [
      {
        code: '공통',
        name: '기본 규칙',
        rules: ['Synonym 대상 객체의 명칭과 완전히 동일하게 정의한다.'],
      },
    ],
    examples: [],
    notes: '',
  },
]

export async function migrateNamingRules() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_system_m (
        system_id   SERIAL PRIMARY KEY,
        system_cd   VARCHAR(50)  NOT NULL,
        system_nm   VARCHAR(200) NOT NULL,
        system_desc TEXT,
        use_yn      CHAR(1) NOT NULL DEFAULT 'Y',
        reg_dtm     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        upd_dtm     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT meta_system_m_cd_uk UNIQUE (system_cd),
        CONSTRAINT meta_system_m_use_yn_ck CHECK (use_yn IN ('Y', 'N'))
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS meta_naming_rule_m (
        naming_rule_id    SERIAL PRIMARY KEY,
        system_id         INTEGER NOT NULL REFERENCES meta_system_m(system_id) ON DELETE CASCADE,
        section_cd        VARCHAR(20),
        object_type_nm    VARCHAR(30) NOT NULL,
        rule_title_nm     VARCHAR(200) NOT NULL,
        format_pattern_nm TEXT,
        parts_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
        examples_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
        rule_desc         TEXT,
        sort_ord          INTEGER NOT NULL DEFAULT 0,
        use_yn            CHAR(1) NOT NULL DEFAULT 'Y',
        reg_dtm           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        upd_dtm           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT meta_naming_rule_m_use_yn_ck CHECK (use_yn IN ('Y', 'N')),
        CONSTRAINT meta_naming_rule_m_sys_type_uk UNIQUE (system_id, object_type_nm, section_cd)
      )
    `)

    const existing = await client.query(
      `SELECT system_id FROM meta_system_m WHERE system_cd = $1`,
      [ENTERPRISE_SYSTEM.system_cd],
    )

    let systemId
    if (existing.rows[0]) {
      systemId = existing.rows[0].system_id
    } else {
      const inserted = await client.query(
        `INSERT INTO meta_system_m (system_cd, system_nm, system_desc, use_yn)
         VALUES ($1, $2, $3, 'Y')
         RETURNING system_id`,
        [ENTERPRISE_SYSTEM.system_cd, ENTERPRISE_SYSTEM.system_nm, ENTERPRISE_SYSTEM.system_desc],
      )
      systemId = inserted.rows[0].system_id
    }

    const countRes = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM meta_naming_rule_m WHERE system_id = $1`,
      [systemId],
    )

    if (countRes.rows[0].cnt === 0) {
      for (const rule of NAMING_RULE_SEED) {
        await client.query(
          `INSERT INTO meta_naming_rule_m
             (system_id, section_cd, object_type_nm, rule_title_nm, format_pattern_nm,
              parts_json, examples_json, rule_desc, sort_ord, use_yn)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, 'Y')`,
          [
            systemId,
            rule.section_cd,
            rule.object_type,
            rule.title,
            rule.format_pattern,
            JSON.stringify(rule.parts),
            JSON.stringify(rule.examples),
            rule.notes || null,
            rule.sort_order,
          ],
        )
      }
      console.log(`[migrateNamingRules] seeded ${NAMING_RULE_SEED.length} enterprise naming rules`)
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
