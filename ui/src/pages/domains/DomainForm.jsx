import { useEffect } from 'react'
import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'
import { buildInfotype, LENGTH_TYPES } from '../../utils/domainInfotype'

const EMPTY = {
  std_domain_nm:   '',
  data_type_nm:   'VARCHAR',
  domain_group_nm:   '',
  data_len: '',
  std_domain_desc: '',
  use_yn:      'Y',
  subject_area_id:  DEFAULT_SUBJECT_ID,
  info_type_nm:    '',
}

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

export default function DomainForm({ value, onChange, groups = [] }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const hasLength = LENGTH_TYPES.includes(value.data_type_nm)
  const isScaleType = ['NUMBER', 'INTEGER'].includes(value.data_type_nm)

  useEffect(() => {
    const generated = buildInfotype(value.std_domain_nm, value.data_type_nm, value.data_len)
    if (value.info_type_nm !== generated) {
      onChange({ ...value, info_type_nm: generated })
    }
  }, [value.std_domain_nm, value.data_type_nm, value.data_len]) // eslint-disable-line

  return (
    <>
      <div className="form-group">
        <label className="form-label required">주제영역</label>
        <SubjectAreaSelect
          value={value.subject_area_id}
          onChange={(v) => onChange({ ...value, subject_area_id: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label required">도메인 그룹명</label>
        <select className="form-control" value={value.domain_group_nm} onChange={set('domain_group_nm')}>
          <option value="">— 선택하세요 —</option>
          {groups.filter((g) => g.use_yn === 'Y').map((g) => (
            <option key={g.domain_group_id} value={g.domain_group_nm}>{g.domain_group_nm}</option>
          ))}
          {value.domain_group_nm && !groups.some((g) => g.domain_group_nm === value.domain_group_nm) && (
            <option value={value.domain_group_nm}>{value.domain_group_nm}</option>
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
        <input className="form-control" value={value.std_domain_nm} onChange={set('std_domain_nm')} placeholder="예: 이름, 금액, 일자" maxLength={100} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">데이터 타입</label>
          <select className="form-control" value={value.data_type_nm} onChange={set('data_type_nm')}>
            {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {hasLength ? (
          <div className="form-group">
            <label className="form-label required">데이터 길이</label>
            <input
              className="form-control"
              value={value.data_len ?? ''}
              onChange={set('data_len')}
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
          value={value.info_type_nm ?? ''}
          readOnly
          placeholder="도메인명·타입·길이 입력 시 자동생성"
          style={{ fontFamily: 'monospace', fontWeight: 500, background: '#f3f4f6', cursor: 'default' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.std_domain_desc} onChange={set('std_domain_desc')} placeholder="도메인의 업무적 의미와 허용 값 범위를 기술하세요." rows={3} />
      </div>
    </>
  )
}

DomainForm.EMPTY = EMPTY
