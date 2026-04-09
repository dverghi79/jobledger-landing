// Vercel serverless function — Stripe payment webhook handler
// Verifies Stripe signatures server-side, then posts to SLACK_PAYMENT_WEBHOOK_URL.
// Required env vars (set per project in Vercel dashboard):
//   STRIPE_WEBHOOK_SECRET  — signing secret from Stripe dashboard (whsec_...)
//   SLACK_PAYMENT_WEBHOOK_URL — Slack incoming webhook URL for the payments channel
//   PRODUCT_NAME           — human-readable product name (e.g. "ReviewRadar")
import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Must receive raw body for Stripe signature verification
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const slackUrl = process.env.SLACK_PAYMENT_WEBHOOK_URL;

  if (!webhookSecret || !slackUrl) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET or SLACK_PAYMENT_WEBHOOK_URL');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  // Read raw body — required for HMAC verification
  let rawBody;
  try {
    rawBody = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      );
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  } catch {
    return res.status(400).json({ error: 'Failed to read body' });
  }

  // Fallback: if Vercel already parsed the body (edge case), re-serialize
  if (!rawBody && req.body) {
    rawBody = JSON.stringify(req.body);
  }

  // Parse Stripe-Signature header: t=<timestamp>,v1=<sig>
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  const parts = {};
  signature.split(',').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v !== undefined) parts[k] = v;
  });

  if (!parts.t || !parts.v1) {
    return res.status(400).json({ error: 'Invalid stripe-signature format' });
  }

  // Replay attack protection — reject events older than 5 minutes
  const timestampAge = Math.abs(Date.now() / 1000 - parseInt(parts.t, 10));
  if (timestampAge > 300) {
    return res.status(400).json({ error: 'Timestamp too old — possible replay attack' });
  }

  // HMAC-SHA256 verification
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${parts.t}.${rawBody}`, 'utf8')
    .digest('hex');

  try {
    const receivedBuf = Buffer.from(parts.v1, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (receivedBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch {
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  // Parse verified event
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Handle confirmed payment
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || 'unknown';
    const amountCents = session.amount_total ?? 0;
    const amount = (amountCents / 100).toFixed(2);
    const currency = (session.currency || 'usd').toUpperCase();
    const productName = process.env.PRODUCT_NAME || 'LeanAI Studio';

    const slackText =
      `💳 *New Founding Customer — ${productName}!*\n` +
      `*Email:* ${email}\n` +
      `*Amount:* ${currency} ${amount}/mo\n` +
      `*Session:* ${session.id}`;

    try {
      await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: slackText }),
      });
    } catch (err) {
      console.error('[stripe-webhook] Slack notification failed:', err);
    }
  }

  return res.status(200).json({ received: true });
}
