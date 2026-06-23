# KLARWERK Backend — ein Container, identisch auf Hetzner, On-Premises oder Cloud.
FROM node:22-alpine

WORKDIR /app

# Manifeste zuerst → besseres Layer-Caching beim Bauen.
COPY package.json package-lock.json* ./
# Nur Laufzeit-Abhängigkeiten (pg, fastify, jose, nodemailer, tsx). Dev-Tools bleiben außen vor.
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Healthcheck über den /health-Endpunkt (Coolify/Traefik nutzen das für Rollouts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

# tsx führt den TypeScript-Einstieg direkt aus (kein separater Build-Schritt nötig).
CMD ["npx", "tsx", "services/app/src/server.ts"]
