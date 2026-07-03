import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="app-header">
      <div
        className="app-header__logo"
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
        title="메인 페이지로 이동"
      >
        <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="18,38 10,10 36,28" fill="#f4a261" />
          <polygon points="82,38 90,10 64,28" fill="#f4a261" />
          <polygon points="20,36 14,16 34,30" fill="#ffcba4" />
          <polygon points="80,36 86,16 66,30" fill="#ffcba4" />
          <ellipse cx="50" cy="55" rx="36" ry="32" fill="#f4a261" />
          <ellipse cx="37" cy="48" rx="6" ry="7" fill="#2d2d2d" />
          <ellipse cx="63" cy="48" rx="6" ry="7" fill="#2d2d2d" />
          <circle cx="39" cy="46" r="2" fill="white" />
          <circle cx="65" cy="46" r="2" fill="white" />
          <ellipse cx="50" cy="60" rx="3.5" ry="2.5" fill="#e76f51" />
          <path d="M46 63 Q50 68 54 63" fill="none" stroke="#2d2d2d" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="59" x2="40" y2="61" stroke="#2d2d2d" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="10" y1="64" x2="40" y2="64" stroke="#2d2d2d" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="60" y1="61" x2="90" y2="59" stroke="#2d2d2d" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="60" y1="64" x2="90" y2="64" stroke="#2d2d2d" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span>메타데이터 관리 포털</span>
      </div>
      <div className="app-header__actions">
        <span className="app-header__user">{user?.username}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </header>
  )
}
