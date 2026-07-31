import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { invoiceDb } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fmt, fmtShort, formatDate } from '../lib/theme'
import BottomNav from '../components/BottomNav'

const STATUS_COLORS = (t) => ({
  draft:   { bg: t.purpleBg, text: t.purple },
  sent:    { bg: t.blueBg,   text: t.blue   },
  partial: { bg: t.amberBg,  text: t.amber  },
  paid:    { bg: t.greenBg,  text: t.green  },
  overdue: { bg: t.redBg,    text: t.red    },
})

export default function InvoicesScreen() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { t } = useTheme()
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [clientFilter, setClientFilter] = useState(state?.clientFilter || null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [inv, cl] = await Promise.all([
      invoiceDb.from('invoices').select('*').order('date', { ascending: false }),
      invoiceDb.from('clients').select('id, name'),
    ])
    setInvoices(inv.data || [])
    setClients(cl.data || [])
    setLoading(false)
  }

  const clientMap = {}
  clients.forEach(c => { clientMap[c.id] = c.name })

  const filtered = invoices.filter(inv => {
    const name = clientMap[inv.client_id] || ''
    const ms = name.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
    const mst = statusFilter === 'All' || inv.status === statusFilter
    const mc = !clientFilter || inv.client_id === clientFilter
    return ms && mst && mc
  })

  const sc = STATUS_COLORS(t)
  const totalOutstanding = filtered.reduce((s, r) => s + Number(r.balance || 0), 0)

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Invoices</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/clients')} style={{ ...s.addBtn, background: t.card, border: `1px solid ${t.border}` }}>
            <span style={{ fontSize: 16 }}>👥</span>
          </button>
          <button onClick={() => navigate('/invoice-edit')} style={{ ...s.addBtn, background: t.orange }}>
            <span style={{ color: '#fff', fontSize: 20, lineHeight: 1 }}>+</span>
          </button>
        </div>
      </div>

      {clientFilter && (
        <div style={{ padding: '10px 14px', background: t.orangeBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.orange }}>Filtered: {clientMap[clientFilter]}</span>
          <button onClick={() => setClientFilter(null)} style={{ background: 'none', border: 'none', color: t.orange, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Clear ✕</button>
        </div>
      )}

      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ ...s.searchBox, background: t.card, border: `1px solid ${t.border}` }}>
          <span style={{ color: t.textMuted }}>🔍</span>
          <input style={{ ...s.searchInput, color: t.text, background: 'transparent' }}
            placeholder="Search client or invoice #..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {['All', 'draft', 'sent', 'partial', 'paid', 'overdue'].map(m => {
          const active = statusFilter === m
          return (
            <button key={m} onClick={() => setStatusFilter(m)}
              style={{ padding: '6px 14px', borderRadius: 20, cursor: 'pointer', flexShrink: 0, background: active ? t.orange : t.card, border: `1px solid ${active ? t.orange : t.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#fff' : t.textMuted, textTransform: 'capitalize' }}>{m}</span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: t.card, borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{filtered.length} invoices</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.red }}>Outstanding: KES {fmt(totalOutstanding)}</span>
      </div>

      <div style={{ paddingBottom: 90 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
            <div style={{ fontSize: 40 }}>🧾</div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>No invoices found</div>
          </div>
        ) : filtered.map(inv => {
          const sc2 = sc[inv.status] || sc.draft
          return (
            <div key={inv.id} onClick={() => navigate('/invoice-edit', { state: { invoice: inv } })}
              style={{ ...s.row, background: t.card, borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.orange }}>{inv.invoice_number}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: sc2.bg, color: sc2.text, textTransform: 'uppercase' }}>{inv.status}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginTop: 4 }}>{clientMap[inv.client_id] || 'Unknown client'}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{formatDate(inv.date)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>KES {fmtShort(inv.total)}</div>
                {Number(inv.balance) > 0 ? (
                  <div style={{ fontSize: 11, color: t.red, fontWeight: 700, marginTop: 2 }}>Owes {fmtShort(inv.balance)}</div>
                ) : (
                  <div style={{ fontSize: 11, color: t.green, fontWeight: 700, marginTop: 2 }}>✓ Paid</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <BottomNav />
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '0 12px', height: 42 },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px' },
}
