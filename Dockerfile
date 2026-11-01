# StormLearn — production image.
#
# Works on any container host: Fly.io, Railway, Render, Koyeb, Northflank,
# Heroku, a VPS with Docker, Google Cloud Run. Nothing here is host-specific.
#
#   docker build -t stormlearn .
#   docker run --rm -p 3000:3000 stormlearn
#
# Two-stage build so the final image carries only runtime dependencies and the
# compiled .next output — no TypeScript, no source maps, no dev tooling.

FROM node:22-alpine AS deps
# libc6-compat: some Next.js SWC native binaries need it on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci gives a reproducible install from the lockfile.
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_TELEMETRY_DISABLED: no network call during the build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js `start` binds $PORT; set explicitly so container platforms that
# inject their own port still work, and 3000 is the default otherwise.
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user — most PaaS hosts require or prefer this.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# No public/ directory: every icon in this app is an inline SVG component, so
# there are no static assets to serve. Add a COPY for it if you introduce one.

USER nextjs
EXPOSE 3000

# `next start` directly — NOT `npm start`, because the prestart hook would try
# to reinstall and rebuild inside a read-only or already-built image.
CMD ["npx", "next", "start", "-H", "0.0.0.0"]
