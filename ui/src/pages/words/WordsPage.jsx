import { useState, useMemo } from 'react'
import { useWords } from '../../hooks/useWords'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import WordForm from './WordForm'

const PAGE_SIZE = 15

const COLUMNS = [
  { key: 'word_name', label: '단어명', sortable: true },
  { key: 'eng_name', label: '영문명', sortable: true },
  { key: 'eng_abbr', label: '영문약어', sortable: true },
  {
    key: 'word_type',
    label: '단어구분',
    sortable: true,
    render: (v) => <span className="badge badge-blue">{v}</span>,
  },
  {
    key: 'is_entity_classifier',
    label: '엔터티 분류어',
    render: (v) => (v ? '✓' : ''),
  },
  {
    key: 'is_attr_classifier',
    label: '속성 분류어',
    render: (v) => (v ? '✓' : ''),
  },
  { key: 'description', label: '설명' },
]

export default function WordsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, total, loading, error, create, update, remove } = useWords({})

  const [modalMode, setModalMode] = useState(null) // 'create' | 'edit'
  const [formValue, setFormValue] = useState(WordForm.EMPTY)
  const [selectedRow, setSelectedRow] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (r) =>
        r.word_name?.toLowerCase().includes(q) ||
        r.eng_name?.toLowerCase().includes(q) ||
        r.eng_abbr?.toLowerCase().includes(q)
    )
  }, [data, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const openCreate = () => {
    setFormValue(WordForm.EMPTY)
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
    if (!v.word_name.trim()) return '단어명을 입력하세요.'
    if (!v.eng_name.trim()) return '영문명을 입력하세요.'
    if (!v.eng_abbr.trim()) return '영문약어를 입력하세요.'
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
        await update(selectedRow.id, formValue)
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
      await remove(deleteTarget.id)
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
          <h1 className="page-title">표준 단어 관리</h1>
          <p className="page-subtitle">데이터 표준화를 위한 단어를 등록하고 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + 단어 등록
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">단어 목록</span>
          <div className="toolbar">
            <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="단어명, 영문명, 약어 검색" />
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
            emptyText="등록된 단어가 없습니다."
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? '표준 단어 등록' : '표준 단어 수정'}
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
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : null}
                {modalMode === 'create' ? '등록' : '저장'}
              </button>
            </>
          }
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <WordForm value={formValue} onChange={setFormValue} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.word_name}" 단어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}
    </div>
  )
}
