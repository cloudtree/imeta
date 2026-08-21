import { Router } from 'express'
import { pool } from '../db.js'
import { withOracleConnection } from '../oracleClient.js'
import { withDbServerClient } from '../dbClient.js'
import {
  extractTableNames,
  collectDictionary as collectOracleDictionary,
  getExplainPlan as getOracleExplainPlan,
  comparePlans,
  ensurePlanTable,
  getTopSql,
  getAwrTopSql,
  checkAwrAvailability,
  setCurrentSchema,
} from '../oracleTuning.js'
import {
  collectDictionary as collectPgDictionary,
  getExplainPlan as getPgExplainPlan,
  setSearchPath,
} from '../postgresTuning.js'
import { analyzeSql, annotatePlanNodes } from '../tuningRules.js'
import { generateRewriteCandidates, buildRewriteNotes } from '../sqlRewrite.js'
import { generateExplanation } from '../ollamaExplain.js'

const router = Router()

const TUNABLE_DB_TYPES = ['ORACLE', 'POSTGRES']

async function getOracleServer(id, res) {
  const { rows } = await pool.query(
    `SELECT db_server_id, db_server_nm, db_type_nm, host_nm, port_no, database_nm,
            user_nm, password_val, diag_pack_yn, tuning_pack_yn, ora_privilege_cd
     FROM meta_db_server_m WHERE db_server_id = $1`,
    [id],
  )
  const server = rows[0]
  if (!server) {
    res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })
    return null
  }
  if ((server.db_type_nm || '').toUpperCase() !== 'ORACLE') {
    res.status(400).json({ message: 'Top SQL 조회는 Oracle 서버만 지원합니다.' })
    return null
  }
  return server
}

