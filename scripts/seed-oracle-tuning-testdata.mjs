/**
 * SQL 튜닝 분석 기능 테스트용 Oracle 데이터 생성 스크립트
 *
 * - meta_db_server_m(db_server_id=2)에서 로컬 Oracle 접속정보를 읽는다.
 * - 전용 사용자(TUNETEST)를 만들고, 실패하면 SYSTEM 스키마에 TT_ 접두사로 생성한다.
 * - 각 테이블은 특정 튜닝 안티패턴 규칙을 유발하도록 설계되어 있다.
 *   (자세한 안티패턴 매핑은 테이블 생성부 주석 참고)
 * - 재실행 시 기존 객체를 삭제하고 다시 만드는 멱등 스크립트.
 *
 * 환경 변수(선택):
 *   TUNETEST_DB_SERVER_ID  meta_db_server_m 조회 키 (기본 2)
 *   TUNETEST_PASSWORD      전용 사용자 비밀번호 (기본 tunetest123)
 *   TUNETEST_CUSTOMERS     CUSTOMERS 행 수    (기본 10000)
 *   TUNETEST_ORDERS        ORDERS 행 수       (기본 50000)
 *   TUNETEST_ORDER_ITEMS   ORDER_ITEMS 행 수  (기본 100000)
 *   TUNETEST_PRODUCTS      PRODUCTS 행 수     (기본 1000)
 *   TUNETEST_DEPT          DEPT 행 수         (기본 10)
 */
import oracledb from 'oracledb'
import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'

const DB_SERVER_ID = Number(process.env.TUNETEST_DB_SERVER_ID ?? 2)
const TUNETEST_PASSWORD = process.env.TUNETEST_PASSWORD ?? 'tunetest123'

const COUNTS = {
  CUSTOMERS: Number(process.env.TUNETEST_CUSTOMERS ?? 10_000),
  ORDERS: Number(process.env.TUNETEST_ORDERS ?? 50_000),
  ORDER_ITEMS: Number(process.env.TUNETEST_ORDER_ITEMS ?? 100_000),
  PRODUCTS: Number(process.env.TUNETEST_PRODUCTS ?? 1_000),
  DEPT: Number(process.env.TUNETEST_DEPT ?? 10),
}

const BATCH_SIZE = 5_000

