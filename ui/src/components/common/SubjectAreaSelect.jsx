import { useState, useEffect } from 'react'
import { subjectAreasApi } from '../../api/subjectAreas'

export const DEFAULT_SUBJECT_ID = 'STD01'

export default function SubjectAreaSelect({ value, onChange }) {
  const [options, setOptions] = useState([])

  useEffect(() => {
    subjectAreasApi.getAll({ use_yn: 'Y', limit: 500 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.items ?? [])
        setOptions(list)

        const hasDefault = list.some((s) => s.subject_area_id === DEFAULT_SUBJECT_ID)
        // 값이 없거나, 목록에 존재하지 않는 값이면 기본값으로 자동 설정
        if (hasDefault && (!value || !list.some((s) => s.subject_area_id === value))) {
          onChange(DEFAULT_SUBJECT_ID)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 현재 값이 목록에 없으면 DEFAULT_SUBJECT_ID 로 표시
  const displayValue = options.length > 0 && !options.some((s) => s.subject_area_id === value)
    ? DEFAULT_SUBJECT_ID
    : (value ?? DEFAULT_SUBJECT_ID)

  return (
    <select
      className="form-control"
      value={displayValue}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((s) => (
        <option key={s.subject_area_id} value={s.subject_area_id}>
          {s.subject_area_id} – {s.subject_area_nm}
        </option>
      ))}
    </select>
  )
}
