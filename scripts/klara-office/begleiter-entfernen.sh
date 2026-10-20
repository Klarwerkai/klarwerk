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

swift - "$ZIEL" <<'SWIFT'
import AppKit
let ziel = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let laufend = NSWorkspace.shared.runningApplications
if laufend.contains(where: { $0.bundleIdentifier == "ai.klarwerk.klara-begleiter" && $0.bundleURL?.standardizedFileURL != ziel }) {
    fputs("Eine andere Klara-Prüffassung läuft; ihre gemeinsamen Daten bleiben geschützt.\n", stderr)
    exit(1)
}
for app in laufend where app.bundleURL?.standardizedFileURL == ziel {
    guard app.terminate() else { exit(1) }
    let ende = Date().addingTimeInterval(5)
    while !app.isTerminated && Date() < ende { RunLoop.current.run(until: Date().addingTimeInterval(0.1)) }
    guard app.isTerminated else { exit(1) }
}
SWIFT
rm -rf "$ZIEL"
defaults delete "$KENNUNG" >/dev/null 2>&1 || true

if [ "${1:-}" = "--mit-anmeldung" ]; then
  rm -rf "$HOME/Library/WebKit/$KENNUNG" "$HOME/Library/Caches/$KENNUNG" \
    "$HOME/Library/HTTPStorages/$KENNUNG" "$HOME/Library/HTTPStorages/$KENNUNG.binarycookies"
fi

echo "entfernt=$ZIEL"
echo "einstellungen=$KENNUNG (gelöscht)"
echo "webspeicher=$([ "${1:-}" = "--mit-anmeldung" ] && echo gelöscht || echo behalten)"
