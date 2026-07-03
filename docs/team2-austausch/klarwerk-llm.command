#!/bin/bash
# KLARWERK LLM — Ein-Klick-Routine (KLLM-57/61, Pedi 02.07.):
# Erstellt den UpCloud-GPU-Server (exakt die dokumentierte Konfiguration), installiert
# vLLM, lädt das gepinnte Modell AUF dem Server und verbindet den Mac per SSH-Tunnel.
# Sichtbar im Terminal (Sync-Muster, kein TCC-Ärger). Aktionen: Starten · Status · Diagnose · Löschen.
#
# Änderung 03.07. ([Cloud-Worker], Eval-Sitzung 1): neue Aktion „Diagnose" — Modell wurde nach
# >28 Min nicht bereit; Diagnose zeigt per SSH Platte/Container/vLLM-Log/GPU (Verdacht: 50-GB-Disk).
# Dafür Aktionsauswahl von 3-Button-Dialog auf Listen-Auswahl umgestellt (macOS-Dialog kann max. 3 Knöpfe).
# Änderung 03.07. v2 (nach Diagnose-Befund: Disk 100% voll, Download bei 6,3/20 GB gestorben):
# (1) Fern-Einrichtung wächst nach einem Hub-Storage-Resize Partition+Dateisystem defensiv mit
#     (growpart/resize2fs — no-op, wenn schon passend) und bricht EHRLICH ab, wenn <25 GB frei sind.
# (2) Status-Aktion: „000000"-Doppelausgabe behoben (curl -w Fallback).
#
# Sicherheit: LLM-API lauscht NUR auf localhost des Servers; Zugriff ausschließlich über
# den SSH-Tunnel (lokal http://localhost:8123/v1). API-Zugang nur im macOS-Schlüsselbund.

set -u
ZONE="fi-hel2"
TITLE="klarwerk-llm-eval"
PLAN_MATCH="L40S"; PLAN_CORES=8
STORAGE_GB=200
MODEL="${KLARWERK_LLM_MODEL:-Qwen/Qwen3-32B-AWQ}"
KEYDIR="$HOME/Documents/Klarwerk/llm-eval-zugang"
SSHKEY="$KEYDIR/id_ed25519"
TUNNEL_PORT=8123
API="https://api.upcloud.com/1.3"
KC_SVC="KLARWERK-UpCloud-API"; KC_ACC="team2"
GRUEN=$'\033[32m'; ROT=$'\033[31m'; GELB=$'\033[33m'; FETT=$'\033[1m'; AUS=$'\033[0m'

sag() { echo "${FETT}▶ $1${AUS}"; }
gut() { echo "${GRUEN}✓ $1${AUS}"; }
warn() { echo "${GELB}! $1${AUS}"; }
ende() { echo "${ROT}✗ $1${AUS}"; read -r -p "Enter zum Schließen …"; exit 1; }

# --- Zugangsdaten (Schlüsselbund; Erststart fragt per Dialog) -------------------------
CRED="$(/usr/bin/security find-generic-password -s "$KC_SVC" -a "$KC_ACC" -w 2>/dev/null || true)"
if [ -z "$CRED" ]; then
  CRED="$(/usr/bin/osascript -e 'text returned of (display dialog "UpCloud-API-Zugang eintragen.\n\nEntweder API-Token (Control Panel → Account → API tokens, beginnt mit ucat_)\nODER  benutzername:passwort  des UpCloud-Kontos.\n\nWird sicher im macOS-Schlüsselbund gespeichert." with title "KLARWERK LLM" default answer "" with hidden answer buttons {"Abbrechen","Speichern"} default button 2)' 2>/dev/null || true)"
  [ -n "$CRED" ] || ende "Kein API-Zugang eingetragen."
  /usr/bin/security add-generic-password -U -s "$KC_SVC" -a "$KC_ACC" -w "$CRED" >/dev/null 2>&1
fi
if [[ "$CRED" == *:* && "$CRED" != ucat_* ]]; then AUTH=(-u "$CRED"); else AUTH=(-H "Authorization: Bearer $CRED"); fi

