export type Product = {
  slug: string;
  badge: string;
  title: string;
  description: string;
  price: string;
  priceNote: string;
  href: string;
  articleHref: string;
  tags: string[];
  bullets: string[];
  available: boolean;
};

export const products: Product[] = [
  {
    slug: "acmebot-enterprise-vnet",
    badge: "Terraform Module",
    title: "Azure Acmebot — Enterprise VNet Edition",
    description:
      "Production-ready Let's Encrypt automation for hardened Azure environments. Full Private Link isolation, default-deny firewall rules, and Managed Identity — compliant with ISO 27001, NIS2, and KRITIS out of the box.",
    price: "€49",
    priceNote: "one-time · instant download",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/9ba80f4b-ce9c-40bf-a831-e012b538da8b",
    articleHref: "/blog/hardening-azure-acmebot-iso27001",
    tags: ["Azure", "Terraform", "ISO 27001", "NIS2", "Private Link"],
    bullets: [
      "Default-deny network architecture (VNet Integration + Private Link)",
      "Private DNS Zones — correct resolution out of the box",
      "Entra ID & Managed Identity automation included",
      "Saves 4–8h of senior engineer troubleshooting",
      "Full source code — no lock-in, no black box",
    ],
    available: true,
  },
  {
    slug: "hub-spoke-enterprise-vnet",
    badge: "Terraform Module",
    title: "Enterprise Hub & Spoke — Zero-Trust Edition",
    description:
      "Zero-Trust NSGs, centralized Private DNS, DINE policy bypass — audit-ready on day one.",
    price: "€49",
    priceNote: "one-time · instant download",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/e8caa68b-bc22-489e-b453-2ea28bd28eb0",
    articleHref: "/blog/azure-terraform-hub-spoke-zero-trust",
    tags: ["Azure", "Terraform", "Zero-Trust", "Networking", "Compliance"],
    bullets: [
      "Zero-Trust NSG baseline bound to all Spoke subnets",
      "4 centralized Private DNS Zones (Blob, SQL, Key Vault, ACR)",
      "DINE policy lifecycle bypass — no more broken pipelines",
      "Environment-aware naming convention throughout",
      "Full source code — no lock-in, no black box",
    ],
    available: true,
  },
  {
    slug: "azure-firewall-enterprise",
    badge: "Terraform Module",
    title: "Azure Firewall — Enterprise Forced Tunneling Edition",
    description:
      "Cycle-error-free Forced Tunneling with KMS & Azure AD bypasses, dynamic IP Groups, and FQDN baseline policies. Drops into any existing Hub & Spoke without breaking Windows VMs or Managed Identities.",
    price: "€49",
    priceNote: "one-time · instant download",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/a955d698-acf5-4654-ae16-bb8ec1f7be15",
    articleHref: "/blog/azure-firewall-cycle-error",
    tags: ["Azure", "Terraform", "Firewall", "Networking", "Zero-Trust"],
    bullets: [
      "Cycle-error-free resource ordering — deploys first time, every time",
      "KMS & Azure AD bypass routes — no broken Windows VMs or auth failures",
      "Dynamic for_each subnet binding — scales to any number of Spokes",
      "IP Group-based firewall policies — no hardcoded IP addresses",
      "FQDN baseline rules for Windows Updates and core Microsoft services",
    ],
    available: true,
  },
  {
    slug: "azure-rag-enterprise",
    badge: "Terraform Module",
    title: "Enterprise AI RAG — Zero-Trust Networking",
    description:
      "A fully isolated, audit-ready AI infrastructure blueprint. Features automated Shared Private Link approval, VNet injection, Private DNS automation, and RBAC Identity Chaining for Azure OpenAI and AI Search.",
    price: "€79",
    priceNote: "one-time · instant download",
    href: "https://woitzik-cloud.lemonsqueezy.com/checkout/buy/cd786faf-92b8-41c8-876e-c3a3fdf4f823",
    articleHref: "/blog/azure-rag-shared-private-link-automation",
    tags: ["Azure", "Terraform", "AI", "Zero-Trust", "OpenAI"],
    bullets: [
      "Automated AzAPI Link Approval — no manual Portal clicks required",
      "Full VNet Injection — Public Network Access strictly disabled",
      "Pre-configured Identity Chaining (System Managed Identities + RBAC)",
      "Automated Private DNS Zone linking for both services",
      "ISO 27001 & NIS2 compliant architecture on day one",
    ],
    available: true,
  },
];

export function getProduct(slug: string): Product {
  return products.find((p) => p.slug === slug) ?? products[0];
}