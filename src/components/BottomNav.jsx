import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTheme } from '../lib/ThemeContext'

const tabs = [
  { path: '/',         label: 'Home',     icon: '⊞' },
  { path: '/invoices', label: 'Invoices', icon: '📄' },
  { path: '/payments', label: 'Payments', icon: '💳' },
  { path: '/reports',  label: 'Reports',  icon: '📊' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTheme()

  return (
    <nav style={{ ...s.nav, background: t.surface, borderTop: `1px solid ${t.border}` }}>
      {tabs.map(tab => {
        const active = pathname === tab.path
        return (
          <button key={tab.path} style={s.tab} onClick={() => navigate(tab.path)}>
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            <span style={{ ...s.label, color: active ? t.orange : t.textMuted, fontWeight: active ? 700 : 500 }}>
              {tab.label}
            </span>
            {active && <div style={{ ...s.dot, background: t.orange }} />}
          </button>
        )
      })}
    </nav>
  )
}

const s = {
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' },
  tab: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px 6px', background: 'none', border: 'none', cursor: 'pointer', position: 'relative', gap: 2 },
  label: { fontSize: 10, letterSpacing: 0.3 },
  dot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
}
