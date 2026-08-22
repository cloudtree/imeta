const BASE = 'http://localhost:3000/api'
const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login_id: 'cloudtree', password: 'americano' }),
}).then((r) => r.json())

const data = await fetch(`${BASE}/tuning/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
  body: JSON.stringify({
    db_server_id: 2,
    sql_text: "SELECT c.customer_nm, o.order_id, i.qty FROM c##tunetest.customers c JOIN c##tunetest.orders o ON o.customer_id = c.customer_id JOIN c##tunetest.order_items i ON i.order_id = o.order_id WHERE c.customer_nm LIKE '%00042%'",
  }),
}).then((r) => r.json())

console.log('plan rows:', data.plan?.rows?.length)
console.log('annotated nodes:', Object.keys(data.plan_annotations ?? {}).join(', '))
console.log('\n--- tree ---')
for (const row of data.plan?.rows ?? []) {
  const indent = '  '.repeat(Number(row.DEPTH ?? 0))
  const op = [row.OPERATION, row.OPTIONS].filter(Boolean).join(' ')
  const notes = data.plan_annotations?.[row.ID] ?? []
  console.log(`${indent}#${row.ID} ${op} ${row.OBJECT_NAME ?? ''} (rows=${row.CARDINALITY ?? '-'}, cost=${row.COST ?? '-'}, depth=${row.DEPTH})`)
  for (const n of notes) console.log(`${indent}   >> [${n.severity}][${n.rule_id}] ${n.title}`)
}
