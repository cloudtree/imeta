import { useState, useMemo } from 'react'
import { useSubjectAreas } from '../../hooks/useSubjectAreas'
import SplitView from '../../components/common/SplitView'
import SplitNav from '../../components/common/SplitNav'
import SplitDetail from '../../components/common/SplitDetail'
import MetaList from '../../components/common/MetaList'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import SubjectAreaForm from './SubjectAreaForm'

const PAGE_SIZE = 50

export default function SubjectAreasPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [useFilter, setUseFilter] = useState('') // '' | 'Y' | 'N'

  const { data, total, loading, error, create, update, remove } = useSubjectAreas({})

  const [panelMode, setPanelMode] = useState(null)
  const [formValue, setFormValue] = useState(SubjectAreaForm.EMPTY)
  const [selectedRow, setSelectedRow] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const filtered = useMemo(() => {
    let rows = data
    if (useFilter) rows = rows.filter((r) => r.use_yn === useFilter)
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(
      (r) =>
        r.subject_id?.toLowerCase().includes(q)
        || r.subject_name?.toLowerCase().includes(q),
    )
  }, [data, search, useFilter])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const openCreate = () => {
    setSelectedRow(null)
    setFormValue(SubjectAreaForm.EMPTY)
    setFormError(null)
    setPanelMode('create')
  }

  const openEdit = (row) => {
    setSelectedRow(row)
    setFormValue({ ...row })
    setFormError(null)
    setPanelMode('edit')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelectedRow(null)
    setFormError(null)
  }

  const validate = (v) => {
    if (!v.subject_id?.trim()) return '주제영역 ID를 입력하세요.'
    if (!v.subject_name?.trim()) return '주제영역명을 입력하세요.'
    return null
  }

  const handleSave = async () => {
    const err = validate(formValue)
    if (err) { setFormError(err); return }
    setSaving(true)
    setFormError(null)
    try {
      if (panelMode === 'create') {
        await create(formValue)
        closePanel()
      } else {
        await update(selectedRow.subject_id, formValue)
        setSelectedRow({ ...selectedRow, ...formValue })
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
      await remove(deleteTarget.subject_id)
      setDeleteTarget(null)
      closePanel()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const getRow = (row) => ({
    id: row.subject_id,
    primary: row.subject_name,
    secondary: row.subject_id,
    meta: [
      `단어 ${row.word_count ?? 0}`,
      `용어 ${row.term_count ?? 0}`,
      `도메인 ${row.domain_count ?? 0}`,
    ].join(' · '),
    status: row.use_yn === 'Y' ? '사용' : '미사용',
    statusTone: row.use_yn === 'Y' ? 'ok' : 'off',
  })

  const detailOpen = panelMode != null

  return (
    <div className="split-page">
      <div className="split-page__header">
        <div>
          <h1 className="page-title">주제영역 관리</h1>
          <p className="page-subtitle">데이터 모델의 주제영역을 등록하고 관리합니다.</p>
        </div>
        <div className="split-page__actions">
          <button className="btn btn-primary" onClick={openCreate}>+ 주제영역 등록</button>
        </div>
      </div>

      <SplitView
        detailOpen={detailOpen}
        left={(
          <SplitNav
            title="상태"
            allLabel="전체 주제영역"
            allCount={total}
            items={[
              { id: 'Y', label: '사용 중', icon: '●' },
              { id: 'N', label: '미사용', icon: '○' },
            ]}
            selectedId={useFilter}
            onSelect={(id) => { setUseFilter(id); setPage(1) }}
          />
        )}
        center={(
          <div className="split-list-chrome">
            <div className="split-list-chrome__toolbar">
              <div className="split-list-chrome__title-row">
                <span className="split-list-chrome__title">
                  주제영역 목록
                  <span className="split-list-chrome__count"> · {filtered.length}건</span>
                </span>
              </div>
              <div className="split-list-chrome__filters">
                <SearchBar
                  value={search}
                  onChange={(v) => { setSearch(v); setPage(1) }}
                  placeholder="주제영역 ID, 주제영역명 검색"
                />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>}
            <div className="split-list-chrome__body">
              <MetaList
                rows={paged}
                getRow={getRow}
                selectedId={selectedRow?.subject_id}
                onSelect={openEdit}
                loading={loading}
                emptyText="등록된 주제영역이 없습니다."
              />
            </div>
            <div className="split-list-chrome__footer">
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </div>
          </div>
        )}
        right={(
          <SplitDetail
            empty={!detailOpen}
            emptyTitle="주제영역을 선택하세요"
            emptyHint="목록에서 주제영역을 클릭하면 상세 정보가 여기에 표시됩니다."
            title={panelMode === 'create' ? '주제영역 등록' : (formValue.subject_name || '주제영역 수정')}
            subtitle={panelMode === 'edit' ? formValue.subject_id : '새 주제영역 입력'}
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
            <SubjectAreaForm value={formValue} onChange={setFormValue} isEdit={panelMode === 'edit'} />
          </SplitDetail>
        )}
      />

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
