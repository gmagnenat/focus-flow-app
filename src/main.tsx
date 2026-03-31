import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { LogProvider } from './context/LogContext'
import App from './App'
import { Dashboard } from './pages/Dashboard'
import { Review } from './pages/Review'
import { History } from './pages/History'
import './index.css'

const queryClient = new QueryClient()

const rootRoute = createRootRoute({ component: App })
const dashboardRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard })
const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: '/review', component: Review })
const historyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/history', component: History })

const routeTree = rootRoute.addChildren([dashboardRoute, reviewRoute, historyRoute])
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LogProvider>
        <RouterProvider router={router} />
      </LogProvider>
    </QueryClientProvider>
  </StrictMode>,
)
