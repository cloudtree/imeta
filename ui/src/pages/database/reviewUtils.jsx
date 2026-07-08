export const COLUMN_DEF_COLUMNS = [
  { key: 'seq_no', label: '순번' },
  { key: 'column_name', label: '컬럼명' },
  { key: 'column_comment', label: '컬럼설명', render: (v) => v || '-' },
  { key: 'data_type', label: '데이터타입' },
  { key: 'length_precision', label: '길이/정밀도' },
  {
    key: 'pk_yn',
    label: 'PK',
    render: (v) => (
      <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>
    ),
  },
  { key: 'fk_ref', label: 'FK', render: (v) => v || '-' },
  {
    key: 'nullable_yn',
    label: 'NULL',
    render: (v) => (
      <span className={`badge ${v === 'Y' ? 'badge-gray' : 'badge-blue'}`}>{v}</span>
    ),
  },
  { key: 'default_value', label: '기본값', render: (v) => v || '-' },
]

export function getMatchedColumns(row, query) {
  return (row.columns ?? []).filter(
    (column) =>
      column.column_name?.toLowerCase().includes(query)
      || column.column_comment?.toLowerCase().includes(query),
  )
}

export function matchesTableRow(row, query) {
  if (row.schema_name?.toLowerCase().includes(query)) return true
  if (row.table_name?.toLowerCase().includes(query)) return true
  if (row.table_comment?.toLowerCase().includes(query)) return true
  if (row.pk_columns?.toLowerCase().includes(query)) return true
  return getMatchedColumns(row, query).length > 0
}

export function filterTableRows(tables, search) {
  const q = search.trim().toLowerCase()
  if (!q) {
    return tables.map((row) => ({ ...row, matched_columns: '' }))
  }

  return tables
    .filter((row) => matchesTableRow(row, q))
    .map((row) => {
      const matched = getMatchedColumns(row, q)
      return {
        ...row,
        matched_columns: matched.length
          ? matched.map((column) => column.column_name).join(', ')
          : '테이블 매칭',
      }
    })
}

export function filterDefinitionColumns(columns, search) {
  const q = search.trim().toLowerCase()
  if (!q) return columns

  return columns.filter((column) =>
    column.column_name?.toLowerCase().includes(q)
    || column.column_comment?.toLowerCase().includes(q)
    || column.data_type?.toLowerCase().includes(q)
    || column.fk_ref?.toLowerCase().includes(q)
    || column.default_value?.toLowerCase().includes(q)
    || column.pk_yn?.toLowerCase().includes(q)
    || column.nullable_yn?.toLowerCase().includes(q),
  )
}
