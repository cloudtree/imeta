import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth'
import { getAuthToken } from '../api/client'

const AuthContext = createContext(null)

function normalizeUser(data) {
  if (!data?.login_id) return null
  return {
    login_id: data.login_id,
    role_cd: data.role_cd === 'ADMIN' ? 'ADMIN' : 'USER',
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const me = await fetchMe()
      setUser(normalizeUser(me))
    } catch {
      apiLogout()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (login_id, password) => {
    const data = await apiLogin(login_id, password)
    setUser(normalizeUser(data))
    return data
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.role_cd === 'ADMIN',
    login,
    logout,
  }), [user, loading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
