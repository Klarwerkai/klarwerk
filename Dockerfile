# KLARWERK — Produktions-Image (Hetzner/Coolify, SCRUM: VIP-/Beta-Zugang extern).
# EIN Container: Fastify liefert API + gebaute Oberfläche auf einem Port (Standard 3001).
# Datenhaltung: Postgres über DATABASE_URL (Migration läuft beim Start; Werksreset ist im
# Postgres-Betrieb bewusst nicht verfügbar). Ohne DATABASE_URL fiele der Container auf
# In-Memory zurück — für den Server-Betrieb DATABASE_URL daher IMMER setzen.
# Typ-/Lint-/Test-Gates laufen im Runner bzw. in CI — das Image baut nur (vite build direkt,
# nicht "npm run build", damit der Image-Build nicht am tsc-Gate doppelt hängt).

# ---- Stufe 0: bekannte Schwachstellen der Fremdbibliotheken (R-1398) -----------------------
# Jeder Lieferweg endet hier: Coolify baut nach dem Push dieses Dockerfile. Diese Stufe fragt
# `npm audit --omit=dev` für beide ausgelieferten Bestände (Laufzeit = package-lock.json,
# gebündelte SPA = apps/web/package-lock.json) und hält jede Meldung gegen ihre Bewertung an der
# gebundenen Version (tools/abhaengigkeiten-bewertet.json). Exit 1 (unbewertet/veraltet) oder 2
# (nicht prüfbar) lässt den Bau scheitern; die Laufzeitstufe hängt über `COPY --from` an dieser
# Stufe, deshalb kann sie nicht übersprungen werden. Node 24 führt das TypeScript-Werkzeug direkt
# aus (wie tools/abhaengigkeiten-audit.sh), ohne tsx und ohne Nachladen.
FROM node:24-bookworm-slim AS abhaengigkeiten
WORKDIR /pruef
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package-lock.json apps/web/
COPY tools/abhaengigkeiten-audit.ts tools/abhaengigkeiten-bewertet.json tools/
# SOURCE_COMMIT steht im RUN, damit ein neuer Commit den Bau-Cache dieser Stufe verwirft und die
# Registry erneut gefragt wird — sonst bliebe bei unveränderten Lockdateien ein altes Ergebnis
# stehen. DER NAME `SOURCE_COMMIT` IST HIER DIESELBE ANNAHME ÜBER DIE AUSLIEFERUNG wie in der
# Laufzeitstufe unten, keine Messung. Fehlt der Wert oder ist er unbrauchbar, nennt die Ausgabe den
# Commit „unbekannt“, und der Cache des Builders entscheidet, ob erneut gefragt wird; der
# Zeitstempel im Ergebnis zeigt, wann. Für /health prüft weiterhin allein `buildCommit()` in
# build-app.ts den Wert der Laufzeitstufe.
ARG SOURCE_COMMIT=""
RUN echo "Abhängigkeitsprüfung für Commit ${SOURCE_COMMIT:-unbekannt}" && \
    node tools/abhaengigkeiten-audit.ts --ausgabe /pruef/abhaengigkeiten-audit.txt

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
# WP-D11 (Folien als Bilder): LibreOffice Impress headless (pptx→pdf) + poppler (pdf→png je Seite)
# + Basis-Fonts für die Textdarstellung. BEWUSST --no-install-recommends und NUR die Impress-
# Komponente (keine GUI-/Java-/Writer-/Calc-Pakete) — das Delta bleibt so bei grob ~400 MB statt
# >1 GB für ein volles LibreOffice. Ohne diese Pakete (z. B. lokales Dev) antwortet die
# Folien-Route ehrlich mit 503, der übrige Betrieb ist unberührt.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice-impress \
      poppler-utils \
      fonts-liberation && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Server-Code + gebaute Oberfläche an exakt dem Pfad, den server.ts erwartet
# (services/app/src → ../../../apps/web/dist).
COPY services services
COPY --from=webbuild /build/apps/web/dist apps/web/dist
# SANIERUNG 28.08.: capture-routes importiert apps/web/src/lib/docx (Station 1);
# ohne diesen Ordner stirbt der Container beim Start (ERR_MODULE_NOT_FOUND,
# Coolify-Deploys seit 13:19 UTC rot). mammoth liegt dafuer im Wurzel-package.json.
COPY apps/web/src apps/web/src
# JOB 3001 (Deploy-Commit an /health): Die Auslieferung kann den ausgelieferten Git-Commit beim
# Bauen als Build-Argument hineinreichen; die Laufzeit liest ihn dann über KLARWERK_BUILD_COMMIT
# (services/app/src/build-app.ts, `BUILD_COMMIT_ENV`) und /health meldet ihn.
#
# DER NAME `SOURCE_COMMIT` IST EINE ANNAHME ÜBER DIE AUSLIEFERUNG, KEINE MESSUNG. Im Repo ist
# nirgends belegt, ob und unter welchem Namen die Auslieferung (Coolify, Build-Pack Dockerfile) ein
# solches Argument reicht; `SOURCE_COMMIT` ist der übliche Name und deshalb hier gewählt. Trifft die
# Annahme nicht zu, ist nichts kaputt: ein FEHLENDER ODER UNBRAUCHBARER WERT (leer, ein Branchname,
# ein uneingesetztes `$SOURCE_COMMIT`) wird von `buildCommit()` verworfen und /health meldet ehrlich
# `unbekannt` — nie einen erfundenen Hash. Bestätigt sich ein anderer Name, wird HIER umgestellt.
#
# Die Zeilen stehen bewusst spät: jede Änderung am Commit-Wert entwertet nur noch die Ebenen
# darunter, nicht den teuren apt-/npm-Teil weiter oben.
ARG SOURCE_COMMIT=""
ENV KLARWERK_BUILD_COMMIT=$SOURCE_COMMIT
# R-1398: das Ergebnis der Stufe `abhaengigkeiten` reist mit. Diese Zeile ist zugleich die
# Abhängigkeit, ohne die BuildKit die Prüfstufe gar nicht bauen würde. Bewusst spät, damit ein
# neues Prüfergebnis nur diese Ebene entwertet, nicht apt/npm weiter oben.
COPY --from=abhaengigkeiten /pruef/abhaengigkeiten-audit.txt ./abhaengigkeiten-audit.txt
EXPOSE 3001
USER node
# Ehrlicher Selbsttest: /health muss {"status":"ok"} liefern, sonst gilt der Container als krank.
# R-2057: mit KLARWERK_TLS_CERT_FILE fragt er über HTTPS mit Zertifikatsprüfung
# (services/app/healthcheck.mjs, Anleitung docs/operations/tls-bis-zur-anwendung.md).
HEALTHCHECK --interval=30s --timeout=4s --start-period=15s \
  CMD node services/app/healthcheck.mjs
CMD ["npx", "tsx", "services/app/src/server.ts"]
