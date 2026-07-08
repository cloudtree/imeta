import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const LIST_COLUMNS = `
  def_id, schema_name, db_type, entity_name, table_name,
  attribute_name, column_name, column_order, pk_yn,
  data_type, data_length, domain_name, infotype, use_yn,
  created_at, updated_at
`

function normalizePkYn(value) {
  const v = value?.trim().toUpperCase()
  if (!v) return 'N'
  if (v === 'Y' || v === 'N') return v
  throw new Error('PK여부는 Y 또는 N만 입력 가능합니다.')
}

function normalizeUseYn(value) {
  const v = value?.trim().toUpperCase()
  if (!v) return 'Y'
  if (v === 'Y' || v === 'N') return v
  throw new Error('사용여부는 Y 또는 N만 입력 가능합니다.')
}

function validateDefinitionBody(body, { partial = false } = {}) {
  const {
    schema_name,
    db_type,
    entity_name,
    table_name,
    attribute_name,
    column_name,
    column_order,
    pk_yn,
    data_type,
    data_length,
    domain_name,
    infotype,
    use_yn,
  } = body

  if (!partial || schema_name !== undefined) {
    if (!schema_name?.trim()) return '스키마명은 필수입니다.'
  }
  if (!partial || db_type !== undefined) {
    if (!db_type?.trim()) return 'DB종류는 필수입니다.'
  }
  if (!partial || entity_name !== undefined) {
    if (!entity_name?.trim()) return '엔티티명은 필수입니다.'
  }
  if (!partial || table_name !== undefined) {
    if (!table_name?.trim()) return '테이블명은 필수입니다.'
  }
  if (!partial || attribute_name !== undefined) {
    if (!attribute_name?.trim()) return '속성명은 필수입니다.'
  }
  if (!partial || column_name !== undefined) {
    if (!column_name?.trim()) return '컬럼명은 필수입니다.'
  }
  if (!partial || column_order !== undefined) {
    const order = Number(column_order)
    if (!Number.isInteger(order) || order < 1) {
      return '컬럼명순서는 1 이상의 정수여야 합니다.'
    }
  }
  if (!partial || data_type !== undefined) {
    if (!data_type?.trim()) return '데이터타입은 필수입니다.'
  }

  try {
    if (pk_yn !== undefined) normalizePkYn(pk_yn)
    if (use_yn !== undefined) normalizeUseYn(use_yn)
  } catch (err) {
    return err.message
  }

  return null
}

function mapRow(row) {
  return {
    ...row,
    table_key: `${row.schema_name}|${row.db_type}|${row.table_name}`,
  }
}

