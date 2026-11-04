import type { Site, Metadata } from "@types";

export const SITE: Site = {
  NAME: "woitzik.dev",
  EMAIL: "david@woitzik.dev",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
  SUPPORT_URL: "https://buymeacoffee.com/dwoitzik",
  AMAZON_ASSOCIATE_TAG: "woitzikdev-21",
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION:
    "Hybrid Cloud Engineer specializing in Azure, Terraform, and Zero-Trust network architecture.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION:
    "Hands-on guides on Kubernetes, Azure, Terraform, homelab hardware, and backup/restore, written from production work and a three-node k3s cluster.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION:
    "Infrastructure projects and homelab experiments: Azure landing zones, private networking, certificate automation, Kubernetes, and self-hosted services.",
};

export const CERTS = {
  TITLE: "Certifications",
  DESCRIPTION:
    "Microsoft Azure, security, and HashiCorp Terraform certifications with issue dates and the hands-on work behind each badge.",
};
