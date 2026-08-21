/**
 * panatos@ORCLPDB 에 튜닝 테스트 스키마/데이터 생성
 * sys/americano SYSDBA 로 접속해 테이블을 PANATOS 소유로 만들고 통계를 맞춘다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import oracledb from 'oracledb'

const CONNECT = process.env.ORACLE_CONNECT?.trim() || 'localhost:1521/ORCLPDB'
const SYS_USER = process.env.ORACLE_USER?.trim() || 'sys'
const SYS_PASSWORD = process.env.ORACLE_PASSWORD ?? 'americano'
const OWNER = (process.env.TARGET_USER || 'PANATOS').toUpperCase()
const OWNER_PASSWORD = process.env.TARGET_PASSWORD ?? 'americano'

const COUNTS = {
  CUSTOMERS: Number(process.env.TUNETEST_CUSTOMERS ?? 10_000),
  ORDERS: Number(process.env.TUNETEST_ORDERS ?? 50_000),
  ORDER_ITEMS: Number(process.env.TUNETEST_ORDER_ITEMS ?? 100_000),
  PRODUCTS: Number(process.env.TUNETEST_PRODUCTS ?? 1_000),
  DEPT: Number(process.env.TUNETEST_DEPT ?? 10),
}
const BATCH = 5_000

function oraCode(err) {
  const m = String(err?.message || '').match(/\bORA-(\d{5})\b/)
  return m ? Number(m[1]) : null
}

async function execIgnore(conn, sql, codes = []) {
  try {
    await conn.execute(sql)
    return true
  } catch (err) {
    if (codes.includes(oraCode(err))) return false
    throw err
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function randomDate(daysBack) {
  return new Date(Date.now() - randomInt(0, daysBack) * 86400000 - randomInt(0, 86399) * 1000)
}
function pickWeighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [v, w] of entries) {
    r -= w
    if (r <= 0) return v
  }
  return entries.at(-1)[0]
}

async function insertMany(conn, sql, rows, bindDefs) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.executeMany(sql, rows.slice(i, i + BATCH), { bindDefs, autoCommit: true })
    process.stdout.write(`\r[seed] ${Math.min(i + BATCH, rows.length)}/${rows.length}   `)
  }
  process.stdout.write('\n')
}

async function ensureUser(sys) {
  const r = await sys.execute(`SELECT username FROM all_users WHERE username = :u`, { u: OWNER })
  if (!r.rows?.length) {
    console.log(`[seed] CREATE USER ${OWNER}`)
    await sys.execute(`CREATE USER ${OWNER} IDENTIFIED BY "${OWNER_PASSWORD}"`)
  } else {
    await sys.execute(`ALTER USER ${OWNER} IDENTIFIED BY "${OWNER_PASSWORD}"`)
  }
  await execIgnore(sys, `GRANT CONNECT, RESOURCE, DBA TO ${OWNER}`)
  await execIgnore(sys, `ALTER USER ${OWNER} QUOTA UNLIMITED ON USERS`)
}

async function dropAndCreate(conn) {
  for (const t of ['ORDER_ITEMS', 'ORDERS', 'CUSTOMERS', 'PRODUCTS', 'DEPT']) {
    await execIgnore(conn, `DROP TABLE ${t} CASCADE CONSTRAINTS PURGE`, [942])
  }

  await conn.execute(`
    CREATE TABLE DEPT (
      dept_id NUMBER(4) PRIMARY KEY,
      dept_nm VARCHAR2(50) NOT NULL,
      region_cd VARCHAR2(10)
    )`)
  await conn.execute(`
    CREATE TABLE CUSTOMERS (
      customer_id NUMBER(10) PRIMARY KEY,
      customer_nm VARCHAR2(100) NOT NULL,
      phone_no VARCHAR2(20),
      cust_cd VARCHAR2(12),
      dept_id NUMBER(4) REFERENCES DEPT(dept_id),
      reg_dt DATE
    )`)
  await conn.execute(`CREATE INDEX CUSTOMERS_IX_PHONE ON CUSTOMERS(phone_no)`)
  await conn.execute(`
    CREATE TABLE PRODUCTS (
      product_id NUMBER(10) PRIMARY KEY,
      product_nm VARCHAR2(100) NOT NULL,
      category_cd VARCHAR2(10),
      unit_price NUMBER(12,2)
    )`)
  await conn.execute(`CREATE INDEX PRODUCTS_IX_NM ON PRODUCTS(product_nm)`)
  await conn.execute(`
    CREATE TABLE ORDERS (
      order_id NUMBER(12) PRIMARY KEY,
      customer_id NUMBER(10) NOT NULL REFERENCES CUSTOMERS(customer_id),
      order_date DATE NOT NULL,
      status VARCHAR2(10) NOT NULL,
      amount NUMBER(14,2)
    )`)
  await conn.execute(`CREATE INDEX ORDERS_IX_DATE ON ORDERS(order_date)`)
  await conn.execute(`
    CREATE TABLE ORDER_ITEMS (
      order_item_id NUMBER(14) PRIMARY KEY,
      order_id NUMBER(12) NOT NULL REFERENCES ORDERS(order_id),
      product_id NUMBER(10) NOT NULL REFERENCES PRODUCTS(product_id),
      qty NUMBER(6),
      unit_price NUMBER(12,2)
    )`)
}

async function load(conn) {
  const regions = ['SEOUL', 'BUSAN', 'DAEGU', 'INCHEON', 'GWANGJU']
  const cats = ['ELEC', 'FOOD', 'BOOK', 'TOY', 'ETC']
  const statusW = [['DELIVERED', 70], ['SHIPPED', 15], ['PENDING', 10], ['CANCELLED', 5]]

  await insertMany(
    conn,
    `INSERT INTO DEPT (dept_id, dept_nm, region_cd) VALUES (:1,:2,:3)`,
    Array.from({ length: COUNTS.DEPT }, (_, i) => [i + 1, `Department ${i + 1}`, regions[i % regions.length]]),
    [{ type: oracledb.NUMBER }, { type: oracledb.STRING, maxSize: 50 }, { type: oracledb.STRING, maxSize: 10 }],
  )
  console.log('[seed] DEPT ok')

  await insertMany(
    conn,
    `INSERT INTO CUSTOMERS (customer_id, customer_nm, phone_no, cust_cd, dept_id, reg_dt) VALUES (:1,:2,:3,:4,:5,:6)`,
    Array.from({ length: COUNTS.CUSTOMERS }, (_, i) => [
      i + 1,
      `Customer ${String(i + 1).padStart(5, '0')}`,
      String(1_010_000_000 + i),
      `C${String(i + 1).padStart(7, '0')}`,
      randomInt(1, COUNTS.DEPT),
      randomDate(1095),
    ]),
    [
      { type: oracledb.NUMBER },
      { type: oracledb.STRING, maxSize: 100 },
      { type: oracledb.STRING, maxSize: 20 },
      { type: oracledb.STRING, maxSize: 12 },
      { type: oracledb.NUMBER },
      { type: oracledb.DATE },
    ],
  )
  console.log('[seed] CUSTOMERS ok')

  await insertMany(
    conn,
    `INSERT INTO PRODUCTS (product_id, product_nm, category_cd, unit_price) VALUES (:1,:2,:3,:4)`,
    Array.from({ length: COUNTS.PRODUCTS }, (_, i) => [
      i + 1,
      `Product ${String(i + 1).padStart(4, '0')}`,
      cats[i % cats.length],
      randomInt(100, 999999) / 100,
    ]),
    [
      { type: oracledb.NUMBER },
      { type: oracledb.STRING, maxSize: 100 },
      { type: oracledb.STRING, maxSize: 10 },
      { type: oracledb.NUMBER },
    ],
  )
  console.log('[seed] PRODUCTS ok')

  await insertMany(
    conn,
    `INSERT INTO ORDERS (order_id, customer_id, order_date, status, amount) VALUES (:1,:2,:3,:4,:5)`,
    Array.from({ length: COUNTS.ORDERS }, (_, i) => [
      i + 1,
      randomInt(1, COUNTS.CUSTOMERS),
      randomDate(730),
      pickWeighted(statusW),
      randomInt(1000, 5000000) / 100,
    ]),
    [
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.DATE },
      { type: oracledb.STRING, maxSize: 10 },
      { type: oracledb.NUMBER },
    ],
  )
  console.log('[seed] ORDERS ok')

  await insertMany(
    conn,
    `INSERT INTO ORDER_ITEMS (order_item_id, order_id, product_id, qty, unit_price) VALUES (:1,:2,:3,:4,:5)`,
    Array.from({ length: COUNTS.ORDER_ITEMS }, (_, i) => [
      i + 1,
      randomInt(1, COUNTS.ORDERS),
      randomInt(1, COUNTS.PRODUCTS),
      randomInt(1, 20),
      randomInt(100, 999999) / 100,
    ]),
    [
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
      { type: oracledb.NUMBER },
    ],
  )
  console.log('[seed] ORDER_ITEMS ok')
}

async function stats(conn) {
  for (const t of ['DEPT', 'CUSTOMERS', 'PRODUCTS']) {
    await conn.execute(
      `BEGIN DBMS_STATS.GATHER_TABLE_STATS(ownname=>:o, tabname=>:t, cascade=>TRUE); END;`,
      { o: OWNER, t },
    )
  }
  for (const t of ['ORDERS', 'ORDER_ITEMS']) {
    await conn.execute(
      `BEGIN DBMS_STATS.DELETE_TABLE_STATS(ownname=>:o, tabname=>:t); END;`,
      { o: OWNER, t },
    )
  }
}

async function verify(conn) {
  console.log('\n=== verify ===')
  for (const t of ['DEPT', 'CUSTOMERS', 'PRODUCTS', 'ORDERS', 'ORDER_ITEMS']) {
    const c = await conn.execute(`SELECT COUNT(*) FROM ${t}`)
    console.log(t, c.rows[0][0])
  }
  await conn.execute(`EXPLAIN PLAN FOR SELECT order_id FROM ORDERS WHERE status = 'PENDING'`)
  const plan = await conn.execute(`SELECT plan_table_output FROM TABLE(DBMS_XPLAN.DISPLAY())`)
  console.log(plan.rows.map((r) => r[0]).join('\n'))
}

// drop C##TUNETEST on CDB if present (best-effort)
async function dropOldCommonUser() {
  try {
    const cdb = await oracledb.getConnection({
      user: SYS_USER,
      password: SYS_PASSWORD,
      connectString: 'localhost:1521/ORCL',
      privilege: oracledb.SYSDBA,
    })
    try {
      const r = await cdb.execute(`SELECT username FROM all_users WHERE username = 'C##TUNETEST'`)
      if (r.rows?.length) {
        await cdb.execute(`DROP USER C##TUNETEST CASCADE`)
        console.log('[seed] dropped C##TUNETEST from CDB')
      }
    } finally {
      await cdb.close()
    }
  } catch (e) {
    console.warn('[seed] C##TUNETEST drop skipped:', e.message.split('\n')[0])
  }
}

console.log(`[seed] ${OWNER}@${CONNECT}`)
const sys = await oracledb.getConnection({
  user: SYS_USER,
  password: SYS_PASSWORD,
  connectString: CONNECT,
  privilege: oracledb.SYSDBA,
})
let ownerConn
try {
  const con = await sys.execute(`SELECT SYS_CONTEXT('USERENV','CON_NAME') FROM dual`)
  console.log('[seed] container:', con.rows[0][0])
  await ensureUser(sys)

  ownerConn = await oracledb.getConnection({
    user: OWNER,
    password: OWNER_PASSWORD,
    connectString: CONNECT,
  })
  await dropAndCreate(ownerConn)
  await load(ownerConn)
  await stats(ownerConn)
  await verify(ownerConn)

  const sqlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'oracle-tuning-test-sqls.sql')
  fs.writeFileSync(
    sqlPath,
    `-- PANATOS@ORCLPDB 튜닝 테스트 SQL
-- iMETA: 서버=oracle(panatos), 스키마(선택)=비움 또는 PANATOS

SELECT order_id, order_date, amount FROM orders WHERE status = 'PENDING';

SELECT customer_id, customer_nm FROM customers WHERE phone_no = 1010000042;

SELECT product_id, unit_price FROM products WHERE UPPER(product_nm) = 'PRODUCT 0500';

SELECT COUNT(*) FROM orders WHERE TO_CHAR(order_date, 'YYYY-MM-DD') = '2026-01-15';

SELECT c.customer_nm, o.order_id, i.qty
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
JOIN order_items i ON i.order_id = o.order_id
WHERE c.customer_nm LIKE '%00042%';
`,
    'utf8',
  )
  console.log('[seed] wrote', sqlPath)
} finally {
  await ownerConn?.close().catch(() => {})
  await sys.close().catch(() => {})
}

await dropOldCommonUser()
console.log('[seed] done')
