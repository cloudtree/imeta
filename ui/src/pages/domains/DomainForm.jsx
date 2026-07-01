import { useEffect } from 'react'
import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'
import { buildInfotype, LENGTH_TYPES } from '../../utils/domainInfotype'

const EMPTY = {
  domain_nm:   '',
  data_type:   'VARCHAR',
  info_type:   '',
  data_length: '',
  domain_desc: '',
  use_yn:      'Y',
  subject_id:  DEFAULT_SUBJECT_ID,
  infotype:    '',
}

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

export default function DomainForm({ value, onChange, groups = [] }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const hasLength = LENGTH_TYPES.includes(value.data_type)
  const isScaleType = ['NUMBER', 'INTEGER'].includes(value.data_type)

  useEffect(() => {
    const generated = buildInfotype(value.domain_nm, value.data_type, value.data_length)
    if (value.infotype !== generated) {
      onChange({ ...value, infotype: generated })
    }
  }, [value.domain_nm, value.data_type, value.data_length]) // eslint-disable-line

  return (
    <>
      <div className="form-group">
        <label className="form-label required">주제영역</label>
        <SubjectAreaSelect
          value={value.subject_id}
          onChange={(v) => onChange({ ...value, subject_id: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label required">도메인 그룹명</label>
        <select className="form-control" value={value.info_type} onChange={set('info_type')}>
          <option value="">— 선택하세요 —</option>
          {groups.filter((g) => g.use_yn === 'Y').map((g) => (
            <option key={g.group_id} value={g.group_nm}>{g.group_nm}</option>
          ))}
          {value.info_type && !groups.some((g) => g.group_nm === value.info_type) && (
            <option value={value.info_type}>{value.info_type}</option>
          )}
        </select>
        {groups.length === 0 && (
          <span className="form-hint" style={{ color: '#f59e0b' }}>
            등록된 도메인 그룹이 없습니다. 먼저 "도메인 그룹 관리"에서 그룹을 등록하세요.
          </span>
        )}
      </div>

      <div className="form-group">
        <label className="form-label required">도메인명</label>
        <input className="form-control" value={value.domain_nm} onChange={set('domain_nm')} placeholder="예: 이름, 금액, 일자" maxLength={100} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">데이터 타입</label>
          <select className="form-control" value={value.data_type} onChange={set('data_type')}>
            {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {hasLength ? (
          <div className="form-group">
            <label className="form-label required">데이터 길이</label>
            <input
              className="form-control"
              value={value.data_length ?? ''}
              onChange={set('data_length')}
              placeholder={isScaleType ? '예: 7,2' : '예: 100'}
              maxLength={100}
            />
            {isScaleType && (
              <span className="form-hint">NUMBER/INTEGER — "길이,소숫점" 형식 (예: 7,2)</span>
            )}
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">사용 여부</label>
            <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
              <option value="Y">Y (사용)</option>
              <option value="N">N (미사용)</option>
            </select>
          </div>
        )}
      </div>

      {hasLength && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">사용 여부</label>
            <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
              <option value="Y">Y (사용)</option>
              <option value="N">N (미사용)</option>
            </select>
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">인포타입
          <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>(자동생성)</span>
        </label>
        <input
          className="form-control"
          value={value.infotype ?? ''}
          readOnly
          placeholder="도메인명·타입·길이 입력 시 자동생성"
          style={{ fontFamily: 'monospace', fontWeight: 500, background: '#f3f4f6', cursor: 'default' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.domain_desc} onChange={set('domain_desc')} placeholder="도메인의 업무적 의미와 허용 값 범위를 기술하세요." rows={3} />
      </div>
    </>
  )
}

DomainForm.EMPTY = EMPTY
