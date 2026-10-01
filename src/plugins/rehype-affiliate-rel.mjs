// Amazon requires affiliate links to be marked with rel="sponsored", and the
// search engines treat a sponsored link without nofollow as a signal that the
// destination is not being vouched for. Article bodies link out with plain
// Markdown syntax, so those links never pass through AffiliateLink.astro.
// This plugin stamps both attributes on any link pointing at a /go/ path or an
// amazon.* host, and leaves editorial and internal links alone.
const AFFILIATE_REL = "sponsored nofollow";

function isAffiliateUrl(href) {
  if (typeof href !== "string" || href.length === 0) return false;
  if (href.startsWith("/go/")) return true;
  try {
    const url = new URL(href, "https://woitzik.dev");
    return /(^|\.)amazon\.[a-z.]+$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function mergeRel(properties) {
  const existing = properties.rel;
  const tokens =
    typeof existing === "string"
      ? existing.split(/\s+/).filter(Boolean)
      : Array.isArray(existing)
        ? existing
        : [];
  const next = new Set(tokens);
  for (const token of AFFILIATE_REL.split(" ")) next.add(token);
  const rel = [...next].join(" ");
  if (!rel.includes("noopener")) {
    properties.rel = `${rel} noopener`;
  } else {
    properties.rel = rel;
  }
  if (typeof properties.target !== "string" || !properties.target) {
    properties.target = "_blank";
  }
}

function walk(node) {
  if (!node || typeof node !== "object") return;
  if (node.type === "element" && node.tagName === "a") {
    const properties = node.properties;
    if (!properties) return;
    const href = properties.href;
    if (isAffiliateUrl(href)) mergeRel(properties);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) walk(child);
  }
}

export default function rehypeAffiliateRel() {
  return (tree) => {
    walk(tree);
  };
}
