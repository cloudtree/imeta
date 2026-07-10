import { useEffect, useState } from 'react'
import { metaSystemsApi } from '../../api/metaSystems'

const EMPTY = {
  subject_area_id: '',
  subject_area_nm: '',
  system_id: '',
  system_nm: '',
  subject_area_desc: '',
  use_yn: 'Y',
}

export default function SubjectAreaForm({ value, onChange, isEdit = false }) {
  const [systems, setSystems] = useState([])
  const [systemsError, setSystemsError] = useState(null)

  useEffect(() => {
    metaSystemsApi.getAll()
      .then((res) => {
        setSystems(Array.isArray(res) ? res : (res.items ?? []))
        setSystemsError(null)
      })
      .catch((e) => {
        setSystems([])
        setSystemsError(e.message || '시스템 목록을 불러오지 못했습니다.')
      })
  }, [])

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const onSystemSelect = (e) => {
    const id = e.target.value
    if (!id) {
      onChange({ ...value, system_id: '', system_nm: '' })
      return
    }
    const sys = systems.find((s) => String(s.system_id) === String(id))
    onChange({
      ...value,
      system_id: id,
      system_nm: sys?.system_nm || '',
    })
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label required">시스템</label>
        <select
          className="form-control"
          value={value.system_id || ''}
          onChange={onSystemSelect}
        >
          <option value="">시스템 선택</option>
          {systems.map((s) => (
            <option key={s.system_id} value={s.system_id}>
              {s.system_cd} – {s.system_nm}
            </option>
          ))}
        </select>
        {systemsError && <span className="form-hint" style={{ color: '#e74c3c' }}>{systemsError}</span>}
        {!systemsError && systems.length === 0 && (
          <span className="form-hint">
            등록된 시스템이 없습니다. 상단의 &quot;시스템 등록&quot;으로 먼저 추가하세요.
          </span>
        )}
        {!systemsError && systems.length > 0 && (
          <span className="form-hint">하나의 시스템 아래에 여러 주제영역을 둘 수 있습니다.</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">주제영역 ID</label>
          <input
            className="form-control"
            value={value.subject_area_id}
            onChange={set('subject_area_id')}
            placeholder="예: SA001"
            maxLength={20}
          />
          {isEdit && (
            <span className="form-hint" style={{ color: '#e67e22' }}>
              ID 변경 시 하위 데이터(단어·용어·도메인) 전체 변경 여부를 확인합니다.
            </span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label required">주제영역명</label>
          <input
            className="form-control"
            value={value.subject_area_nm}
            onChange={set('subject_area_nm')}
            placeholder="예: 고객관리, 상품관리"
            maxLength={100}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">사용 여부</label>
        <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
          <option value="Y">사용</option>
          <option value="N">미사용</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea
          className="form-control"
          value={value.subject_area_desc || ''}
          onChange={set('subject_area_desc')}
          rows={3}
          placeholder="주제영역 설명"
        />
      </div>
    </>
  )
}

SubjectAreaForm.EMPTY = EMPTY
