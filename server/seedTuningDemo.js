import { pool } from './db.js'
import { getPgConfig } from './dbConfig.js'

const SERVER_NAME = '튜닝 테스트 PostgreSQL'
const SCHEMA = 'tunetest'

let tuningDemoStatus = { ok: false, message: 'not started' }

export function getTuningDemoStatus() {
  return tuningDemoStatus
}

const COUNTS = {
  dept: 10,
  customers: 3_000,
  products: 500,
  orders: 12_000,
  orderItems: 24_000,
}

function connectionParts(config) {
  if (config.host && config.database && config.user) {
    return {
      host: config.host,
      port: Number(config.port || 5432),
      database: config.database,
      user: config.user,
      password: config.password,
    }
  }

  const raw = String(config.connectionString || '')
  const normalized = raw.replace(/^postgres:\/\//, 'postgresql://')
  try {
    const parsed = new URL(normalized)
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    }
  } catch {
    const match = normalized.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:/?#]+)(?::(\d+))?\/([^?#]+)/)
    if (!match) return null
    return {
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: Number(match[4] || 5432),
      database: decodeURIComponent(match[5]),
    }
  }
}

function sslYn(host) {
  if (/^dpg-[a-z0-9-]+(-a)?$/i.test(host)) return 'N'
  if (String(host).includes('render.com')) return 'Y'
  return 'N'
}

