export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const SLACK_URL = process.env.SLACK_WEBHOOK_URL;
  if (!SLACK_URL) return res.status(500).json({ error: 'SLACK_WEBHOOK_URL not configured' });
  try {
    const resp = await fetch(SLACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    res.status(resp.status).json({ ok: resp.ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
