#!/bin/bash
# =================================================================================================
# KLARA-OFFICE-02 · DIE BEGLEITAPP ENTFERNEN — nur ihr eigener Pfad und ihre eigenen Daten.
# =================================================================================================
#
# Beendet „Klara Begleiter" (nur diese App), löscht ~/Applications/Klara Begleiter.app und die
# gemerkte Fensterlage. Mit `--mit-anmeldung` zusätzlich den Web-Speicher der App (Anmeldecookie
# der Begleitapp, Bedienvorlieben) — sonst bleibt die Anmeldung für eine spätere Neuinstallation.
# Word, Chrome, das Word-Add-in und andere Programme werden nicht berührt.
set -euo pipefail

ZIEL="$HOME/Applications/Klara Begleiter.app"
KENNUNG="ai.klarwerk.klara-begleiter"

osascript -e "tell application id \"$KENNUNG\" to quit" >/dev/null 2>&1 || true
sleep 1
rm -rf "$ZIEL"
defaults delete "$KENNUNG" >/dev/null 2>&1 || true

if [ "${1:-}" = "--mit-anmeldung" ]; then
  rm -rf "$HOME/Library/WebKit/$KENNUNG" "$HOME/Library/Caches/$KENNUNG" \
    "$HOME/Library/HTTPStorages/$KENNUNG" "$HOME/Library/HTTPStorages/$KENNUNG.binarycookies"
fi

echo "entfernt=$ZIEL"
echo "einstellungen=$KENNUNG (gelöscht)"
echo "webspeicher=$([ "${1:-}" = "--mit-anmeldung" ] && echo gelöscht || echo behalten)"
