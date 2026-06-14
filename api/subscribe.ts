import type { IncomingMessage, ServerResponse } from "http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WELCOME_EMAIL_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">

      <tr><td style="background:#0a0a0a;padding:28px 32px">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0ea5e9">woitzik.dev</p>
        <h1 style="margin:8px 0 0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.2">Your Cheat Sheet is ready.</h1>
      </td></tr>

      <tr><td style="padding:32px">
        <p style="margin:0 0 20px;font-size:15px;color:#404040;line-height:1.6">
          Thanks for signing up. Here are the 8 Terraform patterns — NSGs, Private Endpoints, Managed Identities, Forced Tunneling, and the NIS2/ISO 27001 control map.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
          <tr><td align="center">
            <a href="https://woitzik.dev/downloads/azure-zero-trust-terraform-cheatsheet.html"
               style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:6px;text-decoration:none">
              Open Cheat Sheet &rarr;
            </a>
          </td></tr>
        </table>

        <p style="margin:0 0 12px;font-size:13px;color:#737373">
          <strong style="color:#404040">To save as PDF:</strong> Open the link above → Ctrl+P → Save as PDF → Paper A4 → enable "Background graphics".
        </p>

        <hr style="border:none;border-top:1px solid #e5e5e5;margin:28px 0">

        <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0a0a0a">What's on the site</p>
        <p style="margin:0 0 20px;font-size:13px;color:#737373;line-height:1.6">
          I publish deep technical articles on Azure Terraform, zero-trust networking, and compliance automation — and sell the hardened enterprise versions of the base patterns. No hand-wavy explanations, just code that deploys first time.
        </p>

        <p style="margin:0;font-size:13px;color:#737373">
          — David<br>
          <a href="https://woitzik.dev" style="color:#0ea5e9;text-decoration:none">woitzik.dev</a>
        </p>
      </td></tr>

      <tr><td style="background:#f5f5f5;padding:16px 32px;border-top:1px solid #e5e5e5">
        <p style="margin:0;font-size:11px;color:#a3a3a3">
          You signed up at woitzik.dev. &nbsp;
          <a href="https://woitzik.dev" style="color:#a3a3a3">Unsubscribe</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Access-Control-Allow-Origin", "https://woitzik.dev");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  let email: string;
  try {
    ({ email } = JSON.parse(body));
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Invalid request body" }));
    return;
  }

  if (!email || !EMAIL_RE.test(email)) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Valid email address required" }));
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Server configuration error" }));
    return;
  }

  const brevoHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  };

  // Add contact to list
  const contact: Record<string, unknown> = { email, updateEnabled: true };
  const listId = process.env.BREVO_LIST_ID
    ? parseInt(process.env.BREVO_LIST_ID)
    : null;
  if (listId) contact.listIds = [listId];

  const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify(contact),
  });

  if (contactRes.status !== 201 && contactRes.status !== 204) {
    const err = await contactRes.json().catch(() => ({}));
    console.error("Brevo contact error:", contactRes.status, err);
    res.writeHead(500);
    res.end(
      JSON.stringify({ error: "Failed to subscribe. Please try again." }),
    );
    return;
  }

  // Send Day-0 welcome email with cheat sheet link
  const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: brevoHeaders,
    body: JSON.stringify({
      sender: { name: "David Woitzik", email: "david@woitzik.dev" },
      to: [{ email }],
      subject: "Your Azure Zero-Trust Terraform Cheat Sheet",
      htmlContent: WELCOME_EMAIL_HTML,
    }),
  });

  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({}));
    console.error("Brevo email error:", emailRes.status, err);
    // Contact was created — still return success, email failure is non-critical
  }

  res.writeHead(200);
  res.end(JSON.stringify({ success: true }));
}
