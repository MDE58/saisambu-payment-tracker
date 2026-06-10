import React from 'react'
import { useTheme } from '../lib/ThemeContext'
import BottomNav from '../components/BottomNav'

export default function SettingsScreen() {
  const { t, isDark, toggle } = useTheme()

  const rows = [
    { icon: '🏢', label: 'Company', value: 'Saisambu Security & Cleaning Ltd' },
    { icon: '📍', label: 'Location', value: 'Nairobi, Kenya' },
    { icon: '💾', label: 'Database', value: 'Supabase (Cloud)' },
    { icon: '📱', label: 'Version', value: 'v2.0.0 — MDE' },
  ]

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Settings</div>
      </div>

      <div style={{ padding: 16, paddingBottom: 90 }}>
        {/* Theme toggle */}
        <div style={{ ...s.section, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Appearance</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{isDark ? '🌙' : '☀️'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{isDark ? 'Dark Mode' : 'Light Mode'}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Tap to switch</div>
              </div>
            </div>
            <button onClick={toggle} style={{
              width: 48, height: 26, borderRadius: 13,
              background: isDark ? t.orange : t.border,
              border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: '#fff',
                position: 'absolute', top: 3, left: isDark ? 24 : 4, transition: 'left 0.2s'
              }} />
            </button>
          </div>
        </div>

        {/* App info */}
        <div style={{ ...s.section, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>App Info</div>
          {rows.map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${t.border}` }}>
              <span style={{ fontSize: 18 }}>{r.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: t.textMuted }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{r.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* MDE branding */}
        <div style={{ ...s.section, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 }}>Developer</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/mde-logo.png" alt="Madds Digital Empire" style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 12, background: '#fff', padding: 4 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>Madds Digital Empire</div>
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>Made in Kenya 🇰🇪</div>
              <div style={{ fontSize: 11, color: t.orange, marginTop: 3, fontWeight: 600 }}>Built with precision · 2026</div>
            </div>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px' },
  section: { borderRadius: 14, padding: 16, marginBottom: 14 },
}
