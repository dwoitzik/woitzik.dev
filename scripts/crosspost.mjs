#!/usr/bin/env node
/**
 * Crosspost a blog article to dev.to, Medium, and announce it on Mastodon.
 *
 * Usage:
 *   node scripts/crosspost.mjs <slug>                 # post everywhere configured
 *   node scripts/crosspost.mjs <slug> --dry-run       # preview without posting
 *   node scripts/crosspost.mjs <slug> --update-devto   # article already exists on
 *                                                       # dev.to -- PUT the current
 *                                                       # markdown instead of skipping
 *                                                       # (Medium/Mastodon still no-op
 *                                                       # since they'd already been posted)
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
async function findOnDevTo(slug, apiKey) {
  const canonical = `https://woitzik.dev/blog/${slug}/`;
  const res = await fetch("https://dev.to/api/articles/me/published?per_page=100", {
    headers: { "api-key": apiKey },
  });
  if (!res.ok) return null;
  const articles = await res.json();
  return articles.find((a) => a.canonical_url === canonical) ?? null;
}

async function postToDevTo(slug, fm, markdown, dryRun, updateExisting) {
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

  const existing = await findOnDevTo(slug, apiKey);

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

// ─── Medium (Playwright — API dead for new users) ──────────────────────────
// Medium's public write API no longer issues new tokens. The only reliable
// import path is browser automation: open medium.com/p/import, paste the
// canonical URL, let Medium pull the content, add attribution + tags, publish.
// Persistent browser context stored in scripts/.auth/medium survives logins.
const mediumPostedFile = resolve(ROOT, "scripts/.medium-posted.json");

function loadMediumPosted() {
  if (!existsSync(mediumPostedFile)) return [];
  return JSON.parse(readFileSync(mediumPostedFile, "utf8"));
}

function saveMediumPosted(slugs) {
  writeFileSync(mediumPostedFile, JSON.stringify(slugs, null, 2) + "\n");
}

async function postToMedium(slug, fm, dryRun) {
  const posted = loadMediumPosted();
  if (posted.includes(slug)) {
    console.log(`⏭️   Medium: already posted (${slug}) — skipping`);
    return;
  }

  const canonicalUrl = `https://woitzik.dev/blog/${slug}/`;

  if (dryRun) {
    console.log(`\n[DRY RUN] Medium: would import ${canonicalUrl}`);
    console.log(`  Title: ${fm.title}`);
    return;
  }

  const { firefox } = await import("playwright");
  const authDir = resolve(ROOT, "scripts/.auth/medium");
  const context = await firefox.launchPersistentContext(authDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();

  await page.goto("https://medium.com/p/import", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // If login page, wait for user
  if (page.url().includes("login") || page.url().includes("signin")) {
    console.log("🔐  Medium: Bitte einloggen im Browser-Fenster...");
    console.log("    Warte bis zu 120 Sekunden...");
    await page.waitForURL("**/p/import", { timeout: 120000 });
    console.log("    Login erkannt, fahre fort...");
    await page.waitForTimeout(2000);
  }

  console.log(`📤  Medium: importing ${canonicalUrl}...`);

  // Find import URL input
  const urlInput = page.locator('input[placeholder*="URL"], input[type="url"], textarea[placeholder*="URL"]').first();
  if (await urlInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    await urlInput.fill(canonicalUrl);
  } else {
    const anyInput = page.locator('input[type="text"], input:not([type])').first();
    await anyInput.fill(canonicalUrl);
  }

  // Click Import
  const importBtn = page.locator('button:has-text("Import"), button:has-text("import")').first();
  await importBtn.click();

  // Wait for editor
  console.log("⏳  Medium: waiting for content...");
  await page.waitForURL("**/edit/**", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Publish
  console.log("🚀  Medium: publishing...");
  const publishBtn = page.locator('button:has-text("Publish")').first();
  if (await publishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await publishBtn.click();
    await page.waitForTimeout(3000);
    const confirmBtn = page.locator('button:has-text("Publish"), button:has-text("Got it")').last();
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }
  }

  await page.waitForTimeout(3000);
  console.log(`✅  Medium: ${page.url()}`);
  saveMediumPosted([...posted, slug]);
  await context.close();
}

// ─── Hackernoon (Playwright — no API, editorial review) ────────────────────
// Hackernoon has no write API. Import via writer dashboard, set canonical
// URL ("First seen at"), submit for editorial review (3-4 business days).
const hackernoonPostedFile = resolve(ROOT, "scripts/.hackernoon-posted.json");

function loadHackernoonPosted() {
  if (!existsSync(hackernoonPostedFile)) return [];
  return JSON.parse(readFileSync(hackernoonPostedFile, "utf8"));
}

