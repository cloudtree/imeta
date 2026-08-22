/**
 * 로컬 Oracle 튜닝 테스트 스키마/데이터 시드
 *
 * 기본 접속: sys/americano @ localhost:1521/ORCL (SYSDBA)
 *
 * 환경 변수(선택):
 *   ORACLE_USER / ORACLE_PASSWORD / ORACLE_CONNECT
 *   ORACLE_SYSDBA=Y|N   (기본: user가 sys면 Y)
 *   TUNETEST_PASSWORD   (스키마 비밀번호, 기본 tunetest123)
 *   TUNETEST_CUSTOMERS / ORDERS / ORDER_ITEMS / PRODUCTS / DEPT
 *
 * 생성 스키마: C##TUNETEST (CDB) 또는 TUNETEST
 * 테스트 SQL: scripts/oracle-tuning-test-sqls.sql
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import oracledb from 'oracledb'

const ORACLE_USER = process.env.ORACLE_USER?.trim() || 'sys'
const ORACLE_PASSWORD = process.env.ORACLE_PASSWORD ?? 'americano'
const ORACLE_CONNECT = process.env.ORACLE_CONNECT?.trim() || 'localhost:1521/ORCL'
const USE_SYSDBA =
  process.env.ORACLE_SYSDBA?.trim()?.toUpperCase() === 'Y' ||
  (process.env.ORACLE_SYSDBA == null && ORACLE_USER.toLowerCase() === 'sys')

const TUNETEST_PASSWORD = process.env.TUNETEST_PASSWORD ?? 'tunetest123'

const COUNTS = {
  CUSTOMERS: Number(process.env.TUNETEST_CUSTOMERS ?? 10_000),
  ORDERS: Number(process.env.TUNETEST_ORDERS ?? 50_000),
  ORDER_ITEMS: Number(process.env.TUNETEST_ORDER_ITEMS ?? 100_000),
  PRODUCTS: Number(process.env.TUNETEST_PRODUCTS ?? 1_000),
  DEPT: Number(process.env.TUNETEST_DEPT ?? 10),
}

const BATCH_SIZE = 5_000
const HERE = path.dirname(fileURLToPath(import.meta.url))

function oraCode(err) {
  const match = String(err?.message || '').match(/\bORA-(\d{5})\b/)
  return match ? Number(match[1]) : null
}

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
    process.stdout.write(`\r[seed] inserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}   `)
  }
  process.stdout.write('\n')
}

async function prepareSchema(adminConn, connectString) {
  const candidates = ['TUNETEST', 'C##TUNETEST']
  for (const userName of candidates) {
    try {
      try {
        await adminConn.execute(`DROP USER ${userName} CASCADE`)
        console.log(`[seed] dropped existing user ${userName}`)
      } catch (err) {
        if (oraCode(err) !== 1918) throw err
      }

      await adminConn.execute(`CREATE USER ${userName} IDENTIFIED BY "${TUNETEST_PASSWORD}"`)
      await adminConn.execute(`GRANT CONNECT, RESOURCE TO ${userName}`)
      await adminConn.execute(`ALTER USER ${userName} QUOTA UNLIMITED ON USERS`)
      // 튜닝 UI에서 sys가 아니어도 조회 가능하도록 스키마 선택 분석용 SELECT 권한
      await adminConn.execute(`GRANT SELECT ANY DICTIONARY TO ${userName}`).catch(() => {})
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

  console.warn('[seed] falling back to SYS schema with TT_ prefix')
  return { conn: null, owner: 'SYS', prefix: 'TT_', dedicated: false }
}

async function dropTables(conn, T) {
  for (const name of ['ORDER_ITEMS', 'ORDERS', 'CUSTOMERS', 'PRODUCTS', 'DEPT']) {
    await execIgnore(conn, `DROP TABLE ${T(name)} CASCADE CONSTRAINTS PURGE`, [942])
  }
}

async function createTables(conn, T) {
  await conn.execute(`
    CREATE TABLE ${T('DEPT')} (
      dept_id   NUMBER(4) CONSTRAINT ${T('DEPT')}_PK PRIMARY KEY,
      dept_nm   VARCHAR2(50) NOT NULL,
      region_cd VARCHAR2(10)
    )`)

  // phone_no: 숫자형 문자열 + 인덱스 → phone_no = 숫자리터럴 시 암시적 형변환
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

  await conn.execute(`
    CREATE TABLE ${T('PRODUCTS')} (
      product_id  NUMBER(10) CONSTRAINT ${T('PRODUCTS')}_PK PRIMARY KEY,
      product_nm  VARCHAR2(100) NOT NULL,
      category_cd VARCHAR2(10),
      unit_price  NUMBER(12,2)
    )`)
  await conn.execute(`CREATE INDEX ${T('PRODUCTS')}_IX_NM ON ${T('PRODUCTS')}(product_nm)`)

  // ORDERS: FK/STATUS 미인덱스, ORDER_DATE 인덱스, 통계 미수집
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

  // phone_no = '1010000001' 형태 (숫자 리터럴 비교 테스트)
  const customerRows = Array.from({ length: COUNTS.CUSTOMERS }, (_, i) => [
    i + 1,
    `Customer ${String(i + 1).padStart(5, '0')}`,
    String(1_010_000_000 + i),
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

async function manageStats(conn, owner, T) {
  for (const name of ['DEPT', 'CUSTOMERS', 'PRODUCTS']) {
    await conn.execute(
      `BEGIN DBMS_STATS.GATHER_TABLE_STATS(ownname => :o, tabname => :t, cascade => TRUE); END;`,
      { o: owner, t: T(name) },
    )
    console.log(`[seed] stats gathered: ${T(name)}`)
  }
  for (const name of ['ORDERS', 'ORDER_ITEMS']) {
    await conn.execute(
      `BEGIN DBMS_STATS.DELETE_TABLE_STATS(ownname => :o, tabname => :t); END;`,
      { o: owner, t: T(name) },
    )
    console.log(`[seed] stats intentionally REMOVED: ${T(name)}`)
  }
}

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

  console.log('\n=== 샘플 실행계획: ORDERS.status → FULL SCAN ===')
  await conn.execute(
    `EXPLAIN PLAN FOR
     SELECT order_id, order_date, amount FROM ${T('ORDERS')} WHERE status = 'PENDING'`,
  )
  const plan = await conn.execute(`SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY())`)
  for (const [line] of plan.rows) console.log(line)
}

function writeTestSqlFile(owner) {
  const sqlPath = path.join(HERE, 'oracle-tuning-test-sqls.sql')
  const content = `-- ============================================================
-- Oracle SQL 튜닝 테스트용 쿼리
-- 스키마: ${owner}
-- 생성: seed-oracle-tuning-local.mjs
--
-- iMETA 튜닝 화면 사용법:
--   1) 대상 Oracle 서버 선택
--   2) 스키마(선택)에 ${owner} 입력
--   3) 아래 SQL을 붙여 넣고 분석
-- ============================================================

-- [1] FULL SCAN + 통계 미수집
--     검출 예상: STATUS 인덱스 부재, ORDERS 통계 미수집, TABLE ACCESS FULL
SELECT order_id, order_date, amount
FROM orders
WHERE status = 'PENDING';

-- [2] 암시적 형변환 (VARCHAR2 = 숫자) → 인덱스 무효화
--     검출 예상: D-01 암시적 형변환, phone_no 인덱스 미사용
SELECT customer_id, customer_nm
FROM customers
WHERE phone_no = 1010000042;

-- [3] 인덱스 컬럼에 함수 적용 (UPPER)
--     검출 예상: S-03 함수 적용, PRODUCT_NM 인덱스 무효화, FULL SCAN
SELECT product_id, unit_price
FROM products
WHERE UPPER(product_nm) = 'PRODUCT 0500';

-- [4] 날짜 컬럼 함수 적용 (TO_CHAR) + 통계 미수집
--     검출 예상: S-03, ORDER_DATE 인덱스 무효화, D-04 통계 미수집
SELECT COUNT(*)
FROM orders
WHERE TO_CHAR(order_date, 'YYYY-MM-DD') = '2026-01-15';

-- [5] FK 미인덱스 조인 + 선행 와일드카드 LIKE
--     검출 예상: S-02 선행 %, D-03 FK 미인덱스, FULL SCAN, 통계 미수집
SELECT c.customer_nm, o.order_id, i.qty
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE c.customer_nm LIKE '%00042%';

-- [6] 스키마 한정 버전 (스키마 입력란을 비울 때)
SELECT order_id, order_date, amount
FROM ${owner}.orders
WHERE status = 'PENDING';
`
  fs.writeFileSync(sqlPath, content, 'utf8')
  console.log(`[seed] wrote test SQLs → ${sqlPath}`)
  return sqlPath
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
console.log(`[seed] connect ${ORACLE_USER}@${ORACLE_CONNECT} sysdba=${USE_SYSDBA}`)

const adminOpts = {
  user: ORACLE_USER,
  password: ORACLE_PASSWORD,
  connectString: ORACLE_CONNECT,
}
if (USE_SYSDBA) adminOpts.privilege = oracledb.SYSDBA

const adminConn = await oracledb.getConnection(adminOpts)

let workConn = null
try {
  const schema = await prepareSchema(adminConn, ORACLE_CONNECT)
  workConn = schema.conn || adminConn
  const T = (name) => schema.prefix + name

  if (!schema.dedicated) await dropTables(workConn, T)

  await createTables(workConn, T)
  console.log(`[seed] tables created under ${schema.owner}`)

  await loadData(workConn, T)
  await manageStats(workConn, schema.owner, T)
  await verify(workConn, T)
  writeTestSqlFile(schema.owner)

  console.log(`\n[seed] done.`)
  console.log(`  schema : ${schema.owner}`)
  console.log(`  password: ${TUNETEST_PASSWORD}`)
  console.log(`  iMETA 튜닝 화면 → 스키마(선택): ${schema.owner}`)
} finally {
  if (workConn && workConn !== adminConn) await workConn.close().catch(() => {})
  await adminConn.close().catch(() => {})
}
