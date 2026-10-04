import type { APIRoute } from "astro";

const siteUrl = import.meta.env.SITE ?? "https://woitzik.dev";

// Explicit allow-list for the AI search crawlers. The wildcard below already
// permitted them, so this documents intent rather than changing access.
//
// Two traps this avoids:
//   1. robots.txt matches the MOST SPECIFIC user-agent group only. A bare
//      "User-agent: OAI-SearchBot / Allow: /" would stop matching the wildcard,
//      and the affiliate "Disallow: /go/" rule lives in the wildcard. The bots
//      would then be free to crawl /go/, which logs as referral clicks and
//      inflates Amazon metrics. Hence the repeated Disallow in every group.
//   2. Only the SEARCH crawlers are listed. GPTBot and ClaudeBot are training
//      crawlers; blocking those is an independent decision and this site does
//      not block them.
const aiSearchBots = [
  // OpenAI: search inclusion. Per OpenAI, sites opted out of OAI-SearchBot
  // "will not be shown in ChatGPT search answers".
  // https://platform.openai.com/docs/bots
  "OAI-SearchBot",
  // Anthropic: search indexing. Anthropic states blocking Claude-SearchBot
  // "may reduce your site's visibility and accuracy in user search results".
  // Claude-User is user-initiated and honors robots.txt per Anthropic.
  // https://support.claude.com/en/articles/8896518
  "Claude-SearchBot",
  "Claude-User",
  // Perplexity: search. PerplexityBot surfaces and links sites in results.
  // https://docs.perplexity.ai/guides/bots
  "PerplexityBot",
];

const aiSearchBotRules = aiSearchBots
  .map((bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /go/`)
  .join("\n\n");

const robotsTxt = `
${aiSearchBotRules}

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
