import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { warmupApi } from '../../api/client'

const BULK_BATCH_SIZE = 15

/**
 * 공통 엑셀 대량 등록 모달
 *
 * Props:
 *   title        - 모달 제목
 *   columns      - [{ key, label, required?, example }]  엑셀 컬럼 정의
 *   rowDefaults  - { key: defaultValue }  빈 값일 때 채울 기본값 (예: { subject_area_id: 'DEFAULT' })
 *   validateRow  - (rowData) => string|null  클라이언트 사전 검증 함수 (오류 시 메시지 반환)
 *   onUpload     - async (validRows) => { success: [...], errors: [{ row, data, message }] }
 *   onClose      - 닫기 콜백
 *   onDone       - 등록 완료 후 목록 갱신 콜백
 */
export default function ExcelUploadModal({ title, columns, rowDefaults = {}, exampleRows = null, validateRow, onUpload, onClose, onDone }) {
  const inputRef  = useRef(null)
  const [step,    setStep]    = useState('idle')   // idle | preview | result
  const [rows,    setRows]    = useState([])
  const [skipped, setSkipped] = useState([])   // 파싱 단계 제외 행
  const [result,  setResult]  = useState(null)     // { success, errors }
  const [loading, setLoading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // 템플릿 다운로드
  const downloadTemplate = () => {
    // 헤더: 필수 항목은 컬럼명 뒤에 * 표기
    const header = columns.map((c) => (c.required ? `${c.label} *` : c.label))
    const templateExamples = exampleRows?.length
      ? exampleRows.map((row) => columns.map((col) => String(row[col.key] ?? '')))
      : [columns.map((c) => c.example ?? '')]

    const ws = XLSX.utils.aoa_to_sheet([header, ...templateExamples])
    ws['!cols'] = columns.map(() => ({ wch: 22 }))

    // 헤더 행 스타일 - 노란 바탕, 필수는 빨간 글씨 / 선택은 검정 글씨
    columns.forEach((c, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i })
      if (!ws[cellRef]) return
      ws[cellRef].s = {
        font:      { bold: true, color: { rgb: c.required ? 'CC0000' : '000000' } },
        fill:      { fgColor: { rgb: 'FFFF00' } },
        alignment: { horizontal: 'center' },
        border: {
          bottom: { style: 'medium', color: { rgb: 'CCCC00' } },
        },
      }
    })

    templateExamples.forEach((exampleRow, rowIndex) => {
      columns.forEach((_, i) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: i })
        if (!ws[cellRef]) return
        ws[cellRef].s = {
          font: { italic: true, color: { rgb: '808080' } },
          fill: { fgColor: { rgb: 'F5F5F5' } },
        }
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '등록양식')

    // 텍스트 형식 컬럼 — 엑셀이 111,111 등을 숫자로 변환하지 않도록
    columns.forEach((col, i) => {
      if (!col.asText) return
      templateExamples.forEach((exampleRow, rowIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: i })
        const text = String(exampleRow[i] ?? '')
        ws[cellRef] = { t: 's', v: text, w: text }
      })
    })

    XLSX.writeFile(wb, `${title}_등록양식.xlsx`)
  }

  // 파일 파싱
  const parseFile = (file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb   = XLSX.read(e.target.result, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (raw.length < 2) { alert('데이터가 없습니다. 헤더 아래에 데이터를 입력하세요.'); return }

      // 예시 행 감지: 모든 컬럼의 example 값과 일치하면 건너뜀
      const exampleValueSets = exampleRows?.length
        ? exampleRows.map((row) => columns.map((col) => String(row[col.key] ?? '').trim()))
        : [columns.map((c) => String(c.example ?? ''))]
      const isExampleRow = (r) => exampleValueSets.some((exampleValues) =>
        columns.every((c, i) => String(r[i] ?? '').trim() === exampleValues[i]),
      )

      const parseSkipped = []
      const parsed = raw.slice(1)
        .map((r, idx) => ({ cells: r, rowNum: idx + 2 }))
        .filter(({ cells, rowNum }) => {
          if (!cells.some((c) => c !== '' && c !== null)) {
            parseSkipped.push({ row: rowNum, data: {}, message: '빈 행은 제외되었습니다.' })
            return false
          }
          if (isExampleRow(cells)) {
            const data = {}
            columns.forEach((col, i) => { data[col.key] = String(cells[i] ?? '').trim() })
            parseSkipped.push({ row: rowNum, data, message: '양식 예시 행과 동일하여 제외되었습니다.' })
            return false
          }
          return true
        })
        .map(({ cells, rowNum }) => {
          const obj = { __rowNum: rowNum }
          columns.forEach((col, i) => {
            const raw = cells[i]
            const empty = raw === undefined || raw === null || raw === ''
            let val = empty ? '' : (col.asText ? String(raw).trim() : String(raw).trim())
            obj[col.key] = val || rowDefaults[col.key] || ''
          })
          columns.forEach((col) => {
            if (col.normalize) {
              const next = col.normalize(obj[col.key], obj)
              if (next !== undefined && next !== null) obj[col.key] = next
            }
          })
          return obj
        })

      setSkipped(parseSkipped)
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsArrayBuffer(file)
  }

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) { alert('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'); return }
    parseFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  // 등록 실행
  const handleUpload = async () => {
    setLoading(true)
    try {
      // 1단계: 클라이언트 사전 검증
      const frontendErrors = []
      const validRows      = []

      rows.forEach((row) => {
        const rowNum = row.__rowNum ?? 2
        const data   = { ...row }
        delete data.__rowNum
        // 필수 항목 체크
        for (const col of columns) {
          if (col.required && !data[col.key]?.trim()) {
            frontendErrors.push({ row: rowNum, data, message: `[${col.label}] 필수 입력 항목입니다.` })
            return
          }
        }
        // 커스텀 검증 (페이지별 규칙)
        if (validateRow) {
          const msg = validateRow(data)
          if (msg) { frontendErrors.push({ row: rowNum, data, message: msg }); return }
        }
        validRows.push({ ...data, __rowNum: rowNum })
      })

      // 2단계: 유효한 행만 백엔드로 전송
      let backendSuccess = []
      let backendErrors  = []

      if (validRows.length > 0) {
        setUploadStatus('API 서버 연결 중... (최초 요청은 30~60초 걸릴 수 있습니다)')
        await warmupApi()

        const totalBatches = Math.ceil(validRows.length / BULK_BATCH_SIZE)
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * BULK_BATCH_SIZE
          const batchValidRows = validRows.slice(start, start + BULK_BATCH_SIZE)
          const sendRows = batchValidRows.map(({ __rowNum, ...r }) => ({ ...r, __rowNum }))

          setUploadStatus(`등록 중... ${Math.min(start + BULK_BATCH_SIZE, validRows.length)}/${validRows.length}건 (${batchIndex + 1}/${totalBatches} 배치)`)

          try {
            const res = await onUpload(sendRows)
            backendSuccess.push(...(res.success ?? []))
            backendErrors.push(...(res.errors ?? []).map((e) => ({
              row:     e.row ?? batchValidRows[e.row - 2]?.__rowNum ?? (start + 2),
              data:    e.data ?? batchValidRows.find((r) => r.__rowNum === e.row) ?? batchValidRows[e.row - 2] ?? {},
              message: e.message,
            })))
          } catch (e) {
            batchValidRows.forEach((r) => {
              const { __rowNum, ...data } = r
              backendErrors.push({ row: __rowNum, data, message: e.message })
            })
          }
        }
      }

      setResult({
        success: backendSuccess,
        errors:  [...skipped, ...frontendErrors, ...backendErrors].sort((a, b) => a.row - b.row),
        skipped: frontendErrors.length + skipped.length,
      })
      setStep('result')
    } finally {
      setLoading(false)
      setUploadStatus('')
    }
  }

  // 오류 엑셀 다운로드
  const downloadErrors = () => {
    const header = [...columns.map((c) => c.label), '오류내용']
    const dataRows = result.errors.map(({ data, message }) => [
      ...columns.map((c) => data[c.key] ?? ''),
      message,
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows])
    ws['!cols'] = [...columns.map(() => ({ wch: 20 })), { wch: 50 }]

    // 오류 셀 빨간 배경 (마지막 열)
    dataRows.forEach((_, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: columns.length })
      if (!ws[cellRef]) return
      ws[cellRef].s = { fill: { fgColor: { rgb: 'FFCCCC' } }, font: { color: { rgb: 'CC0000' } } }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '오류목록')
    XLSX.writeFile(wb, `${title}_오류목록.xlsx`)
  }

  const reset = () => { setStep('idle'); setRows([]); setSkipped([]); setResult(null) }

  return (
    <Modal
      title={`${title} — 엑셀 대량 등록`}
      onClose={onClose}
      footer={
        <>
          {step === 'idle' && (
            <button className="btn btn-secondary" onClick={onClose}>닫기</button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={reset}>다시 선택</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={loading}>
                {loading ? <span className="spinner" /> : null}
                {rows.length}건 등록
              </button>
            </>
          )}
          {step === 'result' && (
            <>
              {result.errors.length > 0 && (
                <button className="btn btn-secondary" onClick={downloadErrors}>
                  오류 엑셀 다운로드 ({result.errors.length}건)
                </button>
              )}
              <button className="btn btn-primary" onClick={() => {
                if (result.success.length > 0) onDone?.()
                onClose()
              }}>확인</button>
            </>
          )}
        </>
      }
    >
      {/* STEP 1: 파일 선택 */}
      {step === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>
              아래 양식을 내려받아 데이터를 입력한 후 업로드하세요.
            </span>
            <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
              ↓ 양식 다운로드
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
              borderRadius: '10px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? '#eff6ff' : '#f9fafb',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
            <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>
              클릭하거나 파일을 여기에 끌어다 놓으세요
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              .xlsx, .xls 파일 지원
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files[0])}
          />

          <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '12px 16px' }}>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px', fontWeight: 600 }}>컬럼 안내</p>
            <p style={{ fontSize: '12px', color: '#374151', margin: 0 }}>
              {columns.map((c) => (
                <span key={c.key} style={{ marginRight: '8px' }}>
                  {c.required ? <strong>{c.label}*</strong> : c.label}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* STEP 2: 미리보기 */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
            <strong>{rows.length}건</strong>의 데이터를 확인했습니다. 등록하시겠습니까?
          </p>
          {uploadStatus && (
            <p style={{ margin: 0, fontSize: '13px', color: '#2563eb' }}>{uploadStatus}</p>
          )}
          <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                  <th style={thStyle}>#</th>
                  {columns.map((c) => <th key={c.key} style={thStyle}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    {columns.map((c) => <td key={c.key} style={tdStyle}>{row[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 3: 결과 */}
      {step === 'result' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 요약 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: '#d1fae5', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#065f46' }}>등록 성공</p>
              <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: '#059669' }}>{result.success.length}건</p>
            </div>
            <div style={{ background: result.errors.length > 0 ? '#fee2e2' : '#f3f4f6', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 2px', fontSize: '11px', color: result.errors.length > 0 ? '#991b1b' : '#6b7280' }}>등록 실패</p>
              <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: result.errors.length > 0 ? '#dc2626' : '#9ca3af' }}>{result.errors.length}건</p>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#6b7280' }}>전체</p>
              <p style={{ margin: 0, fontSize: '26px', fontWeight: 700, color: '#374151' }}>{result.success.length + result.errors.length}건</p>
            </div>
          </div>

          {/* 오류 목록 */}
          {result.errors.length > 0 && (
            <>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#dc2626' }}>
                ❌ 등록 실패 목록 — 사유를 확인하고 수정 후 재업로드하세요.
              </p>
              <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#fef2f2', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ ...thStyle, width: '40px' }}>행</th>
                      {columns.slice(0, 3).map((c) => <th key={c.key} style={thStyle}>{c.label}</th>)}
                      <th style={{ ...thStyle, color: '#dc2626', minWidth: '200px' }}>오류 사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map(({ row, data, message }, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff5f5' : '#fff', borderBottom: '1px solid #fecaca' }}>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{row}</td>
                        {columns.slice(0, 3).map((c) => <td key={c.key} style={tdStyle}>{data?.[c.key] ?? ''}</td>)}
                        <td style={{ ...tdStyle, color: '#dc2626', whiteSpace: 'normal', wordBreak: 'break-all' }}>{message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px 12px', color: '#374151', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }
