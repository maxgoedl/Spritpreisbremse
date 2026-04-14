#!/bin/sh
# Fetches fresh prices and rebuilds the static site.
# Called by cron (08:00 + 20:00 UTC) and once on container start.

set -e
cd /app

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] === price fetch starting ==="

python3 fetch_prices.py

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Rebuilding site..."
npx vite build --base / --logLevel warn

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] === done ==="