function saveHackernoonPosted(slugs) {
  writeFileSync(hackernoonPostedFile, JSON.stringify(slugs, null, 2) + "\n");
}

async function postToHackernoon(slug, fm, dryRun) {
  const posted = loadHackernoonPosted();
  if (posted.includes(slug)) {
    console.log(`⏭️   Hackernoon: already posted (${slug}) — skipping`);
    return;
  }

  const canonicalUrl = `https://woitzik.dev/blog/${slug}/`;
  const tags = (fm.tags || []).slice(0, 5);

  if (dryRun) {
    console.log(`\n[DRY RUN] Hackernoon: would import ${canonicalUrl}`);
    console.log(`  Title: ${fm.title}`);
    console.log(`  Tags: ${tags.join(", ")}`);
    return;
  }

  const { firefox } = await import("playwright");
  const authDir = resolve(ROOT, "scripts/.auth/hackernoon");
  const context = await firefox.launchPersistentContext(authDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();

  // Navigate to writer dashboard
  await page.goto("https://app.hackernoon.com/new", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check if logged in
  if (page.url().includes("login") || page.url().includes("sign")) {
    console.log("🔐  Hackernoon: please log in manually in the browser window...");
    console.log("    Waiting up to 120 seconds...");
    await page.waitForURL("**/new", { timeout: 120000 });
    console.log("    Login detected, continuing...");
    await page.waitForTimeout(2000);
  }

  // Look for import option — try the import tab or URL import
  console.log(`📤  Hackernoon: importing ${canonicalUrl}...`);

  // Try clicking "Import Story" or similar
  const importBtn = page.locator('button:has-text("Import"), a:has-text("Import"), [data-testid*="import"]').first();
  if (await importBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await importBtn.click();
    await page.waitForTimeout(2000);
  }

  // Find URL input for import
  const urlInput = page.locator('input[placeholder*="URL"], input[placeholder*="url"], input[placeholder*="link"], textarea[placeholder*="URL"]').first();
  if (await urlInput.isVisible({ timeout: 10000 }).catch(() => false)) {
    await urlInput.fill(canonicalUrl);
    // Submit the import
    const submitBtn = page.locator('button:has-text("Import"), button:has-text("Submit"), button:has-text("import")').first();
    if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitBtn.click();
    }
  } else {
    // Fallback: paste content directly into editor
    console.log("⚠️   Hackernoon: import URL input not found, trying direct paste...");
    const editor = page.locator('[contenteditable="true"], .ProseMirror, .editor').first();
    if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editor.click();
      // Read and paste the markdown content
      const mdxPath = resolve(ROOT, `src/content/blog/${slug}.mdx`);
      const raw = readFileSync(mdxPath, "utf8");
      const body = mdxToMarkdown(raw, slug);
      await page.keyboard.insertText(body);
    }
  }

  await page.waitForTimeout(5000);

  // Set canonical URL in Story Settings ("First seen at")
  console.log("🔗  Hackernoon: setting canonical URL...");
  const settingsBtn = page.locator('button:has-text("Story Settings"), [data-testid*="settings"], button:has-text("Settings")').first();
  if (await settingsBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await settingsBtn.click();
    await page.waitForTimeout(2000);

    const firstSeenInput = page.locator('input[placeholder*="First seen"], input[placeholder*="first seen"], input[name*="canonical"], input[name*="firstSeen"]').first();
    if (await firstSeenInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstSeenInput.fill(canonicalUrl);
    }
  }

  // Submit for review
  console.log("🚀  Hackernoon: submitting for review...");
  const submitReviewBtn = page.locator('button:has-text("Submit"), button:has-text("submit for review"), button:has-text("Submit Story")').first();
  if (await submitReviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await submitReviewBtn.click();
    await page.waitForTimeout(3000);
  }

  console.log(`✅  Hackernoon: submitted (editorial review takes 3-4 business days)`);

  posted.push(slug);
  saveHackernoonPosted(posted);
  await context.close();
}

// ─── Main ─────────────────────────────────────────────────────────────────

const [, , slugOrAll, ...flags] = process.argv;

const dryRun = flags.includes("--dry-run");
const updateDevTo = flags.includes("--update-devto");
const doMedium = flags.includes("--medium");
const doHackernoon = flags.includes("--hackernoon");
const doDevTo = !doMedium && !doHackernoon && !flags.includes("--mastodon");
const doAll = slugOrAll === "--all";
const delayMs = parseInt(flags.find((f) => f.startsWith("--delay="))?.split("=")[1] || "0", 10) * 1000;
const maxPosts = parseInt(flags.find((f) => f.startsWith("--max="))?.split("=")[1] || "0", 10);

