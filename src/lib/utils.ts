import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Lang = "en" | "de";

// The one date format for the whole site. English uses the US short month
// ("Sep 27, 2026"): en-GB writes September as "Sept", which breaks the even
// width of the mono date column in post lists. German posts get the numeric
// form ("27.09.2026"), which is what German readers expect and is shorter than
// de-DE's "27. Sept. 2026". UTC because frontmatter dates are UTC midnight and
// a build machine east or west of UTC would otherwise shift them by a day.
export function formatDate(date: Date, lang: Lang = "en") {
  return new Intl.DateTimeFormat(
    lang === "de" ? "de-DE" : "en-US",
    lang === "de"
      ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  ).format(date);
}

export function readingTime(html: string, lang: Lang = "en") {
  const textOnly = html.replace(/<[^>]+>/g, "");
  const wordCount = textOnly.split(/\s+/).length;
  const readingTimeMinutes = (wordCount / 200 + 1).toFixed();
  return lang === "de"
    ? `${readingTimeMinutes} Min. Lesezeit`
    : `${readingTimeMinutes} min read`;
}

// Chrome strings around a blog post (TOC label, feedback, share, related,
// newsletter, support, prev/next). German posts are written in du-form, so the
// chrome around them is too. English values are the site's original wording.
const postStrings = {
  en: {
    onThisPage: "On this page",
    helpful: "Was this helpful?",
    yes: "Yes",
    no: "No",
    thanks: "Thanks for the feedback!",
    share: "Share",
    shareOn: (name: string) => `Share on ${name}`,
    keepReading: "Keep reading",
    newsletterTitle: "More like this in your inbox",
    newsletterDescription:
      "New Terraform modules and articles by email. No spam.",
    newsletterButton: "Subscribe",
    newsletterSuccess:
      "Almost done: check your inbox and click the confirmation link.",
    supportTitle: "Found this useful?",
    supportText:
      "Each of these posts takes hours to write and test. A coffee helps keep them free.",
    supportButton: "Buy me a coffee",
    authorBio:
      "I work mostly with Azure, Terraform, and Zero-Trust network design, and publish the Terraform templates and write-ups I wanted when I was solving the same problems.",
    previous: "Previous",
    next: "Next",
    moreArticles: "More articles",
    updated: "Updated",
  },
  de: {
    onThisPage: "Auf dieser Seite",
    helpful: "War das hilfreich?",
    yes: "Ja",
    no: "Nein",
    thanks: "Danke für dein Feedback!",
    share: "Teilen",
    shareOn: (name: string) => `Auf ${name} teilen`,
    keepReading: "Weiterlesen",
    newsletterTitle: "Mehr davon in deinem Postfach",
    newsletterDescription:
      "Neue Terraform-Module und Artikel per E-Mail. Kein Spam.",
    newsletterButton: "Abonnieren",
    newsletterSuccess:
      "Fast geschafft: Schau in dein Postfach und klick auf den Bestätigungslink.",
    supportTitle: "War das nützlich für dich?",
    supportText:
      "Jeder dieser Artikel kostet Stunden zum Schreiben und Testen. Ein Kaffee hilft, sie kostenlos zu halten.",
    supportButton: "Spendier mir einen Kaffee",
    authorBio:
      "Ich arbeite vor allem mit Azure, Terraform und Zero-Trust-Netzwerkdesign und veröffentliche die Terraform-Vorlagen und Artikel, die ich selbst gern gehabt hätte, als ich vor denselben Problemen stand.",
    previous: "Vorheriger Artikel",
    next: "Nächster Artikel",
    moreArticles: "Weitere Artikel",
    updated: "Aktualisiert",
  },
} as const;

export function postText(lang: Lang = "en") {
  return postStrings[lang] ?? postStrings.en;
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
