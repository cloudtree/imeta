import { useState, useMemo } from 'react'
import { useDomains } from '../../hooks/useDomains'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DomainForm from './DomainForm'

const PAGE_SIZE = 15

const COLUMNS = [
  { key: 'domain_nm',     label: '도메인명',      sortable: true },
  { key: 'domain_div_cd', label: '도메인구분',    sortable: true },
  { key: 'info_type',     label: '정보유형',      sortable: true },
  { key: 'data_type',     label: '데이터타입',    render: (v) => <span className="badge badge-gray">{v}</span> },
  { key: 'data_length',   label: '길이',          render: (v) => v ?? '-' },
  { key: 'data_scale',    label: '소수점',        render: (v) => (v != null ? v : '-') },
  {
    key: 'use_yn',
    label: '사용',
    render: (v) => <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>,
  },
]

export default function DomainsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const { data, total, loading, error, create, update, remove } = useDomains({})

  const [modalMode,    setModalMode]    = useState(null)
  const [formValue,    setFormValue]    = useState(DomainForm.EMPTY)
  const [selectedRow,  setSelectedRow]  = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (r) =>
        r.domain_nm?.toLowerCase().includes(q) ||
        r.domain_div_cd?.toLowerCase().includes(q) ||
        r.data_type?.toLowerCase().includes(q)
    )
  }, [data, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const openCreate = () => {
    setFormValue(DomainForm.EMPTY)
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
    if (!v.domain_nm?.trim())     return '도메인명을 입력하세요.'
    if (!v.domain_div_cd?.trim()) return '도메인 구분 코드를 입력하세요.'
    if (!v.info_type?.trim())     return '정보 유형을 입력하세요.'
    if (!v.data_type)             return '데이터 타입을 선택하세요.'
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
        await update(selectedRow.domain_id, formValue)
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
      await remove(deleteTarget.domain_id)
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
          <h1 className="page-title">표준 도메인 관리</h1>
          <p className="page-subtitle">속성 값의 유형과 데이터 타입을 정의하는 도메인을 관리합니다.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 도메인 등록</button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">도메인 목록 ({total}건)</span>
          <div className="toolbar">
            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setPage(1) }}
              placeholder="도메인명, 구분코드, 데이터타입 검색"
            />
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{error}</div>}

        {loading ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable columns={COLUMNS} rows={paged} onRowClick={openEdit} emptyText="등록된 도메인이 없습니다." />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? '표준 도메인 등록' : '표준 도메인 수정'}
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
          <DomainForm value={formValue} onChange={setFormValue} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.domain_nm}" 도메인을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}
    </div>
  )
}
