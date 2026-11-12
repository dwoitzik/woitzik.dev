import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date) {
  return Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function readingTime(html: string) {
  const textOnly = html.replace(/<[^>]+>/g, "");
  const wordCount = textOnly.split(/\s+/).length;
  const readingTimeMinutes = (wordCount / 200 + 1).toFixed();
  return `${readingTimeMinutes} min read`;
}

export function dateRange(start: Date | string, end?: Date | string) {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = end ? (typeof end === "string" ? new Date(end) : end) : null;

  const startFormatted = startDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  if (!endDate) {
    return `${startFormatted} - Present`;
  }

  const endFormatted = endDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return `${startFormatted} - ${endFormatted}`;
}
// URL slug for a tag: lowercase, whitespace and slashes to hyphens. Tags with
// spaces used to produce /blog/tag/chaos engineering/ style URLs; vercel.json
// redirects those old forms to the hyphenated ones. A slash ("CI/CD") would
// split the [tag] route param into two segments and fail the build.
// Keep in sync with the tag key in astro.config.mjs.
export function tagSlug(tag: string) {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, "-");
}
