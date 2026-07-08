import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoginAsciiBackground from '../../components/auth/LoginAsciiBackground'
import RoaringCat from '../../components/auth/RoaringCat'
import { useAuth } from '../../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUsername('')
    setPassword('')
    setError('')
  }, [])

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username.trim(), password)
      setUsername('')
      setPassword('')
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <LoginAsciiBackground />

      <div className="login-page__layout">
        <section className="login-page__hero">
          <p className="login-page__tag">metadata management portal</p>
          <h1 className="login-page__logo">imeta</h1>
          <p className="login-page__desc">표준 단어 · 용어 · 도메인을 한곳에서 관리합니다.</p>
        </section>

        <form className="login-terminal" onSubmit={handleSubmit} autoComplete="off">
          <div className="login-terminal__header">
            <div className="login-page__title-row">
              <RoaringCat size={40} />
              <h2>login</h2>
            </div>
            <p>enter credentials to continue</p>
          </div>

          {error && <div className="login-terminal__error">{error}</div>}

          <label className="login-terminal__field">
            <span>username</span>
            <input
              type="text"
              name="imeta-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              required
            />
          </label>

          <label className="login-terminal__field">
            <span>password</span>
            <input
              type="password"
              name="imeta-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              readOnly
              onFocus={(e) => e.target.removeAttribute('readonly')}
              required
            />
          </label>

          <button className="login-terminal__submit" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            sign in →
          </button>
        </form>
      </div>
    </div>
  )
}
