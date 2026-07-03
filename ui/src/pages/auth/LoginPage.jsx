import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__brand">
          <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="18,38 10,10 36,28" fill="#f4a261" />
            <polygon points="82,38 90,10 64,28" fill="#f4a261" />
            <ellipse cx="50" cy="55" rx="36" ry="32" fill="#f4a261" />
            <ellipse cx="37" cy="48" rx="6" ry="7" fill="#2d2d2d" />
            <ellipse cx="63" cy="48" rx="6" ry="7" fill="#2d2d2d" />
          </svg>
          <div>
            <h1>메타데이터 관리 포털</h1>
            <p>로그인 후 기능을 사용할 수 있습니다.</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <label className="form-field">
          <span>사용자명</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="form-field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button className="btn btn-primary login-card__submit" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : null}
          로그인
        </button>
      </form>
    </div>
  )
}
