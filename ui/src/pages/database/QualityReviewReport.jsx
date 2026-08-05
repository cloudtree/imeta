import { useEffect, useMemo, useState, Fragment } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import '../../components/charts/chartSetup'
import {
  summarizeFindingKinds,
  classifyFindingKind,
  collectFindingGraphNodes,
  collectTableIssueDetails,
  summarizeCategoryHealth,
  summarizeUnitHealth,
} from './standardReviewUtils'
import './QualityReviewReport.css'

function formatDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function scoreTone(score) {
  if (score == null) return 'neutral'
  if (score >= 80) return 'good'
  if (score >= 50) return 'warn'
  return 'bad'
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
    </svg>
  )
}

function IconServer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <circle cx="7" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  )
}

function IconColumn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="4" y="3" width="6" height="18" rx="1.5" />
      <rect x="14" y="3" width="6" height="18" rx="1.5" />
    </svg>
  )
}

/** 주제영역 → 엔티티명 → 테이블명 [→ 속성/컬럼] 지식 그래프 */
function FindingKnowledgeGraph({ nodes, title = '오류', showReason = false }) {
  if (!nodes?.length) {
    return <p className="qr-empty qr-empty--compact">표시할 그래프 노드가 없습니다.</p>
  }

  const showAttr = nodes.some((n) => n.attributeName || n.columnName)

  return (
    <div className="qr-kg" aria-label={`${title} 지식 그래프`}>
      <div className="qr-kg__legend">
        <span><i className="qr-kg__swatch qr-kg__swatch--subject" />주제영역</span>
        <span><i className="qr-kg__swatch qr-kg__swatch--entity" />엔티티명</span>
        <span><i className="qr-kg__swatch qr-kg__swatch--table" />테이블명</span>
        {showAttr ? (
          <span><i className="qr-kg__swatch qr-kg__swatch--attr" />속성/컬럼</span>
        ) : null}
        {showReason ? (
          <span><i className="qr-kg__swatch qr-kg__swatch--reason" />사유</span>
        ) : null}
      </div>
      <ul className="qr-kg__list">
        {nodes.map((node) => (
          <li key={node.id} className="qr-kg__triple">
            <div className="qr-kg__path">
              <div className="qr-kg__node qr-kg__node--subject" title="주제영역">
                <span className="qr-kg__role">주제영역</span>
                <strong>{node.subjectArea}</strong>
              </div>
              <span className="qr-kg__edge" aria-hidden>
                <svg viewBox="0 0 48 12" preserveAspectRatio="none">
                  <path d="M0 6 H40" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M34 2 L42 6 L34 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </span>
              <div
                className={`qr-kg__node qr-kg__node--entity${node.entityName ? '' : ' is-missing'}`}
                title="엔티티명"
              >
                <span className="qr-kg__role">엔티티명</span>
                <strong>{node.entityName || '누락'}</strong>
              </div>
              <span className="qr-kg__edge" aria-hidden>
                <svg viewBox="0 0 48 12" preserveAspectRatio="none">
                  <path d="M0 6 H40" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M34 2 L42 6 L34 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </span>
              <div className="qr-kg__node qr-kg__node--table" title="테이블명">
                <span className="qr-kg__role">테이블명</span>
                <strong>{node.tableName}</strong>
              </div>
              {showAttr ? (
                <>
                  <span className="qr-kg__edge" aria-hidden>
                    <svg viewBox="0 0 48 12" preserveAspectRatio="none">
                      <path d="M0 6 H40" stroke="currentColor" strokeWidth="1.5" fill="none" />
                      <path d="M34 2 L42 6 L34 10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </span>
                  <div
                    className={`qr-kg__node qr-kg__node--attr${node.attributeName || node.columnName ? '' : ' is-missing'}`}
                    title="속성/컬럼"
                  >
                    <span className="qr-kg__role">속성/컬럼</span>
                    <strong>
                      {node.attributeName || node.columnName
                        ? [node.attributeName, node.columnName].filter(Boolean).join(' / ')
                        : '—'}
                    </strong>
                  </div>
                </>
              ) : null}
            </div>
            {showReason ? (
              <p className="qr-kg__reason" title={node.reason || node.messages?.[0] || ''}>
                <span className="qr-kg__role">사유</span>
                {node.reason || node.messages?.[0] || node.kind}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

const DETAIL_REASON_CATEGORIES = new Set(['표준단어', '표준용어', '표준도메인'])

function IssueDetailList({ details }) {
  const { entityItems, attributeItems } = details
  if (!entityItems.length && !attributeItems.length) {
    return <p className="qr-empty qr-empty--compact">상세 이슈가 없습니다.</p>
  }

  return (
    <div className="qr-issue-detail">
      {entityItems.length > 0 ? (
        <div className="qr-issue-detail__block">
          <h4>엔티티 / 테이블</h4>
          <ul>
            {entityItems.map((item, idx) => (
              <li key={`e-${idx}`}>
                <span className={`qr-pill qr-pill--${item.level}`}>
                  {item.level === 'error' ? '오류' : '주의'}
                </span>
                <span className="qr-issue-detail__cat">{item.category}</span>
                <p>{item.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {attributeItems.length > 0 ? (
        <div className="qr-issue-detail__block">
          <h4>컬럼 / 속성</h4>
          <ul>
            {attributeItems.map((item, idx) => (
              <li key={`a-${idx}`}>
                <div className="qr-issue-detail__meta">
                  <span className={`qr-pill qr-pill--${item.level}`}>
                    {item.level === 'error' ? '오류' : '주의'}
                  </span>
                  <span className="qr-issue-detail__cat">{item.category}</span>
                  <code>{item.column || item.scope}</code>
                  {item.attribute ? (
                    <span className="qr-issue-detail__attr">{item.attribute}</span>
                  ) : null}
                </div>
                <p>{item.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Apple bento-style quality review report dashboard
 */
export default function QualityReviewReport({
  server,
  summary,
  categories = [],
  groups = [],
  generatedAt,
  onClose,
}) {
  const [query, setQuery] = useState('')
  const [graphSelection, setGraphSelection] = useState({
    category: null,
    kind: null,
    message: null,
  })
  const [openFindingCategory, setOpenFindingCategory] = useState(undefined)
  const [expandedTableKey, setExpandedTableKey] = useState(null)
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => {
    const endPrint = () => setPrintMode(false)
    window.addEventListener('afterprint', endPrint)
    return () => window.removeEventListener('afterprint', endPrint)
  }, [])

  const handlePrintPdf = async () => {
    const prevTitle = document.title
    const serverName = server?.db_server_nm || 'DB서버'
    const stamp = new Date().toISOString().slice(0, 10)
    document.title = `품질검토보고서_${serverName}_${stamp}`
    setPrintMode(true)
    // 펼침 렌더 후 인쇄 대화상자 (PDF 저장)
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
    await new Promise((resolve) => setTimeout(resolve, 120))
    try {
      window.print()
    } finally {
      document.title = prevTitle
      // afterprint 미지원 환경 대비
      setTimeout(() => setPrintMode(false), 300)
    }
  }

  const score = summary?.total
    ? Math.round(((summary.ok + summary.warning * 0.5) / summary.total) * 100)
    : null
  const tableCount = groups.length
  const totalErrors = categories.reduce((sum, c) => sum + (c.count || 0), 0)
  const activeCategories = categories.filter((c) => c.count > 0)

  const groupByKey = useMemo(() => {
    const map = new Map()
    for (const g of groups) map.set(g.tableKey, g)
    return map
  }, [groups])

  const issueTables = useMemo(
    () =>
      groups
        .map((group) => {
          const errorRows = group.rows.filter((r) => r.status === 'error').length
          const warnRows = group.rows.filter((r) => r.status === 'warning').length
          const entityBad =
            group.entityReview?.status === 'error' || group.entityReview?.status === 'warning'
          const entityErrors = (group.entityReview?.items || []).filter((i) => i.level === 'error').length
          const attrErrors = group.rows.reduce(
            (sum, r) =>
              sum + (r.attributeReview?.items || []).filter((i) => i.level === 'error').length,
            0,
          )
          const errorDetailCount = entityErrors + attrErrors
          return {
            tableKey: group.tableKey,
            table: group.table_nm,
            entity: group.entity_nm,
            schema: group.schema_nm || group.rows[0]?.schema_nm,
            errorRows,
            warnRows,
            entityBad,
            total: group.rows.length,
            errorDetailCount,
          }
        })
        .filter((g) => g.errorRows > 0 || g.warnRows > 0 || g.entityBad)
        .sort((a, b) => b.errorRows - a.errorRows || b.warnRows - a.warnRows),
    [groups],
  )

  const findingKindGroups = useMemo(
    () => summarizeFindingKinds(groups, { levels: ['error', 'warning'] }),
    [groups],
  )

  const filteredFindingKinds = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return findingKindGroups
    return findingKindGroups
      .map((group) => {
        const kinds = group.kinds.filter(
          (k) =>
            k.kind.toLowerCase().includes(q) ||
            group.category.toLowerCase().includes(q),
        )
        const reasons = (group.reasons || []).filter(
          (r) =>
            r.message.toLowerCase().includes(q) ||
            r.kind.toLowerCase().includes(q) ||
            group.category.toLowerCase().includes(q),
        )
        if (
          !kinds.length &&
          !reasons.length &&
          !group.category.toLowerCase().includes(q)
        ) {
          return null
        }
        const nextKinds = kinds.length ? kinds : group.kinds
        const nextReasons = reasons.length ? reasons : group.reasons || []
        const useDetail = DETAIL_REASON_CATEGORIES.has(group.category)
        return {
          ...group,
          kinds: nextKinds,
          reasons: nextReasons,
          total: useDetail
            ? nextReasons.reduce((sum, r) => sum + r.count, 0) || group.total
            : nextKinds.reduce((sum, k) => sum + k.count, 0),
        }
      })
      .filter(Boolean)
  }, [findingKindGroups, query])

  const resolvedGraphSelection = useMemo(() => {
    if (!filteredFindingKinds.length) {
      return { category: null, kind: null, message: null }
    }

    const preferredCat =
      (openFindingCategory === undefined
        ? filteredFindingKinds[0]?.category
        : openFindingCategory)
      || graphSelection.category

    const selectedGroup =
      filteredFindingKinds.find((g) => g.category === preferredCat)
      || filteredFindingKinds[0]

    if (!selectedGroup) return { category: null, kind: null, message: null }

    const useDetail = DETAIL_REASON_CATEGORIES.has(selectedGroup.category)
    if (useDetail) {
      const reasonHit = (selectedGroup.reasons || []).find(
        (r) =>
          selectedGroup.category === graphSelection.category
          && r.message === graphSelection.message,
      )
      const first = reasonHit || selectedGroup.reasons?.[0]
      if (!first) {
        return { category: selectedGroup.category, kind: null, message: null }
      }
      return {
        category: selectedGroup.category,
        kind: first.kind,
        message: first.message,
      }
    }

    const kindHit = selectedGroup.kinds?.find(
      (k) =>
        selectedGroup.category === graphSelection.category
        && k.kind === graphSelection.kind,
    )
    const firstKind = kindHit || selectedGroup.kinds?.[0]
    return {
      category: selectedGroup.category,
      kind: firstKind?.kind || null,
      message: null,
    }
  }, [filteredFindingKinds, graphSelection, openFindingCategory])

  const accordionCategory =
    openFindingCategory === undefined
      ? filteredFindingKinds[0]?.category || null
      : openFindingCategory

  const toggleFindingCategory = (category) => {
    setOpenFindingCategory((prev) => {
      const current =
        prev === undefined ? filteredFindingKinds[0]?.category || null : prev
      const next = current === category ? null : category
      if (next) {
        const group = filteredFindingKinds.find((g) => g.category === next)
        if (group) {
          if (DETAIL_REASON_CATEGORIES.has(group.category)) {
            const first = group.reasons?.[0]
            setGraphSelection({
              category: group.category,
              kind: first?.kind || null,
              message: first?.message || null,
            })
          } else {
            setGraphSelection({
              category: group.category,
              kind: group.kinds?.[0]?.kind || null,
              message: null,
            })
          }
        }
      }
      return next
    })
  }

  const categoryHealth = useMemo(() => summarizeCategoryHealth(groups), [groups])
  const unitHealth = useMemo(() => summarizeUnitHealth(groups), [groups])

  const makeUnitDonut = (bucket) => {
    const { ok, warning, error } = bucket
    if (ok + warning + error === 0) {
      return {
        labels: ['데이터 없음'],
        datasets: [{ data: [1], backgroundColor: ['#d2d2d7'], borderWidth: 0 }],
      }
    }
    return {
      labels: ['정상 (표준)', '주의 (부분 비표준)', '오류 (비표준)'],
      datasets: [
        {
          data: [ok, warning, error],
          backgroundColor: ['#34c759', '#ff9f0a', '#ff3b30'],
          borderWidth: 0,
          borderRadius: 6,
          spacing: 2,
          hoverOffset: 5,
        },
      ],
    }
  }

  const tableDonutData = useMemo(
    () => makeUnitDonut(unitHealth.tables),
    [unitHealth.tables],
  )
  const columnDonutData = useMemo(
    () => makeUnitDonut(unitHealth.columns),
    [unitHealth.columns],
  )

  const unitCompareData = useMemo(
    () => ({
      labels: ['테이블', '컬럼'],
      datasets: [
        {
          label: '정상 (표준)',
          data: [unitHealth.tables.ok, unitHealth.columns.ok],
          backgroundColor: '#34c759',
          borderRadius: 6,
          maxBarThickness: 42,
        },
        {
          label: '주의 (부분 비표준)',
          data: [unitHealth.tables.warning, unitHealth.columns.warning],
          backgroundColor: '#ff9f0a',
          borderRadius: 6,
          maxBarThickness: 42,
        },
        {
          label: '오류 (비표준)',
          data: [unitHealth.tables.error, unitHealth.columns.error],
          backgroundColor: '#ff3b30',
          borderRadius: 6,
          maxBarThickness: 42,
        },
      ],
    }),
    [unitHealth],
  )

  const unitDonutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          cornerRadius: 10,
          displayColors: true,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const value = ctx.parsed || 0
              const sum = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1
              const pct = Math.round((value / sum) * 100)
              return ` ${ctx.label}: ${value.toLocaleString()}건 (${pct}%)`
            },
          },
        },
      },
    }),
    [],
  )

  const unitCompareOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 },
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          cornerRadius: 10,
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#1d1d1f', font: { weight: '600' } },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#86868b', precision: 0 },
        },
      },
    }),
    [],
  )

  const categoryScoreData = useMemo(() => {
    const items = categoryHealth.items.filter((i) => i.total > 0)
    const labels = items.map((i) => i.category)
    return {
      labels: labels.length ? labels : ['데이터 없음'],
      datasets: [
        {
          label: '준수율(%)',
          data: labels.length ? items.map((i) => i.score ?? 0) : [0],
          backgroundColor: labels.length ? items.map((i) => i.color) : ['#d2d2d7'],
          borderRadius: 8,
          borderSkipped: false,
          maxBarThickness: 36,
        },
      ],
    }
  }, [categoryHealth])

  const categoryVolumeData = useMemo(() => {
    const items = categoryHealth.items.filter((i) => i.total > 0)
    const labels = items.map((i) => i.category)
    return {
      labels: labels.length ? labels : ['데이터 없음'],
      datasets: [
        {
          label: '정상 (표준)',
          data: labels.length ? items.map((i) => i.ok) : [0],
          backgroundColor: '#34c759',
          borderRadius: 4,
          stack: 'vol',
          maxBarThickness: 32,
        },
        {
          label: '주의 (부분 비표준)',
          data: labels.length ? items.map((i) => i.warning) : [0],
          backgroundColor: '#ff9f0a',
          borderRadius: 4,
          stack: 'vol',
          maxBarThickness: 32,
        },
        {
          label: '오류 (비표준)',
          data: labels.length ? items.map((i) => i.error) : [0],
          backgroundColor: '#ff3b30',
          borderRadius: 4,
          stack: 'vol',
          maxBarThickness: 32,
        },
      ],
    }
  }, [categoryHealth])

  const categoryScoreOptions = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            label: (ctx) => `준수율 ${ctx.parsed.x}%`,
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#86868b', callback: (v) => `${v}%` },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#1d1d1f', font: { weight: '600' } },
        },
      },
    }),
    [],
  )

  const categoryVolumeOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          cornerRadius: 10,
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#86868b' },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { color: '#86868b', precision: 0 },
        },
      },
    }),
    [],
  )

  const toggleTableDetail = (tableKey) => {
    setExpandedTableKey((prev) => (prev === tableKey ? null : tableKey))
  }

  return (
    <div
      className={`qr-dash${printMode ? ' is-print-expand' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="품질 검토 보고서"
    >
      <div className="qr-dash__bg" aria-hidden>
        <div className="qr-dash__orb qr-dash__orb--a" />
        <div className="qr-dash__orb qr-dash__orb--b" />
      </div>

      <main className="qr-dash__main">
        <header className="qr-dash__hero" id="report-overview">
          <div className="qr-dash__hero-text">
            <p className="qr-dash__eyebrow">Quality Review</p>
            <h1>{server?.db_server_nm || 'DB 서버'} 검토 보고서</h1>
            <p className="qr-dash__hero-desc">
              {formatDateTime(generatedAt)} · {server?.host_nm || '—'} / {server?.database_nm || '—'}
            </p>
          </div>
          <div className="qr-dash__hero-actions">
            <label className="qr-dash__search qr-no-print">
              <IconSearch />
              <input
                type="search"
                placeholder="발견 사항 · 분류 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="qr-dash__print"
              onClick={handlePrintPdf}
              disabled={printMode}
            >
              {printMode ? '준비 중…' : '인쇄 / PDF'}
            </button>
            <button type="button" className="qr-dash__close qr-no-print" onClick={onClose}>
              닫기
            </button>
          </div>
        </header>

        <div className="qr-bento">
          <section className="qr-card qr-card--health" id="report-health">
            <div className="qr-card__head">
              <h2 className="qr-card__title--health">Health Check</h2>
              <p>
                {server?.db_server_nm || '서버'} · 테이블·컬럼 단위 표준 / 비표준 현황
              </p>
            </div>
            <div className="qr-health qr-health--dashboard">
              <ul className="qr-health__legend-bar" aria-label="상태 범례">
                {unitHealth.legend.map((item) => (
                  <li key={item.key}>
                    <i style={{ background: item.color }} />
                    <span>
                      <strong>{item.label}</strong>
                      <em>{item.desc}</em>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="qr-health__units">
                <div className="qr-health__unit">
                  <div className="qr-health__unit-head">
                    <h3>테이블 단위</h3>
                    <p>엔티티·테이블명 + 소속 컬럼 종합 판정 · {unitHealth.tables.total.toLocaleString()}개</p>
                  </div>
                  <div className="qr-health__unit-body">
                    <div className="qr-health__chart qr-health__chart--unit">
                      <Doughnut data={tableDonutData} options={unitDonutOptions} />
                      <div
                        className={`qr-health__center qr-health__center--${scoreTone(
                          unitHealth.tables.score,
                        )}`}
                      >
                        <span className="qr-health__value">
                          {unitHealth.tables.score == null ? '—' : unitHealth.tables.score}
                          {unitHealth.tables.score != null ? <small>%</small> : null}
                        </span>
                        <span className="qr-health__label">테이블 준수율</span>
                      </div>
                    </div>
                    <ul className="qr-health__unit-stats">
                      <li className="is-ok">
                        <span>정상</span>
                        <strong>{unitHealth.tables.ok.toLocaleString()}</strong>
                      </li>
                      <li className="is-warn">
                        <span>주의</span>
                        <strong>{unitHealth.tables.warning.toLocaleString()}</strong>
                      </li>
                      <li className="is-err">
                        <span>오류</span>
                        <strong>{unitHealth.tables.error.toLocaleString()}</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="qr-health__unit">
                  <div className="qr-health__unit-head">
                    <h3>컬럼 단위</h3>
                    <p>속성·컬럼 표준단어/용어/도메인 판정 · {unitHealth.columns.total.toLocaleString()}개</p>
                  </div>
                  <div className="qr-health__unit-body">
                    <div className="qr-health__chart qr-health__chart--unit">
                      <Doughnut data={columnDonutData} options={unitDonutOptions} />
                      <div
                        className={`qr-health__center qr-health__center--${scoreTone(
                          unitHealth.columns.score,
                        )}`}
                      >
                        <span className="qr-health__value">
                          {unitHealth.columns.score == null ? '—' : unitHealth.columns.score}
                          {unitHealth.columns.score != null ? <small>%</small> : null}
                        </span>
                        <span className="qr-health__label">컬럼 준수율</span>
                      </div>
                    </div>
                    <ul className="qr-health__unit-stats">
                      <li className="is-ok">
                        <span>정상</span>
                        <strong>{unitHealth.columns.ok.toLocaleString()}</strong>
                      </li>
                      <li className="is-warn">
                        <span>주의</span>
                        <strong>{unitHealth.columns.warning.toLocaleString()}</strong>
                      </li>
                      <li className="is-err">
                        <span>오류</span>
                        <strong>{unitHealth.columns.error.toLocaleString()}</strong>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="qr-health__unit qr-health__unit--compare">
                  <div className="qr-health__unit-head">
                    <h3>테이블 vs 컬럼</h3>
                    <p>단위별 정상 · 부분 비표준 · 비표준 건수 비교</p>
                  </div>
                  <div className="qr-health__bar qr-health__bar--compare">
                    <Bar data={unitCompareData} options={unitCompareOptions} />
                  </div>
                </div>
              </div>

              <div className="qr-health__charts">
                <div className="qr-health__panel">
                  <div className="qr-health__panel-head">
                    <h3>분류별 준수율</h3>
                    <p>엔티티·테이블·표준단어·용어·도메인</p>
                  </div>
                  <div className="qr-health__bar">
                    <Bar data={categoryScoreData} options={categoryScoreOptions} />
                  </div>
                </div>
                <div className="qr-health__panel">
                  <div className="qr-health__panel-head">
                    <h3>분류별 건수</h3>
                    <p>정상 / 주의 / 오류 스택</p>
                  </div>
                  <div className="qr-health__bar">
                    <Bar data={categoryVolumeData} options={categoryVolumeOptions} />
                  </div>
                </div>
              </div>

              <ul className="qr-health__cards" aria-label="분류별 Health Check 요약">
                {categoryHealth.items.map((item) => (
                  <li key={item.category} className="qr-health__card">
                    <span
                      className="qr-health__card-dot"
                      style={{ background: item.color }}
                    />
                    <div className="qr-health__card-body">
                      <p className="qr-health__card-name">{item.category}</p>
                      <p className={`qr-health__card-score is-${scoreTone(item.score)}`}>
                        {item.score == null ? '—' : `${item.score}%`}
                      </p>
                    </div>
                    <div className="qr-health__card-stats">
                      <span className="is-ok" title="정상">{item.ok}</span>
                      <span className="is-warn" title="주의">{item.warning}</span>
                      <span className="is-err" title="오류">{item.error}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="qr-card qr-card--catalog">
            <div className="qr-card__head">
              <h2>검토 범위</h2>
              <p>수집된 스키마 규모</p>
            </div>
            <ul className="qr-catalog">
              <li>
                <span className="qr-catalog__icon">
                  <IconServer />
                </span>
                <div>
                  <p className="qr-catalog__label">서버</p>
                  <p className="qr-catalog__value">1</p>
                </div>
              </li>
              <li>
                <span className="qr-catalog__icon">
                  <IconTable />
                </span>
                <div>
                  <p className="qr-catalog__label">테이블</p>
                  <p className="qr-catalog__value">{tableCount.toLocaleString()}</p>
                </div>
              </li>
              <li>
                <span className="qr-catalog__icon">
                  <IconColumn />
                </span>
                <div>
                  <p className="qr-catalog__label">컬럼</p>
                  <p className="qr-catalog__value">{(summary?.total || 0).toLocaleString()}</p>
                </div>
              </li>
              <li>
                <span className="qr-catalog__icon qr-catalog__icon--accent">!</span>
                <div>
                  <p className="qr-catalog__label">오류</p>
                  <p className="qr-catalog__value qr-catalog__value--err">
                    {totalErrors.toLocaleString()}
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section className="qr-card qr-card--cats">
            <div className="qr-card__head">
              <h2>오류 분류</h2>
              <p>카테고리별 표준 위반 · 세부 분류</p>
            </div>
            {activeCategories.length === 0 ? (
              <p className="qr-empty">오류로 분류된 항목이 없습니다.</p>
            ) : (
              <ul className="qr-cats">
                {activeCategories.map((cat) => {
                  const share = totalErrors > 0 ? Math.round((cat.count / totalErrors) * 100) : 0
                  const kinds =
                    Array.isArray(cat.kinds) && cat.kinds.length
                      ? cat.kinds
                      : (cat.topMessages || []).map((m) => ({
                          kind: classifyFindingKind(cat.category, m.message),
                          count: m.count,
                        }))
                  return (
                    <li key={cat.category} className="qr-cats__item">
                      <div className="qr-cats__row">
                        <span className="qr-cats__name">{cat.category}</span>
                        <strong className="qr-cats__total">{cat.count.toLocaleString()}건</strong>
                        {kinds.length > 0 ? (
                          <ul className="qr-finding-kinds" aria-label={`${cat.category} 오류 분류`}>
                            {kinds.map((item) => (
                              <li key={item.kind} className="qr-finding-kind">
                                <span className="qr-finding-kind__label">{item.kind}</span>
                                <em className="qr-finding-kind__count">
                                  {item.count.toLocaleString()}
                                </em>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="qr-cats__track">
                        <i style={{ width: `${Math.max(share, 3)}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="qr-card qr-card--findings" id="report-findings">
            <div className="qr-card__head">
              <h2>주요 발견 사항</h2>
              <p>카테고리를 펼쳐 오류 분류 · 사유 · 지식 그래프를 확인합니다</p>
            </div>
            {filteredFindingKinds.length === 0 ? (
              <p className="qr-empty">
                {query.trim()
                  ? '검색 결과가 없습니다.'
                  : '발견된 이슈가 없습니다. 표준 준수 상태가 양호합니다.'}
              </p>
            ) : (
              <div className="qr-accordion" role="region" aria-label="주요 발견 사항 아코디언">
                {filteredFindingKinds.map((group) => {
                  const isOpen = printMode || accordionCategory === group.category
                  const useDetailReasons = DETAIL_REASON_CATEGORIES.has(group.category)
                  const chips = useDetailReasons
                    ? (group.reasons || []).slice(0, printMode ? 200 : 40)
                    : group.kinds
                  const panelId = `finding-panel-${group.category}`
                  const headerId = `finding-header-${group.category}`

                  return (
                    <div
                      key={group.category}
                      className={`qr-accordion__item${isOpen ? ' is-open' : ''}`}
                    >
                      <h3 className="qr-accordion__heading">
                        <button
                          type="button"
                          id={headerId}
                          className="qr-accordion__trigger"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => toggleFindingCategory(group.category)}
                        >
                          <span className="qr-accordion__title">{group.category}</span>
                          <strong className="qr-accordion__count">
                            {group.total.toLocaleString()}건
                          </strong>
                          <span className="qr-accordion__chevron" aria-hidden />
                        </button>
                      </h3>

                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={headerId}
                        className="qr-accordion__panel"
                        hidden={!isOpen}
                      >
                        {isOpen ? (
                          <div className="qr-accordion__body">
                            <ul
                              className={`qr-accordion__reasons${useDetailReasons ? ' is-detail' : ''}`}
                              aria-label={`${group.category} 오류 분류`}
                            >
                              {chips.map((item) => {
                                const key = useDetailReasons ? item.message : item.kind
                                const label = useDetailReasons ? item.message : item.kind
                                const active = useDetailReasons
                                  ? resolvedGraphSelection.message === item.message
                                  : resolvedGraphSelection.kind === item.kind
                                const childOpen = printMode || active
                                const childPanelId = `finding-child-${group.category}-${key}`
                                const childNodes = childOpen
                                  ? collectFindingGraphNodes(groups, {
                                      category: group.category,
                                      kind: item.kind,
                                      message: useDetailReasons ? item.message : null,
                                    })
                                  : []

                                return (
                                  <li
                                    key={key}
                                    className={`qr-accordion__child${childOpen ? ' is-open' : ''}`}
                                  >
                                    <button
                                      type="button"
                                      className={`qr-accordion__child-trigger${useDetailReasons ? ' is-reason' : ''}${active ? ' is-active' : ''}`}
                                      aria-expanded={childOpen}
                                      aria-controls={childPanelId}
                                      title={label}
                                      onClick={() =>
                                        setGraphSelection(
                                          useDetailReasons
                                            ? {
                                                category: group.category,
                                                kind: item.kind,
                                                message: item.message,
                                              }
                                            : {
                                                category: group.category,
                                                kind: item.kind,
                                                message: null,
                                              },
                                        )
                                      }
                                    >
                                      {useDetailReasons ? (
                                        <span className="qr-accordion__child-kind">{item.kind}</span>
                                      ) : null}
                                      <span className="qr-accordion__child-label">{label}</span>
                                      <em className="qr-accordion__child-count">
                                        {item.count.toLocaleString()}
                                      </em>
                                      <span className="qr-accordion__chevron qr-accordion__chevron--sm" aria-hidden />
                                    </button>

                                    <div
                                      id={childPanelId}
                                      className="qr-accordion__child-panel"
                                      hidden={!childOpen}
                                    >
                                      {childOpen ? (
                                        <div className="qr-finding-group__graph">
                                          <p className="qr-kg__caption">
                                            {group.category}
                                            {' · '}
                                            {useDetailReasons ? label : item.kind}
                                            {' '}지식 그래프 · 주제영역 / 엔티티명 / 테이블명
                                            {useDetailReasons ? ' / 속성·컬럼 · 사유' : ''}
                                          </p>
                                          <FindingKnowledgeGraph
                                            nodes={childNodes}
                                            title={`${group.category} ${item.kind}`}
                                            showReason={useDetailReasons}
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="qr-card qr-card--tables" id="report-tables">
            <div className="qr-card__head">
              <h2>이슈 테이블</h2>
              <p>
                {issueTables.length.toLocaleString()}개 테이블 · 오류 숫자를 클릭하면 상세를 볼 수
                있습니다
              </p>
            </div>
            {issueTables.length === 0 ? (
              <p className="qr-empty">이슈가 있는 테이블이 없습니다.</p>
            ) : (
              <div className="qr-table-wrap">
                <table className="qr-table">
                  <thead>
                    <tr>
                      <th>주제영역</th>
                      <th>테이블</th>
                      <th>엔티티</th>
                      <th>컬럼</th>
                      <th>오류</th>
                      <th>주의</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueTables.slice(0, printMode ? 500 : 40).map((row) => {
                      const expanded = printMode || expandedTableKey === row.tableKey
                      const detailGroup = expanded ? groupByKey.get(row.tableKey) : null
                      const details = detailGroup ? collectTableIssueDetails(detailGroup) : null
                      return (
                        <Fragment key={row.tableKey}>
                          <tr className={expanded ? 'is-expanded' : ''}>
                            <td>{row.schema || '—'}</td>
                            <td>{row.table || '—'}</td>
                            <td>
                              {row.entity?.trim() ? (
                                row.entity
                              ) : (
                                <span className="is-missing-text">누락</span>
                              )}
                            </td>
                            <td>{row.total.toLocaleString()}</td>
                            <td className={row.errorRows || row.errorDetailCount ? 'is-err' : ''}>
                              <button
                                type="button"
                                className="qr-table__count-btn"
                                disabled={
                                  !row.errorRows && !row.errorDetailCount && !row.entityBad
                                }
                                onClick={() => toggleTableDetail(row.tableKey)}
                                aria-expanded={expanded}
                              >
                                {Math.max(row.errorRows, row.errorDetailCount).toLocaleString()}
                              </button>
                            </td>
                            <td className={row.warnRows ? 'is-warn' : ''}>
                              <button
                                type="button"
                                className="qr-table__count-btn qr-table__count-btn--warn"
                                disabled={!row.warnRows}
                                onClick={() => toggleTableDetail(row.tableKey)}
                                aria-expanded={expanded}
                              >
                                {row.warnRows.toLocaleString()}
                              </button>
                            </td>
                          </tr>
                          {expanded && details ? (
                            <tr className="qr-table__detail-row">
                              <td colSpan={6}>
                                <IssueDetailList details={details} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="qr-card qr-card--flow">
            <div className="qr-card__head">
              <h2>검토 흐름</h2>
              <p>품질 검토 파이프라인</p>
            </div>
            <div className="qr-flow">
              {[
                { step: '1', label: '스키마 수집', value: `${tableCount} 테이블` },
                {
                  step: '2',
                  label: '표준 매칭',
                  value: `${(summary?.total || 0).toLocaleString()} 컬럼`,
                },
                { step: '3', label: '품질 평가', value: score == null ? '—' : `${score}%` },
                { step: '4', label: '조치 권고', value: `${totalErrors.toLocaleString()} 오류` },
              ].map((item, index, arr) => (
                <div key={item.step} className="qr-flow__step-wrap">
                  <div className="qr-flow__step">
                    <span className="qr-flow__index">{item.step}</span>
                    <span className="qr-flow__label">{item.label}</span>
                    <span className="qr-flow__value">{item.value}</span>
                  </div>
                  {index < arr.length - 1 ? (
                    <span className="qr-flow__arrow" aria-hidden>
                      →
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="qr-dash__footer">
          <p>Meta Portal Quality Review</p>
          <p>등록된 표준 단어·용어·도메인 사전을 기준으로 자동 생성되었습니다.</p>
        </footer>
      </main>
    </div>
  )
}
