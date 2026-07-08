import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout() {
  const [databaseMenuOpen, setDatabaseMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const isWideContent = pathname.startsWith('/database/table-definition-review')

  return (
    <div className="app-shell">
      <Header
        databaseMenuOpen={databaseMenuOpen}
        onToggleDatabaseMenu={() => setDatabaseMenuOpen((open) => !open)}
      />
      <div className="app-body">
        <Sidebar databaseMenuOpen={databaseMenuOpen} />
        <main className="app-main">
          <div className={`app-content${isWideContent ? ' app-content--wide' : ''}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
