import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeAffiliateRel from "./src/plugins/rehype-affiliate-rel.mjs";

export default defineConfig({
  site: "https://woitzik.dev",
  trailingSlash: "always",
  integrations: [mdx(), sitemap(), tailwind()],
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      rehypeAffiliateRel,
    ],
  },
});
