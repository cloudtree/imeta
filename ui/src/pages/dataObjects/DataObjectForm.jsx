import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'

const EMPTY = {
  data_object_cd: '',
  data_object_nm: '',
  physical_nm: '',
  object_type_nm: 'TABLE',
  subject_area_id: DEFAULT_SUBJECT_ID,
  owner_nm: '',
  data_object_desc: '',
  use_yn: 'Y',
}

export default function DataObjectForm({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">객체 코드</label>
          <input
            className="form-control"
            value={value.data_object_cd}
            onChange={set('data_object_cd')}
            placeholder="예: CUST_MST"
            maxLength={50}
          />
          <span className="form-hint">영문, 숫자, . _ - 만 사용</span>
        </div>

        <div className="form-group">
          <label className="form-label required">객체명</label>
          <input
            className="form-control"
            value={value.data_object_nm}
            onChange={set('data_object_nm')}
            placeholder="예: 고객마스터"
            maxLength={200}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">물리명</label>
          <input
            className="form-control"
            value={value.physical_nm}
            onChange={set('physical_nm')}
            placeholder="예: TB_CUST_MST"
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label className="form-label required">객체 유형</label>
          <select className="form-control" value={value.object_type_nm} onChange={set('object_type_nm')}>
            <option value="TABLE">TABLE</option>
            <option value="VIEW">VIEW</option>
            <option value="COLUMN">COLUMN</option>
            <option value="FILE">FILE</option>
            <option value="API">API</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">주제영역</label>
          <SubjectAreaSelect
            value={value.subject_area_id}
            onChange={(subject_area_id) => onChange({ ...value, subject_area_id })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">담당자</label>
          <input
            className="form-control"
            value={value.owner_nm}
            onChange={set('owner_nm')}
            placeholder="예: 홍길동"
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
          value={value.data_object_desc}
          onChange={set('data_object_desc')}
          placeholder="데이터 객체에 대한 설명"
          rows={3}
        />
      </div>
    </>
  )
}

DataObjectForm.EMPTY = EMPTY