async function ensureTables() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.dept (
      dept_id   INTEGER PRIMARY KEY,
      dept_nm   VARCHAR(50) NOT NULL,
      region_cd VARCHAR(10)
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.customers (
      customer_id INTEGER PRIMARY KEY,
      customer_nm VARCHAR(100) NOT NULL,
      phone_no    VARCHAR(20),
      cust_cd     VARCHAR(12),
      dept_id     INTEGER REFERENCES ${SCHEMA}.dept (dept_id),
      reg_dt      DATE
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS customers_ix_phone ON ${SCHEMA}.customers (phone_no)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.products (
      product_id  INTEGER PRIMARY KEY,
      product_nm  VARCHAR(100) NOT NULL,
      category_cd VARCHAR(10),
      unit_price  NUMERIC(12, 2)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS products_ix_nm ON ${SCHEMA}.products (product_nm)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.orders (
      order_id    INTEGER PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES ${SCHEMA}.customers (customer_id),
      order_date  DATE NOT NULL,
      status      VARCHAR(10) NOT NULL,
      amount      NUMERIC(14, 2)
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS orders_ix_date ON ${SCHEMA}.orders (order_date)
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SCHEMA}.order_items (
      order_item_id INTEGER PRIMARY KEY,
      order_id      INTEGER NOT NULL REFERENCES ${SCHEMA}.orders (order_id),
      product_id    INTEGER NOT NULL REFERENCES ${SCHEMA}.products (product_id),
      qty           INTEGER,
      unit_price    NUMERIC(12, 2)
    )
  `)

  // status, customer_id, order_id FK에는 인덱스를 두지 않는다.
  // orders / order_items 통계는 수집하지 않아 "통계 미수집" 규칙이 나오게 한다.
  await pool.query(`ALTER TABLE ${SCHEMA}.orders SET (autovacuum_enabled = false)`)
  await pool.query(`ALTER TABLE ${SCHEMA}.order_items SET (autovacuum_enabled = false)`)
}

async function loadRows(client) {
  const existing = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM ${SCHEMA}.customers)::int AS customers,
      (SELECT COUNT(*) FROM ${SCHEMA}.orders)::int AS orders,
      (SELECT COUNT(*) FROM ${SCHEMA}.order_items)::int AS items
  `)
  const counts = existing.rows[0]
  if (
    counts.customers >= COUNTS.customers
    && counts.orders >= COUNTS.orders
    && counts.items >= COUNTS.orderItems
  ) {
    console.log(`[tuning-demo] ${SCHEMA} already loaded (${counts.customers} customers)`)
    return
  }

  try {
    await client.query('BEGIN')
    await client.query(`
      TRUNCATE ${SCHEMA}.order_items, ${SCHEMA}.orders, ${SCHEMA}.customers, ${SCHEMA}.products, ${SCHEMA}.dept
      RESTART IDENTITY CASCADE
    `)
    await client.query(`
      INSERT INTO ${SCHEMA}.dept (dept_id, dept_nm, region_cd)
      SELECT i,
             'Department ' || i,
             (ARRAY['SEOUL','BUSAN','DAEGU','INCHEON','GWANGJU'])[1 + ((i - 1) % 5)]
      FROM generate_series(1, $1) AS i
    `, [COUNTS.dept])

    await client.query(`
      INSERT INTO ${SCHEMA}.customers (customer_id, customer_nm, phone_no, cust_cd, dept_id, reg_dt)
      SELECT i,
             'Customer ' || lpad(i::text, 5, '0'),
             CASE WHEN i = 42 THEN '1010000042'
                  ELSE '010' || lpad((10000000 + i)::text, 8, '0')
             END,
             'C' || lpad(i::text, 7, '0'),
             1 + ((i - 1) % $2),
             DATE '2023-01-01' + ((i % 1000)::text || ' days')::interval
      FROM generate_series(1, $1) AS i
    `, [COUNTS.customers, COUNTS.dept])

    await client.query(`
      INSERT INTO ${SCHEMA}.products (product_id, product_nm, category_cd, unit_price)
      SELECT i,
             'Product ' || lpad(i::text, 4, '0'),
             (ARRAY['ELEC','FOOD','BOOK','TOY','ETC'])[1 + ((i - 1) % 5)],
             (100 + (i % 9000)) / 100.0
      FROM generate_series(1, $1) AS i
    `, [COUNTS.products])

    await client.query(`
      INSERT INTO ${SCHEMA}.orders (order_id, customer_id, order_date, status, amount)
      SELECT i,
             1 + ((i - 1) % $2),
             CASE WHEN i % 97 = 0 THEN DATE '2026-01-15'
                  ELSE DATE '2024-01-01' + ((i % 700)::text || ' days')::interval
             END,
             CASE (i % 10)
               WHEN 0 THEN 'PENDING'
               WHEN 1 THEN 'SHIPPED'
               WHEN 2 THEN 'CANCELLED'
               ELSE 'DELIVERED'
             END,
             (1000 + (i % 50000)) / 100.0
      FROM generate_series(1, $1) AS i
    `, [COUNTS.orders, COUNTS.customers])

    await client.query(`
      INSERT INTO ${SCHEMA}.order_items (order_item_id, order_id, product_id, qty, unit_price)
      SELECT i,
             1 + ((i - 1) % $2),
             1 + ((i - 1) % $3),
             1 + (i % 20),
             (100 + (i % 9000)) / 100.0
      FROM generate_series(1, $1) AS i
    `, [COUNTS.orderItems, COUNTS.orders, COUNTS.products])

    await client.query(`ANALYZE ${SCHEMA}.dept`)
    await client.query(`ANALYZE ${SCHEMA}.customers`)
    await client.query(`ANALYZE ${SCHEMA}.products`)
    await client.query('COMMIT')
    console.log(
      `[tuning-demo] loaded dept=${COUNTS.dept} customers=${COUNTS.customers} products=${COUNTS.products} orders=${COUNTS.orders} items=${COUNTS.orderItems}`,
    )
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

async function registerServer(client, conn) {
  const ssl = sslYn(conn.host)
  const desc = '튜닝 화면 테스트용. 스키마에 tunetest를 입력하고 예제 SQL을 분석하세요. orders/order_items는 통계를 수집하지 않았고, status·FK 컬럼 인덱스가 없습니다.'

  const existing = await client.query(
    `SELECT db_server_id FROM meta_db_server_m WHERE db_server_nm = $1`,
    [SERVER_NAME],
  )

  if (existing.rows.length) {
    await client.query(
      `UPDATE meta_db_server_m
       SET db_type_nm = 'POSTGRES',
           host_nm = $1,
           port_no = $2,
           database_nm = $3,
           user_nm = $4,
           password_val = $5,
           ssl_yn = $6,
           db_server_desc = $7,
           use_yn = 'Y'
       WHERE db_server_nm = $8`,
      [conn.host, conn.port, conn.database, conn.user, conn.password, ssl, desc, SERVER_NAME],
    )
    console.log(`[tuning-demo] updated server "${SERVER_NAME}" id=${existing.rows[0].db_server_id}`)
    return
  }

  const inserted = await client.query(
    `INSERT INTO meta_db_server_m
       (db_server_nm, db_type_nm, host_nm, port_no, database_nm, user_nm, password_val, ssl_yn, db_server_desc, use_yn)
     VALUES ($1, 'POSTGRES', $2, $3, $4, $5, $6, $7, $8, 'Y')
     RETURNING db_server_id`,
    [SERVER_NAME, conn.host, conn.port, conn.database, conn.user, conn.password, ssl, desc],
  )
  console.log(`[tuning-demo] registered server "${SERVER_NAME}" id=${inserted.rows[0].db_server_id}`)
}

/** 앱 DB 안에 튜닝 테스트 스키마를 만들고, 같은 DB를 대상 서버로 등록한다. */
export async function seedTuningDemo() {
  const client = await pool.connect()
  try {
    const conn = connectionParts(getPgConfig())
    if (!conn?.host || !conn.database || !conn.user || !conn.password) {
      tuningDemoStatus = { ok: false, message: 'database connection parts are incomplete' }
      console.warn(`[tuning-demo] skipped: ${tuningDemoStatus.message}`)
      return
    }

    await ensureTables()
    await loadRows(client)
    await registerServer(client, conn)
    tuningDemoStatus = { ok: true, message: `${SERVER_NAME} / schema ${SCHEMA}` }
  } catch (err) {
    tuningDemoStatus = { ok: false, message: err.message }
    console.error('[tuning-demo] failed:', err.message)
  } finally {
    client.release()
  }
}
