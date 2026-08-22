import oracledb from 'oracledb'

const CONNECT = process.env.ORACLE_CONNECT?.trim() || 'localhost:1521/ORCL'
const USER = (process.env.DROP_USER || 'C##TUNETEST').toUpperCase()

const conn = await oracledb.getConnection({
  user: process.env.ORACLE_USER?.trim() || 'sys',
  password: process.env.ORACLE_PASSWORD ?? 'americano',
  connectString: CONNECT,
  privilege: oracledb.SYSDBA,
})

try {
  const check = await conn.execute(
    `SELECT username FROM all_users WHERE username = :u`,
    { u: USER },
  )
  if (!check.rows?.length) {
    console.log(`[drop] user ${USER} does not exist — nothing to do`)
  } else {
    console.log(`[drop] DROP USER ${USER} CASCADE ...`)
    await conn.execute(`DROP USER ${USER} CASCADE`)
    console.log(`[drop] done — ${USER} deleted`)
  }
} finally {
  await conn.close().catch(() => {})
}
