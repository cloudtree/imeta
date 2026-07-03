const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const DEFAULT_MODEL = 'gemini-2.5-flash'
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
]

function cleanDefinition(text) {
  return (text || '')
    .replace(/^["'「『]|["'」』]$/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPrompt(term) {
  return [
    '데이터 표준 용어 사전을 작성하고 있습니다.',
    '아래 용어의 간단한 정의만 한 문장으로 작성하세요.',
    '예시, 부가 설명, 번호, 따옴표, 제목 없이 정의 문장만 출력하세요.',
    '',
    `용어: ${term}`,
  ].join('\n')
}

function parseRetryMs(message) {
  const match = String(message || '').match(/retry in ([\d.]+)s/i)
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : 2000
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isQuotaError(status, message) {
  return status === 429 || /quota|limit:\s*0|rate.?limit/i.test(message || '')
}

function isModelUnavailable(status, message) {
  return status === 404 || /not found|deprecated|shut down/i.test(message || '')
}

async function requestDefinition(apiKey, model, term) {
  const url = `${GEMINI_API_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(term) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 200,
        },
      }),
    })
  } catch {
    const err = new Error('Google AI에 연결할 수 없습니다.')
    err.status = 502
    throw err
  }

  if (!res.ok) {
    let message = ''
    try {
      const body = await res.json()
      message = body?.error?.message ?? ''
    } catch {
      // ignore parse errors
    }
    const err = new Error(message || `Google AI 오류 (HTTP ${res.status})`)
    err.status = res.status
    err.quotaExceeded = isQuotaError(res.status, message)
    err.modelUnavailable = isModelUnavailable(res.status, message)
    throw err
  }

  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
  const definition = cleanDefinition(raw)

  if (!definition) {
    const err = new Error(`"${term}"의 정의를 생성할 수 없습니다.`)
    err.status = 404
    throw err
  }

  return { word: term, definition, definitions: [definition], model }
}

/**
 * Google Gemini로 용어의 간단한 정의 생성
 * @returns {{ word: string, definition: string, definitions: string[], model?: string }}
 */
export async function lookupWordDefinition(word) {
  const q = word.trim()
  if (!q) {
    const err = new Error('검색할 단어명을 입력하세요.')
    err.status = 400
    throw err
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim()
  if (!apiKey) {
    const err = new Error('Google AI API 키(GOOGLE_AI_API_KEY)가 설정되지 않았습니다.')
    err.status = 503
    throw err
  }

  const configured = process.env.GOOGLE_AI_MODEL?.trim()
  const models = configured
    ? [configured, ...FALLBACK_MODELS.filter((m) => m !== configured)]
    : [DEFAULT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== DEFAULT_MODEL)]

  let lastError

  for (let i = 0; i < models.length; i++) {
    const model = models[i]
    try {
      return await requestDefinition(apiKey, model, q)
    } catch (err) {
      lastError = err
      const hasNext = i < models.length - 1
      if ((err.quotaExceeded || err.modelUnavailable) && hasNext) continue
      if (err.quotaExceeded && !hasNext) break
      if (err.status === 502 || err.status === 400 || err.status === 503) throw err
      if (hasNext) continue
      break
    }
  }

  if (lastError?.quotaExceeded) {
    await sleep(parseRetryMs(lastError.message))
    try {
      const retryModel = configured || DEFAULT_MODEL
      return await requestDefinition(apiKey, retryModel, q)
    } catch (retryErr) {
      lastError = retryErr
    }
  }

  const err = new Error(
    lastError?.quotaExceeded
      ? 'Google AI 무료 할당량을 사용할 수 없습니다. Google AI Studio에서 API 키와 사용 가능한 모델(gemini-2.5-flash)을 확인하거나 결제 계정을 연결하세요.'
      : `Google AI 오류: ${lastError?.message || '정의를 생성할 수 없습니다.'}`,
  )
  err.status = lastError?.quotaExceeded ? 429 : (lastError?.status ?? 502)
  throw err
}
