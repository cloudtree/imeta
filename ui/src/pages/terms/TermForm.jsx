import { useEffect, useState } from 'react'
import { domainsApi } from '../../api/domains'
import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'

const EMPTY = {
  logical_term:  '',
  physical_term: '',
  domain_div_cd: '',
  domain_id:     '',
  data_type:     'VARCHAR',
  data_len:      '',
  term_desc:     '',
  use_yn:        'Y',
  subject_id:    DEFAULT_SUBJECT_ID,
}

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

export default function TermForm({ value, onChange }) {
  const [domains, setDomains] = useState([])

  useEffect(() => {
    domainsApi.getAll({ limit: 500 })
      .then((res) => setDomains(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">논리명</label>
          <input className="form-control" value={value.logical_term} onChange={set('logical_term')} placeholder="예: 고객번호" maxLength={200} />
        </div>

        <div className="form-group">
          <label className="form-label required">물리명</label>
          <input className="form-control" value={value.physical_term} onChange={set('physical_term')} placeholder="예: CUST_NO" style={{ textTransform: 'uppercase' }} maxLength={200} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">도메인 구분 코드</label>
          <input className="form-control" value={value.domain_div_cd} onChange={set('domain_div_cd')} placeholder="예: 번호, 금액, 일자" maxLength={200} />
        </div>

        <div className="form-group">
          <label className="form-label">도메인</label>
          <select className="form-control" value={value.domain_id ?? ''} onChange={set('domain_id')}>
            <option value="">- 선택 안 함 -</option>
            {domains.map((d) => (
              <option key={d.domain_id} value={d.domain_id}>{d.domain_nm}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">데이터 타입</label>
          <select className="form-control" value={value.data_type} onChange={set('data_type')}>
            {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label required">데이터 길이</label>
          <input className="form-control" value={value.data_len} onChange={set('data_len')} placeholder="예: 20" maxLength={50} />
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
        <textarea className="form-control" value={value.term_desc} onChange={set('term_desc')} placeholder="용어의 업무적 의미를 기술하세요." rows={3} />
      </div>
    </>
  )
}

TermForm.EMPTY = EMPTY
