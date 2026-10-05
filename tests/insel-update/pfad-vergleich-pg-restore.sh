#!/usr/bin/env bash
# ==================================================================================================
# JOB 4012 · K3-PRÜFWEG — sicherung-eindeutig.test.ts MIT und OHNE echtes pg_restore im äusseren PATH
# ==================================================================================================
#
# WOZU: `backup.sh` nimmt zur Leseprüfung `pg_restore`, wenn es auf dem PATH liegt. Der Test legt
# seine eigene `pg_restore`-Attrappe davor; ob das die Umgebung wirklich neutralisiert, belegt nur
# ein Lauf auf einem Rechner MIT PostgreSQL-Client und einer OHNE. Dieses Skript fährt beide auf
# demselben Rechner, unveränderte Testdatei, und belegt die jeweilige Voraussetzung im Protokoll.
#
# AUFRUF (aus beliebigem Verzeichnis):
#   tests/insel-update/pfad-vergleich-pg-restore.sh [mit|ohne|beide]     (Standard: beide)
#   KLARWERK_ERWARTETER_COMMIT=<hash> …  — endet rot, wenn HEAD nicht dieser Commit ist.
#
# ROT IST ROT: Fehlt für „mit" das echte pg_restore, bricht das Skript ab (kein Überspringen, kein
# Ersatzwerkzeug). Jeder Testfehler und jeder übersprungene Test macht den Lauf rot — gezählt über
# den JSON-Bericht von Vitest, nicht aus der Konsolenausgabe gelesen. Installierte Werkzeuge bleiben
# unberührt; „ohne" filtert den PATH nur für den Testprozess (Symlinks in ein Wegwerfverzeichnis).
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$WURZEL"

TESTDATEI="tests/insel-update/sicherung-eindeutig.test.ts"
VARIANTE="${1:-beide}"
case "$VARIANTE" in
  mit | ohne | beide) ;;
  *)
    echo "[pfad-vergleich] unbekannte Variante: $VARIANTE (erlaubt: mit, ohne, beide)" >&2
    exit 2
    ;;
esac

KOPF="$(git rev-parse HEAD)"
echo "[pfad-vergleich] HEAD $KOPF"
if [ -n "${KLARWERK_ERWARTETER_COMMIT:-}" ]; then
  echo "[pfad-vergleich] erwartet $KLARWERK_ERWARTETER_COMMIT"
  if [ "$KOPF" != "$KLARWERK_ERWARTETER_COMMIT" ]; then
    echo "[pfad-vergleich] ABBRUCH: HEAD ist nicht der erwartete Commit" >&2
    exit 3
  fi
fi

ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT

# Ein vollständiger Lauf der unveränderten Testdatei. Rot, wenn Vitest rot ist ODER der JSON-Bericht
# einen nicht bestandenen, übersprungenen oder offenen Test zählt — oder gar keinen.
fahreTestdatei() {
  local name="$1"
  local bericht="$ARBEIT/bericht-$name.json"
  echo "[pfad-vergleich:$name] vitest $TESTDATEI"
  KLARWERK_SKIP_KEYCHAIN=1 node node_modules/vitest/vitest.mjs run \
    --minWorkers=1 --maxWorkers=1 \
    --reporter=verbose --reporter=json --outputFile.json="$bericht" \
    "$TESTDATEI"
  node - "$bericht" "$name" <<'JS'
const [bericht, name] = process.argv.slice(2);
const b = JSON.parse(require("node:fs").readFileSync(bericht, "utf8"));
const einzeln = b.testResults.flatMap((datei) => datei.assertionResults);
const nichtBestanden = einzeln.filter((t) => t.status !== "passed");
const zeile = `gesamt=${b.numTotalTests} bestanden=${b.numPassedTests} rot=${b.numFailedTests} uebersprungen=${b.numPendingTests} offen=${b.numTodoTests}`;
console.log(`[pfad-vergleich:${name}] ${zeile}`);
for (const t of nichtBestanden) console.error(`[pfad-vergleich:${name}] NICHT BESTANDEN (${t.status}): ${t.fullName}`);
const gruen =
  b.success === true &&
  b.numTotalTests > 0 &&
  b.numPassedTests === b.numTotalTests &&
  b.numPendingTests === 0 &&
  b.numTodoTests === 0 &&
  einzeln.length === b.numTotalTests &&
  nichtBestanden.length === 0;
if (!gruen) {
  console.error(`[pfad-vergleich:${name}] ROT: nicht jeder Test ist gelaufen und bestanden`);
  process.exit(1);
}
JS
  echo "[pfad-vergleich:$name] GRÜN"
}

varianteMit() {
  local ort
  if ! ort="$(command -v pg_restore)"; then
    echo "[pfad-vergleich:mit] ABBRUCH: pg_restore fehlt im PATH — Variante 'mit' ist hier nicht belegbar (PostgreSQL-Client installieren)" >&2
    exit 4
  fi
  echo "[pfad-vergleich:mit] command -v pg_restore: $ort"
  local version
  version="$(pg_restore --version)"
  echo "[pfad-vergleich:mit] pg_restore --version: $version"
  fahreTestdatei mit
}

varianteOhne() {
  local gefiltert="$ARBEIT/pfad-ohne-pg_restore"
  mkdir "$gefiltert"
  local verzeichnisse verzeichnis werkzeug name
  IFS=: read -r -a verzeichnisse <<<"$PATH"
  for verzeichnis in "${verzeichnisse[@]}"; do
    if [ -z "$verzeichnis" ]; then
      verzeichnis="."
    fi
    if [ ! -d "$verzeichnis" ]; then
      continue
    fi
    verzeichnis="$(cd "$verzeichnis" && pwd)"
    for werkzeug in "$verzeichnis"/*; do
      if [ ! -f "$werkzeug" ] || [ ! -x "$werkzeug" ]; then
        continue
      fi
      name="${werkzeug##*/}"
      # Erstes Vorkommen gewinnt — dieselbe Reihenfolge wie im ursprünglichen PATH.
      if [ "$name" = "pg_restore" ] || [ -e "$gefiltert/$name" ]; then
        continue
      fi
      ln -s "$werkzeug" "$gefiltert/$name"
    done
  done
  # Eigene Subshell: der gefilterte PATH gilt nur für Nachweis und Testlauf, nicht für den Aufrufer.
  (
    PATH="$gefiltert"
    if command -v pg_restore; then
      echo "[pfad-vergleich:ohne] ABBRUCH: pg_restore ist im gefilterten PATH noch sichtbar" >&2
      exit 5
    fi
    echo "[pfad-vergleich:ohne] command -v pg_restore im gefilterten PATH: nicht gefunden"
    fahreTestdatei ohne
  )
}

if [ "$VARIANTE" = "mit" ] || [ "$VARIANTE" = "beide" ]; then
  varianteMit
fi
if [ "$VARIANTE" = "ohne" ] || [ "$VARIANTE" = "beide" ]; then
  varianteOhne
fi
echo "[pfad-vergleich] ALLES GRÜN ($VARIANTE) an $KOPF"
