module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[resend-notify] RESEND_API_KEY env var not set');
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'LeanAI Studio <noreply@leanaistudio.com>';
  const contactEmail = process.env.CONTACT_EMAIL || 'contact@leanaistudio.com';
  const audienceId = process.env.RESEND_AUDIENCE_ID || null;

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
    };
    // Pass product name as source so Resend audience shows where each contact came from
    contactPayload.properties = {
      source: productName,
      signed_up_at: new Date().toISOString(),
    };
    if (audienceId) {
      contactPayload.audience_id = audienceId;
    }

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

  // Step 2: Send welcome email to subscriber
  try {
    const welcomeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the ${productName} waitlist</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:32px 40px;">
              <p style="margin:0;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;opacity:0.85;">LeanAI Studio</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">You're on the ${productName} waitlist!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">${greeting}</p>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                You're officially on the early access list for <strong>${productName}</strong>. We'll reach out as soon as spots open up.
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                As one of the first to sign up, you'll receive <strong>founding member pricing</strong> when we launch. We're building ${productName} to be genuinely useful for the teams that need it most, and your interest means a lot.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                We may reach out for a quick conversation to make sure we're building the right thing. If you're open to that, just reply to this email.
              </p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);border-radius:8px;">
                    <a href="https://leanaistudio.com/blog" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">Read our build-in-public updates</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#374151;font-size:16px;line-height:1.6;">Talk soon,</p>
              <p style="margin:0;color:#374151;font-size:16px;font-weight:600;line-height:1.6;">Dario</p>
              <p style="margin:0;color:#6b7280;font-size:14px;">Founder, LeanAI Studio</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
                You're receiving this because you signed up for the ${productName} waitlist at leanaistudio.com.<br>
                <a href="https://leanaistudio.com" style="color:#6366f1;text-decoration:none;">leanaistudio.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const welcomeRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "You're on the " + productName + " waitlist!",
        html: welcomeHtml,
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
