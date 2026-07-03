import { useState, useEffect, useRef } from 'react'
import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'
import { wordsApi } from '../../api/words'

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
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState(null)
  const lookupSeq = useRef(0)
  const valueRef = useRef(value)
  valueRef.current = value

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  // 단어명 입력 시 네이버 사전 → 영문명·영문약어·설명 자동 입력
  useEffect(() => {
    const word = value.word_nm?.trim()
    if (!word) {
      setLookupError(null)
      return undefined
    }

    const seq = ++lookupSeq.current
    const timer = setTimeout(async () => {
      setLoading(true)
      setLookupError(null)
      try {
        const [enResult, descResult] = await Promise.allSettled([
          wordsApi.lookupEn(word),
          wordsApi.lookupDesc(word),
        ])

        if (seq !== lookupSeq.current) return

        const patch = { ...valueRef.current }
        const errors = []

        if (enResult.status === 'fulfilled') {
          patch.all_word_nm = enResult.value.all_word_nm
          patch.abb_word_nm = enResult.value.abb_word_nm
        } else {
          errors.push(enResult.reason?.message ?? '영문명 조회 실패')
        }

        if (descResult.status === 'fulfilled') {
          patch.word_desc = descResult.value.definition
        } else {
          errors.push(descResult.reason?.message ?? '설명 조회 실패')
        }

        onChange(patch)
        setLookupError(errors.length === 2 ? errors.join(' / ') : errors[0] ?? null)
      } finally {
        if (seq === lookupSeq.current) setLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [value.word_nm]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="form-group">
        <label className="form-label required">주제영역</label>
        <SubjectAreaSelect
          value={value.subject_id}
          onChange={(v) => onChange({ ...value, subject_id: v })}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">
            단어명
            {loading && <span className="spinner" style={{ marginLeft: 8, width: 14, height: 14 }} />}
          </label>
          <input className="form-control" value={value.word_nm} onChange={set('word_nm')} placeholder="예: 고객" maxLength={15} />
          {lookupError && (
            <span className="form-hint" style={{ color: '#ef4444' }}>{lookupError}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label required">영문명 (전체)</label>
          <input className="form-control" value={value.all_word_nm} onChange={set('all_word_nm')} placeholder="예: Customer" maxLength={100} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">영문약어</label>
          <input className="form-control" value={value.abb_word_nm} onChange={set('abb_word_nm')} placeholder="예: CUST" style={{ textTransform: 'uppercase' }} maxLength={10} />
          <span className="form-hint">기본 4자리(모음제거), 표준약어·복합어·의미 구분 필요 시 예외 길이 허용</span>
        </div>

        <div className="form-group">
          <label className="form-label">한글 동의어</label>
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
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.word_desc} onChange={set('word_desc')} placeholder="단어명 입력 시 네이버 국어사전 뜻풀이가 자동 입력됩니다." rows={3} />
      </div>
    </>
  )
}

WordForm.EMPTY = EMPTY
