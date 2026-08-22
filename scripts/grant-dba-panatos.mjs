import oracledb from 'oracledb'

// CDB root(ORCL)가 아니라 PDB 서비스로 접속
const CONNECT = process.env.ORACLE_CONNECT?.trim() || 'localhost:1521/ORCLPDB'

const conn = await oracledb.getConnection({
  user: process.env.ORACLE_USER?.trim() || 'sys',
  password: process.env.ORACLE_PASSWORD ?? 'americano',
  connectString: CONNECT,
  privilege: oracledb.SYSDBA,
})

try {
  const con = await conn.execute(
    `SELECT SYS_CONTEXT('USERENV','CON_NAME') AS con_name FROM dual`,
  )
  console.log('[grant] container:', con.rows[0][0])
  console.log('[grant] connect:', CONNECT)

  const found = await conn.execute(
    `SELECT username FROM all_users
     WHERE UPPER(username) IN ('PANATOS', 'C##PANATOS')
     ORDER BY username`,
  )
  console.log('[grant] matching users:', found.rows.map((r) => r[0]))

  let usernames = found.rows.map((r) => r[0])

  // 없으면 PDB 로컬 사용자 생성 후 DBA 부여
  if (!usernames.length) {
    const user = 'PANATOS'
    const password = process.env.TARGET_PASSWORD ?? 'americano'
    console.log(`[grant] creating local user ${user} in this PDB`)
    await conn.execute(`CREATE USER ${user} IDENTIFIED BY "${password}"`)
    await conn.execute(`GRANT CONNECT, RESOURCE TO ${user}`)
    await conn.execute(`ALTER USER ${user} QUOTA UNLIMITED ON USERS`)
    usernames = [user]
  }

  for (const username of usernames) {
    await conn.execute(`GRANT DBA TO ${username}`)
    console.log(`[grant] GRANT DBA TO ${username} — OK`)

    const roles = await conn.execute(
      `SELECT granted_role FROM dba_role_privs WHERE grantee = :u AND granted_role = 'DBA'`,
      { u: username },
    )
    console.log(`[grant] verify ${username} has DBA:`, roles.rows.length > 0)
  }

  const test = await oracledb.getConnection({
    user: 'panatos',
    password: process.env.TARGET_PASSWORD ?? 'americano',
    connectString: CONNECT,
  })
  const who = await test.execute(
    `SELECT USER AS u, SYS_CONTEXT('USERENV','CON_NAME') AS con FROM dual`,
  )
  console.log('[grant] login test as panatos:', who.rows[0])
  await test.close()
} finally {
  await conn.close().catch(() => {})
}
