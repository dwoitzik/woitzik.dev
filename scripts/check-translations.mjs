#!/usr/bin/env node
// Guards the dual source of truth for translation pairs.
//
// hreflang in the page head is derived from each German article's `translationOf`
// frontmatter. The sitemap's xhtml:link alternates come from the hardcoded
// DE_TRANSLATIONS map in astro.config.mjs, because astro.config is evaluated
// before content collections are readable. Nothing connects the two, so
// promoting a German article without editing that map silently ships a page whose
// head advertises a complete hreflang cluster while the sitemap omits it.
//
// This check fails the build when the two disagree.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BLOG_DIR = "src/content/blog";
const CONFIG = "astro.config.mjs";

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

function configMap() {
  const src = readFileSync(CONFIG, "utf8");
  const start = src.indexOf("const DE_TRANSLATIONS = {");
  if (start < 0) throw new Error("DE_TRANSLATIONS not found in " + CONFIG);
  const open = src.indexOf("{", start);
  const close = src.indexOf("};", open);
  const body = src.slice(open + 1, close);
  const map = {};
  for (const entry of body.split(",")) {
    const t = entry.trim();
    if (!t) continue;
    const ci = t.indexOf(":");
    if (ci < 0) continue;
    const k = t
      .slice(0, ci)
      .trim()
      .replace(/^["']|["']$/g, "");
    const v = t
      .slice(ci + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    map[k] = v;
  }
  return map;
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
  expected[fm.translationOf] = slug;
}

const configured = configMap();
const DE_TO_ENGLISH = {};
for (const [en, de] of Object.entries(configured)) DE_TO_ENGLISH[de] = en;

for (const [en, de] of Object.entries(expected)) {
  if (!(en in configured)) {
    problems.push(
      "astro.config.mjs: missing DE_TRANSLATIONS entry " + en + " -> " + de,
    );
  } else if (configured[en] !== de) {
    problems.push(
      "astro.config.mjs: " +
        en +
        " -> " +
        configured[en] +
        " but content says " +
        de,
    );
  }
}
for (const [en, de] of Object.entries(configured)) {
  if (!(en in expected)) {
    problems.push(
      "astro.config.mjs: stale DE_TRANSLATIONS entry " +
        en +
        " -> " +
        de +
        " (no German article claims it)",
    );
  }
  if (!slugs.has(en))
    problems.push(
      "astro.config.mjs: key " + en + " is not a published article",
    );
  if (!slugs.has(de))
    problems.push(
      "astro.config.mjs: value " + de + " is not a published article",
    );
}

console.log("German articles:            " + deCount);
console.log("translation pairs (content): " + Object.keys(expected).length);
console.log("DE_TRANSLATIONS entries:     " + Object.keys(configured).length);
console.log("German originals (unpaired): " + germanOriginals.length);
for (const s of germanOriginals) console.log("  - " + s);
console.log("");

// Every German original must stay out of the sitemap map. Adding one would make
// the sitemap emit an xhtml:link to a URL that is never generated, since no
// English page exists to carry the reciprocal.
for (const s of germanOriginals) {
  if (s in DE_TO_ENGLISH) {
    problems.push(
      "astro.config.mjs: German original " +
        s +
        " is mapped as a translation but no English article claims it",
    );
  }
}

if (problems.length === 0) {
  console.log("translation metadata consistent");
} else {
  console.log(problems.length + " PROBLEM(S):");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
