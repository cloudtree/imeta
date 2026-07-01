import { useState, useMemo } from 'react'

/**
 * columns: [{ key, label, sortable?, render?, align? }]
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
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
            )}
            {showRowNumber && (
              <th style={{ width: '48px', textAlign: 'center' }}>No.</th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  col.sortable ? 'sortable' : '',
                  sortKey === col.key ? `sort-${sortDir}` : '',
                ].filter(Boolean).join(' ')}
                style={{ textAlign: col.align ?? 'center' }}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable && (
                  <span className="sort-icon">
                    {sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
                  </span>
                )}
              </th>
            ))}
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
                  style={{ background: isSelected ? '#eff6ff' : undefined }}
                >
                  {selectable && (
                    <td style={{ textAlign: 'center', width: '40px' }} onClick={(e) => toggleRow(e, key)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  {showRowNumber && (
                    <td style={{ textAlign: 'center', width: '48px', color: '#9ca3af', fontWeight: 600 }}>
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