// ---------------------------------------------------------------------------
// 접속 정보 로드 (PostgreSQL meta_db_server_m)
// ---------------------------------------------------------------------------
async function loadOracleServerInfo() {
  const client = new pg.Client(getPgConfig())
  await client.connect()
  try {
    const res = await client.query(
      `SELECT host_nm, port_no, database_nm, user_nm, password_val
       FROM meta_db_server_m
       WHERE db_server_id = $1`,
      [DB_SERVER_ID],
    )
    if (!res.rows.length) {
      throw new Error(`meta_db_server_m에 db_server_id=${DB_SERVER_ID} 행이 없습니다.`)
    }
    return res.rows[0]
  } finally {
    await client.end().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
function oraCode(err) {
  const match = String(err?.message || '').match(/\bORA-(\d{5})\b/)
  return match ? Number(match[1]) : null
}

/** 지정된 ORA 코드는 무시하고 실행 */
async function execIgnore(conn, sql, ignoreCodes = []) {
  try {
    await conn.execute(sql)
    return true
  } catch (err) {
    if (ignoreCodes.includes(oraCode(err))) return false
    throw err
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(daysBack) {
  const now = Date.now()
  return new Date(now - randomInt(0, daysBack) * 86_400_000 - randomInt(0, 86_399) * 1000)
}

function pickWeighted(entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [value, weight] of entries) {
    r -= weight
    if (r <= 0) return value
  }
  return entries[entries.length - 1][0]
}

async function insertMany(conn, sql, rows, bindDefs) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    await conn.executeMany(sql, chunk, { bindDefs, autoCommit: true })
  }
}

// ---------------------------------------------------------------------------
// 스키마 준비: 전용 사용자 생성 시도 → 실패 시 SYSTEM + TT_ 접두사
// ---------------------------------------------------------------------------
async function prepareSchema(systemConn, connectString) {
  const candidates = ['TUNETEST', 'C##TUNETEST'] // ORA-65096(CDB 공용사용자 규칙) 대비
  for (const userName of candidates) {
    try {
      // 멱등성: 기존 사용자 제거 (객체 포함)
      try {
        await systemConn.execute(`DROP USER ${userName} CASCADE`)
        console.log(`[seed] dropped existing user ${userName}`)
      } catch (err) {
        if (oraCode(err) !== 1918) throw err // ORA-01918: user does not exist → 무시
      }

      await systemConn.execute(`CREATE USER ${userName} IDENTIFIED BY "${TUNETEST_PASSWORD}"`)
      await systemConn.execute(`GRANT CONNECT, RESOURCE TO ${userName}`)
      await systemConn.execute(`ALTER USER ${userName} QUOTA UNLIMITED ON USERS`)
      console.log(`[seed] created dedicated user ${userName}`)

      const conn = await oracledb.getConnection({
        user: userName,
        password: TUNETEST_PASSWORD,
        connectString,
      })
      return { conn, owner: userName, prefix: '', dedicated: true }
    } catch (err) {
      console.warn(`[seed] user ${userName} setup failed: ${err.message.split('\n')[0]}`)
    }
  }

  console.warn('[seed] falling back to SYSTEM schema with TT_ prefix')
  return { conn: null, owner: 'SYSTEM', prefix: 'TT_', dedicated: false }
}

// ---------------------------------------------------------------------------
// 테이블 생성 + 데이터 적재
// ---------------------------------------------------------------------------
async function dropTables(conn, T) {
  // 자식 → 부모 순서로 삭제 (ORA-00942: 없음 → 무시)
  for (const name of ['ORDER_ITEMS', 'ORDERS', 'CUSTOMERS', 'PRODUCTS', 'DEPT']) {
    await execIgnore(conn, `DROP TABLE ${T(name)} CASCADE CONSTRAINTS PURGE`, [942])
  }
}

async function createTables(conn, T) {
  // DEPT: 소형 조회(lookup) 테이블
  await conn.execute(`
    CREATE TABLE ${T('DEPT')} (
      dept_id   NUMBER(4) CONSTRAINT ${T('DEPT')}_PK PRIMARY KEY,
      dept_nm   VARCHAR2(50) NOT NULL,
      region_cd VARCHAR2(10)
    )`)

  // CUSTOMERS: phone_no는 숫자만 담긴 VARCHAR2 + 인덱스
  //  → WHERE phone_no = 1012340001 (숫자 비교) 시 묵시적 형변환으로 인덱스 무효화 규칙 유발
  await conn.execute(`
    CREATE TABLE ${T('CUSTOMERS')} (
      customer_id NUMBER(10) CONSTRAINT ${T('CUSTOMERS')}_PK PRIMARY KEY,
      customer_nm VARCHAR2(100) NOT NULL,
      phone_no    VARCHAR2(20),
      cust_cd     VARCHAR2(12),
      dept_id     NUMBER(4) CONSTRAINT ${T('CUSTOMERS')}_FK_DEPT REFERENCES ${T('DEPT')}(dept_id),
      reg_dt      DATE
    )`)
  await conn.execute(`CREATE INDEX ${T('CUSTOMERS')}_IX_PHONE ON ${T('CUSTOMERS')}(phone_no)`)

  // PRODUCTS: product_nm에 일반 인덱스
  //  → WHERE UPPER(product_nm) = ... 처럼 컬럼 가공 시 인덱스 무효화 규칙 유발
  await conn.execute(`
    CREATE TABLE ${T('PRODUCTS')} (
      product_id  NUMBER(10) CONSTRAINT ${T('PRODUCTS')}_PK PRIMARY KEY,
      product_nm  VARCHAR2(100) NOT NULL,
      category_cd VARCHAR2(10),
      unit_price  NUMBER(12,2)
    )`)
  await conn.execute(`CREATE INDEX ${T('PRODUCTS')}_IX_NM ON ${T('PRODUCTS')}(product_nm)`)

  // ORDERS:
  //  - customer_id FK에 인덱스 없음 → 미인덱스 FK 규칙 유발
  //  - status 컬럼 인덱스 없음     → 전체 스캔(Full Table Scan) 규칙 유발
  //  - order_date 인덱스 있음      → TO_CHAR(order_date)=... 가공 시 인덱스 무효화 유발
  //  - 통계 미수집(아래 참고)      → 통계 미수집/노후 규칙 유발
  await conn.execute(`
    CREATE TABLE ${T('ORDERS')} (
      order_id    NUMBER(12) CONSTRAINT ${T('ORDERS')}_PK PRIMARY KEY,
      customer_id NUMBER(10) NOT NULL
                  CONSTRAINT ${T('ORDERS')}_FK_CUST REFERENCES ${T('CUSTOMERS')}(customer_id),
      order_date  DATE NOT NULL,
      status      VARCHAR2(10) NOT NULL,
      amount      NUMBER(14,2)
    )`)
  await conn.execute(`CREATE INDEX ${T('ORDERS')}_IX_DATE ON ${T('ORDERS')}(order_date)`)

  // ORDER_ITEMS: order_id FK에 인덱스 없음(미인덱스 FK) + 통계 미수집 대상
  await conn.execute(`
    CREATE TABLE ${T('ORDER_ITEMS')} (
      order_item_id NUMBER(14) CONSTRAINT ${T('ORDER_ITEMS')}_PK PRIMARY KEY,
      order_id      NUMBER(12) NOT NULL
                    CONSTRAINT ${T('ORDER_ITEMS')}_FK_ORD REFERENCES ${T('ORDERS')}(order_id),
      product_id    NUMBER(10) NOT NULL
                    CONSTRAINT ${T('ORDER_ITEMS')}_FK_PRD REFERENCES ${T('PRODUCTS')}(product_id),
      qty           NUMBER(6),
      unit_price    NUMBER(12,2)
    )`)
}

async function loadData(conn, T) {
  const REGIONS = ['SEOUL', 'BUSAN', 'DAEGU', 'INCHEON', 'GWANGJU']
  const CATEGORIES = ['ELEC', 'FOOD', 'BOOK', 'TOY', 'ETC']
  const STATUS_WEIGHTS = [
    ['DELIVERED', 70],
    ['SHIPPED', 15],
    ['PENDING', 10],
    ['CANCELLED', 5],
  ]

  // DEPT
  const deptRows = Array.from({ length: COUNTS.DEPT }, (_, i) => [
    i + 1,
    `Department ${i + 1}`,
    REGIONS[i % REGIONS.length],
  ])
  await insertMany(
    conn,
    `INSERT INTO ${T('DEPT')} (dept_id, dept_nm, region_cd) VALUES (:1, :2, :3)`,
    deptRows,
    [
      { type: oracledb.NUMBER },
      { type: oracledb.STRING, maxSize: 50 },
      { type: oracledb.STRING, maxSize: 10 },
    ],
  )
  console.log(`[seed] DEPT loaded (${deptRows.length})`)

  // CUSTOMERS — phone_no는 '010' + 8자리 숫자 문자열 (묵시적 형변환 테스트용)
  const customerRows = Array.from({ length: COUNTS.CUSTOMERS }, (_, i) => [
    i + 1,
    `Customer ${String(i + 1).padStart(5, '0')}`,
    `010${String(10_000_000 + i).slice(-8)}`,
    `C${String(i + 1).padStart(7, '0')}`,
    randomInt(1, COUNTS.DEPT),
    randomDate(1_095),
  ])
  await insertMany(
    conn,
    `INSERT INTO ${T('CUSTOMERS')} (customer_id, customer_nm, phone_no, cust_cd, dept_id, reg_dt)
     VALUES (:1, :2, :3, :4, :5, :6)`,
    customerRows,
    [
      { type: oracledb.NUMBER },
      { type: oracledb.STRING, maxSize: 100 },
      { type: oracledb.STRING, maxSize: 20 },
      { type: oracledb.STRING, maxSize: 12 },
      { type: oracledb.NUMBER },
      { type: oracledb.DATE },
    ],
  )
  console.log(`[seed] CUSTOMERS loaded (${customerRows.length})`)

  // PRODUCTS — 대소문자 혼합 이름 (UPPER() 인덱스 무효화 테스트용)
  const productRows = Array.from({ length: COUNTS.PRODUCTS }, (_, i) => [
    i + 1,
    `Product ${String(i + 1).padStart(4, '0')}`,
    CATEGORIES[i % CATEGORIES.length],
    randomInt(100, 999_999) / 100,
  ])
  await insertMany(
    conn,
    `INSERT INTO ${T('PRODUCTS')} (product_id, product_nm, category_cd, unit_price)
     VALUES (:1, :2, :3, :4)`,
    productRows,
    [
      { type: oracledb.NUMBER },
      { type: oracledb.STRING, maxSize: 100 },
      { type: oracledb.STRING, maxSize: 10 },
      { type: oracledb.NUMBER },
    ],
  )
  console.log(`[seed] PRODUCTS loaded (${productRows.length})`)

  // ORDERS
  const orderRows = Array.from({ length: COUNTS.ORDERS }, (_, i) => [
    i + 1,
    randomInt(1, COUNTS.CUSTOMERS),
    randomDate(730),
    pickWeighted(STATUS_WEIGHTS),
    randomInt(1_000, 5_000_000) / 100,
  ])
  await insertMany(
    conn,
    `INSERT INTO ${T('ORDERS')} (order_id, customer_id, order_date, status, amount)
     VALUES (:1, :2, :3, :4, :5)`,
    orderRows,
    [
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.DATE },
      { type: oracledb.STRING, maxSize: 10 },
      { type: oracledb.NUMBER },
    ],
  )
  console.log(`[seed] ORDERS loaded (${orderRows.length})`)

  // ORDER_ITEMS
  const itemRows = Array.from({ length: COUNTS.ORDER_ITEMS }, (_, i) => [
    i + 1,
    randomInt(1, COUNTS.ORDERS),
    randomInt(1, COUNTS.PRODUCTS),
    randomInt(1, 20),
    randomInt(100, 999_999) / 100,
  ])
  await insertMany(
    conn,
    `INSERT INTO ${T('ORDER_ITEMS')} (order_item_id, order_id, product_id, qty, unit_price)
     VALUES (:1, :2, :3, :4, :5)`,
    itemRows,
    [
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
    ],
  )
  console.log(`[seed] ORDER_ITEMS loaded (${itemRows.length})`)
}

