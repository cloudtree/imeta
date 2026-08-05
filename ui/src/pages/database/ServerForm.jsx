const EMPTY = {
  db_server_nm: '',
  db_type_nm: 'POSTGRES',
  host_nm: '',
  port_no: 5432,
  database_nm: '',
  user_nm: '',
  password_val: '',
  ssl_yn: 'Y',
  db_server_desc: '',
  use_yn: 'Y',
  diag_pack_yn: 'N',
  tuning_pack_yn: 'N',
}

const DEFAULT_PORTS = { POSTGRES: 5432, ORACLE: 1521 }

export default function ServerForm({ value, onChange, isEdit = false, error = null, testResult = null }) {
  const set = (field) => (e) => {
    const nextValue = field === 'port_no' ? Number(e.target.value) : e.target.value
    onChange({ ...value, [field]: nextValue })
  }

  const setDbType = (e) => {
    const db_type_nm = e.target.value
    const next = { ...value, db_type_nm }
    // 기존 종류의 기본 포트를 그대로 쓰고 있었다면 새 종류의 기본 포트로 변경
    if (!value.port_no || Object.values(DEFAULT_PORTS).includes(Number(value.port_no))) {
      next.port_no = DEFAULT_PORTS[db_type_nm] ?? value.port_no
    }
    onChange(next)
  }

  const isOracle = value.db_type_nm === 'ORACLE'

  return (
    <>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {testResult && (
        <div
          className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`}
          style={{ marginBottom: '16px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {testResult.ok ? (
            <strong>접속되었습니다.</strong>
          ) : (
            <>
              <strong>접속 실패{testResult.code ? ` [${testResult.code}]` : ''}</strong>
              <div style={{ marginTop: '4px', fontSize: '13px' }}>{testResult.message}</div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">서버명</label>
          <input
            className="form-control"
            value={value.db_server_nm}
            onChange={set('db_server_nm')}
            placeholder="예: 운영 PostgreSQL"
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label required">DB 종류</label>
          <select className="form-control" value={value.db_type_nm ?? 'POSTGRES'} onChange={setDbType}>
            <option value="POSTGRES">PostgreSQL</option>
            <option value="ORACLE">Oracle</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">호스트</label>
          <input
            className="form-control"
            value={value.host_nm}
            onChange={set('host_nm')}
            placeholder="예: db.example.com"
            maxLength={255}
          />
        </div>

        <div className="form-group">
          <label className="form-label required">포트</label>
          <input
            className="form-control"
            type="number"
            min={1}
            max={65535}
            value={value.port_no}
            onChange={set('port_no')}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">{isOracle ? '서비스명 (Service Name)' : '데이터베이스명'}</label>
          <input
            className="form-control"
            value={value.database_nm}
            onChange={set('database_nm')}
            placeholder={isOracle ? '예: XEPDB1, ORCLPDB1' : '예: metadata_db'}
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label required">사용자명</label>
          <input
            className="form-control"
            value={value.user_nm}
            onChange={set('user_nm')}
            placeholder="예: postgres"
            maxLength={100}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className={`form-label${isEdit ? '' : ' required'}`}>비밀번호</label>
          <input
            className="form-control"
            type="password"
            value={value.password_val}
            onChange={set('password_val')}
            placeholder={isEdit ? '변경 시에만 입력' : '비밀번호 입력'}
            autoComplete="new-password"
          />
          {isEdit && (
            <span className="form-hint">비밀번호를 변경하지 않으려면 비워 두세요.</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">SSL 사용</label>
          <select className="form-control" value={value.ssl_yn} onChange={set('ssl_yn')}>
            <option value="Y">Y (사용)</option>
            <option value="N">N (미사용)</option>
          </select>
        </div>
      </div>

      {isOracle && (
        <div
          style={{
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            background: '#fafafa',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Oracle 유료 옵션 팩 (시스템별 설정)</div>
          <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '12px' }}>
            ⚠ 아래 옵션은 Oracle Enterprise Edition의 유료 라이선스가 필요합니다. 라이선스를 보유한 경우에만
            활성화하세요. 미보유 시 활성화하여 사용하면 라이선스 위반이 될 수 있습니다.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Diagnostics Pack (AWR/ASH/ADDM)</label>
              <select className="form-control" value={value.diag_pack_yn ?? 'N'} onChange={set('diag_pack_yn')}>
                <option value="N">N (미사용 — 무료 기능만)</option>
                <option value="Y">Y (사용 — 라이선스 보유)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tuning Pack (SQL Tuning Advisor)</label>
              <select className="form-control" value={value.tuning_pack_yn ?? 'N'} onChange={set('tuning_pack_yn')}>
                <option value="N">N (미사용 — 무료 기능만)</option>
                <option value="Y">Y (사용 — 라이선스 보유)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">사용 여부</label>
        <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
          <option value="Y">Y (사용)</option>
          <option value="N">N (미사용)</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea
          className="form-control"
          value={value.db_server_desc}
          onChange={set('db_server_desc')}
          placeholder="서버에 대한 설명을 입력하세요."
          rows={3}
        />
      </div>
    </>
  )
}

ServerForm.EMPTY = EMPTY
