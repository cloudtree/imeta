import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDbServers } from '../../hooks/useDbServers'
import { dbServersApi } from '../../api/dbServers'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import { COLUMN_DEF_COLUMNS, filterTableRows, filterDefinitionColumns } from './reviewUtils'

const PAGE_SIZE = 50

const TABLE_COLUMNS = [
  { key: 'schema_name', label: '스키마', sortable: true },
  { key: 'table_name', label: '테이블명', sortable: true },
  { key: 'table_comment', label: '테이블설명', render: (v) => v || '-' },
  {
    key: 'matched_columns',
    label: '매칭 컬럼',
    render: (v) => (v ? <span className="badge badge-blue">{v}</span> : '-'),
  },
  { key: 'column_count', label: '컬럼수', render: (v) => <span className="badge badge-gray">{v ?? 0}</span> },
  { key: 'pk_columns', label: 'PK', render: (v) => v || '-' },
]

export default function DatabaseReviewPage() {
  const { data: servers, loading: serversLoading } = useDbServers({ use_yn: 'Y' })

  const [selectedServerId, setSelectedServerId] = useState('')
  const [tables, setTables] = useState([])
  const [serverInfo, setServerInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [selectedTable, setSelectedTable] = useState(null)
  const [tableDefinition, setTableDefinition] = useState(null)
  const [definitionLoading, setDefinitionLoading] = useState(false)
  const [definitionError, setDefinitionError] = useState(null)
  const [columnSearch, setColumnSearch] = useState('')

  useEffect(() => {
    if (!selectedServerId && servers.length) {
      setSelectedServerId(String(servers[0].server_id))
    }
  }, [servers, selectedServerId])

  const loadTables = useCallback(async () => {
    if (!selectedServerId) return
    setLoading(true)
    setError(null)
    setTables([])
    setServerInfo(null)
    setSelectedTable(null)
    setTableDefinition(null)
    setColumnSearch('')
    try {
      const res = await dbServersApi.getSchemaTables(selectedServerId)
      setTables(res.items ?? [])
      setServerInfo(res.server ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [selectedServerId])

  useEffect(() => {
    if (selectedServerId) loadTables()
  }, [selectedServerId, loadTables])

  const filtered = useMemo(() => filterTableRows(tables, search), [tables, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const filteredDefinitionColumns = useMemo(
    () => (tableDefinition ? filterDefinitionColumns(tableDefinition.columns, columnSearch) : []),
    [tableDefinition, columnSearch],
  )

  const openDefinition = async (row) => {
    setSelectedTable(row)
    setTableDefinition(null)
    setDefinitionError(null)
    setColumnSearch(search.trim())
    setDefinitionLoading(true)
    try {
      const res = await dbServersApi.getTableDefinition(
        selectedServerId,
        row.schema_name,
        row.table_name,
      )
      setTableDefinition(res)
    } catch (e) {
      setDefinitionError(e.message)
    } finally {
      setDefinitionLoading(false)
    }
  }

  const closeDefinition = () => {
    setSelectedTable(null)
    setTableDefinition(null)
    setDefinitionError(null)
    setColumnSearch('')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">데이터베이스검토</h1>
          <p className="page-subtitle">
            등록된 DB의 사용자 테이블을 엔티티/테이블 정의서 형식으로 조회합니다.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={loadTables}
          disabled={!selectedServerId || loading}
        >
          새로고침
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            테이블 목록
            {serverInfo ? ` — ${serverInfo.server_name} / ${serverInfo.database_name}` : ''}
            {search.trim()
              ? ` (검색 ${filtered.length}건 / 전체 ${tables.length}건)`
              : tables.length ? ` (${tables.length}건)` : ''}
          </span>
          <div className="toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="form-control"
              style={{ minWidth: '220px' }}
              value={selectedServerId}
              onChange={(e) => {
                setSelectedServerId(e.target.value)
                setPage(1)
                setSearch('')
              }}
              disabled={serversLoading || !servers.length}
            >
              {!servers.length && <option value="">등록된 서버 없음</option>}
              {servers.map((server) => (
                <option key={server.server_id} value={server.server_id}>
                  {server.server_name} ({server.database_name})
                </option>
              ))}
            </select>
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="테이블명, 설명, PK, 컬럼명/설명 검색"
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable
            columns={TABLE_COLUMNS}
            rows={paged}
            rowKey="table_key"
            showRowNumber
            rowNumberOffset={(page - 1) * PAGE_SIZE}
            onRowClick={openDefinition}
            emptyText={
              search.trim()
                ? '검색 조건에 맞는 테이블이 없습니다.'
                : servers.length
                  ? '조회된 테이블이 없습니다.'
                  : '서버등록에서 DB 서버를 먼저 등록하세요.'
            }
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {selectedTable && (
        <Modal
          wide
          title={`테이블 정의서 — ${selectedTable.schema_name}.${selectedTable.table_name}`}
          onClose={closeDefinition}
          footer={
            <button className="btn btn-secondary" onClick={closeDefinition}>닫기</button>
          }
        >
          <div style={{ marginBottom: '16px', fontSize: '14px', color: '#4b5563' }}>
            <div><strong>서버:</strong> {serverInfo?.server_name || '-'}</div>
            <div><strong>데이터베이스:</strong> {serverInfo?.database_name || '-'}</div>
            <div><strong>테이블설명:</strong> {tableDefinition?.table_comment || selectedTable.table_comment || '-'}</div>
            <div><strong>PK:</strong> {selectedTable.pk_columns || '-'}</div>
          </div>

          <SearchBar
            value={columnSearch}
            onChange={setColumnSearch}
            placeholder="컬럼명, 설명, 타입, FK, 기본값 검색"
          />

          {definitionError && <div className="alert alert-error">{definitionError}</div>}

          {definitionLoading ? (
            <div className="loading-overlay"><span className="spinner" /></div>
          ) : (
            tableDefinition && (
              <>
                <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                  {columnSearch.trim()
                    ? `컬럼 검색 결과 ${filteredDefinitionColumns.length}건 / 전체 ${tableDefinition.columns.length}건`
                    : `전체 컬럼 ${tableDefinition.columns.length}건`}
                </div>
                <DataTable
                  columns={COLUMN_DEF_COLUMNS}
                  rows={filteredDefinitionColumns}
                  rowKey="seq_no"
                  emptyText={columnSearch.trim() ? '검색 조건에 맞는 컬럼이 없습니다.' : '컬럼 정보가 없습니다.'}
                />
              </>
            )
          )}
        </Modal>
      )}
    </div>
  )
}