api() { # METHOD PATH [JSON]
  local m="$1" p="$2" d="${3:-}"
  if [ -n "$d" ]; then curl -sS -X "$m" "${AUTH[@]}" -H "Content-Type: application/json" -d "$d" "$API$p"
  else curl -sS -X "$m" "${AUTH[@]}" "$API$p"; fi
}
jget() { python3 -c "import sys,json;d=json.load(sys.stdin);exec(sys.argv[1])" "$1" 2>/dev/null; }

[ -f "$SSHKEY" ] || ende "SSH-Schlüssel fehlt: $SSHKEY (wurde am 02.07. erzeugt — Ordner llm-eval-zugang prüfen)."
SSH=(ssh -i "$SSHKEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes)

server_json() { api GET /server; }
find_uuid()  { server_json | jget "print(next((s['uuid'] for s in d['servers']['server'] if s['title']=='$TITLE'),''))"; }
srv_state()  { api GET "/server/$1" | jget "print(d['server']['state'])"; }
srv_ip()     { api GET "/server/$1" | jget "print(next((i['address'] for i in d['server']['ip_addresses']['ip_address'] if i['access']=='public' and i['family']=='IPv4'),''))"; }

kill_tunnel() { pkill -f "ssh .*-L $TUNNEL_PORT:127.0.0.1:8000" 2>/dev/null && warn "Alter Tunnel beendet." || true; }

aktion_start() {
  UUID="$(find_uuid)"
  if [ -z "$UUID" ]; then
    sag "Server existiert nicht — erstelle ihn (Konfiguration laut KLLM-57) …"
    PLAN="$(api GET /plan | jget "print(next((p['name'] for p in d['plans']['plan'] if '$PLAN_MATCH' in p['name'] and int(p.get('core_number',0))==$PLAN_CORES),''))")"
    [ -n "$PLAN" ] || ende "Kein passender $PLAN_MATCH-Plan mit $PLAN_CORES Cores gefunden (GPU-Limit aktiv? Kapazität?)."
    gut "Plan: $PLAN"
    TPL="$(api GET /storage/template | jget "print(next((s['uuid'] for s in d['storages']['storage'] if 'NVIDIA' in s['title'] and '24.04' in s['title']),''))")"
    [ -n "$TPL" ] || ende "Ubuntu-24.04-NVIDIA-Template nicht gefunden."
    gut "Template: $TPL"
    PUB="$(cat "$SSHKEY.pub")"
    BODY="$(python3 - "$PLAN" "$TPL" "$PUB" <<'PY'
import json,sys
plan,tpl,pub=sys.argv[1],sys.argv[2],sys.argv[3]
print(json.dumps({"server":{"zone":"fi-hel2","title":"klarwerk-llm-eval","hostname":"klarwerk-llm-eval",
 "plan":plan,"metadata":"yes",
 "storage_devices":{"storage_device":[{"action":"clone","storage":tpl,"title":"klarwerk-llm-eval","size":200,"tier":"maxiops"}]},
 "login_user":{"username":"root","create_password":"no","ssh_keys":{"ssh_key":[pub]}}}}))
PY
)"
    RES="$(api POST /server "$BODY")"
    UUID="$(echo "$RES" | jget "print(d['server']['uuid'])")"
    [ -n "$UUID" ] || ende "Server-Erstellung fehlgeschlagen: $(echo "$RES" | head -c 400)"
    gut "Server angelegt: $UUID"
  else
    gut "Server existiert: $UUID"
    if [ "$(srv_state "$UUID")" = "stopped" ]; then sag "Starte Server …"; api POST "/server/$UUID/start" >/dev/null; fi
  fi

  sag "Warte auf Start + IP …"
  for _ in $(seq 1 60); do ST="$(srv_state "$UUID")"; [ "$ST" = "started" ] && break; printf '.'; sleep 5; done; echo
  [ "$(srv_state "$UUID")" = "started" ] || ende "Server startet nicht (Status: $(srv_state "$UUID"))."
  IP="$(srv_ip "$UUID")"; [ -n "$IP" ] || ende "Keine öffentliche IPv4 gefunden."
  gut "Server läuft: $IP"

  sag "Richte vLLM ein + lade Modell $MODEL (erster Lauf: 10–30 Min Download im Rechenzentrum) …"
  "${SSH[@]}" "root@$IP" MODEL="$MODEL" 'bash -s' <<'REMOTE' || ende "Fern-Einrichtung fehlgeschlagen (SSH/Netz prüfen)."
set -e
command -v nvidia-smi >/dev/null || { echo "nvidia-smi fehlt — falsches Template?"; exit 1; }
# v2: nach Hub-Storage-Resize Partition + Dateisystem mitwachsen lassen (no-op, wenn passend);
# danach ehrlicher Platz-Check — unter 25 GB frei scheitert der Modell-Download ohnehin.
command -v growpart >/dev/null 2>&1 && growpart /dev/vda 2 >/dev/null 2>&1 || true
resize2fs /dev/vda2 >/dev/null 2>&1 || true
FREI_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
echo "Platte: ${FREI_GB} GB frei ($(df -h --output=size,pcent / | tail -1 | xargs))"
if [ "${FREI_GB:-0}" -lt 25 ]; then
  echo "FEHLER: Nur ${FREI_GB} GB frei — Modell-Download braucht ~20 GB. Storage im UpCloud-Hub vergrößern (Stop → Resize → Start), dann erneut Starten."
  exit 1
fi
if ! command -v docker >/dev/null; then
  apt-get update -qq && apt-get install -y -qq docker.io curl >/dev/null
fi
if ! docker info 2>/dev/null | grep -qi nvidia; then
  command -v nvidia-ctk >/dev/null && { nvidia-ctk runtime configure --runtime=docker >/dev/null 2>&1 || true; systemctl restart docker; } || true
fi
docker rm -f vllm >/dev/null 2>&1 || true
docker run -d --restart unless-stopped --gpus all --name vllm \
  -p 127.0.0.1:8000:8000 -v /root/hf:/root/.cache/huggingface \
  vllm/vllm-openai:latest --model "$MODEL" --max-model-len 16384 --gpu-memory-utilization 0.92 >/dev/null
echo "vLLM-Container gestartet — Modell lädt im Hintergrund."
REMOTE

  sag "Warte, bis das Modell antwortet (Abbruch mit Ctrl+C tut dem Server nichts) …"
  READY=0
  for i in $(seq 1 90); do
    if "${SSH[@]}" "root@$IP" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/v1/models" 2>/dev/null | grep -q 200; then READY=1; break; fi
    printf '.'; sleep 20
  done; echo
  if [ "$READY" != "1" ]; then
    warn "Modell nach 30 Min nicht bereit — das ist NICHT normal. Bitte App erneut starten und Aktion „Diagnose“ wählen (prüft Platte/Container/Log)."
  fi

  kill_tunnel
  sag "Öffne Tunnel: localhost:$TUNNEL_PORT → Server …"
  ssh -i "$SSHKEY" -o StrictHostKeyChecking=accept-new -f -N -o ExitOnForwardFailure=yes -L "$TUNNEL_PORT:127.0.0.1:8000" "root@$IP" || ende "Tunnel fehlgeschlagen."
  gut "FERTIG. Endpunkt für die KLARWERK-App: http://localhost:$TUNNEL_PORT/v1 · Modell: $MODEL"
  /usr/bin/osascript -e "display dialog \"KLARWERK LLM läuft.\n\nEndpunkt: http://localhost:$TUNNEL_PORT/v1\nModell: $MODEL\nServer: $IP (läuft — 1,11 €/h bis zum Löschen!)\" with title \"KLARWERK LLM\" buttons {\"OK\"} default button 1" >/dev/null 2>&1
}

