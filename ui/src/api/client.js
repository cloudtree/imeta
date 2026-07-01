const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

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
    throw new Error('API 서버에 연결할 수 없습니다. 백엔드 서버(http://localhost:3000)가 실행 중인지 확인하세요.')
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
