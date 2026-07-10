export const DATA_LENGTH_MAX = 100

export const TYPE_ABBR = {
  VARCHAR: 'VC', CHAR: 'CH', NUMBER: 'NM', INTEGER: 'IN', DATE: 'DT',
  TIMESTAMP: 'TS', BOOLEAN: 'BL', CLOB: 'CL',
}

export const LENGTH_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'INTEGER']
export const SCALE_TYPES  = ['NUMBER', 'INTEGER']

export function mergeLegacyLengthScale(data_len, data_scale, data_type_nm) {
  const dt = data_type_nm?.toUpperCase()
  const lenStr = data_len != null && data_len !== '' ? String(data_len).trim() : ''
  if (!lenStr) return null
  if (lenStr.includes(',')) return lenStr
  if (SCALE_TYPES.includes(dt)) {
    const sc = data_scale !== '' && data_scale != null ? String(data_scale).trim() : '0'
    return `${lenStr},${sc}`
  }
  return lenStr
}

export function normalizeDataLengthInput(value, dataType, data_scale) {
  const dt = dataType?.toUpperCase()

  if (data_scale !== undefined && data_scale !== null && data_scale !== '') {
    const merged = mergeLegacyLengthScale(value, data_scale, dt)
    if (merged) value = merged
  }

  if (value == null || value === '') return ''

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (SCALE_TYPES.includes(dt) && !Number.isInteger(value)) {
      const [prec, sc] = String(value).split('.')
      return `${prec},${sc ?? '0'}`
    }
    if (Number.isInteger(value)) {
      if (SCALE_TYPES.includes(dt)) return `${value},0`
      return value >= 1000 ? value.toLocaleString('en-US') : String(value)
    }
    return String(value)
  }

  let v = String(value).trim()

  if (SCALE_TYPES.includes(dt)) {
    if (/^\d+\.\d+$/.test(v)) {
      const [prec, sc] = v.split('.')
      return `${prec},${sc}`
    }
    if (/^\d+$/.test(v)) return `${v},0`
  }

  return v
}

export function toFormDataLength(row) {
  if (!row) return ''
  const dt  = row.data_type_nm?.toUpperCase()
  const raw = row.data_len
  if (raw != null && String(raw).includes(',')) return String(raw).trim()
  if (SCALE_TYPES.includes(dt) && raw != null && raw !== '') {
    const sc = row.data_scale != null ? row.data_scale : 0
    return `${raw},${sc}`
  }
  if (raw != null && raw !== '') return String(raw)
  return ''
}

export function formatDataLength(value, dataType) {
  const v = toFormDataLength({ data_type_nm: dataType, data_len: value, data_scale: null })
  return v || '-'
}

export function buildInfotype(std_domain_nm, data_type_nm, data_len) {
  const dt   = data_type_nm?.toUpperCase() ?? ''
  const abbr = TYPE_ABBR[dt] ?? dt.slice(0, 2)
  const len  = data_len?.trim?.() ?? String(data_len ?? '').trim()
  return std_domain_nm?.trim() ? `${std_domain_nm.trim()}${abbr}${len}` : ''
}

export function validateDataLength(value, dataType, data_scale) {
  const dt = dataType?.toUpperCase()
  const v  = normalizeDataLengthInput(value, dataType, data_scale)

  if (!LENGTH_TYPES.includes(dt)) return null
  if (!v) return '데이터 길이를 입력하세요.'
  if (v.length > DATA_LENGTH_MAX) {
    return `데이터 길이는 최대 ${DATA_LENGTH_MAX}자까지 입력 가능합니다.`
  }

  if (SCALE_TYPES.includes(dt)) {
    const m = v.match(/^(\d+),(\d+)$/)
    if (!m) return 'NUMBER/INTEGER 타입은 "7,2" 형식(길이,소숫점)으로 입력하세요.'
    const len   = parseInt(m[1], 10)
    const scale = parseInt(m[2], 10)
    if (len < 1) return '데이터 길이(정밀도)는 1 이상이어야 합니다.'
    if (scale < 0) return '소숫점 자릿수는 0 이상이어야 합니다.'
    if (scale >= len) return `소숫점(${scale})은 데이터 길이(${len})보다 작아야 합니다.`
    return null
  }

  const digits = v.replace(/,/g, '')
  if (!/^\d+$/.test(digits)) {
    return '데이터 길이는 숫자 및 천단위 쉼표(,)만 입력 가능합니다. (예: 100, 111,111)'
  }
  if (parseInt(digits, 10) < 1) return '데이터 길이는 1 이상이어야 합니다.'
  return null
}

export function normalizeDataLength(value, dataType, data_scale) {
  const v = normalizeDataLengthInput(value, dataType, data_scale)
  if (!v) return null
  const err = validateDataLength(v, dataType)
  if (err) return null
  return v
}

/** @deprecated normalizeDataLengthInput 사용 */
export function normalizeDataLenValue(value, dataType, data_scale) {
  return normalizeDataLengthInput(value, dataType, data_scale)
}
