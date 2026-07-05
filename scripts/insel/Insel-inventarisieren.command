#!/bin/bash
# =====================================================================
# KLARWERK Insel — Inventarisieren  (KLLM-70)
# Schreibt den Ist-Zustand des Mac Studio als VERSIONIERTES Manifest ins
# Repo (docs/operations/insel-inventar/) + menschenlesbares INSEL-AUFBAU.md.
# Enthaelt NIEMALS Secrets: Schluessel bleiben im Keychain, hier nur Namen.
# Idempotent: mehrfach ausfuehrbar, ueberschreibt das Inventar sauber.
# =====================================================================
# KEINE 'set -e' — Inventar-Sonden duerfen fehlen und degradieren sanft.
set -uo pipefail

# --- Farben / Helfer -------------------------------------------------
O=$'\033[38;5;208m'; G=$'\033[32m'; Y=$'\033[33m'; D=$'\033[2m'; R=$'\033[0m'
say(){ printf '%s\n' "$*"; }
h(){ printf '\n%s== %s ==%s\n' "$O" "$*" "$R"; }
have(){ command -v "$1" >/dev/null 2>&1; }

# --- Repo finden -----------------------------------------------------
REPO="${KLARWERK_REPO:-$HOME/Documents/dev_Klarwerk}"
if [ ! -d "$REPO/.git" ]; then
  say "${Y}Repo nicht unter $REPO gefunden.${R}"
  read -r -p "Pfad zum klarwerk-Repo (Enter = abbrechen): " REPO
  [ -z "${REPO:-}" ] && exit 1
fi
OUT="$REPO/docs/operations/insel-inventar"
mkdir -p "$OUT/launchagents"

# Zeitstempel (nur einmal erzeugen)
TS="$(date +%Y-%m-%dT%H:%M:%S%z)"
TSHUMAN="$(date '+%d.%m.%Y %H:%M')"
HOSTLABEL="$(scutil --get ComputerName 2>/dev/null || hostname)"

h "KLARWERK Insel inventarisieren"
say "Repo:   $REPO"
say "Ablage: $OUT"
say "Zeit:   $TSHUMAN"

# --- 1) System -------------------------------------------------------
h "System"
{
  echo "erfasst_am=$TS"
  echo "rechner=$HOSTLABEL"
  echo "macos=$(sw_vers -productName 2>/dev/null) $(sw_vers -productVersion 2>/dev/null) ($(sw_vers -buildVersion 2>/dev/null))"
  echo "modell=$(sysctl -n hw.model 2>/dev/null)"
  echo "chip=$(sysctl -n machdep.cpu.brand_string 2>/dev/null)"
  RAMB=$(sysctl -n hw.memsize 2>/dev/null); [ -n "${RAMB:-}" ] && echo "ram_gb=$(( RAMB / 1073741824 ))"
  if sysctl -n hw.optional.arm64 2>/dev/null | grep -q 1; then echo "apple_silicon=ja"; else echo "apple_silicon=nein/unbekannt"; fi
  echo "benutzer=$(id -un)"
} | tee "$OUT/versions.txt"

# --- 2) Homebrew -----------------------------------------------------
h "Homebrew"
if have brew; then
  brew --version 2>/dev/null | head -1 | sed 's/^/brew=/' >> "$OUT/versions.txt"
  brew leaves 2>/dev/null > "$OUT/brew-leaves.txt"
  brew list --cask 2>/dev/null > "$OUT/brew-casks.txt"
  say "${G}$(wc -l < "$OUT/brew-leaves.txt" | tr -d ' ') Formeln, $(wc -l < "$OUT/brew-casks.txt" | tr -d ' ') Casks erfasst.${R}"
else
  say "${Y}Homebrew nicht gefunden — wird beim Aufbau installiert.${R}"
  : > "$OUT/brew-leaves.txt"; : > "$OUT/brew-casks.txt"
fi

