#!/bin/bash
# KLARWERK Ship — der ganze Weg nach Live in EINEM Befehl:
#   Runner-Gate → Versions-Zähler +1 → Commit → Push GitHub (+ Gitea-Spiegel) → Live-Update.
#
# WICHTIG (Befund 06.07.2026): Coolify baut vom Remote `github`
# (git@github.com:Klarwerkai/klarwerk.git). KLARWERK Sync pusht aber nur nach Gitea
# (`origin`, localhost:3000), NICHT nach GitHub — deshalb blieb Live auf dem alten Stand.
# Darum pusht DIESES Skript den Deploy-Stand direkt auf `github` (SSH-Auth ist eingerichtet)
# und spiegelt zusätzlich nach `origin` (Gitea). Siehe Sync-Ticket (Dauer-Fix).
#
# Versions-Zähler: Die LETZTE Zahl in APP_VERSION (1.0.0-beta.<Freeze>.<Zähler>) ist ein interner,
# laufender Push-Zähler. Erhöht wird ERST nach grünem Gate und NUR wenn du bestätigst.
#
# Aufruf (Terminal):   bash ~/Documents/dev_Klarwerk/scripts/deploy/klarwerk-ship.command "Commit-Text"
set -euo pipefail

REPO="$HOME/Documents/dev_Klarwerk"
VERSION_FILE="apps/web/src/version.ts"
PKG_FILE="package.json"
DEPLOY_REMOTE="github"   # Coolify baut von hier
MIRROR_REMOTE="origin"   # Gitea-Spiegel (best effort)
BRANCH="main"
cd "$REPO" || { echo "✗ Repo nicht gefunden: $REPO"; exit 1; }

echo "KLARWERK Ship — $(date '+%d.%m.%Y %H:%M')"
echo "Weg: Runner-Gate → Zähler +1 → Commit → Push GitHub(+Gitea) → Live-Update"
echo ""

# 0) Stale Lock der Bridge entfernen (sonst hakt Git beim Committen).
rm -f "$REPO/.git/index.lock"

# 0a) AUFTRAG-mega25 Block C — DAS ZUGANGSDATUM DES SHIP-SMOKES, EINMAL UND DEKLARIERT.
#
# Schritt 3/4 des Runners fährt `npm run smoke:ui` (drei Engines, MIT Modell — befristete
# Ship-Voraussetzung, SCRUM-552). Bis mega24 zog der Smoke-Server sein Zugangsdatum still aus Pedis
# persönlichem macOS-Schlüsselbund. Das ist in keiner Variante der Endzustand (ben, sammel24): ein
# automatisiertes Tor greift ohne ausdrückliche Freigabe nicht auf das persönliche Zugangsdatum eines
# Menschen zu. Der Schlüsselbund wird deshalb auf KEINEM Testweg mehr gelesen
# (`playwright.smoke.config.ts` setzt KLARWERK_SKIP_KEYCHAIN=1 am Smoke-Server), und das Zugangsdatum
# kommt allein aus der Variablen unten.
#
# HIER wird der Weg von Pedis Terminal bis zum Smoke-Server geschlossen: geprüft und exportiert, BEVOR
# irgendetwas Teures läuft. Ohne die Variable bricht sonst erst der Runner nach Minuten ab.
# Es wird NIE ein Wert ausgegeben — nur der Name.
if [ -z "${KLARWERK_SHIP_SMOKE_API_KEY:-}" ]; then
  echo "✗ KLARWERK_SHIP_SMOKE_API_KEY ist nicht gesetzt — der volle UI-Smoke (Schritt 3/4 des Runners) braucht ein Modell."
  echo "  So setzen (verdeckte Eingabe, nichts landet in der Befehlshistorie):"
  echo "    read -rs -p \"Schluessel: \" KLARWERK_SHIP_SMOKE_API_KEY && export KLARWERK_SHIP_SMOKE_API_KEY"
  echo "  Danach dieses Skript im SELBEN Terminal erneut starten."
  echo "  Kein Rueckfall auf den Schluesselbund: der Smoke liest ihn bewusst nicht mehr."
  exit 1
fi
export KLARWERK_SHIP_SMOKE_API_KEY
echo "✓ 0/5  Zugangsdatum fuer den Ship-Smoke liegt vor (KLARWERK_SHIP_SMOKE_API_KEY, Wert wird nirgends ausgegeben)."
echo ""

