import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

const LIST_COLUMNS = `
  table_def_id, schema_nm, db_type_nm, entity_nm, table_nm,
  attribute_nm, column_nm, column_ord, pk_yn,
  data_type_nm, data_len, domain_nm, info_type_nm, use_yn,
  reg_dtm, upd_dtm
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
    schema_nm,
    db_type_nm,
    entity_nm,
    table_nm,
    attribute_nm,
    column_nm,
    column_ord,
    pk_yn,
    data_type_nm,
    data_len,
    domain_nm,
    info_type_nm,
    use_yn,
  } = body

  if (!partial || schema_nm !== undefined) {
    if (!schema_nm?.trim()) return '스키마명은 필수입니다.'
  }
  if (!partial || db_type_nm !== undefined) {
    if (!db_type_nm?.trim()) return 'DB종류는 필수입니다.'
  }
  if (!partial || entity_nm !== undefined) {
    if (!entity_nm?.trim()) return '엔티티명은 필수입니다.'
  }
  if (!partial || table_nm !== undefined) {
    if (!table_nm?.trim()) return '테이블명은 필수입니다.'
  }
  if (!partial || attribute_nm !== undefined) {
    if (!attribute_nm?.trim()) return '속성명은 필수입니다.'
  }
  if (!partial || column_nm !== undefined) {
    if (!column_nm?.trim()) return '컬럼명은 필수입니다.'
  }
  if (!partial || column_ord !== undefined) {
    const order = Number(column_ord)
    if (!Number.isInteger(order) || order < 1) {
      return '컬럼명순서는 1 이상의 정수여야 합니다.'
    }
  }
  if (!partial || data_type_nm !== undefined) {
    if (!data_type_nm?.trim()) return '데이터타입은 필수입니다.'
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
    table_key: `${row.schema_nm}|${row.db_type_nm}|${row.table_nm}`,
  }
}

// GET /api/table-definitions/tables
router.get('/tables', async (req, res) => {
  try {
    const { search, db_type_nm, use_yn = 'Y' } = req.query
    const params = []
    const conditions = []

    if (use_yn) {
      params.push(use_yn)
      conditions.push(`td.use_yn = $${params.length}`)
    }
    if (db_type_nm) {
      params.push(db_type_nm)
      conditions.push(`td.db_type_nm = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(td.schema_nm ILIKE $${n}
          OR td.db_type_nm ILIKE $${n}
          OR td.entity_nm ILIKE $${n}
          OR td.table_nm ILIKE $${n}
          OR td.attribute_nm ILIKE $${n}
          OR td.column_nm ILIKE $${n}
          OR td.domain_nm ILIKE $${n}
          OR td.info_type_nm ILIKE $${n})`,
      )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT
         td.schema_nm,
         td.db_type_nm,
         td.entity_nm,
         td.table_nm,
         count(*)::int AS column_count,
         string_agg(
           CASE WHEN td.pk_yn = 'Y' THEN td.column_nm END,
           ', ' ORDER BY td.column_ord
         ) AS pk_columns
       FROM meta_table_def_m td
       ${where}
       GROUP BY td.schema_nm, td.db_type_nm, td.entity_nm, td.table_nm
       ORDER BY td.schema_nm, td.table_nm`,
      params,
    )

    const items = rows.map((row) => ({
      ...row,
      table_key: `${row.schema_nm}|${row.db_type_nm}|${row.table_nm}`,
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
    const { schema_nm, db_type_nm, table_nm } = req.query
    if (!schema_nm?.trim() || !db_type_nm?.trim() || !table_nm?.trim()) {
      return res.status(400).json({ message: 'schema_nm, db_type_nm, table_nm은 필수입니다.' })
    }

    const { rows } = await pool.query(
      `SELECT ${LIST_COLUMNS}
       FROM meta_table_def_m
       WHERE schema_nm = $1 AND db_type_nm = $2 AND table_nm = $3 AND use_yn = 'Y'
       ORDER BY column_ord ASC, table_def_id ASC`,
      [schema_nm.trim(), db_type_nm.trim(), table_nm.trim()],
    )

    if (!rows.length) {
      return res.status(404).json({ message: '테이블 정의서를 찾을 수 없습니다.' })
    }

    res.json({
      schema_nm: rows[0].schema_nm,
      db_type_nm: rows[0].db_type_nm,
      entity_nm: rows[0].entity_nm,
      table_nm: rows[0].table_nm,
      pk_columns: rows
        .filter((row) => row.pk_yn === 'Y')
        .map((row) => row.column_nm)
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
    const { search, db_type_nm, table_nm, page = 1, limit = 200 } = req.query
    const params = []
    const conditions = [`td.use_yn = 'Y'`]

    if (db_type_nm) {
      params.push(db_type_nm)
      conditions.push(`td.db_type_nm = $${params.length}`)
    }
    if (table_nm) {
      params.push(table_nm)
      conditions.push(`td.table_nm = $${params.length}`)
    }
    if (search) {
      params.push(`%${search}%`)
      const n = params.length
      conditions.push(
        `(td.schema_nm ILIKE $${n}
          OR td.entity_nm ILIKE $${n}
          OR td.table_nm ILIKE $${n}
          OR td.attribute_nm ILIKE $${n}
          OR td.column_nm ILIKE $${n}
          OR td.domain_nm ILIKE $${n}
          OR td.info_type_nm ILIKE $${n})`,
      )
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const offset = (Number(page) - 1) * Number(limit)

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM meta_table_def_m td ${where}`,
      params,
    )
    const total = Number(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const dataResult = await pool.query(
      `SELECT ${LIST_COLUMNS}
       FROM meta_table_def_m td
       ${where}
       ORDER BY td.schema_nm, td.table_nm, td.column_ord, td.table_def_id
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
          schema_nm: r.schema_nm.trim(),
          db_type_nm: r.db_type_nm.trim(),
          entity_nm: r.entity_nm.trim(),
          table_nm: r.table_nm.trim(),
          attribute_nm: r.attribute_nm.trim(),
          column_nm: r.column_nm.trim(),
          column_ord: Number(r.column_ord),
          pk_yn: normalizePkYn(r.pk_yn),
          data_type_nm: r.data_type_nm.trim(),
          data_len: r.data_len?.trim() || null,
          domain_nm: r.domain_nm?.trim() || null,
          info_type_nm: r.info_type_nm?.trim() || null,
          use_yn: normalizeUseYn(r.use_yn),
        }

        await client.query(
          `INSERT INTO meta_table_def_m
             (schema_nm, db_type_nm, entity_nm, table_nm, attribute_nm, column_nm,
              column_ord, pk_yn, data_type_nm, data_len, domain_nm, info_type_nm, use_yn)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (schema_nm, db_type_nm, table_nm, column_nm)
           DO UPDATE SET
             entity_nm = EXCLUDED.entity_nm,
             attribute_nm = EXCLUDED.attribute_nm,
             column_ord = EXCLUDED.column_ord,
             pk_yn = EXCLUDED.pk_yn,
             data_type_nm = EXCLUDED.data_type_nm,
             data_len = EXCLUDED.data_len,
             domain_nm = EXCLUDED.domain_nm,
             info_type_nm = EXCLUDED.info_type_nm,
             use_yn = EXCLUDED.use_yn`,
          [
            values.schema_nm,
            values.db_type_nm,
            values.entity_nm,
            values.table_nm,
            values.attribute_nm,
            values.column_nm,
            values.column_ord,
            values.pk_yn,
            values.data_type_nm,
            values.data_len,
            values.domain_nm,
            values.info_type_nm,
            values.use_yn,
          ],
        )

        await client.query(`RELEASE SAVEPOINT ${savepoint}`)
        success.push({
          row: rowNum,
          table_nm: values.table_nm,
          column_nm: values.column_nm,
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
    const { schema_nm, db_type_nm, table_nm } = req.query
    if (!schema_nm?.trim() || !db_type_nm?.trim() || !table_nm?.trim()) {
      return res.status(400).json({ message: 'schema_nm, db_type_nm, table_nm은 필수입니다.' })
    }

    const { rowCount } = await pool.query(
      `DELETE FROM meta_table_def_m
       WHERE schema_nm = $1 AND db_type_nm = $2 AND table_nm = $3`,
      [schema_nm.trim(), db_type_nm.trim(), table_nm.trim()],
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
      `SELECT ${LIST_COLUMNS} FROM meta_table_def_m WHERE table_def_id = $1`,
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
      schema_nm,
      db_type_nm,
      entity_nm,
      table_nm,
      attribute_nm,
      column_nm,
      column_ord,
      pk_yn,
      data_type_nm,
      data_len,
      domain_nm,
      info_type_nm,
      use_yn,
    } = req.body

    const { rows } = await pool.query(
      `UPDATE meta_table_def_m
       SET schema_nm=$1, db_type_nm=$2, entity_nm=$3, table_nm=$4,
           attribute_nm=$5, column_nm=$6, column_ord=$7, pk_yn=$8,
           data_type_nm=$9, data_len=$10, domain_nm=$11, info_type_nm=$12, use_yn=$13
       WHERE table_def_id=$14
       RETURNING ${LIST_COLUMNS}`,
      [
        schema_nm.trim(),
        db_type_nm.trim(),
        entity_nm.trim(),
        table_nm.trim(),
        attribute_nm.trim(),
        column_nm.trim(),
        Number(column_ord),
        normalizePkYn(pk_yn),
        data_type_nm.trim(),
        data_len?.trim() || null,
        domain_nm?.trim() || null,
        info_type_nm?.trim() || null,
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
      'DELETE FROM meta_table_def_m WHERE table_def_id = $1',
      [req.params.id],
    )
    if (!rowCount) return res.status(404).json({ message: '정의서 항목을 찾을 수 없습니다.' })
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
