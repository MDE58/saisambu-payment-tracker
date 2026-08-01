import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { invoiceDb } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fmt, today, formatDate } from '../lib/theme'
import { LOGO_B64 } from '../lib/logoBase64'

const COMPANY = {
  name: 'SAISAMBU SECURITY & CLEANING LIMITED',
  address: 'P.O. Box 8-00200, Kericho, Kenya',
  tel: '0722 528 977 | 0723 076 059',
  email: 'saisambu6568@gmail.com',
  kra: 'P052019204S',
  motto: '"To Do Right & Just"',
}

const genInvoiceNo = () => {
  const now = new Date()
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(Math.random() * 900 + 100)}`
}

export default function InvoiceEditScreen() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { t } = useTheme()
  const existing = state?.invoice || null
  const isEdit = !!existing

  const [clients, setClients] = useState([])
  const [clientId, setClientId] = useState(existing?.client_id || '')
  const [invoiceNumber] = useState(existing?.invoice_number || genInvoiceNo())
  const [date, setDate] = useState(existing?.date || today())
  const [dueDate, setDueDate] = useState(existing?.due_date || '')
  const [vatExempt, setVatExempt] = useState(existing?.vat_exempt || false)
  const [notes, setNotes] = useState(existing?.notes || '')
  const [items, setItems] = useState([{ description: '', quantity: 1, unit_price: '' }])
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchClients() }, [])
  useEffect(() => { if (isEdit) fetchItems() }, [])

  async function fetchClients() {
    const { data } = await invoiceDb.from('clients').select('id, name').order('name')
    setClients(data || [])
    setLoading(false)
  }

  async function fetchItems() {
    const { data } = await invoiceDb.from('invoice_items').select('*').eq('invoice_id', existing.id)
    if (data && data.length) {
      setItems(data.map(it => ({ id: it.id, description: it.description, quantity: it.quantity, unit_price: it.unit_price, service_type: it.service_type })))
    }
  }

  function updateItem(i, key, val) {
    const next = [...items]
    next[i] = { ...next[i], [key]: val }
    setItems(next)
  }
  function addItem() { setItems([...items, { description: '', quantity: 1, unit_price: '' }]) }
  function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)) }

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  const vatAmount = vatExempt ? 0 : subtotal * 0.16
  const total = subtotal + vatAmount

  async function handleSave() {
    if (!clientId) { alert('Please select a client'); return }
    if (!items.some(it => it.description.trim())) { alert('Add at least one line item'); return }
    setSaving(true)

    const payload = {
      client_id: clientId,
      invoice_number: invoiceNumber,
      date,
      due_date: dueDate || null,
      subtotal,
      vat_amount: vatAmount,
      total,
      vat_exempt: vatExempt,
      notes,
      updated_at: new Date().toISOString(),
    }

    let invoiceId = existing?.id
    if (isEdit) {
      const { error } = await invoiceDb.from('invoices').update(payload).eq('id', invoiceId)
      if (error) { setSaving(false); alert('Error: ' + error.message); return }
      await invoiceDb.from('invoice_items').delete().eq('invoice_id', invoiceId)
    } else {
      const newBalance = total
      const { data, error } = await invoiceDb.from('invoices').insert({
        ...payload, status: 'draft', amount_paid: 0, balance: newBalance,
      }).select().single()
      if (error) { setSaving(false); alert('Error: ' + error.message); return }
      invoiceId = data.id
    }

    const itemRows = items.filter(it => it.description.trim()).map(it => ({
      invoice_id: invoiceId,
      description: it.description,
      service_type: it.service_type || null,
      quantity: Number(it.quantity) || 1,
      unit_price: Number(it.unit_price) || 0,
    }))
    const { error: itemsError } = await invoiceDb.from('invoice_items').insert(itemRows)

    setSaving(false)
    if (itemsError) { alert('Invoice saved but items failed: ' + itemsError.message); return }
    navigate('/invoices')
  }

  async function buildInvoicePDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const margin = 18
    const clientName = clients.find(c => c.id === clientId)?.name || 'Client'

    doc.setFillColor(232, 130, 26)
    doc.rect(0, 0, W, 2, 'F')
    doc.addImage(LOGO_B64, 'JPEG', margin, 6, 24, 24)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(26, 58, 92)
    doc.text(COMPANY.name, margin + 28, 13)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(COMPANY.address, margin + 28, 19)
    doc.text(`Tel: ${COMPANY.tel}`, margin + 28, 24)
    doc.text(`Email: ${COMPANY.email}`, margin + 28, 29)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(232, 130, 26)
    doc.text('INVOICE', W - margin, 16, { align: 'right' })

    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`No: ${invoiceNumber}`, W - margin, 23, { align: 'right' })
    doc.text(`Date: ${formatDate(date)}`, W - margin, 29, { align: 'right' })

    doc.setDrawColor(232, 130, 26)
    doc.setLineWidth(0.5)
    doc.line(margin, 34, W - margin, 34)

    let y = 44
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('BILLED TO', margin + 6, y + 7)
    doc.setFontSize(13)
    doc.setTextColor(26, 58, 92)
    doc.text(clientName, margin + 6, y + 15)
    if (dueDate) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Due: ${formatDate(dueDate)}`, W - margin - 6, y + 15, { align: 'right' })
    }

    y += 28
    doc.setFillColor(26, 58, 92)
    doc.roundedRect(margin, y, W - margin * 2, 9, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(255, 255, 255)
    doc.text('DESCRIPTION', margin + 6, y + 6)
    doc.text('QTY', margin + 105, y + 6)
    doc.text('UNIT PRICE', margin + 130, y + 6)
    doc.text('AMOUNT', W - margin - 6, y + 6, { align: 'right' })
    y += 9

    items.filter(it => it.description.trim()).forEach((it, i) => {
      const rowAmount = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
      const even = i % 2 === 0
      doc.setFillColor(even ? 248 : 255, even ? 250 : 255, even ? 252 : 255)
      doc.rect(margin, y, W - margin * 2, 10, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text(it.description, margin + 6, y + 6.5, { maxWidth: 82 })
      doc.text(String(it.quantity || 0), margin + 105, y + 6.5)
      doc.text(fmt(it.unit_price || 0), margin + 130, y + 6.5)
      doc.setFont('helvetica', 'bold')
      doc.text(fmt(rowAmount), W - margin - 6, y + 6.5, { align: 'right' })
      y += 10
    })

    y += 6
    const boxX = W - margin - 80
    const rows = [
      ['Subtotal', fmt(subtotal)],
      ...(!vatExempt ? [['VAT (16%)', fmt(vatAmount)]] : []),
    ]
    rows.forEach(([label, val]) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(100, 100, 100)
      doc.text(label, boxX, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(60, 60, 60)
      doc.text(`KES ${val}`, W - margin - 6, y, { align: 'right' })
      y += 7
    })

    y += 3
    doc.setFillColor(232, 130, 26)
    doc.roundedRect(boxX - 6, y, W - margin - boxX + 6, 14, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text('TOTAL', boxX, y + 9.5)
    doc.text(`KES ${fmt(total)}`, W - margin - 6, y + 9.5, { align: 'right' })

    y += 26
    if (notes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(120, 120, 120)
      doc.text('NOTES', margin, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(notes, margin, y, { maxWidth: W - margin * 2 })
      y += 14
    }

    doc.setDrawColor(220, 220, 220)
    doc.line(margin, 270, W - margin, 270)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(140, 140, 140)
    doc.text(`KRA PIN: ${COMPANY.kra}  |  ${COMPANY.motto}`, W / 2, 277, { align: 'center' })
    doc.text(`${COMPANY.email}  |  Kericho, Kenya`, W / 2, 283, { align: 'center' })
    doc.setFillColor(232, 130, 26)
    doc.rect(0, 294, W, 3, 'F')

    const filename = `Saisambu-Invoice-${invoiceNumber}.pdf`
    const blob = doc.output('blob')
    return { blob, filename, doc }
  }

  async function downloadInvoicePDF() {
    const { doc, filename } = await buildInvoicePDF()
    doc.save(filename)
  }

  async function shareInvoicePDF() {
    setSharing(true)
    try {
      const { blob, filename } = await buildInvoicePDF()
      const file = new File([blob], filename, { type: 'application/pdf' })
      const clientName = clients.find(c => c.id === clientId)?.name || 'Client'
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Saisambu Invoice', text: `Invoice ${invoiceNumber} for ${clientName} — KES ${fmt(total)}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      if (err.name !== 'AbortError') alert('Could not share invoice: ' + err.message)
    } finally {
      setSharing(false)
    }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: t.textMuted, background: t.bg, minHeight: '100vh' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Inter, sans-serif', background: t.bg, color: t.text }}>
      <div style={{ padding: '48px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: t.text }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 800 }}>{isEdit ? 'Edit Invoice' : 'New Invoice'}</span>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ padding: '20px 16px', paddingBottom: 60 }}>
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 16 }}>Invoice No: <b style={{ color: t.orange }}>{invoiceNumber}</b></div>

        <label style={lbl(t)}>CLIENT</label>
        <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...inputStyle(t), marginBottom: 16, appearance: 'auto' }}>
          <option value="">Select a client...</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl(t)}>DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle(t), marginBottom: 16 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl(t)}>DUE DATE</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...inputStyle(t), marginBottom: 16 }} />
          </div>
        </div>

        <label style={lbl(t)}>LINE ITEMS</label>
        {items.map((it, i) => (
          <div key={i} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <input placeholder="Description" value={it.description}
              onChange={e => updateItem(i, 'description', e.target.value)}
              style={{ ...inputStyle(t), marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" placeholder="Qty" value={it.quantity}
                onChange={e => updateItem(i, 'quantity', e.target.value)}
                style={{ ...inputStyle(t), width: 70 }} />
              <input type="number" placeholder="Unit price" value={it.unit_price}
                onChange={e => updateItem(i, 'unit_price', e.target.value)}
                style={{ ...inputStyle(t), flex: 1 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: t.orange, minWidth: 70, textAlign: 'right' }}>
                {fmt((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
              </span>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: t.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
              )}
            </div>
          </div>
        ))}
        <button onClick={addItem} style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px dashed ${t.border}`, background: 'none', color: t.orange, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
          + Add line item
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={vatExempt} onChange={e => setVatExempt(e.target.checked)} />
          <span style={{ fontSize: 12, color: t.textMuted }}>VAT Exempt</span>
        </label>

        <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: t.textMuted }}>Subtotal</span><span>KES {fmt(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: t.textMuted }}>VAT (16%)</span><span>KES {fmt(vatAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
            <span>Total</span><span style={{ color: t.orange }}>KES {fmt(total)}</span>
          </div>
        </div>

        <label style={lbl(t)}>NOTES</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          style={{ ...inputStyle(t), marginBottom: 20, resize: 'vertical' }} />

        {isEdit && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button onClick={shareInvoicePDF} disabled={sharing}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', background: '#25D366', opacity: sharing ? 0.7 : 1 }}>
              {sharing ? 'Preparing...' : '📲 Share PDF'}
            </button>
            <button onClick={downloadInvoicePDF}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', background: t.blue }}>
              📄 Download PDF
            </button>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', borderRadius: 12, padding: 15, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', border: 'none', background: saving ? t.textMuted : t.orange, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving...' : isEdit ? '✓ Update Invoice' : '💾 Save Invoice'}
        </button>
      </div>
    </div>
  )
}

const lbl = (t) => ({ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, color: t.textMuted })
const inputStyle = (t) => ({ width: '100%', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: t.card, border: `1px solid ${t.border}`, color: t.text })
