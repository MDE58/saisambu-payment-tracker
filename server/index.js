const express = require('express')
const path = require('path')
const ejs = require('ejs')
const puppeteer = require('puppeteer')
const AWS = require('aws-sdk')
const Twilio = require('twilio')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(express.json())

const {
  PORT = 4000,
  S3_BUCKET,
  S3_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  COMPANY_NAME = '',
  COMPANY_ADDRESS = ''
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Server cannot fetch invoices without them.')
}

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: S3_REGION,
})

const s3 = new AWS.S3()
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) ? Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null

async function renderInvoiceHtml(invoice, client, company = {}) {
  const templatePath = path.join(__dirname, 'templates', 'invoice.ejs')
  return ejs.renderFile(templatePath, { invoice, client, company })
}

async function htmlToPdfBuffer(html) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
  await browser.close()
  return pdfBuffer
}

async function uploadPdfToS3(buffer, key) {
  if (!S3_BUCKET) throw new Error('S3_BUCKET not configured')
  await s3.putObject({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
    ACL: 'private',
  }).promise()

  // presigned URL 1 hour
  const url = s3.getSignedUrl('getObject', { Bucket: S3_BUCKET, Key: key, Expires: 60 * 60 })
  return url
}

app.post('/api/invoices/:id/send', async (req, res) => {
  try {
    const invoiceId = req.params.id

    if (!supabase) return res.status(500).json({ error: 'Supabase server client not configured' })

    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invErr || !invData) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    const { data: clientData, error: clientErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', invData.client_id)
      .single()

    if (clientErr || !clientData) {
      return res.status(404).json({ error: 'Client not found' })
    }

    // Ensure invoice items is an array (Supabase might store JSON)
    try {
      if (typeof invData.items === 'string') invData.items = JSON.parse(invData.items)
    } catch (e) {
      // ignore
    }

    const html = await renderInvoiceHtml(invData, clientData, { name: COMPANY_NAME, address: COMPANY_ADDRESS })
    const pdfBuffer = await htmlToPdfBuffer(html)

    const safeNumber = (invData.invoice_number || invoiceId).toString().replace(/[^a-zA-Z0-9_-]/g, '_')
    const key = `invoices/${safeNumber}-${invoiceId}.pdf`
    const pdfUrl = await uploadPdfToS3(pdfBuffer, key)

    if (!twilioClient) {
      return res.json({ success: true, url: pdfUrl, warning: 'Twilio not configured; PDF generated and uploaded but not sent.' })
    }

    const to = clientData.phone && clientData.phone.startsWith('whatsapp:') ? clientData.phone : `whatsapp:${clientData.phone}`
    const from = TWILIO_WHATSAPP_NUMBER
    const body = `Hello ${clientData.name || ''}, here is your invoice ${invData.invoice_number || ''}.`

    await twilioClient.messages.create({ from, to, body, mediaUrl: [pdfUrl] })

    return res.json({ success: true, url: pdfUrl })
  } catch (err) {
    console.error('send-invoice-error', err)
    return res.status(500).json({ error: err.message })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`Invoice server listening on ${PORT}`))
