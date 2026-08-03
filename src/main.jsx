import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './lib/ThemeContext'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Auto-reload once when a new deploy takes over, so users never end up running
// a stale JS shell that tries to fetch chunks from a previous deployment (404/fetch errors).
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
})

// Safety net: if a dynamically-imported chunk (e.g. jspdf, loaded on-demand for PDFs)
// fails to fetch because it's referencing a file from a previous deploy, reload once
// to pick up the current build instead of showing a raw fetch error to the user.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
