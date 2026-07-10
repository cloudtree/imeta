import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const isSplitContent =
    pathname.startsWith('/words')
    || pathname.startsWith('/terms')
    || pathname.startsWith('/domains')
    || pathname.startsWith('/subject-areas')
    || pathname.startsWith('/users')
    || pathname.startsWith('/data-objects')
    || pathname.startsWith('/database/data-models')
  const isWideContent =
    isSplitContent
    || pathname.startsWith('/servers')
    || pathname.startsWith('/database/table-definition-review')
    || pathname.startsWith('/database/review')

  return (
    <div
      className={[
        'app-shell',
        isHome ? 'app-shell--dash' : '',
        isSplitContent ? 'app-shell--split' : '',
      ].filter(Boolean).join(' ')}
    >
      {isHome && (
        <div className="dash-bg" aria-hidden="true">
          <div className="dash-bg__mesh" />
          <div className="dash-bg__orb dash-bg__orb--a" />
          <div className="dash-bg__orb dash-bg__orb--b" />
          <div className="dash-bg__orb dash-bg__orb--c" />
          <div className="dash-bg__grid" />
          <div className="dash-bg__noise" />
        </div>
      )}
      <Header />
      <main className="app-main">
        <div
          className={[
            'app-content',
            isHome ? 'app-content--dash' : '',
            isWideContent ? 'app-content--wide' : '',
            isSplitContent ? 'app-content--split' : '',
          ].filter(Boolean).join(' ')}
        >
          <Outlet />
        </div>
      </main>
      {!isSplitContent && <Footer />}
    </div>
  )
}
