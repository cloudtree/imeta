function resolveApiBaseUrl() {
  const url = import.meta.env.VITE_API_URL?.trim()
  if (!url) return '/api'
  const base = url.replace(/\/$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

const BASE_URL = resolveApiBaseUrl()

async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, options)
  } catch {
    throw new Error(
      `API 서버에 연결할 수 없습니다. VITE_API_URL(${BASE_URL}) 설정과 백엔드 서버 상태를 확인하세요.`,
    )
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      message = data.message ?? message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
}
