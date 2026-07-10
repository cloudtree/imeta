import { Router } from 'express'
import { pool } from '../db.js'
import { testPgConnection } from '../dbConnectionTest.js'
import { withDbServerClient } from '../dbClient.js'
import {
  fetchUserTables,
  fetchTableDefinition,
  fetchSchemaDefinitionRows,
} from '../dbSchemaIntrospection.js'

const router = Router()

const LIST_COLUMNS = `
  server_id, server_name, host, port, database_name, username,
  ssl_enabled, description, use_yn, last_test_at, last_test_ok,
  created_at, updated_at
`

function validateServerBody(body, { requirePassword = true } = {}) {
  const {
    server_name,
    host,
    port = 5432,
    database_name,
    username,
    password,
    ssl_enabled = 'Y',
    description,
    use_yn = 'Y',
  } = body

  if (!server_name?.trim()) return '서버명은 필수입니다.'
  if (!host?.trim()) return '호스트는 필수입니다.'
  if (!database_name?.trim()) return '데이터베이스명은 필수입니다.'
  if (!username?.trim()) return '사용자명은 필수입니다.'
  if (requirePassword && !password) return '비밀번호는 필수입니다.'

  const portNum = Number(port)
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return '포트는 1~65535 사이의 정수여야 합니다.'
  }

  if (ssl_enabled && !['Y', 'N'].includes(ssl_enabled)) {
    return 'SSL 사용 여부는 Y 또는 N이어야 합니다.'
  }
  if (use_yn && !['Y', 'N'].includes(use_yn)) {
    return '사용 여부는 Y 또는 N이어야 합니다.'
  }

  return null
}

async function updateTestResult(serverId, ok) {
  await pool.query(
    `UPDATE db_servers
     SET last_test_at = CURRENT_TIMESTAMP, last_test_ok = $1
     WHERE server_id = $2`,
    [ok ? 'Y' : 'N', serverId],
  )
}

