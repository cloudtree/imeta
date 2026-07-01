import { useState, useMemo, useEffect, useCallback } from 'react'
import { useDomains } from '../../hooks/useDomains'
import { wordsApi } from '../../api/words'
import { domainsApi } from '../../api/domains'
import { domainGroupsApi } from '../../api/domainGroups'
import DataTable from '../../components/common/DataTable'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import SubjectAreaFilter from '../../components/common/SubjectAreaFilter'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import DomainForm from './DomainForm'
import { formatDataLength, toFormDataLength, validateDataLength, normalizeDataLength, normalizeDataLengthInput, mergeLegacyLengthScale } from '../../utils/domainInfotype'

const EXCEL_COLUMNS = [
  { key: 'subject_id',    label: '주제영역ID',    required: false, example: 'STD01' },
  { key: 'info_type',     label: '도메인그룹명',  required: true,  example: '명칭'          },
  { key: 'domain_nm',     label: '도메인명',      required: true,  example: '이름'          },
  { key: 'data_type',     label: '데이터타입',    required: true,  example: 'VARCHAR'      },
  { key: 'data_length',   label: '데이터길이',    required: false, example: '100 또는 7,2', asText: true,
    normalize: (v, row) => normalizeDataLengthInput(
      mergeLegacyLengthScale(v, row?.data_scale, row?.data_type?.trim().toUpperCase()) ?? v,
      row?.data_type,
    ) },
  { key: 'use_yn',        label: '사용여부',      required: false, example: 'Y'            },
  { key: 'domain_desc',   label: '설명',          required: false, example: '사람 또는 사물의 이름' },
]

const PAGE_SIZE = 50

