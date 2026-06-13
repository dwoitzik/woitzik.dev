import type { Site, Metadata } from "@types";

export const SITE: Site = {
  NAME: "woitzik.dev",
  EMAIL: "david@woitzik.dev",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Hybrid Cloud Engineer specializing in Azure, Terraform, and Zero-Trust network architecture.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "Thoughts on infrastructure, automation and cloud.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION: "A collection of my work and homelab experiments.",
};

export const CERTS = {
  TITLE: "Certifications",
  DESCRIPTION: "My professional certifications and badges.",
};
