import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDbServers } from '../../hooks/useDbServers'
import { dbServersApi } from '../../api/dbServers'
import { wordsApi } from '../../api/words'
import { termsApi } from '../../api/terms'
import { domainsApi } from '../../api/domains'
import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'
import DataTable from '../../components/common/DataTable'
import { mapIntrospectionDefinitionRows } from './mapIntrospectionRow'
import {
  buildStandardCandidates,
  formatSourceRows,
  getWordViolations,
  getDomainViolations,
  getTermViolations,
} from './serverStandardReviewUtils'

const TABS = [
  { id: 'words', label: '단어' },
  { id: 'domains', label: '도메인' },
  { id: 'terms', label: '용어' },
]

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

// fresh: 방금 재분석한 계산값(물리명, 도메인 대기 여부 등) — 항상 최신 유지
// editableFields: 사용자가 화면에서 직접 고친 값만 이전 상태에서 되살림
function mergeEdits(freshList, prevList, editableFields) {
  const prevByKey = new Map(prevList.map((r) => [r._key, r]))
  return freshList.map((fresh) => {
    const prev = prevByKey.get(fresh._key)
    if (!prev) return fresh
    const merged = { ...fresh }
    editableFields.forEach((f) => { merged[f] = prev[f] })
    return merged
  })
}

function textInput(value, onChange, opts = {}) {
  return (
    <input
      className="form-control"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ minWidth: '100px', ...opts.style }}
    />
  )
}

