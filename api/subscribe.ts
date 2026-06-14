import type { IncomingMessage, ServerResponse } from "http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SENDER = { name: "David Woitzik", email: "david@woitzik.dev" };

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function emailBody(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%">
      <tr><td style="background:#0a0a0a;padding:20px 32px">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0ea5e9">woitzik.dev</p>
      </td></tr>
      <tr><td style="padding:32px;font-size:15px;color:#404040;line-height:1.7">${content}</td></tr>
      <tr><td style="background:#f5f5f5;padding:14px 32px;border-top:1px solid #e5e5e5">
        <p style="margin:0;font-size:11px;color:#a3a3a3">You signed up at woitzik.dev.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const DAY0_SUBJECT = "Your Azure Zero-Trust Terraform Cheat Sheet";
const DAY0_BODY = emailBody(`
  <p style="margin:0 0 16px">Thanks for signing up. Here are the 8 Terraform patterns — NSGs, Private Endpoints, Managed Identities, Forced Tunneling, and the NIS2/ISO 27001 control map.</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td align="center">
      <a href="https://woitzik.dev/downloads/azure-zero-trust-terraform-cheatsheet.pdf"
         style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:6px;text-decoration:none">
        Download Cheat Sheet (PDF) &rarr;
      </a>
    </td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="margin:0 0 8px;font-size:13px;color:#737373">I publish deep technical articles on Azure Terraform, zero-trust networking, and compliance automation — and sell the hardened enterprise versions of the patterns. No hand-wavy explanations, just code that deploys first time.</p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">— David<br><a href="https://woitzik.dev" style="color:#0ea5e9;text-decoration:none">woitzik.dev</a></p>
`);

const DAY3_SUBJECT =
  "The Azure Firewall pattern that breaks every first deployment";
const DAY3_BODY = emailBody(`
  <p style="margin:0 0 16px">Most Azure Firewall + Forced Tunneling deployments hit the same wall: a cycle dependency error on first apply that nothing in the docs explains.</p>
  <p style="margin:0 0 16px">The root cause is that Azure Firewall needs a public IP before it can get a private IP, but the route table needs the private IP to create the default route — and Terraform tries to build them in the wrong order.</p>
  <p style="margin:0 0 16px">I wrote a deep-dive on how to resolve this, including:</p>
  <ul style="margin:0 0 16px;padding-left:20px;color:#404040">
    <li style="margin-bottom:6px">The correct resource ordering to avoid the cycle</li>
    <li style="margin-bottom:6px">The KMS bypass route (168.63.129.16/32) that prevents Windows VMs from breaking</li>
    <li>Why routing Azure AD through the firewall silently breaks Managed Identity auth</li>
  </ul>
  <p style="margin:0 0 20px">
    <a href="https://woitzik.dev/blog/azure-firewall-cycle-error/" style="color:#0ea5e9;text-decoration:none;font-weight:600">Read: Azure Firewall Cycle Error — How to Fix It &rarr;</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="margin:0;font-size:13px;color:#737373">If you're already running a Hub &amp; Spoke with forced tunneling in production, the enterprise module ships with all of this pre-wired: <a href="https://woitzik.dev/templates" style="color:#0ea5e9;text-decoration:none">woitzik.dev/templates</a></p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">— David</p>
`);

const DAY7_SUBJECT = "If you're dealing with a compliance deadline...";
const DAY7_BODY = emailBody(`
  <p style="margin:0 0 16px">If you're reading this, there's a decent chance someone in your org has mentioned ISO 27001, NIS2, or KRITIS recently — and you're the one who has to make the infrastructure compliant.</p>
  <p style="margin:0 0 16px">The problem isn't that the controls are hard to understand. It's that nobody maps them to actual Terraform resources.</p>
  <p style="margin:0 0 8px;font-weight:600;color:#0a0a0a">The cheat sheet covers the basics. The enterprise modules go further:</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e5e5;border-radius:6px;overflow:hidden">
    <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e5e5">
      <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#0a0a0a">Enterprise Hub &amp; Spoke — Zero-Trust Edition <span style="color:#0ea5e9">€49</span></p>
      <p style="margin:0;font-size:13px;color:#737373">Zero-Trust NSG baselines, centralized Private DNS Zones, DINE policy lifecycle bypass. Audit-ready on day one.</p>
    </td></tr>
    <tr><td style="padding:14px 16px">
      <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#0a0a0a">Azure Firewall — Forced Tunneling Edition <span style="color:#0ea5e9">€49</span></p>
      <p style="margin:0;font-size:13px;color:#737373">Cycle-error-free. KMS + Azure AD bypasses included. Drops into any Hub &amp; Spoke without breaking anything.</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td align="center">
      <a href="https://woitzik.dev/templates" style="display:inline-block;background:#0a0a0a;color:#ffffff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">
        View all modules &rarr;
      </a>
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;color:#737373">Both ship with full source code — no lock-in, no black box. If the timing isn't right, no worries. I'll keep publishing deep dives.</p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">— David<br><a href="https://woitzik.dev" style="color:#0ea5e9;text-decoration:none">woitzik.dev</a></p>
`);

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

  // Fire and forget all three emails — contact creation already succeeded
  const scheduleEmail = (
    subject: string,
    htmlContent: string,
    scheduledAt?: string,
  ) =>
    fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: brevoHeaders,
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email }],
        subject,
        htmlContent,
        ...(scheduledAt ? { scheduledAt } : {}),
      }),
    }).then(async (r) => {
      if (!r.ok)
        console.error(
          `Brevo email error (${subject}):`,
          r.status,
          await r.json().catch(() => ({})),
        );
    });

  await Promise.all([
    scheduleEmail(DAY0_SUBJECT, DAY0_BODY),
    scheduleEmail(DAY3_SUBJECT, DAY3_BODY, daysFromNow(3)),
    scheduleEmail(DAY7_SUBJECT, DAY7_BODY, daysFromNow(7)),
  ]);

  res.writeHead(200);
  res.end(JSON.stringify({ success: true }));
}
