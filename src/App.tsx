import { Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import './App.css'

function App() {
  const matchRoute = useMatchRoute()
  const isDashboard = matchRoute({ to: '/' })
  const isReview = matchRoute({ to: '/review' })

  return (
    <main className="app">
      <header className="app__header">
        <p className="app__eyebrow">FocusFlow</p>
        <nav className="app__nav">
          <Link to="/" className={`app__nav-link${isDashboard ? ' app__nav-link--active' : ''}`}>
            Dashboard
          </Link>
          <Link to="/review" className={`app__nav-link${isReview ? ' app__nav-link--active' : ''}`}>
            Revue
          </Link>
        </nav>
      </header>

      <Outlet />
    </main>
  )
}

export default App
