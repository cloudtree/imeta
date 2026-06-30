import { useState, useMemo } from 'react'
import { useTerms } from '../../hooks/useTerms'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import TermForm from './TermForm'

const PAGE_SIZE = 15

const COLUMNS = [
  { key: 'subject_name',  label: '주제영역',      render: (v) => v || '-' },
  { key: 'logical_term',  label: '논리명',        sortable: true },
  { key: 'physical_term', label: '물리명',        sortable: true },
  { key: 'domain_div_cd', label: '도메인구분',    sortable: true },
  { key: 'domain_nm',     label: '도메인',        render: (v) => v || '-' },
  { key: 'data_type',     label: '데이터타입',    render: (v) => <span className="badge badge-gray">{v}</span> },
  { key: 'data_len',      label: '길이' },
  {
    key: 'use_yn',
    label: '사용',
    render: (v) => <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>,
  },
]

export default function TermsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const { data, total, loading, error, create, update, remove } = useTerms({})

  const [modalMode,    setModalMode]    = useState(null)
  const [formValue,    setFormValue]    = useState(TermForm.EMPTY)
  const [selectedRow,  setSelectedRow]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (r) =>
        r.logical_term?.toLowerCase().includes(q) ||
        r.physical_term?.toLowerCase().includes(q) ||
        r.domain_div_cd?.toLowerCase().includes(q)
    )
  }, [data, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const openCreate = () => {
    setFormValue(TermForm.EMPTY)
    setFormError(null)
    setModalMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    setFormValue({ ...row })
    setFormError(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedRow(null)
  }

  const validate = (v) => {
    if (!v.logical_term?.trim())  return '논리명을 입력하세요.'
    if (!v.physical_term?.trim()) return '물리명을 입력하세요.'
    if (!v.domain_div_cd?.trim()) return '도메인 구분 코드를 입력하세요.'
    if (!v.data_type)             return '데이터 타입을 선택하세요.'
    if (!v.data_len?.trim())      return '데이터 길이를 입력하세요.'
    return null
  }

  const handleSave = async () => {
    const err = validate(formValue)
    if (err) { setFormError(err); return }
    setSaving(true)
    setFormError(null)
    try {
      if (modalMode === 'create') {
        await create(formValue)
      } else {
        await update(selectedRow.term_id, formValue)
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
      await remove(deleteTarget.term_id)
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
          <h1 className="page-title">표준 용어 관리</h1>
          <p className="page-subtitle">표준 단어를 조합하여 구성된 용어를 등록하고 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 용어 등록</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">용어 목록 ({total}건)</span>
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="논리명, 물리명, 도메인구분 검색"
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable columns={COLUMNS} rows={paged} onRowClick={openEdit} emptyText="등록된 용어가 없습니다." />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
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
          <TermForm value={formValue} onChange={setFormValue} />
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
    </div>
  )
}
