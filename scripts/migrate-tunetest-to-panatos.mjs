/**
 * C##TUNETEST → PANATOS 스키마로 튜닝 테스트 테이블/데이터 이전
 * 접속: sys/americano@localhost:1521/ORCL (SYSDBA)
 * 대상: panatos / americano
 */
import oracledb from 'oracledb'

const CONNECT = process.env.ORACLE_CONNECT?.trim() || 'localhost:1521/ORCL'
const SYS_USER = process.env.ORACLE_USER?.trim() || 'sys'
const SYS_PASSWORD = process.env.ORACLE_PASSWORD ?? 'americano'
const TARGET_USER = (process.env.TARGET_USER || 'panatos').toUpperCase()
const TARGET_PASSWORD = process.env.TARGET_PASSWORD ?? 'americano'
const SOURCE_USER = (process.env.SOURCE_USER || 'C##TUNETEST').toUpperCase()

const TABLES = ['DEPT', 'CUSTOMERS', 'PRODUCTS', 'ORDERS', 'ORDER_ITEMS']

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

async function ensureTargetUser(sysConn) {
  const exists = await sysConn.execute(
    `SELECT username FROM all_users WHERE username = :u`,
    { u: TARGET_USER },
  )
  if (!exists.rows?.length) {
    console.log(`[migrate] creating user ${TARGET_USER}`)
    await sysConn.execute(`CREATE USER ${TARGET_USER} IDENTIFIED BY "${TARGET_PASSWORD}"`)
    await sysConn.execute(`GRANT CONNECT, RESOURCE TO ${TARGET_USER}`)
    await sysConn.execute(`ALTER USER ${TARGET_USER} QUOTA UNLIMITED ON USERS`)
  } else {
    console.log(`[migrate] user ${TARGET_USER} exists — resetting password`)
    await sysConn.execute(`ALTER USER ${TARGET_USER} IDENTIFIED BY "${TARGET_PASSWORD}"`)
    await execIgnore(sysConn, `ALTER USER ${TARGET_USER} QUOTA UNLIMITED ON USERS`, [])
    await execIgnore(sysConn, `GRANT CONNECT, RESOURCE TO ${TARGET_USER}`, [])
  }
}

async function sourceExists(sysConn) {
  const r = await sysConn.execute(
    `SELECT username FROM all_users WHERE username = :u`,
    { u: SOURCE_USER },
  )
  return r.rows?.length > 0
}

async function dropTargetTables(conn) {
  for (const name of [...TABLES].reverse()) {
    await execIgnore(conn, `DROP TABLE ${name} CASCADE CONSTRAINTS PURGE`, [942])
  }
}

async function createTables(conn) {
  await conn.execute(`
    CREATE TABLE DEPT (
      dept_id   NUMBER(4) CONSTRAINT DEPT_PK PRIMARY KEY,
      dept_nm   VARCHAR2(50) NOT NULL,
      region_cd VARCHAR2(10)
    )`)

  await conn.execute(`
    CREATE TABLE CUSTOMERS (
      customer_id NUMBER(10) CONSTRAINT CUSTOMERS_PK PRIMARY KEY,
      customer_nm VARCHAR2(100) NOT NULL,
      phone_no    VARCHAR2(20),
      cust_cd     VARCHAR2(12),
      dept_id     NUMBER(4) CONSTRAINT CUSTOMERS_FK_DEPT REFERENCES DEPT(dept_id),
      reg_dt      DATE
    )`)
  await conn.execute(`CREATE INDEX CUSTOMERS_IX_PHONE ON CUSTOMERS(phone_no)`)

  await conn.execute(`
    CREATE TABLE PRODUCTS (
      product_id  NUMBER(10) CONSTRAINT PRODUCTS_PK PRIMARY KEY,
      product_nm  VARCHAR2(100) NOT NULL,
      category_cd VARCHAR2(10),
      unit_price  NUMBER(12,2)
    )`)
  await conn.execute(`CREATE INDEX PRODUCTS_IX_NM ON PRODUCTS(product_nm)`)

  await conn.execute(`
    CREATE TABLE ORDERS (
      order_id    NUMBER(12) CONSTRAINT ORDERS_PK PRIMARY KEY,
      customer_id NUMBER(10) NOT NULL
                  CONSTRAINT ORDERS_FK_CUST REFERENCES CUSTOMERS(customer_id),
      order_date  DATE NOT NULL,
      status      VARCHAR2(10) NOT NULL,
      amount      NUMBER(14,2)
    )`)
  await conn.execute(`CREATE INDEX ORDERS_IX_DATE ON ORDERS(order_date)`)

  await conn.execute(`
    CREATE TABLE ORDER_ITEMS (
      order_item_id NUMBER(14) CONSTRAINT ORDER_ITEMS_PK PRIMARY KEY,
      order_id      NUMBER(12) NOT NULL
                    CONSTRAINT ORDER_ITEMS_FK_ORD REFERENCES ORDERS(order_id),
      product_id    NUMBER(10) NOT NULL
                    CONSTRAINT ORDER_ITEMS_FK_PRD REFERENCES PRODUCTS(product_id),
      qty           NUMBER(6),
      unit_price    NUMBER(12,2)
    )`)
}

