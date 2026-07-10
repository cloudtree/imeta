const EMPTY = {
  system_cd: '',
  system_nm: '',
  system_desc: '',
  use_yn: 'Y',
  copy_from_enterprise: true,
}

export default function SystemForm({ value, onChange, isEdit = false }) {
  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({ ...value, [field]: v })
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">시스템 코드</label>
          <input
            className="form-control"
            value={value.system_cd}
            onChange={set('system_cd')}
            placeholder="예: OM, BL"
            maxLength={50}
            disabled={isEdit && value.system_cd === 'ENTERPRISE'}
            style={{ textTransform: 'uppercase' }}
          />
          <span className="form-hint">영문 대문자, 숫자, _, - 만 사용</span>
        </div>
        <div className="form-group">
          <label className="form-label required">시스템명</label>
          <input
            className="form-control"
            value={value.system_nm}
            onChange={set('system_nm')}
            placeholder="예: 오더시스템"
            maxLength={200}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea
          className="form-control"
          rows={3}
          value={value.system_desc || ''}
          onChange={set('system_desc')}
          placeholder="시스템 설명"
        />
      </div>

      {!isEdit && (
        <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!value.copy_from_enterprise}
            onChange={set('copy_from_enterprise')}
          />
          <span className="form-label" style={{ margin: 0 }}>전사표준 명명규칙을 복사하여 시작</span>
        </label>
      )}

      <div className="form-group">
        <label className="form-label">사용 여부</label>
        <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
          <option value="Y">사용</option>
          <option value="N">미사용</option>
        </select>
      </div>
    </>
  )
}

SystemForm.EMPTY = EMPTY
