import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import wordsRouter        from './routes/words.js'
import termsRouter        from './routes/terms.js'
import domainsRouter      from './routes/domains.js'
import subjectAreasRouter from './routes/subjectAreas.js'
import domainGroupsRouter from './routes/domainGroups.js'
import { migrateDomainsDataLength } from './migrateDataLength.js'
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
  allowedHeaders: ['Content-Type'],
} : {}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/words',         wordsRouter)
app.use('/api/terms',         termsRouter)
app.use('/api/domains',       domainsRouter)
app.use('/api/subject-areas',  subjectAreasRouter)
app.use('/api/domain-groups',  domainGroupsRouter)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

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
    await migrateDomainsDataLength()
    console.log(`Server running on port ${PORT}`)
  } catch (err) {
    console.error('[startup] failed:', err.message)
    if (err.code === '3D000') {
      console.error('[startup] Hint: DB_NAME must be the database (e.g. imetadb), not the username (e.g. imetadb_user).')
    }
    process.exit(1)
  }
})