// GET /api/db-servers
router.get('/', async (req, res) => {
  try {
    const { search, use_yn, page = 1, limit = 100 } = req.query
    const params = []
    const conditions = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(
        `(s.server_name ILIKE $${params.length}
          OR s.host ILIKE $${params.length}
          OR s.database_name ILIKE $${params.length}
          OR s.username ILIKE $${params.length})`,
      )
    }
    if (use_yn) {
      params.push(use_yn)
      conditions.push(`s.use_yn = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(`SELECT COUNT(*) FROM db_servers s ${where}`, params)
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT ${LIST_COLUMNS}
       FROM db_servers s
       ${where}
       ORDER BY s.server_id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ items: dataResult.rows, total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

async function getServerCredentials(id) {
  const { rows } = await pool.query(
    `SELECT server_id, server_name, host, port, database_name, username, password, ssl_enabled, use_yn
     FROM db_servers
     WHERE server_id = $1`,
    [id],
  )
  return rows[0] ?? null
}

// POST /api/db-servers/test
router.post('/test', async (req, res) => {
  try {
    const validationError = validateServerBody(req.body, { requirePassword: true })
    if (validationError) return res.status(400).json({ message: validationError })

    const result = await testPgConnection(req.body)
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/db-servers/:id/schema/tables/:schema/:table
router.get('/:id/schema/tables/:schema/:table', async (req, res) => {
  try {
    const server = await getServerCredentials(req.params.id)
    if (!server) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })

    const definition = await withDbServerClient(server, (client) =>
      fetchTableDefinition(client, req.params.schema, req.params.table, {
        search: req.query.search,
      }),
    )

    if (!definition) {
      return res.status(404).json({ message: '테이블을 찾을 수 없습니다.' })
    }

    res.json({
      server: {
        server_id: server.server_id,
        server_name: server.server_name,
        database_name: server.database_name,
      },
      ...definition,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/db-servers/:id/schema/definitions
router.get('/:id/schema/definitions', async (req, res) => {
  try {
    const server = await getServerCredentials(req.params.id)
    if (!server) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })

    const items = await withDbServerClient(server, (client) =>
      fetchSchemaDefinitionRows(client, { dbType: 'PostgreSQL' }),
    )

    res.json({
      server: {
        server_id: server.server_id,
        server_name: server.server_name,
        database_name: server.database_name,
        db_type: 'PostgreSQL',
      },
      items,
      total: items.length,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/db-servers/:id/schema/tables
router.get('/:id/schema/tables', async (req, res) => {
  try {
    const server = await getServerCredentials(req.params.id)
    if (!server) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })

    const tables = await withDbServerClient(server, fetchUserTables)

    res.json({
      server: {
        server_id: server.server_id,
        server_name: server.server_name,
        database_name: server.database_name,
      },
      items: tables,
      total: tables.length,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/db-servers/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM db_servers WHERE server_id = $1`,
      [req.params.id],
    )
    if (!rows.length) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/db-servers/:id/test
router.post('/:id/test', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT server_id, host, port, database_name, username, password, ssl_enabled FROM db_servers WHERE server_id = $1',
      [req.params.id],
    )
    if (!rows.length) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })

    const result = await testPgConnection(rows[0])
    await updateTestResult(rows[0].server_id, result.ok)
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/db-servers
router.post('/', async (req, res) => {
  try {
    const validationError = validateServerBody(req.body, { requirePassword: true })
    if (validationError) return res.status(400).json({ message: validationError })

    const {
      server_name,
      host,
      port = 5432,
      database_name,
      username,
      password,
      ssl_enabled = 'Y',
      description,
      use_yn = 'Y',
    } = req.body

    const dup = await pool.query('SELECT 1 FROM db_servers WHERE server_name = $1', [server_name.trim()])
    if (dup.rows.length) {
      return res.status(409).json({ message: `서버명 "${server_name}"은(는) 이미 존재합니다.` })
    }

    const { rows } = await pool.query(
      `INSERT INTO db_servers
         (server_name, host, port, database_name, username, password, ssl_enabled, description, use_yn)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${LIST_COLUMNS}`,
      [
        server_name.trim(),
        host.trim(),
        Number(port),
        database_name.trim(),
        username.trim(),
        password,
        ssl_enabled,
        description ?? null,
        use_yn,
      ],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `서버명 "${req.body.server_name}"은(는) 이미 존재합니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/db-servers/:id
router.put('/:id', async (req, res) => {
  try {
    const validationError = validateServerBody(req.body, { requirePassword: false })
    if (validationError) return res.status(400).json({ message: validationError })

    const {
      server_name,
      host,
      port = 5432,
      database_name,
      username,
      password,
      ssl_enabled = 'Y',
      description,
      use_yn = 'Y',
    } = req.body

    const existing = await pool.query('SELECT server_id, server_name FROM db_servers WHERE server_id = $1', [req.params.id])
    if (!existing.rows.length) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })

    if (server_name.trim() !== existing.rows[0].server_name) {
      const dup = await pool.query('SELECT 1 FROM db_servers WHERE server_name = $1 AND server_id <> $2', [
        server_name.trim(),
        req.params.id,
      ])
      if (dup.rows.length) {
        return res.status(409).json({ message: `서버명 "${server_name}"은(는) 이미 존재합니다.` })
      }
    }

    const fields = {
      server_name: server_name.trim(),
      host: host.trim(),
      port: Number(port),
      database_name: database_name.trim(),
      username: username.trim(),
      ssl_enabled,
      description: description ?? null,
      use_yn: use_yn ?? 'Y',
    }
    if (password) fields.password = password

    const keys = Object.keys(fields)
    const setClauses = keys.map((key, index) => `${key} = $${index + 1}`)
    const params = [...Object.values(fields), req.params.id]

    const { rows } = await pool.query(
      `UPDATE db_servers
       SET ${setClauses.join(', ')}
       WHERE server_id = $${params.length}
       RETURNING ${LIST_COLUMNS}`,
      params,
    )
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: `서버명 "${req.body.server_name}"은(는) 이미 존재합니다.` })
    }
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/db-servers/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM db_servers WHERE server_id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ message: 'DB 서버를 찾을 수 없습니다.' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
