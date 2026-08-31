# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate
RUN npm run build -w @bankops/shared
RUN npm run build -w @bankops/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache wget \
  && addgroup -S bankops \
  && adduser -S bankops -G bankops
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/shared ./packages/shared
USER bankops
EXPOSE 4000
# /health always answers 200 (it reports "degraded" in the body for a
# human dashboard, by design — see health.router.ts) so it can never fail
# this check. /ready is the one that actually fails non-200 when the
# database is unreachable, which is what should take a container out of
# rotation or trigger a restart.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/ready || exit 1
CMD ["sh", "-c", "npm run db:migrate -w @bankops/api && npm run start -w @bankops/api"]
