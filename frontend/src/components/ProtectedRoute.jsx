import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function ProtectedRoute() {
  const { isAuthenticated, ready } = useAuth()
  if (!ready) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
