#!/bin/bash
# =====================================================================
# KLARWERK Insel — Aufbauen / Wiederherstellen  (KLLM-70)
# Liest das Inventar aus docs/operations/insel-inventar/ und stellt einen
# vergleichbaren Mac her. IDEMPOTENT: prueft vor jeder Installation, kann
# beliebig oft laufen. Ehrlicher Air-Gap-Hinweis, wo Netz noetig waere.
# Installiert NIE Schluessel — die traegt der Mensch im Schluesselbund ein.
# =====================================================================
set -uo pipefail

O=$'\033[38;5;208m'; G=$'\033[32m'; Y=$'\033[33m'; Rd=$'\033[31m'; D=$'\033[2m'; R=$'\033[0m'
h(){ printf '\n%s== %s ==%s\n' "$O" "$*" "$R"; }
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$R"; }
skip(){ printf '%s  … %s%s\n' "$D" "$*" "$R"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$R"; }
have(){ command -v "$1" >/dev/null 2>&1; }
online(){ curl -fsS -m 4 https://ollama.com >/dev/null 2>&1; }

REPO="${KLARWERK_REPO:-$HOME/Documents/dev_Klarwerk}"
INV="$REPO/docs/operations/insel-inventar"
if [ ! -d "$INV" ]; then
  warn "Inventar nicht unter $INV gefunden."
  read -r -p "Pfad zum insel-inventar-Ordner (Enter = abbrechen): " INV
  [ -z "${INV:-}" ] && exit 1
fi

h "KLARWERK Insel aufbauen"
echo "Inventar: $INV"
if online; then NETZ=1; ok "Netzzugang erkannt — echte Installation moeglich."
else NETZ=0; warn "Kein Netz (Air-Gap). Netz-Schritte werden als USB-Aufgabe markiert (KLLM-66)."; fi
FEHLT=()   # Sammelliste fuer manuelle/USB-Nacharbeit

# --- 1) Xcode Command Line Tools (fuer git/compiler) -----------------
h "Command Line Tools"
if xcode-select -p >/dev/null 2>&1; then ok "vorhanden"
else warn "fehlen — starte 'xcode-select --install' (GUI-Dialog)"; xcode-select --install 2>/dev/null || true; FEHLT+=("Xcode CLT"); fi

# --- 2) Homebrew -----------------------------------------------------
h "Homebrew"
if have brew; then ok "vorhanden ($(brew --version 2>/dev/null | head -1))"
elif [ "$NETZ" = 1 ]; then
  warn "installiere Homebrew ..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    && ok "Homebrew installiert" || { warn "Homebrew-Install fehlgeschlagen"; FEHLT+=("Homebrew"); }
  # PATH fuer Apple Silicon:
  [ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
else warn "Homebrew fehlt und kein Netz — per USB nachinstallieren."; FEHLT+=("Homebrew (USB)"); fi

# --- 3) Brew-Formeln + Casks (idempotent) ----------------------------
if have brew; then
  h "Brew-Formeln"
  if [ -s "$INV/brew-leaves.txt" ]; then
    while IFS= read -r pkg; do
      [ -z "$pkg" ] && continue
      if brew list --formula "$pkg" >/dev/null 2>&1; then skip "$pkg (schon da)"
      elif [ "$NETZ" = 1 ]; then brew install "$pkg" >/dev/null 2>&1 && ok "$pkg" || { warn "$pkg fehlgeschlagen"; FEHLT+=("brew:$pkg"); }
      else warn "$pkg fehlt (Netz noetig)"; FEHLT+=("brew:$pkg (USB)"); fi
    done < "$INV/brew-leaves.txt"
  else skip "keine Formeln im Inventar"; fi

  h "Brew-Casks"
  if [ -s "$INV/brew-casks.txt" ]; then
    while IFS= read -r c; do
      [ -z "$c" ] && continue
      if brew list --cask "$c" >/dev/null 2>&1; then skip "$c (schon da)"
      elif [ "$NETZ" = 1 ]; then brew install --cask "$c" >/dev/null 2>&1 && ok "$c" || { warn "$c fehlgeschlagen"; FEHLT+=("cask:$c"); }
      else warn "$c fehlt (Netz noetig)"; FEHLT+=("cask:$c (USB)"); fi
    done < "$INV/brew-casks.txt"
  else skip "keine Casks im Inventar"; fi
fi

# --- 4) Ollama + Modelle (inkl. bge-m3) ------------------------------
h "Ollama"
if ! have ollama; then
  if have brew && [ "$NETZ" = 1 ]; then brew install ollama >/dev/null 2>&1 && ok "Ollama installiert" || FEHLT+=("Ollama")
  else warn "Ollama fehlt — per USB/Installer nachziehen"; FEHLT+=("Ollama (USB)"); fi
else ok "Ollama vorhanden"; fi

if have ollama; then
  pgrep -x ollama >/dev/null 2>&1 || { (ollama serve >/dev/null 2>&1 &) ; sleep 2; }
  h "Ollama-Modelle"
  if [ -s "$INV/ollama-models.txt" ]; then
    while IFS= read -r m; do
      [ -z "$m" ] && continue
      if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$m"; then skip "$m (schon da)"
      elif [ "$NETZ" = 1 ]; then warn "ziehe $m ..."; ollama pull "$m" >/dev/null 2>&1 && ok "$m" || { warn "$m fehlgeschlagen"; FEHLT+=("modell:$m"); }
      else warn "$m fehlt — per signiertem USB importieren (KLLM-66)"; FEHLT+=("modell:$m (USB)"); fi
    done < "$INV/ollama-models.txt"
  else skip "keine Modelle im Inventar"; fi
fi

# --- 5) MLX-venv mit exakten Pins ------------------------------------
h "MLX (Python-venv + Pins)"
MLXVENV="$HOME/Library/Application Support/KLARWERK-Insel/mlx-venv"
BASEPY="$(command -v python3 || true)"
if [ -z "$BASEPY" ]; then warn "python3 (System/CLT) fehlt — CLT installieren, dann erneut."; FEHLT+=("python3 fuer MLX")
else
  if [ ! -x "$MLXVENV/bin/python3" ]; then
    mkdir -p "$(dirname "$MLXVENV")"
    "$BASEPY" -m venv "$MLXVENV" && ok "venv angelegt: $MLXVENV" || { warn "venv fehlgeschlagen"; FEHLT+=("MLX-venv"); }
  else ok "venv vorhanden"; fi
  if [ -x "$MLXVENV/bin/python3" ]; then
    if [ "$NETZ" = 1 ]; then
      "$MLXVENV/bin/python3" -m pip install --quiet --upgrade pip >/dev/null 2>&1
      if [ -s "$INV/mlx-requirements.txt" ]; then
        "$MLXVENV/bin/python3" -m pip install --quiet -r "$INV/mlx-requirements.txt" >/dev/null 2>&1 \
          && ok "Pins installiert (siehe mlx-requirements.txt)" || { warn "pip-Install teilweise fehlgeschlagen"; FEHLT+=("MLX-Pakete"); }
      fi
    else warn "venv steht, aber pip braucht Netz/Wheel-Cache — per USB-Wheels nachziehen."; FEHLT+=("MLX-Pakete (USB-Wheels)"); fi
  fi
fi

# --- 6) Insel-App bauen ----------------------------------------------
h "Insel-App"
BUILDER=""
for b in "$HOME/Downloads/KLARWERK-Insel/App-bauen.command" \
         "$HOME/Downloads/KLARWERK-Insel/KLARWERK-Insel-App-bauen.command" \
         "$REPO/../KLARWERK-Insel/App-bauen.command"; do
  [ -f "$b" ] && { BUILDER="$b"; break; }
done
if [ -n "$BUILDER" ]; then bash "$BUILDER" && ok "App gebaut ($BUILDER)" || FEHLT+=("Insel-App bauen")
else warn "App-bauen.command nicht gefunden — Insel-Paket bereitstellen, dann bauen."; FEHLT+=("Insel-App-Bauer"); fi

# --- 7) Schluessel (nie automatisch) ---------------------------------
h "Schluessel (Keychain)"
warn "Schluessel werden NICHT automatisch gesetzt (Sicherheit)."
echo "$D  Bitte per Insel-Schluessel-App / Schluesselbund eintragen:$R"
[ -f "$INV/keychain-referenzen.txt" ] && sed 's/^/    /' "$INV/keychain-referenzen.txt"

# --- 8) Zusammenfassung ----------------------------------------------
h "Zusammenfassung"
if [ "${#FEHLT[@]}" -eq 0 ]; then
  ok "Aufbau vollstaendig — vergleichbarer Zustand hergestellt."
else
  warn "Noch offen (${#FEHLT[@]}):"
  for f in "${FEHLT[@]}"; do echo "    - $f"; done
  echo
  echo "$D  '(USB)' = auf Air-Gap-Insel per signiertem USB-Bundle nachziehen (KLLM-66).$R"
fi
echo
echo "Danach zur Kontrolle:  bash Insel-inventarisieren.command  → Diff pruefen."
