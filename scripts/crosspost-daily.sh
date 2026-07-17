#!/bin/bash
# Daily crosspost runner — cron-friendly
# Posts to dev.to (API), Medium + Hackernoon (Playwright with xvfb)
#
# Usage:
#   ./crosspost-daily.sh              # all platforms
#   ./crosspost-daily.sh --devto      # dev.to only
#   ./crosspost-daily.sh --medium     # Medium only (max 2/day)
#
# Cron example (daily at 09:00):
#   0 9 * * * cd /home/dw/woitzik.dev && bash scripts/crosspost-daily.sh >> /tmp/crosspost.log 2>&1

set -euo pipefail
cd "$(dirname "$0")/.."

SCRIPT_DIR="$(pwd)/scripts"
LOG_FILE="/tmp/crosspost-$(date +%Y-%m-%d).log"

# Load env
[ -f .env.crosspost ] && export $(grep -v '^#' .env.crosspost | xargs)

# Find next unposted article for each platform
# (the crosspost script already skips posted ones via .medium-posted.json etc.)

FLAGS="${*:---medium --hackernoon}"

echo "$(date '+%Y-%m-%d %H:%M:%S') Starting daily crosspost..."
echo "Flags: $FLAGS"

# dev.to: API-only, no browser needed
if echo "$FLAGS" | grep -q "devto\|--medium\|--hackernoon"; then
  # Get all slugs, crosspost skips already-posted ones
  for slug in src/content/blog/*.mdx; do
    slug_name=$(basename "$slug" .mdx)
    node scripts/crosspost.mjs "$slug_name" --devto 2>&1 || true
    sleep 35  # dev.to rate limit
  done
fi

# Medium: Playwright needs display for login, but after first login xvfb works
if echo "$FLAGS" | grep -q "medium"; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Crossposting to Medium..."
  if command -v xvfb-run &>/dev/null; then
    xvfb-run --auto-servernum node scripts/crosspost.mjs --all --medium 2>&1 || true
  else
    echo "xvfb-run not found, falling back to headed mode"
    node scripts/crosspost.mjs --all --medium 2>&1 || true
  fi
fi

# Hackernoon: same as Medium
if echo "$FLAGS" | grep -q "hackernoon"; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Crossposting to Hackernoon..."
  if command -v xvfb-run &>/dev/null; then
    xvfb-run --auto-servernum node scripts/crosspost.mjs --all --hackernoon 2>&1 || true
  else
    node scripts/crosspost.mjs --all --hackernoon 2>&1 || true
  fi
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') Done."
