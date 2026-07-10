import { useEffect, useMemo, useRef, useState } from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import { Link, useNavigate } from 'react-router-dom'
import '../../components/charts/chartSetup'
import { activityApi } from '../../api/activity'
import { dbServersApi } from '../../api/dbServers'
import { domainsApi } from '../../api/domains'
import { subjectAreasApi } from '../../api/subjectAreas'
import { tableDefinitionsApi } from '../../api/tableDefinitions'
import { termsApi } from '../../api/terms'
import { wordsApi } from '../../api/words'
import {
  classifyStandardReviewErrors,
  reviewSelectedDefinitions,
  summarizeStandardReviewGroups,
} from '../database/standardReviewUtils'

const TYPE_META = {
  word: { label: '단어', tone: 'blue' },
  term: { label: '용어', tone: 'green' },
  domain: { label: '도메인', tone: 'orange' },
  table: { label: '정의서', tone: 'gray' },
  subject: { label: '주제영역', tone: 'gray' },
}

const ERROR_CATEGORY_META = {
  엔티티명: { color: '#ff3b30', short: '엔티티', desc: '엔티티명 표준 위반' },
  테이블명: { color: '#ff6b00', short: '테이블', desc: '테이블명 표준 위반' },
  표준단어: { color: '#ff9f0a', short: '단어', desc: '표준 단어 미매칭' },
  표준용어: { color: '#af52de', short: '용어', desc: '표준 용어 미매칭' },
  표준도메인: { color: '#5856d6', short: '도메인', desc: '표준 도메인 미매칭' },
  기타: { color: '#8e8e93', short: '기타', desc: '기타 표준 오류' },
}

function formatRelativeTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return date.toLocaleDateString('ko-KR')
}