# --- 3) Ollama + Modelle (inkl. bge-m3) ------------------------------
h "Ollama + Modelle"
if have ollama; then
  ollama --version 2>/dev/null | head -1 | sed 's/^/ollama=/' >> "$OUT/versions.txt"
  # Rohliste (Name / ID / Groesse) fuer Menschen ...
  ollama list 2>/dev/null > "$OUT/ollama-list.raw.txt"
  # ... und eine reine Namensliste (Spalte 1, ohne Kopf) fuer den Aufbau:
  awk 'NR>1 && $1!="" {print $1}' "$OUT/ollama-list.raw.txt" | sort -u > "$OUT/ollama-models.txt"
  say "${G}$(wc -l < "$OUT/ollama-models.txt" | tr -d ' ') Modelle erfasst.${R}"
  if grep -qi 'bge-m3' "$OUT/ollama-models.txt"; then
    say "${G}bge-m3 (Embedding, Phase 2) ist vorhanden.${R}"
  else
    say "${Y}Hinweis: bge-m3 fehlt — fuer die Bedeutungssuche noetig: ollama pull bge-m3${R}"
  fi
else
  say "${Y}Ollama nicht gefunden — wird beim Aufbau installiert.${R}"
  : > "$OUT/ollama-models.txt"; : > "$OUT/ollama-list.raw.txt"
fi

# --- 4) MLX venv + exakte Pins ---------------------------------------
h "MLX (Python-venv + Pins)"
# Bekannte Kandidatenpfade fuer die MLX-venv (aus dem Insel-Paket):
MLXVENV=""
for c in "$HOME/Library/Application Support/KLARWERK-Insel/mlx-venv" \
         "$HOME/.klarwerk-mlx" "$HOME/mlx-venv" "$HOME/Downloads/KLARWERK-Insel/mlx-venv"; do
  [ -x "$c/bin/python3" ] && { MLXVENV="$c"; break; }
done
if [ -n "$MLXVENV" ]; then
  echo "mlx_venv=$MLXVENV" >> "$OUT/versions.txt"
  "$MLXVENV/bin/python3" --version 2>&1 | sed 's/^/mlx_python=/' >> "$OUT/versions.txt"
  "$MLXVENV/bin/python3" -m pip freeze 2>/dev/null > "$OUT/mlx-requirements.txt"
  say "${G}venv: $MLXVENV — $(wc -l < "$OUT/mlx-requirements.txt" | tr -d ' ') Pakete gepinnt.${R}"
  grep -i '^transformers' "$OUT/mlx-requirements.txt" 2>/dev/null | sed "s/^/  Pin: /"
else
  say "${Y}MLX-venv nicht gefunden — der Aufbau legt sie mit den bekannten Pins neu an (transformers>=4.44,<5).${R}"
  # Fallback-Pins dokumentieren, damit der Aufbau ohne Ist-venv funktioniert:
  cat > "$OUT/mlx-requirements.txt" <<'REQ'
# Fallback-Pins (keine Ist-venv gefunden). Bekannt-gute Kombination fuer Apple Silicon.
mlx-lm
transformers>=4.44,<5
REQ
fi

# --- 5) Node / npm / python (System) ---------------------------------
h "Node / npm / Python"
have node   && node -v            2>/dev/null | sed 's/^/node=/'          >> "$OUT/versions.txt"
have npm    && npm -v             2>/dev/null | sed 's/^/npm=/'           >> "$OUT/versions.txt"
have python3&& python3 --version  2>&1        | sed 's/^/python3_system=/' >> "$OUT/versions.txt"
have npm    && npm ls -g --depth=0 2>/dev/null | sed '1d' | awk '{print $2}' | sed '/^$/d' > "$OUT/npm-global.txt"
say "${G}Versionen erfasst.${R}"

# --- 6) Insel-App + Ports --------------------------------------------
h "Insel-App"
{
  echo "port_insel=127.0.0.1:11888"
  echo "port_ollama=127.0.0.1:11434"
  echo "port_mlx=127.0.0.1:8080"
  for a in "$HOME/Desktop/KLARWERK Insel.app" "$HOME/Desktop/KLARWERK MLX.app"; do
    [ -d "$a" ] && echo "app_vorhanden=$a"
  done
  for b in "$HOME/Downloads/KLARWERK-Insel/App-bauen.command" "$HOME/Downloads/KLARWERK-Insel/KLARWERK-Insel-App-bauen.command"; do
    [ -f "$b" ] && echo "app_bauer=$b"
  done
} > "$OUT/insel-app.txt"
cat "$OUT/insel-app.txt"

