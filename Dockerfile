# KLARWERK — Single-Origin: ein Container liefert SPA + API unter EINER Domain aus.

# Stage 1: Frontend (SPA) bauen.
FROM node:22-alpine AS webbuild
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci || npm install
COPY apps/web/ ./
RUN npm run build

# Stage 2: Backend + Auslieferung der gebauten SPA.
FROM node:22-alpine
WORKDIR /app

# Manifeste zuerst → besseres Layer-Caching.
COPY package.json package-lock.json* ./
# Nur Laufzeit-Abhängigkeiten (fastify, @fastify/static, @fastify/helmet, pg, jose, nodemailer, tsx).
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .
# Gebautes Frontend aus Stage 1 übernehmen (Single-Origin: Backend liefert die SPA aus).
COPY --from=webbuild /web/dist ./apps/web/dist

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Healthcheck über /health (Coolify/Traefik nutzen das für Rollouts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

# tsx führt den TypeScript-Einstieg direkt aus (kein separater Backend-Build nötig).
CMD ["npx", "tsx", "services/app/src/server.ts"]