function HealthErrorDashboard({ health }) {
  const navigate = useNavigate()
  const [activeKey, setActiveKey] = useState(null)
  const chartRef = useRef(null)

  const items = useMemo(() => {
    const categories = health.errorCategories || []
    return categories.map((item) => {
      const meta = ERROR_CATEGORY_META[item.category] || ERROR_CATEGORY_META['기타']
      return {
        key: item.category,
        label: meta.short,
        fullLabel: item.category,
        color: meta.color,
        desc: meta.desc,
        count: item.count,
      }
    })
  }, [health.errorCategories])

  const scoredItems = items.filter((item) => item.count > 0)
  const chartItems = scoredItems.length > 0 ? scoredItems : items
  const totalErrors = health.totalErrors ?? chartItems.reduce((sum, item) => sum + item.count, 0)
  const active =
    chartItems.find((item) => item.key === activeKey) ||
    scoredItems[0] ||
    chartItems[0]
  const activeShare = totalErrors > 0 && active ? Math.round((active.count / totalErrors) * 100) : 0
  const animatedValue = useCountUp(active?.count ?? 0, 700)
  const scoreTone =
    health.score == null ? '#8e8e93' : health.score >= 80 ? '#34c759' : health.score >= 50 ? '#ff9f0a' : '#ff3b30'

  const chartData = useMemo(
    () => ({
      labels: chartItems.map((item) => item.label),
      datasets: [
        {
          data: chartItems.map((item) => item.count),
          backgroundColor: chartItems.map((item) =>
            item.key === active?.key ? item.color : `${item.color}99`,
          ),
          hoverBackgroundColor: chartItems.map((item) => item.color),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 28,
        },
      ],
    }),
    [chartItems, active?.key],
  )

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          titleFont: { size: 11, weight: '600' },
          bodyFont: { size: 12, weight: '700' },
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: (ctx) => chartItems[ctx[0]?.dataIndex]?.fullLabel || '',
            label: (ctx) => `${Number(ctx.raw).toLocaleString()}건`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#86868b', font: { size: 10, weight: '500' } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#aeaeb2',
            font: { size: 10 },
            precision: 0,
          },
          border: { display: false },
        },
      },
      onClick: (_event, elements) => {
        if (!elements.length) return
        const item = chartItems[elements[0].index]
        if (item) setActiveKey(item.key)
      },
      onHover: (event, elements) => {
        const target = event.native?.target
        if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
      },
    }),
    [chartItems],
  )

  if (!active) {
    return (
      <div className="health-dash">
        <div className="health-dash__summary">
          <div className="health-dash__score-block">
            <span className="health-dash__score" style={{ color: scoreTone }}>—</span>
            <span className="health-dash__score-label">준수율</span>
          </div>
          <p className="health-dash__empty">검토할 정의서가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="health-dash">
      <div className="health-dash__summary">
        <div className="health-dash__score-block">
          <span className="health-dash__score" style={{ color: scoreTone }}>
            {Number.isFinite(health.score) ? health.score : '—'}
            {Number.isFinite(health.score) ? <small>%</small> : null}
          </span>
          <span className="health-dash__score-label">준수율</span>
        </div>
        <ul className="health-dash__stats">
          <li><span className="dot dot--ok" />정상 {health.ok.toLocaleString()}</li>
          <li><span className="dot dot--warn" />주의 {health.warning.toLocaleString()}</li>
          <li><span className="dot dot--err" />오류 {health.error.toLocaleString()}</li>
        </ul>
      </div>

      <ul className="chart-legend" aria-label="오류 분류 범례">
        {chartItems.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`chart-legend__item${item.key === active.key ? ' is-active' : ''}`}
              onClick={() => setActiveKey(item.key)}
            >
              <i style={{ background: item.color }} />
              <span>{item.fullLabel}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="health-dash__chartjs">
        <Bar ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      <div
        key={active.key}
        className="health-dash__detail"
        style={{ '--accent': active.color }}
      >
        <div className="health-dash__detail-top">
          <span
            className="health-dash__pill"
            style={{ background: `${active.color}22`, color: active.color }}
          >
            {active.fullLabel}
          </span>
          <span className="health-dash__share">{activeShare}%</span>
        </div>
        <p className="health-dash__detail-value">
          {animatedValue.toLocaleString()}
          <span>건</span>
        </p>
        <p className="health-dash__detail-desc">
          {totalErrors === 0 ? '오류가 없습니다.' : active.desc}
        </p>
        <div className="health-dash__detail-actions">
          <button
            type="button"
            className="health-dash__go"
            onClick={() => navigate('/database/table-definition-review')}
          >
            정의서 검토
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const CATALOG_ITEMS = [
  {
    key: 'servers',
    label: '시스템',
    color: '#0071e3',
    to: '/servers/register',
    desc: '등록된 DB 서버 연결',
    hint: '서버 등록·연결 상태를 관리합니다.',
  },
  {
    key: 'tables',
    label: '테이블',
    color: '#5856d6',
    to: '/database/table-definition-review',
    desc: '테이블 정의서 기준 테이블',
    hint: '정의서에 등록된 테이블 수입니다.',
  },
  {
    key: 'columns',
    label: '컬럼',
    color: '#af52de',
    to: '/database/table-definition-review',
    desc: '테이블 정의서 컬럼',
    hint: '정의서에 등록된 컬럼(속성) 수입니다.',
  },
  {
    key: 'words',
    label: '표준 단어',
    color: '#34c759',
    to: '/words',
    desc: '데이터 사전 단어',
    hint: '조직 공통 어휘 표준입니다.',
  },
  {
    key: 'terms',
    label: '표준 용어',
    color: '#ff9f0a',
    to: '/terms',
    desc: '업무 용어 표준',
    hint: '논리·물리 용어 매핑을 관리합니다.',
  },
  {
    key: 'domains',
    label: '표준 도메인',
    color: '#ff375f',
    to: '/domains',
    desc: '데이터 타입·규칙',
    hint: '도메인과 인포타입을 관리합니다.',
  },
]

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame = 0
    const start = performance.now()
    const from = 0
    const to = Number(target) || 0

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(from + (to - from) * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return value
}

const SUBJECT_METRIC_META = [
  { key: 'words', label: '표준 단어', short: '단어', to: '/words' },
  { key: 'terms', label: '표준 용어', short: '용어', to: '/terms' },
  { key: 'domains', label: '표준 도메인', short: '도메인', to: '/domains' },
]

const DONUT_TONES = ['#0071e3', '#5ac8fa', '#91b4d5']
const DONUT_ACCENT = '#30d158'

function SubjectStandardsDashboard({ subjects }) {
  const navigate = useNavigate()
  const chartRef = useRef(null)
  const [activeId, setActiveId] = useState(null)
  const [activeMetric, setActiveMetric] = useState('words')

  const rows = useMemo(
    () =>
      (subjects || [])
        .map((item) => ({
          id: item.subject_id,
          name: item.subject_name || item.subject_id,
          words: Number(item.word_count) || 0,
          terms: Number(item.term_count) || 0,
          domains: Number(item.domain_count) || 0,
        }))
        .map((item) => ({
          ...item,
          total: item.words + item.terms + item.domains,
        }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ko')),
    [subjects],
  )

  const active = rows.find((row) => row.id === activeId) || rows[0]
  const metrics = useMemo(() => {
    if (!active) return SUBJECT_METRIC_META.map((m) => ({ ...m, value: 0 }))
    return SUBJECT_METRIC_META.map((m, index) => ({
      ...m,
      value: active[m.key] || 0,
      tone: DONUT_TONES[index % DONUT_TONES.length],
    }))
  }, [active])

  const total = metrics.reduce((sum, m) => sum + m.value, 0)
  const focusIndex = Math.max(0, metrics.findIndex((m) => m.key === activeMetric))
  const selected = metrics[focusIndex] || metrics[0]
  const animatedTotal = useCountUp(total, 700)
  const selectedShare = total > 0 ? Math.round(((selected?.value || 0) / total) * 100) : 0

  useEffect(() => {
    if (!active) return
    const first = metrics.find((m) => m.value > 0) || metrics[0]
    if (first) setActiveMetric(first.key)
  }, [active?.id])

  const chartData = useMemo(
    () => ({
      labels: metrics.map((m) => m.label),
      datasets: [
        {
          data: metrics.map((m) => m.value),
          backgroundColor: metrics.map((m, i) =>
            i === focusIndex ? DONUT_ACCENT : m.tone,
          ),
          hoverBackgroundColor: DONUT_ACCENT,
          borderWidth: 0,
          borderRadius: 8,
          spacing: 4,
          hoverOffset: 10,
        },
      ],
    }),
    [metrics, focusIndex],
  )

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      animation: { duration: 700, easing: 'easeOutQuart' },
      layout: { padding: 8 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          titleFont: { size: 11, weight: '500' },
          bodyFont: { size: 12, weight: '700' },
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => {
              const value = Number(ctx.raw) || 0
              const share = total > 0 ? Math.round((value / total) * 100) : 0
              return `${value.toLocaleString()}건 · ${share}%`
            },
          },
        },
      },
      onClick: (_event, elements) => {
        if (!elements.length) return
        const metric = metrics[elements[0].index]
        if (metric) setActiveMetric(metric.key)
      },
      onHover: (event, elements) => {
        const target = event.native?.target
        if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
      },
    }),
    [metrics, total],
  )

  if (rows.length === 0) {
    return <p className="bento-empty">등록된 주제영역이 없습니다.</p>
  }

  return (
    <div className="subject-dash">
      <div className="subject-dash__chips" role="list">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            role="listitem"
            className={`subject-dash__chip${active?.id === row.id ? ' is-active' : ''}`}
            onClick={() => setActiveId(row.id)}
            aria-pressed={active?.id === row.id}
          >
            {row.name}
          </button>
        ))}
      </div>

      <div className="subject-dash__body">
        <div className="subject-dash__donut-stage">
          <div className="subject-dash__chartjs">
            <Doughnut ref={chartRef} data={chartData} options={chartOptions} />
          </div>

          <div className="subject-dash__donut-center" aria-hidden>
            <span className="subject-dash__center-value">{animatedTotal.toLocaleString()}</span>
            <span className="subject-dash__center-label">표준 합계</span>
            {selected ? (
              <span className="subject-dash__center-sub">
                {selected.short} {selectedShare}%
              </span>
            ) : null}
          </div>
        </div>

        <div key={active.id} className="subject-dash__detail">
          <p className="subject-dash__detail-id">{active.id}</p>
          <h3 className="subject-dash__detail-name">{active.name}</h3>
          <ul className="subject-dash__mini-legend">
            {metrics.map((metric, index) => {
              const share = total > 0 ? Math.round((metric.value / total) * 100) : 0
              const isFocus = index === focusIndex
              return (
                <li key={metric.key}>
                  <button
                    type="button"
                    className={`subject-dash__mini-legend-btn${isFocus ? ' is-active' : ''}`}
                    onClick={() => setActiveMetric(metric.key)}
                  >
                    <i style={{ background: isFocus ? DONUT_ACCENT : metric.tone }} />
                    <span>{metric.short}</span>
                    <strong>{metric.value.toLocaleString()}</strong>
                    <em>{share}%</em>
                  </button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            className="subject-dash__go"
            onClick={() => navigate(selected?.to || '/subject-areas')}
          >
            {selected?.label || '주제영역'} 보기
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function CatalogDashboard({ catalog }) {
  const navigate = useNavigate()
  const chartRef = useRef(null)
  const [activeKey, setActiveKey] = useState('tables')

  const items = useMemo(
    () =>
      CATALOG_ITEMS.map((item) => ({
        ...item,
        value: Number(catalog[item.key]) || 0,
      })),
    [catalog],
  )

  const total = items.reduce((sum, item) => sum + item.value, 0)
  const active = items.find((item) => item.key === activeKey) || items[0]
  const activeShare = total > 0 ? Math.round((active.value / total) * 100) : 0
  const animatedValue = useCountUp(active.value, 700)

  const chartData = useMemo(
    () => ({
      labels: items.map((item) => item.label),
      datasets: [
        {
          data: items.map((item) => item.value),
          backgroundColor: items.map((item) =>
            item.key === activeKey ? item.color : `${item.color}88`,
          ),
          hoverBackgroundColor: items.map((item) => item.color),
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 32,
        },
      ],
    }),
    [items, activeKey],
  )

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          titleFont: { size: 11, weight: '600' },
          bodyFont: { size: 12, weight: '700' },
          padding: 10,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${Number(ctx.raw).toLocaleString()}건`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#86868b', font: { size: 10, weight: '500' } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: {
            color: '#aeaeb2',
            font: { size: 10 },
            precision: 0,
            callback: (value) => Number(value).toLocaleString(),
          },
          border: { display: false },
        },
      },
      onClick: (_event, elements) => {
        if (!elements.length) return
        const item = items[elements[0].index]
        if (item) setActiveKey(item.key)
      },
      onHover: (event, elements) => {
        const target = event.native?.target
        if (target) target.style.cursor = elements.length ? 'pointer' : 'default'
      },
    }),
    [items],
  )

  return (
    <div className="catalog-dash">
      <ul className="chart-legend" aria-label="카탈로그 범례">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`chart-legend__item${item.key === activeKey ? ' is-active' : ''}`}
              onClick={() => setActiveKey(item.key)}
            >
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="catalog-dash__chartjs">
        <Bar ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      <div
        key={active.key}
        className="catalog-dash__detail"
        style={{ '--accent': active.color }}
      >
        <div className="catalog-dash__detail-top">
          <span className="catalog-dash__pill" style={{ background: `${active.color}22`, color: active.color }}>
            {active.label}
          </span>
          <span className="catalog-dash__share">{activeShare}%</span>
        </div>
        <p className="catalog-dash__detail-value">{animatedValue.toLocaleString()}</p>
        <p className="catalog-dash__detail-desc">{active.desc}</p>
        <p className="catalog-dash__detail-hint">{active.hint}</p>
        <div className="catalog-dash__detail-actions">
          <button
            type="button"
            className="catalog-dash__go"
            onClick={() => navigate(active.to)}
          >
            자세히 보기
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState({
    words: 0,
    terms: 0,
    domains: 0,
    servers: 0,
    tables: 0,
    columns: 0,
  })
  const [health, setHealth] = useState({
    score: null,
    total: 0,
    ok: 0,
    warning: 0,
    error: 0,
    totalErrors: 0,
    errorCategories: [],
  })
  const [activity, setActivity] = useState([])
  const [subjects, setSubjects] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const [
          wordsRes,
          termsRes,
          domainsRes,
          serversRes,
          tablesRes,
          defsRes,
          dictRes,
          termsDict,
          domainsDict,
          recentRes,
          subjectsRes,
        ] = await Promise.all([
          wordsApi.getAll({ limit: 1 }),
          termsApi.getAll({ limit: 1 }),
          domainsApi.getAll({ limit: 1 }),
          dbServersApi.getAll({ limit: 1 }),
          tableDefinitionsApi.getTables({ use_yn: 'Y' }),
          tableDefinitionsApi.getAll({ limit: 5000, use_yn: 'Y' }),
          wordsApi.dictionary(),
          termsApi.getAll({ limit: 10000, use_yn: 'Y' }),
          domainsApi.getAll({ limit: 10000, use_yn: 'Y' }),
          activityApi.getRecent({ limit: 10 }),
          subjectAreasApi.getAll({ limit: 200, use_yn: 'Y' }),
        ])

        if (cancelled) return

        const tableItems = Array.isArray(tablesRes) ? tablesRes : (tablesRes.items ?? [])
        const defItems = Array.isArray(defsRes) ? defsRes : (defsRes.items ?? [])
        const wordsDict = Array.isArray(dictRes) ? dictRes : (dictRes.items ?? dictRes ?? [])
        const termItems = Array.isArray(termsDict) ? termsDict : (termsDict.items ?? [])
        const domainItems = Array.isArray(domainsDict) ? domainsDict : (domainsDict.items ?? [])
        const subjectItems = Array.isArray(subjectsRes) ? subjectsRes : (subjectsRes.items ?? [])

        setCatalog({
          words: wordsRes.total ?? 0,
          terms: termsRes.total ?? 0,
          domains: domainsRes.total ?? 0,
          servers: serversRes.total ?? 0,
          tables: tablesRes.total ?? tableItems.length,
          columns: defsRes.total ?? defItems.length,
        })

        setSubjects(subjectItems)

        if (defItems.length > 0) {
          const groups = reviewSelectedDefinitions(defItems, {
            words: wordsDict,
            terms: termItems,
            domains: domainItems,
          })
          const summary = summarizeStandardReviewGroups(groups)
          const classified = classifyStandardReviewErrors(groups)
          const score = summary.total
            ? Math.round(((summary.ok + summary.warning * 0.5) / summary.total) * 100)
            : null
          setHealth({
            score,
            ...summary,
            totalErrors: classified.totalErrors,
            errorCategories: classified.categories,
          })
        } else {
          setHealth({
            score: null,
            total: 0,
            ok: 0,
            warning: 0,
            error: 0,
            totalErrors: 0,
            errorCategories: [],
          })
        }

        setActivity(Array.isArray(recentRes) ? recentRes : (recentRes.items ?? []))
      } catch {
        if (!cancelled) {
          setHealth({
            score: null,
            total: 0,
            ok: 0,
            warning: 0,
            error: 0,
            totalErrors: 0,
            errorCategories: [],
          })
          setActivity([])
          setSubjects([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const lineageSteps = useMemo(
    () => [
      { label: '주제영역', value: catalog.words + catalog.terms + catalog.domains > 0 ? '모델' : '—', to: '/subject-areas' },
      { label: '데이터 표준', value: `${(catalog.words + catalog.terms + catalog.domains).toLocaleString()}`, to: '/words' },
      { label: '정의서', value: `${catalog.tables.toLocaleString()} 테이블`, to: '/database/table-definition-review' },
      { label: 'DB 검토', value: `${catalog.servers.toLocaleString()} 시스템`, to: '/database/review' },
    ],
    [catalog],
  )

  const handleSearch = async (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    const params = { search: q, limit: 1, page: 1 }
    try {
      const [wordsRes, termsRes, domainsRes] = await Promise.all([
        wordsApi.getAll(params),
        termsApi.getAll(params),
        domainsApi.getAll(params),
      ])
      const counts = [
        { path: '/words', total: wordsRes.total ?? 0 },
        { path: '/terms', total: termsRes.total ?? 0 },
        { path: '/domains', total: domainsRes.total ?? 0 },
      ]
      // 결과가 있는 유형 중 건수가 가장 많은 곳으로 이동 (동점이면 단어 → 용어 → 도메인)
      const best = counts.reduce((a, b) => (b.total > a.total ? b : a))
      const target = best.total > 0 ? best.path : '/words'
      navigate(`${target}?search=${encodeURIComponent(q)}`)
    } catch {
      navigate(`/words?search=${encodeURIComponent(q)}`)
    }
  }

  if (loading) {
    return (
      <div className="dash-loading">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="bento">
      <header className="bento__hero">
        <p className="bento__eyebrow">Meta Portal</p>
        <h1 className="bento__title">메타데이터 현황</h1>

        <form className="bento-search" onSubmit={handleSearch} role="search">
          <svg className="bento-search__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="데이터 사전, 테이블, 컬럼 검색"
            aria-label="메타데이터 검색"
          />
        </form>
      </header>

      <div className="bento-grid">
        <div className="bento-stack bento-stack--left">
          <section className="bento-card bento-card--health">
            <div className="bento-card__head">
              <h2>데이터 건강도</h2>
              <p>오류 분류를 선택하면 건수가 표시됩니다</p>
            </div>
            <HealthErrorDashboard health={health} />
          </section>

          <section className="bento-card bento-card--subjects">
            <div className="bento-card__head">
              <h2>주제영역별 표준</h2>
              <p>조각을 올리면 상세가 표시됩니다</p>
            </div>
            <SubjectStandardsDashboard subjects={subjects} />
          </section>
        </div>

        <section className="bento-card bento-card--catalog">
          <div className="bento-card__head">
            <h2>카탈로그 현황</h2>
            <p>막대를 선택하면 상세 정보가 표시됩니다</p>
          </div>
          <CatalogDashboard catalog={catalog} />
        </section>

        <section className="bento-card bento-card--lineage">
          <div className="bento-card__head">
            <h2>데이터 흐름</h2>
            <p>Lineage Quick View</p>
          </div>
          <div className="bento-lineage">
            {lineageSteps.map((step, index) => (
              <div key={step.label} className="bento-lineage__step-wrap">
                <Link to={step.to} className="bento-lineage__step">
                  <span className="bento-lineage__index">{index + 1}</span>
                  <span className="bento-lineage__label">{step.label}</span>
                  <span className="bento-lineage__value">{step.value}</span>
                </Link>
                {index < lineageSteps.length - 1 && (
                  <span className="bento-lineage__arrow" aria-hidden>→</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bento-card bento-card--activity">
          <div className="bento-card__head">
            <h2>최근 변경 이력</h2>
            <p>Audit Trail</p>
          </div>
          {activity.length === 0 ? (
            <p className="bento-empty">최근 변경 이력이 없습니다.</p>
          ) : (
            <ol className="bento-timeline">
              {activity.map((item) => {
                const meta = TYPE_META[item.type] || TYPE_META.table
                return (
                  <li key={`${item.type}-${item.id}-${item.occurred_at}`} className="bento-timeline__item">
                    <span className={`bento-timeline__badge bento-timeline__badge--${meta.tone}`}>
                      {meta.label}
                    </span>
                    <div className="bento-timeline__body">
                      <p className="bento-timeline__label">{item.label}</p>
                      {item.detail ? <p className="bento-timeline__detail">{item.detail}</p> : null}
                    </div>
                    <time className="bento-timeline__time">{formatRelativeTime(item.occurred_at)}</time>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