// GET /api/table-definitions/tables
router.get('/tables', async (req, res) => {
  try {
    const { search, db_type, use_yn = 'Y' } = req.query
    const params = []
    const conditions = []

    if (use_yn) {
      params.push(use_yn)
      conditions.push(`td.use_yn = $${params.length}`)
    }
    if (db_type) {
      params.push(db_type)
      conditions.push(`td.db_type = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(td.schema_name ILIKE $${n}
          OR td.db_type ILIKE $${n}
          OR td.entity_name ILIKE $${n}
          OR td.table_name ILIKE $${n}
          OR td.attribute_name ILIKE $${n}
          OR td.column_name ILIKE $${n}
          OR td.domain_name ILIKE $${n}
          OR td.infotype ILIKE $${n})`,
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT
         td.schema_name,
         td.db_type,
         td.entity_name,
         td.table_name,
         count(*)::int AS column_count,
         string_agg(
           CASE WHEN td.pk_yn = 'Y' THEN td.column_name END,
           ', ' ORDER BY td.column_order
         ) AS pk_columns
       FROM table_definitions td
       ${where}
       GROUP BY td.schema_name, td.db_type, td.entity_name, td.table_name
       ORDER BY td.schema_name, td.table_name`,
      params,
    )

    const items = rows.map((row) => ({
      ...row,
      table_key: `${row.schema_name}|${row.db_type}|${row.table_name}`,
      pk_columns: row.pk_columns || '',
    }))

    res.json({ items, total: items.length })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/table-definitions/tables/detail
router.get('/tables/detail', async (req, res) => {
  try {
    const { schema_name, db_type, table_name } = req.query
    if (!schema_name?.trim() || !db_type?.trim() || !table_name?.trim()) {
      return res.status(400).json({ message: 'schema_name, db_type, table_name은 필수입니다.' })
    }

    const { rows } = await pool.query(
      `SELECT ${LIST_COLUMNS}
       FROM table_definitions
       WHERE schema_name = $1 AND db_type = $2 AND table_name = $3 AND use_yn = 'Y'
       ORDER BY column_order ASC, def_id ASC`,
      [schema_name.trim(), db_type.trim(), table_name.trim()],
    )

    if (!rows.length) {
      return res.status(404).json({ message: '테이블 정의서를 찾을 수 없습니다.' })
    }

    res.json({
      schema_name: rows[0].schema_name,
      db_type: rows[0].db_type,
      entity_name: rows[0].entity_name,
      table_name: rows[0].table_name,
      pk_columns: rows
        .filter((row) => row.pk_yn === 'Y')
        .map((row) => row.column_name)
        .join(', '),
      columns: rows.map(mapRow),
      total: rows.length,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/table-definitions
router.get('/', async (req, res) => {
  try {
    const { search, db_type, table_name, page = 1, limit = 200 } = req.query
    const params = []
    const conditions = [`td.use_yn = 'Y'`]

    if (db_type) {
      params.push(db_type)
      conditions.push(`td.db_type = $${params.length}`)
    }
    if (table_name) {
      params.push(table_name)
      conditions.push(`td.table_name = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(td.schema_name ILIKE $${n}
          OR td.entity_name ILIKE $${n}
          OR td.table_name ILIKE $${n}
          OR td.attribute_name ILIKE $${n}
          OR td.column_name ILIKE $${n}
          OR td.domain_name ILIKE $${n}
          OR td.infotype ILIKE $${n})`,
      )
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM table_definitions td ${where}`,
      params,
    )
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT ${LIST_COLUMNS}
       FROM table_definitions td
       ${where}
       ORDER BY td.schema_name, td.table_name, td.column_order, td.def_id
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )

    res.json({ items: dataResult.rows.map(mapRow), total })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/table-definitions/bulk
router.post('/bulk', async (req, res) => {
  const rows = req.body
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: '등록할 데이터가 없습니다.' })
  }

  const success = []
  const errors = []
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const rowNum = Number(r.__rowNum) || (i + 2)
      const savepoint = `sp_td_${i}`

      await client.query(`SAVEPOINT ${savepoint}`)
      try {
        const validationError = validateDefinitionBody(r)
        if (validationError) throw new Error(validationError)

        const values = {
          schema_name: r.schema_name.trim(),
          db_type: r.db_type.trim(),
          entity_name: r.entity_name.trim(),
          table_name: r.table_name.trim(),
          attribute_name: r.attribute_name.trim(),
          column_name: r.column_name.trim(),
          column_order: Number(r.column_order),
          pk_yn: normalizePkYn(r.pk_yn),
          data_type: r.data_type.trim(),
          data_length: r.data_length?.trim() || null,
          domain_name: r.domain_name?.trim() || null,
          infotype: r.infotype?.trim() || null,
          use_yn: normalizeUseYn(r.use_yn),
        }

        await client.query(
          `INSERT INTO table_definitions
             (schema_name, db_type, entity_name, table_name, attribute_name, column_name,
              column_order, pk_yn, data_type, data_length, domain_name, infotype, use_yn)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (schema_name, db_type, table_name, column_name)
           DO UPDATE SET
             entity_name = EXCLUDED.entity_name,
             attribute_name = EXCLUDED.attribute_name,
             column_order = EXCLUDED.column_order,
             pk_yn = EXCLUDED.pk_yn,
             data_type = EXCLUDED.data_type,
             data_length = EXCLUDED.data_length,
             domain_name = EXCLUDED.domain_name,
             infotype = EXCLUDED.infotype,
             use_yn = EXCLUDED.use_yn`,
          [
            values.schema_name,
            values.db_type,
            values.entity_name,
            values.table_name,
            values.attribute_name,
            values.column_name,
            values.column_order,
            values.pk_yn,
            values.data_type,
            values.data_length,
            values.domain_name,
            values.infotype,
            values.use_yn,
          ],
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({
          row: rowNum,
          table_name: values.table_name,
          column_name: values.column_name,
        })
      } catch (rowErr) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        errors.push({ row: rowNum, data: r, message: rowErr.message })
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    return res.status(500).json({ message: err.message })
  } finally {
    client.release()
  }

  res.json({ success, errors })
})

