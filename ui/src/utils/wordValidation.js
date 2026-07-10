/** 단수형이지만 s로 끝나는 영문 */
const SINGULAR_ENDING_S = new Set([
  'address', 'business', 'status', 'analysis', 'basis', 'crisis', 'diagnosis',
  'campus', 'class', 'cross', 'news', 'series', 'species', 'means', 'physics',
  'mathematics', 'economics', 'athletics', 'graphics', 'bonus', 'bus', 'gas',
  'plus', 'alias', 'canvas', 'census', 'focus', 'virus', 'access', 'process',
  'success', 'progress', 'express', 'congress', 'compass', 'surplus',
])

const ABB_ENDING_S_OK = new Set([
  'STS', 'BUS', 'CLASS', 'ACCESS', 'NEWS', 'BASIS', 'STATUS', 'CROSS', 'PLUS',
  'GAS', 'AS', 'IS', 'OS', 'CMS', 'POS', 'CDS',
])

function isPluralEnglishToken(token) {
  const raw = (token || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!raw || raw.length <= 3) return false
  if (SINGULAR_ENDING_S.has(raw)) return false
  if (raw.endsWith('ss') || raw.endsWith('us') || raw.endsWith('is') || raw.endsWith('ous')) return false
  if (raw.endsWith('ies') && raw.length > 4) return true
  if (raw.endsWith('s')) return true
  return false
}

/** @returns {string|null} */
export function validateNoPluralEnglish({ full_eng_nm, abb_word_nm } = {}) {
  const cleaned = (full_eng_nm || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const plurals = cleaned
    ? cleaned.split(/[\s-]+/).filter(Boolean).filter((w) => isPluralEnglishToken(w))
    : []
  if (plurals.length) {
    return `영문명은 단수형만 사용할 수 있습니다. 복수형(~s) 불가: ${plurals.join(', ')}`
  }
  const abb = String(abb_word_nm || '').trim().toUpperCase()
  if (abb && abb.endsWith('S') && abb.length >= 4 && !ABB_ENDING_S_OK.has(abb)) {
    const stem = abb.slice(0, -1)
    if (/^[A-Z]+$/.test(stem) && stem.length >= 3) {
      return `영문약어에 복수형(~S)을 사용할 수 없습니다. (예: ${abb} → ${stem})`
    }
  }
  return null
}
