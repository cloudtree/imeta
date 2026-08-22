import oracledb from 'oracledb'

const c = await oracledb.getConnection({
  user: 'sys',
  password: 'americano',
  connectString: 'localhost:1521/ORCL',
  privilege: oracledb.SYSDBA,
})

const info = await c.execute(
  `SELECT SYS_CONTEXT('USERENV','CON_NAME') AS con_name,
          SYS_CONTEXT('USERENV','CDB_NAME') AS cdb_name
   FROM dual`,
)
console.log('container:', info.rows[0])

const users = await c.execute(
  `SELECT username FROM all_users
   WHERE UPPER(username) LIKE '%PANA%' OR UPPER(username) LIKE '%TUNE%'
   ORDER BY 1`,
)
console.log('users:', users.rows)

try {
  const pdbs = await c.execute(`SELECT name, open_mode FROM v$pdbs`)
  console.log('pdbs:', pdbs.rows)
} catch (e) {
  console.log('pdbs error:', e.message)
}

// try common connection as panatos
for (const user of ['panatos', 'PANATOS', 'C##PANATOS', 'c##panatos']) {
  try {
    const t = await oracledb.getConnection({
      user,
      password: 'americano',
      connectString: 'localhost:1521/ORCL',
    })
    const who = await t.execute(`SELECT USER, SYS_CONTEXT('USERENV','CON_NAME') FROM dual`)
    console.log('login ok', user, who.rows[0])
    await t.close()
  } catch (e) {
    console.log('login fail', user, e.message.split('\n')[0])
  }
}

await c.close()