# 0b) R-1398 — BEKANNTE SCHWACHSTELLEN DER FREMDBIBLIOTHEKEN, VOR DER AUSLIEFERUNG.
#
# `npm audit --omit=dev` fuer beide ausgelieferten Bestaende (Laufzeit-Image und gebuendelte SPA),
# jede Meldung gegen ihre Bewertung an der gebundenen Version
# (tools/abhaengigkeiten-bewertet.json). Dieselbe Pruefung laeuft noch einmal im Image-Bau (Dockerfile,
# Stufe `abhaengigkeiten`) fuer jeden Lieferweg; hier ist sie die fruehere Sperre VOR dem Push.
# Hier und in Dockerfile, nicht in tools/check, weil
# das Tor hermetisch ist und die Pruefung die Registry braucht. Vor dem Runner, weil sie Sekunden
# kostet und der Runner Minuten. Exit 1 (unbewertet/veraltet) UND Exit 2 (nicht geprueft) brechen
# ab: ohne Pruefung wird nichts hochgezaehlt, committet, gepusht oder deployt.
echo "▶ 0b/5 Abhaengigkeitspruefung (bekannte Schwachstellen, R-1398) …"
AUDIT_CODE=0
bash "$REPO/tools/abhaengigkeiten-audit.sh" || AUDIT_CODE=$?
if [ "${AUDIT_CODE}" -ne 0 ]; then
  echo ""
  echo "✗ Abhaengigkeitspruefung nicht gruen (Exit ${AUDIT_CODE}) — nichts wird hochgezaehlt, committet, gepusht oder deployt."
  exit 1
fi
echo "✓ 0b/5 Jede gemeldete Advisory ist an der gebundenen Version bewertet."
echo ""

# 1) Runner-Gate — das harte Tor. WICHTIG: paul-runner.sh beendet sich mit Exit 0, AUCH wenn Gates
# ROT sind (er druckt nur „Mindestens ein Gate ROT"). Deshalb NICHT am Exit-Code prüfen, sondern am
# eindeutigen Erfolgs-Marker „ALLE GATES GRÜN" in der Runner-Ausgabe. (Fix 06.07.: vorher lief das
# Skript bei rotem Runner fälschlich weiter bis zur Push-Abfrage.)
echo "▶ 1/5  Runner-Gate (paul-runner.sh) …"
RUNNER_LOG="/tmp/klarwerk-ship-runner.log"
bash "$REPO/docs/team2-austausch/paul-runner.sh" 2>&1 | tee "$RUNNER_LOG" || true
if ! grep -q "ALLE GATES GR" "$RUNNER_LOG"; then
  echo ""
  echo "✗ Runner NICHT grün (Erfolgs-Marker ALLE GATES GRÜN fehlt) — nichts wird hochgezählt, committet, gepusht oder deployt."
  echo "  Details: docs/team2-austausch/paul-runner.log"
  exit 1
fi
echo "✓ 1/5  Runner grün (Erfolgs-Marker bestätigt)."
echo ""

# 2) Nächste Versionsnummer BERECHNEN (noch nicht schreiben) — letzte Zahl +1.
CUR="$(sed -n 's/.*APP_VERSION *= *"\([^"]*\)".*/\1/p' "$VERSION_FILE" | head -1)"
if [ -z "${CUR}" ]; then
  echo "✗ APP_VERSION nicht gefunden in ${VERSION_FILE} — abgebrochen."; exit 1
fi
BASE="${CUR%.*}"; LAST="${CUR##*.}"
case "${LAST}" in
  ''|*[!0-9]*) NEXT="${CUR}.1" ;;
  *)           NEXT="${BASE}.$((LAST + 1))" ;;
esac
# R-1028: /health liest die Version aus package.json (nur die liegt im Image). Beide Stellen
# bekommen dieselbe Nummer im selben Commit — sonst meldet /health einen anderen Stand als die
# Topbar (Wächter: tests/app/health-version-commit.test.ts). Geprüft wird VOR jedem Schreiben:
# Trägt package.json nicht genau einmal die bisherige Nummer, bricht der Lauf ab, ohne eine Datei
# anzufassen. Vorhandene Arbeitsänderungen in beiden Dateien bleiben unberührt.
# Punkte der Nummer wörtlich nehmen (in Mustern stünde „." sonst für jedes Zeichen): jeder Punkt
# wird zur Zeichenklasse [.]. Bewusst per sed statt `${CUR//…}` — die Parametererweiterung enthielte
# die Zeichenfolge Punkt-Schrägstrich, die der cwd-Wächter (tools/check-cwd-contract.mjs) zu Recht
# als relative Pfadangabe liest.
CUR_RE="$(printf '%s' "$CUR" | sed 's/[.]/[.]/g')"; NEXT_RE="$(printf '%s' "$NEXT" | sed 's/[.]/[.]/g')"
PKG_TREFFER="$(grep -c "^  \"version\": \"${CUR_RE}\",\{0,1\}$" "$PKG_FILE" || true)"
if [ "${PKG_TREFFER}" != "1" ]; then
  echo "✗ ${PKG_FILE} trägt nicht genau einmal die Version ${CUR} (wie ${VERSION_FILE}) —"
  echo "  Versionen laufen auseinander. Abgebrochen, nichts geschrieben, committet oder gepusht."
  exit 1
fi
echo "ℹ 2/5  Versions-Zähler: ${CUR} → ${NEXT} (${VERSION_FILE} und ${PKG_FILE})"
echo ""

# 3) EINE Sicherheits-Nachfrage vor den festen Schritten (Commit + Push + Deploy).
read -r -p "Jetzt v${NEXT} committen, nach GitHub pushen und live deployen? [j/N] " ANS
case "${ANS}" in
  j|J|ja|Ja|JA|y|Y) ;;
  *) echo "Abgebrochen — nichts geändert, gepusht oder deployt."; exit 0 ;;
