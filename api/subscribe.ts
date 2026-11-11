import type { IncomingMessage, ServerResponse } from "http";
import { createHash, createHmac, timingSafeEqual } from "crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SENDER = { name: "David Woitzik", email: "david@woitzik.dev" };

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

const SITE = "https://woitzik.dev";
// Confirmation links stay valid for a week.
const CONFIRM_TTL_SECONDS = 7 * 86_400;

// Double opt-in (§ 7 Abs. 2 UWG, Art. 7 Abs. 1 DSGVO): the signup form only
// sends a confirmation link. The contact is created and the welcome sequence
// starts when that link is opened, which proves the address owner asked for
// it. The link carries the address and an expiry, signed with an HMAC key
// derived from the Brevo API key, so no extra secret has to be managed and
// nobody can confirm an address they don't control.
function signingKey(apiKey: string): Buffer {
  return createHash("sha256").update(`newsletter-doi:${apiKey}`).digest();
}

function sign(apiKey: string, email: string, expires: number): string {
  return createHmac("sha256", signingKey(apiKey))
    .update(`${email.toLowerCase()}|${expires}`)
    .digest("hex");
}

function validSignature(
  apiKey: string,
  email: string,
  expires: number,
  signature: string,
): boolean {
  const expected = Buffer.from(sign(apiKey, email, expires), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function redirect(
  res: ServerResponse,
  status: "ok" | "already" | "invalid" | "error",
) {
  const target =
    status === "ok"
      ? `${SITE}/subscribed/`
      : `${SITE}/subscribed/?status=${status}`;
  res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
  res.end();
}

// Bulletproof email HTML: every table has explicit border/cellpadding/cellspacing
// attributes (CSS resets alone aren't honored by Outlook's Word rendering engine),
// padding lives on <td> not <table> (Outlook ignores table-level padding), and the
// outer table uses role="presentation" with a single width source of truth instead
// of a conflicting width="600" attribute + width:100% style on the same element.
function emailBody(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,-apple-system,sans-serif">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px">
        <tr>
          <td style="background:#0a0a0a;padding:20px 32px;border-radius:8px 8px 0 0">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0ea5e9">woitzik.dev</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;font-size:15px;color:#404040;line-height:1.7">${content}</td>
        </tr>
        <tr>
          <td style="background:#f5f5f5;padding:14px 32px;border-top:1px solid #e5e5e5;border-radius:0 0 8px 8px">
            <p style="margin:0;font-size:11px;color:#a3a3a3">You signed up at woitzik.dev.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body></html>`;
}

// Bulletproof button: padding on the <td>, not the <a>. Outlook's Word engine
// doesn't support display:inline-block or padding on anchor tags, which is what
// caused the buttons to look cut off / misplaced.
function emailButton(href: string, label: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto">
    <tr>
      <td align="center" style="background:#0a0a0a;border-radius:6px;padding:14px 28px">
        <a href="${href}" style="display:block;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;font-family:system-ui,-apple-system,sans-serif">${label}</a>
      </td>
    </tr>
  </table>`;
}

const DAY0_SUBJECT = "Your Azure Zero-Trust Terraform Cheat Sheet";
const DAY0_BODY = emailBody(`
  <p style="margin:0 0 16px">Thanks for signing up. Here are the 8 Terraform patterns: NSGs, Private Endpoints, Managed Identities, Forced Tunneling, and the NIS2/ISO 27001 control map.</p>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td align="center" style="padding:0">
      ${emailButton(
        "https://woitzik.dev/downloads/azure-zero-trust-terraform-cheatsheet.pdf",
        "Download Cheat Sheet (PDF) &rarr;",
      )}
    </td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="margin:0 0 8px;font-size:13px;color:#737373">I write about Azure Terraform, zero-trust networking and compliance automation, mostly from things that broke in real deployments. Every module I publish is free and MIT licensed.</p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">David<br><a href="https://woitzik.dev" style="color:#0ea5e9;text-decoration:none">woitzik.dev</a></p>
`);

const DAY3_SUBJECT = "The Azure Firewall cycle error on first apply";
const DAY3_BODY = emailBody(`
  <p style="margin:0 0 16px">Hi,</p>
  <p style="margin:0 0 16px">If you've built forced tunneling with Azure Firewall in Terraform, you may have hit this on the first apply: <code>Error: Cycle: azurerm_subnet_route_table_association...</code></p>
  <p style="margin:0 0 16px">The route table needs the firewall's private IP as next hop. The firewall needs its subnet first. The route table association binds everything to the spoke subnets at the same time. Structured the wrong way, Terraform can't work out the order and gives up.</p>
  <p style="margin:0 0 16px">The article covers:</p>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 16px">
    <tr><td style="padding:0 0 6px 20px;font-size:15px;color:#404040">&bull;&nbsp; The resource ordering that breaks the cycle</td></tr>
    <tr><td style="padding:0 0 6px 20px;font-size:15px;color:#404040">&bull;&nbsp; The KMS bypass routes for Windows activation (Microsoft currently lists three global KMS IPs: 20.118.99.224, 40.83.235.53 and 23.102.135.246)</td></tr>
    <tr><td style="padding:0 0 0 20px;font-size:15px;color:#404040">&bull;&nbsp; The Azure AD bypass route, and what fails without it</td></tr>
  </table>
  <p style="margin:0 0 20px">
    <a href="https://woitzik.dev/blog/azure-firewall-cycle-error/" style="color:#0ea5e9;text-decoration:none;font-weight:600">Azure Firewall Cycle Error: How to Fix It &rarr;</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="margin:0;font-size:13px;color:#737373">The free forced-tunneling module has all of this built in: <a href="https://woitzik.dev/templates/" style="color:#0ea5e9;text-decoration:none">woitzik.dev/templates</a></p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">David</p>
`);

const DAY7_SUBJECT = "If you're facing a compliance deadline";
const DAY7_BODY = emailBody(`
  <p style="margin:0 0 16px">Hi,</p>
  <p style="margin:0 0 16px">If someone in your org has brought up ISO 27001, NIS2 or KRITIS lately, the infrastructure part probably landed on your desk.</p>
  <p style="margin:0 0 16px">The controls themselves are documented well enough. What's missing is the mapping to actual Terraform resources.</p>
  <p style="margin:0 0 8px;font-weight:600;color:#0a0a0a">The cheat sheet covers the basics; the modules go further:</p>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e5e5;border-radius:6px">
    <tr><td style="padding:14px 16px;border-bottom:1px solid #e5e5e5">
      <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#0a0a0a">Hub &amp; Spoke - Zero-Trust Edition <span style="color:#10b981">Free</span></p>
      <p style="margin:0;font-size:13px;color:#737373">Zero-trust NSG baselines, central Private DNS Zones, and lifecycle handling for DINE policies.</p>
    </td></tr>
    <tr><td style="padding:14px 16px">
      <p style="margin:0 0 4px;font-weight:700;font-size:14px;color:#0a0a0a">Azure Firewall - Forced Tunneling Edition <span style="color:#10b981">Free</span></p>
      <p style="margin:0;font-size:13px;color:#737373">No cycle error, KMS and Azure AD bypass routes included.</p>
    </td></tr>
  </table>
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td align="center" style="padding:0">
      ${emailButton("https://woitzik.dev/templates/", "View all modules &rarr;")}
    </td></tr>
  </table>
  <p style="margin:0;font-size:13px;color:#737373">Full source, MIT licensed. If the timing is wrong, no problem. I'll keep writing up what I run into.</p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">David<br><a href="https://woitzik.dev" style="color:#0ea5e9;text-decoration:none">woitzik.dev</a></p>
`);

const CONFIRM_SUBJECT = "Please confirm your subscription to woitzik.dev";
function confirmBody(link: string): string {
  return emailBody(`
  <p style="margin:0 0 16px">Please confirm that you want to receive emails from woitzik.dev: the Azure Zero-Trust Terraform cheat sheet now, and new articles and Terraform modules afterwards.</p>
  <p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Confirm subscription</a></p>
  <p style="margin:0 0 8px;font-size:13px;color:#737373">The link is valid for 7 days. If you did not sign up, ignore this email and nothing will happen.</p>
  <p style="margin:16px 0 0;font-size:13px;color:#737373">David<br><a href="${SITE}" style="color:#0f766e;text-decoration:none">woitzik.dev</a></p>`);
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Access-Control-Allow-Origin", "https://woitzik.dev");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const apiKey = process.env.BREVO_API_KEY;

  if (req.method === "GET") {
    if (!apiKey) return redirect(res, "error");
    const url = new URL(req.url ?? "", SITE);
    const email = url.searchParams.get("e") ?? "";
    const expires = Number(url.searchParams.get("x"));
    const signature = url.searchParams.get("s") ?? "";
    if (
      !EMAIL_RE.test(email) ||
      !Number.isFinite(expires) ||
      expires < Date.now() / 1000 ||
      !/^[0-9a-f]{64}$/.test(signature) ||
      !validSignature(apiKey, email, expires, signature)
    ) {
      return redirect(res, "invalid");
    }
    const result = await activate(apiKey, email);
    return redirect(res, result);
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

  if (!apiKey) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Server configuration error" }));
    return;
  }

  // Signup only sends the confirmation link. Nothing is stored in Brevo and no
  // welcome email goes out until the link is opened (see GET above).
  const expires = Math.floor(Date.now() / 1000) + CONFIRM_TTL_SECONDS;
  const link = `${SITE}/api/subscribe?e=${encodeURIComponent(email)}&x=${expires}&s=${sign(apiKey, email, expires)}`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: brevoHeaders(apiKey),
    body: JSON.stringify({
      sender: SENDER,
      to: [{ email }],
      subject: CONFIRM_SUBJECT,
      htmlContent: confirmBody(link),
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    console.error("Brevo confirmation email error:", r.status, err);
    res.writeHead(502);
    res.end(
      JSON.stringify({
        error: "Couldn't send the confirmation email. Please try again.",
      }),
    );
    return;
  }

  res.writeHead(200);
  res.end(JSON.stringify({ success: true, confirmationRequired: true }));
}

function brevoHeaders(apiKey: string) {
  return {
    accept: "application/json",
    "content-type": "application/json",
    "api-key": apiKey,
  };
}

// Runs only after the confirmation link was opened: creates the contact and
// starts the Day 0/3/7 sequence.
async function activate(
  apiKey: string,
  email: string,
): Promise<"ok" | "already" | "error"> {
  const headers = brevoHeaders(apiKey);
  const contact: Record<string, unknown> = { email, updateEnabled: true };
  const listId = process.env.BREVO_LIST_ID
    ? parseInt(process.env.BREVO_LIST_ID)
    : null;
  if (listId) contact.listIds = [listId];

  const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify(contact),
  });

  if (contactRes.status !== 201 && contactRes.status !== 204) {
    const err = await contactRes.json().catch(() => ({}));
    console.error("Brevo contact error:", contactRes.status, err);
    return "error";
  }

  // 204 means the address was already a contact: either the link was opened
  // twice or the reader subscribed before. Only a brand-new contact gets the
  // welcome sequence, so a second click doesn't send Day 0 again or stack a
  // second Day 3 + Day 7 on top of the pending ones.
  if (contactRes.status === 204) return "already";

  const scheduleEmail = async (
    subject: string,
    htmlContent: string,
    scheduledAt?: string,
  ) => {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email }],
        subject,
        htmlContent,
        ...(scheduledAt ? { scheduledAt } : {}),
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(
        `Brevo email failed (${subject}): ${r.status} ${JSON.stringify(err)}`,
      );
    }
  };

  // allSettled, not all: a Day 3/7 scheduling failure shouldn't block the
  // Day 0 cheat-sheet email the reader is waiting for right now.
  const results = await Promise.allSettled([
    scheduleEmail(DAY0_SUBJECT, DAY0_BODY),
    scheduleEmail(DAY3_SUBJECT, DAY3_BODY, daysFromNow(3)),
    scheduleEmail(DAY7_SUBJECT, DAY7_BODY, daysFromNow(7)),
  ]);
  for (const r of results) {
    if (r.status === "rejected") console.error("Brevo email error:", r.reason);
  }
  return results[0].status === "rejected" ? "error" : "ok";
}
