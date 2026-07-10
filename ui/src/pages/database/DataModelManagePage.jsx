import { useCallback, useEffect, useMemo, useState } from 'react'
import { tableDefinitionsApi } from '../../api/tableDefinitions'
import { wordsApi } from '../../api/words'
import { termsApi } from '../../api/terms'
import { domainsApi } from '../../api/domains'
import SplitView from '../../components/common/SplitView'
import SplitNav from '../../components/common/SplitNav'
import SplitDetail from '../../components/common/SplitDetail'
import MetaList from '../../components/common/MetaList'
import SearchBar from '../../components/common/SearchBar'
import DataTable from '../../components/common/DataTable'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import StandardReviewPanel from './StandardReviewPanel'
import TableDdlPanel from './TableDdlPanel'
import {
  TABLE_DEFINITION_EXCEL_COLUMNS,
  TABLE_DEFINITION_EXAMPLE_ROWS,
  UPLOADED_DEFINITION_COLUMNS,
  downloadTableDefinitionExample,
  filterUploadedTableRows,
} from './tableDefinitionConstants'
import { reviewSelectedDefinitions } from './standardReviewUtils'

function tableId(row) {
  return row.table_key || `${row.schema_nm}|${row.db_type_nm}|${row.table_nm}`
}

function validateExcelRow(row) {
  if (!row.schema_nm?.trim()) return '스키마명은 필수입니다.'
  if (!row.db_type_nm?.trim()) return 'DB종류는 필수입니다.'
  if (!row.entity_nm?.trim()) return '엔티티명은 필수입니다.'
  if (!row.table_nm?.trim()) return '테이블명은 필수입니다.'
  if (!row.attribute_nm?.trim()) return '속성명은 필수입니다.'
  if (!row.column_nm?.trim()) return '컬럼명은 필수입니다.'
  const order = Number(row.column_ord)
  if (!Number.isInteger(order) || order < 1) return '컬럼명순서는 1 이상의 정수여야 합니다.'
  if (!row.data_type_nm?.trim()) return '데이터타입은 필수입니다.'
  const pk = row.pk_yn?.trim().toUpperCase()
  if (pk && pk !== 'Y' && pk !== 'N') return 'PK여부는 Y 또는 N만 입력 가능합니다.'
  return null
}

