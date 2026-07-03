import { api, setAuthToken } from './client'

export async function login(username, password) {
  const data = await api.post('/auth/login', { username, password })
  setAuthToken(data.token)
  return data
}

export async function fetchMe() {
  return api.get('/auth/me')
}

export function logout() {
  setAuthToken(null)
}
