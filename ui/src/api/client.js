function resolveApiBaseUrl() {
  const url = import.meta.env.VITE_API_URL?.trim()
  if (!url) return '/api'
  const base = url.replace(/\/$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

const BASE_URL = resolveApiBaseUrl()
const AUTH_TOKEN_KEY = 'meta_auth_token'
const DEFAULT_TIMEOUT_MS = 120_000
const WARMUP_TIMEOUT_MS = 90_000

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token) {
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token)
  else sessionStorage.removeItem(AUTH_TOKEN_KEY)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function request(method, path, body, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  }
  const token = getAuthToken()
  if (token) options.headers.Authorization = `Bearer ${token}`
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, options)
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(
        `API 요청 시간이 초과되었습니다 (${Math.round(timeoutMs / 1000)}초). Render 무료 플랜은 깨어나는 데 30~60초가 걸릴 수 있습니다. 잠시 후 다시 시도하세요.`,
      )
    }
    throw new Error(
      `API 서버에 연결할 수 없습니다. VITE_API_URL(${BASE_URL}) 설정과 백엔드 서버 상태를 확인하세요. (Render cold start 또는 CORS 문제일 수 있습니다)`,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      message = data.message ?? message
    } catch {
      // ignore
    }
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      setAuthToken(null)
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}

/** Render cold start 대비 — 대량 등록 전에 호출 */
export async function warmupApi(maxAttempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await request('GET', '/health', undefined, { timeoutMs: WARMUP_TIMEOUT_MS })
      return
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await sleep(2000)
    }
  }
  throw lastError
}

export const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
}
