import { useState, useMemo, useCallback } from 'react'
import { useDbServers } from '../../hooks/useDbServers'
import { dbServersApi } from '../../api/dbServers'
import { wordsApi } from '../../api/words'
import { termsApi } from '../../api/terms'
import { domainsApi } from '../../api/domains'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ServerForm from './ServerForm'
import QualityReviewReport from './QualityReviewReport'
import {
  classifyStandardReviewErrors,
  reviewSelectedDefinitions,
  summarizeStandardReviewGroups,
} from './standardReviewUtils'
import { mapIntrospectionDefinitionRows } from './mapIntrospectionRow'

const PAGE_SIZE = 50

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR')
}

function ConnectionStatus({ value }) {
  if (value === 'Y') return <span className="badge badge-blue">성공</span>
  if (value === 'N') return <span className="badge badge-gray">실패</span>
  return <span className="badge badge-gray">미확인</span>
}

export default function ServerRegisterPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, total, loading, error, create, update, remove, refetch } = useDbServers({})

  const [modalMode, setModalMode] = useState(null)
  const [formValue, setFormValue] = useState(ServerForm.EMPTY)
  const [selectedRow, setSelectedRow] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [testResult, setTestResult] = useState(null)

  const [reviewingId, setReviewingId] = useState(null)
  const [report, setReport] = useState(null)
  const [reportError, setReportError] = useState(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (row) =>
        row.db_server_nm?.toLowerCase().includes(q) ||
        row.host_nm?.toLowerCase().includes(q) ||
        row.database_nm?.toLowerCase().includes(q) ||
        row.user_nm?.toLowerCase().includes(q),
    )
  }, [data, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const handleQualityReview = useCallback(async (server) => {
    if (!server?.db_server_id) return
    setReviewingId(server.db_server_id)
    setReportError(null)
    try {
      const [schemaRes, wordsRes, termsRes, domainsRes] = await Promise.all([
        dbServersApi.getSchemaDefinitions(server.db_server_id),
        wordsApi.dictionary(),
        termsApi.getAll({ limit: 10000, use_yn: 'Y' }),
        domainsApi.getAll({ limit: 10000, use_yn: 'Y' }),
      ])

      const defs = mapIntrospectionDefinitionRows(
        Array.isArray(schemaRes) ? schemaRes : (schemaRes.items ?? []),
      )
      if (!defs.length) {
        throw new Error('검토할 스키마 정의가 없습니다. 연결 상태와 권한을 확인하세요.')
      }

      const words = Array.isArray(wordsRes) ? wordsRes : (wordsRes.items ?? wordsRes ?? [])
      const terms = Array.isArray(termsRes) ? termsRes : (termsRes.items ?? [])
      const domains = Array.isArray(domainsRes) ? domainsRes : (domainsRes.items ?? [])

      const groups = reviewSelectedDefinitions(defs, { words, terms, domains })
      const summary = summarizeStandardReviewGroups(groups)
      const classified = classifyStandardReviewErrors(groups)

      setReport({
        server: schemaRes.server || server,
        summary,
        categories: classified.categories,
        groups,
        generatedAt: new Date(),
      })
    } catch (e) {
      setReportError(e.message || '품질 검토에 실패했습니다.')
    } finally {
      setReviewingId(null)
    }
  }, [])

  const columns = useMemo(
    () => [
      { key: 'db_server_nm', label: '서버명', sortable: true },
      {
        key: 'db_type_nm',
        label: 'DB종류',
        sortable: true,
        render: (v) => (
          <span className={`badge ${v === 'ORACLE' ? 'badge-red' : 'badge-blue'}`}>
            {v === 'ORACLE' ? 'Oracle' : 'PostgreSQL'}
          </span>
        ),
      },
      { key: 'host_nm', label: '호스트', sortable: true },
      { key: 'port_no', label: '포트' },
      { key: 'database_nm', label: 'DB명', sortable: true },
      { key: 'user_nm', label: '사용자' },
      {
        key: 'last_test_yn',
        label: '연결상태',
        render: (v) => <ConnectionStatus value={v} />,
      },
      {
        key: 'review_request',
        label: '검토요청',
        render: (_v, row) => (
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="server-review-btn"
              disabled={reviewingId === row.db_server_id}
              onClick={() => handleQualityReview(row)}
            >
              {reviewingId === row.db_server_id ? <span className="spinner" /> : null}
              검토보고서
            </button>
          </div>
        ),
      },
      {
        key: 'last_test_dtm',
        label: '마지막 확인',
        render: (v) => formatDateTime(v),
      },
      {
        key: 'use_yn',
        label: '사용',
        render: (v) => (
          <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>
        ),
      },
    ],
    [handleQualityReview, reviewingId],
  )

  const openCreate = () => {
    setFormValue(ServerForm.EMPTY)
    setFormError(null)
    setTestResult(null)
    setModalMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    setFormValue({ ...row, password_val: '' })
    setFormError(null)
    setTestResult(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedRow(null)
    setTestResult(null)
  }

  const validate = (value, isEdit) => {
    if (!value.db_server_nm?.trim()) return '서버명을 입력하세요.'
    if (!value.host_nm?.trim()) return '호스트를 입력하세요.'
    if (!value.database_nm?.trim()) return '데이터베이스명을 입력하세요.'
    if (!value.user_nm?.trim()) return '사용자명을 입력하세요.'
    if (!isEdit && !value.password_val) return '비밀번호를 입력하세요.'
    const portNum = Number(value.port_no)
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return '포트는 1~65535 사이의 정수여야 합니다.'
    }
    return null
  }

  const handleTest = async () => {
    const isEdit = modalMode === 'edit'
    const err = validate(formValue, isEdit)
    if (err) {
      setFormError(err)
      return
    }
    if (isEdit && !formValue.password_val) {
      setTesting(true)
      setFormError(null)
      setTestResult(null)
      try {
        const result = await dbServersApi.testById(selectedRow.db_server_id)
        setTestResult(result)
        await refetch()
      } catch (e) {
        setFormError(e.message)
      } finally {
        setTesting(false)
      }
      return
    }

    setTesting(true)
    setFormError(null)
    setTestResult(null)
    try {
      const result = await dbServersApi.test(formValue)
      setTestResult(result)
    } catch (e) {
      setFormError(e.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const isEdit = modalMode === 'edit'
    const err = validate(formValue, isEdit)
    if (err) {
      setFormError(err)
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const payload = { ...formValue }
      if (isEdit && !payload.password_val) delete payload.password_val

      if (modalMode === 'create') {
        await create(payload)
      } else {
        await update(selectedRow.db_server_id, payload)
      }
      closeModal()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await remove(deleteTarget.db_server_id)
      setDeleteTarget(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">서버등록</h1>
          <p className="page-subtitle">데이터베이스 연결 대상 서버 정보를 등록·관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 서버 등록</button>
      </div>

      {reportError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          {reportError}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '0.75rem' }}
            onClick={() => setReportError(null)}
          >
            닫기
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">DB 서버 목록 ({total}건)</span>
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="서버명, 호스트, DB명, 사용자 검색"
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={paged}
            rowKey="db_server_id"
            onRowClick={openEdit}
            emptyText="등록된 DB 서버가 없습니다."
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? 'DB 서버 등록' : 'DB 서버 수정'}
          onClose={closeModal}
          footer={
            <>
              {modalMode === 'edit' && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginRight: 'auto' }}
                  onClick={() => { setDeleteTarget(selectedRow); closeModal() }}
                >
                  삭제
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleTest} disabled={saving || testing}>
                {testing ? <span className="spinner" /> : null}
                연결 확인
              </button>
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving || testing}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || testing}>
                {saving ? <span className="spinner" /> : null}
                저장
              </button>
            </>
          }
        >
          <ServerForm value={formValue} onChange={setFormValue} error={formError} testResult={testResult} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="서버 삭제"
          message={`"${deleteTarget.db_server_nm}" 서버를 삭제하시겠습니까?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}

      {report && (
        <QualityReviewReport
          server={report.server}
          summary={report.summary}
          categories={report.categories}
          groups={report.groups}
          generatedAt={report.generatedAt}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  )
}
