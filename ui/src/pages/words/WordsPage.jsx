import { useState, useMemo, useEffect, useCallback } from 'react'
import { useWords } from '../../hooks/useWords'
import { wordsApi } from '../../api/words'
import { useSubjectAreaNav, parseSubjectNavFilter } from '../../hooks/useSubjectAreaNav'
import SplitView from '../../components/common/SplitView'
import SplitNav from '../../components/common/SplitNav'
import MetaList from '../../components/common/MetaList'
import Pagination from '../../components/common/Pagination'
import SearchBar from '../../components/common/SearchBar'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ExcelUploadModal from '../../components/common/ExcelUploadModal'
import WordForm from './WordForm'

const EXCEL_COLUMNS = [
  { key: 'subject_area_id',     label: '주제영역ID',    required: false, example: 'STD01'    },
  { key: 'std_word_nm',        label: '단어명',        required: true,  example: '고객'      },
  { key: 'full_eng_nm',    label: '영문명(전체)',   required: true,  example: 'Customer' },
  { key: 'abb_word_nm',    label: '영문약어',       required: true,  example: 'CUST'     },
  { key: 'kor_synonym_nm', label: '한글동의어',     required: false, example: '거래처'    },
  { key: 'taxon_yn',       label: '분류어여부',     required: false, example: 'N'           },
  { key: 'use_yn',         label: '사용여부',       required: false, example: 'Y'           },
  { key: 'std_word_desc',      label: '설명',           required: false, example: '(비우면 네이버 국어사전 자동 입력)' },
]

const PAGE_SIZE = 50

