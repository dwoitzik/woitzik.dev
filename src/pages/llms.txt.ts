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
    "> Hybrid Cloud Engineer specializing in Azure, Terraform, and Zero-Trust network architecture. Publishes free Terraform modules for Azure and hands-on articles on Kubernetes, homelab infrastructure, and networking.",
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
    "## Tools",
    "",
    "Free browser calculators. No sign-up, all arithmetic runs in the page.",
    "",
    "- [Tool index](https://woitzik.dev/tools/): All calculators on one page",
    "- [RAID Capacity Calculator](https://woitzik.dev/tools/raid-calculator/): Usable capacity, parity overhead and drive failure tolerance for RAID 0/1/5/6/10 and SHR-1/SHR-2, including mixed drive sizes",
    "- [IPv4 and IPv6 Subnet Calculator](https://woitzik.dev/tools/subnet-calculator/): Network address, broadcast or last address, netmask and usable host count for any IPv4 or IPv6 CIDR",
    "- [Network Transfer Time Calculator](https://woitzik.dev/tools/transfer-time-calculator/): How long a copy takes over 100 Mbit to 25 Gbit ethernet at a given share of line rate",
    "- [VLAN ID Planner](https://woitzik.dev/tools/vlan-planner/): Validates 802.1Q VLAN IDs against the 1-4094 range, finds duplicates and locates free ID blocks",
    "",
    "## Terraform Modules (free, MIT licensed)",
    "",
    "- [Azure Acmebot - Zero-Trust Edition](https://woitzik.dev/templates/): Let's Encrypt automation for Azure with Private Link isolation and Managed Identity",
    "- [Hub & Spoke - Zero-Trust Edition](https://woitzik.dev/templates/): Zero-Trust NSGs, centralized Private DNS, DINE policy bypass",
    "- [Azure Firewall - Forced Tunneling Edition](https://woitzik.dev/templates/): Forced tunneling without the Terraform cycle error, with KMS and Azure AD bypass routes",
    "- [Azure OpenAI RAG - Zero-Trust Networking](https://woitzik.dev/templates/): Private Endpoints and Private DNS for Azure OpenAI and AI Search, Managed Identity RBAC instead of shared keys",
    "- [Private AKS - Zero-Trust Edition](https://woitzik.dev/templates/): Private API server, forced-tunneled egress, private-endpoint-only ACR and Key Vault",
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
