export const DARK = {
  bg: '#0F1117', surface: '#1A1D27', card: '#1E2130', cardHover: '#252838',
  border: '#2A2D3E', borderLight: '#353849',
  orange: '#E8821A', orangeLight: '#F5A54A', orangeBg: 'rgba(232,130,26,0.12)',
  purple: '#6C63FF', purpleBg: 'rgba(108,99,255,0.15)',
  green: '#22C55E', greenBg: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redBg: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueBg: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberBg: 'rgba(245,158,11,0.12)',
  text: '#F1F5F9', textSub: '#94A3B8', textMuted: '#64748B', white: '#FFFFFF',
}

export const LIGHT = {
  bg: '#F0F4F8', surface: '#FFFFFF', card: '#FFFFFF', cardHover: '#F8FAFC',
  border: '#E2E8F0', borderLight: '#CBD5E1',
  orange: '#E8821A', orangeLight: '#F5A54A', orangeBg: 'rgba(232,130,26,0.10)',
  purple: '#6C63FF', purpleBg: 'rgba(108,99,255,0.10)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.10)',
  red: '#DC2626', redBg: 'rgba(220,38,38,0.10)',
  blue: '#2563EB', blueBg: 'rgba(37,99,235,0.10)',
  amber: '#D97706', amberBg: 'rgba(217,119,6,0.10)',
  text: '#0F172A', textSub: '#475569', textMuted: '#94A3B8', white: '#FFFFFF',
}

export const METHODS = ['M-Pesa', 'Bank Transfer', 'Cheque', 'Cash', 'Other']

// Maps display labels to the DB's payments.payment_method check-constraint values
export const METHOD_TO_DB = {
  'M-Pesa': 'mpesa',
  'Bank Transfer': 'bank_transfer',
  'Cheque': 'cheque',
  'Cash': 'cash',
  'Other': 'other',
}
export const METHOD_FROM_DB = {
  mpesa: 'M-Pesa',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  cash: 'Cash',
  other: 'Other',
}

export const METHOD_COLORS = (t) => ({
  'M-Pesa':        { bg: t.greenBg,  text: t.green  },
  'Bank Transfer': { bg: t.blueBg,   text: t.blue   },
  'Cheque':        { bg: t.amberBg,  text: t.amber  },
  'Cash':          { bg: t.orangeBg, text: t.orange },
  'Other':         { bg: t.purpleBg, text: t.purple },
})

export const fmt = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtShort = (n) =>
  Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })

export const today = () => new Date().toISOString().split('T')[0]

export const formatDate = (d) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const genReceiptNo = () => {
  const now = new Date()
  return `RCP-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`
}
