import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeAffiliateRel from "./src/plugins/rehype-affiliate-rel.mjs";

const contentRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "src/content",
);

// Reads `date` and `updated` straight out of the frontmatter instead of going
// through getCollection: the sitemap's serialize() runs at config time, before
// the content collections exist. A regex over the frontmatter block is enough
// because both fields are plain quoted ISO dates on a single line, and it
// avoids a yaml dependency for two values.
function lastmodBySlug(collection) {
  const map = new Map();
  let files;
  try {
    files = readdirSync(join(contentRoot, collection));
  } catch {
    return map;
  }

  for (const file of files) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const slug = file.replace(/\.mdx?$/, "");
    const source = readFileSync(join(contentRoot, collection, file), "utf8");
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) continue;

    const updated = frontmatter[1].match(/^updated:\s*"?([\d-]+)"?/m);
    const date = frontmatter[1].match(/^date:\s*"?([\d-]+)"?/m);
    // `updated` wins where present: it is the honest signal for how recently the
    // content was reviewed, which is exactly what a crawler re-fetching on
    // `lastmod` wants to know.
    const value = updated?.[1] ?? date?.[1];
    if (value) map.set(slug, new Date(`${value}T00:00:00Z`));
  }
  return map;
}

const BLOG_LASTMOD = lastmodBySlug("blog");
const PROJECT_LASTMOD = lastmodBySlug("projects");

// Tag pages carry the newest lastmod of the articles they list. Without this
// they are the one large group of URLs in the sitemap with no date at all,
// which is the same signal a crawler uses to decide a page is finished.
const TAG_LASTMOD = (() => {
  const map = new Map();
  let files;
  try {
    files = readdirSync(join(contentRoot, "blog"));
  } catch {
    return map;
  }

  for (const file of files) {
    if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
    const source = readFileSync(join(contentRoot, "blog", file), "utf8");
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter) continue;

    const updated = frontmatter[1].match(/^updated:\s*"?([\d-]+)"?/m);
    const date = frontmatter[1].match(/^date:\s*"?([\d-]+)"?/m);
    const value = updated?.[1] ?? date?.[1];
    if (!value) continue;
    const when = new Date(`${value}T00:00:00Z`);

    const tags = frontmatter[1].match(/^tags:\s*\[(.*?)\]/m);
    if (!tags) continue;
    for (const raw of tags[1].split(",")) {
      const tag = raw.trim().replace(/^["']|["']$/g, "");
      if (!tag) continue;
      // Matches the lowercased tag in the route: /blog/tag/<lowercase>/
      const key = tag.toLowerCase();
      const seen = map.get(key);
      if (!seen || when > seen) map.set(key, when);
    }
  }
  return map;
})();

// English slug -> German slug. Kept in sync with the translationOf field in
// src/content/blog/*.mdx; the sitemap needs it in config-time, where the
// content collection isn't available yet.
const DE_TRANSLATIONS = {
  "hardening-azure-acmebot-iso27001":
    "hardening-azure-acmebot-iso27001-nis2-deutsch",
  "mikrotik-wireguard-vpn-terraform":
    "mikrotik-wireguard-vpn-terraform-deutsch",
  "velero-garage-k3s-backup": "velero-garage-s3-backup-k3s-deutsch",
  "kubernetes-securitycontext-hardening-broke-9-containers":
    "securitycontext-haertung-brach-9-container-kubernetes",
};

const DE_TO_ENGLISH = Object.fromEntries(
  Object.entries(DE_TRANSLATIONS).map(([en, de]) => [de, en]),
);

export default defineConfig({
  site: "https://woitzik.dev",
  trailingSlash: "always",
  integrations: [
    mdx(),
    sitemap({
      namespaces: { xhtml: true },
      // Google reads the hreflang cluster from the sitemap as well as from the
      // page head. Emitting it here means the relationship between an English
      // original and its German translation is discoverable from a single fetch
      // of the sitemap.
      serialize(item) {
        const bare = item.url.replace(/\/$/, "");

        // Tag URLs are checked first: they also contain "/blog/", so a plain
        // /blog/ split would swallow "tag/chaos%20engineering" as if it were a
        // post slug and no article by that name exists.
        const tagSlug = bare.split("/blog/tag/")[1];
        const blogSlug = bare.split("/blog/")[1];
        const projectSlug = bare.split("/projects/")[1];

        // lastmod is attached before the hreflang branches below so they inherit
        // it instead of dropping it. Without it a crawler has no signal for when
        // a page was last reviewed, which is what decides how often an article
        // with aging content gets re-fetched.
        const withDate = { ...item };
        const lastmod =
          tagSlug !== undefined
            ? TAG_LASTMOD.get(decodeURIComponent(tagSlug).toLowerCase())
            : blogSlug !== undefined
              ? BLOG_LASTMOD.get(blogSlug)
              : projectSlug !== undefined
                ? PROJECT_LASTMOD.get(projectSlug)
                : undefined;
        if (lastmod) withDate.lastmod = lastmod;

        // Tag pages have no hreflang cluster, so they exit before the
        // translation lookup below.
        if (tagSlug !== undefined) return withDate;

        const slug = blogSlug ?? projectSlug;
        if (!slug) return withDate;

        const deSlug = DE_TRANSLATIONS[slug];
        if (deSlug) {
          return {
            ...withDate,
            links: [
              { lang: "en", url: item.url },
              { lang: "de", url: `https://woitzik.dev/blog/${deSlug}/` },
              { lang: "x-default", url: item.url },
            ],
          };
        }

        // German side of the cluster. Google flags a one-directional hreflang
        // setup: if the English URL lists the German one but the German URL
        // doesn't list the English one, neither side is confirmed as the
        // alternate of the other.
        const enSlug = DE_TO_ENGLISH[slug];
        if (enSlug) {
          return {
            ...withDate,
            links: [
              { lang: "de", url: item.url },
              { lang: "en", url: `https://woitzik.dev/blog/${enSlug}/` },
              { lang: "x-default", url: `https://woitzik.dev/blog/${enSlug}/` },
            ],
          };
        }

        return withDate;
      },
    }),
    tailwind(),
  ],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      rehypeAffiliateRel,
    ],
  },
});
