import { useState, useEffect, useMemo } from 'react'
import { subjectAreasApi } from '../api/subjectAreas'
import { metaSystemsApi } from '../api/metaSystems'

export const SYS_NAV_PREFIX = 'sys:'

export function systemNavId(systemId) {
  return `${SYS_NAV_PREFIX}${systemId}`
}

/** 네비 선택값 → API 필터 파라미터 */
export function parseSubjectNavFilter(filter) {
  if (!filter) return {}
  if (String(filter) === `${SYS_NAV_PREFIX}none`) {
    return { unassigned: 'Y' }
  }
  if (String(filter).startsWith(SYS_NAV_PREFIX)) {
    return { system_id: String(filter).slice(SYS_NAV_PREFIX.length) }
  }
  return { subject_area_id: filter }
}

/** 좌측 주제영역 네비용 옵션 로드 (시스템 > 주제영역 트리) */
export function useSubjectAreaNav() {
  const [areas, setAreas] = useState([])
  const [systems, setSystems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      subjectAreasApi.getAll({ use_yn: 'Y', limit: 500 }),
      metaSystemsApi.getAll({ use_yn: 'Y' }),
    ])
      .then(([areaRes, sysRes]) => {
        if (cancelled) return
        setAreas(Array.isArray(areaRes) ? areaRes : (areaRes.items ?? []))
        setSystems(Array.isArray(sysRes) ? sysRes : (sysRes.items ?? []))
      })
      .catch(() => {
        if (!cancelled) {
          setAreas([])
          setSystems([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  /** 시스템 부모 + 주제영역 children 트리 */
  const navItems = useMemo(() => {
    const bySystem = new Map()
    for (const s of areas) {
      if (s.system_id == null) continue
      const key = String(s.system_id)
      if (!bySystem.has(key)) bySystem.set(key, [])
      bySystem.get(key).push(s)
    }

    const items = systems.map((sys) => {
      const children = (bySystem.get(String(sys.system_id)) || [])
        .slice()
        .sort((a, b) => String(a.subject_area_nm || a.subject_area_id)
          .localeCompare(String(b.subject_area_nm || b.subject_area_id), 'ko'))
        .map((sa) => ({
          id: sa.subject_area_id,
          label: sa.subject_area_nm || sa.subject_area_id,
          raw: sa,
        }))
      return {
        id: systemNavId(sys.system_id),
        label: sys.system_nm,
        count: children.length,
        children,
        raw: sys,
      }
    })

    const orphan = areas.filter((s) => s.system_id == null)
    if (orphan.length) {
      items.push({
        id: `${SYS_NAV_PREFIX}none`,
        label: '미지정',
        count: orphan.length,
        children: orphan.map((sa) => ({
          id: sa.subject_area_id,
          label: sa.subject_area_nm || sa.subject_area_id,
          raw: sa,
        })),
      })
    }

    return items
  }, [areas, systems])

  /** 시스템별로 묶은 네비 섹션용 (레거시) */
  const navBySystem = useMemo(() => {
    const groups = new Map()
    for (const s of areas) {
      const key = s.system_nm || '미지정'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push({
        id: s.subject_area_id,
        label: s.subject_area_nm || s.subject_area_id,
        raw: s,
      })
    }
    return [...groups.entries()].map(([system_nm, items]) => ({
      system_nm,
      items,
    }))
  }, [areas])

  return { areas, systems, navItems, navBySystem, loading }
}
