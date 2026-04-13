module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[slack-notify] SLACK_WEBHOOK_URL env var not set');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const text = await r.text();
    if (text !== 'ok') {
      console.error('[slack-notify] Slack error:', text);
      return res.status(200).json({ ok: false, reason: text });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[slack-notify] fetch error:', err);
    return res.status(200).json({ ok: false, reason: 'fetch_failed' });
  }
};
