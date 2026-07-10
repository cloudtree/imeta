/** 업계·IT 표준 약어 (1순위) */
const STANDARD_ABBREVS = new Map([
  ['number', 'NO'],
  ['num', 'NO'],
  ['identity', 'ID'],
  ['code', 'CD'],
  ['amount', 'AMT'],
  ['quantity', 'QTY'],
  ['date', 'DT'],
  ['name', 'NM'],
  ['type', 'TP'],
  ['status', 'STS'],
  ['message', 'MSG'],
  ['source', 'SRC'],
  ['manager', 'MNGR'],
  ['database', 'DB'],
  ['account', 'ACNT'],
  ['customer', 'CUST'],
  ['regular', 'REG'],
  ['statistic', 'STAT'],
  ['category', 'CTG'],
  ['address', 'ADDR'],
  ['network', 'NW'],
  ['software', 'SW'],
  ['description', 'DESC'],
  ['total', 'TOT'],
  ['count', 'CNT'],
  ['sequence', 'SEQ'],
  ['serial', 'SER'],
  ['version', 'VER'],
  ['password', 'PWD'],
  ['user', 'USR'],
  ['group', 'GRP'],
  ['class', 'CLS'],
  ['division', 'DIV'],
  ['department', 'DEPT'],
  ['organization', 'ORG'],
  ['system', 'SYS'],
  ['service', 'SVC'],
  ['request', 'REQ'],
  ['response', 'RES'],
  ['register', 'REG'],
  ['registration', 'REG'],
  ['record', 'REC'],
  ['documentation', 'DOC'],
  ['order', 'ORD'],
  ['product', 'PROD'],
  ['price', 'PRC'],
  ['phone', 'PHN'],
  ['email', 'EML'],
  ['flag', 'FLG'],
  ['value', 'VAL'],
  ['key', 'KEY'],
  ['index', 'IDX'],
  ['file', 'FIL'],
  ['image', 'IMG'],
  ['video', 'VID'],
  ['time', 'TM'],
  ['year', 'YR'],
  ['month', 'MTH'],
  ['week', 'WK'],
  ['day', 'DY'],
  ['hour', 'HR'],
  ['minute', 'MIN'],
  ['second', 'SEC'],
  ['barcode', 'BARCD'],
  ['bar', 'BAR'],
])

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U'])
const DEFAULT_ABB_LEN = 4   // 기본 4자리
const MAX_CLARITY_ABB_LEN = 6 // 의미 전달을 위해 허용하는 최대 길이
const MAX_ABB_LEN = 10

function normalizeWord(word) {
  return (word || '').trim().toLowerCase().replace(/[^a-z]/g, '')
}

