import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, invoiceDb } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { METHODS, METHOD_TO_DB, today, formatDate, fmtShort, fmt } from '../lib/theme'

export default function AddEditScreen() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { t } = useTheme()

  const existing = state?.record || null
  const prefill = state?.prefill || null
  const isEdit = !!existing

  const [client, setClient] = useState(existing?.client || prefill?.client || '')
  const [amount, setAmount] = useState(existing?.amount?.toString() || '')
  const [date, setDate] = useState(existing?.payment_date || today())
  const [method, setMethod] = useState(
    existing ? (METHODS.find(m => METHOD_TO_DB[m] === existing.payment_method) || 'M-Pesa') : 'M-Pesa'
  )
  const [mpesaCode, setMpesaCode] = useState(existing?.mpesa_code || '')
  const [chequeNo, setChequeNo] = useState(existing?.cheque_no || '')
  const [chequeDate, setChequeDate] = useState(existing?.cheque_date || '')
  const [bankName, setBankName] = useState(existing?.bank_name || '')
  const [bankDate, setBankDate] = useState(existing?.bank_date || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Invoice linking (multi-invoice allocation)
  const [clientInvoices, setClientInvoices] = useState([])
  const [allocations, setAllocations] = useState({}) // { invoiceId: amountString }
  const [existingAllocMap, setExistingAllocMap] = useState({}) // { invoiceId: previously allocated amount, for edit mode }
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // When editing, load this payment's existing allocations first
  useEffect(() => {
    if (isEdit) fetchExistingAllocations()
  }, [])

  async function fetchExistingAllocations() {
    const { data } = await invoiceDb.from('payment_allocations').select('invoice_id, amount').eq('payment_id', existing.id)
    const map = {}
    const alloc = {}
    ;(data || []).forEach(a => { map[a.invoice_id] = Number(a.amount); alloc[a.invoice_id] = a.amount.toString() })
    setExistingAllocMap(map)
    setAllocations(alloc)
  }

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
    // Show invoices with an outstanding balance, or ones already allocated to this payment (edit mode)
    setClientInvoices((invoices || []).filter(inv => Number(inv.balance || 0) > 0 || existingAllocMap[inv.id]))
    setLoadingInvoices(false)
  }

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0)

  function validate() {
    const e = {}
    if (!client.trim()) e.client = 'Client name required'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'Enter a valid amount'
    if (!date) e.date = 'Date required'
    if (totalAllocated > Number(amount) + 0.01) e.amount = 'Allocated amount exceeds payment amount'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function reverseInvoice(invoiceId, amt) {
    const { data: inv } = await invoiceDb.from('invoices').select('amount_paid, total').eq('id', invoiceId).single()
    if (!inv) return
    const revertedPaid = Math.max(0, Number(inv.amount_paid || 0) - amt)
    const revertedBalance = Math.max(0, Number(inv.total || 0) - revertedPaid)
    await invoiceDb.from('invoices').update({
      amount_paid: revertedPaid,
      balance: revertedBalance,
      status: revertedBalance <= 0 ? 'paid' : (revertedPaid > 0 ? 'partial' : 'sent'),
    }).eq('id', invoiceId)
  }

  async function applyInvoice(invoiceId, amt) {
    const { data: inv } = await invoiceDb.from('invoices').select('amount_paid, total').eq('id', invoiceId).single()
    if (!inv) return
    const newPaid = Number(inv.amount_paid || 0) + amt
    const newBalance = Math.max(0, Number(inv.total || 0) - newPaid)
    await invoiceDb.from('invoices').update({
      amount_paid: newPaid,
      balance: newBalance,
      status: newBalance <= 0 ? 'paid' : 'partial',
    }).eq('id', invoiceId)
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)

    const activeAllocations = Object.entries(allocations).filter(([, v]) => Number(v) > 0)

    const payload = {
      client: client.trim(),
      amount: Number(amount),
      payment_date: date,
      payment_method: METHOD_TO_DB[method] || 'other',
      invoice_id: activeAllocations.length === 1 ? activeAllocations[0][0] : null,
    }
    if (method === 'M-Pesa' && mpesaCode) payload.mpesa_code = mpesaCode
    if (method === 'Cheque' && chequeNo) payload.cheque_no = chequeNo
    if (method === 'Cheque' && chequeDate) payload.cheque_date = chequeDate
    if (method === 'Bank Transfer' && bankName) payload.bank_name = bankName
    if (method === 'Bank Transfer' && bankDate) payload.bank_date = bankDate

    let paymentId = existing?.id
    let error
    if (isEdit) {
      ({ error } = await supabase.from('payments').update(payload).eq('id', existing.id))
    } else {
      const { data, error: insertErr } = await supabase.from('payments').insert(payload).select().single()
      error = insertErr
      if (data) paymentId = data.id
    }

    if (error) {
      setSaving(false)
      alert('Error: ' + error.message)
      return
    }

    // Reverse previous allocations (edit mode only)
    if (isEdit) {
      for (const [invId, amt] of Object.entries(existingAllocMap)) {
        await reverseInvoice(invId, amt)
      }
      await invoiceDb.from('payment_allocations').delete().eq('payment_id', paymentId)
    }

    // Apply new allocations
    for (const [invId, amtStr] of activeAllocations) {
      const amt = Number(amtStr)
      await invoiceDb.from('payment_allocations').insert({ payment_id: paymentId, invoice_id: invId, amount: amt })
      await applyInvoice(invId, amt)
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

        <div style={{ marginBottom: 16 }}>
          <label style={{ ...s.label, color: t.textMuted }}>PAYMENT AMOUNT (KES)</label>
          <div style={{ ...s.amountRow, background: t.card, border: `1px solid ${errors.amount ? t.red : t.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: t.textMuted }}>KES</span>
            <input style={{ flex: 1, border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, color: t.text, background: 'transparent', padding: '12px 8px' }}
              placeholder="0" value={amount} type="number" inputMode="numeric"
              onChange={e => { setAmount(e.target.value); setErrors({ ...errors, amount: null }) }} />
          </div>
          {errors.amount && <div style={{ fontSize: 11, color: t.red, marginTop: 4 }}>{errors.amount}</div>}
        </div>

        {/* Invoice selector — manual multi-invoice allocation */}
        {client.trim() && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...s.label, color: t.textMuted }}>APPLY TO INVOICE(S) — OPTIONAL</label>
            {loadingInvoices ? (
              <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 0' }}>Checking for open invoices...</div>
            ) : clientInvoices.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textMuted, padding: '8px 0' }}>No outstanding invoices found for this client</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clientInvoices.map(inv => {
                  const checked = allocations[inv.id] !== undefined
                  const effectiveBalance = Number(inv.balance || 0) + Number(existingAllocMap[inv.id] || 0)
                  return (
                    <div key={inv.id} style={{ ...s.invoiceCard, background: checked ? t.orangeBg : t.card, border: `1px solid ${checked ? t.orange : t.border}`, cursor: 'default' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const next = { ...allocations }
                            if (checked) { delete next[inv.id] } else { next[inv.id] = Math.min(effectiveBalance, Math.max(0, Number(amount) - totalAllocated)).toString() }
                            setAllocations(next)
                          }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.orange }}>{inv.invoice_number}</div>
                            <div style={{ fontSize: 11, color: t.textMuted }}>{formatDate(inv.date)} · Owes {fmtShort(effectiveBalance)}</div>
                          </div>
                        </label>
                      </div>
                      {checked && (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: t.textMuted }}>Amount to apply:</span>
                          <input type="number" value={allocations[inv.id]}
                            onChange={e => setAllocations({ ...allocations, [inv.id]: e.target.value })}
                            style={{ flex: 1, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 700, border: `1px solid ${t.border}`, background: t.card, color: t.text, outline: 'none' }} />
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, color: totalAllocated > Number(amount || 0) ? t.red : t.textMuted, fontWeight: 600, textAlign: 'right' }}>
                  Allocated: KES {fmt(totalAllocated)} of KES {fmt(Number(amount) || 0)}
                </div>
              </div>
            )}
          </div>
        )}

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
