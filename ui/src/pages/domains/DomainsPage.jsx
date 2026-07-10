import { useState, useMemo, useEffect, useCallback } from 'react'
import { useDomains } from '../../hooks/useDomains'
import { domainsApi } from '../../api/domains'
import { domainGroupsApi } from '../../api/domainGroups'
import { useSubjectAreaNav, parseSubjectNavFilter } from '../../hooks/useSubjectAreaNav'
import SplitView from '../../components/common/SplitView'
import SplitNav from '../../components/common/SplitNav'
import SplitDetail from '../../components/common/SplitDetail'
import MetaList from '../../components/common/MetaList'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import DomainForm from './DomainForm'
import {
  formatDataLength,
  toFormDataLength,
  validateDataLength,
  normalizeDataLengthInput,
  mergeLegacyLengthScale,
} from '../../utils/domainInfotype'

const EXCEL_COLUMNS = [
  { key: 'subject_area_id',    label: '주제영역ID',    required: false, example: 'STD01' },
  { key: 'domain_group_nm',     label: '도메인그룹명',  required: true,  example: '명칭'          },
  { key: 'std_domain_nm',     label: '도메인명',      required: true,  example: '이름'          },
  { key: 'data_type_nm',     label: '데이터타입',    required: true,  example: 'VARCHAR'      },
  { key: 'data_len',   label: '데이터길이',    required: false, example: '100 또는 7,2', asText: true,
    normalize: (v, row) => normalizeDataLengthInput(
      mergeLegacyLengthScale(v, row?.data_scale, row?.data_type_nm?.trim().toUpperCase()) ?? v,
      row?.data_type_nm,
    ) },
  { key: 'use_yn',        label: '사용여부',      required: false, example: 'Y'            },
  { key: 'std_domain_desc',   label: '설명',          required: false, example: '사람 또는 사물의 이름' },
]

const PAGE_SIZE = 50

