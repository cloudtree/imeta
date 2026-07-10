/**
 * Map dbSchemaIntrospection rows (old field names) → UI/meta physical names.
 * Introspection API still returns entity_name, table_name, etc.; normalize once at the boundary.
 */
export function mapIntrospectionDefinitionRow(row) {
  if (!row) return row
  return {
    table_def_id: row.table_def_id ?? row.def_id,
    schema_nm: row.schema_nm ?? row.schema_name,
    db_type_nm: row.db_type_nm ?? row.db_type,
    entity_nm: row.entity_nm ?? row.entity_name ?? '',
    table_nm: row.table_nm ?? row.table_name,
    attribute_nm: row.attribute_nm ?? row.attribute_name ?? '',
    column_nm: row.column_nm ?? row.column_name,
    column_ord: row.column_ord ?? row.column_order,
    pk_yn: row.pk_yn,
    data_type_nm: row.data_type_nm ?? row.data_type,
    data_len: row.data_len ?? row.data_length ?? '',
    domain_nm: row.domain_nm ?? row.domain_name ?? '',
    info_type_nm: row.info_type_nm ?? row.infotype ?? '',
    use_yn: row.use_yn ?? 'Y',
  }
}

export function mapIntrospectionDefinitionRows(rows) {
  return (rows || []).map(mapIntrospectionDefinitionRow)
}
