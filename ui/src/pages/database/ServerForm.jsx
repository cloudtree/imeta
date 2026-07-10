const EMPTY = {
  db_server_nm: '',
  host_nm: '',
  port_no: 5432,
  database_nm: '',
  user_nm: '',
  password_val: '',
  ssl_yn: 'Y',
  db_server_desc: '',
  use_yn: 'Y',
}

export default function ServerForm({ value, onChange, isEdit = false }) {
  const set = (field) => (e) => {
    const nextValue = field === 'port_no' ? Number(e.target.value) : e.target.value
    onChange({ ...value, [field]: nextValue })
  }

  return (
    <>
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
          <label className="form-label required">데이터베이스명</label>
          <input
            className="form-control"
            value={value.database_nm}
            onChange={set('database_nm')}
            placeholder="예: metadata_db"
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
