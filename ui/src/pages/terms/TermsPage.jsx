import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTerms } from '../../hooks/useTerms'
import { termsApi } from '../../api/terms'
import { wordsApi } from '../../api/words'
import { domainsApi } from '../../api/domains'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import SubjectAreaFilter from '../../components/common/SubjectAreaFilter'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import TermForm from './TermForm'
import { validateTermFields, validateTermRow, normalizeDataLenValue } from '../../utils/termValidation'

const EXCEL_COLUMNS = [
  { key: 'subject_id',    label: '주제영역ID',    required: false, example: 'STD01' },
  { key: 'logical_term',  label: '논리명',        required: true,  example: '고객번호'       },
  { key: 'physical_term', label: '물리명',        required: true,  example: 'CUST_NO'      },
  { key: 'domain_div_cd', label: '도메인그룹명',   required: false, example: '명칭'          },
  { key: 'infotype',      label: '도메인 인포타입', required: false, example: '이름VC100'    },
  { key: 'data_type',     label: '데이터타입',    required: true,  example: 'VARCHAR'      },
  { key: 'data_len',      label: '데이터길이',    required: true,  example: '100 또는 7,2', asText: true,
    normalize: (v, row) => normalizeDataLenValue(v, row?.data_type, row?.data_scale) },
  { key: 'use_yn',        label: '사용여부',      required: false, example: 'Y'            },
  { key: 'term_desc',     label: '설명',          required: false, example: '고객을 식별하는 고유 번호' },
]

const PAGE_SIZE = 50

const COLUMNS = [
  { key: 'subject_name',  label: '주제영역',      render: (v) => v || '-' },
  { key: 'logical_term',  label: '논리명',        sortable: true },
  { key: 'physical_term', label: '물리명',        sortable: true },
  { key: 'domain_div_cd', label: '도메인그룹명',  sortable: true },
  { key: 'domain_nm',     label: '도메인 인포타입', render: (v) => v || '-' },
  { key: 'data_type',     label: '데이터타입',    render: (v) => <span className="badge badge-gray">{v}</span> },
  { key: 'data_len',      label: '데이터길이',    sortable: true },
  {
    key: 'use_yn',
    label: '사용',
    render: (v) => <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>,
  },
]

export default function TermsPage() {
  const [search,  setSearch]  = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [page,    setPage]    = useState(1)
  const [words,   setWords]   = useState([])
  const [domains, setDomains] = useState([])
  const [allTerms, setAllTerms] = useState([])

  useEffect(() => {
    wordsApi.dictionary()
      .then((res) => setWords(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
    domainsApi.getAll({ limit: 10000 })
      .then((res) => setDomains(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
    termsApi.getAll({ limit: 10000 })
      .then((res) => setAllTerms(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  const reloadAllTerms = useCallback(() => {
    termsApi.getAll({ limit: 10000 })
      .then((res) => setAllTerms(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  const listParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...(subjectFilter ? { subject_id: subjectFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [page, subjectFilter, search])

  const { data, total, loading, error, create, update, remove, refetch } = useTerms(listParams)

  const [modalMode,    setModalMode]    = useState(null)
  const [formValue,    setFormValue]    = useState(TermForm.EMPTY)
  const [selectedRow,  setSelectedRow]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState(null)
  const [showExcel,    setShowExcel]    = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [selected,     setSelected]     = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const openCreate = () => {
    setFormValue(TermForm.EMPTY)
    setFormError(null)
    setModalMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    // _segments 는 논리명 입력 시 자동 재계산되므로 null 로 초기화
    setFormValue({ ...row, _segments: null })
    setFormError(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedRow(null)
  }

  const validate = (v) => {
    const { firstError } = validateTermFields(
      {
        ...v,
        term_id: selectedRow?.term_id ?? null,
      },
      {
        words,
        domains,
        existingTerms: allTerms,
        requireDomainGroup: true,
      }
    )
    return firstError
  }

  const handleSave = async () => {
    const err = validate(formValue)
    if (err) { setFormError(err); return }
    setSaving(true)
    setFormError(null)
    // _segments 는 UI 전용 — API 전송 제외
    const { _segments, _domainTouched, ...payload } = formValue
    try {
      if (modalMode === 'create') {
        await create(payload)
      } else {
        await update(selectedRow.term_id, payload)
      }
      closeModal()
      reloadAllTerms()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setBulkDeleting(true)
    try {
      await Promise.all([...selected].map((id) => termsApi.delete(id)))
      setSelected(new Set())
      await refetch()
      reloadAllTerms()
    } catch (e) {
      alert(e.message)
      await refetch()
      reloadAllTerms()
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    setDeleteAllLoading(true)
    try {
      await termsApi.deleteAll()
      setShowDeleteAll(false)
      setSelected(new Set())
      setPage(1)
      await refetch()
      reloadAllTerms()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleteAllLoading(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await remove(deleteTarget.term_id)
      setDeleteTarget(null)
      reloadAllTerms()
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
          <h1 className="page-title">표준 용어 관리</h1>
          <p className="page-subtitle">표준 단어를 조합하여 구성된 용어를 등록하고 관리합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <span className="spinner" /> : null}
              선택 삭제 ({selected.size}건)
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowExcel(true)}>📂 엑셀 대량 등록</button>
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteAll(true)}
            disabled={allTerms.length === 0 || deleteAllLoading}
          >
            {deleteAllLoading ? <span className="spinner" /> : null}
            전체삭제
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ 용어 등록</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">용어 목록 ({total}건)</span>
          <div className="toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SubjectAreaFilter
                value={subjectFilter}
                onChange={(v) => { setSubjectFilter(v); setPage(1) }}
              />
              <SearchBar
                value={search}
                onChange={(v) => { setSearch(v); setPage(1) }}
                placeholder="논리명, 물리명, 도메인구분 검색"
              />
            </div>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable
            columns={COLUMNS} rows={data} onRowClick={openEdit}
            emptyText="등록된 용어가 없습니다."
            selectable rowKey="term_id"
            selected={selected} onSelectionChange={setSelected}
            showRowNumber rowNumberOffset={(page - 1) * PAGE_SIZE}
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? '표준 용어 등록' : '표준 용어 수정'}
          onClose={closeModal}
          footer={
            <>
              {modalMode === 'edit' && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginRight: 'auto' }}
                  onClick={() => { setDeleteTarget(selectedRow); closeModal() }}
                >삭제</button>
              )}
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                {modalMode === 'create' ? '등록' : '저장'}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <TermForm value={formValue} onChange={setFormValue} words={words} domains={domains} descAutoFill={modalMode === 'create'} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.logical_term}" 용어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}

      {showDeleteAll && (
        <ConfirmDialog
          message={`표준 용어 ${allTerms.length}건을 모두 삭제하시겠습니까? 검색 조건과 관계없이 등록된 모든 용어가 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAll(false)}
          loading={deleteAllLoading}
        />
      )}

      {showExcel && (
        <ExcelUploadModal
          title="표준용어"
          columns={EXCEL_COLUMNS}
          rowDefaults={{ subject_id: 'STD01' }}
          validateRow={(r) => validateTermRow(r, { words, domains, existingTerms: allTerms })}
          onUpload={(rows) => termsApi.bulk(rows)}
          onClose={() => setShowExcel(false)}
          onDone={() => { setShowExcel(false); refetch(); reloadAllTerms() }}
        />
      )}
    </div>
  )
}
