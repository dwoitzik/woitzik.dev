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
    articleHref: "/blog/surviving-azure-policies-hub-spoke",
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
];

export function getProduct(slug: string): Product {
  return products.find((p) => p.slug === slug) ?? products[0];
}