// DELETE /api/table-definitions/tables
router.delete('/tables', async (req, res) => {
  try {
    const { schema_name, db_type, table_name } = req.query
    if (!schema_name?.trim() || !db_type?.trim() || !table_name?.trim()) {
      return res.status(400).json({ message: 'schema_name, db_type, table_name은 필수입니다.' })
    }

    const { rowCount } = await pool.query(
      `DELETE FROM table_definitions
       WHERE schema_name = $1 AND db_type = $2 AND table_name = $3`,
      [schema_name.trim(), db_type.trim(), table_name.trim()],
    )

    if (!rowCount) {
      return res.status(404).json({ message: '테이블 정의서를 찾을 수 없습니다.' })
    }

    res.json({ message: `삭제 완료. ${rowCount}건의 컬럼 정의가 삭제되었습니다.`, deleted: rowCount })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/table-definitions/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM table_definitions WHERE def_id = $1`,
      [req.params.id],
    )
    if (!rows.length) return res.status(404).json({ message: '정의서 항목을 찾을 수 없습니다.' })
    res.json(mapRow(rows[0]))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// PUT /api/table-definitions/:id
router.put('/:id', async (req, res) => {
  try {
    const validationError = validateDefinitionBody(req.body)
    if (validationError) return res.status(400).json({ message: validationError })

    const {
      schema_name,
      db_type,
      entity_name,
      table_name,
      attribute_name,
      column_name,
      column_order,
      pk_yn,
      data_type,
      data_length,
      domain_name,
      infotype,
      use_yn,
    } = req.body

    const { rows } = await pool.query(
      `UPDATE table_definitions
       SET schema_name=$1, db_type=$2, entity_name=$3, table_name=$4,
           attribute_name=$5, column_name=$6, column_order=$7, pk_yn=$8,
           data_type=$9, data_length=$10, domain_name=$11, infotype=$12, use_yn=$13
       WHERE def_id=$14
       RETURNING ${LIST_COLUMNS}`,
      [
        schema_name.trim(),
        db_type.trim(),
        entity_name.trim(),
        table_name.trim(),
        attribute_name.trim(),
        column_name.trim(),
        Number(column_order),
        normalizePkYn(pk_yn),
        data_type.trim(),
        data_length?.trim() || null,
        domain_name?.trim() || null,
        infotype?.trim() || null,
        normalizeUseYn(use_yn),
        req.params.id,
      ],
    )

    if (!rows.length) return res.status(404).json({ message: '정의서 항목을 찾을 수 없습니다.' })
    res.json(mapRow(rows[0]))
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: '동일한 스키마/DB종류/테이블/컬럼 조합이 이미 존재합니다.' })
    }
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/table-definitions/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM table_definitions WHERE def_id = $1',
      [req.params.id],
    )
    if (!rowCount) return res.status(404).json({ message: '정의서 항목을 찾을 수 없습니다.' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
