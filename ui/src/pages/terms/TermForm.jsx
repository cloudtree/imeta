const EMPTY = {
  term_name: '',
  eng_name: '',
  eng_abbr: '',
  description: '',
}

export default function TermForm({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <div className="form-group">
        <label className="form-label required">용어명</label>
        <input className="form-control" value={value.term_name} onChange={set('term_name')} placeholder="예: 고객번호" />
        <span className="form-hint">표준 단어를 조합하여 구성된 용어명</span>
      </div>

      <div className="form-group">
        <label className="form-label required">영문명</label>
        <input className="form-control" value={value.eng_name} onChange={set('eng_name')} placeholder="예: Customer Number" />
      </div>

      <div className="form-group">
        <label className="form-label required">영문약어</label>
        <input className="form-control" value={value.eng_abbr} onChange={set('eng_abbr')} placeholder="예: CUST_NO" style={{ textTransform: 'uppercase' }} />
        <span className="form-hint">구성 단어의 약어를 조합하여 정의 (예: CUST_NO)</span>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.description} onChange={set('description')} placeholder="용어의 업무적 의미를 기술하세요." rows={3} />
      </div>
    </>
  )
}

TermForm.EMPTY = EMPTY
