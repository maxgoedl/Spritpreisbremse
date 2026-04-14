#!/bin/sh
# Fetches fresh prices and rebuilds the static site.
# Called by cron (08:00 + 20:00 UTC) and once on container start.

set -e
cd /app

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] === price fetch starting ==="

python3 fetch_prices.py

# Sync the persisted data.json from the volume into src/ so Vite picks it up
cp /app/data/data.json /app/src/data.json

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Rebuilding site..."
# BASE_PATH is set in docker-compose.yml (default /sprit/)
npx vite build --base "${BASE_PATH:-/sprit/}" --logLevel warn

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] === done ==="
