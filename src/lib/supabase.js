import { createClient } from '@supabase/supabase-js'

// Unified DB: saisambu_payments now lives in the same project as invoices/clients
export const supabase = createClient(
  'https://idtgdvfplupwxaihsavz.supabase.co',
  'sb_publishable_TXqLGVZci-cQjW0SeR-EkA_0gAQRv2D'
)

// Invoice Manager DB (same project — kept as a separate export so screens using invoiceDb still work)
export const invoiceDb = supabase
