import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/ThemeContext'
import { fmt, formatDate, genReceiptNo, METHOD_FROM_DB } from '../lib/theme'
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
  const [sharing, setSharing] = useState(false)

  useEffect(() => { fetchRecords() }, [])

  async function fetchRecords() {
    setLoading(true)
    const { data } = await supabase.from('payments').select('*').order('payment_date', { ascending: false })
    setRecords((data || []).map(p => ({
      ...p,
      method_of_payment: METHOD_FROM_DB[p.payment_method] || 'Other',
      payment_amount: p.amount,
      date: p.payment_date,
    })))
    setLoading(false)
  }

  // Builds the receipt PDF and returns { blob, filename }
  async function buildReceiptPDF(r) {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const margin = 18
    const rno = genReceiptNo()

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
    doc.text('RECEIPT', W - margin, 16, { align: 'right' })

    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`No: ${rno}`, W - margin, 23, { align: 'right' })
    doc.text(`Date: ${formatDate(r.date)}`, W - margin, 29, { align: 'right' })

    doc.setDrawColor(232, 130, 26)
    doc.setLineWidth(0.5)
    doc.line(margin, 34, W - margin, 34)

    let y = 44
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(margin, y, W - margin * 2, 20, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('RECEIVED FROM', margin + 6, y + 7)
    doc.setFontSize(13)
    doc.setTextColor(26, 58, 92)
    doc.text(r.client, margin + 6, y + 15)

    y += 28
    const rows = [
      ['Amount Received', `KES ${fmt(r.payment_amount)}`],
      ['Payment Method', r.method_of_payment],
      ['Payment Date', formatDate(r.date)],
      ...(r.mpesa_code  ? [['M-Pesa Code',  r.mpesa_code]]              : []),
      ...(r.cheque_no   ? [['Cheque No',    r.cheque_no]]               : []),
      ...(r.cheque_date ? [['Cheque Date',  formatDate(r.cheque_date)]] : []),
      ...(r.bank_name   ? [['Bank',         r.bank_name]]               : []),
      ...(r.bank_date   ? [['Transfer Date',formatDate(r.bank_date)]]   : []),
    ]

    doc.setFillColor(26, 58, 92)
    doc.roundedRect(margin, y, W - margin * 2, 9, 1, 1, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text('PAYMENT DETAILS', margin + 6, y + 6)
    y += 9

    rows.forEach(([label, val], i) => {
      const even = i % 2 === 0
      doc.setFillColor(even ? 248 : 255, even ? 250 : 255, even ? 252 : 255)
      doc.rect(margin, y, W - margin * 2, 10, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(100, 100, 100)
      doc.text(label, margin + 6, y + 6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(label === 'Amount Received' ? 232 : 40, label === 'Amount Received' ? 130 : 40, label === 'Amount Received' ? 26 : 40)
      doc.text(val, W - margin - 6, y + 6.5, { align: 'right' })
      y += 10
    })

    y += 4
    doc.setFillColor(232, 130, 26)
    doc.roundedRect(margin, y, W - margin * 2, 16, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text('TOTAL PAID', margin + 8, y + 10.5)
    doc.setFontSize(14)
    doc.text(`KES ${fmt(r.payment_amount)}`, W - margin - 8, y + 10.5, { align: 'right' })

    y += 24
    doc.setFillColor(240, 244, 248)
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
    doc.setFillColor(240, 244, 248)
    doc.roundedRect(col2, y, (W - margin * 2) / 2 - 2, 28, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(232, 130, 26)
    doc.text('EQUITY KENYA', col2 + 6, y + 8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Saisambu Security & Cleaning', col2 + 6, y + 14)
    doc.text('A/C: 0280280919833', col2 + 6, y + 20)

    y += 36
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, W - margin, y)
    y += 6
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8.5)
    doc.setTextColor(140, 140, 140)
    doc.text('This is an official receipt. Thank you for your business.', W / 2, y, { align: 'center' })
    doc.text(`Main Office: Kericho, Kenya  |  ${COMPANY.motto}  |  ${COMPANY.email}`, W / 2, y + 6, { align: 'center' })

    doc.setFillColor(232, 130, 26)
    doc.rect(0, 294, W, 3, 'F')

    const filename = `Saisambu-Receipt-${rno}.pdf`
    const blob = doc.output('blob')
    return { blob, filename, doc }
  }

  async function downloadPDF(r) {
    const { doc, filename } = await buildReceiptPDF(r)
    doc.save(filename)
  }

  // Tries native share sheet (sends actual PDF file via WhatsApp/etc).
  // Falls back to wa.me text-only link if file sharing isn't supported.
  async function shareReceipt(r) {
    setSharing(true)
    try {
      const { blob, filename } = await buildReceiptPDF(r)
      const file = new File([blob], filename, { type: 'application/pdf' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Saisambu Payment Receipt',
          text: `Receipt for ${r.client} — KES ${fmt(r.payment_amount)}`,
        })
      } else {
        // Fallback: download the PDF, then open WhatsApp with a text summary
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)

        const msg = `🛡️ *${COMPANY.name}*\n${COMPANY.motto}\n\n🧾 *PAYMENT RECEIPT*\nClient: ${r.client}\nAmount: KES ${fmt(r.payment_amount)}\nMethod: ${r.method_of_payment}\nDate: ${formatDate(r.date)}\n\n_PDF receipt downloaded — please attach it manually in WhatsApp._`
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
      }
    } catch (err) {
      // Same fallback as invoices: some browsers/in-app webviews block file sharing.
      if (err.name !== 'AbortError') {
        try {
          const { blob, filename } = await buildReceiptPDF(r)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
          const msg = `🛡️ *${COMPANY.name}*\n${COMPANY.motto}\n\n🧾 *PAYMENT RECEIPT*\nClient: ${r.client}\nAmount: KES ${fmt(r.payment_amount)}\nMethod: ${r.method_of_payment}\nDate: ${formatDate(r.date)}\n\n_PDF receipt downloaded — please attach it manually in WhatsApp._`
          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
        } catch (fallbackErr) {
          alert('Could not generate the PDF: ' + fallbackErr.message)
        }
      }
    } finally {
      setSharing(false)
    }
  }

  if (selected) {
    return (
      <div style={{ ...s.page, background: t.bg, color: t.text }}>
        <div style={{ ...s.header, background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          <button onClick={() => setSelected(null)} style={{ ...s.backBtn, color: t.text }}>←</button>
          <span style={{ fontSize: 17, fontWeight: 800 }}>Receipt</span>
          <div style={{ width: 36 }} />
        </div>

        <div style={{ padding: 16, paddingBottom: 90 }}>
          <div style={{ ...s.receipt, background: t.card, border: `1px solid ${t.border}` }}>
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

            <div style={{ padding: '0 16px 16px' }}>
              {[
                ['Amount', `KES ${fmt(selected.payment_amount)}`],
                ['Method', selected.method_of_payment],
                ...(selected.mpesa_code  ? [['M-Pesa Code',  selected.mpesa_code]]              : []),
                ...(selected.cheque_no  ? [['Cheque No',     selected.cheque_no]]               : []),
                ...(selected.cheque_date? [['Cheque Date',   formatDate(selected.cheque_date)]] : []),
                ...(selected.bank_name  ? [['Bank',          selected.bank_name]]               : []),
                ...(selected.bank_date  ? [['Transfer Date', formatDate(selected.bank_date)]]   : []),
              ].map(([k, v]) => (
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

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => shareReceipt(selected)} disabled={sharing}
              style={{ ...s.actionBtn, background: '#25D366', flex: 1, opacity: sharing ? 0.7 : 1 }}>
              {sharing ? 'Preparing...' : '📲 Share PDF'}
            </button>
            <button onClick={() => downloadPDF(selected)}
              style={{ ...s.actionBtn, background: t.orange, flex: 1 }}>
              📄 Download
            </button>
          </div>
          <div style={{ fontSize: 10, color: t.textMuted, textAlign: 'center', marginTop: 10 }}>
            "Share PDF" opens your phone's share sheet — pick WhatsApp to send the actual file.
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

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
