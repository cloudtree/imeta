import { Router } from 'express'
import { pool } from '../db.js'
import { withOracleConnection } from '../oracleClient.js'
import {
  extractTableNames,
  collectDictionary,
  getExplainPlan,
  getTopSql,
  getAwrTopSql,
  checkAwrAvailability,
  setCurrentSchema,
} from '../oracleTuning.js'
import { analyzeSql, annotatePlanNodes } from '../tuningRules.js'
import { generateExplanation } from '../ollamaExplain.js'

const router = Router()

async function getOracleServer(id, res) {
  const { rows } = await pool.query(
    `SELECT db_server_id, db_server_nm, db_type_nm, host_nm, port_no, database_nm,
            user_nm, password_val, diag_pack_yn, tuning_pack_yn
     FROM meta_db_server_m WHERE db_server_id = $1`,
    [id],
  )
  const server = rows[0]
  if (!server) {
    res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })
    return null
  }
  if ((server.db_type_nm || '').toUpperCase() !== 'ORACLE') {
    res.status(400).json({ message: 'SQL 튜닝 분석은 Oracle 서버만 지원합니다.' })
    return null
  }
  return server
}

function serverSummary(server) {
  return {
    db_server_id: server.db_server_id,
    db_server_nm: server.db_server_nm,
    database_nm: server.database_nm,
    user_nm: server.user_nm,
    diag_pack_yn: server.diag_pack_yn,
    tuning_pack_yn: server.tuning_pack_yn,
  }
}

function describeOra942(message, schemaName) {
  if (!message || !/ORA-00942/.test(message)) return message
  return (
    `${message}\n→ 접속 계정 스키마에 해당 테이블이 없습니다. ` +
    (schemaName
      ? `지정한 스키마(${schemaName})에 테이블이 있는지 확인하세요.`
      : `'스키마(선택)' 입력란에 테이블 소유 스키마(예: C##TUNETEST)를 지정하거나, 스키마명.테이블명 형식으로 작성하세요.`)
  )
}