const COLUMNS = [
  { key: 'subject_name',  label: '주제영역',      render: (v) => v || '-' },
  { key: 'info_type',     label: '도메인 그룹명', sortable: true },
  { key: 'domain_nm',     label: '도메인명',      sortable: true },
  { key: 'infotype',      label: '인포타입',      sortable: true },
  { key: 'data_type',     label: '데이터타입',    render: (v) => <span className="badge badge-gray">{v}</span> },
  {
    key:     'data_length',
    label:   '데이터길이',
    sortable: true,
    render:  (v, row) => formatDataLength(v ?? row.data_length, row.data_type),
  },
  {
    key: 'use_yn',
    label: '사용',
    render: (v) => <span className={`badge ${v === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{v}</span>,
  },
]

export default function DomainsPage() {
  const [search,       setSearch]       = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [groupFilter,  setGroupFilter]  = useState('')
  const [page, setPage]                 = useState(1)
  const [words, setWords]               = useState([])
  const [allDomains, setAllDomains]     = useState([])

  // ── 도메인 그룹 상태 ──────────────────────────────
  const [groups,          setGroups]          = useState([])
  const [showGroupModal,  setShowGroupModal]  = useState(false)
  const [groupForm,       setGroupForm]       = useState({ group_nm: '', group_desc: '', use_yn: 'Y' })
  const [editingGroup,    setEditingGroup]    = useState(null)   // null = 신규
  const [groupError,      setGroupError]      = useState(null)
  const [groupSaving,     setGroupSaving]     = useState(false)
  const [deleteGroup,     setDeleteGroup]     = useState(null)

  const loadGroups = useCallback(() => {
    domainGroupsApi.getAll()
      .then((res) => setGroups(Array.isArray(res) ? res : []))
      .catch(() => {})
  }, [])

  const reloadAllDomains = useCallback(() => {
    domainsApi.getAll({ limit: 10000 })
      .then((res) => setAllDomains(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  useEffect(() => {
    wordsApi.getAll({ limit: 1000 })
      .then((res) => setWords(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
    loadGroups()
    reloadAllDomains()
  }, [loadGroups, reloadAllDomains])

  const listParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...(subjectFilter ? { subject_id: subjectFilter } : {}),
    ...(groupFilter ? { info_type: groupFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [page, subjectFilter, groupFilter, search])

  const { data, total, loading, error, create, update, remove, refetch } = useDomains(listParams)

  const [modalMode,    setModalMode]    = useState(null)
  const [formValue,    setFormValue]    = useState(DomainForm.EMPTY)
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
    setFormValue(DomainForm.EMPTY)
    setFormError(null)
    setModalMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    setFormValue({ ...row, data_length: toFormDataLength(row) })
    setFormError(null)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setSelectedRow(null)
  }

  const validate = (v) => {
    if (!v.info_type?.trim()) return '도메인 그룹명을 선택하세요.'
    if (!v.domain_nm?.trim())  return '도메인명을 입력하세요.'
    if (!v.data_type)             return '데이터 타입을 선택하세요.'
    if (!v.subject_id)            return '주제영역을 선택하세요.'

    const lenErr = validateDataLength(v.data_length, v.data_type, v.data_scale)
    if (lenErr) return lenErr

    if (words.length > 0) {
      const exists = words.some(
        (w) => w.abb_word_nm?.toUpperCase() === v.domain_div_cd?.trim().toUpperCase()
      )
      if (!exists) return `도메인 영문명 "${v.domain_div_cd.trim().toUpperCase()}"은 표준단어에 등록되지 않은 약어입니다. 표준단어를 먼저 등록하세요.`
    }
    return null
  }

  const sanitizePayload = (v) => {
    const { data_scale, ...rest } = v
    const data_length = normalizeDataLengthInput(v.data_length, v.data_type, data_scale) || null
    return { ...rest, data_length }
  }

  const handleSave = async () => {
    const err = validate(formValue)
    if (err) { setFormError(err); return }
    setSaving(true)
    setFormError(null)
    const payload = sanitizePayload(formValue)
    try {
      if (modalMode === 'create') {
        await create(payload)
      } else {
        await update(selectedRow.domain_id, payload)
      }
      closeModal()
      reloadAllDomains()
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
      await Promise.all([...selected].map((id) => domainsApi.delete(id)))
      setSelected(new Set())
      await refetch()
      reloadAllDomains()
    } catch (e) {
      alert(e.message)
      await refetch()
      reloadAllDomains()
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await remove(deleteTarget.domain_id)
      setDeleteTarget(null)
      reloadAllDomains()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAll = async () => {
    setDeleteAllLoading(true)
    try {
      await domainsApi.deleteAll()
      setShowDeleteAll(false)
      setSelected(new Set())
      setPage(1)
      await refetch()
      reloadAllDomains()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleteAllLoading(false)
    }
  }

  // ── 도메인 그룹 CRUD ───────────────────────────────
  const openGroupCreate = () => {
    setEditingGroup(null)
    setGroupForm({ group_nm: '', group_desc: '', use_yn: 'Y' })
    setGroupError(null)
    setShowGroupModal(true)
  }
  const openGroupEdit = (g) => {
    setEditingGroup(g)
    setGroupForm({ group_nm: g.group_nm, group_desc: g.group_desc ?? '', use_yn: g.use_yn })
    setGroupError(null)
    setShowGroupModal(true)
  }
  const closeGroupModal = () => { setShowGroupModal(false); setEditingGroup(null) }

  const handleGroupSave = async () => {
    if (!groupForm.group_nm?.trim()) { setGroupError('그룹명을 입력하세요.'); return }
    setGroupSaving(true); setGroupError(null)
    try {
      if (editingGroup) {
        await domainGroupsApi.update(editingGroup.group_id, groupForm)
      } else {
        await domainGroupsApi.create(groupForm)
      }
      loadGroups()
      closeGroupModal()
    } catch (e) {
      setGroupError(e.message)
    } finally {
      setGroupSaving(false)
    }
  }

  const handleGroupDelete = async () => {
    setGroupSaving(true)
    try {
      await domainGroupsApi.delete(deleteGroup.group_id)
      loadGroups()
      setDeleteGroup(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setGroupSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">표준 도메인 관리</h1>
          <p className="page-subtitle">속성 값의 유형과 데이터 타입을 정의하는 도메인을 관리합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <span className="spinner" /> : null}
              선택 삭제 ({selected.size}건)
            </button>
          )}
          <button className="btn btn-secondary" onClick={openGroupCreate}>⚙ 도메인 그룹 관리</button>
          <button className="btn btn-secondary" onClick={() => setShowExcel(true)}>📂 엑셀 대량 등록</button>
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteAll(true)}
            disabled={allDomains.length === 0 || deleteAllLoading}
          >
            {deleteAllLoading ? <span className="spinner" /> : null}
            전체삭제
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ 도메인 등록</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">도메인 목록 ({total}건)</span>
          <div className="toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                className="form-control"
                style={{ width: '120px', height: '34px', fontSize: '12px', padding: '0 6px' }}
                value={groupFilter}
                onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }}
              >
                <option value="">전체 그룹</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_nm}>{g.group_nm}</option>
                ))}
              </select>
              <SubjectAreaFilter
                value={subjectFilter}
                onChange={(v) => { setSubjectFilter(v); setPage(1) }}
              />
              <SearchBar
                value={search}
                onChange={(v) => { setSearch(v); setPage(1) }}
                placeholder="도메인명, 인포타입, 데이터타입 검색"
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
            emptyText="등록된 도메인이 없습니다."
            selectable rowKey="domain_id"
            selected={selected} onSelectionChange={setSelected}
            showRowNumber rowNumberOffset={(page - 1) * PAGE_SIZE}
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {/* ── 도메인 그룹 관리 모달 ── */}
      {showGroupModal && (
        <Modal
          title={editingGroup ? '도메인 그룹 수정' : '도메인 그룹 등록'}
          onClose={closeGroupModal}
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeGroupModal} disabled={groupSaving}>취소</button>
              <button className="btn btn-primary" onClick={handleGroupSave} disabled={groupSaving}>
                {groupSaving ? <span className="spinner" /> : null}
                {editingGroup ? '저장' : '등록'}
              </button>
            </>
          }
        >
          {groupError && <div className="alert alert-error">{groupError}</div>}

          {/* 등록된 그룹 목록 (신규 등록 시에만 표시) */}
          {!editingGroup && groups.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                등록된 그룹 목록
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>그룹명</th>
                      <th style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>설명</th>
                      <th style={{ padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: '80px' }}>사용</th>
                      <th style={{ padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: '100px' }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.group_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600 }}>{g.group_nm}</td>
                        <td style={{ padding: '7px 12px', color: '#6b7280' }}>{g.group_desc || '-'}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                          <span className={`badge ${g.use_yn === 'Y' ? 'badge-blue' : 'badge-gray'}`}>{g.use_yn}</span>
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                          <button className="btn btn-secondary btn-sm" style={{ marginRight: '4px' }} onClick={() => openGroupEdit(g)}>수정</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteGroup(g)}>삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label required">그룹명</label>
            <input
              className="form-control"
              value={groupForm.group_nm}
              onChange={(e) => setGroupForm((f) => ({ ...f, group_nm: e.target.value }))}
              placeholder="예: 명칭, 코드, 금액"
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label className="form-label">설명</label>
            <input
              className="form-control"
              value={groupForm.group_desc}
              onChange={(e) => setGroupForm((f) => ({ ...f, group_desc: e.target.value }))}
              placeholder="그룹에 대한 설명"
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label className="form-label">사용 여부</label>
            <select
              className="form-control"
              value={groupForm.use_yn}
              onChange={(e) => setGroupForm((f) => ({ ...f, use_yn: e.target.value }))}
            >
              <option value="Y">Y (사용)</option>
              <option value="N">N (미사용)</option>
            </select>
          </div>
        </Modal>
      )}

      {deleteGroup && (
        <ConfirmDialog
          message={`"${deleteGroup.group_nm}" 그룹을 삭제하시겠습니까?`}
          onConfirm={handleGroupDelete}
          onCancel={() => setDeleteGroup(null)}
          loading={groupSaving}
        />
      )}

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
          <DomainForm value={formValue} onChange={setFormValue} groups={groups} />
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

      {showDeleteAll && (
        <ConfirmDialog
          message={`표준 도메인 ${allDomains.length}건을 모두 삭제하시겠습니까? 표준 용어에서 사용 중인 도메인이 있으면 삭제할 수 없습니다. 검색·필터와 관계없이 모든 도메인이 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAll(false)}
          loading={deleteAllLoading}
        />
      )}

      {showExcel && (
        <ExcelUploadModal
          title="표준도메인"
          columns={EXCEL_COLUMNS}
          rowDefaults={{ subject_id: 'STD01' }}
          validateRow={(r) => {
            const validTypes = ['VARCHAR','CHAR','NUMBER','INTEGER','DATE','TIMESTAMP','BOOLEAN','CLOB']
            const dt = r.data_type?.trim().toUpperCase()
            if (dt && !validTypes.includes(dt))
              return `데이터타입 "${r.data_type}"은 허용되지 않습니다. (${validTypes.join(', ')})`

            const normalized = normalizeDataLengthInput(
              mergeLegacyLengthScale(r.data_length, r.data_scale, dt) ?? r.data_length,
              dt,
            )
            const lenErr = validateDataLength(normalized, dt)
            if (lenErr) return lenErr

            const yn = r.use_yn?.trim().toUpperCase()
            if (yn && yn !== 'Y' && yn !== 'N')
              return '사용여부는 Y 또는 N 만 입력 가능합니다.'
            return null
          }}
          onUpload={(rows) => domainsApi.bulk(rows)}
          onClose={() => setShowExcel(false)}
          onDone={() => { setShowExcel(false); refetch(); reloadAllDomains() }}
        />
      )}
    </div>
  )
}
