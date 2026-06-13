import type { IncomingMessage, ServerResponse } from "http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
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

  const contact: Record<string, unknown> = { email, updateEnabled: true };
  const listId = process.env.BREVO_LIST_ID ? parseInt(process.env.BREVO_LIST_ID) : null;
  if (listId) contact.listIds = [listId];

  const brevo = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(contact),
  });

  if (brevo.status === 201 || brevo.status === 204) {
    res.writeHead(200);
    res.end(JSON.stringify({ success: true }));
    return;
  }

  const err = await brevo.json().catch(() => ({}));
  console.error("Brevo error:", brevo.status, err);
  res.writeHead(500);
  res.end(JSON.stringify({ error: "Failed to subscribe. Please try again." }));
}
