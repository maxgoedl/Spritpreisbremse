#!/bin/sh
set -e

# Validate required env var early
if [ -z "$TANKERKOENIG_API_KEY" ]; then
    echo "ERROR: TANKERKOENIG_API_KEY is not set. Aborting." >&2
    exit 1
fi

# Seed the data volume on first start if it's empty
if [ ! -f /app/data/data.json ]; then
    echo "=== Seeding data volume from image ==="
    cp /app/src/data.json /app/data/data.json
fi

# Run an initial fetch+build so the site is up-to-date on first start.
# If the API is temporarily unreachable we still serve the data baked into
# the image — so failures here are logged but non-fatal.
echo "=== Initial price fetch on startup ==="
/cron-fetch.sh || echo "WARNING: initial fetch failed — serving image-baked data."

# Start the cron daemon (background)
crond -b -l 8

# Start nginx in the foreground (keeps the container alive)
echo "=== Starting nginx ==="
exec nginx -g 'daemon off;'
