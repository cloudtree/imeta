export const TABLE_DEFINITION_EXAMPLE_ROWS = [
  {
    schema_name: 'public',
    db_type: 'PostgreSQL',
    entity_name: '표준도메인',
    table_name: 'domains',
    attribute_name: '도메인ID',
    column_name: 'domain_id',
    column_order: '1',
    pk_yn: 'Y',
    data_type: 'int4',
    data_length: '',
    domain_name: 'ID도메인',
    infotype: 'NUMC',
  },
  {
    schema_name: 'public',
    db_type: 'PostgreSQL',
    entity_name: '표준도메인',
    table_name: 'domains',
    attribute_name: '도메인명',
    column_name: 'domain_nm',
    column_order: '2',
    pk_yn: 'N',
    data_type: 'varchar',
    data_length: '100',
    domain_name: '명칭도메인',
    infotype: 'CHAR',
  },
  {
    schema_name: 'public',
    db_type: 'PostgreSQL',
    entity_name: '표준도메인',
    table_name: 'domains',
    attribute_name: '데이터타입',
    column_name: 'data_type',
    column_order: '3',
    pk_yn: 'N',
    data_type: 'varchar',
    data_length: '20',
    domain_name: '코드도메인',
    infotype: 'CHAR',
  },
  {
    schema_name: 'public',
    db_type: 'PostgreSQL',
    entity_name: '표준단어',
    table_name: 'words',
    attribute_name: '단어ID',
    column_name: 'word_id',
    column_order: '1',
    pk_yn: 'Y',
    data_type: 'int4',
    data_length: '',
    domain_name: 'ID도메인',
    infotype: 'NUMC',
  },
  {
    schema_name: 'public',
    db_type: 'PostgreSQL',
    entity_name: '표준단어',
    table_name: 'words',
    attribute_name: '단어명',
    column_name: 'word_nm',
    column_order: '2',
    pk_yn: 'N',
    data_type: 'varchar',
    data_length: '15',
    domain_name: '명칭도메인',
    infotype: 'CHAR',
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
  { key: 'schema_name', label: '스키마명', required: true, example: 'public' },
  { key: 'db_type', label: 'DB종류', required: true, example: 'PostgreSQL' },
  { key: 'entity_name', label: '엔티티명', required: true, example: '표준도메인' },
  { key: 'table_name', label: '테이블명', required: true, example: 'domains' },
  { key: 'attribute_name', label: '속성명', required: true, example: '도메인ID' },
  { key: 'column_name', label: '컬럼명', required: true, example: 'domain_id' },
  { key: 'column_order', label: '컬럼명순서', required: true, example: '1' },
  { key: 'pk_yn', label: 'PK여부', required: true, example: 'Y' },
  { key: 'data_type', label: '데이터타입', required: true, example: 'int4' },
  { key: 'data_length', label: '데이터길이', required: false, example: '', asText: true },
  { key: 'domain_name', label: '도메인명', required: false, example: 'ID도메인' },
  { key: 'infotype', label: '인포타입', required: false, example: 'NUMC' },
]

export const UPLOADED_DEFINITION_COLUMNS = [
  { key: 'attribute_name', label: '속성명' },
  { key: 'column_name', label: '컬럼명' },
  { key: 'pk_yn', label: 'PK', render: (v) => (
    <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>
  ) },
  { key: 'data_type', label: '데이터타입' },
  { key: 'data_length', label: '데이터길이', render: (v) => v || '-' },
  { key: 'domain_name', label: '도메인명', render: (v) => v || '-' },
  { key: 'infotype', label: '인포타입', render: (v) => v || '-' },
]

export const FILTERED_DEFINITION_COLUMNS = [
  { key: 'entity_name', label: '엔티티명', sortable: true },
  { key: 'table_name', label: '테이블명', sortable: true },
  ...UPLOADED_DEFINITION_COLUMNS,
]

export function filterUploadedDefinitionColumns(columns, search) {
  const q = search.trim().toLowerCase()
  if (!q) return columns

  return columns.filter((column) =>
    column.attribute_name?.toLowerCase().includes(q)
    || column.column_name?.toLowerCase().includes(q)
    || column.data_type?.toLowerCase().includes(q)
    || column.data_length?.toLowerCase().includes(q)
    || column.domain_name?.toLowerCase().includes(q)
    || column.infotype?.toLowerCase().includes(q)
    || column.pk_yn?.toLowerCase().includes(q),
  )
}

export function filterUploadedTableRows(tables, search) {
  const q = search.trim().toLowerCase()
  if (!q) return tables

  return tables.filter((row) =>
    row.schema_name?.toLowerCase().includes(q)
    || row.db_type?.toLowerCase().includes(q)
    || row.entity_name?.toLowerCase().includes(q)
    || row.table_name?.toLowerCase().includes(q)
    || row.pk_columns?.toLowerCase().includes(q),
  )
}

export function filterDefinitionRowsByFilters(rows, { schemaName, dbType, tableSearch }) {
  const q = tableSearch.trim().toLowerCase()

  return rows.filter((row) => {
    if (schemaName && row.schema_name !== schemaName) return false
    if (dbType && row.db_type !== dbType) return false
    if (q) {
      const matchesTable =
        row.table_name?.toLowerCase().includes(q)
        || row.entity_name?.toLowerCase().includes(q)
      if (!matchesTable) return false
    }
    return true
  })
}
