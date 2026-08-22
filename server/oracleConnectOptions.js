/**
 * Oracle 연결 옵션 생성 (SYSDBA/SYSOPER 포함)
 */

const PRIVILEGE_MAP = {
  SYSDBA: 'SYSDBA',
  SYSOPER: 'SYSOPER',
  NORMAL: null,
}

export function normalizeOraPrivilege(value) {
  const v = String(value ?? 'NORMAL').trim().toUpperCase()
  if (v === 'SYSDBA' || v === 'SYSOPER') return v
  return 'NORMAL'
}

/**
 * @param {object} server  meta_db_server_m 행 또는 폼 값
 * @param {import('oracledb')} oracledb
 * @param {{ connectTimeout?: number }} [opts]
 */
export function buildOracleConnectOptions(server, oracledb, opts = {}) {
  const privilegeCd = normalizeOraPrivilege(server.ora_privilege_cd)
  const privilegeConst =
    privilegeCd === 'SYSDBA'
      ? oracledb.SYSDBA
      : privilegeCd === 'SYSOPER'
        ? oracledb.SYSOPER
        : null

  const options = {
    user: server.user_nm?.trim(),
    password: server.password_val,
    connectString: `${server.host_nm?.trim()}:${Number(server.port_no) || 1521}/${server.database_nm?.trim()}`,
    connectTimeout: opts.connectTimeout ?? 10,
  }

  if (privilegeConst != null) {
    options.privilege = privilegeConst
  }

  return options
}

export function enhanceOracleError(err, server) {
  const message = err?.message || '데이터베이스 연결에 실패했습니다.'
  if (/ORA-28009/.test(message)) {
    return (
      `${message}\n→ SYS(또는 SYSOPER) 계정은 일반 접속이 불가합니다. ` +
      `서버등록 폼의 "Oracle 접속 권한"을 SYSDBA로 선택하세요.` +
      (server?.ora_privilege_cd && server.ora_privilege_cd !== 'SYSDBA'
        ? ` (현재: ${server.ora_privilege_cd})`
        : '')
    )
  }
  return message
}

export { PRIVILEGE_MAP }
