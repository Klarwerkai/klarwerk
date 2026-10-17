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

# Eine laufende Fassung DIESER App beenden — nur sie, über ihre Kennung.
if pgrep -f "Klara Begleiter.app/Contents/MacOS/KlaraBegleiter" >/dev/null 2>&1; then
  osascript -e "tell application id \"$KENNUNG\" to quit" >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -f "Klara Begleiter.app/Contents/MacOS/KlaraBegleiter" >/dev/null 2>&1 || break
    sleep 0.5
  done
fi

mkdir -p "$ZIELORDNER"
rm -rf "$ZIEL"
# Erweiterte Attribute (FinderInfo, Quarantäne, Synchronisationsmetadaten) werden NICHT übernommen
# und am eigenen Zielbündel zusätzlich entfernt: Finder/Dateisynchronisation fügen sie dem
# Quellbündel nachträglich hinzu, und dann scheitert die strenge Signaturprüfung (Mac-Prüfung
# 10.10.2026: strict_source_exit=1, nur die metadatenfrei kopierte Variante bestand).
ditto --noextattr --noqtn "$QUELLE" "$ZIEL"
/usr/bin/xattr -cr "$ZIEL"
# Streng prüfen, BEVOR gestartet wird — `set -e` bricht bei einer ungültigen Signatur hier ab.
codesign --verify --strict --deep --verbose=2 "$ZIEL"
SIGNATUR="streng geprüft (codesign --verify --strict --deep)"

FASSUNG="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ZIEL/Contents/Info.plist")"
BAU="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$ZIEL/Contents/Info.plist")"
SERVER="$(/usr/libexec/PlistBuddy -c 'Print :KlarwerkServer' "$ZIEL/Contents/Info.plist")"

if [ "${1:-}" != "--ohne-start" ]; then
  open "$ZIEL"
fi

# Beleg: kein Autostart dieser App — weder LaunchAgent noch Anmeldeobjekt.
AUTOSTART="nein"
if ls "$HOME/Library/LaunchAgents" 2>/dev/null | grep -qi "klara-begleiter"; then
  AUTOSTART="JA (LaunchAgent gefunden — nicht von diesem Skript angelegt, bitte prüfen)"
fi

{
  echo "installiert=$ZIEL"
  echo "fassung=$FASSUNG"
  echo "bau=$BAU"
  echo "server=$SERVER"
  echo "signatur=$SIGNATUR"
  echo "startweg=open \"$ZIEL\" · Finder → Programme (Benutzer) · Spotlight „Klara Begleiter“"
  echo "autostart=$AUTOSTART"
  echo "installiert_am=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee "$WURZEL/apps/desktop/klara-begleiter/build/INSTALLATION.txt"
