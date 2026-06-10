-- Run this in your Supabase SQL Editor to add new payment detail columns

ALTER TABLE saisambu_payments
  ADD COLUMN IF NOT EXISTS mpesa_code   TEXT,
  ADD COLUMN IF NOT EXISTS cheque_no    TEXT,
  ADD COLUMN IF NOT EXISTS cheque_date  DATE,
  ADD COLUMN IF NOT EXISTS bank_name    TEXT,
  ADD COLUMN IF NOT EXISTS bank_date    DATE;
