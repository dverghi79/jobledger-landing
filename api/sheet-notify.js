// Vercel serverless function — Google Sheet notification proxy
// Reads GOOGLE_SHEET_WEBHOOK_URL and SHEET_SECRET from Vercel env vars.
// Injects the real GAS shared secret before forwarding — never exposes it client-side.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[sheet-notify] GOOGLE_SHEET_WEBHOOK_URL not set');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }
  const sheetSecret = process.env.SHEET_SECRET;
  // Replace whatever per-product secret the form sent with the real GAS shared secret
  const payload = Object.assign({}, req.body, sheetSecret ? { secret: sheetSecret } : {});
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { json = { raw: text }; }
    if (json && json.ok === false) {
      console.error('[sheet-notify] GAS error:', text);
      return res.status(200).json({ ok: false, reason: text });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[sheet-notify] fetch error:', err);
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
};
