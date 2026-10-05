#!/usr/bin/env node
// Reports published articles that have gone stale.
//
// The `updated` frontmatter field already exists and is already wired up: it
// feeds dateModified in the JSON-LD, renders a visible "Updated" badge, and
// shows up on the index cards. Only 6 of 72 published articles set it, though,
// so the plumbing is there and nothing tells you which article to touch next.
//
// That matters more than it used to. Pages refreshed within 30 days collect
// roughly 3.2x the AI citations of equivalent stale pages, and pages left
// untouched for three months are about 3x more likely to lose citations they
// already held. Roughly 65% of AI Overview citations come from content under a
// year old. A library that is never revisited decays out of those answers.
//
// This is a maintenance report, not a build gate, so it exits 0 by default and
// never blocks a deploy. Pass --strict to make it fail, which is what the
// scheduled workflow uses to flag drift on a branch.
//
// Priority signal is affiliate presence, not traffic: an article carrying
// /go/ links is a monetised page, so a lost citation there costs revenue rather
// than just reach. Those sort to the top.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BLOG_DIR = "src/content/blog";

// Thresholds in days, keyed to the citation findings above. TOUCH is the
// 30-day window where refreshing pays the 3.2x multiplier; STALE is the
// 3-month point where held citations start dropping off.
const BUCKETS = [
  { label: "touch", max: 30 },
  { label: "watch", max: 90 },
  { label: "stale", max: 180 },
  { label: "cold", max: 365 },
  { label: "dormant", max: Infinity },
];

const DAY_MS = 86_400_000;
const strict = process.argv.includes("--strict");

function bucketFor(ageDays) {
  return BUCKETS.find((bucket) => ageDays <= bucket.max).label;
}

function field(body, name) {
  const match = body.match(new RegExp(`^${name}:\\s*"?([^"\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : null;
}

function frontmatterOf(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : "";
}

const today = Date.now();
const articles = [];

for (const file of readdirSync(BLOG_DIR)) {
  if (!file.endsWith(".mdx")) continue;

  const raw = readFileSync(join(BLOG_DIR, file), "utf8");
  const frontmatter = frontmatterOf(raw);

  if (/^draft:\s*true/m.test(frontmatter)) continue;

  const published = field(frontmatter, "date");
  if (!published) continue;

  const updated = field(frontmatter, "updated");
  const slug = file.replace(/\.mdx$/, "");

  // `updated` is the refresh date when present. Falling back to `date` means
  // an article nobody has revisited reports its publication age, which is the
  // honest number: nothing about it has been confirmed since.
  const lastTouched = new Date(updated ?? published);
  if (Number.isNaN(lastTouched.getTime())) continue;

  const ageDays = Math.floor((today - lastTouched.getTime()) / DAY_MS);
  const body = raw.slice(raw.indexOf("---", 3) + 3);

  articles.push({
    slug,
    title: field(frontmatter, "title") ?? slug,
    lang: field(frontmatter, "lang") ?? "en",
    translationOf: field(frontmatter, "translationOf"),
    ageDays,
    bucket: bucketFor(ageDays),
    lastTouched: (updated ?? published).slice(0, 10),
    // German articles mirror an English original, so refreshing the English
    // one is the real task. Flagged so the report doesn't double-count the work.
    affiliate: /\/go\/|amazon\.[a-z.]+\//i.test(body),
  });
}

const order = ["stale", "cold", "dormant", "watch", "touch"];
articles.sort(
  (a, b) =>
    order.indexOf(a.bucket) - order.indexOf(b.bucket) ||
    Number(b.affiliate) - Number(a.affiliate) ||
    b.ageDays - a.ageDays,
);

const counts = Object.fromEntries(
  BUCKETS.map((bucket) => [
    bucket.label,
    articles.filter((article) => article.bucket === bucket.label).length,
  ]),
);

const needsWork = articles.filter((article) => article.ageDays > 90);
const monetised = needsWork.filter((article) => article.affiliate);

console.log(`\nPublished articles: ${articles.length}`);
console.log(
  `  touch (<=30d) ${counts.touch}   watch (<=90d) ${counts.watch}   ` +
    `stale (<=180d) ${counts.stale}   cold (<=365d) ${counts.cold}   ` +
    `dormant (>365d) ${counts.dormant}`,
);
console.log(
  `\nPast the 3-month mark: ${needsWork.length} ` +
    `(${monetised.length} of them carrying affiliate links)`,
);

if (monetised.length) {
  console.log("\nMonetised pages to refresh first:");
  for (const article of monetised) {
    console.log(
      `  ${article.ageDays.toString().padStart(4)}d  ` +
        `${article.bucket.padEnd(8)} ${article.slug}`,
    );
  }
}

if (needsWork.length) {
  console.log(`\nAll ${needsWork.length} articles older than 90 days:`);
  for (const article of needsWork) {
    const flags = [
      article.affiliate ? "affiliate" : null,
      article.lang === "de" ? "de" : null,
      article.translationOf ? "translation" : null,
    ]
      .filter(Boolean)
      .join(",");
    console.log(
      `  ${article.ageDays.toString().padStart(4)}d  ` +
        `${article.bucket.padEnd(8)} ${article.slug.padEnd(52)} ` +
        `${article.lastTouched}${flags ? `  [${flags}]` : ""}`,
    );
  }
}

console.log(
  "\nRefreshing means: set `updated:` to today only after the body actually " +
    "changed.\n",
);

if (strict && needsWork.length) {
  console.error(
    `strict mode: ${needsWork.length} article(s) past 90 days without a refresh`,
  );
  process.exit(1);
}
