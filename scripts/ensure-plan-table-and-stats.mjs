/**
 * 등록된 모든 Oracle 서버에 PLAN_TABLE 생성 + 스키마 통계 수집
 *
 * ORDERS / ORDER_ITEMS 는 튜닝 규칙(통계 미수집) 검증용으로 통계를 건너뛴다.
 * 환경변수:
 *   SKIP_STATS_TABLES=ORDERS,ORDER_ITEMS  (기본값)
 *   GATHER_ALL=Y  이면 모든 테이블 통계 수집
 */
import pg from 'pg'
import { getPgConfig } from '../server/dbConfig.js'
import { withOracleConnection } from '../server/oracleClient.js'
import { ensurePlanTable, gatherUserTableStats } from '../server/oracleTuning.js'

const skipDefault = process.env.GATHER_ALL === 'Y'
  ? []
  : (process.env.SKIP_STATS_TABLES || 'ORDERS,ORDER_ITEMS')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)

const client = new pg.Client(getPgConfig())
await client.connect()

const { rows: servers } = await client.query(
  `SELECT db_server_id, db_server_nm, db_type_nm, host_nm, port_no, database_nm,
          user_nm, password_val, ora_privilege_cd
   FROM meta_db_server_m
   WHERE UPPER(COALESCE(db_type_nm,'POSTGRES')) = 'ORACLE'
     AND use_yn = 'Y'
   ORDER BY db_server_id`,
)
await client.end()

if (!servers.length) {
  console.log('[plan] 등록된 Oracle 서버가 없습니다.')
  process.exit(0)
}

console.log(`[plan] Oracle 서버 ${servers.length}대 — PLAN_TABLE + 통계 수집`)
console.log(`[plan] stats skip tables: ${skipDefault.join(', ') || '(none)'}`)

for (const server of servers) {
  const label = `#${server.db_server_id} ${server.db_server_nm} (${server.user_nm}@${server.host_nm}:${server.port_no}/${server.database_nm})`
  console.log(`\n--- ${label} ---`)
  try {
    await withOracleConnection(server, async (connection) => {
      const who = await connection.execute(
        `SELECT USER AS u, SYS_CONTEXT('USERENV','CON_NAME') AS con FROM dual`,
      )
      console.log('[plan] session:', who.rows[0])

      const plan = await ensurePlanTable(connection)
      console.log('[plan] PLAN_TABLE:', plan.message)

      const stats = await gatherUserTableStats(connection, { skipTables: skipDefault })
      console.log(`[plan] stats gathered (${stats.gathered.length}/${stats.total}):`, stats.gathered.join(', ') || '(none)')
      if (stats.skipped.length) {
        console.log('[plan] stats skipped:', stats.skipped.join(', '))
      }
    })
  } catch (err) {
    console.error(`[plan] FAILED ${label}:`, err.message)
  }
}

console.log('\n[plan] done')
