import { useCallback, useEffect, useMemo, useState } from 'react'
import { metaSystemsApi } from '../../api/metaSystems'
import { namingRulesApi } from '../../api/namingRules'
import SplitView from '../../components/common/SplitView'
import SplitNav from '../../components/common/SplitNav'
import SplitDetail from '../../components/common/SplitDetail'
import MetaList from '../../components/common/MetaList'
import SearchBar from '../../components/common/SearchBar'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Modal from '../../components/common/Modal'
import {
  EMPTY_RULE,
  EMPTY_SYSTEM,
  NamingRuleForm,
  SystemForm,
  formToPayload,
  ruleToForm,
} from './NamingRuleForm'

export default function DataObjectsPage() {
  const [systems, setSystems] = useState([])
  const [systemsLoading, setSystemsLoading] = useState(true)
  const [selectedSystemId, setSelectedSystemId] = useState('')
  const [search, setSearch] = useState('')
  const [rules, setRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [error, setError] = useState(null)

  const [panelMode, setPanelMode] = useState(null) // null | 'create' | 'edit'
  const [formValue, setFormValue] = useState(EMPTY_RULE)
  const [selectedRule, setSelectedRule] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [systemModal, setSystemModal] = useState(null) // null | 'create' | 'edit'
  const [systemForm, setSystemForm] = useState(EMPTY_SYSTEM)
  const [systemError, setSystemError] = useState(null)
  const [systemSaving, setSystemSaving] = useState(false)
  const [deleteSystem, setDeleteSystem] = useState(null)

  const loadSystems = useCallback(async () => {
    setSystemsLoading(true)
    try {
      const res = await metaSystemsApi.getAll()
      const items = Array.isArray(res) ? res : (res.items ?? [])
      setSystems(items)
      setSelectedSystemId((prev) => {
        if (prev && items.some((s) => String(s.system_id) === String(prev))) return prev
        return items[0] ? String(items[0].system_id) : ''
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setSystemsLoading(false)
    }
  }, [])

  const loadRules = useCallback(async () => {
    if (!selectedSystemId) {
      setRules([])
      return
    }
    setRulesLoading(true)
    setError(null)
    try {
      const res = await namingRulesApi.getAll({
        system_id: selectedSystemId,
        limit: 200,
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRules(Array.isArray(res) ? res : (res.items ?? []))
    } catch (e) {
      setError(e.message)
    } finally {
      setRulesLoading(false)
    }
  }, [selectedSystemId, search])

  useEffect(() => { loadSystems() }, [loadSystems])
  useEffect(() => { loadRules() }, [loadRules])

  const selectedSystem = useMemo(
    () => systems.find((s) => String(s.system_id) === String(selectedSystemId)),
    [systems, selectedSystemId],
  )

  const openCreateRule = () => {
    setSelectedRule(null)
    setFormValue({
      ...EMPTY_RULE,
      system_id: selectedSystemId,
      sort_ord: (rules[rules.length - 1]?.sort_ord ?? 0) + 10,
    })
    setFormError(null)
    setPanelMode('create')
  }

  const openEditRule = (row) => {
    setSelectedRule(row)
    setFormValue(ruleToForm(row))
    setFormError(null)
    setPanelMode('edit')
  }

  const closePanel = () => {
    setPanelMode(null)
    setSelectedRule(null)
    setFormError(null)
  }

  const handleSaveRule = async () => {
    if (!formValue.rule_title_nm?.trim()) { setFormError('규칙 제목을 입력하세요.'); return }
    if (!formValue.system_id) { setFormError('시스템을 선택하세요.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const payload = formToPayload(formValue)
      if (panelMode === 'create') {
        await namingRulesApi.create(payload)
        closePanel()
      } else {
        const updated = await namingRulesApi.update(selectedRule.naming_rule_id, payload)
        setSelectedRule(updated)
        setFormValue(ruleToForm(updated))
      }
      await loadRules()
      await loadSystems()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRule = async () => {
    setSaving(true)
    try {
      await namingRulesApi.delete(deleteTarget.naming_rule_id)
      setDeleteTarget(null)
      closePanel()
      await loadRules()
      await loadSystems()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const openSystemCreate = () => {
    setSystemForm(EMPTY_SYSTEM)
    setSystemError(null)
    setSystemModal('create')
  }

  const openSystemEdit = () => {
    if (!selectedSystem) return
    setSystemForm({
      system_cd: selectedSystem.system_cd,
      system_nm: selectedSystem.system_nm,
      system_desc: selectedSystem.system_desc ?? '',
      use_yn: selectedSystem.use_yn,
      copy_from_enterprise: false,
    })
    setSystemError(null)
    setSystemModal('edit')
  }

  const handleSaveSystem = async () => {
    if (!systemForm.system_cd?.trim()) { setSystemError('시스템 코드를 입력하세요.'); return }
    if (!systemForm.system_nm?.trim()) { setSystemError('시스템명을 입력하세요.'); return }
    setSystemSaving(true)
    setSystemError(null)
    try {
      if (systemModal === 'create') {
        const created = await metaSystemsApi.create({
          system_cd: systemForm.system_cd.trim().toUpperCase(),
          system_nm: systemForm.system_nm.trim(),
          system_desc: systemForm.system_desc?.trim() || null,
          use_yn: systemForm.use_yn,
          copy_from_enterprise: !!systemForm.copy_from_enterprise,
        })
        setSystemModal(null)
        await loadSystems()
        setSelectedSystemId(String(created.system_id))
        closePanel()
      } else {
        await metaSystemsApi.update(selectedSystem.system_id, {
          system_cd: systemForm.system_cd.trim().toUpperCase(),
          system_nm: systemForm.system_nm.trim(),
          system_desc: systemForm.system_desc?.trim() || null,
          use_yn: systemForm.use_yn,
        })
        setSystemModal(null)
        await loadSystems()
      }
    } catch (e) {
      setSystemError(e.message)
    } finally {
      setSystemSaving(false)
    }
  }

  const handleDeleteSystem = async () => {
    setSystemSaving(true)
    try {
      await metaSystemsApi.delete(deleteSystem.system_id)
      setDeleteSystem(null)
      closePanel()
      await loadSystems()
    } catch (e) {
      alert(e.message)
    } finally {
      setSystemSaving(false)
    }
  }

  const getRow = (row) => ({
    id: row.naming_rule_id,
    primary: row.rule_title_nm,
    secondary: row.format_pattern_nm || '',
    meta: row.system_nm || '',
    status: row.use_yn === 'Y' ? '사용' : '미사용',
    statusTone: row.use_yn === 'Y' ? 'ok' : 'off',
  })

  const detailOpen = panelMode != null

  return (
    <div className="split-page">
      <div className="split-page__header">
        <div>
          <h1 className="page-title">전사 표준 관리</h1>
          <p className="page-subtitle">
            시스템별 물리 데이터 객체 명명규칙을 등록·수정·삭제합니다.
          </p>
        </div>
        <div className="split-page__actions">
          <button className="btn btn-secondary" onClick={openSystemCreate}>+ 시스템 등록</button>
          {selectedSystem && (
            <button className="btn btn-secondary" onClick={openSystemEdit}>시스템 수정</button>
          )}
          {selectedSystem && selectedSystem.system_cd !== 'ENTERPRISE' && (
            <button className="btn btn-danger" onClick={() => setDeleteSystem(selectedSystem)}>
              시스템 삭제
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={openCreateRule}
            disabled={!selectedSystemId}
          >
            + 명명규칙 등록
          </button>
        </div>
      </div>

      <SplitView
        detailOpen={detailOpen}
        left={(
          <SplitNav
            title="시스템"
            allLabel="시스템 선택"
            allCount={systems.length}
            onSelectAll={() => {}}
            sections={[
              {
                key: 'systems',
                title: '시스템 영역',
                items: systems.map((s) => ({
                  id: String(s.system_id),
                  label: s.system_nm,
                  count: s.rule_count,
                  icon: s.system_cd === 'ENTERPRISE' ? '★' : '◇',
                })),
                selectedId: selectedSystemId,
                onSelect: (id) => {
                  setSelectedSystemId(id)
                  closePanel()
                },
              },
            ]}
            footer={(
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%' }}
                onClick={openSystemCreate}
              >
                + 시스템 추가
              </button>
            )}
          />
        )}
        center={(
          <div className="split-list-chrome">
            <div className="split-list-chrome__toolbar">
              <div className="split-list-chrome__title-row">
                <span className="split-list-chrome__title">
                  {selectedSystem
                    ? `${selectedSystem.system_nm} 명명규칙`
                    : '명명규칙'}
                  <span className="split-list-chrome__count"> · {rules.length}건</span>
                </span>
              </div>
              <div className="split-list-chrome__filters">
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="제목, 형식 검색"
                />
              </div>
            </div>
            {error && <div className="alert alert-error" style={{ margin: '8px 12px' }}>{error}</div>}
            <div className="split-list-chrome__body">
              {systemsLoading || rulesLoading ? (
                <div className="meta-list meta-list--loading"><span className="spinner" /></div>
              ) : !selectedSystemId ? (
                <div className="meta-list meta-list--empty"><p>시스템을 선택하세요.</p></div>
              ) : (
                <MetaList
                  rows={rules}
                  getRow={getRow}
                  selectedId={selectedRule?.naming_rule_id}
                  onSelect={openEditRule}
                  emptyText="등록된 명명규칙이 없습니다. 규칙을 등록하거나 시스템 생성 시 전사표준을 복사하세요."
                />
              )}
            </div>
          </div>
        )}
        right={(
          <SplitDetail
            empty={!detailOpen}
            emptyTitle="명명규칙을 선택하세요"
            emptyHint="좌측에서 시스템을 고른 뒤, 중앙 목록에서 규칙을 클릭하면 상세를 수정할 수 있습니다."
            title={panelMode === 'create' ? '명명규칙 등록' : (formValue.rule_title_nm || '명명규칙 수정')}
            subtitle={selectedSystem?.system_nm}
            onClose={closePanel}
            footer={(
              <>
                {panelMode === 'edit' && (
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ marginRight: 'auto' }}
                    onClick={() => setDeleteTarget(selectedRule)}
                  >
                    삭제
                  </button>
                )}
                <button className="btn btn-secondary" onClick={closePanel} disabled={saving}>닫기</button>
                <button className="btn btn-primary" onClick={handleSaveRule} disabled={saving}>
                  {saving ? <span className="spinner" /> : null}
                  {panelMode === 'create' ? '등록' : '저장'}
                </button>
              </>
            )}
          >
            {formError && <div className="alert alert-error">{formError}</div>}
            <NamingRuleForm
              value={formValue}
              onChange={setFormValue}
              systems={systems}
              lockSystem={panelMode === 'create' && !!selectedSystemId}
            />
            {panelMode === 'edit' && selectedRule && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e5ea' }}>
                <div className="form-label">미리보기</div>
                <div style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.55 }}>
                  <div><strong>형식</strong> {formValue.format_pattern_nm || '-'}</div>
                  {(formValue.parts || []).map((p, i) => (
                    <div key={i} style={{ marginTop: 6 }}>
                      <strong>{p.code}</strong> {p.name}
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {String(p.rulesText || '').split('\n').filter(Boolean).map((line, j) => (
                          <li key={j}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SplitDetail>
        )}
      />

      {systemModal && (
        <Modal
          title={systemModal === 'create' ? '시스템 등록' : '시스템 수정'}
          onClose={() => setSystemModal(null)}
          footer={(
            <>
              <button className="btn btn-secondary" onClick={() => setSystemModal(null)} disabled={systemSaving}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleSaveSystem} disabled={systemSaving}>
                {systemSaving ? <span className="spinner" /> : null}
                {systemModal === 'create' ? '등록' : '저장'}
              </button>
            </>
          )}
        >
          {systemError && <div className="alert alert-error">{systemError}</div>}
          <SystemForm
            value={systemForm}
            onChange={setSystemForm}
            isEdit={systemModal === 'edit'}
          />
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`"${deleteTarget.rule_title_nm}" 명명규칙을 삭제하시겠습니까?`}
          onConfirm={handleDeleteRule}
          onCancel={() => setDeleteTarget(null)}
          loading={saving}
        />
      )}

      {deleteSystem && (
        <ConfirmDialog
          message={`"${deleteSystem.system_nm}" 시스템과 하위 명명규칙을 모두 삭제하시겠습니까?`}
          onConfirm={handleDeleteSystem}
          onCancel={() => setDeleteSystem(null)}
          loading={systemSaving}
        />
      )}
    </div>
  )
}
