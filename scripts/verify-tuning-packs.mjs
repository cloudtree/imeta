/* 유료팩 토글 E2E 검증 스크립트 (개발용) */
const BASE = 'http://localhost:3000/api'
const SERVER_ID = 2

const login = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login_id: 'cloudtree', password: 'americano' }),
}).then((r) => r.json())
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` }

const server = await fetch(`${BASE}/db-servers/${SERVER_ID}`, { headers }).then((r) => r.json())
console.log('### before:', { diag: server.diag_pack_yn, tuning: server.tuning_pack_yn })

async function setPacks(diag, tuning) {
  const res = await fetch(`${BASE}/db-servers/${SERVER_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ ...server, password_val: '', diag_pack_yn: diag, tuning_pack_yn: tuning }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.message)
  return { diag: body.diag_pack_yn, tuning: body.tuning_pack_yn }
}

console.log('### enable packs:', await setPacks('Y', 'Y'))

const awr = await fetch(`${BASE}/tuning/top-sql?db_server_id=${SERVER_ID}&source=awr&limit=5`, { headers })
  .then(async (r) => ({ status: r.status, body: await r.json() }))
console.log(`### top-sql awr: HTTP ${awr.status}`, awr.body.message ?? `items=${awr.body.items?.length}`)
if (awr.body.items?.length) {
  for (const i of awr.body.items.slice(0, 3)) console.log('  -', i.SQL_ID, i.ELAPSED_TIME, String(i.SQL_TEXT ?? '').slice(0, 60))
}

const analyze = await fetch(`${BASE}/tuning/analyze`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    db_server_id: SERVER_ID,
    sql_text: "SELECT order_id FROM c##tunetest.orders WHERE status = 'PENDING'",
    use_llm: true,
  }),
}).then((r) => r.json())
console.log('### analyze pack_info:', JSON.stringify(analyze.pack_info, null, 2))
console.log('### llm_explanation:', analyze.llm_explanation === null ? 'null (Ollama 없음 — 정상 생략)' : `${analyze.llm_explanation.model}: ${analyze.llm_explanation.text?.slice(0, 120)}`)

console.log('### restore packs:', await setPacks(server.diag_pack_yn, server.tuning_pack_yn))
