import React, { useState, useEffect } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { supabase, invoiceDb } from '../lib/supabase'
import { fmt, formatDate, today, METHOD_FROM_DB } from '../lib/theme'
import { LOGO_B64 } from '../lib/logoBase64'
import BottomNav from '../components/BottomNav'

const COMPANY = {
  name: 'SAISAMBU SECURITY & CLEANING LIMITED',
  address: 'P.O. Box 8-00200, Kericho, Kenya',
  tel: '0722 528 977 | 0723 076 059',
  email: 'saisambu6568@gmail.com',
  kra: 'P052019204S',
  motto: '"To Do Right & Just"',
}

// ── Shared PDF header (white design matching invoice) ──
function pdfHeader(doc, W, margin, title, subtitle, now) {
  // White background (default), orange top bar
  doc.setFillColor(232, 130, 26)
  doc.rect(0, 0, W, 2, 'F')

  // Logo
  doc.addImage(LOGO_B64, 'JPEG', margin, 6, 22, 22)

  // Company name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(26, 58, 92)
  doc.text(COMPANY.name, margin + 26, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(COMPANY.address, margin + 26, 19)
  doc.text(`Tel: ${COMPANY.tel}  |  Email: ${COMPANY.email}`, margin + 26, 24)
  doc.text(`KRA PIN: ${COMPANY.kra}`, margin + 26, 29)

  // Title block (right side)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(232, 130, 26)
  doc.text(title, W - margin, 16, { align: 'right' })
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(subtitle, W - margin, 23, { align: 'right' })
  doc.text(`Generated: ${now}`, W - margin, 29, { align: 'right' })

  // Divider
  doc.setDrawColor(232, 130, 26)
  doc.setLineWidth(0.5)
  doc.line(margin, 34, W - margin, 34)
}

function pdfFooter(doc, W, margin) {
  doc.setFillColor(232, 130, 26)
  doc.rect(0, 291, W, 3, 'F')
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(150, 150, 150)
  doc.text(`${COMPANY.motto}  |  ${COMPANY.email}  |  Main Office: Kericho, Kenya`, W / 2, 289, { align: 'center' })
}

function pdfTableHeader(doc, headers, colX, y, W, margin) {
  doc.setFillColor(26, 58, 92)
  doc.rect(margin, y, W - margin * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  headers.forEach((h, i) => doc.text(h, colX[i], y + 5.5, { align: colX[i] > W / 2 && i === headers.length - 1 ? 'right' : 'left' }))
  return y + 8
}

function pdfRow(doc, cells, colX, y, idx, W, margin, lastRight) {
  const even = idx % 2 === 0
  doc.setFillColor(even ? 248 : 255, even ? 250 : 255, even ? 252 : 255)
  doc.rect(margin, y, W - margin * 2, 9, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.line(margin, y + 9, W - margin, y + 9)
  cells.forEach((cell, i) => {
    doc.setFont('helvetica', cell.bold ? 'bold' : 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...(cell.color || [60, 60, 60]))
    const align = lastRight && i === cells.length - 1 ? 'right' : 'left'
    doc.text(String(cell.text || ''), colX[i], y + 6, { align })
  })
  return y + 9
}

export default function ReportsScreen() {
  const { t } = useTheme()
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('summary')
  const [selectedClient, setSelectedClient] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today())

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [p, inv, cl] = await Promise.all([
      supabase.from('payments').select('*').order('payment_date', { ascending: false }),
      invoiceDb.from('invoices').select('*').order('date', { ascending: false }),
      invoiceDb.from('clients').select('*').order('name'),
    ])
    setPayments((p.data || []).map(x => ({
      ...x,
      method_of_payment: METHOD_FROM_DB[x.payment_method] || 'Other',
      payment_amount: x.amount,
      date: x.payment_date,
    })))
    setInvoices(inv.data || [])
    setClients(cl.data || [])
    setLoading(false)
  }

  const totalCollected = payments.reduce((s, r) => s + Number(r.payment_amount), 0)
  const totalInvoiced = invoices.reduce((s, r) => s + Number(r.total || 0), 0)
  const totalDebt = invoices.reduce((s, r) => s + Number(r.balance || 0), 0)

  const clientMap = {}
  clients.forEach(c => { clientMap[c.id] = c.name })

  const byClient = {}
  clients.forEach(c => {
    byClient[c.name] = { name: c.name, invoiced: 0, balance: 0, paid: 0, invoiceCount: 0, invoiceList: [] }
  })
  invoices.forEach(inv => {
    const cname = clientMap[inv.client_id] || ''
    if (byClient[cname]) {
      byClient[cname].invoiced += Number(inv.total || 0)
      byClient[cname].balance += Number(inv.balance || 0)
      byClient[cname].paid += Number(inv.amount_paid || 0)
      byClient[cname].invoiceCount++
      byClient[cname].invoiceList.push(inv)
    }
  })
  payments.forEach(p => {
    const match = Object.keys(byClient).find(k => k.toLowerCase() === p.client.toLowerCase())
    if (match) {
      byClient[match].trackerPayments = byClient[match].trackerPayments || []
      byClient[match].trackerPayments.push(p)
    } else {
      byClient[p.client] = byClient[p.client] || { name: p.client, invoiced: 0, balance: 0, paid: 0, invoiceCount: 0, invoiceList: [], trackerPayments: [] }
      byClient[p.client].trackerPayments = byClient[p.client].trackerPayments || []
      byClient[p.client].trackerPayments.push(p)
    }
  })

  const clientRows = Object.values(byClient)
    .filter(c => c.invoiced > 0 || (c.trackerPayments && c.trackerPayments.length > 0))
    .sort((a, b) => b.balance - a.balance)

  // Date-filtered invoices for the Invoices tab
  const filteredInvoices = invoices.filter(inv => {
    if (dateFrom && inv.date < dateFrom) return false
    if (dateTo && inv.date > dateTo) return false
    return true
  })

  const filteredPayments = payments.filter(p => {
    if (dateFrom && p.date < dateFrom) return false
    if (dateTo && p.date > dateTo) return false
    return true
  })

  const byMonth = {}
  payments.forEach(p => {
    const key = p.date?.slice(0, 7)
    if (!byMonth[key]) byMonth[key] = 0
    byMonth[key] += Number(p.payment_amount)
  })
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12)

  // ── PDF: General Ledger ──
  async function downloadLedger() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210, margin = 14
    const now = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })

    pdfHeader(doc, W, margin, 'PAYMENT LEDGER', `All Payments · ${payments.length} records`, now)

    // Summary band
    let y = 40
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(margin, y, W - margin * 2, 16, 2, 2, 'F')
    const summCols = [
      ['TOTAL INVOICED', `KES ${fmt(totalInvoiced)}`, [37, 99, 235]],
      ['TOTAL COLLECTED', `KES ${fmt(totalCollected)}`, [22, 163, 74]],
      ['OUTSTANDING DEBT', `KES ${fmt(totalDebt)}`, [220, 38, 38]],
    ]
    summCols.forEach(([label, val, color], i) => {
      const x = margin + 6 + i * ((W - margin * 2) / 3)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.text(label, x, y + 6)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...color)
      doc.text(val, x, y + 13)
    })

    y += 22
    const headers = ['Date', 'Client', 'Method', 'Code / Ref', 'Amount (KES)']
    const colX = [margin + 2, margin + 26, margin + 90, margin + 132, W - margin - 2]
    y = pdfTableHeader(doc, headers, colX, y, W, margin)

    payments.forEach((p, idx) => {
      if (y > 272) {
        doc.addPage()
        y = 16
        y = pdfTableHeader(doc, headers, colX, y, W, margin)
      }
      const ref = p.mpesa_code || p.cheque_no || p.bank_name || '-'
      y = pdfRow(doc, [
        { text: formatDate(p.date) },
        { text: p.client.length > 30 ? p.client.slice(0, 30) + '…' : p.client },
        { text: p.method_of_payment },
        { text: ref.length > 16 ? ref.slice(0, 16) : ref },
        { text: fmt(p.payment_amount), bold: true, color: [26, 58, 92] },
      ], colX, y, idx, W, margin, true)
    })

    // Total row
    doc.setFillColor(232, 130, 26)
    doc.rect(margin, y, W - margin * 2, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('TOTAL COLLECTED', colX[1], y + 7)
    doc.text(`KES ${fmt(totalCollected)}`, W - margin - 2, y + 7, { align: 'right' })

    pdfFooter(doc, W, margin)
    doc.save(`Saisambu-Ledger-${now.replace(/ /g, '-')}.pdf`)
  }

  // ── PDF: Invoices Report (date filtered) ──
  async function downloadInvoicesReport() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210, margin = 14
    const now = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
    const period = dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}` : `Up to ${formatDate(dateTo)}`

    pdfHeader(doc, W, margin, 'INVOICES REPORT', period, now)

    // Summary
    let y = 40
    const totalFiltInvoiced = filteredInvoices.reduce((s, r) => s + Number(r.total || 0), 0)
    const totalFiltDebt = filteredInvoices.reduce((s, r) => s + Number(r.balance || 0), 0)
    const totalFiltPaid = filteredInvoices.reduce((s, r) => s + Number(r.amount_paid || 0), 0)
    const totalFiltPayments = filteredPayments.reduce((s, r) => s + Number(r.payment_amount), 0)

    doc.setFillColor(240, 244, 248)
    doc.roundedRect(margin, y, W - margin * 2, 16, 2, 2, 'F')
    const sc = [
      ['TOTAL INVOICED', `KES ${fmt(totalFiltInvoiced)}`, [37, 99, 235]],
      ['PAYMENTS RECEIVED', `KES ${fmt(totalFiltPayments)}`, [22, 163, 74]],
      ['OUTSTANDING', `KES ${fmt(totalFiltDebt)}`, [220, 38, 38]],
    ]
    sc.forEach(([label, val, color], i) => {
      const x = margin + 6 + i * ((W - margin * 2) / 3)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 120)
      doc.text(label, x, y + 6)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...color)
      doc.text(val, x, y + 13)
    })

    // Invoices table
    y += 22
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 58, 92)
    doc.text('INVOICES', margin, y); y += 4
    const invHeaders = ['Invoice No', 'Client', 'Date', 'Total (KES)', 'Paid (KES)', 'Balance (KES)']
    const invColX = [margin + 2, margin + 30, margin + 96, margin + 128, margin + 155, W - margin - 2]
    y = pdfTableHeader(doc, invHeaders, invColX, y, W, margin)

    filteredInvoices.forEach((inv, idx) => {
      if (y > 265) {
        doc.addPage(); y = 16
        y = pdfTableHeader(doc, invHeaders, invColX, y, W, margin)
      }
      const cname = clientMap[inv.client_id] || '-'
      const bal = Number(inv.balance || 0)
      y = pdfRow(doc, [
        { text: inv.invoice_number || '-', bold: true, color: [232, 130, 26] },
        { text: cname.length > 22 ? cname.slice(0, 22) + '…' : cname },
        { text: formatDate(inv.date) },
        { text: fmt(inv.total || 0) },
        { text: fmt(inv.amount_paid || 0), color: [22, 163, 74] },
        { text: fmt(bal), bold: true, color: bal > 0 ? [220, 38, 38] : [22, 163, 74] },
      ], invColX, y, idx, W, margin, true)
    })

    // Payments table
    y += 10
    if (y > 250) { doc.addPage(); y = 16 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 58, 92)
    doc.text('PAYMENTS RECEIVED IN PERIOD', margin, y); y += 4
    const payHeaders = ['Date', 'Client', 'Method', 'Reference', 'Amount (KES)']
    const payColX = [margin + 2, margin + 26, margin + 88, margin + 130, W - margin - 2]
    y = pdfTableHeader(doc, payHeaders, payColX, y, W, margin)

    filteredPayments.forEach((p, idx) => {
      if (y > 272) {
        doc.addPage(); y = 16
        y = pdfTableHeader(doc, payHeaders, payColX, y, W, margin)
      }
      const ref = p.mpesa_code || p.cheque_no || p.bank_name || '-'
      y = pdfRow(doc, [
        { text: formatDate(p.date) },
        { text: p.client.length > 28 ? p.client.slice(0, 28) + '…' : p.client },
        { text: p.method_of_payment },
        { text: ref },
        { text: fmt(p.payment_amount), bold: true, color: [22, 163, 74] },
      ], payColX, y, idx, W, margin, true)
    })

    // Grand total
    doc.setFillColor(232, 130, 26)
    doc.rect(margin, y, W - margin * 2, 10, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
    doc.text('TOTAL PAYMENTS IN PERIOD', payColX[1], y + 7)
    doc.text(`KES ${fmt(totalFiltPayments)}`, W - margin - 2, y + 7, { align: 'right' })

    pdfFooter(doc, W, margin)
    doc.save(`Saisambu-Invoices-Report-${now.replace(/ /g, '-')}.pdf`)
  }

  // ── PDF: Client Statement ──
  async function downloadClientStatement(client) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210, margin = 14
    const now = new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })
    const clientPayments = (client.trackerPayments || []).sort((a, b) => a.date?.localeCompare(b.date))

    pdfHeader(doc, W, margin, 'CLIENT STATEMENT', client.name, now)

    // Client summary
    let y = 40
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(margin, y, W - margin * 2, 16, 2, 2, 'F')
    const sc = [
      ['TOTAL INVOICED', `KES ${fmt(client.invoiced)}`, [37, 99, 235]],
      ['TOTAL PAID', `KES ${fmt(client.paid)}`, [22, 163, 74]],
      ['OUTSTANDING', `KES ${fmt(client.balance)}`, client.balance > 0 ? [220, 38, 38] : [22, 163, 74]],
    ]
    sc.forEach(([label, val, color], i) => {
      const x = margin + 6 + i * ((W - margin * 2) / 3)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120, 120, 120)
      doc.text(label, x, y + 6)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...color)
      doc.text(val, x, y + 13)
    })

    // Invoices table
    y += 22
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 58, 92)
    doc.text('INVOICES', margin, y); y += 4
    const invHeaders = ['Invoice No', 'Date', 'Total (KES)', 'Paid (KES)', 'Balance (KES)']
    const invColX = [margin + 2, margin + 36, margin + 90, margin + 130, W - margin - 2]
    y = pdfTableHeader(doc, invHeaders, invColX, y, W, margin)

    client.invoiceList.forEach((inv, idx) => {
      if (y > 265) { doc.addPage(); y = 16; y = pdfTableHeader(doc, invHeaders, invColX, y, W, margin) }
      const bal = Number(inv.balance || 0)
      y = pdfRow(doc, [
        { text: inv.invoice_number || '-', bold: true, color: [232, 130, 26] },
        { text: formatDate(inv.date) },
        { text: fmt(inv.total || 0) },
        { text: fmt(inv.amount_paid || 0), color: [22, 163, 74] },
        { text: fmt(bal), bold: true, color: bal > 0 ? [220, 38, 38] : [22, 163, 74] },
      ], invColX, y, idx, W, margin, true)
    })

    // Payments table
    if (clientPayments.length > 0) {
      y += 10
      if (y > 250) { doc.addPage(); y = 16 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 58, 92)
      doc.text('PAYMENTS RECEIVED', margin, y); y += 4
      const payHeaders = ['Date', 'Method', 'Reference', 'Amount (KES)']
      const payColX = [margin + 2, margin + 36, margin + 92, W - margin - 2]
      y = pdfTableHeader(doc, payHeaders, payColX, y, W, margin)
      clientPayments.forEach((p, idx) => {
        if (y > 272) { doc.addPage(); y = 16; y = pdfTableHeader(doc, payHeaders, payColX, y, W, margin) }
        const ref = p.mpesa_code || p.cheque_no || p.bank_name || '-'
        y = pdfRow(doc, [
          { text: formatDate(p.date) },
          { text: p.method_of_payment },
          { text: ref },
          { text: fmt(p.payment_amount), bold: true, color: [22, 163, 74] },
        ], payColX, y, idx, W, margin, true)
      })
      // Total
      doc.setFillColor(232, 130, 26)
      doc.rect(margin, y, W - margin * 2, 10, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
      doc.text('TOTAL PAID', payColX[1], y + 7)
      doc.text(`KES ${fmt(clientPayments.reduce((s, p) => s + Number(p.payment_amount), 0))}`, W - margin - 2, y + 7, { align: 'right' })
      y += 10
    }

    // Balance due box
    if (client.balance > 0) {
      y += 8
      doc.setFillColor(254, 242, 242)
      doc.setDrawColor(220, 38, 38)
      doc.setLineWidth(0.5)
      doc.roundedRect(margin, y, W - margin * 2, 14, 2, 2, 'FD')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(220, 38, 38)
      doc.text('BALANCE DUE', margin + 6, y + 9)
      doc.setFontSize(12)
      doc.text(`KES ${fmt(client.balance)}`, W - margin - 6, y + 9, { align: 'right' })
    }

    // Payment details
    y += 22
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(margin, y, (W - margin * 2) / 2 - 4, 22, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(232, 130, 26)
    doc.text('KCB KENYA', margin + 6, y + 7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
    doc.text('Saisambu Security & Cleaning', margin + 6, y + 13)
    doc.text('A/C: 1320279570', margin + 6, y + 19)

    const col2 = margin + (W - margin * 2) / 2 + 2
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(col2, y, (W - margin * 2) / 2 - 2, 22, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(232, 130, 26)
    doc.text('EQUITY KENYA', col2 + 6, y + 7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80)
    doc.text('Saisambu Security & Cleaning', col2 + 6, y + 13)
    doc.text('A/C: 0280280919833', col2 + 6, y + 19)

    pdfFooter(doc, W, margin)
    doc.save(`Saisambu-Statement-${client.name.replace(/ /g, '-')}.pdf`)
  }

  const tabs = [
    { key: 'summary',  label: 'Summary'  },
    { key: 'invoices', label: 'Invoices' },
    { key: 'clients',  label: 'Clients'  },
    { key: 'monthly',  label: 'Monthly'  },
  ]

  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Reports</div>
        <button onClick={downloadLedger} style={{ padding: '6px 12px', borderRadius: 10, cursor: 'pointer', background: t.orangeBg, border: `1px solid ${t.orange}44` }}>
          <span style={{ fontSize: 12, color: t.orange, fontWeight: 700 }}>📊 Ledger</span>
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, background: t.surface, overflowX: 'auto' }}>
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => { setTab(tb.key); setSelectedClient(null) }}
            style={{ flex: 1, padding: '11px 4px', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: tab === tb.key ? `2px solid ${t.orange}` : '2px solid transparent',
              color: tab === tb.key ? t.orange : t.textMuted, fontWeight: tab === tb.key ? 700 : 500, fontSize: 12 }}>
            {tb.label}
          </button>
        ))}
      </div>

      <div style={{ paddingBottom: 90 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading reports...</div>

        ) : tab === 'summary' ? (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ ...s.statCard, background: t.purple, flex: 1.2 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>Total Collected</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 6 }}>KES {fmt(totalCollected)}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{payments.length} payments</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                <div style={{ ...s.statCard, background: t.card, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Total Invoiced</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.blue, marginTop: 4 }}>KES {fmt(totalInvoiced)}</div>
                </div>
                <div style={{ ...s.statCard, background: t.card, border: `1px solid ${t.border}` }}>
                  <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>Outstanding Debt</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: totalDebt > 0 ? t.red : t.green, marginTop: 4 }}>KES {fmt(totalDebt)}</div>
                </div>
              </div>
            </div>
            {totalInvoiced > 0 && (
              <div style={{ ...s.section, background: t.card, border: `1px solid ${t.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>Collection Rate</div>
                <div style={{ background: t.border, borderRadius: 8, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (totalCollected / totalInvoiced) * 100).toFixed(1)}%`, background: t.orange, height: '100%', borderRadius: 8 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: t.textMuted }}>Collected: {((totalCollected / totalInvoiced) * 100).toFixed(1)}%</span>
                  <span style={{ fontSize: 11, color: t.red }}>Remaining: {(100 - (totalCollected / totalInvoiced) * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
            <div style={{ ...s.section, background: t.card, border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 10, letterSpacing: 0.8, textTransform: 'uppercase' }}>By Payment Method</div>
              {Object.entries(payments.reduce((acc, p) => { acc[p.method_of_payment] = (acc[p.method_of_payment] || 0) + Number(p.payment_amount); return acc }, {}))
                .sort((a, b) => b[1] - a[1]).map(([method, amount]) => (
                  <div key={method} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: 13, color: t.text }}>{method}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.orange }}>KES {fmt(amount)}</span>
                  </div>
                ))}
              {payments.length === 0 && <div style={{ color: t.textMuted, fontSize: 12 }}>No payments recorded yet</div>}
            </div>
          </div>

        ) : tab === 'invoices' ? (
          <div style={{ paddingBottom: 10 }}>
            {/* Date filter bar */}
            <div style={{ padding: '12px 14px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Filter by Date</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 12, outline: 'none' }} />
                <span style={{ color: t.textMuted, fontSize: 12 }}>to</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontSize: 12, outline: 'none' }} />
                <button onClick={downloadInvoicesReport}
                  style={{ padding: '8px 12px', background: t.orange, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                  📄 PDF
                </button>
              </div>
            </div>

            {/* Summary strip */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px' }}>
              {[
                { label: 'INVOICED', value: filteredInvoices.reduce((s, r) => s + Number(r.total || 0), 0), color: t.blue },
                { label: 'COLLECTED', value: filteredPayments.reduce((s, r) => s + Number(r.payment_amount), 0), color: t.green },
                { label: 'OUTSTANDING', value: filteredInvoices.reduce((s, r) => s + Number(r.balance || 0), 0), color: t.red },
              ].map(item => (
                <div key={item.label} style={{ flex: 1, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 8px' }}>
                  <div style={{ fontSize: 8, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: item.color, marginTop: 3 }}>KES {fmt(item.value)}</div>
                </div>
              ))}
            </div>

            {/* Invoice list */}
            <div style={{ padding: '0 14px 6px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                {filteredInvoices.length} Invoice{filteredInvoices.length !== 1 ? 's' : ''}
              </div>
              {filteredInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: t.textMuted }}>No invoices in this period</div>
              ) : filteredInvoices.map((inv, i) => {
                const cname = clientMap[inv.client_id] || 'Unknown'
                const bal = Number(inv.balance || 0)
                return (
                  <div key={inv.id || i} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.orange }}>{inv.invoice_number}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 2 }}>{cname}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{formatDate(inv.date)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>KES {fmt(inv.total || 0)}</div>
                        <div style={{ fontSize: 10, marginTop: 4, padding: '2px 8px', borderRadius: 6, display: 'inline-block',
                          background: bal > 0 ? t.redBg : t.greenBg, color: bal > 0 ? t.red : t.green, fontWeight: 700 }}>
                          {bal > 0 ? `Owes KES ${fmt(bal)}` : '✓ Paid'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                      <div>
                        <div style={{ fontSize: 9, color: t.textMuted }}>PAID</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: t.green }}>KES {fmt(inv.amount_paid || 0)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: t.textMuted }}>BALANCE</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: bal > 0 ? t.red : t.green }}>KES {fmt(bal)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Payments in period */}
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>
                {filteredPayments.length} Payment{filteredPayments.length !== 1 ? 's' : ''} Received
              </div>
              {filteredPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: t.textMuted, fontSize: 12 }}>No payments in this period</div>
              ) : filteredPayments.map((p, i) => (
                <div key={p.id || i} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{p.client}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{p.method_of_payment} · {formatDate(p.date)}</div>
                    {(p.mpesa_code || p.cheque_no || p.bank_name) && (
                      <div style={{ fontSize: 10, color: t.textMuted }}>Ref: {p.mpesa_code || p.cheque_no || p.bank_name}</div>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.green }}>KES {fmt(p.payment_amount)}</div>
                </div>
              ))}
            </div>
          </div>

        ) : tab === 'clients' ? (
          selectedClient ? (
            <div style={{ paddingBottom: 90 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: t.surface, borderBottom: `1px solid ${t.border}` }}>
                <button onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: t.text }}>←</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{selectedClient.name}</div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>{selectedClient.invoiceCount} invoice{selectedClient.invoiceCount !== 1 ? 's' : ''}</div>
                </div>
                <button onClick={() => downloadClientStatement(selectedClient)}
                  style={{ padding: '7px 12px', background: t.orange, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  📄 PDF
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '12px 14px' }}>
                {[
                  { label: 'INVOICED', value: selectedClient.invoiced, color: t.blue },
                  { label: 'PAID', value: selectedClient.paid, color: t.green },
                  { label: 'BALANCE', value: selectedClient.balance, color: selectedClient.balance > 0 ? t.red : t.green },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 8px' }}>
                    <div style={{ fontSize: 9, color: t.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: item.color, marginTop: 4 }}>KES {fmt(item.value)}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 14px 6px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>Invoices</div>
                {selectedClient.invoiceList.length === 0 ? (
                  <div style={{ color: t.textMuted, fontSize: 12 }}>No invoices</div>
                ) : selectedClient.invoiceList.map((inv, i) => {
                  const bal = Number(inv.balance || 0)
                  return (
                    <div key={inv.id || i} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.orange }}>{inv.invoice_number}</div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>{formatDate(inv.date)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>KES {fmt(inv.total || 0)}</div>
                          <div style={{ fontSize: 10, marginTop: 2, padding: '2px 8px', borderRadius: 6, display: 'inline-block',
                            background: bal > 0 ? t.redBg : t.greenBg, color: bal > 0 ? t.red : t.green, fontWeight: 700 }}>
                            {bal > 0 ? `Owes KES ${fmt(bal)}` : '✓ Paid'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${t.border}` }}>
                        <div><div style={{ fontSize: 9, color: t.textMuted }}>PAID</div><div style={{ fontSize: 12, fontWeight: 700, color: t.green }}>KES {fmt(inv.amount_paid || 0)}</div></div>
                        <div><div style={{ fontSize: 9, color: t.textMuted }}>BALANCE</div><div style={{ fontSize: 12, fontWeight: 700, color: bal > 0 ? t.red : t.green }}>KES {fmt(bal)}</div></div>
                      </div>
                    </div>
                  )
                })}
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 }}>Payments Received</div>
                {!selectedClient.trackerPayments || selectedClient.trackerPayments.length === 0 ? (
                  <div style={{ color: t.textMuted, fontSize: 12 }}>No payments in tracker yet</div>
                ) : selectedClient.trackerPayments.sort((a, b) => b.date?.localeCompare(a.date)).map((p, i) => (
                  <div key={p.id || i} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{p.method_of_payment}</div>
                      <div style={{ fontSize: 11, color: t.textMuted }}>{formatDate(p.date)}</div>
                      {p.mpesa_code && <div style={{ fontSize: 10, color: t.textMuted }}>Code: {p.mpesa_code}</div>}
                      {p.cheque_no && <div style={{ fontSize: 10, color: t.textMuted }}>Cheque: {p.cheque_no}</div>}
                      {p.bank_name && <div style={{ fontSize: 10, color: t.textMuted }}>Bank: {p.bank_name}</div>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: t.green }}>KES {fmt(p.payment_amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ paddingBottom: 90 }}>
              <div style={{ padding: '10px 14px', fontSize: 11, color: t.textMuted }}>{clientRows.length} clients · Tap to view details</div>
              {clientRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>No client data yet</div>
              ) : clientRows.map(c => (
                <div key={c.name} onClick={() => setSelectedClient(c)}
                  style={{ ...s.clientRow, background: t.card, borderBottom: `1px solid ${t.border}`, cursor: 'pointer' }}>
                  <div style={{ ...s.clientIcon, background: t.orangeBg }}><span style={{ fontSize: 16 }}>🏢</span></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
                      {c.invoiceCount} invoice{c.invoiceCount !== 1 ? 's' : ''}
                      {c.trackerPayments?.length > 0 && ` · ${c.trackerPayments.length} payment${c.trackerPayments.length !== 1 ? 's' : ''}`}
                    </div>
                    {c.balance > 0 && <div style={{ fontSize: 11, color: t.red, marginTop: 2, fontWeight: 700 }}>Owes: KES {fmt(c.balance)}</div>}
                    {c.balance === 0 && c.invoiced > 0 && <div style={{ fontSize: 11, color: t.green, marginTop: 2, fontWeight: 700 }}>✓ Fully paid</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: t.orange }}>KES {fmt(c.invoiced)}</div>
                    <div style={{ fontSize: 10, color: t.textMuted }}>invoiced</div>
                    <div style={{ fontSize: 10, color: t.blue, marginTop: 4 }}>View →</div>
                  </div>
                </div>
              ))}
            </div>
          )

        ) : (
          <div style={{ padding: 16, paddingBottom: 90 }}>
            {months.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>No monthly data yet</div>
            ) : months.map(([month, amount]) => {
              const [yr, mo] = month.split('-')
              const label = new Date(Number(yr), Number(mo) - 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
              const pct = totalCollected > 0 ? (amount / totalCollected) * 100 : 0
              return (
                <div key={month} style={{ ...s.section, background: t.card, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: t.orange }}>KES {fmt(amount)}</span>
                  </div>
                  <div style={{ background: t.border, borderRadius: 6, height: 6 }}>
                    <div style={{ width: `${pct}%`, background: t.orange, height: '100%', borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 10, color: t.textMuted, marginTop: 4 }}>{pct.toFixed(1)}% of total</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statCard: { borderRadius: 12, padding: 14 },
  section: { borderRadius: 12, padding: 14, marginBottom: 12 },
  clientRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' },
  clientIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
