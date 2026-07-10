import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import RoaringCat from '../auth/RoaringCat'
import { useAuth } from '../../context/AuthContext'

const NAV_MENUS = [
  {
    id: 'model',
    label: '데이터 모델',
    items: [
      { to: '/subject-areas', label: '주제영역', desc: '주제영역 등록 및 관리' },
    ],
  },
  {
    id: 'standard',
    label: '데이터 표준',
    items: [
      { to: '/words', label: '표준 단어', desc: '공통 어휘 정의' },
      { to: '/terms', label: '표준 용어', desc: '업무 용어 표준화' },
      { to: '/domains', label: '표준 도메인', desc: '데이터 타입과 규칙' },
    ],
  },
  {
    id: 'database',
    label: '데이터베이스',
    items: [
      { to: '/servers/register', label: '서버등록', desc: 'DB 서버 연결 정보' },
      { to: '/database/review', label: '데이터베이스검토', desc: '스키마와 표준 비교' },
      {
        to: '/database/table-definition-review',
        label: '테이블정의서검토',
        desc: '정의서 표준 검토',
      },
    ],
  },
  {
    id: 'imeta',
    label: 'iMeta관리',
    adminOnly: true,
    items: [
      { to: '/users', label: '사용자 관리', desc: '계정 등록·수정·삭제' },
    ],
  },
]

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  )
}

