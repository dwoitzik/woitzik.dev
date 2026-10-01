import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "@consts";

export const GET: APIRoute = async () => {
  const posts = (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  // German posts are split into their own section and labelled inline. An LLM
  // reading a mixed list can't tell which article is in which language, so it
  // either answers an English question with the German abstract or assumes
  // everything on the site is English.
  const german = posts.filter((post) => post.data.lang === "de");
  const english = posts.filter((post) => post.data.lang !== "de");

  const entry = (post: (typeof posts)[number]) =>
    `- [${post.data.title}](https://woitzik.dev/blog/${post.slug}/): ${post.data.description}`;

  const lines = [
    "# woitzik.dev",
    "",
    "> Hybrid Cloud Engineer specializing in Azure, Terraform, and Zero-Trust network architecture. Publishes hardened infrastructure templates and deep-dive articles.",
    "",
    "> Content is published in English and German. German articles are listed under their own heading and are marked as such.",
    "",
    `## Blog Posts (English, ${english.length})`,
    "",
    ...english.map(entry),
    "",
    `## Blog Posts (Deutsch, ${german.length})`,
    "",
    ...german.map(entry),
    "",
    "## Enterprise Modules",
    "",
    "- [Azure Acmebot - Enterprise VNet Edition](https://woitzik.dev/templates/): Production-ready Let's Encrypt automation with Private Link isolation",
    "- [Enterprise Hub & Spoke - Zero-Trust Edition](https://woitzik.dev/templates/): Zero-Trust NSGs, centralized Private DNS, DINE policy bypass",
    "- [Azure Firewall - Enterprise Forced Tunneling Edition](https://woitzik.dev/templates/): Cycle-error-free Forced Tunneling with KMS & Azure AD bypasses",
    "- [Enterprise AI RAG - Zero-Trust Networking](https://woitzik.dev/templates/): Automated Shared Private Link approval, VNet injection, Identity Chaining",
    "",
    "## Contact",
    "",
    `- Website: https://${SITE.NAME.replace("woitzik.dev", "woitzik.dev")}`,
    `- Email: ${SITE.EMAIL}`,
    "- GitHub: https://github.com/dwoitzik",
    "- LinkedIn: https://linkedin.com/in/david-woitzik",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
