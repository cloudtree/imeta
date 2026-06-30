import { useState, useEffect } from 'react'
import { subjectAreasApi } from '../../api/subjectAreas'

export const DEFAULT_SUBJECT_ID = 'DEFAULT'

export default function SubjectAreaSelect({ value, onChange }) {
  const [options, setOptions] = useState([])

  useEffect(() => {
    subjectAreasApi.getAll({ use_yn: 'Y', limit: 500 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.items ?? [])
        setOptions(list)
        // 아직 값이 없을 때 기본값 자동 선택
        if (!value && list.some((s) => s.subject_id === DEFAULT_SUBJECT_ID)) {
          onChange(DEFAULT_SUBJECT_ID)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <select
      className="form-control"
      value={value ?? DEFAULT_SUBJECT_ID}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">- 선택 안 함 -</option>
      {options.map((s) => (
        <option key={s.subject_id} value={s.subject_id}>
          {s.subject_id} – {s.subject_name}
        </option>
      ))}
    </select>
  )
}
