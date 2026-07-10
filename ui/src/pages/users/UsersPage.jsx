import { useState, useMemo } from 'react'
import { useUsers } from '../../hooks/useUsers'
import { usersApi } from '../../api/users'
import SplitView from '../../components/common/SplitView'
import SplitNav from '../../components/common/SplitNav'
import SplitDetail from '../../components/common/SplitDetail'
import MetaList from '../../components/common/MetaList'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import UserForm from './UserForm'

const EXCEL_COLUMNS = [
  { key: 'username', label: '사용자ID', required: true, example: 'hong.gildong' },
  { key: 'password', label: '비밀번호', required: true, example: 'pass1234' },
  { key: 'user_nm', label: '사용자명', required: true, example: '홍길동' },
  { key: 'email', label: '이메일', required: false, example: 'hong@company.com' },
  { key: 'dept_nm', label: '부서', required: false, example: '데이터관리팀' },
  { key: 'role_cd', label: '권한', required: false, example: 'USER' },
  { key: 'use_yn', label: '사용여부', required: false, example: 'Y' },
]

const PAGE_SIZE = 50

const ROLE_LABEL = { ADMIN: '관리자', USER: '일반' }

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [useFilter, setUseFilter] = useState('')
  const [page, setPage] = useState(1)

  const listParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(roleFilter ? { role_cd: roleFilter } : {}),
    ...(useFilter ? { use_yn: useFilter } : {}),
  }), [page, search, roleFilter, useFilter])

  const { data, total, loading, error, create, update, remove, refetch } = useUsers(listParams)

  const [panelMode, setPanelMode] = useState(null)
  const [formValue, setFormValue] = useState(UserForm.EMPTY)
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
    setSelectedRow(null)
    setFormValue(UserForm.EMPTY)
    setFormError(null)
    setPanelMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    setFormValue({
      ...UserForm.EMPTY,
      ...row,
      password: '',
      password_confirm: '',
      email: row.email ?? '',
      dept_nm: row.dept_nm ?? '',
    })
    setFormError(null)
    setPanelMode('edit')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelectedRow(null)
    setFormError(null)
  }

  const validate = (v, isEdit) => {
    if (!v.username?.trim()) return '사용자 ID를 입력하세요.'
    if (!/^[A-Za-z0-9._@-]+$/.test(v.username.trim())) {
      return '사용자 ID는 영문, 숫자, . _ @ - 만 사용할 수 있습니다.'
    }
    if (!v.user_nm?.trim()) return '사용자명을 입력하세요.'
    if (!isEdit) {
      if (!v.password) return '비밀번호를 입력하세요.'
      if (v.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.'
      if (v.password !== v.password_confirm) return '비밀번호 확인이 일치하지 않습니다.'
    } else if (v.password) {
      if (v.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.'
      if (v.password !== v.password_confirm) return '비밀번호 확인이 일치하지 않습니다.'
    }
    return null
  }

  const toPayload = (v) => {
    const { password_confirm, ...rest } = v
    const payload = {
      username: rest.username?.trim(),
      user_nm: rest.user_nm?.trim(),
      email: rest.email?.trim() || null,
      dept_nm: rest.dept_nm?.trim() || null,
      role_cd: rest.role_cd || 'USER',
      use_yn: rest.use_yn || 'Y',
    }
    if (rest.password) payload.password = rest.password
    return payload
  }

  const handleSave = async () => {
    const isEdit = panelMode === 'edit'
    const err = validate(formValue, isEdit)
    if (err) { setFormError(err); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = toPayload(formValue)
      if (panelMode === 'create') {
        await create(payload)
        closePanel()
      } else {
        const updated = await update(selectedRow.user_id, payload)
        setSelectedRow(updated)
        setFormValue({
          ...UserForm.EMPTY,
          ...updated,
          password: '',
          password_confirm: '',
          email: updated.email ?? '',
          dept_nm: updated.dept_nm ?? '',
        })
      }
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await remove(deleteTarget.user_id)
      setDeleteTarget(null)
      closePanel()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setBulkDeleting(true)
    try {
      await Promise.all([...selected].map((id) => usersApi.delete(id)))
      setSelected(new Set())
      if (selectedRow && selected.has(selectedRow.user_id)) closePanel()
      await refetch()
    } catch (e) {
      alert(e.message)
      await refetch()
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    setDeleteAllLoading(true)
    try {
      await usersApi.deleteAll()
      setShowDeleteAll(false)
      setSelected(new Set())
      setPage(1)
      closePanel()
      await refetch()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleteAllLoading(false)
    }
  }

  const getRow = (row) => ({
    id: row.user_id,
    primary: row.user_nm || row.username,
    secondary: row.username,
    meta: [ROLE_LABEL[row.role_cd] || row.role_cd, row.dept_nm, row.email]
      .filter(Boolean).join(' · '),
    status: row.use_yn === 'Y' ? '사용' : '미사용',
    statusTone: row.use_yn === 'Y' ? 'ok' : 'off',
  })

  const detailOpen = panelMode != null

  return (
    <div className="split-page">
      <div className="split-page__header">
        <div>
          <h1 className="page-title">사용자 관리</h1>
          <p className="page-subtitle">iMeta 포털 접속 계정을 등록하고 관리합니다.</p>
        </div>
        <div className="split-page__actions">
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <span className="spinner" /> : null}
              선택 삭제 ({selected.size}건)
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowExcel(true)}>엑셀 대량 등록</button>
          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteAll(true)}
            disabled={total === 0 || deleteAllLoading}
          >
            {deleteAllLoading ? <span className="spinner" /> : null}
            전체삭제
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ 사용자 등록</button>
        </div>
      </div>

      <SplitView
        detailOpen={detailOpen}
        left={(
          <SplitNav
            title="필터"
            allLabel="전체 사용자"
            allCount={total}
            onSelectAll={() => { setRoleFilter(''); setUseFilter(''); setPage(1) }}
            sections={[
              {
                key: 'role',
                title: '권한',
                items: [
                  { id: 'ADMIN', label: '관리자', icon: '★' },
                  { id: 'USER', label: '일반', icon: '◇' },
                ],
                selectedId: roleFilter,
                onSelect: (id) => { setRoleFilter(id); setPage(1) },
              },
              {
                key: 'use',
                title: '사용 여부',
                items: [
                  { id: 'Y', label: '사용', icon: '●' },
                  { id: 'N', label: '미사용', icon: '○' },
                ],
                selectedId: useFilter,
                onSelect: (id) => { setUseFilter(id); setPage(1) },
              },
            ]}
          />
        )}
        center={(
          <div className="split-list-chrome">
            <div className="split-list-chrome__toolbar">
              <div className="split-list-chrome__title-row">
                <span className="split-list-chrome__title">
                  사용자 목록
                  <span className="split-list-chrome__count"> · {total}건</span>
                </span>
              </div>
              <div className="split-list-chrome__filters">
                <SearchBar
                  value={search}
                  onChange={(v) => { setSearch(v); setPage(1) }}
                  placeholder="사용자ID, 이름, 이메일, 부서 검색"
                />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>}
            <div className="split-list-chrome__body">
              <MetaList
                rows={data}
                getRow={getRow}
                selectedId={selectedRow?.user_id}
                onSelect={openEdit}
                selectable
                selectedIds={selected}
                onSelectionChange={setSelected}
                loading={loading}
                emptyText="등록된 사용자가 없습니다."
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
            emptyTitle="사용자를 선택하세요"
            emptyHint="목록에서 사용자를 클릭하면 상세 정보가 여기에 표시됩니다. 새 사용자는 우측 상단에서 등록할 수 있습니다."
            title={panelMode === 'create' ? '사용자 등록' : (formValue.user_nm || '사용자 수정')}
            subtitle={panelMode === 'edit' ? formValue.username : '새 계정 입력'}
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
            <UserForm value={formValue} onChange={setFormValue} isEdit={panelMode === 'edit'} />
          </SplitDetail>
        )}
      />

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.user_nm || deleteTarget.username}" 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}

      {showDeleteAll && (
        <ConfirmDialog
          message={`사용자 ${total}건을 모두 삭제하시겠습니까? 로그인 계정이 모두 삭제되면 환경변수 기본 계정으로만 로그인할 수 있습니다. 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAll(false)}
          loading={deleteAllLoading}
        />
      )}

      {showExcel && (
        <ExcelUploadModal
          title="사용자"
          columns={EXCEL_COLUMNS}
          rowDefaults={{ role_cd: 'USER', use_yn: 'Y' }}
          validateRow={(r) => {
            const username = r.username?.trim() ?? ''
            const password = r.password ?? ''
            const user_nm = r.user_nm?.trim() ?? ''
            if (!username) return '사용자ID는 필수입니다.'
            if (!/^[A-Za-z0-9._@-]+$/.test(username)) {
              return '사용자ID는 영문, 숫자, . _ @ - 만 사용할 수 있습니다.'
            }
            if (!user_nm) return '사용자명은 필수입니다.'
            if (!password || String(password).length < 4) return '비밀번호는 4자 이상이어야 합니다.'
            const role = r.role_cd?.trim().toUpperCase()
            if (role && role !== 'ADMIN' && role !== 'USER') return '권한은 ADMIN 또는 USER만 가능합니다.'
            const yn = r.use_yn?.trim().toUpperCase()
            if (yn && yn !== 'Y' && yn !== 'N') return '사용여부는 Y 또는 N만 입력 가능합니다.'
            return null
          }}
          onUpload={(rows) => usersApi.bulk(rows)}
          onClose={() => setShowExcel(false)}
          onDone={() => { setShowExcel(false); refetch() }}
        />
      )}
    </div>
  )
}
