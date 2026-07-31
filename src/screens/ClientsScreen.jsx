import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoiceDb } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import BottomNav from '../components/BottomNav'

export default function ClientsScreen() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const [clients, setClients] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // null = list, {} = new, {...} = edit
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [c, i] = await Promise.all([
      invoiceDb.from('clients').select('*').order('name'),
      invoiceDb.from('invoices').select('id, client_id, balance, total'),
    ])
    setClients(c.data || [])
    setInvoices(i.data || [])
    setLoading(false)
  }

  const statsFor = (clientId) => {
    const clientInvoices = invoices.filter(inv => inv.client_id === clientId)
    const balance = clientInvoices.reduce((s, inv) => s + Number(inv.balance || 0), 0)
    return { count: clientInvoices.length, balance }
  }

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSave(form) {
    setSaving(true)
    let error
    if (form.id) {
      ({ error } = await invoiceDb.from('clients').update({
        name: form.name, phone: form.phone, email: form.email, address: form.address,
        kra_pin: form.kra_pin, cu_number: form.cu_number, service_type: form.service_type, status: form.status,
      }).eq('id', form.id))
    } else {
      ({ error } = await invoiceDb.from('clients').insert({
        name: form.name, phone: form.phone, email: form.email, address: form.address,
        kra_pin: form.kra_pin, cu_number: form.cu_number, service_type: form.service_type || 'General', status: 'active',
      }))
    }
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setEditing(null)
    fetchAll()
  }

  if (editing !== null) {
    return <ClientForm t={t} client={editing} onCancel={() => setEditing(null)} onSave={handleSave} saving={saving} />
  }

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Clients</div>
        <button onClick={() => setEditing({})} style={{ ...s.addBtn, background: t.orange }}>
          <span style={{ color: '#fff', fontSize: 20, lineHeight: 1 }}>+</span>
        </button>
      </div>

      <div style={{ padding: '12px 14px 0' }}>
        <div style={{ ...s.searchBox, background: t.card, border: `1px solid ${t.border}` }}>
          <span style={{ color: t.textMuted }}>🔍</span>
          <input style={{ ...s.searchInput, color: t.text, background: 'transparent' }}
            placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ paddingBottom: 90 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
            <div style={{ fontSize: 40 }}>👥</div>
            <div style={{ marginTop: 8, fontWeight: 700 }}>No clients found</div>
          </div>
        ) : filtered.map(c => {
          const stat = statsFor(c.id)
          return (
            <div key={c.id} style={{ ...s.row, background: t.card, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate('/invoices', { state: { clientFilter: c.id } })}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                  {c.phone || 'No phone'} · {c.service_type || 'General'}
                </div>
                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                  {stat.count} invoice{stat.count !== 1 ? 's' : ''}
                  {stat.balance > 0 && <span style={{ color: t.red, fontWeight: 700 }}> · Owes KES {stat.balance.toLocaleString()}</span>}
                </div>
              </div>
              <button onClick={() => setEditing(c)} style={{ ...s.iconBtn, background: t.blueBg, color: t.blue }}>✏️</button>
            </div>
          )
        })}
      </div>
      <BottomNav />
    </div>
  )
}

function ClientForm({ t, client, onCancel, onSave, saving }) {
  const [form, setForm] = useState({
    id: client.id || null,
    name: client.name || '',
    phone: client.phone || '',
    email: client.email || '',
    address: client.address || '',
    kra_pin: client.kra_pin || '',
    cu_number: client.cu_number || '',
    service_type: client.service_type || '',
    status: client.status || 'active',
  })

  const field = (label, key, opts = {}) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, color: t.textMuted }}>{label}</label>
      <input
        style={{ width: '100%', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: t.card, border: `1px solid ${t.border}`, color: t.text }}
        placeholder={opts.placeholder || ''}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: t.bg, color: t.text }}>
      <div style={{ padding: '48px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: t.text }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{form.id ? 'Edit Client' : 'New Client'}</span>
        <div style={{ width: 36 }} />
      </div>
      <div style={{ padding: '20px 16px', paddingBottom: 60 }}>
        {field('CLIENT / COMPANY NAME', 'name', { placeholder: 'e.g. Kisima Mixed Day Secondary School' })}
        {field('PHONE', 'phone', { placeholder: '07XX XXX XXX' })}
        {field('EMAIL', 'email')}
        {field('ADDRESS', 'address')}
        {field('KRA PIN', 'kra_pin')}
        {field('CU NUMBER', 'cu_number')}
        {field('SERVICE TYPE', 'service_type', { placeholder: 'e.g. Security, Cleaning' })}
        <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}
          style={{ width: '100%', borderRadius: 12, padding: 15, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', border: 'none', marginBottom: 10, background: saving ? t.textMuted : t.orange, opacity: saving || !form.name.trim() ? 0.7 : 1 }}>
          {saving ? 'Saving...' : form.id ? '✓ Update Client' : '💾 Save Client'}
        </button>
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '0 12px', height: 42 },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', fontSize: 13, flexShrink: 0 },
}
