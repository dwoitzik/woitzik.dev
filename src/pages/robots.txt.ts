import type { APIRoute } from "astro";

const siteUrl = import.meta.env.SITE ?? "https://woitzik.dev";

const robotsTxt = `
User-agent: *
Allow: /

# Affiliate redirector. Crawling /go/<key> produces a tagged Amazon
# storefront request that Amazon counts as a referral click, which inflates
# click metrics and risks the Associates account. No search value lives here,
# the canonical product link is on the article page itself.
Disallow: /go/

Sitemap: ${new URL("sitemap-index.xml", siteUrl).href}
`.trim();

export const GET: APIRoute = () => {
  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
