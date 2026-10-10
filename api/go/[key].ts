import type { IncomingMessage, ServerResponse } from "http";

// key -> ASIN. Keys reuse the original amzn.to shortlink codes so swapping
// the blog content over was a pure domain replacement. ASINs are shared
// across Amazon marketplaces for the same edition in the large majority of
// cases, so one map drives all three storefronts below.
const ASINS: Record<string, string> = {
  "3QZejZn": "B07ZLCVKPV",
  "3RiBttM": "B09M6W23ZM",
  "3STKPwD": "B09BFT7NZJ",
  "3T4phNT": "B0BJVX5K5R",
  "44vgXJy": "B07HC7P3HJ",
  "456lv9g": "B08T1TTQQC",
  "4aUt06I": "B0BLTG7TN6",
  "4aUtkCs": "1098119061",
  "4bnvY3K": "B0B12S22WV",
  "4bv3yF1": "B0GHY46K1B",
  "4f2yuid": "B09P1KD19W",
  "4f3kTar": "3747510094",
  "4f4RHQf": "1942788290",
  "4f5WDEI": "B0DSPXJ2LS",
  "4fqnkmc": "B0D2K9J5TY",
  "4gEAhv9": "1718504527",
  // The 2026-09-29 audit found these keys pointing at products amazon.de no
  // longer sells, so the linked product contradicted the article text. Replaced
  // with listings that were verified live on amazon.de on that date.
  "4gGnuZ3": "B0DPM4N1SL", // Beelink S12 Pro N100/16GB/500GB. Was B0BZR8P4YS (Beelink EQ12) -> 404, and the EQ12 is not sold on amazon.de at all.
  "4gN53Sv": "B0FNM2KG6R", // GMKtec M5 Ultra 7730U/32GB/1TB. Was B0CQ4WBV8L, which resolves to the 16GB model, not the 32GB one the article claimed.
  "4yvrdiy": "B0C4GWYL6K", // Beelink SER5 MAX 7735U/16GB/500GB. Was B0BW2HTGSX (SER5 5500U); there is no SER5 Pro with a 5625U on amazon.de.
  "3T4phgR": "B0H2D1HN27", // TerraMaster F2-425/4GB. Was B0FH2HTHQD, same unit but a listing that intermittently showed no buy box; the F2-223 is discontinued on amazon.de.
  "4ptIiVP": "B0FB2XPTKC", // Synology DS425+ 4-bay. Was already this ASIN; it is a DS425+, not a DS423+, and the article now says so.
  "4hmdcNX": "B0FB7KQLR1", // Synology DS225+ 2-bay. Correct product all along, but was showing a multi-month backorder on amazon.de when checked 2026-09-29.
  "4pGBkxb": "B086NHM33N",
  "4plOgZ5": "B06XCXNB59",
  "4vxwLpY": "B07CRG94G3",
  "4w08b21": "B09GW641SL",
  "4wETNfv": "B0CRPF47RG",
  "4wKbVEW": "B0DZF4VL35",
  "4wNS0oI": "B0DZQK5ZWN",
  "4wcr4PG": "B01MZXL61M",
  "4yvKX5s": "B0C1YKGGWY",
  "zero-trust-networks-book": "1491962194",
  "gitops-kubernetes-book": "1617297275",
};

// Amazon Associates tracking IDs, one per marketplace this account is
// registered in. Everything outside GB/US falls back to the DE storefront —
// that's the marketplace the ASIN catalog above was sourced from.
const MARKETPLACES: Record<string, { domain: string; tag: string }> = {
  GB: { domain: "amazon.co.uk", tag: "woitzikdev0e-21" },
  US: { domain: "amazon.com", tag: "woitzikdev-20" },
};
const DEFAULT_MARKETPLACE = { domain: "amazon.de", tag: "woitzikdev-21" };

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[]> },
  res: ServerResponse,
) {
  const url = new URL(req.url ?? "", "https://woitzik.dev");
  const key = url.pathname.split("/").pop() ?? "";
  const asin = ASINS[key];

  if (!asin) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Unknown link");
    return;
  }

  // Server-side logging for go/ redirects to support attribution (privacy-preserving)
  const logGoRedirect = (p: Record<string, unknown>) => {
    try {
      // no-op in dev/build; Vercel will capture stdout/stderr
      console.log(JSON.stringify(p));
    } catch (e) {
      // ignore
    }
  };
  const country = (req.headers["x-vercel-ip-country"] as string) ?? "";
  const { domain, tag } = MARKETPLACES[country] ?? DEFAULT_MARKETPLACE;

  logGoRedirect({
    ts: new Date().toISOString(),
    key,
    asin,
    country,
    domain,
    ua: req.headers["user-agent"] ?? "",
    referer: req.headers["referer"] ?? req.headers["referrer"] ?? "",
    ip:
      req.headers["x-vercel-forwarded-for"]?.toString().split(",")[0].trim() ??
      req.headers["x-real-ip"]?.toString() ??
      "",
    path: url.pathname,
    query: url.search,
  });
  res.writeHead(302, {
    Location: `https://www.${domain}/dp/${asin}?tag=${tag}`,
    "Cache-Control": "no-store",
  });
  res.end();
}
