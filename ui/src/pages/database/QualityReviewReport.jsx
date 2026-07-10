import { useMemo, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import '../../components/charts/chartSetup'
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
  const [activeNav, setActiveNav] = useState('overview')

  const score = summary?.total
    ? Math.round(((summary.ok + summary.warning * 0.5) / summary.total) * 100)
    : null
  const tone = scoreTone(score)
  const tableCount = groups.length
  const totalErrors = categories.reduce((sum, c) => sum + (c.count || 0), 0)
  const activeCategories = categories.filter((c) => c.count > 0)

  const issueTables = useMemo(
    () =>
      groups
        .map((group) => {
          const errorRows = group.rows.filter((r) => r.status === 'error').length
          const warnRows = group.rows.filter((r) => r.status === 'warning').length
          const entityBad =
            group.entityReview?.status === 'error' || group.entityReview?.status === 'warning'
          return {
            tableKey: group.tableKey,
            table: group.table_name,
            entity: group.entity_name,
            schema: group.rows[0]?.schema_name,
            errorRows,
            warnRows,
            entityBad,
            total: group.rows.length,
          }
        })
        .filter((g) => g.errorRows > 0 || g.warnRows > 0 || g.entityBad)
        .sort((a, b) => b.errorRows - a.errorRows || b.warnRows - a.warnRows),
    [groups],
  )

  const topFindings = useMemo(() => {
    const items = []
    for (const group of groups) {
      for (const item of group.entityReview?.items || []) {
        if (item.level !== 'error' && item.level !== 'warning') continue
        items.push({
          level: item.level,
          category: item.category,
          message: item.message,
          where: `${group.table_name || group.entity_name || '—'}`,
        })
      }
      for (const row of group.rows) {
        for (const item of row.attributeReview?.items || []) {
          if (item.level !== 'error' && item.level !== 'warning') continue
          items.push({
            level: item.level,
            category: item.category,
            message: item.message,
            where: `${group.table_name}.${row.column_name || row.attribute_name || '—'}`,
          })
        }
      }
    }
    const errors = items.filter((i) => i.level === 'error')
    const warnings = items.filter((i) => i.level === 'warning')
    return [...errors, ...warnings]
  }, [groups])

  const filteredFindings = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return topFindings.slice(0, 24)
    return topFindings
      .filter(
        (item) =>
          item.message?.toLowerCase().includes(q) ||
          item.where?.toLowerCase().includes(q) ||
          item.category?.toLowerCase().includes(q),
      )
      .slice(0, 40)
  }, [topFindings, query])

  const donutData = useMemo(() => {
    const ok = summary?.ok || 0
    const warning = summary?.warning || 0
    const error = summary?.error || 0
    if (ok + warning + error === 0) {
      return {
        labels: ['데이터 없음'],
        datasets: [{ data: [1], backgroundColor: ['#d2d2d7'], borderWidth: 0 }],
      }
    }
    return {
      labels: ['정상', '주의', '오류'],
      datasets: [
        {
          data: [ok, warning, error],
          backgroundColor: ['#34c759', '#ff9f0a', '#ff3b30'],
          borderWidth: 0,
          borderRadius: 6,
          spacing: 3,
          hoverOffset: 6,
        },
      ],
    }
  }, [summary])

  const donutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(29,29,31,0.92)',
          cornerRadius: 10,
          displayColors: false,
          padding: 10,
        },
      },
    }),
    [],
  )

  const navItems = [
    { id: 'overview', label: '개요' },
    { id: 'health', label: '건강도' },
    { id: 'findings', label: '발견 사항' },
    { id: 'tables', label: '이슈 테이블' },
  ]

  const scrollTo = (id) => {
    setActiveNav(id)
    document.getElementById(`report-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="qr-dash" role="dialog" aria-modal="true" aria-label="품질 검토 보고서">
      <div className="qr-dash__bg" aria-hidden>
        <div className="qr-dash__orb qr-dash__orb--a" />
        <div className="qr-dash__orb qr-dash__orb--b" />
      </div>

      <aside className="qr-dash__nav">
        <div className="qr-dash__brand">
          <span className="qr-dash__brand-mark">M</span>
          <div>
            <p className="qr-dash__brand-title">Quality</p>
            <p className="qr-dash__brand-sub">Review Report</p>
          </div>
        </div>
        <nav className="qr-dash__nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`qr-dash__nav-item${activeNav === item.id ? ' is-active' : ''}`}
              onClick={() => scrollTo(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="qr-dash__nav-actions">
          <button type="button" className="qr-dash__ghost" onClick={() => window.print()}>
            인쇄
          </button>
          <button type="button" className="qr-dash__solid" onClick={onClose}>
            닫기
          </button>
        </div>
      </aside>

      <main className="qr-dash__main">
        <header className="qr-dash__hero" id="report-overview">
          <p className="qr-dash__eyebrow">Meta Portal · MDMS</p>
          <h1 className="qr-dash__title">데이터 품질 검토</h1>
          <p className="qr-dash__lead">
            {server?.server_name || '서버'} 스키마의 표준 준수 상태를 한눈에 확인하세요.
          </p>

          <form
            className="qr-dash__search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              scrollTo('findings')
            }}
          >
            <IconSearch />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="테이블, 컬럼, 오류 메시지 검색"
              aria-label="보고서 내 검색"
            />
          </form>

          <dl className="qr-dash__meta">
            <div>
              <dt>서버</dt>
              <dd>{server?.server_name || '—'}</dd>
            </div>
            <div>
              <dt>데이터베이스</dt>
              <dd>{server?.database_name || '—'}</dd>
            </div>
            <div>
              <dt>호스트</dt>
              <dd>
                {server?.host || '—'}
                {server?.port ? `:${server.port}` : ''}
              </dd>
            </div>
            <div>
              <dt>생성</dt>
              <dd>{formatDateTime(generatedAt)}</dd>
            </div>
          </dl>
        </header>

        <div className="qr-bento">
          {/* Health score — large left */}
          <section className="qr-card qr-card--health" id="report-health">
            <div className="qr-card__head">
              <h2>데이터 건강도</h2>
              <p>표준화 준수율</p>
            </div>
            <div className="qr-health">
              <div className="qr-health__chart">
                <Doughnut data={donutData} options={donutOptions} />
                <div className={`qr-health__center qr-health__center--${tone}`}>
                  <span className="qr-health__value">
                    {score == null ? '—' : score}
                    {score != null ? <small>%</small> : null}
                  </span>
                  <span className="qr-health__label">준수율</span>
                </div>
              </div>
              <ul className="qr-health__legend">
                <li>
                  <i className="is-ok" />
                  정상 <strong>{(summary?.ok || 0).toLocaleString()}</strong>
                </li>
                <li>
                  <i className="is-warn" />
                  주의 <strong>{(summary?.warning || 0).toLocaleString()}</strong>
                </li>
                <li>
                  <i className="is-err" />
                  오류 <strong>{(summary?.error || 0).toLocaleString()}</strong>
                </li>
              </ul>
            </div>
          </section>

          {/* Catalog stats — right top */}
          <section className="qr-card qr-card--catalog">
            <div className="qr-card__head">
              <h2>카탈로그 현황</h2>
              <p>검토 대상 규모</p>
            </div>
            <ul className="qr-catalog">
              <li>
                <span className="qr-catalog__icon"><IconServer /></span>
                <div>
                  <p className="qr-catalog__label">시스템</p>
                  <p className="qr-catalog__value">1</p>
                </div>
              </li>
              <li>
                <span className="qr-catalog__icon"><IconTable /></span>
                <div>
                  <p className="qr-catalog__label">테이블</p>
                  <p className="qr-catalog__value">{tableCount.toLocaleString()}</p>
                </div>
              </li>
              <li>
                <span className="qr-catalog__icon"><IconColumn /></span>
                <div>
                  <p className="qr-catalog__label">컬럼</p>
                  <p className="qr-catalog__value">{(summary?.total || 0).toLocaleString()}</p>
                </div>
              </li>
              <li>
                <span className="qr-catalog__icon qr-catalog__icon--accent">!</span>
                <div>
                  <p className="qr-catalog__label">오류 건수</p>
                  <p className="qr-catalog__value qr-catalog__value--err">
                    {totalErrors.toLocaleString()}
                  </p>
                </div>
              </li>
            </ul>
          </section>

          {/* Error categories */}
          <section className="qr-card qr-card--cats">
            <div className="qr-card__head">
              <h2>오류 분류</h2>
              <p>카테고리별 표준 위반</p>
            </div>
            {activeCategories.length === 0 ? (
              <p className="qr-empty">오류로 분류된 항목이 없습니다.</p>
            ) : (
              <ul className="qr-cats">
                {activeCategories.map((cat) => {
                  const share = totalErrors > 0 ? Math.round((cat.count / totalErrors) * 100) : 0
                  return (
                    <li key={cat.category}>
                      <div className="qr-cats__row">
                        <span>{cat.category}</span>
                        <strong>{cat.count.toLocaleString()}</strong>
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

          {/* Findings timeline */}
          <section className="qr-card qr-card--findings" id="report-findings">
            <div className="qr-card__head">
              <h2>주요 발견 사항</h2>
              <p>우선 조치가 필요한 항목</p>
            </div>
            {filteredFindings.length === 0 ? (
              <p className="qr-empty">
                {query.trim()
                  ? '검색 결과가 없습니다.'
                  : '발견된 이슈가 없습니다. 표준 준수 상태가 양호합니다.'}
              </p>
            ) : (
              <ol className="qr-timeline">
                {filteredFindings.map((item, idx) => (
                  <li key={`${item.where}-${item.message}-${idx}`}>
                    <span className={`qr-timeline__dot qr-timeline__dot--${item.level}`} />
                    <div className="qr-timeline__body">
                      <div className="qr-timeline__top">
                        <span className={`qr-pill qr-pill--${item.level}`}>
                          {item.level === 'error' ? '오류' : '주의'}
                        </span>
                        <span className="qr-timeline__cat">{item.category}</span>
                      </div>
                      <p className="qr-timeline__msg">{item.message}</p>
                      <p className="qr-timeline__where">{item.where}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Issue tables */}
          <section className="qr-card qr-card--tables" id="report-tables">
            <div className="qr-card__head">
              <h2>이슈 테이블</h2>
              <p>{issueTables.length.toLocaleString()}개 테이블에 이슈가 있습니다</p>
            </div>
            {issueTables.length === 0 ? (
              <p className="qr-empty">이슈가 있는 테이블이 없습니다.</p>
            ) : (
              <div className="qr-table-wrap">
                <table className="qr-table">
                  <thead>
                    <tr>
                      <th>스키마</th>
                      <th>테이블</th>
                      <th>엔티티</th>
                      <th>컬럼</th>
                      <th>오류</th>
                      <th>주의</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueTables.slice(0, 40).map((row) => (
                      <tr key={row.tableKey}>
                        <td>{row.schema || '—'}</td>
                        <td>{row.table || '—'}</td>
                        <td>{row.entity || '—'}</td>
                        <td>{row.total.toLocaleString()}</td>
                        <td className={row.errorRows ? 'is-err' : ''}>
                          {row.errorRows.toLocaleString()}
                        </td>
                        <td className={row.warnRows ? 'is-warn' : ''}>
                          {row.warnRows.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Lineage / pipeline */}
          <section className="qr-card qr-card--flow">
            <div className="qr-card__head">
              <h2>검토 흐름</h2>
              <p>품질 검토 파이프라인</p>
            </div>
            <div className="qr-flow">
              {[
                { step: '1', label: '스키마 수집', value: `${tableCount} 테이블` },
                { step: '2', label: '표준 매칭', value: `${(summary?.total || 0).toLocaleString()} 컬럼` },
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
                    <span className="qr-flow__arrow" aria-hidden>→</span>
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
