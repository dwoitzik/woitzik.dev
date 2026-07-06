import { readdirSync, readFileSync, renameSync, appendFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const QUEUE_DIR = resolve(ROOT, "src/content/blog-queue");
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

const published = [];

for (const file of queued) {
  const srcPath = resolve(QUEUE_DIR, file);
  const content = readFileSync(srcPath, "utf8");
  const date = frontmatterDate(content);
  if (!date) {
    console.warn(`Skipping ${file}: no parseable date frontmatter`);
    continue;
  }
  if (date <= today) {
    const destPath = resolve(BLOG_DIR, file);
    renameSync(srcPath, destPath);
    published.push(file);
    console.log(`Published: ${file} (scheduled ${date.toISOString().slice(0, 10)})`);
  }
}

if (published.length === 0) {
  console.log("Nothing due for publishing today.");
}

// Emit for GitHub Actions to decide whether to commit/push
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `published_count=${published.length}\n`);
}
