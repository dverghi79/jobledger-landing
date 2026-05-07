// resend-notify.js — JobLedger LP
// Required env vars: RESEND_API_KEY, RESEND_FROM_EMAIL, CONTACT_EMAIL
// RESEND_SEGMENT_ID defaults to the JobLedger waitlist segment if not overridden.

const PRODUCT_SEGMENT_ID = 'd52a3ea3-5264-4772-bd55-1e80ef571379'; // Waitlist-JobLedger

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[resend-notify] RESEND_API_KEY env var not set');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Dario - LeanAI Studio <dario@leanaistudio.com>';
  const contactEmail = process.env.CONTACT_EMAIL || 'contact@leanaistudio.com';
  const segmentId = process.env.RESEND_SEGMENT_ID || PRODUCT_SEGMENT_ID;

  const { email, first_name, product } = req.body || {};
  if (!email) {
    return res.status(200).json({ ok: false, reason: 'missing_email' });
  }

  const productName = product || 'JobLedger';
  const firstName = first_name || '';
  const greeting = firstName ? 'Hi ' + firstName + ',' : 'Hi there,';

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const results = {};

  // Step 1: Create contact in Resend
  try {
    const contactPayload = {
      email: email,
      first_name: firstName || undefined,
      unsubscribed: false,
      properties: {
        source: productName,
        product: productName,
        signed_up_at: new Date().toISOString(),
      },
      segments: [segmentId],
    };

    const contactRes = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contactPayload),
    });
    const contactJson = await contactRes.json();
    results.contact = { status: contactRes.status, body: contactJson };
    if (!contactRes.ok) {
      console.error('[resend-notify] Contact creation error:', JSON.stringify(contactJson));
    }
  } catch (err) {
    console.error('[resend-notify] Contact fetch error:', err);
    results.contact = { error: err.message };
  }

  await delay(1100);

  // Step 2: Send welcome email to subscriber (via Resend template)
  try {
    const welcomeRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        template: {
          id: 'waitlist-confirmation',
          variables: {
            PRODUCT_NAME: productName,
            GREETING: greeting,
          },
        },
      }),
    });
    const welcomeJson = await welcomeRes.json();
    results.welcome = { status: welcomeRes.status, body: welcomeJson };
    if (!welcomeRes.ok) {
      console.error('[resend-notify] Welcome email error:', JSON.stringify(welcomeJson));
    }
  } catch (err) {
    console.error('[resend-notify] Welcome email fetch error:', err);
    results.welcome = { error: err.message };
  }

  await delay(1100);

  // Step 3: Send notification email to site owner
  try {
    const notifyRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [contactEmail],
        subject: '[' + productName + '] New waitlist signup: ' + email,
        html: '<p><strong>New waitlist signup</strong></p><p><strong>Product:</strong> ' + productName + '</p><p><strong>Email:</strong> ' + email + '</p><p><strong>Name:</strong> ' + (firstName || 'n/a') + '</p>',
      }),
    });
    const notifyJson = await notifyRes.json();
    results.notify = { status: notifyRes.status, body: notifyJson };
    if (!notifyRes.ok) {
      console.error('[resend-notify] Notify email error:', JSON.stringify(notifyJson));
    }
  } catch (err) {
    console.error('[resend-notify] Notify fetch error:', err);
    results.notify = { error: err.message };
  }

  return res.status(200).json({ ok: true, results });
};
