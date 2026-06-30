import { NavLink } from 'react-router-dom'

const sections = [
  {
    label: '데이터 모델',
    items: [
      {
        to: '/subject-areas',
        label: '주제영역',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3h7v7H3z" /><path d="M14 3h7v7h-7z" /><path d="M14 14h7v7h-7z" /><path d="M3 14h7v7H3z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: '데이터 표준',
    items: [
      {
        to: '/words',
        label: '표준 단어',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
          </svg>
        ),
      },
      {
        to: '/terms',
        label: '표준 용어',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
      {
        to: '/domains',
        label: '표준 도메인',
        icon: (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        ),
      },
    ],
  },
]

export default function Sidebar() {
  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__nav">
        {sections.map(({ label, items }) => (
          <div key={label}>
            <p className="app-sidebar__section-label">{label}</p>
            {items.map(({ to, label: itemLabel, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `app-sidebar__link${isActive ? ' app-sidebar__link--active' : ''}`
                }
              >
                {icon}
                <span>{itemLabel}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