/** SQL 분석(/analyze)은 sLLM 해설이 지원하는 모든 DBMS를 대상으로 허용한다. */
async function getTuningServer(id, res) {
  const { rows } = await pool.query(
    `SELECT db_server_id, db_server_nm, db_type_nm, host_nm, port_no, database_nm,
            user_nm, password_val, diag_pack_yn, tuning_pack_yn, ora_privilege_cd, ssl_yn
     FROM meta_db_server_m WHERE db_server_id = $1`,
    [id],
  )
  const server = rows[0]
  if (!server) {
    res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })
    return null
  }
  const dbType = (server.db_type_nm || '').toUpperCase()
  if (!TUNABLE_DB_TYPES.includes(dbType)) {
    res.status(400).json({
      message: `SQL 튜닝 분석은 ${TUNABLE_DB_TYPES.join(', ')} 서버만 지원합니다.`,
    })
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

function describePgError(message, schemaName) {
  if (!message || !/does not exist/i.test(message)) return message
  return (
    `${message}\n→ 테이블을 찾을 수 없습니다. ` +
    (schemaName
      ? `지정한 스키마(${schemaName})에 테이블이 있는지 확인하세요.`
      : `'스키마(선택)' 입력란에 테이블 소유 스키마를 지정하거나, 스키마명.테이블명 형식으로 작성하세요.`)
  )
}

/**
 * DB 종류에 무관한 공통 분석 파이프라인.
 * getPlan/getDictionary는 이미 연결(connection/client)에 바인딩된 함수를 받는다.
 */
async function runAnalysis({ sqlText, getPlan, getDictionary, packInfo, dbType = 'ORACLE', describeError = (m) => m }) {
  const tableRefs = extractTableNames(sqlText)

  let plan = null
  let planError = null
  try {
    plan = await getPlan(sqlText)
  } catch (err) {
    planError = describeError(err.message)
  }

  let dictionary = { tables: [], columns: [], indexes: [], indexColumns: [], constraints: [], statistics: [] }
  let dictionaryError = null
  try {
    dictionary = await getDictionary(tableRefs)
  } catch (err) {
    dictionaryError = err.message
  }

  const findings = analyzeSql({ sqlText, dictionary, planRows: plan?.rows ?? [], dbType })
  const planAnnotations = annotatePlanNodes(findings, plan?.rows ?? [])

  // 결과가 동일하게 보존되는 규칙들로 여러 후보 SQL을 만들고, 각 후보의 실행계획 COST를 비교해
  // 원본보다 실제로 더 빠른 후보만 "튜닝 후" SQL로 채택한다.
  const candidates = generateRewriteCandidates({ sqlText, findings, dictionary })
  const baseCost = plan?.rows?.length ? Number(plan.rows[0]?.COST ?? NaN) : NaN

  const evaluated = []
  for (const candidate of candidates) {
    try {
      const candidatePlan = await getPlan(candidate.sql)
      const cost = candidatePlan.rows?.length ? Number(candidatePlan.rows[0]?.COST ?? NaN) : NaN
      evaluated.push({ ...candidate, plan: candidatePlan, cost })
    } catch (err) {
      console.warn('[tuning] candidate explain failed:', err.message)
    }
  }

  const usable = evaluated.filter((c) => Number.isFinite(c.cost))
  const best = usable.length ? usable.reduce((min, c) => (c.cost < min.cost ? c : min)) : null
  const chosen = best && (!Number.isFinite(baseCost) || best.cost < baseCost) ? best : null

  const appliedRuleIds = new Set((chosen?.transforms ?? []).map((t) => t.rule_id))
  const rewrite = {
    original_sql: sqlText,
    tuned_sql: chosen ? chosen.sql : sqlText,
    changed: !!chosen,
    transforms: chosen?.transforms ?? [],
    notes: buildRewriteNotes(findings, appliedRuleIds),
    candidate_count: candidates.length,
  }

  let planAfter = null
  let planAfterError = null
  let planAfterAnnotations = {}
  let findingsAfter = []
  if (chosen) {
    planAfter = chosen.plan
    findingsAfter = analyzeSql({
      sqlText: rewrite.tuned_sql,
      dictionary,
      planRows: planAfter?.rows ?? [],
      dbType,
    })
    planAfterAnnotations = annotatePlanNodes(findingsAfter, planAfter?.rows ?? [])
  } else if (candidates.length && !evaluated.length) {
    planAfterError = '후보 SQL의 실행계획을 생성하지 못했습니다.'
  }

  const planCompare = chosen ? comparePlans(plan, planAfter) : null

  return {
    tableRefs,
    plan,
    planError,
    planAfter,
    planAfterError,
    planAfterAnnotations,
    findingsAfter,
    planCompare,
    dictionary,
    dictionaryError,
    findings,
    planAnnotations,
    rewrite,
    packInfo,
  }
}

async function analyzeOracleServer(server, sqlText, schemaName) {
  const schemaUpper = schemaName ? schemaName.toUpperCase() : null
  return withOracleConnection(server, async (connection) => {
    if (schemaUpper) {
      try {
        await setCurrentSchema(connection, schemaUpper)
      } catch (err) {
        const e = new Error(
          /ORA-01435/.test(err.message)
            ? `스키마 "${schemaUpper}"이(가) 존재하지 않습니다.`
            : `스키마 전환 실패: ${err.message}`,
        )
        e.statusCode = 400
        throw e
      }
    }

    // 실행계획용 PLAN_TABLE 보장 (스키마 전환 이후 현재 사용자/CURRENT_SCHEMA 기준)
    try {
      await ensurePlanTable(connection)
    } catch (err) {
      // 생성 실패해도 EXPLAIN 시도 — 공개 PLAN_TABLE 시노님이 있는 경우도 있음
      console.warn('[tuning] ensurePlanTable:', err.message)
    }

    // Diagnostics Pack 게이팅: 서버 설정이 Y일 때만 AWR 접근
    const packInfo = {
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

    return runAnalysis({
      sqlText,
      getPlan: (sql) => getOracleExplainPlan(connection, sql),
      getDictionary: (tableRefs) => collectOracleDictionary(connection, tableRefs),
      packInfo,
      dbType: 'ORACLE',
      describeError: (m) => describeOra942(m, schemaUpper),
    })
  })
}

async function analyzePostgresServer(server, sqlText, schemaName) {
  return withDbServerClient(server, async (client) => {
    if (schemaName) {
      try {
        await setSearchPath(client, schemaName)
      } catch (err) {
        const e = new Error(err.message)
        e.statusCode = 400
        throw e
      }
    }

    const packInfo = { diag_pack_yn: 'N', tuning_pack_yn: 'N', awr: null, tuning_advisor: null }

    return runAnalysis({
      sqlText,
      getPlan: (sql) => getPgExplainPlan(client, sql),
      getDictionary: (tableRefs) => collectPgDictionary(client, tableRefs),
      packInfo,
      dbType: 'POSTGRES',
      describeError: (m) => describePgError(m, schemaName),
    })
  })
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

    const server = await getTuningServer(db_server_id, res)
    if (!server) return

    const dbType = (server.db_type_nm || 'ORACLE').toUpperCase()
    const schemaName = schema_nm?.trim() || null

    const result = dbType === 'ORACLE'
      ? await analyzeOracleServer(server, sqlText, schemaName)
      : await analyzePostgresServer(server, sqlText, schemaName)

    let llm = null
    if (use_llm) {
      llm = await generateExplanation({
        sqlText,
        planText: result.plan?.text,
        findings: result.findings,
        dbType: dbType === 'ORACLE' ? 'Oracle' : 'PostgreSQL',
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
      findings_after: result.findingsAfter,
      rewrite: result.rewrite,
      plan: result.plan,
      plan_error: result.planError,
      plan_annotations: result.planAnnotations,
      plan_after: result.planAfter,
      plan_after_error: result.planAfterError,
      plan_after_annotations: result.planAfterAnnotations,
      plan_compare: result.planCompare,
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
