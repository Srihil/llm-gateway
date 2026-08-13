import { createContext, useContext, useState, useEffect } from "react"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem("gw_token")
    const savedUser = localStorage.getItem("gw_user")
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem("gw_token")
        localStorage.removeItem("gw_user")
      }
    }
    setReady(true)
  }, [])

  function login(data) {
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem("gw_token", data.token)
    localStorage.setItem("gw_user", JSON.stringify(data.user))
  }

  function logout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem("gw_token")
    localStorage.removeItem("gw_user")
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, ready }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
