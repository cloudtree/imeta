import { useState, useEffect, useMemo } from 'react'
import { subjectAreasApi } from '../api/subjectAreas'

/** 좌측 주제영역 네비용 옵션 로드 */
export function useSubjectAreaNav() {
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    subjectAreasApi.getAll({ use_yn: 'Y', limit: 500 })
      .then((res) => {
        if (cancelled) return
        setAreas(Array.isArray(res) ? res : (res.items ?? []))
      })
      .catch(() => {
        if (!cancelled) setAreas([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const navItems = useMemo(
    () => areas.map((s) => ({
      id: s.subject_id,
      label: s.subject_name || s.subject_id,
      count: undefined,
      raw: s,
    })),
    [areas],
  )

  return { areas, navItems, loading }
}
