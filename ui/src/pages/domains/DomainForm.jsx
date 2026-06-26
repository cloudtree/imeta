const EMPTY = {
  domain_nm:     '',
  data_type:     'VARCHAR',
  info_type:     '',
  domain_div_cd: '',
  data_length:   '',
  data_scale:    '',
  domain_desc:   '',
  use_yn:        'Y',
}

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

export default function DomainForm({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const isNumeric  = value.data_type === 'NUMBER'
  const hasLength  = ['VARCHAR', 'CHAR', 'NUMBER'].includes(value.data_type)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">도메인명</label>
          <input className="form-control" value={value.domain_nm} onChange={set('domain_nm')} placeholder="예: 이름, 금액, 일자" maxLength={100} />
        </div>

        <div className="form-group">
          <label className="form-label required">도메인 구분 코드</label>
          <input className="form-control" value={value.domain_div_cd} onChange={set('domain_div_cd')} placeholder="예: NM, AMT, DT" maxLength={50} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">정보 유형</label>
          <input className="form-control" value={value.info_type} onChange={set('info_type')} placeholder="예: 명칭, 코드, 금액" maxLength={50} />
        </div>

        <div className="form-group">
          <label className="form-label required">데이터 타입</label>
          <select className="form-control" value={value.data_type} onChange={set('data_type')}>
            {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        {hasLength && (
          <div className="form-group">
            <label className="form-label">데이터 길이</label>
            <input className="form-control" type="number" min="1" value={value.data_length} onChange={set('data_length')} placeholder="예: 100" />
          </div>
        )}

        {isNumeric && (
          <div className="form-group">
            <label className="form-label">소수점 자리</label>
            <input className="form-control" type="number" min="0" value={value.data_scale} onChange={set('data_scale')} placeholder="예: 2" />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">사용 여부</label>
          <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
            <option value="Y">Y (사용)</option>
            <option value="N">N (미사용)</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.domain_desc} onChange={set('domain_desc')} placeholder="도메인의 업무적 의미와 허용 값 범위를 기술하세요." rows={3} />
      </div>
    </>
  )
}

DomainForm.EMPTY = EMPTY