aktion_status() {
  UUID="$(find_uuid)"
  if [ -z "$UUID" ]; then warn "Kein Server vorhanden (es entstehen keine Kosten)."; else
    ST="$(srv_state "$UUID")"; IP="$(srv_ip "$UUID")"
    echo "Server: $ST · IP: ${IP:-—} · Kosten laufen: $([ "$ST" = "started" ] && echo JA || echo storage-only)"
    CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$TUNNEL_PORT/v1/models" 2>/dev/null)"; CODE="${CODE:-000}"
    [ "$CODE" = "200" ] && gut "Tunnel + Modell antworten (http://localhost:$TUNNEL_PORT/v1)." || warn "Lokaler Endpunkt antwortet nicht (Code $CODE) — ggf. 'Starten' oder 'Diagnose' ausführen."
  fi
}

# NEU 03.07. ([Cloud-Worker]): ehrliche Ferndiagnose, wenn das Modell nicht bereit wird.
# Zeigt Platte, Speicher, GPU, Container-Zustand, Modell-Cache-Größe und die letzten vLLM-Logzeilen.
# NUR lesend — ändert nichts am Server. Ausgabe bitte komplett an die Claude-Session geben.
aktion_diagnose() {
  UUID="$(find_uuid)"; [ -n "$UUID" ] || { warn "Kein Server vorhanden — nichts zu diagnostizieren."; return; }
  IP="$(srv_ip "$UUID")"; [ -n "$IP" ] || { warn "Keine IP gefunden (Server-Status: $(srv_state "$UUID"))."; return; }
  sag "Diagnose auf $IP (nur lesend) …"
  "${SSH[@]}" "root@$IP" 'bash -s' <<'REMOTE' || warn "Diagnose per SSH fehlgeschlagen (Netz/Key prüfen)."
echo "===== PLATTE (df -h /) ====="
df -h / || true
echo
echo "===== SPEICHER (free -h) ====="
free -h || true
echo
echo "===== GPU (nvidia-smi, Kurzform) ====="
nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv 2>/dev/null || nvidia-smi || true
echo
echo "===== DOCKER-CONTAINER (docker ps -a) ====="
docker ps -a || true
echo
echo "===== MODELL-CACHE (du -sh /root/hf) ====="
du -sh /root/hf 2>/dev/null || echo "(noch kein Cache)"
echo
echo "===== vLLM-LOG (letzte 60 Zeilen) ====="
docker logs --tail 60 vllm 2>&1 || echo "(Container vllm nicht gefunden)"
REMOTE
  echo
  warn "Diagnose-Ausgabe bitte KOMPLETT kopieren und an die Claude-Session geben."
}

