/**
 * 중앙 메타데이터 요약 목록 (Finder/Notes 스타일)
 * rows: 데이터 배열
 * getRow: (row) => { id, primary, secondary, meta, status, statusTone }
 */
export default function MetaList({
  rows = [],
  getRow,
  selectedId,
  onSelect,
  selectable = false,
  selectedIds,
  onSelectionChange,
  emptyText = '항목이 없습니다.',
  loading = false,
}) {
  const toggleCheck = (id, e) => {
    e.stopPropagation()
    if (!onSelectionChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(next)
  }

  const toggleAll = (e) => {
    if (!onSelectionChange) return
    if (e.target.checked) {
      onSelectionChange(new Set(rows.map((r) => getRow(r).id)))
    } else {
      onSelectionChange(new Set())
    }
  }

  const allChecked = selectable && rows.length > 0
    && rows.every((r) => selectedIds?.has(getRow(r).id))

  if (loading) {
    return (
      <div className="meta-list meta-list--loading">
        <span className="spinner" />
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="meta-list meta-list--empty">
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="meta-list">
      {selectable && (
        <div className="meta-list__toolbar">
          <label className="meta-list__check-all">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <span>전체 선택</span>
          </label>
          {selectedIds?.size > 0 && (
            <span className="meta-list__sel-count">{selectedIds.size}건 선택</span>
          )}
        </div>
      )}
      <ul className="meta-list__items" role="listbox">
        {rows.map((row) => {
          const item = getRow(row)
          const isActive = selectedId === item.id
          const isChecked = selectedIds?.has(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                className={`meta-list__row ${isActive ? 'is-active' : ''}`}
                onClick={() => onSelect?.(row)}
              >
                {selectable && (
                  <span
                    className="meta-list__check"
                    onClick={(e) => toggleCheck(item.id, e)}
                    onKeyDown={() => {}}
                    role="presentation"
                  >
                    <input
                      type="checkbox"
                      checked={!!isChecked}
                      onChange={(e) => toggleCheck(item.id, e)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </span>
                )}
                <span className="meta-list__body">
                  <span className="meta-list__primary">{item.primary}</span>
                  {item.secondary && (
                    <span className="meta-list__secondary">{item.secondary}</span>
                  )}
                  {item.meta && (
                    <span className="meta-list__meta">{item.meta}</span>
                  )}
                </span>
                {item.status && (
                  <span className={`meta-list__status meta-list__status--${item.statusTone || 'neutral'}`}>
                    {item.status}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
