import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LogProvider } from './context/LogContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LogProvider>
      <App />
    </LogProvider>
  </StrictMode>,
)
