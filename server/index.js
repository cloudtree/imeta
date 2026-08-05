import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRouter         from './routes/auth.js'
import wordsRouter        from './routes/words.js'
import termsRouter        from './routes/terms.js'
import domainsRouter      from './routes/domains.js'
import subjectAreasRouter from './routes/subjectAreas.js'
import domainGroupsRouter from './routes/domainGroups.js'
import dbServersRouter    from './routes/dbServers.js'
import tableDefinitionsRouter from './routes/tableDefinitions.js'
import activityRouter from './routes/activity.js'
import usersRouter from './routes/users.js'
import dataObjectsRouter from './routes/dataObjects.js'
import metaSystemsRouter from './routes/metaSystems.js'
import namingRulesRouter from './routes/namingRules.js'
import tuningRouter from './routes/tuning.js'
import { requireAuth, requireAdmin } from './middleware/requireAuth.js'
import { migrateDomainsDataLength } from './migrateDataLength.js'
import { migrateUsers } from './migrateUsers.js'
import { migrateDataObjects } from './migrateDataObjects.js'
import { migrateNamingRules } from './migrateNamingRules.js'
import { migrateSubjectAreaSystem } from './migrateSubjectAreaSystem.js'
import { migrateInternalComments } from './migrateInternalComments.js'
import { migrateInternalSchemaRename } from './migrateInternalSchemaRename.js'
import { migrateDropCompatViews } from './migrateDropCompatViews.js'
import { describeDbTarget } from './dbConfig.js'
import { pool } from './db.js'

const app  = express()
const PORT = process.env.PORT ?? 3000

const corsOrigins = process.env.CORS_ORIGIN
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(cors(corsOrigins?.length ? {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
} : {}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/auth', authRouter)
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api', requireAuth)
app.use('/api/words',         wordsRouter)
app.use('/api/terms',         termsRouter)
app.use('/api/domains',       domainsRouter)
app.use('/api/subject-areas',  subjectAreasRouter)
app.use('/api/domain-groups',  domainGroupsRouter)
app.use('/api/db-servers',     dbServersRouter)
app.use('/api/table-definitions', tableDefinitionsRouter)
app.use('/api/activity', activityRouter)
app.use('/api/users', requireAdmin, usersRouter)
app.use('/api/data-objects', requireAdmin, dataObjectsRouter)
app.use('/api/meta-systems', metaSystemsRouter)
app.use('/api/naming-rules', requireAdmin, namingRulesRouter)
app.use('/api/tuning', tuningRouter)

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: '요청 데이터가 너무 큽니다. (최대 50MB)' })
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ message: '요청 JSON 형식이 올바르지 않습니다.' })
  }
  console.error(err)
  res.status(500).json({ message: err.message || '서버 오류가 발생했습니다.' })
})

app.listen(PORT, async () => {
  try {
    const target = describeDbTarget()
    console.log(`[db] source=${target.source} host=${target.host} database=${target.database} user=${target.user}`)
    await pool.query('SELECT 1')
    // 1) 기존 스키마 컬럼 타입 보정
    await migrateDomainsDataLength()
    // 2) 표준 물리명으로 테이블/컬럼 RENAME
    await migrateInternalSchemaRename()
    // 3) 신규 환경용 DDL (신 물리명)
    await migrateUsers()
    await migrateDataObjects()
    await migrateNamingRules()
    await migrateSubjectAreaSystem()
    // 4) 구 호환 VIEW 제거 (API/UI 표준 물리명 전환)
    await migrateDropCompatViews()
    // 5) COMMENT + 표준사전 시드
    await migrateInternalComments()
    console.log(`Server running on port ${PORT}`)
  } catch (err) {
    console.error('[startup] failed:', err.message)
    if (err.code === '3D000') {
      console.error('[startup] Hint: DB_NAME must be the database (e.g. imetadb), not the username (e.g. imetadb_user).')
    }
    process.exit(1)
  }
})
