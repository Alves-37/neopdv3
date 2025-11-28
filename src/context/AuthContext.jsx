import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

const SERVICE_USER = import.meta.env.VITE_PDV_SERVICE_USER
const SERVICE_PASS = import.meta.env.VITE_PDV_SERVICE_PASS

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || null)
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (token) localStorage.setItem('access_token', token)
    else localStorage.removeItem('access_token')
  }, [token])

  useEffect(() => {
    if (user) localStorage.setItem('user', JSON.stringify(user))
    else localStorage.removeItem('user')
  }, [user])

  async function login(usuario, senha) {
    setLoading(true)
    setError(null)
    try {
      const data = await api.login(usuario, senha)
      // Backend padrão FastAPI: retorna access_token e token_type
      const access = data?.access_token || data?.access || data?.token
      if (!access) throw new Error('Falha ao autenticar')
      setToken(access)
      // opcional: data.user
      setUser(data?.user || { usuario })
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setLoading(false)
    }
  }

  // Login automático invisível usando usuário técnico definido no .env
  async function autoLogin() {
    if (token) return true
    if (!SERVICE_USER || !SERVICE_PASS) return false

    try {
      const data = await api.login(SERVICE_USER, SERVICE_PASS)
      const access = data?.access_token || data?.access || data?.token
      if (!access) return false
      setToken(access)
      setUser(data?.user || { usuario: SERVICE_USER })
      return true
    } catch {
      return false
    }
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ token, user, loading, error, login, autoLogin, logout, isAuthenticated: !!token }),
    [token, user, loading, error],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
