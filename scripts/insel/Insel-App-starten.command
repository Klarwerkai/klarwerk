#!/bin/bash
# =====================================================================
# KLARWERK App — auf dem Mac Studio starten (nativ, offline, lokaler LLM)
# KLLM-61 / KLLM-62. Kein Eingriff in den App-Code: setzt nur die
# Umgebung (lokaler LLM + Datenhaltung) und faehrt den Server hoch.
# Der Server liefert die gebaute Web-App gleich mit aus (Single-Origin).
# =====================================================================
set -uo pipefail

# ---------------------------------------------------------------------
# EINSTELLUNGEN — hier umstellen, mehr ist nicht noetig
# ---------------------------------------------------------------------
BACKEND="${BACKEND:-ollama}"        # ollama  |  mlx
OLLAMA_MODELL="${OLLAMA_MODELL:-qwen3:32b}"
MLX_MODELL="${MLX_MODELL:-mlx-community/Qwen3-32B-4bit}"
PERSIST="${PERSIST:-journal}"       # journal (bleibt) | memory (frisch je Start)
PORT="${PORT:-3001}"
REPO="${KLARWERK_REPO:-$HOME/Documents/dev_Klarwerk}"
# ---------------------------------------------------------------------

O=$'\033[38;5;208m'; G=$'\033[32m'; Y=$'\033[33m'; Rd=$'\033[31m'; D=$'\033[2m'; R=$'\033[0m'
h(){ printf '\n%s== %s ==%s\n' "$O" "$*" "$R"; }
ok(){ printf '%s  ✓ %s%s\n' "$G" "$*" "$R"; }
warn(){ printf '%s  ! %s%s\n' "$Y" "$*" "$R"; }
have(){ command -v "$1" >/dev/null 2>&1; }

h "KLARWERK App starten"
[ -d "$REPO/.git" ] || { warn "Repo nicht unter $REPO"; read -r -p "Pfad zum Repo: " REPO; [ -d "$REPO/.git" ] || exit 1; }
cd "$REPO" || exit 1
echo "Repo:        $REPO"
echo "Backend:     $BACKEND"
echo "Datenhaltung: $PERSIST"
echo "Adresse:     http://127.0.0.1:$PORT"

# --- Node vorhanden? -------------------------------------------------
have node || { warn "Node.js fehlt — zuerst Insel-aufbauen.command oder 'brew install node'."; exit 1; }

# --- LLM-Backend vorbereiten -----------------------------------------
if [ "$BACKEND" = "ollama" ]; then
  h "Ollama"
  if have ollama; then
    if ! pgrep -x ollama >/dev/null 2>&1; then (ollama serve >/dev/null 2>&1 &) ; sleep 2; fi
    ok "Ollama laeuft"
    if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$OLLAMA_MODELL"; then ok "Modell $OLLAMA_MODELL vorhanden"
    else warn "Modell $OLLAMA_MODELL fehlt — ggf. 'ollama pull $OLLAMA_MODELL' (braucht Netz)."; fi
  else warn "Ollama fehlt — Insel-aufbauen.command ausfuehren."; fi
  LLM_URL="http://127.0.0.1:11434/v1"; LLM_MODELL="$OLLAMA_MODELL"
else
  h "MLX"
  if curl -fsS -m 3 "http://127.0.0.1:8080/v1/models" >/dev/null 2>&1; then ok "MLX-Server erreichbar (:8080)"
  else warn "MLX-Server nicht erreichbar auf :8080 — bitte 'KLARWERK MLX' starten."; fi
  LLM_URL="http://127.0.0.1:8080/v1"; LLM_MODELL="$MLX_MODELL"
fi

# --- Frontend gebaut? (sonst einmal bauen) ---------------------------
h "Web-Oberflaeche"
if [ -f "apps/web/dist/index.html" ]; then ok "bereits gebaut (apps/web/dist)"
else
  warn "dist fehlt — baue Frontend einmalig (npm run build in apps/web) ..."
  ( cd apps/web && npm run build ) && ok "Frontend gebaut" || { warn "Build fehlgeschlagen — 'npm install' in apps/web noetig?"; exit 1; }
fi

# --- Umgebung setzen (lokaler LLM + Datenhaltung) --------------------
h "Umgebung"
export KLARWERK_LOCAL_LLM_URL="$LLM_URL"
export KLARWERK_LOCAL_LLM_MODEL="$LLM_MODELL"
export PORT="$PORT"
unset DATABASE_URL                      # bewusst nativ/lokal, kein Postgres
if [ "$PERSIST" = "journal" ]; then export KLARWERK_DEV_PERSIST=1; ok "Journal-Persistenz aktiv (.localdb)"; else unset KLARWERK_DEV_PERSIST; ok "In-Memory (frisch je Start)"; fi
ok "Lokaler LLM: $LLM_MODELL @ $LLM_URL"
echo "$D  Hinweis: In der App unter „KI-Verwaltung“ den lokalen LLM als aktives Backend waehlen.$R"

# --- Browser oeffnen, sobald der Server lebt -------------------------
( for _ in $(seq 1 60); do
    curl -fsS -m 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && { open "http://127.0.0.1:$PORT"; break; }
    sleep 1
  done ) &

# --- Server starten (Vordergrund; Strg-C beendet) --------------------
h "Server laeuft — dieses Fenster offen lassen (Strg-C beendet)"
exec npm start
