import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, invoiceDb } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fmt, fmtShort, formatDate, METHODS, METHOD_COLORS, METHOD_FROM_DB, METHOD_TO_DB } from '../lib/theme'
import BottomNav from '../components/BottomNav'

export default function PaymentsScreen() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const [records, setRecords] = useState([])
  const [debtors, setDebtors] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('All')
  const [debtorSearch, setDebtorSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [paymentsRes, invoicesRes, clientsRes] = await Promise.all([
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      invoiceDb.from('invoices').select('*'),
      invoiceDb.from('clients').select('*'),
    ])

    const payments = (paymentsRes.data || []).map(p => ({
      ...p,
      method_of_payment: METHOD_FROM_DB[p.payment_method] || 'Other',
      payment_amount: p.amount,
      date: p.payment_date,
    }))
    const invoices = invoicesRes.data || []
    const clients = clientsRes.data || []

    setRecords(payments)

    // Build debtors list from Invoice Manager
    const clientMap = {}
    clients.forEach(c => { clientMap[c.id] = c.name })

    const debtMap = {}
    invoices.forEach(inv => {
      const bal = Number(inv.balance || 0)
      if (bal > 0) {
        const name = clientMap[inv.client_id] || 'Unknown'
        if (!debtMap[name]) debtMap[name] = { name, balance: 0, invoiceCount: 0 }
        debtMap[name].balance += bal
        debtMap[name].invoiceCount++
      }
    })

    setDebtors(Object.values(debtMap).sort((a, b) => b.balance - a.balance))
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this payment?')) return

    // Reverse every invoice this payment was allocated to
    const { data: allocs } = await invoiceDb.from('payment_allocations').select('invoice_id, amount').eq('payment_id', id)
    for (const a of allocs || []) {
      const { data: invoice } = await invoiceDb.from('invoices').select('amount_paid, total').eq('id', a.invoice_id).single()
      if (invoice) {
        const newPaid = Math.max(0, Number(invoice.amount_paid || 0) - Number(a.amount))
        const newBalance = Math.max(0, Number(invoice.total || 0) - newPaid)
        await invoiceDb.from('invoices').update({
          amount_paid: newPaid,
          balance: newBalance,
          status: newBalance <= 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'sent'),
        }).eq('id', a.invoice_id)
      }
    }

    await supabase.from('payments').delete().eq('id', id)
    fetchAll()
  }

  const filtered = records.filter(r => {
    const ms = r.client?.toLowerCase().includes(search.toLowerCase()) || r.method_of_payment?.toLowerCase().includes(search.toLowerCase())
    const mm = filterMethod === 'All' || r.method_of_payment === filterMethod
    return ms && mm
  })

  const total = filtered.reduce((s, r) => s + Number(r.payment_amount), 0)
  const mc = METHOD_COLORS(t)

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Payments</div>
        <button onClick={() => navigate('/add-edit')} style={{ ...s.addBtn, background: t.orange }}>
          <span style={{ color: '#fff', fontSize: 20, lineHeight: 1 }}>+</span>
        </button>
      </div>

      <div style={{ paddingBottom: 90 }}>

        {/* ── Outstanding Clients Search ── */}
        <div style={{ borderBottom: `1px solid ${t.border}`, background: t.surface }}>
          <div style={{ padding: '12px 14px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.red }}>
              {debtors.length} client{debtors.length !== 1 ? 's' : ''} with outstanding balance
            </span>
          </div>
          <div style={{ padding: '0 14px 10px' }}>
            <div style={{ ...s.searchBox, background: t.card, border: `1px solid ${t.border}` }}>
              <span style={{ color: t.textMuted, fontSize: 14 }}>🔍</span>
              <input
                style={{ ...s.searchInput, color: t.text, background: 'transparent' }}
                placeholder="Search client with debt..."
                value={debtorSearch}
                onChange={e => setDebtorSearch(e.target.value)}
              />
              {debtorSearch && (
                <button onClick={() => setDebtorSearch('')} style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
              )}
            </div>

            {/* Dropdown results */}
            {debtorSearch.trim().length > 0 && (
              <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, marginTop: 6, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                {debtors.filter(d => d.name.toLowerCase().includes(debtorSearch.toLowerCase())).length === 0 ? (
                  <div style={{ padding: '12px 14px', color: t.textMuted, fontSize: 13 }}>No matching clients with debt</div>
                ) : debtors
                  .filter(d => d.name.toLowerCase().includes(debtorSearch.toLowerCase()))
                  .map(d => (
                    <button
                      key={d.name}
                      onClick={() => {
                        setDebtorSearch('')
                        navigate('/add-edit', { state: { prefill: { client: d.name } } })
                      }}
                      style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 14px', background: 'none', border: 'none', borderBottom: `1px solid ${t.border}`,
                        cursor: 'pointer', textAlign: 'left' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                          {d.invoiceCount} invoice{d.invoiceCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: t.red }}>KES {fmtShort(d.balance)}</div>
                        <div style={{ fontSize: 10, color: t.orange, marginTop: 2, fontWeight: 700 }}>+ Record Payment →</div>
                      </div>
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ ...s.searchBox, background: t.card, border: `1px solid ${t.border}` }}>
            <span style={{ color: t.textMuted }}>🔍</span>
            <input style={{ ...s.searchInput, color: t.text, background: 'transparent' }}
              placeholder="Search client or method..." value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>}
          </div>
        </div>

        {/* ── Filter chips ── */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {['All', ...METHODS].map(m => {
            const active = filterMethod === m
            return (
              <button key={m} onClick={() => setFilterMethod(m)}
                style={{ ...s.chip, background: active ? t.orange : t.card, border: `1px solid ${active ? t.orange : t.border}`, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#fff' : t.textMuted }}>{m}</span>
              </button>
            )
          })}
        </div>

        {/* ── Summary bar ── */}
        <div style={{ ...s.summaryBar, background: t.card, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: 12, color: t.textMuted, fontWeight: 600 }}>{filtered.length} records</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: t.orange }}>KES {fmt(total)}</span>
        </div>

        {/* ── Payment records ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
            <div style={{ fontSize: 40 }}>📄</div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>No payments found</div>
          </div>
        ) : (
          <>
            {filtered.map(r => {
              const mc2 = mc[r.method_of_payment] || { bg: t.purpleBg, text: t.purple }
              return (
                <div key={r.id} style={{ ...s.row, background: t.card, borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ ...s.rowIcon, background: mc2.bg }}>
                    <span style={{ fontSize: 18 }}>
                      {r.method_of_payment === 'M-Pesa' ? '📱' : r.method_of_payment === 'Bank Transfer' ? '🏦' : r.method_of_payment === 'Cheque' ? '📝' : '💵'}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{r.client}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ ...s.badge, background: mc2.bg, color: mc2.text }}>{r.method_of_payment}</span>
                      <span style={{ fontSize: 11, color: t.textMuted }}>{formatDate(r.date)}</span>
                      {r.mpesa_code && <span style={{ fontSize: 10, color: t.textMuted }}>#{r.mpesa_code}</span>}
                      {r.cheque_no && <span style={{ fontSize: 10, color: t.textMuted }}>Chq#{r.cheque_no}</span>}
                      {r.bank_name && <span style={{ fontSize: 10, color: t.textMuted }}>{r.bank_name}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>KES {fmtShort(r.payment_amount)}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => navigate('/add-edit', { state: { record: r } })}
                        style={{ ...s.iconBtn, background: t.blueBg, color: t.blue }}>✏️</button>
                      <button onClick={() => navigate('/receipts', { state: { record: r } })}
                        style={{ ...s.iconBtn, background: t.greenBg, color: t.green }}>🧾</button>
                      <button onClick={() => handleDelete(r.id)}
                        style={{ ...s.iconBtn, background: t.redBg, color: t.red }}>🗑️</button>
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ ...s.totalRow, background: t.surface, borderTop: `2px solid ${t.border}` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, letterSpacing: 1 }}>TOTAL</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: t.orange }}>KES {fmt(total)}</span>
            </div>
          </>
        )}
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
  chip: { padding: '6px 14px', borderRadius: 20, cursor: 'pointer' },
  summaryBar: { display: 'flex', justifyContent: 'space-between', padding: '8px 16px' },
  debtorCard: { borderRadius: 12, padding: '12px 14px', minWidth: 150, cursor: 'pointer', textAlign: 'left' },  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' },
  rowIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', fontSize: 13 },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' },
}
