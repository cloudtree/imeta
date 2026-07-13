import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import RoaringCat from '../../components/auth/RoaringCat'
import { useAuth } from '../../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [formOpen, setFormOpen] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoginId('')
    setPassword('')
    setError('')
    setFormOpen(false)
  }, [])

  useEffect(() => {
    if (!formOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFormOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [formOpen])

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  const openForm = () => {
    setError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setError('')
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
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg__wash" />
        <div className="login-bg__glow login-bg__glow--a" />
        <div className="login-bg__glow login-bg__glow--b" />
        <div className="login-bg__grain" />
      </div>

      <div className="login-page__shell">
        <header className="login-page__topbar">
          <div className="login-page__brand">
            <RoaringCat size={42} className="login-page__brand-mark" />
            <span className="login-page__brand-text">iMETA Portal</span>
          </div>
          <button type="button" className="login-page__signin" onClick={openForm}>
            Sign in
          </button>
        </header>

        <section className="login-page__hero">
          <div className="login-page__emblem-wrap">
            <RoaringCat size={360} className="login-page__emblem" decorative={false} alt="iMETA Portal" />
          </div>

          <h1 className="login-page__wordmark">
            <span className="login-page__wordmark-imeta">iMETA</span>
            <span className="login-page__wordmark-portal">Portal</span>
          </h1>

          <p className="login-page__tagline">
            데이터 표준 · 정의서 · DB 검토를 위한 메타데이터 포털
          </p>

          <button type="button" className="login-page__cta" onClick={openForm}>
            시작하기
          </button>
        </section>
      </div>

      {formOpen && (
        <div className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
          <button
            type="button"
            className="login-modal__backdrop"
            aria-label="로그인 닫기"
            onClick={closeForm}
          />
          <form className="login-card" onSubmit={handleSubmit} autoComplete="off">
            <div className="login-card__glow" aria-hidden />
            <button
              type="button"
              className="login-card__close"
              onClick={closeForm}
              aria-label="닫기"
            >
              ×
            </button>

            <div className="login-card__header">
              <div className="login-card__brand">
                <RoaringCat size={72} className="login-card__logo" />
                <div>
                  <h2 id="login-modal-title" className="login-card__title">Sign in</h2>
                  <p className="login-card__subtitle">iMETA Portal 계정으로 계속하기</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="login-card__error" role="alert">
                {error}
              </div>
            )}

            <label className="login-card__field">
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

            <label className="login-card__field">
              <span>비밀번호</span>
              <input
                type="password"
                name="imeta-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                readOnly
                onFocus={(e) => e.target.removeAttribute('readonly')}
                required
              />
            </label>

            <button className="login-card__submit" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? '로그인 중…' : '계속하기'}
            </button>

            <p className="login-card__footnote">조직 계정으로 안전하게 접속합니다.</p>
          </form>
        </div>
      )}
    </div>
  )
}
