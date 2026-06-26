const EMPTY = {
  word_name: '',
  eng_name: '',
  eng_abbr: '',
  description: '',
  word_type: '주제어',
  is_entity_classifier: false,
  is_attr_classifier: false,
}

export default function WordForm({ value, onChange }) {
  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({ ...value, [field]: val })
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label required">단어명</label>
        <input className="form-control" value={value.word_name} onChange={set('word_name')} placeholder="예: 고객" maxLength={10} />
        <span className="form-hint">한글 10자 이내 권장</span>
      </div>

      <div className="form-group">
        <label className="form-label required">영문명</label>
        <input className="form-control" value={value.eng_name} onChange={set('eng_name')} placeholder="예: Customer" />
      </div>

      <div className="form-group">
        <label className="form-label required">영문약어</label>
        <input className="form-control" value={value.eng_abbr} onChange={set('eng_abbr')} placeholder="예: CUST" style={{ textTransform: 'uppercase' }} />
        <span className="form-hint">대문자로 정의</span>
      </div>

      <div className="form-group">
        <label className="form-label">단어구분</label>
        <select className="form-control" value={value.word_type} onChange={set('word_type')}>
          <option value="수식어">수식어</option>
          <option value="주제어">주제어</option>
          <option value="분류어">분류어</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.description} onChange={set('description')} placeholder="단어의 업무적 의미를 기술하세요." rows={3} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label className="form-check">
          <input type="checkbox" checked={value.is_entity_classifier} onChange={set('is_entity_classifier')} />
          엔터티 분류어 여부
        </label>
        <label className="form-check">
          <input type="checkbox" checked={value.is_attr_classifier} onChange={set('is_attr_classifier')} />
          속성 분류어 여부
        </label>
      </div>
    </>
  )
}

WordForm.EMPTY = EMPTY
