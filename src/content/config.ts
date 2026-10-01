import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().optional(),
    pinned: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    // Existing posts carry no lang at all, so default to English rather than
    // requiring the field on all 70 of them. German translations opt in with
    // `lang: de` and point translationOf at the English slug they mirror.
    lang: z.enum(["en", "de"]).default("en"),
    translationOf: z.string().optional(),
  }),
});

const certs = defineCollection({
  type: "content",
  schema: ({ image }) =>
    z.object({
      company: z.string(),
      role: z.string(),
      dateStart: z.coerce.date(),
      dateEnd: z.coerce.date().optional(),
      image: image().optional(),
      draft: z.boolean().optional(),
    }),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().optional(),
    demoURL: z.string().optional(),
    repoURL: z.string().optional(),
  }),
});

export const collections = { blog, certs, projects };
