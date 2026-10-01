import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeAffiliateRel from "./src/plugins/rehype-affiliate-rel.mjs";

// English slug -> German slug. Kept in sync with the translationOf field in
// src/content/blog/*.mdx; the sitemap needs it in config-time, where the
// content collection isn't available yet.
const DE_TRANSLATIONS = {
  "hardening-azure-acmebot-iso27001": "hardening-azure-acmebot-iso27001-nis2-deutsch",
  "mikrotik-wireguard-vpn-terraform": "mikrotik-wireguard-vpn-terraform-deutsch",
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
        const slug = item.url.replace(/\/$/, "").split("/blog/")[1];
        if (!slug) return item;

        const deSlug = DE_TRANSLATIONS[slug];
        if (deSlug) {
          return {
            ...item,
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
            ...item,
            links: [
              { lang: "de", url: item.url },
              { lang: "en", url: `https://woitzik.dev/blog/${enSlug}/` },
              { lang: "x-default", url: `https://woitzik.dev/blog/${enSlug}/` },
            ],
          };
        }

        return item;
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
