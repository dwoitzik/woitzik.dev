import { readdirSync, readFileSync, renameSync, appendFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const QUEUE_DIR = resolve(ROOT, "content-queue/blog");
const BLOG_DIR = resolve(ROOT, "src/content/blog");

const SITE_URL = "https://woitzik.dev";

function frontmatterDate(content) {
  const match = content.match(/^date:\s*"([^"]+)"/m);
  if (!match) return null;
  return new Date(match[1]);
}

// UTC, not local time: frontmatter dates are bare "YYYY-MM-DD" (parsed as UTC
// midnight), and the GitHub Actions runner is UTC anyway — local-time
// comparison only matters when running this by hand off-runner, where it can
// silently shift the due date by your machine's UTC offset.
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

let queued;
try {
  queued = readdirSync(QUEUE_DIR).filter((f) => f.endsWith(".mdx"));
} catch {
  queued = [];
}

// Sort by date ascending — publish oldest first
const withDates = queued
  .map((file) => {
    const content = readFileSync(resolve(QUEUE_DIR, file), "utf8");
    const date = frontmatterDate(content);
    return { file, date };
  })
  .filter((item) => {
    if (!item.date) {
      console.warn(`Skipping ${item.file}: no parseable date frontmatter`);
      return false;
    }
    return item.date <= today;
  })
  .sort((a, b) => a.date - b.date);

const published = [];

if (withDates.length > 0) {
  for (const { file, date } of withDates) {
    const srcPath = resolve(QUEUE_DIR, file);
    const destPath = resolve(BLOG_DIR, file);
    renameSync(srcPath, destPath);
    published.push(file);
    console.log(`Published: ${file} (scheduled ${date.toISOString().slice(0, 10)})`);
  }
} else {
  console.log("Nothing due for publishing today.");
}

// URLs to announce via IndexNow once the deploy is live (the workflow does
// that after the push, because pinging before Vercel has built the commit
// sends crawlers to a 404). A German translation also changes the hreflang
// cluster of its English original, so that page is announced too.
const urls = [];
for (const file of published) {
  urls.push(`${SITE_URL}/blog/${file.replace(/\.mdx$/, "")}/`);
  const parent = readFileSync(resolve(BLOG_DIR, file), "utf8").match(
    /^translationOf:\s*"?([a-z0-9-]+)"?\s*$/m,
  );
  if (parent) urls.push(`${SITE_URL}/blog/${parent[1]}/`);
}

// Emit for GitHub Actions to decide whether to commit/push
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `published_count=${published.length}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `urls=${urls.join(" ")}\n`);
}
