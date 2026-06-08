import { createClient } from '@supabase/supabase-js'

// Payment Tracker DB
export const supabase = createClient(
  'https://xkhtdlconhewefftaatf.supabase.co',
  'sb_publishable_eFSdpDef041urzcK4Vl3Yg_4O-c_g7G'
)

// Invoice Manager DB (read-only for reports)
export const invoiceDb = createClient(
  'https://idtgdvfplupwxaihsavz.supabase.co',
  'sb_publishable_TXqLGVZci-cQjW0SeR-EkA_0gAQRv2D'
)