// ---------------------------------------------------------------------------
// 통계: 일부만 수집, ORDERS/ORDER_ITEMS는 의도적으로 미수집
// ---------------------------------------------------------------------------
async function manageStats(conn, owner, T) {
  const gather = ['DEPT', 'CUSTOMERS', 'PRODUCTS']
  const skip = ['ORDERS', 'ORDER_ITEMS']

  for (const name of gather) {
    await conn.execute(
      `BEGIN DBMS_STATS.GATHER_TABLE_STATS(ownname => :o, tabname => :t, cascade => TRUE); END;`,
      { o: owner, t: T(name) },
    )
    console.log(`[seed] stats gathered: ${T(name)}`)
  }
  // 재실행/자동수집 대비 명시적으로 통계 삭제 → "통계 미수집" 규칙이 확실히 발동하도록
  for (const name of skip) {
    await conn.execute(
      `BEGIN DBMS_STATS.DELETE_TABLE_STATS(ownname => :o, tabname => :t); END;`,
      { o: owner, t: T(name) },
    )
    console.log(`[seed] stats intentionally REMOVED: ${T(name)}`)
  }
}

// ---------------------------------------------------------------------------
// 검증: 행 수 + 통계 상태 + 샘플 실행계획
// ---------------------------------------------------------------------------
async function verify(conn, T) {
  console.log('\n=== 행 수 / 통계 상태 ===')
  for (const name of ['DEPT', 'CUSTOMERS', 'PRODUCTS', 'ORDERS', 'ORDER_ITEMS']) {
    const cnt = await conn.execute(`SELECT COUNT(*) FROM ${T(name)}`)
    const stat = await conn.execute(
      `SELECT TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') FROM user_tables WHERE table_name = :t`,
      { t: T(name) },
    )
    const analyzed = stat.rows[0]?.[0] || '(미수집)'
    console.log(`${T(name).padEnd(14)} rows=${String(cnt.rows[0][0]).padStart(7)}  last_analyzed=${analyzed}`)
  }

  console.log('\n=== 샘플 실행계획: ORDERS.status 미인덱스 필터 → FULL SCAN ===')
  await conn.execute(
    `EXPLAIN PLAN FOR
     SELECT order_id, order_date, amount FROM ${T('ORDERS')} WHERE status = 'PENDING'`,
  )
  const plan = await conn.execute(`SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY())`)
  for (const [line] of plan.rows) console.log(line)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const server = await loadOracleServerInfo()
const connectString = `${server.host_nm.trim()}:${Number(server.port_no) || 1521}/${server.database_nm.trim()}`
console.log(`[seed] target oracle: ${connectString} (admin user: ${server.user_nm})`)

const systemConn = await oracledb.getConnection({
  user: server.user_nm.trim(),
  password: server.password_val,
  connectString,
})

let workConn = null
try {
  const schema = await prepareSchema(systemConn, connectString)
  workConn = schema.conn || systemConn
  const T = (name) => schema.prefix + name

  if (!schema.dedicated) await dropTables(workConn, T) // 전용 사용자는 DROP USER CASCADE로 이미 정리됨

  await createTables(workConn, T)
  console.log(`[seed] tables created under ${schema.owner}`)

  await loadData(workConn, T)
  await manageStats(workConn, schema.owner, T)
  await verify(workConn, T)

  console.log(`\n[seed] done. owner=${schema.owner}, prefix='${schema.prefix}'`)
} finally {
  if (workConn && workConn !== systemConn) await workConn.close().catch(() => {})
  await systemConn.close().catch(() => {})
}
