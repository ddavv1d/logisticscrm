import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined=loading, null=anon
  const [reference, setReference] = useState(null)

  useEffect(() => {
    api.get('/auth/me')
      .then(async (u) => {
        setUser(u)
        try {
          setReference(await api.get('/meta/reference'))
        } catch { /* ignore */ }
      })
      .catch(() => setUser(null))
  }, [])

  const login = async (email, password) => {
    const u = await api.post('/auth/login', { email, password })
    setUser(u)
    setReference(await api.get('/meta/reference'))
    return u
  }
  const logout = async () => {
    await api.post('/auth/logout')
    setUser(null)
  }

  return (
    <AuthCtx.Provider value={{ user, reference, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
