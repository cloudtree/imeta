import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import LoginConsultingSlide from '../../components/auth/LoginConsultingSlide'
import { useAuth } from '../../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoginId('')
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
      await login(loginId.trim(), password)
      setLoginId('')
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
      <section className="login-page__briefing" aria-labelledby="login-intro-title">
        <div className="login-page__briefing-panel">
          <LoginConsultingSlide animate />
        </div>
      </section>

      <aside className="login-page__login" role="complementary" aria-labelledby="login-dialog-title">
        <div className="login-page__login-card">
          <h2 id="login-dialog-title" className="login-page__login-title">
            로그인
          </h2>

          <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
            {error && (
              <div className="login-form__error" role="alert">
                {error}
              </div>
            )}

            <label className="login-form__field">
              <span>로그인ID</span>
              <input
                type="text"
                name="imeta-login-id"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="로그인ID"
                autoComplete="off"
                autoFocus
                readOnly
                onFocus={(e) => e.target.removeAttribute('readonly')}
                required
              />
            </label>

            <label className="login-form__field">
              <span>비밀번호</span>
              <input
                type="password"
                name="imeta-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                readOnly
                onFocus={(e) => e.target.removeAttribute('readonly')}
                required
              />
            </label>

            <button className="login-form__submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? '로그인 중…' : '로그인'}
            </button>
          </form>
        </div>
      </aside>
    </div>
  )
}
