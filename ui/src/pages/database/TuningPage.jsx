import { useCallback, useEffect, useMemo, useState } from 'react'
import { dbServersApi } from '../../api/dbServers'
import { tuningApi } from '../../api/tuning'
import './TuningPage.css'

const SEVERITY_META = {
  error: { label: '오류', className: 'tp-sev--error' },
  warning: { label: '경고', className: 'tp-sev--warning' },
  info: { label: '정보', className: 'tp-sev--info' },
}

const SOURCE_LABEL = {
  STATIC: 'SQL 정적 분석',
  DICTIONARY: '딕셔너리 대조',
  PLAN: '실행계획 분석',
  PACK: '옵션 팩',
}

const TOP_SQL_METRICS = [
  { value: 'elapsed_time', label: '총 수행시간' },
  { value: 'elapsed_per_exec', label: '실행당 수행시간' },
  { value: 'cpu_time', label: 'CPU 시간' },
  { value: 'buffer_gets', label: 'Buffer Gets' },
  { value: 'disk_reads', label: 'Disk Reads' },
  { value: 'executions', label: '실행 횟수' },
]

function formatNumber(value) {
  if (value === null || value === undefined) return '-'
  return Number(value).toLocaleString()
}

function formatMicros(value) {
  if (value === null || value === undefined) return '-'
  const ms = Number(value) / 1000
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}분`
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}초`
  return `${ms.toFixed(1)}ms`
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('ko-KR')
}

