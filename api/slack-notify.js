// Vercel serverless function — Slack signup notification proxy
// Reads SLACK_SIGNUP_WEBHOOK_URL from Vercel environment variables so the secret
// never appears in client-side code or the public GitHub repo.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const webhookUrl = process.env.SLACK_SIGNUP_WEBHOOK_URL;
  if (!webhookUrl) {
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
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
}
