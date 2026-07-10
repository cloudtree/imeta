import { useMemo, useState } from 'react'
import {
  DDL_DIALECTS,
  generateCreateTableDdl,
} from './generateTableDdl'

export default function TableDdlPanel({
  table = null,
  loading = false,
}) {
  const [dialect, setDialect] = useState('oracle')
  const [copied, setCopied] = useState(false)

  const script = useMemo(() => {
    if (!table?.columns?.length) return ''
    return generateCreateTableDdl(dialect, table)
  }, [dialect, table])

  const handleCopy = async () => {
    if (!script) return
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      alert('클립보드 복사에 실패했습니다.')
    }
  }

  const handleDownload = () => {
    if (!script || !table) return
    const ext = dialect === 'oracle' ? 'oracle.sql' : 'postgresql.sql'
    const name = `${table.table_nm || 'table'}.${ext}`
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="ddl-panel">
      <div className="ddl-panel__header">
        <div className="ddl-panel__title-row">
          <h2 className="ddl-panel__title">테이블 생성 스크립트</h2>
          {table && (
            <span className="ddl-panel__target">
              {table.entity_nm || table.table_nm}
              {table.table_nm ? ` · ${table.table_nm}` : ''}
            </span>
          )}
        </div>
        <div className="ddl-panel__actions">
          <div className="ddl-panel__tabs" role="tablist" aria-label="DB 종류">
            {DDL_DIALECTS.map((d) => (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={dialect === d.id}
                className={`ddl-panel__tab ${dialect === d.id ? 'is-active' : ''}`}
                onClick={() => setDialect(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            disabled={!script}
          >
            {copied ? '복사됨' : '복사'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            disabled={!script}
          >
            다운로드
          </button>
        </div>
      </div>

      <div className="ddl-panel__body">
        {loading ? (
          <div className="ddl-panel__empty"><span className="spinner" /></div>
        ) : !table ? (
          <div className="ddl-panel__empty">
            상단 목록에서 테이블을 선택하면 CREATE TABLE 스크립트가 생성됩니다.
          </div>
        ) : !script ? (
          <div className="ddl-panel__empty">컬럼 정의가 없어 스크립트를 만들 수 없습니다.</div>
        ) : (
          <pre className="ddl-panel__code" tabIndex={0}>{script}</pre>
        )}
      </div>
    </section>
  )
}
