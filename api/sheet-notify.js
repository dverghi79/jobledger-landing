// Vercel serverless function — Google Sheet proxy
// Reads GOOGLE_SHEET_WEBHOOK_URL and SHEET_SECRET from Vercel environment
// variables so neither the webhook URL nor the shared secret ever appear
// in client-side code or the public GitHub repo.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    // Silently succeed — sheet not configured yet for this product
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  // Inject the shared secret server-side — never expose it to the client
  const payload = {
    ...req.body,
    secret: process.env.SHEET_SECRET || '',
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[sheet-notify] fetch error:', err);
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
