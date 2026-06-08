import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fmt, formatDate, genReceiptNo } from '../lib/theme'
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

export default function ReceiptsScreen() {
  const { t } = useTheme()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(state?.record || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchRecords() }, [])

  async function fetchRecords() {
    setLoading(true)
    const { data } = await supabase.from('saisambu_payments').select('*').order('date', { ascending: false })
    setRecords(data || [])
    setLoading(false)
  }

  function shareWhatsApp(r) {
    const rno = genReceiptNo()
    const msg =
`🛡️ *${COMPANY.name}*
${COMPANY.motto}

🧾 *OFFICIAL PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━
*Receipt No:* ${rno}
*Date:* ${formatDate(r.date)}
*Client:* ${r.client}
*Amount:* KES ${fmt(r.payment_amount)}
*Method:* ${r.method_of_payment}${r.mpesa_code ? `\n*M-Pesa Code:* ${r.mpesa_code}` : ''}${r.cheque_no ? `\n*Cheque No:* ${r.cheque_no}` : ''}${r.cheque_date ? `\n*Cheque Date:* ${formatDate(r.cheque_date)}` : ''}${r.bank_name ? `\n*Bank:* ${r.bank_name}` : ''}${r.bank_date ? `\n*Transfer Date:* ${formatDate(r.bank_date)}` : ''}
━━━━━━━━━━━━━━━━━━━━
_Thank you for your payment._
📍 ${COMPANY.address}
📞 ${COMPANY.tel}
✉️ ${COMPANY.email}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function downloadPDF(r) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const margin = 18
    const rno = genReceiptNo()

    // ── Header background ──
    doc.setFillColor(240, 244, 248)
    doc.rect(0, 0, W, 52, 'F')

    // Orange accent bar at top
    doc.setFillColor(232, 130, 26)
    doc.rect(0, 0, W, 3, 'F')

    // Logo
    doc.addImage(LOGO_B64, 'JPEG', margin, 7, 26, 26)

    // Company name block
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(26, 58, 92)
    doc.text(COMPANY.name, margin + 30, 15)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(COMPANY.address, margin + 30, 21)
    doc.text(`Tel: ${COMPANY.tel}  |  Email: ${COMPANY.email}`, margin + 30, 27)
    doc.text(`KRA PIN: ${COMPANY.kra}`, margin + 30, 33)

    // INVOICE label (right side)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(232, 130, 26)
    doc.text('RECEIPT', W - margin, 20, { align: 'right' })

    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`No: ${rno}`, W - margin, 28, { align: 'right' })
    doc.text(`Date: ${formatDate(r.date)}`, W - margin, 34, { align: 'right' })

    // Motto
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(232, 130, 26)
    doc.text(COMPANY.motto, margin + 30, 41)

    // ── Bill To ──
    let y = 60
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('RECEIVED FROM', margin + 6, y + 7)
    doc.setFontSize(13)
    doc.setTextColor(255, 255, 255)
    doc.text(r.client, margin + 6, y + 15)

    // ── Payment details table ──
    y += 28
    const rows = [
      ['Amount Received', `KES ${fmt(r.payment_amount)}`],
      ['Payment Method', r.method_of_payment],
      ['Payment Date', formatDate(r.date)],
      ...(r.mpesa_code  ? [['M-Pesa Code',    r.mpesa_code]]             : []),
      ...(r.cheque_no   ? [['Cheque No',       r.cheque_no]]              : []),
      ...(r.cheque_date ? [['Cheque Date',     formatDate(r.cheque_date)]] : []),
      ...(r.bank_name   ? [['Bank',            r.bank_name]]              : []),
      ...(r.bank_date   ? [['Transfer Date',   formatDate(r.bank_date)]]  : []),
    ]

    // Table header
    doc.setFillColor(232, 130, 26)
    doc.roundedRect(margin, y, W - margin * 2, 9, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('PAYMENT DETAILS', margin + 6, y + 6)
    y += 9

    rows.forEach(([label, val], i) => {
      const even = i % 2 === 0
      doc.setFillColor(even ? 30 : 26, even ? 33 : 29, even ? 48 : 43)
      doc.rect(margin, y, W - margin * 2, 10, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(160, 160, 160)
      doc.text(label, margin + 6, y + 6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(label === 'Amount Received' ? 232 : 240, label === 'Amount Received' ? 130 : 240, label === 'Amount Received' ? 26 : 240)
      doc.text(val, W - margin - 6, y + 6.5, { align: 'right' })
      y += 10
    })

    // ── Total band ──
    y += 4
    doc.setFillColor(232, 130, 26)
    doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text('TOTAL PAID', margin + 8, y + 10.5)
    doc.setFontSize(14)
    doc.text(`KES ${fmt(r.payment_amount)}`, W - margin - 8, y + 10.5, { align: 'right' })

    // ── Payment bank details ──
    y += 24
    doc.setFillColor(243, 246, 250)
    doc.roundedRect(margin, y, (W - margin * 2) / 2 - 4, 28, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(232, 130, 26)
    doc.text('KCB KENYA', margin + 6, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Saisambu Security & Cleaning', margin + 6, y + 14)
    doc.text('A/C: 1320279570', margin + 6, y + 20)

    const col2 = margin + (W - margin * 2) / 2 + 2
    doc.setFillColor(243, 246, 250)
    doc.roundedRect(col2, y, (W - margin * 2) / 2 - 2, 28, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(232, 130, 26)
    doc.text('EQUITY KENYA', col2 + 6, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Saisambu Security & Cleaning', col2 + 6, y + 14)
    doc.text('A/C: 0280280919833', col2 + 6, y + 20)

    // ── Footer ──
    y += 36
    doc.setDrawColor(50, 55, 70)
    doc.line(margin, y, W - margin, y)
    y += 6
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(120, 120, 120)
    doc.text('This is an official receipt. Thank you for your business.', W / 2, y, { align: 'center' })
    doc.text(`Main Office: Kericho, Kenya  |  ${COMPANY.motto}  |  ${COMPANY.email}`, W / 2, y + 6, { align: 'center' })

    // Orange bottom bar
    doc.setFillColor(232, 130, 26)
    doc.rect(0, 294, W, 3, 'F')

    doc.save(`Saisambu-Receipt-${rno}.pdf`)
  }

  // ── Receipt detail view ──
  if (selected) {
    return (
      <div style={{ ...s.page, background: t.bg, color: t.text }}>
        <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => setSelected(null)} style={{ ...s.backBtn, color: t.text }}>←</button>
          <span style={{ fontSize: 17, fontWeight: 800 }}>Receipt</span>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ padding: 16, paddingBottom: 90 }}>
          {/* Receipt card */}
          <div style={{ ...s.receipt, background: t.card, border: `1px solid ${t.border}` }}>
            {/* Receipt header with logo */}
            <div style={{ ...s.receiptHeader, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src="/logo.jpg" alt="Saisambu Logo" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', background: '#fff', padding: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: t.orange }}>{COMPANY.name}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>{COMPANY.address}</div>
                  <div style={{ fontSize: 10, color: t.textMuted }}>Tel: {COMPANY.tel}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 9, color: t.textMuted }}>RECEIVED FROM</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{selected.client}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: t.textMuted }}>RECEIPT DATE</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{formatDate(selected.date)}</div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div style={{ padding: '0 16px 16px' }}>
              {[
                ['Amount', `KES ${fmt(selected.payment_amount)}`],
                ['Method', selected.method_of_payment],
                ...(selected.mpesa_code  ? [['M-Pesa Code',  selected.mpesa_code]]              : []),
                ...(selected.cheque_no  ? [['Cheque No',     selected.cheque_no]]               : []),
                ...(selected.cheque_date? [['Cheque Date',   formatDate(selected.cheque_date)]] : []),
                ...(selected.bank_name  ? [['Bank',          selected.bank_name]]               : []),
                ...(selected.bank_date  ? [['Transfer Date', formatDate(selected.bank_date)]]   : []),
              ].map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ fontSize: 12, color: t.textMuted }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: k === 'Amount' ? t.orange : t.text }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: t.orange, borderRadius: 10, padding: '12px 14px', marginTop: 14 }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>TOTAL PAID</span>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>KES {fmt(selected.payment_amount)}</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 10, color: t.textMuted, textAlign: 'center', fontStyle: 'italic' }}>
                {COMPANY.motto} · {COMPANY.email}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => shareWhatsApp(selected)}
              style={{ ...s.actionBtn, background: '#25D366', flex: 1 }}>
              📲 WhatsApp
            </button>
            <button onClick={() => downloadPDF(selected)}
              style={{ ...s.actionBtn, background: t.orange, flex: 1 }}>
              📄 PDF
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── List view ──
  return (
    <div style={{ ...s.page, background: t.bg, color: t.text }}>
      <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Receipts</div>
      </div>
      <div style={{ paddingBottom: 90 }}>
        <div style={{ padding: '10px 14px', fontSize: 12, color: t.textMuted }}>
          Tap a payment to view and share its receipt
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: t.textMuted }}>Loading...</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: t.textMuted }}>
            <div style={{ fontSize: 40 }}>🧾</div>
            <div style={{ marginTop: 8 }}>No payments yet</div>
          </div>
        ) : records.map(r => (
          <div key={r.id} onClick={() => setSelected(r)}
            style={{ ...s.row, background: t.card, borderBottom: `1px solid ${t.border}` }}>
            <div style={{ ...s.rowIcon, background: t.orangeBg }}>
              <img src="/logo.jpg" alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', background: '#fff', padding: 1 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{r.client}</div>
              <div style={{ fontSize: 11, color: t.textMuted }}>{formatDate(r.date)} · {r.method_of_payment}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: t.orange }}>KES {fmt(r.payment_amount)}</div>
              <div style={{ fontSize: 10, color: t.blue, marginTop: 2 }}>View →</div>
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  header: { padding: '48px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' },
  rowIcon: { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  receipt: { borderRadius: 14, overflow: 'hidden' },
  receiptHeader: { padding: 16 },
  actionBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
}