function isMenuActive(items, pathname) {
  return items.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`))
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileExpanded, setMobileExpanded] = useState(null)
  const navRef = useRef(null)
  const closeTimerRef = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout, isAdmin } = useAuth()

  const menus = NAV_MENUS.filter((menu) => !menu.adminOnly || isAdmin)

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openFlyout = (id) => {
    clearCloseTimer()
    setOpenMenu(id)
  }

  const scheduleCloseFlyout = () => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setOpenMenu(null)
      closeTimerRef.current = null
    }, 120)
  }

  const closeFlyout = () => {
    clearCloseTimer()
    setOpenMenu(null)
  }

  useEffect(() => {
    closeFlyout()
    setMobileOpen(false)
    setMobileExpanded(null)
  }, [pathname])

  useEffect(() => () => clearCloseTimer(), [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!openMenu) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeFlyout()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openMenu])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const activeMenu = menus.find((menu) => menu.id === openMenu)
  const flyoutOpen = !!activeMenu

  return (
    <>
      <div
        className={`apple-nav-backdrop${flyoutOpen ? ' apple-nav-backdrop--open' : ''}`}
        onMouseEnter={scheduleCloseFlyout}
        aria-hidden={!flyoutOpen}
      />

      <header
        ref={navRef}
        className={`apple-nav-shell${flyoutOpen ? ' apple-nav-shell--open' : ''}`}
        onMouseLeave={scheduleCloseFlyout}
      >
        <nav className="apple-nav apple-nav--desktop" aria-label="주요 메뉴">
          <ul className="apple-nav__list">
            <li onMouseEnter={closeFlyout}>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `apple-nav__brand${isActive && !openMenu ? ' apple-nav__brand--active' : ''}`
                }
                title="메타데이터 현황"
                aria-label="메타데이터 현황"
              >
                <RoaringCat size={22} idPrefix="nav-cat" animated={false} />
                <span className="apple-nav__brand-text">Meta</span>
              </NavLink>
            </li>
            {menus.map((menu) => {
              const active = isMenuActive(menu.items, pathname)
              const expanded = openMenu === menu.id
              return (
                <li key={menu.id} onMouseEnter={() => openFlyout(menu.id)}>
                  <button
                    type="button"
                    className={`apple-nav__link apple-nav__trigger${
                      active || expanded ? ' apple-nav__link--active' : ''
                    }`}
                    aria-expanded={expanded}
                    aria-controls={`apple-flyout-${menu.id}`}
                    onFocus={() => openFlyout(menu.id)}
                    onClick={(e) => e.preventDefault()}
                  >
                    {menu.label}
                  </button>
                </li>
              )
            })}
            <li className="apple-nav__spacer" aria-hidden onMouseEnter={closeFlyout} />
            <li onMouseEnter={closeFlyout}>
              <button type="button" className="apple-nav__icon-btn" aria-label="검색" title="검색">
                <SearchIcon />
              </button>
            </li>
            <li className="apple-nav__account" onMouseEnter={closeFlyout}>
              <span className="apple-nav__user">{user?.username || ''}</span>
              <button
                type="button"
                className="apple-nav__logout"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </li>
          </ul>
        </nav>

        <div
          className={`apple-flyout${flyoutOpen ? ' apple-flyout--open' : ''}`}
          id={activeMenu ? `apple-flyout-${activeMenu.id}` : undefined}
          aria-hidden={!flyoutOpen}
          onMouseEnter={clearCloseTimer}
        >
          <div className="apple-flyout__inner">
            {menus.map((menu) => (
              <div
                key={menu.id}
                className={`apple-flyout__panel${openMenu === menu.id ? ' is-active' : ''}`}
              >
                <p className="apple-flyout__eyebrow">{menu.label}</p>
                <ul className="apple-flyout__list">
                  {menu.items.map((item, index) => (
                    <li
                      key={item.to}
                      style={{ animationDelay: `${80 + index * 40}ms` }}
                      className="apple-flyout__item"
                    >
                      <Link
                        to={item.to}
                        className="apple-flyout__link"
                        tabIndex={openMenu === menu.id ? 0 : -1}
                        onClick={closeFlyout}
                      >
                        <span className="apple-flyout__link-label">{item.label}</span>
                        <span className="apple-flyout__link-desc">{item.desc}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </header>

      {!mobileOpen && (
        <nav className="apple-nav apple-nav--mobile-bar" aria-label="모바일 메뉴">
          <button
            type="button"
            className="apple-nav__menu-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
          >
            =
          </button>
          <NavLink
            to="/"
            end
            className="apple-nav__brand"
            title="메타데이터 현황"
            aria-label="메타데이터 현황"
            onClick={() => setMobileOpen(false)}
          >
            <RoaringCat size={22} idPrefix="nav-cat-mobile" animated={false} />
          </NavLink>
          <span className="apple-nav__user">{user?.username || ''}</span>
        </nav>
      )}

      {mobileOpen && (
        <nav className="apple-nav apple-nav--mobile-panel" aria-label="모바일 전체 메뉴">
          <div className="apple-nav__mobile-top">
            <button
              type="button"
              className="apple-nav__menu-toggle"
              onClick={() => setMobileOpen(false)}
              aria-label="메뉴 닫기"
            >
              ×
            </button>
            <NavLink
              to="/"
              end
              className="apple-nav__brand apple-nav__brand--center"
              title="메타데이터 현황"
              aria-label="메타데이터 현황"
              onClick={() => setMobileOpen(false)}
            >
              <RoaringCat size={24} idPrefix="nav-cat-panel" animated={false} />
            </NavLink>
          </div>
          <input
            type="search"
            className="apple-nav__search"
            placeholder="Meta Portal 검색"
            aria-label="검색"
          />
          <hr className="apple-nav__divider" />
          <ul className="apple-nav__mobile-list">
            {menus.map((menu) => {
              const expanded = mobileExpanded === menu.id
              return (
                <li key={menu.id} className="apple-nav__mobile-group">
                  <button
                    type="button"
                    className={`apple-nav__mobile-trigger${expanded ? ' is-open' : ''}`}
                    aria-expanded={expanded}
                    onClick={() =>
                      setMobileExpanded((current) => (current === menu.id ? null : menu.id))
                    }
                  >
                    <span>{menu.label}</span>
                    <span className="apple-nav__chevron" aria-hidden>
                      {expanded ? '−' : '+'}
                    </span>
                  </button>
                  <div className={`apple-nav__mobile-sub${expanded ? ' is-open' : ''}`}>
                    <ul>
                      {menu.items.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              `apple-nav__mobile-sublink${isActive ? ' apple-nav__link--active' : ''}`
                            }
                            onClick={() => setMobileOpen(false)}
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              )
            })}
            <li>
              <button type="button" className="apple-nav__mobile-logout" onClick={handleLogout}>
                로그아웃
              </button>
            </li>
          </ul>
        </nav>
      )}
    </>
  )
}
