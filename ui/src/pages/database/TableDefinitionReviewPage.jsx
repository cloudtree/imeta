import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAllTableDefinitions } from '../../hooks/useAllTableDefinitions'
import { tableDefinitionsApi } from '../../api/tableDefinitions'
import { wordsApi } from '../../api/words'
import { termsApi } from '../../api/terms'
import { domainsApi } from '../../api/domains'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import TableDefinitionSheet from './TableDefinitionSheet'
import StandardReviewPanel from './StandardReviewPanel'
import {
  TABLE_DEFINITION_EXCEL_COLUMNS,
  TABLE_DEFINITION_EXAMPLE_ROWS,
  filterDefinitionRowsByFilters,
  downloadTableDefinitionExample,
} from './tableDefinitionConstants'
import { reviewSelectedDefinitions } from './standardReviewUtils'

export default function TableDefinitionReviewPage() {
  const { data: rows, loading, error, refetch } = useAllTableDefinitions()
  const [schemaName, setSchemaName] = useState('')
  const [dbType, setDbType] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [showExcel, setShowExcel] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewGroups, setReviewGroups] = useState(null)

  const schemaOptions = useMemo(
    () => [...new Set(rows.map((row) => row.schema_name))].sort(),
    [rows],
  )

  const dbTypeOptions = useMemo(() => {
    const source = schemaName
      ? rows.filter((row) => row.schema_name === schemaName)
      : rows
    return [...new Set(source.map((row) => row.db_type))].sort()
  }, [rows, schemaName])

  useEffect(() => {
    if (!rows.length) {
      setSchemaName('')
      setDbType('')
      return
    }
    if (!schemaName || !schemaOptions.includes(schemaName)) {
      setSchemaName(schemaOptions[0] ?? '')
    }
  }, [rows, schemaOptions, schemaName])

  useEffect(() => {
    if (!rows.length) {
      setDbType('')
      return
    }
    if (!dbType || !dbTypeOptions.includes(dbType)) {
      setDbType(dbTypeOptions[0] ?? '')
    }
  }, [rows, dbTypeOptions, dbType])

  const filteredRows = useMemo(
    () => filterDefinitionRowsByFilters(rows, { schemaName, dbType, tableSearch }),
    [rows, schemaName, dbType, tableSearch],
  )

  useEffect(() => {
    const visibleIds = new Set(filteredRows.map((row) => row.def_id))
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filteredRows])

  const handleStandardReview = useCallback(async () => {
    const selectedRows = filteredRows.filter((row) => selected.has(row.def_id))
    if (!selectedRows.length) {
      alert('표준검토할 항목을 선택하세요.')
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

      setReviewGroups(reviewSelectedDefinitions(selectedRows, { words, terms, domains }))
    } catch (e) {
      alert(e.message)
    } finally {
      setReviewLoading(false)
    }
  }, [filteredRows, selected])

  const handleBulkDelete = async () => {
    if (!selected.size) return
    setDeleting(true)
    try {
      await Promise.all([...selected].map((id) => tableDefinitionsApi.delete(id)))
      setSelected(new Set())
      setShowDeleteConfirm(false)
      await refetch()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const validateExcelRow = (row) => {
    if (!row.schema_name?.trim()) return '스키마명은 필수입니다.'
    if (!row.db_type?.trim()) return 'DB종류는 필수입니다.'
    if (!row.entity_name?.trim()) return '엔티티명은 필수입니다.'
    if (!row.table_name?.trim()) return '테이블명은 필수입니다.'
    if (!row.attribute_name?.trim()) return '속성명은 필수입니다.'
    if (!row.column_name?.trim()) return '컬럼명은 필수입니다.'
    const order = Number(row.column_order)
    if (!Number.isInteger(order) || order < 1) return '컬럼명순서는 1 이상의 정수여야 합니다.'
    if (!row.data_type?.trim()) return '데이터타입은 필수입니다.'
    const pk = row.pk_yn?.trim().toUpperCase()
    if (pk && pk !== 'Y' && pk !== 'N') return 'PK여부는 Y 또는 N만 입력 가능합니다.'
    return null
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">테이블정의서검토</h1>
          <p className="page-subtitle">
            엑셀 양식으로 테이블 정의서를 등록하고 엔티티/컬럼 속성을 검토합니다.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selected.size > 0 && (
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
            >
              {deleting ? <span className="spinner" /> : null}
              선택 삭제 ({selected.size}건)
            </button>
          )}
          <button
            className={`btn ${selected.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleStandardReview}
            disabled={loading || reviewLoading || selected.size === 0}
          >
            {reviewLoading ? <span className="spinner" /> : null}
            표준검토
          </button>
          <button className="btn btn-secondary" onClick={() => refetch()} disabled={loading}>
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

      <div className={`definition-review-split${reviewGroups ? ' definition-review-split--with-panel' : ''}`}>
        <div className="card definition-review-sheet">
          <TableDefinitionSheet
            rows={filteredRows}
            loading={loading}
            error={error}
            schemaName={schemaName}
            dbType={dbType}
            tableSearch={tableSearch}
            schemaOptions={schemaOptions}
            dbTypeOptions={dbTypeOptions}
            onSchemaChange={(value) => {
              setSchemaName(value)
              setTableSearch('')
              setSelected(new Set())
              setReviewGroups(null)
            }}
            onDbTypeChange={(value) => {
              setDbType(value)
              setTableSearch('')
              setSelected(new Set())
              setReviewGroups(null)
            }}
            onTableSearchChange={(value) => {
              setTableSearch(value)
              setReviewGroups(null)
            }}
            selected={selected}
            onSelectionChange={setSelected}
            emptyText={
              tableSearch.trim()
                ? '검색 조건에 맞는 테이블 정의서가 없습니다.'
                : rows.length
                  ? '선택한 조건에 맞는 컬럼 정의가 없습니다.'
                  : '등록된 테이블 정의서가 없습니다. 엑셀 등록을 이용하세요.'
            }
          />
        </div>

        {reviewGroups && (
          <div className="card definition-review-panel">
            <StandardReviewPanel
              groups={reviewGroups}
              onClose={() => setReviewGroups(null)}
            />
          </div>
        )}
      </div>

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
            refetch()
          }}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          message={`선택한 ${selected.size}건의 컬럼 정의를 삭제하시겠습니까?`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          loading={deleting}
        />
      )}
    </div>
  )
}