export default function TuningPage() {
  const [servers, setServers] = useState([])
  const [serversError, setServersError] = useState(null)
  const [serverId, setServerId] = useState('')
  const [tab, setTab] = useState('analyze')

  const [sqlText, setSqlText] = useState('')
  const [schemaName, setSchemaName] = useState('')
  const [useLlm, setUseLlm] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [report, setReport] = useState(null)

  const [metric, setMetric] = useState('elapsed_time')
  const [source, setSource] = useState('cursor')
  const [topLimit, setTopLimit] = useState(10)
  const [loadingTop, setLoadingTop] = useState(false)
  const [topError, setTopError] = useState(null)
  const [topSql, setTopSql] = useState(null)

  useEffect(() => {
    dbServersApi
      .getAll({ use_yn: 'Y', limit: 200 })
      .then((res) => {
        const oracle = (res.items ?? []).filter((s) => s.db_type_nm === 'ORACLE')
        setServers(oracle)
        if (oracle.length) setServerId(String(oracle[0].db_server_id))
      })
      .catch((e) => setServersError(e.message))
  }, [])

  const selectedServer = useMemo(
    () => servers.find((s) => String(s.db_server_id) === String(serverId)) ?? null,
    [servers, serverId],
  )

  useEffect(() => {
    if (source === 'awr' && selectedServer?.diag_pack_yn !== 'Y') setSource('cursor')
  }, [selectedServer, source])

  const handleAnalyze = useCallback(async (overrideSql) => {
    const text = (overrideSql ?? sqlText).trim()
    if (!serverId) { setAnalyzeError('대상 Oracle 서버를 선택하세요.'); return }
    if (!text) { setAnalyzeError('분석할 SQL을 입력하세요.'); return }

    setAnalyzing(true)
    setAnalyzeError(null)
    setReport(null)
    try {
      const result = await tuningApi.analyze({
        db_server_id: Number(serverId),
        sql_text: text,
        schema_nm: schemaName.trim() || undefined,
        use_llm: useLlm,
      })
      setReport(result)
    } catch (e) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [serverId, sqlText, schemaName, useLlm])

  const handleLoadTopSql = useCallback(async () => {
    if (!serverId) { setTopError('대상 Oracle 서버를 선택하세요.'); return }
    setLoadingTop(true)
    setTopError(null)
    try {
      const result = await tuningApi.topSql({
        db_server_id: serverId,
        metric,
        limit: topLimit,
        source,
      })
      setTopSql(result)
    } catch (e) {
      setTopError(e.message)
      setTopSql(null)
    } finally {
      setLoadingTop(false)
    }
  }, [serverId, metric, topLimit, source])

  const analyzeTopSqlItem = (item) => {
    const text = item.SQL_TEXT ?? ''
    setSqlText(text)
    setTab('analyze')
    handleAnalyze(text)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">튜닝</h1>
          <p className="page-subtitle">
            Oracle 딕셔너리·실행계획 기반 SQL 튜닝 분석과 성능 Top SQL 추출 (전 기능 폐쇄망 내 동작)
          </p>
        </div>
      </div>

      <div className="card tp-controls">
        <div className="tp-controls__row">
          <div className="form-group tp-controls__server">
            <label className="form-label required">대상 Oracle 서버</label>
            <select
              className="form-control"
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
            >
              {!servers.length && <option value="">등록된 Oracle 서버 없음</option>}
              {servers.map((s) => (
                <option key={s.db_server_id} value={s.db_server_id}>
                  {s.db_server_nm} — {s.host_nm}:{s.port_no}/{s.database_nm}
                </option>
              ))}
            </select>
          </div>
          {selectedServer && (
            <div className="tp-controls__packs">
              <span className={`badge ${selectedServer.diag_pack_yn === 'Y' ? 'badge-blue' : 'badge-gray'}`}>
                Diagnostics Pack {selectedServer.diag_pack_yn === 'Y' ? '사용' : '미사용'}
              </span>
              <span className={`badge ${selectedServer.tuning_pack_yn === 'Y' ? 'badge-blue' : 'badge-gray'}`}>
                Tuning Pack {selectedServer.tuning_pack_yn === 'Y' ? '사용' : '미사용'}
              </span>
              <span className="tp-controls__packs-hint">
                유료 팩 사용 여부는 서버등록에서 시스템별로 설정합니다.
              </span>
            </div>
          )}
        </div>
        {serversError && <div className="alert alert-error">{serversError}</div>}
        {!serversError && !servers.length && (
          <div className="alert alert-error">
            등록된 Oracle 서버가 없습니다. 서버등록 메뉴에서 DB 종류를 Oracle로 하여 서버를 먼저 등록하세요.
          </div>
        )}
      </div>

      <div className="tp-tabs">
        <button
          type="button"
          className={`tp-tab${tab === 'analyze' ? ' is-active' : ''}`}
          onClick={() => setTab('analyze')}
        >
          SQL 분석
        </button>
        <button
          type="button"
          className={`tp-tab${tab === 'top' ? ' is-active' : ''}`}
          onClick={() => setTab('top')}
        >
          Top SQL
        </button>
      </div>

      {tab === 'analyze' && (
        <>
          <div className="card tp-input-card">
            <div className="card-header">
              <span className="card-title">SQL 입력</span>
            </div>
            <div className="tp-input-card__body">
              <div className="form-group" style={{ marginBottom: 0, maxWidth: '360px' }}>
                <label className="form-label">스키마 (선택)</label>
                <input
                  className="form-control"
                  value={schemaName}
                  onChange={(e) => setSchemaName(e.target.value)}
                  placeholder="예: C##TUNETEST — 미입력 시 접속 계정 스키마"
                  maxLength={128}
                  spellCheck={false}
                />
                <span className="form-hint">
                  지정하면 해당 스키마 기준으로 SQL을 해석합니다 (ALTER SESSION SET CURRENT_SCHEMA).
                </span>
              </div>
              <textarea
                className="form-control tp-sql-input"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                placeholder={'분석할 SQL을 입력하세요.\n예) SELECT order_id, amount FROM c##tunetest.orders WHERE status = \'PENDING\''}
                rows={8}
                spellCheck={false}
              />
              <div className="tp-input-card__actions">
                <label className="tp-llm-toggle">
                  <input
                    type="checkbox"
                    checked={useLlm}
                    onChange={(e) => setUseLlm(e.target.checked)}
                  />
                  로컬 sLLM(Ollama) 해설 생성 — 미설치 시 자동 생략
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAnalyze()}
                  disabled={analyzing || !servers.length}
                >
                  {analyzing ? <span className="spinner" /> : null}
                  분석 실행
                </button>
              </div>
              {analyzeError && <div className="alert alert-error">{analyzeError}</div>}
            </div>
          </div>

          {report && <TuningReport report={report} />}
        </>
      )}

      {tab === 'top' && (
        <div className="card">
          <div className="card-header tp-top-header">
            <span className="card-title">성능 Top SQL</span>
            <div className="tp-top-controls">
              <select className="form-control" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="cursor">현재 커서 캐시 (V$SQLAREA — 무료)</option>
                <option value="awr" disabled={selectedServer?.diag_pack_yn !== 'Y'}>
                  AWR 이력 (Diagnostics Pack{selectedServer?.diag_pack_yn !== 'Y' ? ' — 서버 설정 필요' : ''})
                </option>
              </select>
              <select className="form-control" value={metric} onChange={(e) => setMetric(e.target.value)}>
                {TOP_SQL_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>기준: {m.label}</option>
                ))}
              </select>
              <select className="form-control" value={topLimit} onChange={(e) => setTopLimit(Number(e.target.value))}>
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLoadTopSql}
                disabled={loadingTop || !servers.length}
              >
                {loadingTop ? <span className="spinner" /> : null}
                조회
              </button>
            </div>
          </div>

          {topError && <div className="alert alert-error" style={{ margin: '16px 24px' }}>{topError}</div>}

          {topSql && (
            <div className="tp-top-body">
              <p className="tp-top-note">
                {topSql.source === 'awr'
                  ? '※ AWR 이력 기반 (Diagnostics Pack 파생 데이터 — 유료 라이선스 필요)'
                  : '※ 현재 인스턴스 커서 캐시 기준 (무료 — 인스턴스 재기동 시 초기화됨)'}
              </p>
              <div className="tp-top-table-wrap">
                <table className="tp-top-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>SQL</th>
                      <th>스키마/모듈</th>
                      <th>실행</th>
                      <th>총 수행시간</th>
                      <th>실행당</th>
                      <th>Buffer Gets</th>
                      <th>Disk Reads</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSql.items.map((item, i) => (
                      <tr key={item.SQL_ID ?? i}>
                        <td>{i + 1}</td>
                        <td className="tp-top-sql">
                          <code title={item.SQL_TEXT}>{(item.SQL_TEXT ?? '').slice(0, 120)}{(item.SQL_TEXT ?? '').length > 120 ? '…' : ''}</code>
                          <span className="tp-top-sqlid">{item.SQL_ID}</span>
                        </td>
                        <td>
                          {item.PARSING_SCHEMA_NAME ?? '-'}
                          {item.MODULE ? <span className="tp-top-module">{item.MODULE}</span> : null}
                        </td>
                        <td className="tp-num">{formatNumber(item.EXECUTIONS)}</td>
                        <td className="tp-num">{formatMicros(item.ELAPSED_TIME)}</td>
                        <td className="tp-num">{formatMicros(item.ELAPSED_PER_EXEC)}</td>
                        <td className="tp-num">{formatNumber(item.BUFFER_GETS)}</td>
                        <td className="tp-num">{formatNumber(item.DISK_READS)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => analyzeTopSqlItem(item)}
                            disabled={!item.SQL_TEXT}
                          >
                            분석
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!topSql.items.length && (
                      <tr><td colSpan={9} className="tp-empty">조회된 SQL이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlanText({ text }) {
  const lines = String(text ?? '').split('\n')
  return (
    <pre className="tp-plan__text">
      {lines.map((line, i) => {
        let cls = ''
        if (/TABLE ACCESS FULL|MERGE JOIN CARTESIAN/.test(line)) cls = 'tp-plan__line--bad'
        else if (/INDEX (FULL|SKIP) SCAN/.test(line)) cls = 'tp-plan__line--warn'
        else if (/dynamic (statistics|sampling)/i.test(line)) cls = 'tp-plan__line--warn'
        return (
          <span key={i} className={cls}>
            {line}
            {'\n'}
          </span>
        )
      })}
    </pre>
  )
}

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 }

function worstSeverity(notes) {
  if (!notes?.length) return null
  return notes.reduce((worst, n) =>
    (SEVERITY_RANK[n.severity] ?? 9) < (SEVERITY_RANK[worst] ?? 9) ? n.severity : worst,
  notes[0].severity)
}

function PlanTree({ rows, annotations }) {
  if (!rows?.length) return <p className="tp-empty">실행계획이 없습니다.</p>
  return (
    <div className="tp-ptree" role="tree">
      {rows.map((row) => {
        const notes = annotations?.[row.ID] ?? []
        const sev = worstSeverity(notes)
        const depth = Number(row.DEPTH ?? 0)
        const operation = [row.OPERATION, row.OPTIONS].filter(Boolean).join(' ')
        return (
          <div
            key={row.ID}
            className={`tp-ptree__node${sev ? ` tp-ptree__node--${sev}` : ''}`}
            style={{ marginLeft: depth * 26 }}
          >
            <div className="tp-ptree__row">
              {depth > 0 && <span className="tp-ptree__connector" aria-hidden>└</span>}
              <span className="tp-ptree__op">{operation}</span>
              {row.OBJECT_NAME && (
                <span className="tp-ptree__obj">
                  {row.OBJECT_OWNER ? `${row.OBJECT_OWNER}.` : ''}{row.OBJECT_NAME}
                </span>
              )}
              <span className="tp-ptree__metrics">
                {row.CARDINALITY !== null && row.CARDINALITY !== undefined && (
                  <span>예상 {formatNumber(row.CARDINALITY)}행</span>
                )}
                {row.COST !== null && row.COST !== undefined && <span>COST {formatNumber(row.COST)}</span>}
              </span>
              {sev && (
                <span className={`tp-ptree__flag tp-ptree__flag--${sev}`}>
                  {SEVERITY_META[sev]?.label}
                </span>
              )}
            </div>
            {(row.ACCESS_PREDICATES || row.FILTER_PREDICATES) && (
              <div className="tp-ptree__preds">
                {row.ACCESS_PREDICATES && <div>access: {row.ACCESS_PREDICATES}</div>}
                {row.FILTER_PREDICATES && <div>filter: {row.FILTER_PREDICATES}</div>}
              </div>
            )}
            {notes.map((n, i) => (
              <div key={`${n.rule_id}-${i}`} className={`tp-ptree__note tp-ptree__note--${n.severity}`}>
                <strong>{n.title}</strong> — {n.note} <span className="tp-ptree__note-rule">({n.rule_id})</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function TuningReport({ report }) {
  const { summary, findings, plan, plan_error, plan_annotations, dictionary, dictionary_error, pack_info, llm_explanation } = report

  return (
    <>
      <div className="card tp-report">
        <div className="card-header">
          <span className="card-title">튜닝 리포트</span>
          <span className="tp-report__meta">
            {report.server.db_server_nm} · {formatDate(report.analyzed_at)}
          </span>
        </div>

        <div className="tp-summary">
          <div className="tp-summary__item tp-sev--error">
            <span className="tp-summary__count">{summary.error}</span>
            <span className="tp-summary__label">오류</span>
          </div>
          <div className="tp-summary__item tp-sev--warning">
            <span className="tp-summary__count">{summary.warning}</span>
            <span className="tp-summary__label">경고</span>
          </div>
          <div className="tp-summary__item tp-sev--info">
            <span className="tp-summary__count">{summary.info}</span>
            <span className="tp-summary__label">정보</span>
          </div>
        </div>

        {llm_explanation && (
          <div className="tp-llm">
            <div className="tp-llm__title">sLLM 해설 ({llm_explanation.model})</div>
            <p className="tp-llm__text">{llm_explanation.text}</p>
          </div>
        )}

        <div className="tp-section">
          <h3 className="tp-section__title">실행계획 (EXPLAIN PLAN)</h3>
          {plan_error ? (
            <div className="alert alert-error">실행계획 생성 실패: {plan_error}</div>
          ) : (
            <>
              <PlanTree rows={plan?.rows} annotations={plan_annotations} />
              <p className="tp-plan__legend">
                <span className="tp-plan__legend-bad">■</span> 오류 단계
                <span className="tp-plan__legend-warn">■</span> 경고 단계 — 문제 단계 아래에 원인·권고 설명이 표시됩니다.
              </p>
              {plan?.text && (
                <details className="tp-plan__raw">
                  <summary>원문 보기 (DBMS_XPLAN.DISPLAY)</summary>
                  <PlanText text={plan.text} />
                </details>
              )}
            </>
          )}
        </div>

        <div className="tp-section">
          <h3 className="tp-section__title">발견사항 ({findings.length}건)</h3>
        </div>

        <div className="tp-findings">
          {findings.map((f, i) => {
            const meta = SEVERITY_META[f.severity] ?? SEVERITY_META.info
            return (
              <div key={`${f.rule_id}-${i}`} className={`tp-finding ${meta.className}`}>
                <div className="tp-finding__head">
                  <span className="tp-finding__sev">{meta.label}</span>
                  <span className="tp-finding__title">{f.title}</span>
                  <span className="tp-finding__source">{SOURCE_LABEL[f.source] ?? f.source} · {f.rule_id}</span>
                </div>
                <p className="tp-finding__desc">{f.description}</p>
                <div className="tp-finding__detail">
                  <div><strong>근거</strong> {f.evidence}</div>
                  <div><strong>권고</strong> {f.recommendation}</div>
                </div>
              </div>
            )
          })}
          {!findings.length && (
            <div className="alert alert-success">규칙 기반 분석에서 발견된 문제가 없습니다.</div>
          )}
        </div>
      </div>

      <div className="card tp-dict">
        <div className="card-header"><span className="card-title">딕셔너리 수집 결과</span></div>
        {dictionary_error && (
          <div className="alert alert-error" style={{ margin: '16px 24px' }}>딕셔너리 수집 실패: {dictionary_error}</div>
        )}
        {dictionary.tables.length ? (
          <div className="tp-top-table-wrap">
            <table className="tp-top-table">
              <thead>
                <tr>
                  <th>테이블</th>
                  <th>행수</th>
                  <th>블록</th>
                  <th>통계 수집일</th>
                  <th>인덱스</th>
                  <th>제약(PK/FK/UK)</th>
                </tr>
              </thead>
              <tbody>
                {dictionary.tables.map((t) => {
                  const idx = dictionary.indexes.filter((x) => x.TABLE_NAME === t.TABLE_NAME)
                  const cons = dictionary.constraints.filter((c) => c.TABLE_NAME === t.TABLE_NAME)
                  const consTypes = [...new Set(cons.map((c) => c.CONSTRAINT_TYPE))]
                  return (
                    <tr key={`${t.OWNER}.${t.TABLE_NAME}`}>
                      <td>{t.OWNER}.{t.TABLE_NAME}</td>
                      <td className="tp-num">{formatNumber(t.NUM_ROWS)}</td>
                      <td className="tp-num">{formatNumber(t.BLOCKS)}</td>
                      <td>
                        {t.LAST_ANALYZED ? formatDate(t.LAST_ANALYZED) : (
                          <span className="badge badge-red">미수집</span>
                        )}
                      </td>
                      <td>
                        {idx.length ? idx.map((x) => (
                          <div key={x.INDEX_NAME} className="tp-dict__idx">
                            {x.INDEX_NAME} ({x.UNIQUENESS === 'UNIQUE' ? 'U' : 'N'})
                          </div>
                        )) : <span className="badge badge-gray">없음</span>}
                      </td>
                      <td>{consTypes.length ? consTypes.map((ct) => ({ P: 'PK', R: 'FK', U: 'UK' })[ct] ?? ct).join(', ') : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !dictionary_error && (
            <p className="tp-empty" style={{ padding: '16px 24px' }}>
              SQL에서 접근 가능한 테이블을 찾지 못했습니다. (다른 스키마 테이블은 스키마명을 붙여 주세요)
            </p>
          )
        )}
      </div>

      <div className="card tp-pack">
        <div className="card-header"><span className="card-title">유료 옵션 팩 상태 (시스템별 설정)</span></div>
        <div className="tp-pack__body">
          <div className="tp-pack__item">
            <span className={`badge ${pack_info.diag_pack_yn === 'Y' ? 'badge-blue' : 'badge-gray'}`}>
              Diagnostics Pack {pack_info.diag_pack_yn === 'Y' ? '사용' : '미사용'}
            </span>
            {pack_info.diag_pack_yn === 'Y' ? (
              pack_info.awr?.available ? (
                <span>AWR 사용 가능 — 스냅샷 {formatNumber(pack_info.awr.snapCount)}개, 최근 {formatDate(pack_info.awr.latestSnapshot)} <em>(팩 파생 데이터)</em></span>
              ) : (
                <span>AWR 조회 불가{pack_info.awr?.error ? ` — ${pack_info.awr.error}` : ''}</span>
              )
            ) : (
              <span>무료 기능(EXPLAIN PLAN·딕셔너리)만 사용합니다. AWR 이력 분석은 라이선스 보유 시 서버등록에서 활성화하세요.</span>
            )}
          </div>
          <div className="tp-pack__item">
            <span className={`badge ${pack_info.tuning_pack_yn === 'Y' ? 'badge-blue' : 'badge-gray'}`}>
              Tuning Pack {pack_info.tuning_pack_yn === 'Y' ? '사용' : '미사용'}
            </span>
            <span>
              {pack_info.tuning_pack_yn === 'Y'
                ? pack_info.tuning_advisor?.note
                : 'SQL Tuning Advisor는 라이선스 보유 시 서버등록에서 활성화하세요.'}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
