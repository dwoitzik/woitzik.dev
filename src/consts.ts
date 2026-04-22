import type { Site, Metadata, Socials } from "@types";

export const SITE: Site = {
  NAME: "woitzik.dev",
  EMAIL: "david@woitzik.dev",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 5,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "System Engineer for Hybrid Cloud and Homelab enthusiast.",
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

export const SOCIALS: Socials = [
  { 
    NAME: "github",
    HREF: "https://github.com/dwoitzik",
  },
];