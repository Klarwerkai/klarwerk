#!/bin/bash
# =================================================================================================
# KLARA-OFFICE-02 · DIE BEGLEITAPP BAUEN — ein .app-Bündel für Apple-Silicon-Macs (arm64).
# =================================================================================================
#
# Baut aus `apps/desktop/klara-begleiter/Sources/*.swift` (Host, BPA-04-Fenster) und der
# Kartenbibliothek `BrowserBruecke/Sources/KlaraBrowserKarte` mit dem vorhandenen Swift-Compiler (Xcode
# bzw. Command Line Tools, getestet für Swift 6.1 im Sprachmodus 5) das Bündel
#   apps/desktop/klara-begleiter/build/Klara Begleiter.app
# und signiert es lokal ad hoc (keine Apple-ID, kein Schlüssel). Installiert NICHTS und startet
# NICHTS — dafür `begleiter-installieren.sh`.
#
#   Fassung   aus apps/desktop/klara-begleiter/VERSION
#   Bau       Kurzkennung des Git-Stands (KLARA_BEGLEITER_BAU überschreibt), sonst „lokal"
#   Server    https://klarwerk.ai (KLARWERK_SERVER überschreibt, nur https oder http://localhost)
#
# Aufruf aus der Werkswurzel:  scripts/klara-office/begleiter-bauen.sh
set -euo pipefail

WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
QUELLE="$WURZEL/apps/desktop/klara-begleiter"
ZIEL="$QUELLE/build"
BUENDEL="$ZIEL/Klara Begleiter.app"

FASSUNG="$(tr -d '[:space:]' < "$QUELLE/VERSION")"
BAU="${KLARA_BEGLEITER_BAU:-$(git -C "$WURZEL" rev-parse --short=8 HEAD 2>/dev/null || echo lokal)}"
SERVER="${KLARWERK_SERVER:-https://klarwerk.ai}"

if ! [[ "$FASSUNG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "VERSION ist keine Fassung der Form 1.2.3: '$FASSUNG'" >&2
  exit 1
fi
if ! [[ "$BAU" =~ ^[0-9A-Za-z.+_-]{1,40}$ ]]; then
  echo "Bau-Kennung unzulässig: '$BAU'" >&2
  exit 1
fi
if ! [[ "$SERVER" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ || "$SERVER" =~ ^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]]; then
  echo "Server unzulässig (nur https://host oder http://localhost:port): '$SERVER'" >&2
  exit 1
fi
if [ "$(uname -m)" != "arm64" ]; then
  echo "Hinweis: gebaut wird für arm64 (Apple Silicon); dieser Rechner ist $(uname -m)." >&2
fi

rm -rf "$BUENDEL"
mkdir -p "$BUENDEL/Contents/MacOS" "$BUENDEL/Contents/Resources"

# BPA-01 AC10: die Kartenbibliothek der Browserbrücke wird in DASSELBE Modul übersetzt
# (`KlaraBrowserKarte`; der Import in `Steuerung.swift` ist dafür `#if canImport` geschützt). Die
# Brücke selbst ist ein eigenes Programm: `BrowserBruecke/installieren.sh`.
swiftc \
  -swift-version 5 \
  -O \
  -target arm64-apple-macos13.0 \
  -framework AppKit -framework WebKit -framework Carbon -framework SwiftUI \
  -o "$BUENDEL/Contents/MacOS/KlaraBegleiter" \
  "$QUELLE"/Sources/*.swift \
  "$QUELLE"/BrowserBruecke/Sources/KlaraBrowserKarte/*.swift

sed \
  -e "s|__FASSUNG__|$FASSUNG|g" \
  -e "s|__BAU__|$BAU|g" \
  -e "s|__SERVER__|$SERVER|g" \
  "$QUELLE/Info.plist.vorlage" > "$BUENDEL/Contents/Info.plist"
printf 'APPL????' > "$BUENDEL/Contents/PkgInfo"
plutil -lint "$BUENDEL/Contents/Info.plist" >/dev/null

# Ad-hoc-Signatur: genügt für den Start auf DIESEM Mac. Keine Härtung, keine Notarisierung.
# Finder-/Synchronisationsmetadaten nur vom eigenen neu erzeugten Bündel entfernen.
/usr/bin/xattr -cr "$BUENDEL"
codesign --force --deep --sign - "$BUENDEL"
codesign --verify --verbose=1 "$BUENDEL"

{
  echo "bündel=$BUENDEL"
  echo "fassung=$FASSUNG"
  echo "bau=$BAU"
  echo "server=$SERVER"
  echo "architektur=$(lipo -archs "$BUENDEL/Contents/MacOS/KlaraBegleiter")"
  echo "sha256=$(shasum -a 256 "$BUENDEL/Contents/MacOS/KlaraBegleiter" | cut -d' ' -f1)"
  echo "gebaut=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} | tee "$ZIEL/BAU.txt"