export default function DomainsPage() {
  const [search, setSearch] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('search') || ''
    } catch {
      return ''
    }
  })
  const [subjectFilter, setSubjectFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [page, setPage] = useState(1)
  const [allDomains, setAllDomains] = useState([])
  const { navItems } = useSubjectAreaNav()

  const [groups, setGroups] = useState([])
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupForm, setGroupForm] = useState({ domain_group_nm: '', domain_group_desc: '', use_yn: 'Y' })
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupError, setGroupError] = useState(null)
  const [groupSaving, setGroupSaving] = useState(false)
  const [deleteGroup, setDeleteGroup] = useState(null)

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
    loadGroups()
    reloadAllDomains()
  }, [loadGroups, reloadAllDomains])

  const listParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...parseSubjectNavFilter(subjectFilter),
    ...(groupFilter ? { domain_group_nm: groupFilter } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [page, subjectFilter, groupFilter, search])

  const { data, total, loading, error, create, update, remove, refetch } = useDomains(listParams)

  const [panelMode, setPanelMode] = useState(null)
  const [formValue, setFormValue] = useState(DomainForm.EMPTY)
  const [selectedRow, setSelectedRow] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [showExcel, setShowExcel] = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const openCreate = () => {
    const nav = parseSubjectNavFilter(subjectFilter)
    setSelectedRow(null)
    setFormValue({
      ...DomainForm.EMPTY,
      ...(groupFilter ? { domain_group_nm: groupFilter } : {}),
      ...(nav.subject_area_id ? { subject_area_id: nav.subject_area_id } : {}),
    })
    setFormError(null)
    setPanelMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    setFormValue({ ...row, data_len: toFormDataLength(row) })
    setFormError(null)
    setPanelMode('edit')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelectedRow(null)
    setFormError(null)
  }

  const validate = (v) => {
    if (!v.domain_group_nm?.trim()) return '도메인 그룹명을 선택하세요.'
    if (!v.std_domain_nm?.trim()) return '도메인명을 입력하세요.'
    if (!v.data_type_nm) return '데이터 타입을 선택하세요.'
    if (!v.subject_area_id) return '주제영역을 선택하세요.'

    const lenErr = validateDataLength(v.data_len, v.data_type_nm, v.data_scale)
    if (lenErr) return lenErr

    return null
  }

  const sanitizePayload = (v) => {
    const { data_scale, ...rest } = v
    const data_len = normalizeDataLengthInput(v.data_len, v.data_type_nm, data_scale) || null
    return { ...rest, data_len }
  }

  const handleSave = async () => {
    const err = validate(formValue)
    if (err) { setFormError(err); return }
    setSaving(true)
    setFormError(null)
    const payload = sanitizePayload(formValue)
    try {
      if (panelMode === 'create') {
        await create(payload)
        closePanel()
      } else {
        await update(selectedRow.std_domain_id, payload)
        setSelectedRow({ ...selectedRow, ...payload })
      }
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
      if (selectedRow && selected.has(selectedRow.std_domain_id)) closePanel()
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
      await remove(deleteTarget.std_domain_id)
      setDeleteTarget(null)
      closePanel()
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
      closePanel()
      await refetch()
      reloadAllDomains()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleteAllLoading(false)
    }
  }

  const openGroupCreate = () => {
    setEditingGroup(null)
    setGroupForm({ domain_group_nm: '', domain_group_desc: '', use_yn: 'Y' })
    setGroupError(null)
    setShowGroupModal(true)
  }
  const openGroupEdit = (g) => {
    setEditingGroup(g)
    setGroupForm({ domain_group_nm: g.domain_group_nm, domain_group_desc: g.domain_group_desc ?? '', use_yn: g.use_yn })
    setGroupError(null)
    setShowGroupModal(true)
  }
  const closeGroupModal = () => { setShowGroupModal(false); setEditingGroup(null) }

  const handleGroupSave = async () => {
    if (!groupForm.domain_group_nm?.trim()) { setGroupError('그룹명을 입력하세요.'); return }
    setGroupSaving(true); setGroupError(null)
    try {
      if (editingGroup) {
        await domainGroupsApi.update(editingGroup.domain_group_id, groupForm)
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
      await domainGroupsApi.delete(deleteGroup.domain_group_id)
      loadGroups()
      setDeleteGroup(null)
    } catch (e) {
      alert(e.message)
    } finally {
      setGroupSaving(false)
    }
  }

  const groupNavItems = useMemo(
    () => groups.map((g) => ({ id: g.domain_group_nm, label: g.domain_group_nm, icon: '▣' })),
    [groups],
  )

  const getRow = (row) => {
    const typeLen = [row.data_type_nm, formatDataLength(row.data_len, row.data_type_nm)]
      .filter(Boolean).join(' ')
    return {
      id: row.std_domain_id,
      primary: row.std_domain_nm,
      secondary: row.info_type_nm || typeLen,
      meta: [row.domain_group_nm, typeLen, row.subject_area_nm].filter(Boolean).join(' · '),
      status: row.use_yn === 'Y' ? '사용' : '미사용',
      statusTone: row.use_yn === 'Y' ? 'ok' : 'off',
    }
  }

  const detailOpen = panelMode != null

  return (
    <div className="split-page">
      <div className="split-page__header">
        <div>
          <h1 className="page-title">표준 도메인 관리</h1>
          <p className="page-subtitle">속성 값의 유형과 데이터 타입을 정의하는 도메인을 관리합니다.</p>
        </div>
        <div className="split-page__actions">
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <span className="spinner" /> : null}
              선택 삭제 ({selected.size}건)
            </button>
          )}
          <button className="btn btn-secondary" onClick={openGroupCreate}>도메인 그룹 관리</button>
          <button className="btn btn-secondary" onClick={() => setShowExcel(true)}>엑셀 대량 등록</button>
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

      <SplitView
        detailOpen={detailOpen}
        left={(
          <SplitNav
            title="탐색"
            allLabel="전체 도메인"
            allCount={total}
            onSelectAll={() => { setSubjectFilter(''); setGroupFilter(''); setPage(1) }}
            sections={[
              {
                key: 'subjects',
                title: '시스템 · 주제영역',
                items: navItems,
                selectedId: subjectFilter,
                onSelect: (id) => { setSubjectFilter(id); setPage(1) },
              },
              {
                key: 'groups',
                title: '도메인 그룹',
                items: groupNavItems,
                selectedId: groupFilter,
                onSelect: (id) => { setGroupFilter(id); setPage(1) },
              },
            ]}
          />
        )}
        center={(
          <div className="split-list-chrome">
            <div className="split-list-chrome__toolbar">
              <div className="split-list-chrome__title-row">
                <span className="split-list-chrome__title">
                  도메인 목록
                  <span className="split-list-chrome__count"> · {total}건</span>
                </span>
              </div>
              <div className="split-list-chrome__filters">
                <SearchBar
                  value={search}
                  onChange={(v) => { setSearch(v); setPage(1) }}
                  placeholder="도메인명, 인포타입, 데이터타입 검색"
                />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>}
            <div className="split-list-chrome__body">
              <MetaList
                rows={data}
                getRow={getRow}
                selectedId={selectedRow?.std_domain_id}
                onSelect={openEdit}
                selectable
                selectedIds={selected}
                onSelectionChange={setSelected}
                loading={loading}
                emptyText="등록된 도메인이 없습니다."
              />
            </div>
            <div className="split-list-chrome__footer">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </div>
        )}
        right={(
          <SplitDetail
            empty={!detailOpen}
            emptyTitle="도메인을 선택하세요"
            emptyHint="목록에서 도메인을 클릭하면 타입·길이·인포타입 상세가 여기에 표시됩니다."
            title={panelMode === 'create' ? '표준 도메인 등록' : (formValue.std_domain_nm || '표준 도메인 수정')}
            subtitle={panelMode === 'edit' ? (formValue.info_type_nm || selectedRow?.info_type_nm) : '새 도메인 입력'}
            onClose={closePanel}
            footer={(
              <>
                {panelMode === 'edit' && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginRight: 'auto' }}
                    onClick={() => setDeleteTarget(selectedRow)}
                  >
                    삭제
                  </button>
                )}
                <button className="btn btn-secondary" onClick={closePanel} disabled={saving}>닫기</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <span className="spinner" /> : null}
                  {panelMode === 'create' ? '등록' : '저장'}
                </button>
              </>
            )}
          >
            {formError && <div className="alert alert-error">{formError}</div>}
            <DomainForm value={formValue} onChange={setFormValue} groups={groups} />
          </SplitDetail>
        )}
      />

      {showGroupModal && (
        <Modal
          title={editingGroup ? '도메인 그룹 수정' : '도메인 그룹 등록'}
          onClose={closeGroupModal}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={closeGroupModal} disabled={groupSaving}>취소</button>
              <button className="btn btn-primary" onClick={handleGroupSave} disabled={groupSaving}>
                {groupSaving ? <span className="spinner" /> : null}
                {editingGroup ? '저장' : '등록'}
              </button>
            </>
          )}
        >
          {groupError && <div className="alert alert-error">{groupError}</div>}
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
                      <tr key={g.domain_group_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600 }}>{g.domain_group_nm}</td>
                        <td style={{ padding: '7px 12px', color: '#6b7280' }}>{g.domain_group_desc || '-'}</td>
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
              value={groupForm.domain_group_nm}
              onChange={(e) => setGroupForm((f) => ({ ...f, domain_group_nm: e.target.value }))}
              placeholder="예: 명칭, 코드, 금액"
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label className="form-label">설명</label>
            <input
              className="form-control"
              value={groupForm.domain_group_desc}
              onChange={(e) => setGroupForm((f) => ({ ...f, domain_group_desc: e.target.value }))}
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
          message={`"${deleteGroup.domain_group_nm}" 그룹을 삭제하시겠습니까?`}
          onConfirm={handleGroupDelete}
          onCancel={() => setDeleteGroup(null)}
          loading={groupSaving}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.std_domain_nm}" 도메인을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
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
          rowDefaults={{ subject_area_id: 'STD01' }}
          validateRow={(r) => {
            const validTypes = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']
            const dt = r.data_type_nm?.trim().toUpperCase()
            if (dt && !validTypes.includes(dt)) {
              return `데이터타입 "${r.data_type_nm}"은 허용되지 않습니다. (${validTypes.join(', ')})`
            }
            const normalized = normalizeDataLengthInput(
              mergeLegacyLengthScale(r.data_len, r.data_scale, dt) ?? r.data_len,
              dt,
            )
            const lenErr = validateDataLength(normalized, dt)
            if (lenErr) return lenErr
            const yn = r.use_yn?.trim().toUpperCase()
            if (yn && yn !== 'Y' && yn !== 'N') return '사용여부는 Y 또는 N 만 입력 가능합니다.'
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