async function copyData(sysConn) {
  // SYS로 INSERT…SELECT (스키마 간 복사). FK 순서: DEPT → CUSTOMERS → PRODUCTS → ORDERS → ORDER_ITEMS
  const copies = [
    `INSERT INTO ${TARGET_USER}.DEPT SELECT * FROM ${SOURCE_USER}.DEPT`,
    `INSERT INTO ${TARGET_USER}.CUSTOMERS SELECT * FROM ${SOURCE_USER}.CUSTOMERS`,
    `INSERT INTO ${TARGET_USER}.PRODUCTS SELECT * FROM ${SOURCE_USER}.PRODUCTS`,
    `INSERT INTO ${TARGET_USER}.ORDERS SELECT * FROM ${SOURCE_USER}.ORDERS`,
    `INSERT INTO ${TARGET_USER}.ORDER_ITEMS SELECT * FROM ${SOURCE_USER}.ORDER_ITEMS`,
  ]
  for (const sql of copies) {
    const r = await sysConn.execute(sql, {}, { autoCommit: true })
    console.log(`[migrate] ${sql.split('SELECT')[0].trim()} → ${r.rowsAffected} rows`)
  }
}

async function manageStats(conn) {
  for (const name of ['DEPT', 'CUSTOMERS', 'PRODUCTS']) {
    await conn.execute(
      `BEGIN DBMS_STATS.GATHER_TABLE_STATS(ownname => :o, tabname => :t, cascade => TRUE); END;`,
      { o: TARGET_USER, t: name },
    )
    console.log(`[migrate] stats gathered: ${name}`)
  }
  for (const name of ['ORDERS', 'ORDER_ITEMS']) {
    await conn.execute(
      `BEGIN DBMS_STATS.DELETE_TABLE_STATS(ownname => :o, tabname => :t); END;`,
      { o: TARGET_USER, t: name },
    )
    console.log(`[migrate] stats removed: ${name}`)
  }
}

async function verify(conn) {
  console.log('\n=== 이전 결과 ===')
  for (const name of TABLES) {
    const cnt = await conn.execute(`SELECT COUNT(*) FROM ${name}`)
    const stat = await conn.execute(
      `SELECT TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') FROM user_tables WHERE table_name = :t`,
      { t: name },
    )
    console.log(
      `${name.padEnd(14)} rows=${String(cnt.rows[0][0]).padStart(7)}  last_analyzed=${stat.rows[0]?.[0] || '(미수집)'}`,
    )
  }
}

console.log(`[migrate] ${SOURCE_USER} → ${TARGET_USER} @ ${CONNECT}`)

const sysConn = await oracledb.getConnection({
  user: SYS_USER,
  password: SYS_PASSWORD,
  connectString: CONNECT,
  privilege: oracledb.SYSDBA,
})

let targetConn = null
try {
  if (!(await sourceExists(sysConn))) {
    throw new Error(`소스 스키마 ${SOURCE_USER} 가 없습니다. 먼저 seed-oracle-tuning-local.mjs 를 실행하세요.`)
  }

  await ensureTargetUser(sysConn)

  // 대상 스키마로 접속해 테이블 재생성
  targetConn = await oracledb.getConnection({
    user: TARGET_USER,
    password: TARGET_PASSWORD,
    connectString: CONNECT,
  })
  await dropTargetTables(targetConn)
  await createTables(targetConn)
  console.log(`[migrate] tables created in ${TARGET_USER}`)

  // SYS에서 데이터 복사 (권한)
  await copyData(sysConn)
  await manageStats(targetConn)
  await verify(targetConn)

  // 소스 스키마 제거 (요청: 옮겨줘)
  console.log(`[migrate] dropping source user ${SOURCE_USER} CASCADE`)
  await sysConn.execute(`DROP USER ${SOURCE_USER} CASCADE`)
  console.log(`[migrate] done. iMETA 튜닝 스키마(선택): ${TARGET_USER} (또는 비워도 동일)`)
} finally {
  await targetConn?.close().catch(() => {})
  await sysConn.close().catch(() => {})
}
