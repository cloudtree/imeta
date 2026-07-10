import { useMemo, useState } from 'react'
import { summarizeStandardReviewGroups } from './standardReviewUtils'

const STATUS_LABEL = {
  ok: '적합',
  warning: '주의',
  error: '부적합',
}

const LEVEL_LABEL = {
  ok: '적합',
  warning: '주의',
  error: '부적합',
  info: '참고',
}

function groupItemsByCategory(items = []) {
  const map = new Map()
  for (const item of items) {
    const key = item.category || '기타'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.entries()]
}

function StatusPill({ status }) {
  return (
    <span className={`sr-cloud-pill sr-cloud-pill--${status}`}>
      <span className="sr-cloud-pill__dot" aria-hidden />
      {STATUS_LABEL[status] || status}
    </span>
  )
}

function FindingCloud({ items = [] }) {
  if (!items.length) return null

  const categories = groupItemsByCategory(items)

  return (
    <div className="sr-cloud-findings">
      {categories.map(([category, categoryItems]) => (
        <div key={category} className="sr-cloud-cluster">
          <div className="sr-cloud-cluster__label">{category}</div>
          <div className="sr-cloud-cluster__chips">
            {categoryItems.map((item, index) => (
              <article
                key={`${category}-${index}`}
                className={`sr-cloud-chip sr-cloud-chip--${item.level}`}
              >
                <header className="sr-cloud-chip__head">
                  <span className={`sr-cloud-chip__level sr-cloud-chip__level--${item.level}`}>
                    {LEVEL_LABEL[item.level]}
                  </span>
                </header>
                <p className="sr-cloud-chip__message">{item.message}</p>
                {item.detail && (
                  <p className="sr-cloud-chip__detail">{item.detail}</p>
                )}
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EntityBlock({ group }) {
  return (
    <section className="sr-cloud-block">
      <div className="sr-cloud-block__header">
        <div className="sr-cloud-block__identity">
          <span className="sr-cloud-block__kind">엔티티 · 테이블</span>
          <h3 className="sr-cloud-block__title">
            {group.entity_nm || '(엔티티명 없음)'}
            <span className="sr-cloud-block__sep">/</span>
            <code>{group.table_nm || '-'}</code>
          </h3>
        </div>
        <StatusPill status={group.entityReview.status} />
      </div>
      <FindingCloud items={group.entityReview.items} />
    </section>
  )
}

function AttributeBlock({ row }) {
  return (
    <section className="sr-cloud-block sr-cloud-block--attr">
      <div className="sr-cloud-block__header">
        <div className="sr-cloud-block__identity">
          <span className="sr-cloud-block__kind">속성 · 컬럼</span>
          <h3 className="sr-cloud-block__title">
            {row.attribute_nm || '(속성명 없음)'}
            <span className="sr-cloud-block__sep">/</span>
            <code>{row.column_nm || '-'}</code>
          </h3>
        </div>
        <StatusPill status={row.status} />
      </div>
      <FindingCloud items={row.attributeReview.items} />
    </section>
  )
}

export default function StandardReviewPanel({ groups = [], onClose }) {
  const summary = useMemo(() => summarizeStandardReviewGroups(groups), [groups])
  const [activeFilter, setActiveFilter] = useState('all')

  const filteredGroups = useMemo(() => {
    if (activeFilter === 'all') return groups
    return groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => row.status === activeFilter),
        includeEntity: group.entityReview.status === activeFilter,
      }))
      .filter((group) => group.includeEntity || group.rows.length > 0)
  }, [groups, activeFilter])

  const filters = [
    { key: 'all', label: '전체', count: summary.total },
    { key: 'ok', label: '적합', count: summary.ok },
    { key: 'warning', label: '주의', count: summary.warning },
    { key: 'error', label: '부적합', count: summary.error },
  ]

  return (
    <div className="sr-cloud">
      <header className="sr-cloud__header">
        <div>
          <p className="sr-cloud__eyebrow">Standard Review</p>
          <h2 className="sr-cloud__title">표준검토</h2>
        </div>
        <button type="button" className="sr-cloud__close" onClick={onClose} aria-label="닫기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </header>

      <div className="sr-cloud__summary">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`sr-cloud__stat${activeFilter === filter.key ? ' sr-cloud__stat--active' : ''}${filter.key !== 'all' ? ` sr-cloud__stat--${filter.key}` : ''}`}
            onClick={() => setActiveFilter(filter.key)}
          >
            <span className="sr-cloud__stat-label">{filter.label}</span>
            <strong className="sr-cloud__stat-value">{filter.count}</strong>
          </button>
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <div className="sr-cloud__empty">표시할 검토 결과가 없습니다.</div>
      ) : (
        <div className="sr-cloud__stream">
          {filteredGroups.map((group) => (
            <article key={group.tableKey} className="sr-cloud-group">
              {(activeFilter === 'all' || group.includeEntity) && (
                <EntityBlock group={group} />
              )}
              {group.rows.map((row) => (
                <AttributeBlock key={row.table_def_id} row={row} />
              ))}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
