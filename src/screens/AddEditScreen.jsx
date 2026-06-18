import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, invoiceDb } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { METHODS, today, formatDate, fmtShort, fmt } from '../lib/theme'

export default function AddEditScreen() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { t } = useTheme()

  const existing = state?.record || null
  const prefill = state?.prefill || null
  const isEdit = !!existing

  const [client, setClient] = useState(existing?.client || prefill?.client || '')
  const [amount, setAmount] = useState(existing?.payment_amount?.toString() || '')
  const [date, setDate] = useState(existing?.date || today())
  const [method, setMethod] = useState(existing?.method_of_payment || 'M-Pesa')
  const [mpesaCode, setMpesaCode] = useState(existing?.mpesa_code || '')
  const [chequeNo, setChequeNo] = useState(existing?.cheque_no || '')
  const [chequeDate, setChequeDate] = useState(existing?.cheque_date || '')
  const [bankName, setBankName] = useState(existing?.bank_name || '')
  const [bankDate, setBankDate] = useState(existing?.bank_date || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Invoice linking
  const [clientInvoices, setClientInvoices] = useState([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(existing?.invoice_id || null)
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // Fetch open invoices for the typed client name
  useEffect(() => {
    const name = client.trim()
    if (!name) { setClientInvoices([]); return }
    const timer = setTimeout(() => fetchClientInvoices(name), 400)
    return () => clearTimeout(timer)
  }, [client])

  async function fetchClientInvoices(name) {
    setLoadingInvoices(true)
    const { data: clients } = await invoiceDb.from('clients').select('id, name')
    const match = (clients || []).find(c => c.name.toLowerCase() === name.toLowerCase())
    if (!match) {
      setClientInvoices([])
      setLoadingInvoices(false)
      return
    }
    const { data: invoices } = await invoiceDb
      .from('invoices')
      .select('*')
      .eq('client_id', match.id)
      .order('date', { ascending: false })
    setClientInvoices((invoices || []).filter(inv => Number(inv.balance || 0) > 0))
    setLoadingInvoices(false)
  }

  function validate() {
    const e = {}
    if (!client.trim()) e.client = 'Client name required'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'Enter a valid amount'
    if (!date) e.date = 'Date required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)

    const payload = {
      client: client.trim(),
      payment_amount: Number(amount),
      date,
      method_of_payment: method,
    }
    if (method === 'M-Pesa' && mpesaCode) payload.mpesa_code = mpesaCode
    if (method === 'Cheque' && chequeNo) payload.cheque_no = chequeNo
    if (method === 'Cheque' && chequeDate) payload.cheque_date = chequeDate
    if (method === 'Bank Transfer' && bankName) payload.bank_name = bankName
    if (method === 'Bank Transfer' && bankDate) payload.bank_date = bankDate
    if (selectedInvoiceId) payload.invoice_id = selectedInvoiceId

    let error
    if (isEdit) {
      ({ error } = await supabase.from('saisambu_payments').update(payload).eq('id', existing.id))
    } else {
      ({ error } = await supabase.from('saisambu_payments').insert(payload))
    }

    if (error) {
      setSaving(false)
      alert('Error: ' + error.message)
      return
    }

    // If linked to an invoice, reduce its balance / increase amount_paid
    if (selectedInvoiceId && !isEdit) {
      const invoice = clientInvoices.find(inv => inv.id === selectedInvoiceId)
      if (invoice) {
        const newPaid = Number(invoice.amount_paid || 0) + Number(amount)
        const newBalance = Math.max(0, Number(invoice.total || 0) - newPaid)
        await invoiceDb.from('invoices').update({
          amount_paid: newPaid,
          balance: newBalance,
        }).eq('id', selectedInvoiceId)
      }
    }

    setSaving(false)
    navigate('/payments')
  }

  const field = (label, value, setter, opts = {}) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ ...s.label, color: t.textMuted }}>{label}</label>
      <input
        style={{ ...s.input, background: t.card, border: `1px solid ${errors[opts.key] ? t.red : t.border}`, color: t.text }}
        placeholder={opts.placeholder || ''}
        value={value}
        onChange={e => { setter(e.target.value); if (opts.key) setErrors({ ...errors, [opts.key]: null }) }}
        type={opts.type || 'text'}
        max={opts.max}
        autoCapitalize={opts.caps || 'none'}
      />
      {opts.key && errors[opts.key] && <div style={{ fontSize: 11, color: t.red, marginTop: 4 }}>{errors[opts.key]}</div>}
    </div>
  )

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <button onClick={() => navigate(-1)} style={{ ...s.backBtn, color: t.text }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{isEdit ? 'Edit Payment' : 'New Payment'}</span>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '20px 16px', paddingBottom: 60 }}>
        {field('CLIENT NAME', client, setClient, { key: 'client', placeholder: 'e.g. Alpha Security Post', caps: 'words' })}

        {/* Invoice selector */}
        {client.trim() && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...s.label, color: t.textMuted }}>APPLY TO INVOICE (OPTIONAL)</label>
            {loadingInvoices ? (
              <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 0' }}>Checking for open invoices...</div>
            ) : clientInvoices.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 0' }}>No outstanding invoices found for this client</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => setSelectedInvoiceId(null)}
                  style={{
                    ...s.invoiceCard,
                    background: !selectedInvoiceId ? t.orangeBg : t.card,
                    border: `1px solid ${!selectedInvoiceId ? t.orange : t.border}`,
                  }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>Don't link to an invoice</span>
                </button>
                {clientInvoices.map(inv => {
                  const active = selectedInvoiceId === inv.id
                  return (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      style={{ ...s.invoiceCard, background: active ? t.orangeBg : t.card, border: `1px solid ${active ? t.orange : t.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.orange }}>{inv.invoice_number}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{formatDate(inv.date)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>KES {fmtShort(inv.total)}</div>
                          <div style={{ fontSize: 11, color: t.red, fontWeight: 700 }}>Owes {fmtShort(inv.balance)}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...s.label, color: t.textMuted }}>PAYMENT AMOUNT (KES)</label>
          <div style={{ ...s.amountRow, background: t.card, border: `1px solid ${errors.amount ? t.red : t.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.textMuted }}>KES</span>
            <input style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, color: t.text, background: 'transparent', padding: '12px 8px' }}
              placeholder="0" value={amount} type="number" inputMode="numeric"
              onChange={e => { setAmount(e.target.value); setErrors({ ...errors, amount: null }) }} />
          </div>
          {errors.amount && <div style={{ fontSize: 11, color: t.red, marginTop: 4 }}>{errors.amount}</div>}
          {selectedInvoiceId && (() => {
            const inv = clientInvoices.find(i => i.id === selectedInvoiceId)
            if (!inv || !amount) return null
            const remaining = Math.max(0, Number(inv.balance || 0) - Number(amount))
            return (
              <div style={{ fontSize: 11, color: remaining > 0 ? t.amber : t.green, marginTop: 6, fontWeight: 600 }}>
                {remaining > 0 ? `KES ${fmt(remaining)} will remain unpaid on this invoice` : '✓ This will fully settle the invoice'}
              </div>
            )
          })()}
        </div>

        {field('DATE', date, setDate, { key: 'date', type: 'date', max: today() })}

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...s.label, color: t.textMuted }}>METHOD OF PAYMENT</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {METHODS.map(m => {
              const active = method === m
              return (
                <button key={m} onClick={() => setMethod(m)}
                  style={{ ...s.chip, background: active ? t.orange : t.card, border: `1px solid ${active ? t.orange : t.border}`, color: active ? '#fff' : t.textMuted }}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>

        {method === 'M-Pesa' && (
          <div style={{ ...s.extraBox, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.green, marginBottom: 10, letterSpacing: 0.8 }}>📱 M-PESA DETAILS</div>
            {field('TRANSACTION CODE', mpesaCode, setMpesaCode, { placeholder: 'e.g. QGH7X2KPLA' })}
          </div>
        )}

        {method === 'Cheque' && (
          <div style={{ ...s.extraBox, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.amber, marginBottom: 10, letterSpacing: 0.8 }}>📝 CHEQUE DETAILS</div>
            {field('CHEQUE NUMBER', chequeNo, setChequeNo, { placeholder: 'e.g. 001234' })}
            {field('CHEQUE DATE', chequeDate, setChequeDate, { type: 'date' })}
          </div>
        )}

        {method === 'Bank Transfer' && (
          <div style={{ ...s.extraBox, background: t.card, border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.blue, marginBottom: 10, letterSpacing: 0.8 }}>🏦 BANK / RTGS DETAILS</div>
            {field('BANK NAME', bankName, setBankName, { placeholder: 'e.g. Equity Bank', caps: 'words' })}
            {field('TRANSFER DATE', bankDate, setBankDate, { type: 'date' })}
          </div>
        )}

        {client.trim() && amount && Number(amount) > 0 && (
          <div style={{ background: t.orangeBg, border: `1px solid ${t.orange}44`, borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.orange, letterSpacing: 0.8, marginBottom: 6 }}>PREVIEW</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{client}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: t.text, marginTop: 2 }}>KES {fmtShort(Number(amount))}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{formatDate(date)} · {method}</div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ ...s.saveBtn, background: saving ? t.textMuted : t.orange, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : isEdit ? '✓ Update Payment' : '💾 Save Payment'}
        </button>

        {isEdit && (
          <button onClick={() => navigate(-1)} style={{ ...s.cancelBtn, background: t.card, border: `1px solid ${t.border}`, color: t.textMuted }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: 4 },
  label: { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  input: { width: '100%', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  amountRow: { borderRadius: 10, padding: '0 14px', display: 'flex', alignItems: 'center' },
  chip: { padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, border: 'none' },
  extraBox: { borderRadius: 12, padding: 14, marginBottom: 16 },
  invoiceCard: { borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%' },
  saveBtn: { width: '100%', borderRadius: 12, padding: 15, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', border: 'none', marginBottom: 10 },
  cancelBtn: { width: '100%', borderRadius: 12, padding: 13, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
}
