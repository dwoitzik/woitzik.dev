#!/usr/bin/env node
/**
 * Crosspost a blog article to dev.to, and announce it on Mastodon.
 *
 * Medium and Hackernoon crossposting were removed 2026-08-27: both required
 * a persistent authenticated Playwright browser session on one specific
 * machine, that session's auth rotted after 41 days unattended, and Medium
 * had 0 of 54 articles ever actually confirmed posted despite the old script
 * logging "submitted" — no error handling existed to tell success from
 * silent failure. dev.to's real API-based crosspost below is unaffected.
 *
 * Usage:
 *   node scripts/crosspost.mjs <slug>                 # post everywhere configured
 *   node scripts/crosspost.mjs <slug> --dry-run       # preview without posting
 *   node scripts/crosspost.mjs <slug> --update-devto   # article already exists on
 *                                                       # dev.to -- PUT the current
 *                                                       # markdown instead of skipping
 *                                                       # (Mastodon still no-op since
 *                                                       # it would already been posted)
 *
 * Required env vars (set in .env.crosspost or export before running):
 *   DEVTO_API_KEY
 *   MASTODON_INSTANCE_URL       e.g. https://hachyderm.io  (optional — skipped if unset)
 *   MASTODON_ACCESS_TOKEN                                   (optional — skipped if unset)
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

  // Replace <ProductCTA slug="..." variant="inline" /> in any attribute order.
  // The original regex hard-coded slug-first, but every ProductCTA in the repo
  // writes variant first, so it never matched and raw JSX was shipped to dev.to.
  body = body.replace(/<ProductCTA\s+([^>]*?)\/>/g, (_, attrs) => {
    const slugMatch = attrs.match(/slug="([^"]+)"/);
    if (!slugMatch) return "";
    const p = PRODUCTS[slugMatch[1]];
    if (!p) return "";
    const variantMatch = attrs.match(/variant="([^"]+)"/);
    const variant = variantMatch ? variantMatch[1] : null;
    const links = [
      p.repoHref && `[GitHub](${p.repoHref})`,
      p.registryHref && `[Terraform Registry](${p.registryHref})`,
    ].filter(Boolean);
    if (variant === "end" || !variant) {
      return [
        "",
        "---",
        "",
        `## 🐙 ${p.title} — free, MIT licensed`,
        "",
        p.bullets.map((b) => `- ${b}`).join("\n"),
        "",
        `**Get it: ${links.join(" · ")}**`,
        "",
        "_Full source code · free forever · no account, no checkout_",
        "",
        "---",
        "",
      ].join("\n");
    }
    // inline variant
    return `\n> **Terraform module (free, MIT):** [${p.title} →](${p.repoHref})\n`;
  });

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
async function findOnDevTo(slug, apiKey) {
  const canonical = `https://woitzik.dev/blog/${slug}/`;
  const res = await fetch("https://dev.to/api/articles/me/published?per_page=100", {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) return null;
  const articles = await res.json();
  return articles.find((a) => a.canonical_url === canonical) ?? null;
}

// One API call for the whole run instead of one per article. The old workflow
// shelled out to crosspost.mjs 70 times, so every push that touched
// src/content/blog/ burned ~41 min of sleep and 70 dev.to API requests just to
// discover 69 of them were already published.
async function publishedSlugsOnDevTo(apiKey) {
  const slugs = new Set();
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://dev.to/api/articles/me/published?per_page=100&page=${page}`,
      { headers: { "api-key": apiKey } },
    );
    if (!res.ok) break;
    const articles = await res.json();
    if (!Array.isArray(articles) || articles.length === 0) break;
    for (const a of articles) {
      const m = a.canonical_url?.match(/woitzik\.dev\/blog\/([^/]+)\//);
      if (m) slugs.add(m[1]);
    }
    if (articles.length < 100) break;
  }
  return slugs;
}

async function postToDevTo(slug, fm, markdown, dryRun, updateExisting, known) {
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

  let existing;
  if (known === true) {
    console.log(`⏭️   dev.to: already published (${slug}) — skipping`);
    return;
  } else if (known === false) {
    existing = null;
  } else {
    existing = await findOnDevTo(slug, apiKey);
  }

  if (existing) {
    if (!updateExisting) {
      console.log(`⏭️   dev.to: already published (${slug}) — skipping`);
      return;
    }
    const res = await fetch(`https://dev.to/api/articles/${existing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✅  dev.to: updated ${data.url}`);
    } else {
      console.error("❌  dev.to update error:", data);
      process.exit(1);
    }
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
  } else if (res.status === 422 && data.error?.includes("already been taken")) {
    console.log(`⏭️   dev.to: already posted (${slug}) — skipping`);
  } else {
    console.error("❌  dev.to error:", data);
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

// ─── Main ─────────────────────────────────────────────────────────────────

const [, , slugOrAll, ...flags] = process.argv;

const dryRun = flags.includes("--dry-run");
const updateDevTo = flags.includes("--update-devto");
const doDevTo = !flags.includes("--mastodon");
const doAll = slugOrAll === "--all" || slugOrAll === "--new";
const onlyNew = slugOrAll === "--new";
const delayMs = parseInt(flags.find((f) => f.startsWith("--delay="))?.split("=")[1] || "0", 10) * 1000;
const maxPosts = parseInt(flags.find((f) => f.startsWith("--max="))?.split("=")[1] || "0", 10);

if (!slugOrAll) {
  console.error("Usage: node scripts/crosspost.mjs <slug|--all|--new> [flags]");
  console.error("\nModes:");
  console.error("  <slug>            Post a single article");
  console.error("  --new             Post only articles not yet on dev.to (1 API call)");
  console.error("  --all             Post every article, checking each against dev.to");
  console.error("\nFlags:");
  console.error("  --devto           Post to dev.to (default)");
  console.error("  --mastodon        Post to Mastodon");
  console.error("  --delay=N         Seconds between posts (default: 0)");
  console.error("  --update-devto    Update existing dev.to article");
  console.error("  --max=N           Limit posts per run (default: unlimited)");
  console.error("  --dry-run         Preview without posting");
  console.error("\nExamples:");
  console.error("  node scripts/crosspost.mjs my-article --dry-run");
  console.error("  node scripts/crosspost.mjs --new --devto");
  console.error("\nAvailable slugs:");
  const { readdirSync } = await import("fs");
  readdirSync(resolve(ROOT, "src/content/blog"))
    .filter((f) => f.endsWith(".mdx"))
    .forEach((f) => console.error(" ", f.replace(".mdx", "")));
  process.exit(1);
}

async function crosspostOne(slug, known) {
  const mdxPath = resolve(ROOT, `src/content/blog/${slug}.mdx`);
  if (!existsSync(mdxPath)) {
    console.error(`❌  Article not found: ${mdxPath}`);
    return;
  }

  const raw = readFileSync(mdxPath, "utf8");
  const fm = parseFrontmatter(raw);
  const markdown = mdxToMarkdown(raw, slug);

  if (fm.lang === "de") {
    console.log(`⏭️   ${slug}: deutsch → kein dev.to-Crosspost (bleibt auf woitzik.dev)`);
    const masto = flags.includes("--mastodon");
    if (dryRun) {
      console.log(`   (dry-run) Mastodon ${masto ? "wäre" : "nicht"} gesendet`);
    }
    if (masto && !dryRun) {
      await postToMastodon(slug, fm, dryRun);
    }
    return;
  }

  console.log(`\n📝  Crossposting: ${fm.title}`);
  console.log(`🔗  Canonical: https://woitzik.dev/blog/${slug}/`);
  console.log(`🏷️   Tags: ${(fm.tags || []).join(", ")}\n`);

  if (doDevTo) await postToDevTo(slug, fm, markdown, dryRun, updateDevTo, known);
  if (flags.includes("--mastodon")) await postToMastodon(slug, fm, dryRun);
}

if (doAll) {
  const { readdirSync } = await import("fs");
  const allSlugs = readdirSync(resolve(ROOT, "src/content/blog"))
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""))
    .sort();

  if (allSlugs.length === 0) {
    console.log("\n✅  Nothing to post.");
    process.exit(0);
  }

  // --new fetches the published set once and posts only the gap, so a run that
  // has nothing to do costs one API call and no sleep. --all keeps the old
  // per-article check for deliberate backfill.
  let published = null;
  if (onlyNew && doDevTo && !updateDevTo) {
    if (dryRun) {
      console.log("\n[DRY RUN] would fetch published set, post only missing articles");
    } else {
      published = await publishedSlugsOnDevTo(process.env.DEVTO_API_KEY);
      console.log(
        `🔍  dev.to: ${published.size} already published, ${allSlugs.length} local articles`,
      );
    }
  }

  let candidates = allSlugs;
  if (published) {
    candidates = allSlugs.filter((s) => {
      const raw = readFileSync(resolve(ROOT, `src/content/blog/${s}.mdx`), "utf8");
      const fm = parseFrontmatter(raw);
      return fm.lang !== "de" && !published.has(s);
    });
  }

  // --max takes the first N of the *remaining* work, not the first N
  // alphabetically — otherwise --max=5 re-checks the same five oldest slugs
  // forever and the "N remaining, run again" hint can never make progress.
  const toPost = maxPosts > 0 ? candidates.slice(0, maxPosts) : candidates;

  console.log(
    `\n🔄  Crossposting ${toPost.length} article(s)${maxPosts > 0 ? ` (max ${maxPosts})` : ""}`,
  );

  if (toPost.length === 0) {
    console.log("\n✅  Nothing to post — dev.to is already up to date.");
    process.exit(0);
  }

  let posted = 0;
  for (let i = 0; i < toPost.length; i++) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  [${i + 1}/${toPost.length}] ${toPost[i]}`);
    console.log(`${"═".repeat(60)}`);

    await crosspostOne(toPost[i], published ? false : undefined);
    posted++;

    if (delayMs > 0 && i < toPost.length - 1) {
      console.log(`\n⏳  Waiting ${delayMs / 1000}s before next post...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const remaining = candidates.length - toPost.length;
  console.log(`\n✅  Done! Crossposted ${posted} article(s).`);
  if (remaining > 0) console.log(`📋  ${remaining} remaining — run again with --new to continue.`);
} else {
  await crosspostOne(slugOrAll);
}
