import { readdirSync, readFileSync, renameSync, appendFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const QUEUE_DIR = resolve(ROOT, "content-queue/blog");
const BLOG_DIR = resolve(ROOT, "src/content/blog");

function frontmatterDate(content) {
  const match = content.match(/^date:\s*"([^"]+)"/m);
  if (!match) return null;
  return new Date(match[1]);
}

const today = new Date();
today.setHours(0, 0, 0, 0);

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

// Emit for GitHub Actions to decide whether to commit/push
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `published_count=${published.length}\n`);
}
