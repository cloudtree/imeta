import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'

const EMPTY = {
  word_nm: '',
  abb_word_nm: '',
  all_word_nm: '',
  kor_synonym_nm: '',
  taxon_yn: 'N',
  word_desc: '',
  use_yn: 'Y',
  subject_id: DEFAULT_SUBJECT_ID,
}

export default function WordForm({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">단어명</label>
          <input className="form-control" value={value.word_nm} onChange={set('word_nm')} placeholder="예: 고객" maxLength={100} />
        </div>

        <div className="form-group">
          <label className="form-label required">영문약어</label>
          <input className="form-control" value={value.abb_word_nm} onChange={set('abb_word_nm')} placeholder="예: CUST" style={{ textTransform: 'uppercase' }} maxLength={100} />
          <span className="form-hint">대문자 권장</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">영문명 (전체)</label>
          <input className="form-control" value={value.all_word_nm} onChange={set('all_word_nm')} placeholder="예: Customer" maxLength={100} />
        </div>

        <div className="form-group">
          <label className="form-label required">한글 동의어</label>
          <input className="form-control" value={value.kor_synonym_nm} onChange={set('kor_synonym_nm')} placeholder="예: 거래처" maxLength={100} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">분류어 여부</label>
          <select className="form-control" value={value.taxon_yn} onChange={set('taxon_yn')}>
            <option value="Y">Y (분류어)</option>
            <option value="N">N (일반)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">사용 여부</label>
          <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
            <option value="Y">Y (사용)</option>
            <option value="N">N (미사용)</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">주제영역</label>
        <SubjectAreaSelect
          value={value.subject_id}
          onChange={(v) => onChange({ ...value, subject_id: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.word_desc} onChange={set('word_desc')} placeholder="단어의 업무적 의미를 기술하세요." rows={3} />
      </div>
    </>
  )
}

WordForm.EMPTY = EMPTY
