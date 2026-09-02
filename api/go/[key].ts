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
  "3T4phgR": "B0FH2HTHQD",
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
  "4gGnuZ3": "B0BZR8P4YS", // Beelink EQ12 (was wrong product B0CJM1TDHL, fixed 2026-09-02)
  "4gN53Sv": "B0CQ4WBV8L", // GMKtec NucBox K6 7840HS/32GB/1TB (was wrong product B0FND44C4X, fixed 2026-09-02)
  "beelink-s12pro": "B0H2CY6X54",
  "4hmdcNX": "B0FB7KQLR1", // Synology DS225+ (successor to DS224+, article updated 2026-09-02)
  "4pGBkxb": "B086NHM33N",
  "4plOgZ5": "B06XCXNB59",
  "4ptIiVP": "B0FB2XPTKC",
  "4vxwLpY": "B07CRG94G3",
  "4w08b21": "B09GW641SL",
  "4wETNfv": "B0CRPF47RG",
  "4wKbVEW": "B0DZF4VL35",
  "4wNS0oI": "B0DZQK5ZWN",
  "4wcr4PG": "B01MZXL61M",
  "4yvKX5s": "B0C1YKGGWY",
  "4yvrdiy": "B0BW2HTGSX",
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

  const country = (req.headers["x-vercel-ip-country"] as string) ?? "";
  const { domain, tag } = MARKETPLACES[country] ?? DEFAULT_MARKETPLACE;

  res.writeHead(302, {
    Location: `https://www.${domain}/dp/${asin}?tag=${tag}`,
    "Cache-Control": "no-store",
  });
  res.end();
}
