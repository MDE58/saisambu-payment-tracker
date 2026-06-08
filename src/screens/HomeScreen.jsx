import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fmt, fmtShort, formatDate, METHOD_COLORS } from '../lib/theme'
import BottomNav from '../components/BottomNav'

export default function HomeScreen() {
  const navigate = useNavigate()
  const { t, isDark, toggle } = useTheme()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchRecords() }, [])

  async function fetchRecords() {
    setLoading(true)
    const { data } = await supabase.from('saisambu_payments').select('*').order('date', { ascending: false }).limit(5)
    setRecords(data || [])
    setLoading(false)
  }

  const total = records.reduce((s, r) => s + Number(r.payment_amount), 0)
  const mpesa = records.filter(r => r.method_of_payment === 'M-Pesa').reduce((s, r) => s + Number(r.payment_amount), 0)
  const bank = records.filter(r => r.method_of_payment === 'Bank Transfer').reduce((s, r) => s + Number(r.payment_amount), 0)
  const cheque = records.filter(r => r.method_of_payment === 'Cheque').reduce((s, r) => s + Number(r.payment_amount), 0)
  const mc = METHOD_COLORS(t)

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      {/* Header */}
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={s.headerLeft}>
          <div style={{ ...s.logoBox, background: t.orangeBg }}>
            <img src="/logo.jpg" alt="Saisambu" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', background: '#fff', padding: 1 }} />
          </div>
          <div>
            <div style={{ ...s.companyName, color: t.orange }}>SAISAMBU SECURITY LTD</div>
            <div style={{ fontSize: 11, color: t.textMuted }}>Payment Tracker</div>
          </div>
        </div>
        <button onClick={toggle} style={{ ...s.themeBtn, background: t.card, border: `1px solid ${t.border}` }}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={s.scroll}>
        {/* Title */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: t.text }}>Dashboard</div>
        </div>

        {/* Main stat cards */}
        <div style={{ padding: '16px 16px 0', display: 'flex', gap: 12 }}>
          <div style={{ ...s.bigCard, background: t.purple, flex: 1.2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' }}>Total Collected</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 6 }}>KES {fmt(total)}</div>
          </div>
          <div style={{ ...s.bigCard, background: t.card, border: `1px solid ${t.border}`, flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>This Month</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: t.orange, marginTop: 6 }}>
              KES {fmt(records.filter(r => r.date?.startsWith(new Date().toISOString().slice(0,7))).reduce((s,r) => s + Number(r.payment_amount), 0))}
            </div>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px 0' }}>
          {[
            { label: 'M-PESA', value: fmtShort(mpesa), color: t.green },
            { label: 'BANK', value: fmtShort(bank), color: t.blue },
            { label: 'CHEQUE', value: fmtShort(cheque), color: t.amber },
            { label: 'RECORDS', value: records.length, color: t.purple },
          ].map(item => (
            <div key={item.label} style={{ ...s.miniCard, background: t.card, border: `1px solid ${t.border}`, flex: 1 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: item.color, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'New Payment', icon: '+', color: t.orange, action: () => navigate('/add-edit') },
              { label: 'All Payments', icon: '💳', color: t.blue, action: () => navigate('/payments') },
              { label: 'Receipts', icon: '🧾', color: t.green, action: () => navigate('/receipts') },
              { label: 'Reports', icon: '📊', color: t.purple, action: () => navigate('/reports') },
            ].map(item => (
              <button key={item.label} onClick={item.action} style={{ ...s.actionBtn, background: t.card, border: `1px solid ${t.border}` }}>
                <div style={{ ...s.actionIcon, background: item.color + '22' }}>
                  <span style={{ fontSize: 18, color: item.color }}>{item.icon}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent payments */}
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Recent Payments</div>
          {loading ? (
            <div style={{ textAlign: 'center', color: t.textMuted, padding: 20 }}>Loading...</div>
          ) : records.length === 0 ? (
            <div style={{ ...s.emptyCard, background: t.card, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 32 }}>💳</div>
              <div style={{ color: t.textMuted, fontSize: 13 }}>No payments yet</div>
            </div>
          ) : records.map(r => {
            const mc2 = mc[r.method_of_payment] || { bg: t.purpleBg, text: t.purple }
            return (
              <div key={r.id} onClick={() => navigate('/payments')} style={{ ...s.recentRow, background: t.card, border: `1px solid ${t.border}` }}>
                <div style={{ ...s.recentIcon, background: mc2.bg }}>
                  <span style={{ fontSize: 16 }}>
                    {r.method_of_payment === 'M-Pesa' ? '📱' : r.method_of_payment === 'Bank Transfer' ? '🏦' : r.method_of_payment === 'Cheque' ? '📝' : '💵'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{r.client}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{r.method_of_payment} · {formatDate(r.date)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>KES {fmtShort(r.payment_amount)}</div>
                  <div style={{ ...s.badge, background: mc2.bg, color: mc2.text }}>{r.method_of_payment}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ height: 90 }} />
      </div>
      <BottomNav />
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logoBox: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  companyName: { fontSize: 12, fontWeight: 800, letterSpacing: 0.8 },
  themeBtn: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 },
  scroll: { overflowY: 'auto' },
  bigCard: { borderRadius: 14, padding: '16px 14px' },
  miniCard: { borderRadius: 10, padding: '10px 8px' },
  actionBtn: { borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' },
  actionIcon: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recentRow: { borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, cursor: 'pointer' },
  recentIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badge: { fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, display: 'inline-block', marginTop: 2 },
  emptyCard: { borderRadius: 12, padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
}
