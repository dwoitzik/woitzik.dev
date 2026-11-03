// Astro emits directory-style URLs with a trailing slash (trailingSlash:
// "always"). Markdown authors and older drafts still link without one, which
// costs a 308 redirect on every internal click. Normalize those links at build
// time so the HTML points straight at the canonical URL.
//
// Only page-like same-origin paths are touched. Files (downloads, feeds,
// images), /go/ redirects, /api, Astro assets, anchors, and external hosts
// keep their exact href.
const SITE_HOST = "woitzik.dev";

function shouldNormalize(pathname) {
  if (!pathname.startsWith("/") || pathname === "/") return false;
  if (pathname.startsWith("//")) return false;
  if (pathname.startsWith("/go/") || pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/_astro/")) return false;
  if (pathname.endsWith("/")) return false;
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return false;
  return true;
}

function normalizeHref(href) {
  if (typeof href !== "string" || href.length === 0) return href;
  if (href.startsWith("#") || href.startsWith("?")) return href;

  let url;
  try {
    url = new URL(href, "https://woitzik.dev");
  } catch {
    return href;
  }

  if (url.hostname !== SITE_HOST) return href;
  if (!shouldNormalize(url.pathname)) return href;

  url.pathname = `${url.pathname}/`;
  return href.startsWith("http")
    ? url.toString()
    : `${url.pathname}${url.search}${url.hash}`;
}

function walk(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "element" && node.tagName === "a") {
    const properties = node.properties;
    if (properties?.href) properties.href = normalizeHref(properties.href);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child);
  }
}

export default function rehypeInternalTrailingSlash() {
  return (tree) => {
    walk(tree);
  };
}
