# KLARWERK — Produktions-Image (Hetzner/Coolify, SCRUM: VIP-/Beta-Zugang extern).
# EIN Container: Fastify liefert API + gebaute Oberfläche auf einem Port (Standard 3001).
# Datenhaltung: Postgres über DATABASE_URL (Migration läuft beim Start; Werksreset ist im
# Postgres-Betrieb bewusst nicht verfügbar). Ohne DATABASE_URL fiele der Container auf
# In-Memory zurück — für den Server-Betrieb DATABASE_URL daher IMMER setzen.
# Typ-/Lint-/Test-Gates laufen im Runner bzw. in CI — das Image baut nur (vite build direkt,
# nicht "npm run build", damit der Image-Build nicht am tsc-Gate doppelt hängt).

# ---- Stufe 1: Oberfläche bauen -------------------------------------------------------------
FROM node:20-bookworm-slim AS webbuild
WORKDIR /build
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN cd apps/web && npm ci
COPY apps/web apps/web
RUN cd apps/web && npx vite build

# ---- Stufe 2: Laufzeit ---------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Server-Code + gebaute Oberfläche an exakt dem Pfad, den server.ts erwartet
# (services/app/src → ../../../apps/web/dist).
COPY services services
COPY --from=webbuild /build/apps/web/dist apps/web/dist
EXPOSE 3001
USER node
# Ehrlicher Selbsttest: /health muss {"status":"ok"} liefern, sonst gilt der Container als krank.
HEALTHCHECK --interval=30s --timeout=4s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "services/app/src/server.ts"]
