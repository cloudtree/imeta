const EMPTY = {
  subject_id:   '',
  subject_name: '',
  description:  '',
  use_yn:       'Y',
}

export default function SubjectAreaForm({ value, onChange, isEdit = false }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">주제영역 ID</label>
          <input
            className="form-control"
            value={value.subject_id}
            onChange={set('subject_id')}
            placeholder="예: SA001"
            maxLength={20}
          />
          {isEdit && (
            <span className="form-hint" style={{ color: '#e67e22' }}>
              ID 변경 시 연결된 단어·용어·도메인에 자동 반영됩니다.
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label required">주제영역명</label>
          <input
            className="form-control"
            value={value.subject_name}
            onChange={set('subject_name')}
            placeholder="예: 고객관리, 상품관리"
            maxLength={100}
          />
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
          value={value.description}
          onChange={set('description')}
          placeholder="주제영역에 대한 설명을 입력하세요."
          rows={3}
          maxLength={1000}
        />
      </div>
    </>
  )
}

SubjectAreaForm.EMPTY = EMPTY
