import { readdirSync, readFileSync, renameSync, appendFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const QUEUE_DIR = resolve(ROOT, "content-queue/blog");
const BLOG_DIR = resolve(ROOT, "src/content/blog");

const SITE_URL = "https://woitzik.dev";
// Key file lives at public/<key>.txt (served at the site root) - IndexNow
// verifies ownership by fetching it, no account/registration involved.
const INDEXNOW_KEY = "d3fa48a9db675c01bf0a0863f0672b6d";

// Pings the shared IndexNow endpoint, which fans out to every participating
// engine (Bing, Yandex, etc - not Google, which doesn't support the
// protocol). Best-effort: a failed ping here shouldn't fail the publish step,
// the article is already live either way and will get crawled eventually.
async function pingIndexNow(slugs) {
  if (slugs.length === 0) return;
  const urlList = slugs.map((slug) => `${SITE_URL}/blog/${slug}/`);
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).hostname,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    console.log(`IndexNow: submitted ${urlList.length} URL(s), status ${res.status}`);
  } catch (err) {
    console.warn(`IndexNow submission failed (non-fatal): ${err.message}`);
  }
}

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

await pingIndexNow(published.map((file) => file.replace(/\.mdx$/, "")));

// Emit for GitHub Actions to decide whether to commit/push
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `published_count=${published.length}\n`);
}