# --- 7) Datenzustaende (Pfade + Groessen, NICHT Inhalte) -------------
h "Datenzustaende (nur Pfade/Groessen)"
APPSUP="$HOME/Library/Application Support/KLARWERK-Insel"
{
  echo "store_verzeichnis=$APPSUP"
  for f in artefakte.json benchmarks.json wissen.json; do
    if [ -f "$APPSUP/$f" ]; then
      echo "$f=$(wc -c < "$APPSUP/$f" | tr -d ' ') Bytes, geaendert $(date -r "$APPSUP/$f" '+%d.%m.%Y %H:%M' 2>/dev/null)"
    else
      echo "$f=nicht vorhanden"
    fi
  done
} > "$OUT/datenzustaende.txt"
cat "$OUT/datenzustaende.txt"
say "${D}(Inhalte werden bewusst NICHT erfasst — koennen Nutzdaten enthalten.)${R}"

# --- 8) LaunchAgents (Autostart) — secrets-frei ----------------------
h "Autostart (LaunchAgents)"
LAOUT="$OUT/launchagents"; rm -f "$LAOUT"/*.plist 2>/dev/null
FOUND=0
if [ -d "$HOME/Library/LaunchAgents" ]; then
  for p in "$HOME/Library/LaunchAgents/"*.plist; do
    [ -e "$p" ] || continue
    case "$(basename "$p")" in
      *klarwerk*|*ollama*|*mlx*) cp "$p" "$LAOUT/"; FOUND=$((FOUND+1)); echo "$(basename "$p")";;
    esac
  done
fi
[ "$FOUND" = 0 ] && say "${D}Keine relevanten LaunchAgents (Ollama/MLX werden manuell/aus der App gestartet).${R}"

# --- 9) Keychain-REFERENZEN (nur Namen, nie Werte) -------------------
h "Keychain-Referenzen (nur Namen)"
cat > "$OUT/keychain-referenzen.txt" <<'KC'
# Diese logischen Schluessel erwartet die Insel-App im macOS-Schluesselbund.
# Hier stehen NUR die Namen. Werte werden NIEMALS erfasst oder exportiert.
# Beim Aufbau eines neuen Rechners traegt der Mensch die Schluessel per
# Schluesselbund-App / Insel-Schluessel-App ein.
Anthropic  (Cloud-Referenzlauf)
OpenAI     (Cloud-Referenzlauf)
Gemini     (Cloud-Referenzlauf)
KC
cat "$OUT/keychain-referenzen.txt"

# --- 10) manifest.json (Kurzfassung, pur mit printf) -----------------
h "Manifest schreiben"
esc(){ sed 's/\\/\\\\/g; s/"/\\"/g'; }
val(){ grep -m1 "^$1=" "$OUT/versions.txt" 2>/dev/null | cut -d= -f2- | esc; }
{
  printf '{\n'
  printf '  "schema": "insel-manifest/1",\n'
  printf '  "erfasst_am": "%s",\n' "$(printf '%s' "$TS" | esc)"
  printf '  "rechner": "%s",\n'    "$(printf '%s' "$HOSTLABEL" | esc)"
  printf '  "macos": "%s",\n'      "$(val macos)"
  printf '  "modell": "%s",\n'     "$(val modell)"
  printf '  "chip": "%s",\n'       "$(val chip)"
  printf '  "ram_gb": "%s",\n'     "$(val ram_gb)"
  printf '  "node": "%s",\n'       "$(val node)"
  printf '  "ollama": "%s",\n'     "$(val ollama)"
  printf '  "brew_formeln": %s,\n' "$(wc -l < "$OUT/brew-leaves.txt" | tr -d ' ')"
  printf '  "brew_casks": %s,\n'   "$(wc -l < "$OUT/brew-casks.txt" | tr -d ' ')"
  printf '  "ollama_modelle": %s,\n' "$(wc -l < "$OUT/ollama-models.txt" | tr -d ' ')"
  printf '  "mlx_pakete": %s,\n'   "$(wc -l < "$OUT/mlx-requirements.txt" | tr -d ' ')"
  printf '  "bge_m3": %s\n' "$(grep -qi bge-m3 "$OUT/ollama-models.txt" && echo true || echo false)"
  printf '}\n'
} > "$OUT/manifest.json"
say "${G}manifest.json geschrieben.${R}"

# --- 11) INSEL-AUFBAU.md (menschenlesbar) ----------------------------
MD="$REPO/docs/operations/INSEL-AUFBAU.md"
{
  echo "# INSEL-AUFBAU — Mac Studio (KLARWERK On-Prem)"
  echo
  echo "> Automatisch erzeugt von \`Insel-inventarisieren.command\` am **$TSHUMAN** auf **$HOSTLABEL**."
  echo "> Quelle der Wahrheit fuer den Aufbau der Insel. Ticket: KLLM-70 (Bezug KLLM-62)."
  echo "> **Keine Secrets** in dieser Datei — Schluessel liegen ausschliesslich im macOS-Schluesselbund."
  echo
  echo "## Wozu"
  echo "Damit ein vergleichbarer Rechner mit **einem Command** (\`Insel-aufbauen.command\`)"
  echo "reproduziert oder wiederhergestellt werden kann — und jeder nachvollziehen kann,"
  echo "was installiert ist. Dieses Dokument + die Dateien unter \`insel-inventar/\` sind"
  echo "im Git versioniert; jede Aenderung am Mac wird durch erneutes Inventarisieren"
  echo "als Diff sichtbar."
  echo
  echo "## System"
  echo '```'
  cat "$OUT/versions.txt"
  echo '```'
  echo
  echo "## Ollama-Modelle (inkl. bge-m3 fuer die Bedeutungssuche)"
  echo '```'
  cat "$OUT/ollama-list.raw.txt" 2>/dev/null
  echo '```'
  echo
  echo "## Homebrew (Top-Formeln / Casks)"
  echo "Formeln (\`insel-inventar/brew-leaves.txt\`):"
  echo '```'
  cat "$OUT/brew-leaves.txt"
  echo '```'
  echo "Casks (\`insel-inventar/brew-casks.txt\`):"
  echo '```'
  cat "$OUT/brew-casks.txt"
  echo '```'
  echo
  echo "## MLX — gepinnte Python-Pakete"
  echo "Voll: \`insel-inventar/mlx-requirements.txt\`. Kritischer Pin:"
  echo '```'
  grep -i '^transformers' "$OUT/mlx-requirements.txt" 2>/dev/null || echo "transformers>=4.44,<5"
  echo '```'
  echo
  echo "## Ports (nur localhost)"
  echo '```'
  cat "$OUT/insel-app.txt"
  echo '```'
  echo
  echo "## Datenzustaende (Pfade, keine Inhalte)"
  echo '```'
  cat "$OUT/datenzustaende.txt"
  echo '```'
  echo
  echo "## Schluessel (Keychain-Referenzen — nie Werte)"
  echo '```'
  cat "$OUT/keychain-referenzen.txt"
  echo '```'
  echo
  echo "## Wiederaufbau"
  echo "1. Dieses Repo auf den Zielrechner bringen (Git oder USB)."
  echo "2. \`bash docs/operations/../Insel-aufbauen.command\` (bzw. aus dem Insel-Paket) ausfuehren."
  echo "3. Schluessel im Schluesselbund eintragen (per Insel-Schluessel-App)."
  echo "4. \`Insel-inventarisieren.command\` erneut laufen lassen und den Diff pruefen."
  echo
  echo "## Pflege"
  echo "Nach **jeder** Aenderung am Mac (neues Modell, neues Tool, MLX-Update) erneut"
  echo "inventarisieren und committen — so bleibt das Dokument die Wahrheit."
} > "$MD"
say "${G}INSEL-AUFBAU.md geschrieben: $MD${R}"

# --- 12) Optional committen (nur diese Dateien) ----------------------
h "Versionieren"
say "Erfasst wurden ausschliesslich Inventar-Dateien (ohne Secrets)."
read -r -p "Diese Inventar-Dateien jetzt committen (nicht pushen)? [j/N] " A
if [ "${A:-N}" = "j" ] || [ "${A:-N}" = "J" ]; then
  ( cd "$REPO" && git add "docs/operations/INSEL-AUFBAU.md" "docs/operations/insel-inventar" \
    && git commit -m "docs(insel): Mac-Studio-Inventar aktualisiert ($TSHUMAN) [KLLM-70]" \
    && say "${G}Committed. Push machst du bewusst separat.${R}" ) \
    || say "${Y}Commit uebersprungen/fehlgeschlagen — Dateien liegen bereit.${R}"
else
  say "${D}Nicht committet. Dateien liegen unter docs/operations/ bereit.${R}"
fi

h "Fertig"
say "Inventar aktualisiert. Menschlesbar: docs/operations/INSEL-AUFBAU.md"