export default function ServerStandardReviewPage() {
  const { data: servers, loading: serversLoading } = useDbServers({ use_yn: 'Y' })

  const [selectedServerId, setSelectedServerId] = useState('')
  const [subjectAreaId, setSubjectAreaId] = useState(DEFAULT_SUBJECT_ID)
  const [rows, setRows] = useState([])
  const [serverInfo, setServerInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [hasAnalyzed, setHasAnalyzed] = useState(false)
  const [warnings, setWarnings] = useState([])
  const [activeTab, setActiveTab] = useState('words')

  const [wordRows, setWordRows] = useState([])
  const [domainRows, setDomainRows] = useState([])
  const [termRows, setTermRows] = useState([])
  const [wordSelected, setWordSelected] = useState(new Set())
  const [domainSelected, setDomainSelected] = useState(new Set())
  const [termSelected, setTermSelected] = useState(new Set())
  const [registering, setRegistering] = useState(false)
  const [registerResult, setRegisterResult] = useState(null)
  const [dicts, setDicts] = useState({ words: [], domains: [], terms: [] })

  useEffect(() => {
    if (!selectedServerId && servers.length) {
      setSelectedServerId(String(servers[0].db_server_id))
    }
  }, [servers, selectedServerId])

  const loadDictionaries = async () => {
    const [wordsRes, termsRes, domainsRes] = await Promise.all([
      wordsApi.dictionary(),
      termsApi.getAll({ limit: 10000, use_yn: 'Y' }),
      domainsApi.getAll({ limit: 10000, use_yn: 'Y' }),
    ])
    return {
      words: Array.isArray(wordsRes) ? wordsRes : (wordsRes.items ?? []),
      terms: Array.isArray(termsRes) ? termsRes : (termsRes.items ?? []),
      domains: Array.isArray(domainsRes) ? domainsRes : (domainsRes.items ?? []),
    }
  }

  const runAnalysis = useCallback(async (rowsToAnalyze) => {
    if (!rowsToAnalyze.length) return
    setAnalyzing(true)
    setRegisterResult(null)
    try {
      const { words, terms, domains } = await loadDictionaries()
      setDicts({ words, terms, domains })
      const result = buildStandardCandidates(rowsToAnalyze, { words, terms, domains, subjectAreaId })

      const nextWords = mergeEdits(result.wordCandidates, wordRows, ['full_eng_nm', 'abb_word_nm', 'taxon_yn', 'std_word_desc'])
      const englishLookups = await Promise.allSettled(
        nextWords
          .filter((w) => !w.full_eng_nm && !w.abb_word_nm)
          .map((w) => wordsApi.lookupEn(w.std_word_nm).then((r) => ({ key: w._key, r }))),
      )
      const lookupByKey = new Map(
        englishLookups.filter((r) => r.status === 'fulfilled').map((r) => [r.value.key, r.value.r]),
      )
      const finalWords = nextWords.map((w) => {
        const hit = lookupByKey.get(w._key)
        return hit ? { ...w, full_eng_nm: hit.full_eng_nm, abb_word_nm: hit.abb_word_nm } : w
      })

      const finalDomains = mergeEdits(result.domainCandidates, domainRows, ['std_domain_nm', 'domain_group_nm', 'data_type_nm', 'data_len', 'std_domain_desc'])
      const finalTerms = mergeEdits(result.termCandidates, termRows, ['domain_group_nm', 'std_term_desc'])

      setWordRows(finalWords)
      setDomainRows(finalDomains)
      setTermRows(finalTerms)
      // 지침 위반이 없는 후보만 기본 선택 — 위반된 항목은 사용자가 고치거나 직접 체크해야 등록됨
      setWordSelected(new Set(
        finalWords.filter((w) => getWordViolations(w, { existingWords: words, allWordRows: finalWords }).length === 0).map((w) => w._key),
      ))
      setDomainSelected(new Set(
        finalDomains.filter((d) => getDomainViolations(d).length === 0).map((d) => d._key),
      ))
      setTermSelected(new Set(
        finalTerms.filter((t) => getTermViolations(t).length === 0).map((t) => t._key),
      ))
      setWarnings(result.warnings)
      setHasAnalyzed(true)
    } catch (e) {
      alert(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [subjectAreaId, wordRows, domainRows, termRows])

  const loadDefinitions = useCallback(async () => {
    if (!selectedServerId) return
    setLoading(true)
    setError(null)
    setRows([])
    setServerInfo(null)
    setWarnings([])
    setWordRows([]); setDomainRows([]); setTermRows([])
    setHasAnalyzed(false)
    setRegisterResult(null)
    try {
      const res = await dbServersApi.getSchemaDefinitions(selectedServerId)
      const items = mapIntrospectionDefinitionRows(res.items ?? [])
      setRows(items)
      setServerInfo(res.server ?? null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServerId])

  useEffect(() => {
    if (selectedServerId) loadDefinitions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServerId])

  const reanalyze = () => {
    if (rows.length) runAnalysis(rows)
  }

  const updateRow = (setRows, key, field, value) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
  }

  // 지침 위반 여부 — 편집할 때마다 다시 계산됨. 위반이 있으면 리스트에서 제외하고
  // (등록 가능한 것만 보여줌) 사유만 별도 요약에 남긴다.
  const wordViolations = useMemo(
    () => new Map(wordRows.map((w) => [w._key, getWordViolations(w, { existingWords: dicts.words, allWordRows: wordRows })])),
    [wordRows, dicts.words],
  )
  const domainViolations = useMemo(
    () => new Map(domainRows.map((d) => [d._key, getDomainViolations(d)])),
    [domainRows],
  )
  const termViolations = useMemo(
    () => new Map(termRows.map((t) => [t._key, getTermViolations(t)])),
    [termRows],
  )

  const visibleWordRows = useMemo(
    () => wordRows.filter((w) => (wordViolations.get(w._key) ?? []).length === 0),
    [wordRows, wordViolations],
  )
  const visibleDomainRows = useMemo(
    () => domainRows.filter((d) => (domainViolations.get(d._key) ?? []).length === 0),
    [domainRows, domainViolations],
  )
  const visibleTermRows = useMemo(
    () => termRows.filter((t) => (termViolations.get(t._key) ?? []).length === 0),
    [termRows, termViolations],
  )

  const excluded = useMemo(() => {
    const list = []
    wordRows.forEach((w) => {
      const issues = wordViolations.get(w._key) ?? []
      if (issues.length) list.push({ label: `단어 "${w.std_word_nm}"`, issues })
    })
    domainRows.forEach((d) => {
      const issues = domainViolations.get(d._key) ?? []
      if (issues.length) list.push({ label: `도메인 "${d.std_domain_nm || '(이름 없음)'}"`, issues })
    })
    termRows.forEach((t) => {
      const issues = termViolations.get(t._key) ?? []
      if (issues.length) list.push({ label: `용어 "${t.logical_term_nm}"`, issues })
    })
    return list
  }, [wordRows, domainRows, termRows, wordViolations, domainViolations, termViolations])

  const cleanPayload = (list, keys) =>
    list.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])))

  const handleDeleteSelected = (tab) => {
    const setRows = tab === 'words' ? setWordRows : tab === 'domains' ? setDomainRows : setTermRows
    const selected = tab === 'words' ? wordSelected : tab === 'domains' ? domainSelected : termSelected
    const setSelected = tab === 'words' ? setWordSelected : tab === 'domains' ? setDomainSelected : setTermSelected
    if (!selected.size) return
    if (!window.confirm(`선택한 후보 ${selected.size}건을 목록에서 삭제하시겠습니까?`)) return
    setRows((prev) => prev.filter((r) => !selected.has(r._key)))
    setSelected(new Set())
  }

  const handleRegister = async (tab) => {
    setRegistering(true)
    setRegisterResult(null)
    try {
      let res
      if (tab === 'words') {
        const checked = wordRows.filter((r) => wordSelected.has(r._key))
        if (!checked.length) { alert('등록할 단어를 선택하세요.'); return }
        res = await wordsApi.bulk(cleanPayload(checked, [
          'std_word_nm', 'full_eng_nm', 'abb_word_nm', 'kor_synonym_nm', 'taxon_yn', 'std_word_desc', 'use_yn', 'subject_area_id',
        ]))
      } else if (tab === 'domains') {
        const checked = domainRows.filter((r) => domainSelected.has(r._key))
        if (!checked.length) { alert('등록할 도메인을 선택하세요.'); return }
        res = await domainsApi.bulk(cleanPayload(checked, [
          'std_domain_nm', 'domain_group_nm', 'data_type_nm', 'data_len', 'std_domain_desc', 'use_yn', 'subject_area_id',
        ]))
      } else {
        const checked = termRows.filter((r) => termSelected.has(r._key) && !r._domainPending)
        if (!checked.length) { alert('등록할 용어를 선택하세요.'); return }
        res = await termsApi.bulk(cleanPayload(checked, [
          'logical_term_nm', 'physical_term_nm', 'domain_group_nm', 'data_type_nm', 'data_len', 'std_term_desc', 'use_yn', 'subject_area_id',
        ]))
      }
      setRegisterResult({ tab, ...res })
      reanalyze()
    } catch (e) {
      alert(e.message)
    } finally {
      setRegistering(false)
    }
  }

  const wordColumns = [
    { key: 'std_word_nm', label: '단어명' },
    { key: 'full_eng_nm', label: '영문명', render: (v, r) => textInput(v, (nv) => updateRow(setWordRows, r._key, 'full_eng_nm', nv)) },
    { key: 'abb_word_nm', label: '영문약어', render: (v, r) => textInput(v?.toUpperCase(), (nv) => updateRow(setWordRows, r._key, 'abb_word_nm', nv.toUpperCase())) },
    { key: 'taxon_yn', label: '분류어', render: (v, r) => (
      <select className="form-control" value={v} onChange={(e) => updateRow(setWordRows, r._key, 'taxon_yn', e.target.value)}>
        <option value="Y">Y</option>
        <option value="N">N</option>
      </select>
    ) },
    { key: 'std_word_desc', label: '설명', render: (v, r) => textInput(v, (nv) => updateRow(setWordRows, r._key, 'std_word_desc', nv), { style: { minWidth: '160px' } }) },
    { key: '_sourceRows', label: '사용된 컬럼', render: (v) => <span title={formatSourceRows(v, 20)}>{formatSourceRows(v)}</span> },
  ]

  const domainColumns = [
    { key: 'std_domain_nm', label: '도메인명', render: (v, r) => textInput(v, (nv) => updateRow(setDomainRows, r._key, 'std_domain_nm', nv)) },
    { key: 'domain_group_nm', label: '도메인그룹명', render: (v, r) => textInput(v, (nv) => updateRow(setDomainRows, r._key, 'domain_group_nm', nv)) },
    { key: 'data_type_nm', label: '데이터타입', render: (v, r) => (
      <select className="form-control" value={v} onChange={(e) => updateRow(setDomainRows, r._key, 'data_type_nm', e.target.value)}>
        {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    ) },
    { key: 'data_len', label: '데이터길이', render: (v, r) => textInput(v, (nv) => updateRow(setDomainRows, r._key, 'data_len', nv), { style: { minWidth: '70px' } }) },
    { key: 'std_domain_desc', label: '설명', render: (v, r) => textInput(v, (nv) => updateRow(setDomainRows, r._key, 'std_domain_desc', nv), { style: { minWidth: '160px' } }) },
    { key: '_sourceRows', label: '사용된 컬럼', render: (v) => <span title={formatSourceRows(v, 20)}>{formatSourceRows(v)}</span> },
  ]

  const termColumns = [
    { key: 'logical_term_nm', label: '논리명' },
    { key: 'physical_term_nm', label: '물리명', render: (v) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { key: 'domain_group_nm', label: '도메인그룹명', render: (v, r) => textInput(v, (nv) => updateRow(setTermRows, r._key, 'domain_group_nm', nv)) },
    { key: 'data_type_nm', label: '데이터타입' },
    { key: 'data_len', label: '데이터길이', render: (v) => v || '-' },
    { key: 'std_term_desc', label: '설명', render: (v, r) => textInput(v, (nv) => updateRow(setTermRows, r._key, 'std_term_desc', nv), { style: { minWidth: '160px' } }) },
    { key: '_sourceRows', label: '사용된 컬럼', render: (v) => <span title={formatSourceRows(v, 20)}>{formatSourceRows(v)}</span> },
  ]

  const tabConfig = {
    words: { rows: visibleWordRows, columns: wordColumns, selected: wordSelected, setSelected: setWordSelected, rowKey: '_key' },
    domains: { rows: visibleDomainRows, columns: domainColumns, selected: domainSelected, setSelected: setDomainSelected, rowKey: '_key' },
    terms: { rows: visibleTermRows, columns: termColumns, selected: termSelected, setSelected: setTermSelected, rowKey: '_key' },
  }
  const current = tabConfig[activeTab]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">서버표준검토</h1>
          <p className="page-subtitle">
            등록된 서버의 컬럼 코멘트를 분석해 표준 단어·도메인·용어 후보를 만들고, 검토 후 등록합니다.
            {serverInfo ? ` (${serverInfo.db_server_nm} / ${serverInfo.database_nm})` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SubjectAreaSelect value={subjectAreaId} onChange={setSubjectAreaId} />
          <select
            className="form-control"
            style={{ minWidth: '220px' }}
            value={selectedServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
            disabled={serversLoading || !servers.length}
          >
            {!servers.length && <option value="">등록된 서버 없음</option>}
            {servers.map((server) => (
              <option key={server.db_server_id} value={server.db_server_id}>
                {server.db_server_nm} ({server.db_type_nm})
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={reanalyze}
            disabled={loading || analyzing || rows.length === 0}
          >
            {analyzing ? <span className="spinner" /> : null}
            분석
          </button>
          <button className="btn btn-secondary" onClick={loadDefinitions} disabled={!selectedServerId || loading}>
            새로고침
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{error}</div>}

      <div className="card definition-review-panel">
        <div className="ddl-panel__tabs" role="tablist" aria-label="후보 종류" style={{ marginBottom: '12px' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`ddl-panel__tab ${activeTab === t.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label} ({tabConfig[t.id].rows.length})
            </button>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="alert" style={{ marginBottom: '12px', maxHeight: '120px', overflowY: 'auto', background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }}>
            <strong>건너뛴 컬럼 {warnings.length}건</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
              {warnings.slice(0, 20).map((w, i) => (
                <li key={i} style={{ fontSize: '12px' }}>{w.row.table_nm}.{w.row.column_nm} — {w.reason}</li>
              ))}
            </ul>
          </div>
        )}

        {excluded.length > 0 && (
          <div className="alert" style={{ marginBottom: '12px', maxHeight: '120px', overflowY: 'auto', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
            <strong>표준 지침 위반으로 목록에서 제외됨 {excluded.length}건</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
              {excluded.slice(0, 20).map((e, i) => (
                <li key={i} style={{ fontSize: '12px' }}>{e.label} — {e.issues.join(', ')}</li>
              ))}
            </ul>
          </div>
        )}

        {registerResult && (
          <div className={`alert ${registerResult.errors?.length ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '12px' }}>
            {registerResult.success?.length ?? 0}건 등록됨
            {registerResult.errors?.length ? `, ${registerResult.errors.length}건 실패: ${registerResult.errors.slice(0, 3).map((e) => e.message).join(' / ')}` : ''}
          </div>
        )}

        {loading || analyzing ? (
          <div className="loading-overlay"><span className="spinner" /></div>
        ) : (
          <DataTable
            columns={current.columns}
            rows={current.rows}
            rowKey={current.rowKey}
            selectable
            selected={current.selected}
            onSelectionChange={current.setSelected}
            emptyText={
              !selectedServerId
                ? '서버등록에서 DB 서버를 먼저 등록하세요.'
                : hasAnalyzed
                  ? '후보가 없습니다.'
                  : '분석 버튼을 눌러주세요.'
            }
          />
        )}

        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            className="btn btn-danger"
            onClick={() => handleDeleteSelected(activeTab)}
            disabled={current.selected.size === 0}
          >
            선택 삭제 ({current.selected.size}건)
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleRegister(activeTab)}
            disabled={registering || current.selected.size === 0}
          >
            {registering ? <span className="spinner" /> : null}
            선택 등록 ({current.selected.size}건)
          </button>
        </div>
      </div>
    </div>
  )
}
