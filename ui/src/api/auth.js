import { api, setAuthToken } from './client'

export async function login(login_id, password) {
  const data = await api.post('/auth/login', { login_id, password })
  setAuthToken(data.token)
  return data
}

export async function fetchMe() {
  return api.get('/auth/me')
}

export function logout() {
  setAuthToken(null)
}