// POST /api/tuning/analyze  { db_server_id, sql_text, schema_nm, use_llm }
router.post('/analyze', async (req, res) => {
  try {
    const { db_server_id, sql_text, schema_nm, use_llm = false } = req.body
    if (!db_server_id) return res.status(400).json({ message: '대상 DB 서버를 선택하세요.' })
    if (!sql_text?.trim()) return res.status(400).json({ message: '분석할 SQL을 입력하세요.' })

    const sqlText = sql_text.trim()
    if (!/^(SELECT|WITH|INSERT|UPDATE|DELETE|MERGE)\b/i.test(sqlText)) {
      return res.status(400).json({ message: 'SELECT/WITH/INSERT/UPDATE/DELETE/MERGE 문만 분석할 수 있습니다.' })
    }
    if (/;[\s\S]*\S/.test(sqlText.replace(/;+\s*$/, ''))) {
      return res.status(400).json({ message: '한 번에 하나의 SQL만 분석할 수 있습니다.' })
    }

    const server = await getOracleServer(db_server_id, res)
    if (!server) return

    const schemaName = schema_nm?.trim() ? schema_nm.trim().toUpperCase() : null

    const result = await withOracleConnection(server, async (connection) => {
      if (schemaName) {
        try {
          await setCurrentSchema(connection, schemaName)
        } catch (err) {
          const e = new Error(
            /ORA-01435/.test(err.message)
              ? `스키마 "${schemaName}"이(가) 존재하지 않습니다.`
              : `스키마 전환 실패: ${err.message}`,
          )
          e.statusCode = 400
          throw e
        }
      }

      const tableRefs = extractTableNames(sqlText)

      let plan = null
      let planError = null
      try {
        plan = await getExplainPlan(connection, sqlText)
      } catch (err) {
        planError = describeOra942(err.message, schemaName)
      }

      let dictionary = { tables: [], columns: [], indexes: [], indexColumns: [], constraints: [], statistics: [] }
      let dictionaryError = null
      try {
        dictionary = await collectDictionary(connection, tableRefs)
      } catch (err) {
        dictionaryError = err.message
      }

      // Diagnostics Pack 게이팅: 서버 설정이 Y일 때만 AWR 접근
      let packInfo = {
        diag_pack_yn: server.diag_pack_yn,
        tuning_pack_yn: server.tuning_pack_yn,
        awr: null,
        tuning_advisor: null,
      }
      if (server.diag_pack_yn === 'Y') {
        packInfo.awr = await checkAwrAvailability(connection)
      }
      if (server.tuning_pack_yn === 'Y') {
        packInfo.tuning_advisor = {
          available: false,
          note: 'SQL Tuning Advisor(DBMS_SQLTUNE) 연동 지점 — 요건: Tuning Pack 활성화. 현재 버전은 실행계획·딕셔너리 기반 분석을 제공하며, Advisor 자동 실행은 후속 구현 대상입니다.',
        }
      }

      const findings = analyzeSql({ sqlText, dictionary, planRows: plan?.rows ?? [] })
      const planAnnotations = annotatePlanNodes(findings, plan?.rows ?? [])

      return { tableRefs, plan, planError, dictionary, dictionaryError, findings, planAnnotations, packInfo }
    })

    let llm = null
    if (use_llm) {
      llm = await generateExplanation({
        sqlText,
        planText: result.plan?.text,
        findings: result.findings,
      })
    }

    const summary = {
      total: result.findings.length,
      error: result.findings.filter((f) => f.severity === 'error').length,
      warning: result.findings.filter((f) => f.severity === 'warning').length,
      info: result.findings.filter((f) => f.severity === 'info').length,
    }

    res.json({
      server: serverSummary(server),
      schema_nm: schemaName,
      sql_text: sqlText,
      analyzed_at: new Date().toISOString(),
      summary,
      findings: result.findings,
      plan: result.plan,
      plan_error: result.planError,
      plan_annotations: result.planAnnotations,
      dictionary: result.dictionary,
      dictionary_error: result.dictionaryError,
      pack_info: result.packInfo,
      llm_explanation: llm,
    })
  } catch (err) {
    res.status(err.statusCode ?? 500).json({ message: err.message })
  }
})

// GET /api/tuning/top-sql?db_server_id=&metric=&limit=&source=cursor|awr&days=
router.get('/top-sql', async (req, res) => {
  try {
    const { db_server_id, metric = 'elapsed_time', limit = 10, source = 'cursor', days = 7 } = req.query
    if (!db_server_id) return res.status(400).json({ message: '대상 DB 서버를 선택하세요.' })

    const server = await getOracleServer(db_server_id, res)
    if (!server) return

    if (source === 'awr' && server.diag_pack_yn !== 'Y') {
      return res.status(403).json({
        message: 'AWR 이력 조회는 Diagnostics Pack 사용 설정(라이선스 보유)이 필요합니다. 서버등록에서 해당 서버의 팩 옵션을 활성화하세요.',
      })
    }

    const items = await withOracleConnection(server, (connection) =>
      source === 'awr'
        ? getAwrTopSql(connection, { metric, limit, days })
        : getTopSql(connection, { metric, limit }),
    )

    res.json({
      server: serverSummary(server),
      source,
      metric,
      items,
      total: items.length,
    })
  } catch (err) {
    // V$ 뷰 권한 부재를 명확히 안내
    if (/ORA-00942/.test(err.message)) {
      return res.status(403).json({
        message: `접속 계정에 성능 뷰 조회 권한이 없습니다 (ORA-00942). SELECT_CATALOG_ROLE 부여가 필요합니다. 원본 오류: ${err.message}`,
      })
    }
    res.status(500).json({ message: err.message })
  }
})

export default router