export default function WordsPage() {
  const [search, setSearch] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('search') || ''
    } catch {
      return ''
    }
  })
  const [subjectFilter, setSubjectFilter] = useState('')
  const [page, setPage] = useState(1)
  const [allWords, setAllWords] = useState([])
  const { navItems } = useSubjectAreaNav()

  useEffect(() => {
    wordsApi.getAll({ limit: 10000 })
      .then((res) => setAllWords(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  const reloadAllWords = useCallback(() => {
    wordsApi.getAll({ limit: 10000 })
      .then((res) => setAllWords(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [])

  const listParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    ...parseSubjectNavFilter(subjectFilter),
    ...(search.trim() ? { search: search.trim() } : {}),
  }), [page, subjectFilter, search])

  const { data, total, loading, error, create, update, remove, refetch } = useWords(listParams)

  const [modalMode, setModalMode] = useState(null)
  const [formValue, setFormValue] = useState(WordForm.EMPTY)
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
    setFormError(null)
  }

  const validate = (v) => {
    if (!v.std_word_nm?.trim()) return '단어명을 입력하세요.'
    if (!v.abb_word_nm?.trim()) return '영문약어를 입력하세요.'
    if (!v.full_eng_nm?.trim()) return '영문명을 입력하세요.'
    if (!v.subject_area_id) return '주제영역을 선택하세요.'

    const wordNm = v.std_word_nm.trim()
    if (wordNm.length > 15) return '단어명은 최대 15자까지 입력 가능합니다.'
    if (/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\/\-&]/.test(wordNm)) {
      return '단어명에는 공백 및 특수문자를 사용할 수 없습니다. (/, -, & 만 허용)'
    }

    const abbr = v.abb_word_nm.trim()
    if (abbr.length > 10) return '영문약어는 최대 10자까지 입력 가능합니다.'
    if (/\s/.test(abbr)) return '영문약어에는 공백을 사용할 수 없습니다.'
    if (/[^A-Za-z0-9]/.test(abbr)) {
      return '영문약어는 영문과 숫자만 사용할 수 있습니다. (_ 등 특수문자 불가)'
    }
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
        await update(selectedRow.std_word_id, formValue)
      }
      closeModal()
      reloadAllWords()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await remove(deleteTarget.std_word_id)
      setDeleteTarget(null)
      closeModal()
      reloadAllWords()
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
      await Promise.all([...selected].map((id) => wordsApi.delete(id)))
      setSelected(new Set())
      if (selectedRow && selected.has(selectedRow.std_word_id)) closeModal()
      await refetch()
      reloadAllWords()
    } catch (e) {
      alert(e.message)
      await refetch()
      reloadAllWords()
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    setDeleteAllLoading(true)
    try {
      await wordsApi.deleteAll()
      setShowDeleteAll(false)
      setSelected(new Set())
      setPage(1)
      closeModal()
      await refetch()
      reloadAllWords()
    } catch (e) {
      alert(e.message)
    } finally {
      setDeleteAllLoading(false)
    }
  }

  const getRow = (row) => ({
    id: row.std_word_id,
    primary: row.std_word_nm,
    secondary: [row.abb_word_nm, row.full_eng_nm].filter(Boolean).join(' · '),
    meta: [row.subject_area_nm, row.kor_synonym_nm, row.taxon_yn === 'Y' ? '분류어' : null]
      .filter(Boolean).join(' · '),
    status: row.use_yn === 'Y' ? '사용' : '미사용',
    statusTone: row.use_yn === 'Y' ? 'ok' : 'off',
  })

  return (
    <div className="split-page">
      <div className="split-page__header">
        <div>
          <h1 className="page-title">표준 단어 관리</h1>
          <p className="page-subtitle">데이터 표준화를 위한 단어를 등록하고 관리합니다.</p>
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
            disabled={allWords.length === 0 || deleteAllLoading}
          >
            {deleteAllLoading ? <span className="spinner" /> : null}
            전체삭제
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ 단어 등록</button>
        </div>
      </div>

      <SplitView
        left={(
          <SplitNav
            title="주제영역"
            allLabel="전체 단어"
            allCount={total}
            items={navItems}
            selectedId={subjectFilter}
            onSelect={(id) => { setSubjectFilter(id); setPage(1) }}
          />
        )}
        center={(
          <div className="split-list-chrome">
            <div className="split-list-chrome__toolbar">
              <div className="split-list-chrome__title-row">
                <span className="split-list-chrome__title">
                  단어 목록
                  <span className="split-list-chrome__count"> · {total}건</span>
                </span>
              </div>
              <div className="split-list-chrome__filters">
                <SearchBar
                  value={search}
                  onChange={(v) => { setSearch(v); setPage(1) }}
                  placeholder="단어명, 영문약어, 영문명 검색"
                />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>}
            <div className="split-list-chrome__body">
              <MetaList
                rows={data}
                getRow={getRow}
                selectedId={selectedRow?.std_word_id}
                onSelect={openEdit}
                selectable
                selectedIds={selected}
                onSelectionChange={setSelected}
                loading={loading}
                emptyText="등록된 단어가 없습니다."
              />
            </div>
            <div className="split-list-chrome__footer">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </div>
        )}
      />

      {modalMode && (
        <Modal
          title={modalMode === 'create' ? '표준 단어 등록' : '표준 단어 수정'}
          onClose={closeModal}
          footer={(
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
          )}
        >
          {formError && <div className="alert alert-error">{formError}</div>}
          <WordForm value={formValue} onChange={setFormValue} />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.std_word_nm}" 단어를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}

      {showDeleteAll && (
        <ConfirmDialog
          message={`표준 단어 ${allWords.length}건을 모두 삭제하시겠습니까? 등록된 표준 용어가 있으면 삭제할 수 없습니다. 검색·필터와 관계없이 모든 단어가 삭제되며, 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAll(false)}
          loading={deleteAllLoading}
        />
      )}

      {showExcel && (
        <ExcelUploadModal
          title="표준단어"
          columns={EXCEL_COLUMNS}
          rowDefaults={{ subject_area_id: 'STD01' }}
          validateRow={(r) => {
            const nm = r.std_word_nm?.trim() ?? ''
            const abbr = r.abb_word_nm?.trim() ?? ''
            if (nm.length > 15) return '단어명은 최대 15자까지 가능합니다.'
            if (/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\/\-&]/.test(nm)) {
              return '단어명에 허용되지 않는 문자(공백·특수문자)가 포함되어 있습니다. (/, -, & 만 허용)'
            }
            if (abbr.length > 10) return '영문약어는 최대 10자까지 가능합니다.'
            if (/\s/.test(abbr)) return '영문약어에 공백을 사용할 수 없습니다.'
            if (/[^A-Za-z0-9]/.test(abbr)) return '영문약어는 영문과 숫자만 사용할 수 있습니다. (_ 등 특수문자 불가)'
            const yn = r.use_yn?.trim().toUpperCase()
            if (yn && yn !== 'Y' && yn !== 'N') return '사용여부는 Y 또는 N 만 입력 가능합니다.'
            const ty = r.taxon_yn?.trim().toUpperCase()
            if (ty && ty !== 'Y' && ty !== 'N') return '분류어여부는 Y 또는 N 만 입력 가능합니다.'
            return null
          }}
          onUpload={(rows) => wordsApi.bulk(rows)}
          onClose={() => setShowExcel(false)}
          onDone={() => { setShowExcel(false); refetch(); reloadAllWords() }}
        />
      )}
    </div>
  )
}
