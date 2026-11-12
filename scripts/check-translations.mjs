#!/usr/bin/env node
// Checks translation metadata on German articles.
//
// hreflang in the page head and the sitemap's xhtml:link alternates are both
// derived from each German article's `translationOf` frontmatter (astro.config.mjs
// reads the files at config time). This check makes sure every pair it builds is
// valid: the target exists, is English, and is claimed by only one German article.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BLOG_DIR = "src/content/blog";

function frontmatter(file) {
  const raw = readFileSync(join(BLOG_DIR, file), "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
const slugs = new Set(files.map((f) => f.replace(/\.mdx$/, "")));

const problems = [];
const expected = {};
const germanOriginals = [];
let deCount = 0;

for (const f of files) {
  const slug = f.replace(/\.mdx$/, "");
  const fm = frontmatter(f);
  if (!fm) continue;
  if (fm.lang !== "de") continue;
  deCount++;

  // A German article without translationOf is a German original: it has no
  // English sibling, so there is nothing to pair it with and nothing for the
  // sitemap to point at. That is legitimate, not drift.
  if (!fm.translationOf) {
    germanOriginals.push(slug);
    continue;
  }
  if (!slugs.has(fm.translationOf)) {
    problems.push(
      slug + ": translationOf -> " + fm.translationOf + " does not exist",
    );
    continue;
  }
  const parent = frontmatter(fm.translationOf + ".mdx");
  // English articles carry no `lang` key at all and rely on the collection
  // schema default of "en". Treat an absent value as English, otherwise every
  // pair reports as broken.
  const parentLang = parent ? parent.lang || "en" : null;
  if (!parent || parentLang !== "en") {
    problems.push(
      slug +
        ": translationOf -> " +
        fm.translationOf +
        " is not an English article (lang=" +
        parentLang +
        ")",
    );
    continue;
  }
  if (expected[fm.translationOf]) {
    problems.push(
      slug +
        ": translationOf -> " +
        fm.translationOf +
        " is already claimed by " +
        expected[fm.translationOf],
    );
    continue;
  }
  expected[fm.translationOf] = slug;
}

console.log("German articles:            " + deCount);
console.log("translation pairs (content): " + Object.keys(expected).length);
console.log("German originals (unpaired): " + germanOriginals.length);
for (const s of germanOriginals) console.log("  - " + s);
console.log("");

if (problems.length === 0) {
  console.log("translation metadata consistent");
} else {
  console.log(problems.length + " PROBLEM(S):");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
