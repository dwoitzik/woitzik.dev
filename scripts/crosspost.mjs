#!/usr/bin/env node
/**
 * Crosspost a blog article to dev.to.
 * (Hashnode API requires a paid plan as of May 2026 — skip it)
 *
 * Usage:
 *   node scripts/crosspost.mjs <slug>           # post to dev.to
 *   node scripts/crosspost.mjs <slug> --dry-run # preview without posting
 *
 * Required env vars (set in .env.crosspost or export before running):
 *   DEVTO_API_KEY
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load .env.crosspost if present
const envFile = resolve(ROOT, ".env.crosspost");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const [k, ...v] = line.trim().split("=");
    if (k && !k.startsWith("#")) process.env[k] = v.join("=");
  }
}

// ─── Product data (mirrors src/data/products.ts) ──────────────────────────
const PRODUCTS = {
  "acmebot-enterprise-vnet": {
    title: "Azure Acmebot — Enterprise VNet Edition",
    price: "€49",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/9ba80f4b-ce9c-40bf-a831-e012b538da8b",
    bullets: [
      "Default-deny network architecture (VNet Integration + Private Link)",
      "Private DNS Zones — correct resolution out of the box",
      "Entra ID & Managed Identity automation included",
      "Saves 4–8h of senior engineer troubleshooting",
      "Full source code — no lock-in, no black box",
    ],
  },
  "hub-spoke-enterprise-vnet": {
    title: "Enterprise Hub & Spoke — Zero-Trust Edition",
    price: "€49",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/e8caa68b-bc22-489e-b453-2ea28bd28eb0",
    bullets: [
      "Zero-Trust NSG baseline bound to all Spoke subnets",
      "4 centralized Private DNS Zones (Blob, SQL, Key Vault, ACR)",
      "DINE policy lifecycle bypass — no more broken pipelines",
      "Environment-aware naming convention throughout",
      "Full source code — no lock-in, no black box",
    ],
  },
  "azure-firewall-enterprise": {
    title: "Azure Firewall — Enterprise Forced Tunneling Edition",
    price: "€49",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/a955d698-acf5-4654-ae16-bb8ec1f7be15",
    bullets: [
      "Cycle-error-free resource ordering — deploys first time, every time",
      "KMS & Azure AD bypass routes — no broken Windows VMs or auth failures",
      "Dynamic for_each subnet binding — scales to any number of Spokes",
      "IP Group-based firewall policies — no hardcoded IP addresses",
      "FQDN baseline rules for Windows Updates and core Microsoft services",
    ],
  },
  "azure-rag-enterprise": {
    title: "Enterprise AI RAG — Zero-Trust Networking",
    price: "€79",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/cd786faf-92b8-41c8-876e-c3a3fdf4f823",
    bullets: [
      "Automated AzAPI Link Approval — no manual Portal clicks required",
      "Full VNet Injection — Public Network Access strictly disabled",
      "Pre-configured Identity Chaining (System Managed Identities + RBAC)",
      "Automated Private DNS Zone linking for both services",
      "ISO 27001 & NIS2 compliant architecture on day one",
    ],
  },
};

// ─── MDX → Markdown conversion ────────────────────────────────────────────
function mdxToMarkdown(raw, slug) {
  const canonicalUrl = `https://woitzik.dev/blog/${slug}/`;

  // Strip frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
  let body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

  // Strip all import lines
  body = body.replace(/^import .+from .+;\n?/gm, "").trimStart();

  // Replace <ProductCTA slug="..." variant="inline" /> or just <ProductCTA slug="..." />
  body = body.replace(
    /<ProductCTA\s+slug="([^"]+)"(?:\s+variant="([^"]+)")?\s*\/>/g,
    (_, productSlug, variant) => {
      const p = PRODUCTS[productSlug];
      if (!p) return "";
      if (variant === "end" || !variant) {
        return [
          "",
          "---",
          "",
          `## 🚀 ${p.title} — ${p.price}`,
          "",
          p.bullets.map((b) => `- ${b}`).join("\n"),
          "",
          `**[Get the enterprise module →](${p.href})**`,
          "",
          "_Full source code · one-time payment · instant download_",
          "",
          "---",
          "",
        ].join("\n");
      }
      // inline variant
      return `\n> **Terraform Module:** Skip the trial-and-error — [${p.title} (${p.price}) →](${p.href})\n`;
    }
  );

  // Add canonical note at the top for dev.to / Hashnode readers
  const canonicalNote = `> _Originally published at [woitzik.dev](${canonicalUrl})_\n\n`;

  return canonicalNote + body.trim();
}

// ─── Parse frontmatter ────────────────────────────────────────────────────
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const [k, ...v] = line.split(":");
    if (k) fm[k.trim()] = v.join(":").trim().replace(/^"|"$/g, "");
  }
  // tags: ["A", "B"] → ["A", "B"]
  if (fm.tags) {
    const tagMatch = fm.tags.match(/\[(.+)\]/);
    fm.tags = tagMatch
      ? tagMatch[1].split(",").map((t) => t.trim().replace(/^"|"$/g, ""))
      : [];
  }
  return fm;
}

// ─── dev.to ───────────────────────────────────────────────────────────────
async function alreadyOnDevTo(slug, apiKey) {
  const canonical = `https://woitzik.dev/blog/${slug}/`;
  const res = await fetch("https://dev.to/api/articles/me/published?per_page=100", {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) return false;
  const articles = await res.json();
  return articles.some((a) => a.canonical_url === canonical);
}

async function postToDevTo(slug, fm, markdown, dryRun) {
  const apiKey = process.env.DEVTO_API_KEY;
  if (!apiKey) { console.error("❌  DEVTO_API_KEY not set"); return; }

  // dev.to tags: lowercase, no spaces, letters/numbers only, max 4
  const tags = (fm.tags || [])
    .slice(0, 4)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const payload = {
    article: {
      title: fm.title,
      body_markdown: markdown,
      published: true,
      canonical_url: `https://woitzik.dev/blog/${slug}/`,
      description: fm.description,
      tags,
    },
  };

  if (dryRun) {
    console.log("\n[DRY RUN] dev.to payload:");
    console.log(JSON.stringify(payload, null, 2).slice(0, 600) + "...");
    return;
  }

  if (await alreadyOnDevTo(slug, apiKey)) {
    console.log(`⏭️   dev.to: already published (${slug}) — skipping`);
    return;
  }

  const res = await fetch("https://dev.to/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`✅  dev.to: ${data.url}`);
  } else {
    console.error("❌  dev.to error:", data);
  }
}

// ─── Hashnode ─────────────────────────────────────────────────────────────
async function postToHashnode(slug, fm, markdown, dryRun) {
  const token = process.env.HASHNODE_TOKEN;
  const publicationId = process.env.HASHNODE_PUBLICATION_ID;
  if (!token || !publicationId) {
    console.error("❌  HASHNODE_TOKEN or HASHNODE_PUBLICATION_ID not set");
    return;
  }

  const tags = (fm.tags || []).map((t) => ({ name: t, slug: t.toLowerCase().replace(/\s+/g, "-") }));

  const query = `
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post { id url }
      }
    }
  `;

  const variables = {
    input: {
      title: fm.title,
      subtitle: fm.description,
      publicationId,
      contentMarkdown: markdown,
      originalArticleURL: `https://woitzik.dev/blog/${slug}/`,
      tags,
      settings: { isTableOfContentEnabled: true },
    },
  };

  if (dryRun) {
    console.log("\n[DRY RUN] Hashnode payload:");
    console.log(JSON.stringify(variables, null, 2).slice(0, 600) + "...");
    return;
  }

  const res = await fetch("https://gql.hashnode.com/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  if (data.data?.publishPost?.post?.url) {
    console.log(`✅  Hashnode: ${data.data.publishPost.post.url}`);
  } else {
    console.error("❌  Hashnode error:", JSON.stringify(data.errors ?? data));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
const [, , slug, ...flags] = process.argv;

if (!slug) {
  console.error("Usage: node scripts/crosspost.mjs <slug> [--devto] [--hashnode] [--dry-run]");
  console.error("\nAvailable slugs:");
  const { readdirSync } = await import("fs");
  readdirSync(resolve(ROOT, "src/content/blog"))
    .filter((f) => f.endsWith(".mdx"))
    .forEach((f) => console.error(" ", f.replace(".mdx", "")));
  process.exit(1);
}

const dryRun = flags.includes("--dry-run");
const onlyDevTo = flags.includes("--devto");
const onlyHashnode = flags.includes("--hashnode");
const postBoth = !onlyDevTo && !onlyHashnode;

const mdxPath = resolve(ROOT, `src/content/blog/${slug}.mdx`);
if (!existsSync(mdxPath)) {
  console.error(`❌  Article not found: ${mdxPath}`);
  process.exit(1);
}

const raw = readFileSync(mdxPath, "utf8");
const fm = parseFrontmatter(raw);
const markdown = mdxToMarkdown(raw, slug);

console.log(`\n📝  Crossposting: ${fm.title}`);
console.log(`🔗  Canonical: https://woitzik.dev/blog/${slug}/`);
console.log(`🏷️   Tags: ${(fm.tags || []).join(", ")}\n`);

if (onlyDevTo || postBoth) await postToDevTo(slug, fm, markdown, dryRun);
if (onlyHashnode || postBoth) await postToHashnode(slug, fm, markdown, dryRun);