export default function DataModelManagePage() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [schemaFilter, setSchemaFilter] = useState('')
  const [search, setSearch] = useState('')

  const [selectedTable, setSelectedTable] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const [selectedCols, setSelectedCols] = useState(new Set())
  const [selectedTables, setSelectedTables] = useState(new Set())
  const [showExcel, setShowExcel] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewGroups, setReviewGroups] = useState(null)

  const loadTables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tableDefinitionsApi.getTables({ use_yn: 'Y' })
      setTables(Array.isArray(res) ? res : (res.items ?? []))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTables() }, [loadTables])

  const schemaNav = useMemo(() => {
    const map = new Map()
    for (const t of tables) {
      const key = t.schema_nm || '미지정'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ko'))
      .map(([id, count]) => ({ id, label: id, count }))
  }, [tables])

  const filteredTables = useMemo(() => {
    let rows = tables
    if (schemaFilter) {
      rows = rows.filter((t) => (t.schema_nm || '미지정') === schemaFilter)
    }
    return filterUploadedTableRows(rows, search)
  }, [tables, schemaFilter, search])

  const loadDetail = useCallback(async (table) => {
    if (!table) {
      setDetail(null)
      setDetailError(null)
      return
    }
    setDetailLoading(true)
    setDetailError(null)
    setSelectedCols(new Set())
    setReviewGroups(null)
    try {
      const res = await tableDefinitionsApi.getTableDetail({
        schema_nm: table.schema_nm,
        db_type_nm: table.db_type_nm,
        table_nm: table.table_nm,
      })
      setDetail(res)
    } catch (e) {
      setDetail(null)
      setDetailError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openTable = (table) => {
    setSelectedTable(table)
    loadDetail(table)
  }

  const closeDetail = () => {
    setSelectedTable(null)
    setDetail(null)
    setDetailError(null)
    setSelectedCols(new Set())
    setReviewGroups(null)
  }

  const handleDeleteTable = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await tableDefinitionsApi.deleteTable({
        schema_nm: deleteTarget.schema_nm,
        db_type_nm: deleteTarget.db_type_nm,
        table_nm: deleteTarget.table_nm,
      })
      const id = tableId(deleteTarget)
      setDeleteTarget(null)
      if (selectedTable && tableId(selectedTable) === id) closeDetail()
      setSelectedTables((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await loadTables()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDeleteTables = async () => {
    if (!selectedTables.size) return
    if (!window.confirm(`선택한 ${selectedTables.size}개 테이블 정의서를 삭제하시겠습니까?`)) return
    setBulkDeleting(true)
    try {
      const targets = tables.filter((t) => selectedTables.has(tableId(t)))
      await Promise.all(targets.map((t) => tableDefinitionsApi.deleteTable({
        schema_nm: t.schema_nm,
        db_type_nm: t.db_type_nm,
        table_nm: t.table_nm,
      })))
      if (selectedTable && selectedTables.has(tableId(selectedTable))) closeDetail()
      setSelectedTables(new Set())
      await loadTables()
    } catch (e) {
      alert(e.message)
      await loadTables()
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleStandardReview = useCallback(async () => {
    const cols = detail?.columns?.filter((c) => selectedCols.has(c.table_def_id)) ?? []
    if (!cols.length) {
      alert('표준검토할 컬럼을 선택하세요.')
      return
    }
    setReviewLoading(true)
    try {
      const [wordsRes, termsRes, domainsRes] = await Promise.all([
        wordsApi.dictionary(),
        termsApi.getAll({ limit: 10000, use_yn: 'Y' }),
        domainsApi.getAll({ limit: 10000, use_yn: 'Y' }),
      ])
      const words = Array.isArray(wordsRes) ? wordsRes : (wordsRes.items ?? [])
      const terms = Array.isArray(termsRes) ? termsRes : (termsRes.items ?? [])
      const domains = Array.isArray(domainsRes) ? domainsRes : (domainsRes.items ?? [])
      setReviewGroups(reviewSelectedDefinitions(cols, { words, terms, domains }))
    } catch (e) {
      alert(e.message)
    } finally {
      setReviewLoading(false)
    }
  }, [detail, selectedCols])

  const getRow = (row) => ({
    id: tableId(row),
    primary: row.entity_nm || row.table_nm,
    secondary: row.table_nm,
    meta: [
      row.schema_nm,
      row.db_type_nm,
      row.column_count != null ? `${row.column_count}컬럼` : null,
      row.pk_columns ? `PK ${row.pk_columns}` : null,
    ].filter(Boolean).join(' · '),
  })

  const detailOpen = selectedTable != null

  return (
    <div className="split-page split-page--with-ddl">
      <div className="split-page__header">
        <div>
          <h1 className="page-title">데이터 모델 관리</h1>
          <p className="page-subtitle">
            테이블 정의서 데이터를 스키마·테이블 단위로 조회하고 관리합니다.
          </p>
        </div>
        <div className="split-page__actions">
          {selectedTables.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDeleteTables} disabled={bulkDeleting}>
              {bulkDeleting ? <span className="spinner" /> : null}
              선택 삭제 ({selectedTables.size})
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => loadTables()} disabled={loading}>
            새로고침
          </button>
          <button className="btn btn-secondary" onClick={downloadTableDefinitionExample}>
            예제 양식
          </button>
          <button className="btn btn-primary" onClick={() => setShowExcel(true)}>
            엑셀 등록
          </button>
        </div>
      </div>

      <SplitView
        detailOpen={detailOpen}
        left={(
          <SplitNav
            title="스키마"
            allLabel="전체 테이블"
            allCount={tables.length}
            items={schemaNav}
            selectedId={schemaFilter}
            onSelect={setSchemaFilter}
          />
        )}
        center={(
          <div className="split-list-chrome">
            <div className="split-list-chrome__toolbar">
              <div className="split-list-chrome__title-row">
                <span className="split-list-chrome__title">
                  테이블 목록
                  <span className="split-list-chrome__count"> · {filteredTables.length}건</span>
                </span>
              </div>
              <div className="split-list-chrome__filters">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="엔티티명, 테이블명, 스키마 검색"
                />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>}
            <div className="split-list-chrome__body">
              <MetaList
                rows={filteredTables}
                getRow={getRow}
                selectedId={selectedTable ? tableId(selectedTable) : null}
                onSelect={openTable}
                selectable
                selectedIds={selectedTables}
                onSelectionChange={setSelectedTables}
                loading={loading}
                emptyText="등록된 테이블 정의서가 없습니다. 엑셀 등록을 이용하세요."
              />
            </div>
          </div>
        )}
        right={(
          <SplitDetail
            empty={!detailOpen}
            emptyTitle="테이블을 선택하세요"
            emptyHint="목록에서 테이블을 클릭하면 컬럼 정의와 표준 검토를 확인할 수 있습니다."
            title={detail?.entity_nm || selectedTable?.entity_nm || selectedTable?.table_nm || '테이블 상세'}
            subtitle={
              selectedTable
                ? [
                    selectedTable.schema_nm,
                    selectedTable.db_type_nm,
                    selectedTable.table_nm,
                  ].filter(Boolean).join(' · ')
                : null
            }
            onClose={closeDetail}
            footer={(
              <>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginRight: 'auto' }}
                  onClick={() => setDeleteTarget(selectedTable)}
                >
                  테이블 삭제
                </button>
                <button
                  className={`btn btn-sm ${selectedCols.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={handleStandardReview}
                  disabled={detailLoading || reviewLoading || selectedCols.size === 0}
                >
                  {reviewLoading ? <span className="spinner" /> : null}
                  표준검토{selectedCols.size > 0 ? ` (${selectedCols.size})` : ''}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={closeDetail}>닫기</button>
              </>
            )}
          >
            {detailError && <div className="alert alert-error">{detailError}</div>}
            {detailLoading ? (
              <div className="meta-list meta-list--loading"><span className="spinner" /></div>
            ) : detail ? (
              <>
                <div className="definition-sheet__meta" style={{ marginBottom: 12 }}>
                  <div className="definition-sheet__meta-item">
                    <span className="definition-sheet__meta-label">컬럼</span>
                    <span>{detail.total ?? detail.columns?.length ?? 0}</span>
                  </div>
                  <div className="definition-sheet__meta-item definition-sheet__meta-item--wide">
                    <span className="definition-sheet__meta-label">PK</span>
                    <span>{detail.pk_columns || '-'}</span>
                  </div>
                </div>
                <DataTable
                  columns={UPLOADED_DEFINITION_COLUMNS}
                  rows={detail.columns ?? []}
                  rowKey="table_def_id"
                  showRowNumber
                  selectable
                  selected={selectedCols}
                  onSelectionChange={setSelectedCols}
                  emptyText="컬럼 정의가 없습니다."
                />
                {reviewGroups && (
                  <div style={{ marginTop: 16 }}>
                    <StandardReviewPanel
                      groups={reviewGroups}
                      onClose={() => setReviewGroups(null)}
                    />
                  </div>
                )}
              </>
            ) : null}
          </SplitDetail>
        )}
      />

      <TableDdlPanel
        table={detail}
        loading={detailOpen && detailLoading}
      />

      {showExcel && (
        <ExcelUploadModal
          title="테이블정의서"
          columns={TABLE_DEFINITION_EXCEL_COLUMNS}
          exampleRows={TABLE_DEFINITION_EXAMPLE_ROWS}
          validateRow={validateExcelRow}
          onUpload={(rows) => tableDefinitionsApi.bulk(rows)}
          onClose={() => setShowExcel(false)}
          onDone={() => {
            setShowExcel(false)
            loadTables()
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.entity_nm || deleteTarget.table_nm}" 테이블 정의서(${deleteTarget.column_count ?? ''}컬럼)를 삭제하시겠습니까?`}
          onConfirm={handleDeleteTable}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}
