export const TABLE_DEFINITION_EXAMPLE_ROWS = [
  {
    schema_nm: 'public',
    db_type_nm: 'PostgreSQL',
    entity_nm: '표준도메인',
    table_nm: 'domains',
    attribute_nm: '도메인ID',
    column_nm: 'std_domain_id',
    column_ord: '1',
    pk_yn: 'Y',
    data_type_nm: 'int4',
    data_len: '',
    domain_nm: 'ID도메인',
    info_type_nm: 'NUMC',
  },
  {
    schema_nm: 'public',
    db_type_nm: 'PostgreSQL',
    entity_nm: '표준도메인',
    table_nm: 'domains',
    attribute_nm: '도메인명',
    column_nm: 'domain_nm',
    column_ord: '2',
    pk_yn: 'N',
    data_type_nm: 'varchar',
    data_len: '100',
    domain_nm: '명칭도메인',
    info_type_nm: 'CHAR',
  },
  {
    schema_nm: 'public',
    db_type_nm: 'PostgreSQL',
    entity_nm: '표준도메인',
    table_nm: 'domains',
    attribute_nm: '데이터타입',
    column_nm: 'data_type_nm',
    column_ord: '3',
    pk_yn: 'N',
    data_type_nm: 'varchar',
    data_len: '20',
    domain_nm: '코드도메인',
    info_type_nm: 'CHAR',
  },
  {
    schema_nm: 'public',
    db_type_nm: 'PostgreSQL',
    entity_nm: '표준단어',
    table_nm: 'words',
    attribute_nm: '단어ID',
    column_nm: 'std_word_id',
    column_ord: '1',
    pk_yn: 'Y',
    data_type_nm: 'int4',
    data_len: '',
    domain_nm: 'ID도메인',
    info_type_nm: 'NUMC',
  },
  {
    schema_nm: 'public',
    db_type_nm: 'PostgreSQL',
    entity_nm: '표준단어',
    table_nm: 'words',
    attribute_nm: '단어명',
    column_nm: 'std_word_nm',
    column_ord: '2',
    pk_yn: 'N',
    data_type_nm: 'varchar',
    data_len: '15',
    domain_nm: '명칭도메인',
    info_type_nm: 'CHAR',
  },
]

export function downloadTableDefinitionExample() {
  import('xlsx').then((XLSX) => {
    const header = TABLE_DEFINITION_EXCEL_COLUMNS.map((c) => (c.required ? `${c.label} *` : c.label))
    const rows = TABLE_DEFINITION_EXAMPLE_ROWS.map((row) =>
      TABLE_DEFINITION_EXCEL_COLUMNS.map((col) => String(row[col.key] ?? '')),
    )
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = TABLE_DEFINITION_EXCEL_COLUMNS.map(() => ({ wch: 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '예제')
    XLSX.writeFile(wb, '테이블정의서_예제.xlsx')
  })
}

export const TABLE_DEFINITION_EXCEL_COLUMNS = [
  { key: 'schema_nm', label: '스키마명', required: true, example: 'public' },
  { key: 'db_type_nm', label: 'DB종류', required: true, example: 'PostgreSQL' },
  { key: 'entity_nm', label: '엔티티명', required: true, example: '표준도메인' },
  { key: 'table_nm', label: '테이블명', required: true, example: 'domains' },
  { key: 'attribute_nm', label: '속성명', required: true, example: '도메인ID' },
  { key: 'column_nm', label: '컬럼명', required: true, example: 'std_domain_id' },
  { key: 'column_ord', label: '컬럼명순서', required: true, example: '1' },
  { key: 'pk_yn', label: 'PK여부', required: true, example: 'Y' },
  { key: 'data_type_nm', label: '데이터타입', required: true, example: 'int4' },
  { key: 'data_len', label: '데이터길이', required: false, example: '', asText: true },
  { key: 'domain_nm', label: '도메인명', required: false, example: 'ID도메인' },
  { key: 'info_type_nm', label: '인포타입', required: false, example: 'NUMC' },
]

export const UPLOADED_DEFINITION_COLUMNS = [
  { key: 'attribute_nm', label: '속성명' },
  { key: 'column_nm', label: '컬럼명' },
  { key: 'pk_yn', label: 'PK', render: (v) => (
    <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>
  ) },
  { key: 'data_type_nm', label: '데이터타입' },
  { key: 'data_len', label: '데이터길이', render: (v) => v || '-' },
  { key: 'domain_nm', label: '도메인명', render: (v) => v || '-' },
  { key: 'info_type_nm', label: '인포타입', render: (v) => v || '-' },
]

export const FILTERED_DEFINITION_COLUMNS = [
  { key: 'entity_nm', label: '엔티티명', sortable: true },
  { key: 'table_nm', label: '테이블명', sortable: true },
  ...UPLOADED_DEFINITION_COLUMNS,
]

export function filterUploadedDefinitionColumns(columns, search) {
  const q = search.trim().toLowerCase()
  if (!q) return columns

  return columns.filter((column) =>
    column.attribute_nm?.toLowerCase().includes(q)
    || column.column_nm?.toLowerCase().includes(q)
    || column.data_type_nm?.toLowerCase().includes(q)
    || column.data_len?.toLowerCase().includes(q)
    || column.domain_nm?.toLowerCase().includes(q)
    || column.info_type_nm?.toLowerCase().includes(q)
    || column.pk_yn?.toLowerCase().includes(q),
  )
}

export function filterUploadedTableRows(tables, search) {
  const q = search.trim().toLowerCase()
  if (!q) return tables

  return tables.filter((row) =>
    row.schema_nm?.toLowerCase().includes(q)
    || row.db_type_nm?.toLowerCase().includes(q)
    || row.entity_nm?.toLowerCase().includes(q)
    || row.table_nm?.toLowerCase().includes(q)
    || row.pk_columns?.toLowerCase().includes(q),
  )
}

export function filterDefinitionRowsByFilters(rows, { schemaName, dbType, tableSearch }) {
  const q = tableSearch.trim().toLowerCase()

  return rows.filter((row) => {
    if (schemaName && row.schema_nm !== schemaName) return false
    if (dbType && row.db_type_nm !== dbType) return false
    if (q) {
      const matchesTable =
        row.table_nm?.toLowerCase().includes(q)
        || row.entity_nm?.toLowerCase().includes(q)
      if (!matchesTable) return false
    }
    return true
  })
}
