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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUsername('')
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
      <div className="login-bg" aria-hidden="true">
        <div className="login-bg__mesh" />
        <div className="login-bg__orb login-bg__orb--a" />
        <div className="login-bg__orb login-bg__orb--b" />
        <div className="login-bg__orb login-bg__orb--c" />
        <div className="login-bg__grid" />
        <div className="login-bg__noise" />
      </div>

      <div className="login-page__shell">
        <header className="login-page__topbar">
          <div className="login-page__brand">
            <RoaringCat size={36} idPrefix="login-brand-cat" animated={false} />
            <span>Meta Portal</span>
          </div>
        </header>

        <section className="login-page__hero">
          <p className="login-page__tag">Metadata Management</p>
          <h1 className="login-page__logo">표준과 스키마를<br />한곳에서.</h1>
          <p className="login-page__desc">
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
                <RoaringCat size={40} idPrefix="login-cat" />
                <div>
                  <h2 id="login-modal-title" className="login-card__title">Sign in</h2>
                  <p className="login-card__subtitle">계정으로 계속하기</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="login-card__error" role="alert">
                {error}
              </div>
            )}

            <label className="login-card__field">
              <span>사용자 이름</span>
              <input
                type="text"
                name="imeta-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
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
