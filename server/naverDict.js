import { buildEnglishSuggestion } from './wordAbbrev.js'

const NAVER_EN_DICT_SEARCH_URL = 'https://en.dict.naver.com/api3/koen/search'

// 폐쇄망 등 외부 인터넷 접근이 없는 환경에서는 NAVER_DICT_ENABLED=false 로 설정해
// 네이버 사전 호출을 시도하지 않고 조용히 건너뛴다.
const NAVER_DICT_ENABLED = (process.env.NAVER_DICT_ENABLED ?? 'true').trim().toLowerCase() !== 'false'

function stripHtml(text) {
  return (text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeEntryName(item) {
  return stripHtml(item?.handleEntry || item?.expEntry || '')
}

function pickItem(items, query) {
  if (!items?.length) return null

  const exactName = items.find(
    (item) => item.matchType === 'exact:entry' && normalizeEntryName(item) === query,
  )
  if (exactName) return exactName

  const exactEntry = items.find((item) => item.matchType === 'exact:entry')
  return exactEntry ?? items[0]
}

function extractEnglishTerms(meanValue) {
  const text = stripHtml(meanValue).replace(/\([^)]*\)/g, ' ')
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^[a-zA-Z][a-zA-Z\s-]*$/.test(t))
}

function collectEnglishTerms(item) {
  const terms = []
  for (const collector of item?.meansCollector ?? []) {
    for (const mean of collector.means ?? []) {
      for (const term of extractEnglishTerms(mean.value)) {
        if (!terms.includes(term)) terms.push(term)
      }
    }
  }
  return terms
}

async function fetchNaverDict(url, referer) {
  let res
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 (compatible; META/1.0)',
      },
    })
  } catch {
    const err = new Error('네이버 사전에 연결할 수 없습니다.')
    err.status = 502
    throw err
  }

  if (!res.ok) {
    const err = new Error(`네이버 사전 오류 (HTTP ${res.status})`)
    err.status = 502
    throw err
  }

  return res.json()
}

/**
 * 네이버 영어사전(ko→en)에서 영문명·약어 제안
 * @returns {{ word: string, full_eng_nm: string, abb_word_nm: string, englishTerms: string[] }}
 */
export async function lookupNaverEnglishDictionary(word) {
  const q = word.trim()
  if (!q) {
    const err = new Error('검색할 단어명을 입력하세요.')
    err.status = 400
    throw err
  }
  if (!NAVER_DICT_ENABLED) return null

  const url = new URL(NAVER_EN_DICT_SEARCH_URL)
  url.searchParams.set('query', q)
  url.searchParams.set('m', 'pc')

  const data = await fetchNaverDict(url, 'https://en.dict.naver.com/')
  const items = data?.searchResultMap?.searchResultListMap?.WORD?.items ?? []

  if (!items.length) {
    const err = new Error(`"${q}"에 대한 영어 번역을 찾을 수 없습니다.`)
    err.status = 404
    throw err
  }

  const item = pickItem(items, q)
  const englishTerms = collectEnglishTerms(item)

  if (englishTerms.length === 0) {
    const err = new Error(`"${q}"의 영문명을 가져올 수 없습니다.`)
    err.status = 404
    throw err
  }

  const { full_eng_nm, abb_word_nm } = buildEnglishSuggestion(englishTerms[0])

  return {
    word: normalizeEntryName(item) || q,
    full_eng_nm,
    abb_word_nm,
    englishTerms,
  }
}
