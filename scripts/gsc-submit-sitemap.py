#!/usr/bin/env python3
"""Resubmit the sitemap to Google Search Console.

Called by the publish workflow after new articles go live, so Google
re-reads the sitemap instead of relying on its own schedule (it had not
fetched it from 2026-06-17 to 2026-11-23). Reads the service account key
from the GSC_SA_KEY environment variable (JSON) or from
~/.config/gsc/service-account.json when run locally.
"""

import json
import os

from google.oauth2 import service_account
from googleapiclient.discovery import build

SITE = "sc-domain:woitzik.dev"
SITEMAP = "https://woitzik.dev/sitemap-index.xml"
SCOPES = ["https://www.googleapis.com/auth/webmasters"]

raw = os.environ.get("GSC_SA_KEY")
if raw:
    creds = service_account.Credentials.from_service_account_info(json.loads(raw), scopes=SCOPES)
else:
    path = os.path.expanduser("~/.config/gsc/service-account.json")
    creds = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)

svc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)
before = svc.sitemaps().get(siteUrl=SITE, feedpath=SITEMAP).execute()
svc.sitemaps().submit(siteUrl=SITE, feedpath=SITEMAP).execute()
print(f"sitemap resubmitted; Google last downloaded it {before.get('lastDownloaded', 'never')}")
