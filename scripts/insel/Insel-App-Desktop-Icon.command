#!/bin/bash
# =====================================================================
# Legt eine Doppelklick-App "KLARWERK App" auf den Schreibtisch, die den
# Launcher (scripts/insel/Insel-App-starten.command) im Terminal startet.
# Einmal ausfuehren; danach startest du die App per Doppelklick.
# =====================================================================
set -uo pipefail
REPO="${KLARWERK_REPO:-$HOME/Documents/dev_Klarwerk}"
LAUNCHER="$REPO/scripts/insel/Insel-App-starten.command"
APP="$HOME/Desktop/KLARWERK App.app"

O=$'\033[38;5;208m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[0m'
printf '%s== Desktop-Icon anlegen ==%s\n' "$O" "$R"

if [ ! -f "$LAUNCHER" ]; then
  printf '%s  ! Launcher nicht gefunden: %s%s\n' "$Y" "$LAUNCHER" "$R"
  printf '    (Liegt scripts/insel/ im Repo? Sonst KLARWERK_REPO setzen.)\n'
  exit 1
fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>KLARWERK App</string>
  <key>CFBundleDisplayName</key><string>KLARWERK App</string>
  <key>CFBundleIdentifier</key><string>ai.klarwerk.app.launcher</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>starten</string>
</dict></plist>
PLIST

cat > "$APP/Contents/MacOS/starten" <<STARTER
#!/bin/bash
open -a Terminal "$LAUNCHER"
STARTER

chmod +x "$APP/Contents/MacOS/starten"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

printf '%s  ✓ Angelegt: %s%s\n' "$G" "$APP" "$R"
printf '    Doppelklick startet die KLARWERK App im Terminal.\n'
printf '    Backend/Port aendern: oben im Launcher (%s).\n' "$LAUNCHER"
