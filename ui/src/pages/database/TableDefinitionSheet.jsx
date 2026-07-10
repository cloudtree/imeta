import DataTable from '../../components/common/DataTable'
import SearchBar from '../../components/common/SearchBar'
import { FILTERED_DEFINITION_COLUMNS } from './tableDefinitionConstants'

export default function TableDefinitionSheet({
  rows = [],
  loading = false,
  error = null,
  emptyText = '등록된 테이블 정의서가 없습니다. 엑셀 등록을 이용하세요.',
  schemaName = '',
  dbType = '',
  tableSearch = '',
  schemaOptions = [],
  dbTypeOptions = [],
  onSchemaChange,
  onDbTypeChange,
  onTableSearchChange,
  selected = new Set(),
  onSelectionChange,
}) {
  return (
    <div className="definition-sheet">
      <div className="definition-sheet__header">
        <h2 className="definition-sheet__title">테이블 정의서</h2>
        <div className="definition-sheet__filters">
          <label className="definition-sheet__filter">
            <span className="definition-sheet__filter-label">스키마명</span>
            <select
              className="form-control"
              value={schemaName}
              onChange={(e) => onSchemaChange?.(e.target.value)}
              disabled={!schemaOptions.length}
            >
              {!schemaOptions.length && <option value="">스키마 없음</option>}
              {schemaOptions.map((schema) => (
                <option key={schema} value={schema}>{schema}</option>
              ))}
            </select>
          </label>
          <label className="definition-sheet__filter">
            <span className="definition-sheet__filter-label">DB종류</span>
            <select
              className="form-control"
              value={dbType}
              onChange={(e) => onDbTypeChange?.(e.target.value)}
              disabled={!dbTypeOptions.length}
            >
              {!dbTypeOptions.length && <option value="">DB종류 없음</option>}
              {dbTypeOptions.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="definition-sheet__filter definition-sheet__filter--search">
            <span className="definition-sheet__filter-label">테이블</span>
            <SearchBar
              value={tableSearch}
              onChange={onTableSearchChange}
              placeholder="테이블명, 엔티티명 검색"
            />
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-overlay"><span className="spinner" /></div>
      ) : (
        <DataTable
          columns={FILTERED_DEFINITION_COLUMNS}
          rows={rows}
          rowKey="table_def_id"
          showRowNumber
          selectable
          selected={selected}
          onSelectionChange={onSelectionChange}
          emptyText={emptyText}
        />
      )}
    </div>
  )
}