aktion_loeschen() {
  UUID="$(find_uuid)"; [ -n "$UUID" ] || { warn "Kein Server vorhanden — nichts zu löschen."; return; }
  A="$(/usr/bin/osascript -e 'button returned of (display dialog "Server WIRKLICH löschen? Alle Daten auf dem Server gehen verloren (Modell-Cache wird beim nächsten Start neu geladen). Abrechnung endet." with title "KLARWERK LLM" buttons {"Abbrechen","Löschen"} default button 1 with icon caution)' 2>/dev/null || true)"
  [ "$A" = "Löschen" ] || { warn "Abgebrochen."; return; }
  kill_tunnel
  sag "Stoppe Server …"; api POST "/server/$UUID/stop" '{"stop_server":{"stop_type":"hard"}}' >/dev/null
  for _ in $(seq 1 30); do [ "$(srv_state "$UUID")" = "stopped" ] && break; printf '.'; sleep 4; done; echo
  sag "Lösche Server + Storage …"; api DELETE "/server/$UUID?storages=1&backups=delete" >/dev/null
  gut "Gelöscht — es laufen keine Kosten mehr."
}

echo "${FETT}KLARWERK LLM — $(date '+%d.%m.%Y %H:%M')${AUS} · Modell: $MODEL"
# 03.07.: Listen-Auswahl statt 3-Button-Dialog (Dialoge können max. 3 Knöpfe; jetzt 4 Aktionen).
WAHL="$(/usr/bin/osascript -e 'choose from list {"Starten","Status","Diagnose","Löschen"} with title "KLARWERK LLM" with prompt "Was soll passieren?\n\nStarten = Server erstellen/starten, vLLM + Modell einrichten, Tunnel verbinden.\nStatus = nur nachsehen.\nDiagnose = Platte/Container/Log prüfen (nur lesend).\nLöschen = Server komplett entfernen (Kosten-Stopp)." default items {"Status"}' 2>/dev/null || echo Status)"
[ "$WAHL" = "false" ] && WAHL="Status"
case "$WAHL" in
  Starten)  aktion_start ;;
  Status)   aktion_status ;;
  Diagnose) aktion_diagnose ;;
  Löschen)  aktion_loeschen ;;
esac
echo; read -r -p "Enter zum Schließen …"
