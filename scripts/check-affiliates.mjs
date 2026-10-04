#!/usr/bin/env node
// Guards the affiliate disclosure contract.
//
// Every Amazon link in an article goes through /go/<key>, which redirects via
// the ASIN map in api/go/[key].ts. The articles promise the reader, in a
// disclosure line, that affiliate links are "marked with *". That promise is
// enforced by nothing: /go/ is just a path, so a plain `[Synology DS225+]
// (/go/4hmdcNX)` renders as an unmarked link on a page whose disclosure claims
// otherwise. That is exactly what happened - the NAS guide, the highest
// earning page, shipped with zero marked links.
//
// Three failure modes are checked here:
//   1. an affiliate link that is not visibly marked
//   2. an article carrying affiliate links without the canonical disclosure
//   3. a /go/ key with no entry in the ASIN map, i.e. a redirect to nowhere
//
// Published articles are fatal. Queued articles are reported as warnings only,
// because a draft is allowed to be incomplete until the day it ships.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BLOG_DIR = "src/content/blog";
const QUEUE_DIR = "content-queue/blog";
const MAP_FILE = "api/go/[key].ts";

const DISCLOSURE_EN =
  "<em>Disclosure: This post contains Amazon affiliate links (marked with " +
  "&#42;). If you buy through them, I earn a small commission at no extra " +
  "cost to you. I only link gear I actually own and use daily.</em>";

// German articles get the German notice, not the English one. A German reader
// is entitled to the disclosure in the language the article is written in, and
// the German text is not a translation of the English one verbatim.
const DISCLOSURE_DE =
  "<em>Hinweis: Dieser Beitrag enthält Amazon-Affiliate-Links (mit &#42; " +
  "markiert). Wenn du darüber kaufst, verdiene ich eine kleine Provision - " +
  "für dich kostet es nichts extra. Ich verlinke nur Hardware, die ich selbst " +
  "benutze.</em>";

// AffiliateLink.astro appends &#42; itself, so a link wrapped in that
// component is marked by construction and needs no literal asterisk.
const COMPONENT = /<AffiliateLink\b/;

function asinKeys() {
  const src = readFileSync(MAP_FILE, "utf8");
  const start = src.indexOf("const ASINS: Record<string, string> = {");
  if (start < 0) throw new Error("ASINS map not found in " + MAP_FILE);
  const open = src.indexOf("{", start);
  const close = src.indexOf("\n};", open);
  const keys = new Set();
  for (const m of src.slice(open + 1, close).matchAll(/"([a-zA-Z0-9-]+)":/g)) {
    keys.add(m[1]);
  }
  return keys;
}

const keys = asinKeys();

const problems = [];
const warnings = [];

function scan(dir, file, report) {
  const raw = readFileSync(join(dir, file), "utf8");

  // Strip fenced code so example snippets cannot trigger the audit.
  const body = raw.replace(/```[\s\S]*?```/g, "");

  // English articles carry no `lang` key and rely on the collection schema
  // default, exactly as in check-translations.mjs.
  const lang = /^lang:\s*"?([a-z]{2})/m.exec(raw);
  const language = lang ? lang[1] : "en";

  // A marked link looks like [Product[*]](/go/key): the marker contributes its
  // own closing bracket, so a naive [^\]]* cannot span it. This pattern allows
  // one level of balanced brackets inside the link text and therefore matches
  // marked and unmarked links alike. Getting this wrong makes the audit match
  // only the unmarked ones, which looks like a clean bill of health.
  const rawLinks = [
    ...body.matchAll(
      /\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\/go\/([a-zA-Z0-9-]+)\)/g,
    ),
  ];
  const componentCount = (body.match(/<AffiliateLink\b/g) || []).length;
  const hasLinks = rawLinks.length > 0 || componentCount > 0;

  if (!hasLinks) return { links: 0, articles: 0, articlesWithLinks: 0 };

  for (const m of rawLinks) {
    const [, text, key] = m;
    if (!/[*∗]|&#42;/.test(text)) {
      report(
        file + ": affiliate link is not marked: [" + text + "](/go/" + key + ")",
      );
    }
    // Brackets inside the link text render literally, so "[Product[*]]" shows
    // the reader "[Product[*]]" instead of "Product*". A correct marker is a
    // bare asterisk, so any bracket in the text is a defect.
    if (/[[\]]/.test(text)) {
      report(
        file +
          ": affiliate link text contains brackets and will render them: [" +
          text +
          "](/go/" +
          key +
          ")",
      );
    }
    if (!keys.has(key)) {
      report(
        file + ": /go/" + key + " has no entry in the ASIN map (" + MAP_FILE + ")",
      );
    }
  }

  // Every /go/ key must be reachable through the map, including the ones that
  // only appear inside AffiliateLink components.
  for (const m of body.matchAll(/\/go\/([a-zA-Z0-9-]+)/g)) {
    if (!keys.has(m[1])) {
      report(
        file + ": /go/" + m[1] + " has no entry in the ASIN map (" + MAP_FILE + ")",
      );
    }
  }

  if (!body.includes(language === "de" ? DISCLOSURE_DE : DISCLOSURE_EN)) {
    report(
      file +
        ": has affiliate links but no " +
        (language === "de" ? "German" : "English") +
        " disclosure line (expected: *" +
        (language === "de"
          ? "Hinweis: Dieser Beitrag enthält Amazon-Affiliate-Links"
          : "Disclosure: This post contains Amazon affiliate links") +
        "...*)",
    );
  }

  return { links: rawLinks.length + componentCount, articles: 1, articlesWithLinks: 1 };
}

let pubArticles = 0;
let pubWithLinks = 0;
let pubLinks = 0;
for (const f of readdirSync(BLOG_DIR).filter((x) => x.endsWith(".mdx"))) {
  pubArticles++;
  const r = scan(BLOG_DIR, f, (m) => problems.push(m));
  pubLinks += r.links;
  if (r.articlesWithLinks) pubWithLinks++;
}

let queuedWithLinks = 0;
let queuedArticles = 0;
for (const f of readdirSync(QUEUE_DIR).filter((x) => x.endsWith(".mdx"))) {
  queuedArticles++;
  const r = scan(QUEUE_DIR, f, (m) => warnings.push(m));
  if (r.articlesWithLinks) queuedWithLinks++;
}

console.log("published articles:          " + pubArticles);
console.log("  with affiliate links:      " + pubWithLinks);
console.log("  affiliate links:           " + pubLinks);
console.log("queued articles:             " + queuedArticles);
console.log("  with affiliate links:      " + queuedWithLinks);
console.log("ASIN map entries:            " + keys.size);
console.log("");

if (warnings.length) {
  console.log(warnings.length + " queue warning(s) - not blocking:");
  for (const w of warnings) console.log("  ~ " + w);
  console.log("");
}

if (problems.length === 0) {
  console.log("affiliate disclosure consistent");
} else {
  console.log(problems.length + " PROBLEM(S):");
  for (const p of problems) console.log("  - " + p);
  process.exit(1);
}
