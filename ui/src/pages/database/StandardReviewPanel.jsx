import { useMemo } from 'react'
import { summarizeStandardReviewGroups } from './standardReviewUtils'

const STATUS_LABEL = {
  ok: '적합',
  warning: '주의',
  error: '부적합',
}

const STATUS_CLASS = {
  ok: 'badge-green',
  warning: 'badge-yellow',
  error: 'badge-red',
}

const LEVEL_ICON = {
  ok: '✓',
  warning: '△',
  error: '✕',
  info: '·',
}

const LEVEL_CLASS = {
  ok: 'standard-review-item--ok',
  warning: 'standard-review-item--warning',
  error: 'standard-review-item--error',
  info: 'standard-review-item--info',
}

function ReviewItems({ items = [] }) {
  if (!items.length) return null

  return (
    <ul className="standard-review-card__items">
      {items.map((item, index) => (
        <li
          key={index}
          className={`standard-review-item ${LEVEL_CLASS[item.level]}`}
        >
          <span className="standard-review-item__icon" aria-hidden>
            {LEVEL_ICON[item.level]}
          </span>
          <div className="standard-review-item__body">
            {item.category && (
              <span className="standard-review-item__category">{item.category}</span>
            )}
            <p className="standard-review-item__message">{item.message}</p>
            {item.detail && (
              <p className="standard-review-item__detail">{item.detail}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function StandardReviewPanel({ groups = [], onClose }) {
  const summary = useMemo(() => summarizeStandardReviewGroups(groups), [groups])

  return (
    <div className="standard-review-panel">
      <div className="standard-review-panel__header">
        <h2 className="standard-review-panel__title">표준검토</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
          닫기
        </button>
      </div>

      <div className="standard-review-summary standard-review-summary--compact">
        <div className="standard-review-summary__item">
          <span className="standard-review-summary__label">검토</span>
          <strong>{summary.total}건</strong>
        </div>
        <div className="standard-review-summary__item">
          <span className="standard-review-summary__label">적합</span>
          <strong className="standard-review-summary__ok">{summary.ok}</strong>
        </div>
        <div className="standard-review-summary__item">
          <span className="standard-review-summary__label">주의</span>
          <strong className="standard-review-summary__warning">{summary.warning}</strong>
        </div>
        <div className="standard-review-summary__item">
          <span className="standard-review-summary__label">부적합</span>
          <strong className="standard-review-summary__error">{summary.error}</strong>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="standard-review-empty">검토 결과가 없습니다.</div>
      ) : (
        <div className="standard-review-list">
          {groups.map((group) => (
            <section key={group.tableKey} className="standard-review-card">
              <div className="standard-review-card__header">
                <div>
                  <div className="standard-review-card__title">
                    {group.entity_name} · {group.table_name}
                  </div>
                  <div className="standard-review-card__meta">엔티티명 기준 테이블명 검토</div>
                </div>
                <span className={`badge ${STATUS_CLASS[group.entityReview.status]}`}>
                  {STATUS_LABEL[group.entityReview.status]}
                </span>
              </div>
              <div className="standard-review-card__section">
                <ReviewItems items={group.entityReview.items} />
              </div>

              {group.rows.map((row) => (
                <div key={row.def_id} className="standard-review-card__section standard-review-card__section--attribute">
                  <div className="standard-review-card__attribute-header">
                    <div>
                      <div className="standard-review-card__attribute-title">
                        {row.attribute_name}
                      </div>
                      <div className="standard-review-card__meta">
                        컬럼명: {row.column_name || '-'} · 속성명 기준 단어/용어/도메인 검토
                      </div>
                    </div>
                    <span className={`badge ${STATUS_CLASS[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                  <ReviewItems items={row.attributeReview.items} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