esac

# 3a) Neue Version schreiben + committen. `-i.kwbak` statt BSD-`-i ''`: gleiches Verhalten unter
# macOS und GNU-sed; die Sicherung wird sofort entfernt. Geändert wird NUR die Versionszeile.
sed -i.kwbak "s/\(APP_VERSION *= *\"\)${CUR_RE}\(\"\)/\1${NEXT}\2/" "$VERSION_FILE" && rm -f "${VERSION_FILE}.kwbak"
sed -i.kwbak "s/^\(  \"version\": \"\)${CUR_RE}\(\"\)/\1${NEXT}\2/" "$PKG_FILE" && rm -f "${PKG_FILE}.kwbak"
if ! grep -q "APP_VERSION *= *\"${NEXT_RE}\"" "$VERSION_FILE" || ! grep -q "^  \"version\": \"${NEXT_RE}\"" "$PKG_FILE"; then
  # Nur die EIGENE Änderung zurücknehmen (NEXT → CUR in genau dieser Zeile), nie die ganze Datei.
  sed -i.kwbak "s/\(APP_VERSION *= *\"\)${NEXT_RE}\(\"\)/\1${CUR}\2/" "$VERSION_FILE" && rm -f "${VERSION_FILE}.kwbak"
  sed -i.kwbak "s/^\(  \"version\": \"\)${NEXT_RE}\(\"\)/\1${CUR}\2/" "$PKG_FILE" && rm -f "${PKG_FILE}.kwbak"
  echo "✗ Versionsnummer ließ sich nicht in beiden Dateien setzen — eigene Änderung zurückgenommen, abgebrochen."
  exit 1
fi
MSG="${1:-KLARWERK Ship v${NEXT}}"
git add -A
git commit -m "${MSG}"
echo "✓ 3/5  Commit ${NEXT}: ${MSG}"
echo ""

# 4a) Push nach GitHub (Deploy-Quelle) — mit Retry. Schlägt das fehl, NICHT deployen.
echo "▶ 4/5  Push nach GitHub (${DEPLOY_REMOTE}/${BRANCH}) …"
N=0
until git push "${DEPLOY_REMOTE}" "${BRANCH}"; do
  N=$((N + 1))
  if [ "${N}" -ge 4 ]; then
    echo "✗ GitHub-Push fehlgeschlagen — es wird NICHT deployt (Coolify baut sonst den alten Stand)."
    echo "  Prüfen: ssh -T git@github.com  |  git -C \"$REPO\" push ${DEPLOY_REMOTE} ${BRANCH}"
    exit 1
  fi
  echo "… Netzwerk/Push-Fehler, Versuch ${N} — warte $((2 ** N))s …"
  sleep $((2 ** N))
done
echo "✓ GitHub aktuell (v${NEXT})."

# 4b) Gitea-Spiegel (best effort) — Fehler hier blockieren den Deploy NICHT.
if git push "${MIRROR_REMOTE}" "${BRANCH}"; then
  echo "✓ Gitea-Spiegel aktualisiert."
else
  echo "⚠ Gitea-Spiegel-Push fehlgeschlagen (nur Mirror) — Deploy läuft trotzdem weiter."
fi
echo "✓ 4/5  Push erledigt."
echo ""

# 5) Live-Update: stößt den Coolify-Deploy an, wartet und prüft die Live-Seite.
echo "▶ 5/5  Live-Update (Coolify) …"
# R-0786: „fertig" erst, wenn /health GENAU den gepushten Commit gesund meldet. Jeder andere
# Ausgang des Live-Updates ist ein Fehlschlag und beendet diesen Lauf mit dessen Exitcode.
SHIP_COMMIT="$(git rev-parse HEAD)"
LU_CODE=0
bash "$REPO/scripts/deploy/klarwerk-live-update.command" "${SHIP_COMMIT}" || LU_CODE=$?
if [ "${LU_CODE}" -ne 0 ]; then
  echo ""
  echo "✗ v${NEXT} (${SHIP_COMMIT}) ist NICHT als geliefert bestätigt (Live-Update Exit ${LU_CODE})."
  echo "  Gepusht ist der Stand, live nachgewiesen nicht — nicht als fertig melden."
  exit "${LU_CODE}"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✓ LIVE fertig: Topbar zeigt v${NEXT} auf https://app.klarwerk.ai"
echo "════════════════════════════════════════════════════════"

# 6) Lokale Instanz gleich mit-aktualisieren und starten, damit du nach dem Deploy NICHT mehr
#    manuell neu starten musst (Pedi 06.07.). Dies ist der letzte Schritt und hält das Fenster
#    offen (der lokale Server läuft im Vordergrund). Willst du NICHT lokal starten: hier Strg+C.
echo ""
echo "▶ Lokale Instanz aktualisieren & starten (localhost:3001) — Fenster bleibt offen; schließen = lokal stoppen."
echo "  (Nur lokal starten willst du nicht? Dann jetzt Strg+C — live ist bereits aktualisiert.)"
bash "$REPO/scripts/local/klarwerk-lokal-starten.command"
