import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

export const GET: APIRoute = async () => {
  const posts = (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const lines = [
    "# woitzik.dev",
    "",
    "> Hybrid Cloud Engineer specializing in Azure, Terraform, and Zero-Trust network architecture. Publishes hardened infrastructure templates and deep-dive articles.",
    "",
    "## Blog Posts",
    "",
    ...posts.map(
      (post) =>
        `- [${post.data.title}](https://woitzik.dev/blog/${post.slug}/): ${post.data.description}`,
    ),
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
    "- Website: https://woitzik.dev",
    "- Email: david@woitzik.dev",
    "- GitHub: https://github.com/dwoitzik",
    "- LinkedIn: https://linkedin.com/in/david-woitzik",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
