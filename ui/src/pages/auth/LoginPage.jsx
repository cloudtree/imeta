import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import RoaringCat from '../../components/auth/RoaringCat'
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
        <div className="login-page__brand">
          <h1>메타데이터 관리 포털</h1>
          <p>표준 단어·용어·도메인을 한곳에서 관리하세요.</p>
        </div>

        <div className="login-card__header">
          <div className="login-card__title-row">
            <RoaringCat size={44} />
            <h2>로그인</h2>
          </div>
          <p>계정 정보를 입력하세요.</p>
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
