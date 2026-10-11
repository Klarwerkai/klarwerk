#!/bin/sh
# BPA-01 AC10 — die Browserbrücke des Klara-Begleiters für Chrome auf DIESEM Mac einrichten.
#
# Aufruf:  ./installieren.sh <Erweiterungskennung>
#   Die Kennung (32 Buchstaben a–p) steht in chrome://extensions auf der Kachel „Klara im Browser".
#
# Was geschieht — und nichts sonst:
#   1. die Brücke wird übersetzt (swift build -c release);
#   2. Programm und Erweiterungskennung kommen nach ~/Library/Application Support/Klarwerk/Begleiter;
#   3. das Host-Manifest kommt nach ~/Library/Application Support/Google/Chrome/NativeMessagingHosts
#      und lässt GENAU diese eine Erweiterung zu.
# Kein Systemordner, kein sudo, kein Dienst, keine Anmeldung. Entfernen: die beiden Dateien löschen.
set -eu

KENNUNG="${1:-}"
case "$KENNUNG" in
  ????????????????????????????????) ;;
  *) echo "Bitte die Erweiterungskennung (32 Zeichen) angeben." >&2; exit 2 ;;
esac
if ! printf '%s' "$KENNUNG" | grep -Eq '^[a-p]{32}$'; then
  echo "Die Kennung besteht aus 32 Buchstaben a–p." >&2
  exit 2
fi

HIER="$(cd "$(dirname "$0")" && pwd)"
ZIEL="$HOME/Library/Application Support/Klarwerk/Begleiter"
HOSTS="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

(cd "$HIER" && swift build -c release)
mkdir -p "$ZIEL" "$HOSTS"
chmod 700 "$ZIEL"
cp "$HIER/.build/release/KlaraBrowserBruecke" "$ZIEL/KlaraBrowserBruecke"
printf '%s\n' "$KENNUNG" > "$ZIEL/erweiterung"
chmod 600 "$ZIEL/erweiterung"
sed -e "s#__PROGRAMM__#$ZIEL/KlaraBrowserBruecke#" -e "s#__ERWEITERUNG__#$KENNUNG#" \
  "$HIER/ai.klarwerk.klara_begleiter.json.vorlage" > "$HOSTS/ai.klarwerk.klara_begleiter.json"

echo "Eingerichtet. In Chrome: Klara-Leiste → „Mit Begleiter verbinden“."
