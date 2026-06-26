const EMPTY = {
  domain_name: '',
  data_type: 'VARCHAR',
  length: '',
  precision: '',
  description: '',
}

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

export default function DomainForm({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const isNumeric = value.data_type === 'NUMBER'
  const hasLength = ['VARCHAR', 'CHAR', 'NUMBER'].includes(value.data_type)

  return (
    <>
      <div className="form-group">
        <label className="form-label required">도메인명</label>
        <input className="form-control" value={value.domain_name} onChange={set('domain_name')} placeholder="예: 이름, 금액, 일자" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">데이터 타입</label>
          <select className="form-control" value={value.data_type} onChange={set('data_type')}>
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {hasLength && (
          <div className="form-group">
            <label className="form-label">길이</label>
            <input className="form-control" type="number" min="1" value={value.length} onChange={set('length')} placeholder="예: 100" />
          </div>
        )}

        {isNumeric && (
          <div className="form-group">
            <label className="form-label">소수점 자리</label>
            <input className="form-control" type="number" min="0" value={value.precision} onChange={set('precision')} placeholder="예: 2" />
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.description} onChange={set('description')} placeholder="도메인의 업무적 의미와 허용 값 범위를 기술하세요." rows={3} />
      </div>
    </>
  )
}

DomainForm.EMPTY = EMPTY
