#!/usr/bin/env python3
"""Read-only Search Console report for woitzik.dev.

Inspects every URL in the built sitemap with the URL Inspection API and
prints the pages Google has not indexed, grouped by coverage state, plus
the top queries and pages of the last 28 days.

Setup: a Google Cloud service account with the Search Console API enabled,
added as a user on the sc-domain property. The key lives outside the repo.
Run with the venv that has google-api-python-client installed:

    ~/.venvs/gsc/bin/python scripts/gsc-report.py [--no-inspect]

The token is requested with the read-only scope, so the script cannot
change anything in Search Console even if the account has more rights.
"""

import argparse
import datetime as dt
import glob
import json
import os
import re
import sys
from collections import defaultdict

from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = os.path.expanduser(os.environ.get("GSC_KEY", "~/.config/gsc/service-account.json"))
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def sitemap_urls():
    urls = []
    for f in glob.glob(os.path.join(os.path.dirname(__file__), "..", "dist", "sitemap-*.xml")):
        if f.endswith("sitemap-index.xml"):
            continue
        urls += re.findall(r"<loc>([^<]+)</loc>", open(f, encoding="utf-8").read())
    return urls


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", default=None, help="property, e.g. sc-domain:woitzik.dev")
    ap.add_argument("--no-inspect", action="store_true", help="skip per-URL inspection")
    ap.add_argument("--json", help="write raw inspection results to this file")
    args = ap.parse_args()

    if not os.path.exists(KEY):
        sys.exit(f"service account key not found: {KEY}")
    creds = service_account.Credentials.from_service_account_file(KEY, scopes=SCOPES)
    svc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)

    sites = [s["siteUrl"] for s in svc.sites().list().execute().get("siteEntry", [])]
    site = args.site or next((s for s in sites if "woitzik.dev" in s), None)
    if not site:
        sys.exit(f"no woitzik.dev property visible to the service account; visible: {sites}")
    print(f"property: {site}")

    end = dt.date.today() - dt.timedelta(days=2)
    start = end - dt.timedelta(days=27)
    for dim in ("query", "page"):
        rows = svc.searchanalytics().query(siteUrl=site, body={
            "startDate": str(start), "endDate": str(end), "dimensions": [dim], "rowLimit": 15,
        }).execute().get("rows", [])
        print(f"\nTop {dim} {start}..{end} (clicks / impressions / position)")
        for r in rows:
            print(f"  {r['clicks']:>4.0f} {r['impressions']:>6.0f} {r['position']:>5.1f}  {r['keys'][0]}")

    if args.no_inspect:
        return
    urls = sitemap_urls()
    if not urls:
        sys.exit("no sitemap in dist/, run npm run build first")
    groups, raw = defaultdict(list), {}
    for i, u in enumerate(urls, 1):
        res = svc.urlInspection().index().inspect(body={"inspectionUrl": u, "siteUrl": site}).execute()
        idx = res.get("inspectionResult", {}).get("indexStatusResult", {})
        raw[u] = idx
        groups[idx.get("coverageState", "unknown")].append((u, idx.get("lastCrawlTime", "never")[:10]))
        print(f"\rinspected {i}/{len(urls)}", end="", file=sys.stderr)
    print(file=sys.stderr)
    print("\nIndex status of sitemap URLs")
    for state, items in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        print(f"\n{state}: {len(items)}")
        if "indexed" in state.lower() and "not" not in state.lower():
            continue
        for u, crawled in sorted(items):
            print(f"  {crawled}  {u}")
    if args.json:
        json.dump(raw, open(args.json, "w"), indent=2)


if __name__ == "__main__":
    main()
