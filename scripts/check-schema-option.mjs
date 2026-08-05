const BASE = 'http://localhost:3000/api'
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login_id: 'cloudtree', password: 'americano' }),
}).then((r) => r.json())
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }

async function analyze(label, body) {
  const res = await fetch(`${BASE}/tuning/analyze`, { method: 'POST', headers, body: JSON.stringify({ db_server_id: 2, ...body }) })
  const data = await res.json()
  console.log(`\n### [${label}] HTTP ${res.status}`)
  if (!res.ok) { console.log('  message:', data.message); return }
  console.log('  schema:', data.schema_nm, '| plan rows:', data.plan?.rows?.length ?? 0, '| findings:', data.summary?.total)
  console.log('  plan_error:', data.plan_error ?? null)
  console.log('  dict tables:', data.dictionary?.tables?.map((t) => `${t.OWNER}.${t.TABLE_NAME}`).join(', ') || '(없음)')
  console.log('  annotated nodes:', Object.keys(data.plan_annotations ?? {}).join(',') || '(없음)')
}

await analyze('스키마 지정 + 비정규화 SQL', {
  schema_nm: 'C##TUNETEST',
  sql_text: "SELECT order_id, order_date, amount FROM orders WHERE status = 'PENDING'",
})

await analyze('스키마 미지정 + 정규화 SQL', {
  sql_text: "SELECT order_id, order_date, amount FROM c##tunetest.orders WHERE status = 'PENDING'",
})

await analyze('스키마 미지정 + 비정규화 SQL (에러 안내 확인)', {
  sql_text: "SELECT order_id, order_date, amount FROM orders WHERE status = 'PENDING'",
})

await analyze('존재하지 않는 스키마 (400 확인)', {
  schema_nm: 'NO_SUCH_SCHEMA',
  sql_text: 'SELECT 1 FROM dual',
})
