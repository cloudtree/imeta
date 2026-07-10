import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDbServers } from '../../hooks/useDbServers'
import { dbServersApi } from '../../api/dbServers'
import { wordsApi } from '../../api/words'
import { termsApi } from '../../api/terms'
import { domainsApi } from '../../api/domains'
import TableDefinitionSheet from './TableDefinitionSheet'
import StandardReviewPanel from './StandardReviewPanel'
import { filterDefinitionRowsByFilters } from './tableDefinitionConstants'
import { reviewSelectedDefinitions } from './standardReviewUtils'

export default function DatabaseReviewPage() {
  const { data: servers, loading: serversLoading } = useDbServers({ use_yn: 'Y' })

  const [selectedServerId, setSelectedServerId] = useState('')
  const [rows, setRows] = useState([])
  const [serverInfo, setServerInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [schemaName, setSchemaName] = useState('')
  const [dbType, setDbType] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewGroups, setReviewGroups] = useState(null)

  useEffect(() => {
    if (!selectedServerId && servers.length) {
      setSelectedServerId(String(servers[0].server_id))
    }
  }, [servers, selectedServerId])

  const loadDefinitions = useCallback(async () => {
    if (!selectedServerId) return
    setLoading(true)
    setError(null)
    setRows([])
    setServerInfo(null)
    setSelected(new Set())
    setReviewGroups(null)
    setTableSearch('')
    try {
      const res = await dbServersApi.getSchemaDefinitions(selectedServerId)
      setRows(res.items ?? [])
      setServerInfo(res.server ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedServerId])

  useEffect(() => {
    if (selectedServerId) loadDefinitions()
  }, [selectedServerId, loadDefinitions])

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">데이터베이스검토</h1>
          <p className="page-subtitle">
            등록된 DB 스키마를 테이블 정의서 형식으로 조회하고 표준을 검토합니다.
            {serverInfo ? ` (${serverInfo.server_name} / ${serverInfo.database_name})` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="form-control"
            style={{ minWidth: '220px' }}
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            disabled={serversLoading || !servers.length}
          >
            {!servers.length && <option value="">등록된 서버 없음</option>}
            {servers.map((server) => (
              <option key={server.server_id} value={server.server_id}>
                {server.server_name} ({server.database_name})
              </option>
            ))}
          </select>
          <button
            className={`btn ${selected.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleStandardReview}
            disabled={loading || reviewLoading || selected.size === 0}
          >
            {reviewLoading ? <span className="spinner" /> : null}
            표준검토
          </button>
          <button
            className="btn btn-secondary"
            onClick={loadDefinitions}
            disabled={!selectedServerId || loading}
          >
            새로고침
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
                ? '검색 조건에 맞는 테이블이 없습니다.'
                : rows.length
                  ? '선택한 조건에 맞는 컬럼 정의가 없습니다.'
                  : servers.length
                    ? '조회된 테이블이 없습니다.'
                    : '서버등록에서 DB 서버를 먼저 등록하세요.'
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
    </div>
  )
}
