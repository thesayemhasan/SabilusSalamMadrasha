import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { SiteProvider, AuthProvider } from './lib/store'
import { ConfirmProvider } from './components/Ui'
import './styles.css'

// HashRouter: GitHub Pages ও cPanel, দুই জায়গাতেই রিফ্রেশে পেইজ নষ্ট হয় না
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <SiteProvider>
        <AuthProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </AuthProvider>
      </SiteProvider>
    </HashRouter>
  </React.StrictMode>
)
