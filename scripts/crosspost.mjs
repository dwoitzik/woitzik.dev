#!/usr/bin/env node
/**
 * Crosspost a blog article to dev.to.
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
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// Load .env.crosspost if present
const envFile = resolve(ROOT, ".env.crosspost");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const [k, ...v] = line.trim().split("=");
    if (k && !k.startsWith("#")) process.env[k] = v.join("=");
  }
}

// ─── Product data (single source of truth: src/data/products.json) ───────────
const productsArray = require("../src/data/products.json");
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
