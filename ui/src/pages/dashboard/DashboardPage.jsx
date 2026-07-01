import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { subjectAreasApi } from '../../api/subjectAreas'
import { wordsApi } from '../../api/words'
import { termsApi } from '../../api/terms'
import { domainsApi } from '../../api/domains'

const COLORS = {
  word:   { fill: '#3b82f6', light: '#dbeafe', label: '단어' },
  term:   { fill: '#10b981', light: '#d1fae5', label: '용어' },
  domain: { fill: '#f59e0b', light: '#fef3c7', label: '도메인' },
}

function SummaryCard({ label, count, color, path }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        background: '#fff',
        border: `2px solid ${color.fill}`,
        borderRadius: '12px',
        padding: '24px 28px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'box-shadow 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 4px 16px ${color.fill}44`)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}
    >
      <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '36px', fontWeight: 700, color: color.fill, lineHeight: 1 }}>
        {count.toLocaleString()}
      </span>
      <span style={{ fontSize: '12px', color: '#9ca3af' }}>건 등록됨</span>
    </div>
  )
}

function DonutChart({ slices, size = 200 }) {
  const R  = size * 0.38
  const CX = size / 2
  const CY = size / 2
  const innerR = R * 0.45
  const active = slices.filter((s) => s.val > 0)
  const total = active.reduce((s, x) => s + x.val, 0)

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={CX} cy={CY} r={R} fill="#f3f4f6" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="11" fill="#9ca3af">데이터 없음</text>
      </svg>
    )
  }

  let cumAngle = -Math.PI / 2
  const computed = active.map((s) => {
    const angle = (s.val / total) * 2 * Math.PI
    const start = cumAngle
    cumAngle += angle
    const mid = (start + cumAngle) / 2
    const span = cumAngle - start
    const labelR = span >= 0.35 ? (innerR + R) / 2 : R * 1.12
    return {
      ...s,
      start,
      end: cumAngle,
      pct: Math.round((s.val / total) * 100),
      mid,
      labelX: CX + labelR * Math.cos(mid),
      labelY: CY + labelR * Math.sin(mid),
      showLabel: span >= 0.12,
    }
  })

  const arc = (start, end) => {
    const x1 = CX + R * Math.cos(start)
    const y1 = CY + R * Math.sin(start)
    const x2 = CX + R * Math.cos(end)
    const y2 = CY + R * Math.sin(end)
    const large = end - start > Math.PI ? 1 : 0
    return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {computed.map((sl, i) => (
        <g key={i}>
          <path
            d={arc(sl.start, sl.end)}
            fill={sl.color}
            stroke="#fff"
            strokeWidth="1.5"
            opacity="0.92"
          >
            <title>{sl.label}: {sl.val.toLocaleString()}건 ({sl.pct}%)</title>
          </path>
          {sl.showLabel && (
            <text
              x={sl.labelX}
              y={sl.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={sl.val >= 1000 ? 8 : 9}
              fill="#fff"
              fontWeight="700"
              style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
            >
              <tspan x={sl.labelX} dy="-0.55em">{sl.label}</tspan>
              <tspan x={sl.labelX} dy="1.15em" fontSize={sl.val >= 1000 ? 9 : 10}>
                {sl.val.toLocaleString()}
              </tspan>
            </text>
          )}
        </g>
      ))}
      <circle cx={CX} cy={CY} r={innerR} fill="white" />
      <text x={CX} y={CY - 5} textAnchor="middle" fontSize="10" fill="#6b7280">합계</text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
        {total.toLocaleString()}
      </text>
    </svg>
  )
}

function SubjectAreaChart({ subject }) {
  const name    = subject.subject_name || subject.subject_id
  const words   = Number(subject.word_count)   || 0
  const terms   = Number(subject.term_count)   || 0
  const domains = Number(subject.domain_count) || 0

  const slices = [
    { label: COLORS.word.label,   val: words,   color: COLORS.word.fill   },
    { label: COLORS.term.label,   val: terms,   color: COLORS.term.fill   },
    { label: COLORS.domain.label, val: domains, color: COLORS.domain.fill },
  ]

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '20px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
    }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' }}>{name}</p>
        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9ca3af' }}>{subject.subject_id}</p>
      </div>

      <DonutChart slices={slices} size={200} />
    </div>
  )
}

export default function DashboardPage() {
  const [subjects,     setSubjects]     = useState([])
  const [totalWords,   setTotalWords]   = useState(0)
  const [totalTerms,   setTotalTerms]   = useState(0)
  const [totalDomains, setTotalDomains] = useState(0)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.all([
      subjectAreasApi.getAll({ limit: 500 }),
      wordsApi.getAll({ limit: 1 }),
      termsApi.getAll({ limit: 1 }),
      domainsApi.getAll({ limit: 1 }),
    ]).then(([sa, w, t, d]) => {
      setSubjects(Array.isArray(sa) ? sa : (sa.items ?? []))
      setTotalWords(w.total ?? 0)
      setTotalTerms(t.total ?? 0)
      setTotalDomains(d.total ?? 0)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const subjectCharts = useMemo(
    () => [...subjects].sort((a, b) => (a.subject_id || '').localeCompare(b.subject_id || '')),
    [subjects],
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">메타데이터 현황</h1>
          <p className="page-subtitle">주제영역별 표준단어 · 용어 · 도메인 등록 현황을 확인합니다.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <SummaryCard label="표준단어"   count={totalWords}   color={COLORS.word}   path="/words"   />
        <SummaryCard label="표준용어"   count={totalTerms}   color={COLORS.term}   path="/terms"   />
        <SummaryCard label="표준도메인" count={totalDomains} color={COLORS.domain} path="/domains" />
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">주제영역별 단어 · 용어 · 도메인</span>
        </div>
        <div style={{ padding: '24px' }}>
          {subjectCharts.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: 0 }}>
              등록된 주제영역이 없습니다.
            </p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '20px',
            }}>
              {subjectCharts.map((s) => (
                <SubjectAreaChart key={s.subject_id} subject={s} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
