import { queryRows } from './oracleClient.js'

function formatOracleDataLength(row) {
  if (row.DATA_TYPE === 'NUMBER') {
    if (row.DATA_PRECISION != null) {
      return row.DATA_SCALE ? `${row.DATA_PRECISION},${row.DATA_SCALE}` : String(row.DATA_PRECISION)
    }
    return ''
  }
  if (['VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR'].includes(row.DATA_TYPE)) {
    return String(row.CHAR_LENGTH ?? row.DATA_LENGTH ?? '')
  }
  return ''
}

/**
 * 접속 사용자 스키마(USER_*)의 테이블/컬럼을 테이블정의서 행 형식으로 반환.
 * 엔티티명 = 테이블 코멘트, 속성명 = 컬럼 코멘트 (dbSchemaIntrospection.js의 Postgres 버전과 동일한 출력 shape)
 */
export async function fetchOracleSchemaDefinitionRows(connection) {
  const rows = await queryRows(
    connection,
    `SELECT
       utc.table_name        AS table_name,
       utc.column_name       AS column_name,
       utc.data_type         AS data_type,
       utc.data_length       AS data_length,
       utc.char_length       AS char_length,
       utc.data_precision    AS data_precision,
       utc.data_scale        AS data_scale,
       utc.column_id         AS column_order,
       ucc.comments          AS column_comment,
       tc.comments           AS table_comment,
       CASE WHEN pk.column_name IS NOT NULL THEN 'Y' ELSE 'N' END AS pk_yn
     FROM user_tab_columns utc
     JOIN user_tables ut
       ON ut.table_name = utc.table_name
     LEFT JOIN user_tab_comments tc
       ON tc.table_name = utc.table_name AND tc.table_type = 'TABLE'
     LEFT JOIN user_col_comments ucc
       ON ucc.table_name = utc.table_name AND ucc.column_name = utc.column_name
     LEFT JOIN (
       SELECT ucc2.table_name, ucc2.column_name
       FROM user_cons_columns ucc2
       JOIN user_constraints uc2
         ON uc2.constraint_name = ucc2.constraint_name
        AND uc2.table_name = ucc2.table_name
       WHERE uc2.constraint_type = 'P'
     ) pk
       ON pk.table_name = utc.table_name AND pk.column_name = utc.column_name
     ORDER BY utc.table_name, utc.column_id`,
  )

  return rows.map((row) => ({
    def_id: `${row.TABLE_NAME}.${row.COLUMN_NAME}`,
    schema_name: '',
    db_type: 'Oracle',
    entity_name: (row.TABLE_COMMENT || '').trim(),
    table_name: row.TABLE_NAME,
    attribute_name: (row.COLUMN_COMMENT || '').trim(),
    column_name: row.COLUMN_NAME,
    column_order: row.COLUMN_ORDER,
    pk_yn: row.PK_YN,
    data_type: row.DATA_TYPE,
    data_length: formatOracleDataLength(row),
    domain_name: '',
    infotype: '',
  }))
}
