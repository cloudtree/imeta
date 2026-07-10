import { useState, useMemo } from 'react'

/**
 * columns: [{ key, label, sortable?, render?, align?, hint? }]
 * rows: array of objects
 * rowKey: 행 고유 키 필드명 (기본 'id')
 * onRowClick: (row) => void
 * selectable: true 이면 체크박스 열 표시
 * selected: Set<string|number>  선택된 키 집합
 * onSelectionChange: (newSet) => void
 */
export default function DataTable({
  columns, rows, onRowClick, emptyText = '데이터가 없습니다.',
  selectable = false, selected = new Set(), onSelectionChange, rowKey = 'id',
  showRowNumber = false, rowNumberOffset = 0,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'ko')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const allKeys      = sortedRows.map((r) => r[rowKey])
  const allSelected  = allKeys.length > 0 && allKeys.every((k) => selected.has(k))
  const someSelected = allKeys.some((k) => selected.has(k))

  const toggleAll = (e) => {
    e.stopPropagation()
    if (allSelected) {
      const next = new Set(selected)
      allKeys.forEach((k) => next.delete(k))
      onSelectionChange?.(next)
    } else {
      const next = new Set(selected)
      allKeys.forEach((k) => next.add(k))
      onSelectionChange?.(next)
    }
  }

  const toggleRow = (e, key) => {
    e.stopPropagation()
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    onSelectionChange?.(next)
  }

  const colSpan = columns.length + (selectable ? 1 : 0) + (showRowNumber ? 1 : 0)

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {selectable && (
              <th className="data-table__th data-table__th--check" scope="col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={toggleAll}
                  aria-label="전체 선택"
                />
              </th>
            )}
            {showRowNumber && (
              <th className="data-table__th data-table__th--num" scope="col">
                <span className="data-table__th-label">No</span>
              </th>
            )}
            {columns.map((col) => {
              const isSorted = sortKey === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={[
                    'data-table__th',
                    col.sortable ? 'data-table__th--sortable' : '',
                    isSorted ? `data-table__th--sorted data-table__th--${sortDir}` : '',
                  ].filter(Boolean).join(' ')}
                  style={{ textAlign: col.align ?? 'center' }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  title={col.hint || col.label}
                >
                  <span className="data-table__th-inner">
                    <span className="data-table__th-label">{col.label}</span>
                    {col.sortable ? (
                      <span
                        className={`data-table__sort${isSorted ? ' is-active' : ''}`}
                        aria-hidden
                      >
                        {isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    ) : null}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty">{emptyText}</td>
            </tr>
          ) : (
            sortedRows.map((row, i) => {
              const key        = row[rowKey] ?? i
              const isSelected = selected.has(key)
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={isSelected ? 'is-selected' : undefined}
                >
                  {selectable && (
                    <td className="data-table__td--check" onClick={(e) => toggleRow(e, key)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        aria-label="행 선택"
                      />
                    </td>
                  )}
                  {showRowNumber && (
                    <td className="data-table__td--num">
                      {rowNumberOffset + i + 1}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} style={{ textAlign: col.align ?? 'center' }}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
