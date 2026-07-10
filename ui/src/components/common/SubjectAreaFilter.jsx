import { useState, useEffect } from 'react'
import { subjectAreasApi } from '../../api/subjectAreas'

/** 목록 화면용 주제영역 필터 — 빈 값이면 전체 */
export default function SubjectAreaFilter({ value = '', onChange, style }) {
  const [options, setOptions] = useState([])

  useEffect(() => {
    subjectAreasApi.getAll({ use_yn: 'Y', limit: 500 })
      .then((res) => setOptions(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  return (
    <select
      className="form-control"
      style={{ width: '160px', height: '34px', fontSize: '12px', padding: '0 6px', ...style }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">전체 주제영역</option>
      {options.map((s) => (
        <option key={s.subject_area_id} value={s.subject_area_id}>
          {s.subject_area_id} – {s.subject_area_nm}
        </option>
      ))}
    </select>
  )
}