function toTitleCase(text) {
  return (text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** ① 표준·범용 약어 */
function standardAbbrev(word) {
  const key = normalizeWord(word)
  return key ? STANDARD_ABBREVS.get(key) ?? null : null
}

/** ② 음절 단위 앞 글자 (3~4자) — 짧은 단어·fallback 전용 */
function truncationAbbrev(word) {
  const w = normalizeWord(word).toUpperCase()
  if (!w) return ''
  if (w.length <= 4) return w
  return w.slice(0, 4)
}

/** 영문 단어 음절 수 (모음군 기준) */
function countSyllables(word) {
  const w = normalizeWord(word)
  if (!w) return 0
  const groups = w.match(/[aeiouy]+/g)
  return groups ? groups.length : 1
}

/** ③ 모음 제거 (첫 글자 유지, 연속 동일 자음 1개만) */
function consonantAbbrev(word) {
  const w = normalizeWord(word).toUpperCase()
  if (!w) return ''
  if (w.length <= 2) return w

  let result = w[0]
  for (let i = 1; i < w.length; i++) {
    const ch = w[i]
    if (VOWELS.has(ch)) continue
    if (result[result.length - 1] === ch) continue
    result += ch
  }
  return result.slice(0, MAX_ABB_LEN)
}

/**
 * 4자리 기본, 의미 훼손 방지를 위해 예외 길이 허용
 * - 2~3자: 표준·짧은 결과 그대로
 * - 4자: 기본
 * - 5~6자: 다음 음절·장단어 등 의미 구분이 필요할 때
 */
function finalizeAbbrev(cons, word) {
  if (!cons) return ''

  if (cons.length <= DEFAULT_ABB_LEN) return cons

  const base4 = cons.slice(0, DEFAULT_ABB_LEN)
  const syllables = countSyllables(word)
  const wordLen = normalizeWord(word).length

  if (cons.length <= MAX_CLARITY_ABB_LEN) {
    // 3음절 이상 또는 7자 이상 장단어 → 5~6자 허용
    if (syllables >= 3 || wordLen >= 7) {
      return cons.slice(0, MAX_CLARITY_ABB_LEN)
    }
  }

  return base4
}

/** 단일 영문 단어 → 약어 (① 표준/예외 → ③ 모음제거+4자 기본 → ② fallback) */
export function abbreviateWord(word) {
  const std = standardAbbrev(word)
  if (std) return std.slice(0, MAX_ABB_LEN)

  const w = normalizeWord(word).toUpperCase()
  if (!w) return ''

  // 4자 이하 원어는 그대로 (예: CODE, NAME)
  if (w.length <= DEFAULT_ABB_LEN) return w

  const cons = consonantAbbrev(word)
  if (cons) return finalizeAbbrev(cons, word)

  return truncationAbbrev(word).slice(0, DEFAULT_ABB_LEN)
}

/** ④ 복합어: 각 단어 약어를 붙여 결합 (_ 사용 금지) */
export function abbreviateEnglishName(fullName) {
  const words = (fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return ''

  // 붙여쓴 단일어(barcode 등)는 표준 약어 우선
  if (words.length === 1) return abbreviateWord(words[0])

  const joinedKey = words.map((w) => normalizeWord(w)).join('')
  const joinedStd = STANDARD_ABBREVS.get(joinedKey)
  if (joinedStd) return joinedStd.slice(0, MAX_ABB_LEN)

  const parts = words.map((w) => {
    const std = standardAbbrev(w)
    if (std) return std
    const short = normalizeWord(w)
    if (short.length <= 2) return short.toUpperCase()
    return abbreviateWord(w)
  })

  let combined = parts.join('')
  if (combined.length <= MAX_ABB_LEN) return combined

  // 길이 초과 시 각 단어 첫 글자 조합
  combined = parts.map((p) => p[0]).join('')
  return combined.slice(0, MAX_ABB_LEN)
}

/** 단수형이지만 s로 끝나는 영문 (복수형으로 보지 않음) */
const SINGULAR_ENDING_S = new Set([
  'address', 'business', 'status', 'analysis', 'basis', 'crisis', 'diagnosis',
  'campus', 'class', 'cross', 'news', 'series', 'species', 'means', 'physics',
  'mathematics', 'economics', 'athletics', 'graphics', 'bonus', 'bus', 'gas',
  'plus', 'alias', 'canvas', 'census', 'focus', 'virus', 'access', 'process',
  'success', 'progress', 'express', 'congress', 'compass', 'surplus', 'always',
  'across', 'various', 'previous', 'serious', 'famous', 'dangerous',
])

/** 약어 예외 — s로 끝나지만 복수형 약어가 아님 */
const ABB_ENDING_S_OK = new Set([
  'STS', 'BUS', 'CLASS', 'ACCESS', 'NEWS', 'BASIS', 'STATUS', 'CROSS', 'PLUS',
  'GAS', 'AS', 'IS', 'OS', 'CMS', 'POS', 'CDS',
])

function toSingularToken(word) {
  let w = (word || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return w
  if (SINGULAR_ENDING_S.has(w)) return w
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`
  if (w.endsWith('sses') && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is') || w.endsWith('ous')) return w
  if (w.endsWith('s') && w.length > 3) return w.slice(0, -1)
  return w
}

/** 영문 토큰이 복수형(~s / ~ies)인지 */
export function isPluralEnglishToken(token) {
  const raw = (token || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!raw || raw.length <= 3) return false
  if (SINGULAR_ENDING_S.has(raw)) return false
  if (raw.endsWith('ss') || raw.endsWith('us') || raw.endsWith('is') || raw.endsWith('ous')) return false
  if (raw.endsWith('ies') && raw.length > 4) return true
  if (raw.endsWith('s')) return true
  return false
}

/** 영문명(전체)에서 복수형 단어 목록 */
export function findPluralEnglishWords(raw) {
  const cleaned = (raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []
  return cleaned
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((w) => isPluralEnglishToken(w))
}

/**
 * 영문명·약어 복수형 검증
 * @returns {string|null} 오류 메시지
 */
export function validateNoPluralEnglish({ full_eng_nm, all_word_nm, abb_word_nm } = {}) {
  const plurals = findPluralEnglishWords(full_eng_nm || all_word_nm)
  if (plurals.length) {
    return `영문명은 단수형만 사용할 수 있습니다. 복수형(~s) 불가: ${plurals.join(', ')}`
  }
  const abb = String(abb_word_nm || '').trim().toUpperCase()
  if (abb && abb.endsWith('S') && abb.length >= 4 && !ABB_ENDING_S_OK.has(abb)) {
    const stem = abb.slice(0, -1)
    // DTLS → DTL 처럼 어간이 3자 이상 알파벳이면 복수형 약어로 간주
    if (/^[A-Z]+$/.test(stem) && stem.length >= 3) {
      return `영문약어에 복수형(~S)을 사용할 수 없습니다. (예: ${abb} → ${stem})`
    }
  }
  return null
}

/** 영문 Full Name 정규화 (Title Case, 단수형) */
export function normalizeEnglishFullName(raw) {
  const cleaned = (raw || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const words = cleaned.split(' ').map((w) => toSingularToken(w))
  return toTitleCase(words.join(' '))
}

export function buildEnglishSuggestion(primaryEnglish) {
  const full_eng_nm = normalizeEnglishFullName(primaryEnglish)
  const abb_word_nm = abbreviateEnglishName(full_eng_nm)
  return { full_eng_nm, abb_word_nm }
}
