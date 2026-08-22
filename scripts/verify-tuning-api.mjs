/* 튜닝 API E2E 검증 스크립트 (개발용) */
const BASE = process.env.API_BASE?.trim() || 'http://localhost:3000/api'
const SERVER_ID = Number(process.env.TUNING_SERVER_ID ?? 2)

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login_id: 'cloudtree', password: 'americano' }),
}).then((r) => r.json())

if (!login.token) {
  console.error('login failed:', login)
  process.exit(1)
}
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }

const TEST_SQLS = [
  ["FTS+통계미수집", "SELECT order_id, order_date, amount FROM c##tunetest.orders WHERE status = 'PENDING'"],
  ["암시적형변환", "SELECT customer_id, customer_nm FROM c##tunetest.customers WHERE phone_no = 1010000042"],
  ["인덱스컬럼함수", "SELECT product_id, unit_price FROM c##tunetest.products WHERE UPPER(product_nm) = 'PRODUCT 0500'"],
  ["날짜함수+통계", "SELECT COUNT(*) FROM c##tunetest.orders WHERE TO_CHAR(order_date, 'YYYY-MM-DD') = '2026-01-15'"],
  ["FK미인덱스조인+와일드카드", "SELECT c.customer_nm, o.order_id, i.qty FROM c##tunetest.customers c JOIN c##tunetest.orders o ON o.customer_id = c.customer_id JOIN c##tunetest.order_items i ON i.order_id = o.order_id WHERE c.customer_nm LIKE '%00042%'"],
]

for (const [label, sql] of TEST_SQLS) {
  const res = await fetch(`${BASE}/tuning/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ db_server_id: SERVER_ID, sql_text: sql }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.log(`\n### [${label}] HTTP ${res.status}: ${data.message}`)
    continue
  }
  console.log(`\n### [${label}] findings=${data.summary.total} (err=${data.summary.error}/warn=${data.summary.warning}/info=${data.summary.info}) tables=${data.dictionary.tables.map((t) => t.TABLE_NAME).join(',')}`)
  for (const f of data.findings) {
    console.log(`  - [${f.severity}][${f.rule_id}/${f.source}] ${f.title}`)
  }
  if (data.plan_error) console.log(`  !! plan_error: ${data.plan_error}`)
  if (data.dictionary_error) console.log(`  !! dict_error: ${data.dictionary_error}`)
  const fts = data.plan?.text?.split('\n').find((l) => l.includes('TABLE ACCESS FULL'))
  if (fts) console.log(`  plan: ${fts.trim()}`)
}

// Top SQL (커서 캐시)
const top = await fetch(`${BASE}/tuning/top-sql?db_server_id=${SERVER_ID}&metric=elapsed_time&limit=10`, { headers }).then(async (r) => ({ status: r.status, body: await r.json() }))
console.log(`\n### [TopSQL cursor] HTTP ${top.status} items=${top.body.items?.length ?? 0}`)
for (const item of (top.body.items ?? []).slice(0, 5)) {
  console.log(`  - ${item.SQL_ID} exec=${item.EXECUTIONS} elapsed=${item.ELAPSED_TIME} :: ${String(item.SQL_TEXT).slice(0, 80)}`)
}
if (top.status !== 200) console.log('  message:', top.body.message)

// AWR 소스 — diag pack 미설정 시 403 기대
const awr = await fetch(`${BASE}/tuning/top-sql?db_server_id=${SERVER_ID}&source=awr&limit=10`, { headers }).then(async (r) => ({ status: r.status, body: await r.json() }))
console.log(`\n### [TopSQL awr] HTTP ${awr.status} ${awr.body.message ?? `items=${awr.body.items?.length}`}`)
