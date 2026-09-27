# ================================================================================================
# B3 — DAS PRUEFWERKZEUG: das Anwendungsabbild der Instanz, plus die Werkzeuge des Drills.
# ================================================================================================
#
# Gebaut von scripts/backup/compose-drill.sh (Schritt `werkzeug`), NIE von Hand und NIE als Teil
# der Kundeninstanz. Grundlage ist GENAU das Abbild, das in der Instanz als `app` laeuft — der Drill
# startet die Anwendung damit aus demselben Code und mit demselben Befehl wie produktiv
# (`npx tsx services/app/src/server.ts`, siehe Dockerfile). Dazu kommen:
#
#   · postgresql-client-16 aus dem PGDG-Paketarchiv. Debian 12 bringt nur 15 mit, und ein
#     15er-`pg_restore` liest das Archivformat eines 16er-`pg_dump` nicht (1.15 > 1.14).
#   · curl und ps (procps) — restore-drill.sh braucht beide (Glied 4/5/8).
#   · die Entwicklungsabhaengigkeiten (vitest, testcontainers) fuer tests/backup-drill W1–W4.
#
# Tests, Skripte und Vitest-Konfiguration werden zur LAUFZEIT eingehaengt, nicht hineinkopiert:
# `.dockerignore` schliesst `tests` und `scripts` aus dem Baukontext aus, und so bleibt dieses
# Abbild unabhaengig von einem Baukontext (gebaut wird es aus einem leeren).
ARG APP_IMAGE
FROM ${APP_IMAGE}
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg procps && \
    install -d /usr/share/postgresql-common/pgdg && \
    curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Kein Browser-Download: der Drill und W1–W4 brauchen keinen Chromium.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --include=dev && chown -R node:node /app
USER node
ENV NODE_ENV=production
CMD ["bash"]
