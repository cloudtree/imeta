/**
 * 좌측 트리/그룹 네비게이션
 *
 * 단순 모드: items + selectedId + onSelect
 * 다중 섹션: sections=[{ key, title, items, selectedId, onSelect }]
 */
export default function SplitNav({
  title = '주제영역',
  items = [],
  selectedId = '',
  onSelect,
  allLabel = '전체',
  allCount,
  footer,
  sections,
  onSelectAll,
}) {
  const multi = Array.isArray(sections) && sections.length > 0
  const allActive = multi
    ? sections.every((s) => !s.selectedId)
    : selectedId === ''

  const handleAll = () => {
    if (onSelectAll) onSelectAll()
    else onSelect?.('')
  }

  return (
    <div className="split-nav">
      <div className="split-nav__header">
        <span className="split-nav__title">{title}</span>
      </div>

      <div className="split-nav__scroll">
        <button
          type="button"
          className={`split-nav__item ${allActive ? 'is-active' : ''}`}
          onClick={handleAll}
        >
          <span className="split-nav__item-label">{allLabel}</span>
          {allCount != null && (
            <span className="split-nav__item-count">{allCount}</span>
          )}
        </button>

        {multi ? (
          sections.map((section) => (
            <div key={section.key || section.title} className="split-nav__section">
              <div className="split-nav__section-label">{section.title}</div>
              {(section.items || []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`split-nav__item ${section.selectedId === item.id ? 'is-active' : ''}`}
                  onClick={() => section.onSelect?.(item.id)}
                >
                  <span className="split-nav__item-icon" aria-hidden="true">
                    {item.icon || '◇'}
                  </span>
                  <span className="split-nav__item-label" title={item.label}>
                    {item.label}
                  </span>
                  {item.count != null && (
                    <span className="split-nav__item-count">{item.count}</span>
                  )}
                </button>
              ))}
              {!section.items?.length && (
                <div className="split-nav__item split-nav__item--child" style={{ cursor: 'default', opacity: 0.6 }}>
                  항목 없음
                </div>
              )}
            </div>
          ))
        ) : (
          items.length > 0 && (
            <div className="split-nav__section">
              <div className="split-nav__section-label">{title}</div>
              {items.map((item) => (
                <div key={item.id} className="split-nav__group">
                  <button
                    type="button"
                    className={`split-nav__item ${selectedId === item.id ? 'is-active' : ''}`}
                    onClick={() => onSelect?.(item.id)}
                  >
                    <span className="split-nav__item-icon" aria-hidden="true">
                      {item.icon || '◇'}
                    </span>
                    <span className="split-nav__item-label" title={item.label}>
                      {item.label}
                    </span>
                    {item.count != null && (
                      <span className="split-nav__item-count">{item.count}</span>
                    )}
                  </button>
                  {item.children?.length > 0 && (
                    <div className="split-nav__children">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={`split-nav__item split-nav__item--child ${selectedId === child.id ? 'is-active' : ''}`}
                          onClick={() => onSelect?.(child.id)}
                        >
                          <span className="split-nav__item-label" title={child.label}>
                            {child.label}
                          </span>
                          {child.count != null && (
                            <span className="split-nav__item-count">{child.count}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {footer && <div className="split-nav__footer">{footer}</div>}
    </div>
  )
}
