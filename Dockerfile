# ─── Stage 1: build the Vite app ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Base path can be overridden at build time, e.g. --build-arg BASE_PATH=/sprit/
ARG BASE_PATH=/sprit/
RUN npx vite build --base ${BASE_PATH}


# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
# node:20-alpine already has Node; we add Python 3, nginx, and dcron on top.
FROM node:20-alpine

RUN apk add --no-cache python3 nginx dcron

# ── App source + initial build ────────────────────────────────────────────────
WORKDIR /app
COPY --from=builder /app /app

# ── nginx ─────────────────────────────────────────────────────────────────────
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# ── Scripts ───────────────────────────────────────────────────────────────────
COPY docker/entrypoint.sh /entrypoint.sh
COPY docker/cron-fetch.sh /cron-fetch.sh
RUN chmod +x /entrypoint.sh /cron-fetch.sh

# ── Cron schedule: 08:00 and 20:00 UTC every day ─────────────────────────────
RUN printf '0 8  * * * /cron-fetch.sh >> /var/log/spritpreisbremse.log 2>&1\n' >  /etc/crontabs/root \
 && printf '0 20 * * * /cron-fetch.sh >> /var/log/spritpreisbremse.log 2>&1\n' >> /etc/crontabs/root

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
