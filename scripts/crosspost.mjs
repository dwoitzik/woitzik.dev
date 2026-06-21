#!/usr/bin/env node
/**
 * Crosspost a blog article to dev.to, Medium, and announce it on Mastodon.
 *
 * Usage:
 *   node scripts/crosspost.mjs <slug>           # post everywhere configured
 *   node scripts/crosspost.mjs <slug> --dry-run # preview without posting
 *
 * Required env vars (set in .env.crosspost or export before running):
 *   DEVTO_API_KEY
 *   MASTODON_INSTANCE_URL       e.g. https://hachyderm.io  (optional — skipped if unset)
 *   MASTODON_ACCESS_TOKEN                                   (optional — skipped if unset)
 *   MEDIUM_INTEGRATION_TOKEN                                (optional — skipped if unset)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
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

// ─── Product data (single source of truth: src/data/products.json) ───────────
const productsArray = JSON.parse(
  readFileSync(resolve(ROOT, "src/data/products.json"), "utf8")
);
const PRODUCTS = Object.fromEntries(productsArray.map((p) => [p.slug, p]));

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

  // Add canonical note at the top for dev.to readers
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
  if (!apiKey) {
    console.error("❌  DEVTO_API_KEY not set");
    process.exit(1);
  }

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
    process.exit(1);
  }
}

// ─── Mastodon ─────────────────────────────────────────────────────────────
// Mastodon is microblogging, not a blog host — post a short teaser + canonical
// link instead of the full article. Optional: skipped entirely if the instance
// URL or token aren't configured, so this never blocks the dev.to crosspost.
async function alreadyOnMastodon(instanceUrl, accessToken, canonicalUrl) {
  const res = await fetch(
    `${instanceUrl}/api/v1/accounts/verify_credentials`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return false;
  const account = await res.json();
  const statusesRes = await fetch(
    `${instanceUrl}/api/v1/accounts/${account.id}/statuses?limit=40`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!statusesRes.ok) return false;
  const statuses = await statusesRes.json();
  return statuses.some((s) => s.content?.includes(canonicalUrl));
}

async function postToMastodon(slug, fm, dryRun) {
  const instanceUrl = process.env.MASTODON_INSTANCE_URL;
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  if (!instanceUrl || !accessToken) {
    console.log("⏭️   Mastodon: not configured — skipping");
    return;
  }

  const canonicalUrl = `https://woitzik.dev/blog/${slug}/`;

  if (await alreadyOnMastodon(instanceUrl, accessToken, canonicalUrl)) {
    console.log(`⏭️   Mastodon: already posted (${slug}) — skipping`);
    return;
  }

  // Mastodon hashtags: no spaces, no punctuation, CamelCase for readability.
  const hashtags = (fm.tags || [])
    .slice(0, 3)
    .map((t) => `#${t.replace(/[^a-zA-Z0-9]/g, "")}`)
    .join(" ");

  const status = `${fm.title}\n\n${fm.description}\n\n${canonicalUrl}\n\n${hashtags}`;

  if (dryRun) {
    console.log("\n[DRY RUN] Mastodon status:");
    console.log(status);
    return;
  }

  const res = await fetch(`${instanceUrl}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status, visibility: "public" }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`✅  Mastodon: ${data.url}`);
  } else {
    console.error("❌  Mastodon error:", data);
  }
}

// ─── Medium ───────────────────────────────────────────────────────────────
// Medium's API has no endpoint to list a user's own posts, so the dev.to/
// Mastodon "ask the API if it's already there" dedup trick doesn't work here.
// Instead we track posted slugs in a small JSON file that the CI workflow
// commits back to the repo after a successful run.
const mediumPostedFile = resolve(ROOT, "scripts/.medium-posted.json");

function loadMediumPosted() {
  if (!existsSync(mediumPostedFile)) return [];
  return JSON.parse(readFileSync(mediumPostedFile, "utf8"));
}

function saveMediumPosted(slugs) {
  writeFileSync(mediumPostedFile, JSON.stringify(slugs, null, 2) + "\n");
}

async function postToMedium(slug, fm, markdown, dryRun) {
  const token = process.env.MEDIUM_INTEGRATION_TOKEN;
  if (!token) {
    console.log("⏭️   Medium: not configured — skipping");
    return;
  }

  const posted = loadMediumPosted();
  if (posted.includes(slug)) {
    console.log(`⏭️   Medium: already posted (${slug}) — skipping`);
    return;
  }

  // Medium tags: max 3, no special formatting required.
  const tags = (fm.tags || []).slice(0, 3);

  const payload = {
    title: fm.title,
    contentFormat: "markdown",
    content: markdown,
    canonicalUrl: `https://woitzik.dev/blog/${slug}/`,
    tags,
    publishStatus: "public",
  };

  if (dryRun) {
    console.log("\n[DRY RUN] Medium payload:");
    console.log(JSON.stringify(payload, null, 2).slice(0, 600) + "...");
    return;
  }

  const meRes = await fetch("https://api.medium.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!meRes.ok) {
    console.error("❌  Medium error: failed to resolve author id", await meRes.json().catch(() => ({})));
    return;
  }
  const me = await meRes.json();
  const authorId = me.data.id;

  const res = await fetch(`https://api.medium.com/v1/users/${authorId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`✅  Medium: ${data.data.url}`);
    posted.push(slug);
    saveMediumPosted(posted);
  } else {
    console.error("❌  Medium error:", data);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
const [, , slug, ...flags] = process.argv;

if (!slug) {
  console.error("Usage: node scripts/crosspost.mjs <slug> [--dry-run]");
  console.error("\nAvailable slugs:");
  const { readdirSync } = await import("fs");
  readdirSync(resolve(ROOT, "src/content/blog"))
    .filter((f) => f.endsWith(".mdx"))
    .forEach((f) => console.error(" ", f.replace(".mdx", "")));
  process.exit(1);
}

const dryRun = flags.includes("--dry-run");

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

await postToDevTo(slug, fm, markdown, dryRun);
await postToMastodon(slug, fm, dryRun);
await postToMedium(slug, fm, markdown, dryRun);
