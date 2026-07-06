import { Navigate, Outlet, useLocation } from 'react-router-dom'
import LoginAsciiBackground from './LoginAsciiBackground'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="login-page">
        <LoginAsciiBackground />
        <div className="login-page__layout">
          <div className="login-card">
            <span className="spinner" />
            <p>checking session...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