if (!slugOrAll) {
  console.error("Usage: node scripts/crosspost.mjs <slug|--all> [flags]");
  console.error("\nPlatforms:");
  console.error("  --devto          Post to dev.to (default, 35s between posts)");
  console.error("  --medium         Post to Medium via Playwright (max 2/day)");
  console.error("  --hackernoon     Post to Hackernoon via Playwright (max 10/day)");
  console.error("  --mastodon       Post to Mastodon");
  console.error("  --all            Post all articles (use with --medium/--hackernoon)");
  console.error("  --delay=N        Seconds between posts (default: platform minimum)");
  console.error("  --update-devto   Update existing dev.to article");
  console.error("  --max=N         Limit posts per run (default: unlimited)");
  console.error("  --dry-run        Preview without posting");
  console.error("\nExamples:");
  console.error("  node scripts/crosspost.mjs my-article --medium");
  console.error("  node scripts/crosspost.mjs --all --devto");
  console.error("  node scripts/crosspost.mjs --all --medium --max=2  (post 2, then stop)");
  console.error("  node scripts/crosspost.mjs --all --medium --delay=43200  (12h between)");
  console.error("\nAvailable slugs:");
  const { readdirSync } = await import("fs");
  readdirSync(resolve(ROOT, "src/content/blog"))
    .filter((f) => f.endsWith(".mdx"))
    .forEach((f) => console.error(" ", f.replace(".mdx", "")));
  process.exit(1);
}

async function crosspostOne(slug) {
  const mdxPath = resolve(ROOT, `src/content/blog/${slug}.mdx`);
  if (!existsSync(mdxPath)) {
    console.error(`❌  Article not found: ${mdxPath}`);
    return;
  }

  const raw = readFileSync(mdxPath, "utf8");
  const fm = parseFrontmatter(raw);
  const markdown = mdxToMarkdown(raw, slug);

  console.log(`\n📝  Crossposting: ${fm.title}`);
  console.log(`🔗  Canonical: https://woitzik.dev/blog/${slug}/`);
  console.log(`🏷️   Tags: ${(fm.tags || []).join(", ")}\n`);

  if (doDevTo) await postToDevTo(slug, fm, markdown, dryRun, updateDevTo);
  if (flags.includes("--mastodon")) await postToMastodon(slug, fm, dryRun);
  if (doMedium) await postToMedium(slug, fm, dryRun);
  if (doHackernoon) await postToHackernoon(slug, fm, dryRun);
}

if (doAll) {
  const { readdirSync } = await import("fs");
  const allSlugs = readdirSync(resolve(ROOT, "src/content/blog"))
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""))
    .sort();

  // Filter out already-posted articles for platforms with tracking
  const slugs = allSlugs.filter((slug) => {
    if (doMedium && loadMediumPosted().includes(slug)) return false;
    if (doHackernoon && loadHackernoonPosted().includes(slug)) return false;
    return true;
  });

  if (slugs.length === 0) {
    console.log("\n✅  All articles already posted — nothing to do.");
    process.exit(0);
  }

  // Default delay: platform minimum if not specified
  let effectiveDelay = delayMs;
  if (effectiveDelay === 0) {
    if (doMedium) effectiveDelay = 43_200; // 12h for Medium (2/day)
    else if (doHackernoon) effectiveDelay = 8640; // ~2.5h for Hackernoon (10/day)
  }

  const toPost = maxPosts > 0 ? slugs.slice(0, maxPosts) : slugs;

  console.log(`\n🔄  Crossposting ${toPost.length} articles${maxPosts > 0 ? ` (max ${maxPosts})` : ""}`);
  if (doMedium) console.log(`⚠️   Medium: max 2/day — ${Math.ceil(toPost.length / 2)} days needed`);
  if (doHackernoon) console.log(`⚠️   Hackernoon: editorial review takes 3-4 business days`);
  console.log("");

  let posted = 0;
  for (let i = 0; i < toPost.length; i++) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  [${i + 1}/${toPost.length}] ${toPost[i]}`);
    console.log(`${"═".repeat(60)}`);

    await crosspostOne(toPost[i]);
    posted++;

    if (effectiveDelay > 0 && i < toPost.length - 1) {
      console.log(`\n⏳  Waiting ${effectiveDelay / 1000}s before next post...`);
      await new Promise((r) => setTimeout(r, effectiveDelay));
    }
  }

  const remaining = slugs.length - toPost.length;
  console.log(`\n✅  Done! Crossposted ${posted} articles.`);
  if (remaining > 0) console.log(`📋  ${remaining} remaining — run again to continue.`);
} else {
  await crosspostOne(slugOrAll);
}
