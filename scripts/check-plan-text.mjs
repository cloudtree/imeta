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
    sql_text: "SELECT order_id, order_date, amount FROM c##tunetest.orders WHERE status = 'PENDING'",
  }),
}).then((r) => r.json())

console.log('plan_error:', data.plan_error ?? null)
console.log('plan rows:', data.plan?.rows?.length ?? 0)
console.log('--- plan.text ---')
console.log(data.plan?.text ?? '(없음)')
