// Vercel serverless function — Slack notification proxy
// Reads SLACK_WEBHOOK_URL from Vercel environment variables so the secret
// never appears in client-side code or the public GitHub repo.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[slack-notify] SLACK_WEBHOOK_URL env var not set');
    // Return 200 so the form still shows success to the user
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[slack-notify] fetch error:', err);
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
