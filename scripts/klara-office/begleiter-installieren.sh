#!/bin/bash
# =================================================================================================
# KLARA-OFFICE-02 · DIE BEGLEITAPP INSTALLIEREN, AKTUALISIEREN UND STARTEN — nur ihr eigener Pfad.
# =================================================================================================
#
# Kopiert das gebaute Bündel nach
#   ~/Applications/Klara Begleiter.app
# (Benutzerordner, keine Administratorrechte, kein anderes Programm wird berührt). Läuft schon eine
# ältere Fassung, wird NUR diese App beendet und ersetzt — das ist der Aktualisierungsweg. Danach
# wird sie gestartet, ausser mit `--ohne-start`.
#
# Was dieses Skript NICHT tut: keinen Anmeldeeintrag, keinen LaunchAgent, keinen Hintergrunddienst,
# kein `sudo`, keine Änderung an Word, Chrome oder anderen Fenstern. Die Prüfung am Ende belegt das.
#
# Aufruf aus der Werkswurzel nach `begleiter-bauen.sh`:
#   scripts/klara-office/begleiter-installieren.sh [--ohne-start]
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
QUELLE="$WURZEL/apps/desktop/klara-begleiter/build/Klara Begleiter.app"
ZIELORDNER="$HOME/Applications"
ZIEL="$ZIELORDNER/Klara Begleiter.app"
KENNUNG="ai.klarwerk.klara-begleiter"

if [ ! -d "$QUELLE" ]; then
  echo "Kein gebautes Bündel unter $QUELLE — zuerst scripts/klara-office/begleiter-bauen.sh" >&2
  exit 1
fi

mkdir -p "$ZIELORDNER"
# Erst die neue Fassung vollständig bereitstellen und prüfen. Die bisherige bleibt bis dahin stehen.
STUFE="$ZIELORDNER/.Klara-Begleiter-update-$$.app"
trap 'if [ -d "$STUFE" ]; then rm -rf "$STUFE"; fi' EXIT
# Erweiterte Attribute (FinderInfo, Quarantäne, Synchronisationsmetadaten) werden NICHT übernommen
# und am eigenen Zielbündel zusätzlich entfernt: Finder/Dateisynchronisation fügen sie dem
# Quellbündel nachträglich hinzu, und dann scheitert die strenge Signaturprüfung (Mac-Prüfung
# 10.10.2026: strict_source_exit=1, nur die metadatenfrei kopierte Variante bestand).
ditto --noextattr --noqtn "$QUELLE" "$STUFE"
/usr/bin/xattr -cr "$STUFE"
# Streng prüfen, BEVOR gestartet wird — `set -e` bricht bei einer ungültigen Signatur hier ab.
codesign --verify --strict --deep --verbose=2 "$STUFE"
SIGNATUR="streng geprüft (codesign --verify --strict --deep)"

# Die Bündelkennung ist bei Prüffassungen gleich. Deshalb nur den exakten Installationspfad beenden.
eigene_pids() {
  ps -axo pid=,comm= | while read -r pid pfad; do
    if [ "$pfad" = "$ZIEL/Contents/MacOS/KlaraBegleiter" ]; then printf '%s\n' "$pid"; fi
  done
}
swift - "$ZIEL" <<'SWIFT'
import AppKit
let ziel = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let laufend = NSWorkspace.shared.runningApplications
if laufend.contains(where: { $0.bundleIdentifier == "ai.klarwerk.klara-begleiter" && $0.bundleURL?.standardizedFileURL != ziel }) {
    fputs("Eine andere Klara-Prüffassung läuft. Aktualisierung ohne Eingriff abgebrochen.\n", stderr)
    exit(1)
}
for app in laufend where app.bundleURL?.standardizedFileURL == ziel {
    guard app.terminate() else {
        fputs("Die installierte App konnte nicht regulär beendet werden.\n", stderr)
        exit(1)
    }
}
SWIFT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [ -z "$(eigene_pids)" ] && break
  sleep 0.5
done
if [ -n "$(eigene_pids)" ]; then
  echo "Die installierte App läuft noch; Aktualisierung abgebrochen, bisherige Fassung erhalten." >&2
  exit 1
fi
SICHERUNG="keine vorherige Installation"
if [ -d "$ZIEL" ]; then
  SICHERUNG="$HOME/Library/Application Support/Klarwerk/Klara-Sicherungen/$(date -u +%Y%m%dT%H%M%SZ)-$$/Klara Begleiter.app"
  mkdir -p "$(dirname "$SICHERUNG")"
  mv "$ZIEL" "$SICHERUNG"
fi
if ! mv "$STUFE" "$ZIEL"; then
  if [ -d "$SICHERUNG" ]; then mv "$SICHERUNG" "$ZIEL"; fi
  exit 1
fi
codesign --verify --strict --deep --verbose=2 "$ZIEL"

FASSUNG="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ZIEL/Contents/Info.plist")"
BAU="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$ZIEL/Contents/Info.plist")"
SERVER="$(/usr/libexec/PlistBuddy -c 'Print :KlarwerkServer' "$ZIEL/Contents/Info.plist")"

if [ "${1:-}" != "--ohne-start" ]; then
  open "$ZIEL"
fi

# Kein Autostart wird angelegt. Diese Kontrolle liest nur LaunchAgent-Dateinamen;
# die macOS-Anmeldeobjekte werden nicht abgefragt oder verändert.
AUTOSTART="nein"
if ls "$HOME/Library/LaunchAgents" 2>/dev/null | grep -qi "klara-begleiter"; then
  AUTOSTART="JA (LaunchAgent gefunden — nicht von diesem Skript angelegt, bitte prüfen)"
fi

{
  echo "installiert=$ZIEL"
  echo "fassung=$FASSUNG"
  echo "bau=$BAU"
  echo "server=$SERVER"
  echo "vorherige_fassung=$SICHERUNG"
  echo "signatur=$SIGNATUR"
  echo "startweg=open \"$ZIEL\" · Finder → Programme (Benutzer) · Spotlight „Klara Begleiter“"
  echo "autostart=$AUTOSTART"
  echo "anmeldeobjekte=nicht abgefragt; unverändert"
  echo "installiert_am=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee "$WURZEL/apps/desktop/klara-begleiter/build/INSTALLATION.txt"
