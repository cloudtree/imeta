import { useState, useMemo } from 'react'
import { useSubjectAreas } from '../../hooks/useSubjectAreas'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import SubjectAreaForm from './SubjectAreaForm'

const PAGE_SIZE = 50

const COLUMNS = [
  { key: 'subject_id',   label: '주제영역 ID',  sortable: true },
  { key: 'subject_name', label: '주제영역명',   sortable: true },
  {
    key: 'word_count',
    label: '단어',
    render: (v) => <span className="badge badge-gray">{v ?? 0}</span>,
  },
  {
    key: 'term_count',
    label: '용어',
    render: (v) => <span className="badge badge-gray">{v ?? 0}</span>,
  },
  {
    key: 'domain_count',
    label: '도메인',
    render: (v) => <span className="badge badge-gray">{v ?? 0}</span>,
  },
  { key: 'description',  label: '설명',  render: (v) => v || '-' },
  {
    key: 'use_yn',
    label: '사용',
    render: (v) => (
      <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>
    ),
  },
]

export default function SubjectAreasPage() {
  const [search, setSearch] = useState('')
  const [page,   setPage]   = useState(1)

  const { data, total, loading, error, create, update, remove } = useSubjectAreas({})

  const [modalMode,    setModalMode]    = useState(null)
  const [formValue,    setFormValue]    = useState(SubjectAreaForm.EMPTY)
  const [selectedRow,  setSelectedRow]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (r) =>
        r.subject_id?.toLowerCase().includes(q) ||
        r.subject_name?.toLowerCase().includes(q)
    )
  }, [data, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const openCreate = () => {
    setFormValue(SubjectAreaForm.EMPTY)
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
    if (!v.subject_id?.trim())   return '주제영역 ID를 입력하세요.'
    if (!v.subject_name?.trim()) return '주제영역명을 입력하세요.'
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
        await update(selectedRow.subject_id, formValue)
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
      await remove(deleteTarget.subject_id)
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
          <h1 className="page-title">주제영역 관리</h1>
          <p className="page-subtitle">데이터 모델의 주제영역을 등록하고 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 주제영역 등록</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">주제영역 목록 ({total}건)</span>
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="주제영역 ID, 주제영역명 검색"
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={paged}
            onRowClick={openEdit}
            emptyText="등록된 주제영역이 없습니다."
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? '주제영역 등록' : '주제영역 수정'}
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
          <SubjectAreaForm value={formValue} onChange={setFormValue} isEdit={modalMode === 'edit'} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={
            (Number(deleteTarget.word_count) + Number(deleteTarget.term_count) + Number(deleteTarget.domain_count)) > 0
              ? `"${deleteTarget.subject_name}" 주제영역을 삭제하시겠습니까?\n연결된 단어 ${deleteTarget.word_count}건, 용어 ${deleteTarget.term_count}건, 도메인 ${deleteTarget.domain_count}건의 주제영역이 해제됩니다.`
              : `"${deleteTarget.subject_name}" 주제영역을 삭제하시겠습니까?`
          }
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}
    </div>
  )
}
