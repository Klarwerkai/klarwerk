#!/usr/bin/env bash
# Täglicher nativer PostgreSQL-Betrieb: vorhandener Backup- und Verschlüsselungsweg,
# danach Übertragung auf einen anderen Host und Rücklesung dieser echten Zweitkopie.
set -euo pipefail
umask 077
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
KONFIG="${1:?Pfad der Betreiberkonfiguration angeben}"
# Die Konfiguration ist eine vom Betreiber verwaltete Shell-Datei, keine Nutzereingabe.
source "$KONFIG"
: "${DATABASE_URL:?}" "${ARBEIT:?}" "${VERSCHLUESSELT:?}" "${ZWEITHOST:?}" "${ZWEITPFAD:?}"
: "${SSH_KONFIG:?}" "${AUSLAGERUNG_SCHLUESSEL:?}" "${HEALTH_URL:?}" "${PROJEKT:?}"
[[ "$ZWEITHOST" =~ ^[a-zA-Z0-9._-]+$ ]] && [[ "$ZWEITPFAD" =~ ^/[a-zA-Z0-9/_.-]+$ ]]
mkdir -p "$ARBEIT/belege" "$ARBEIT/sicherungen"
exec 9>"$ARBEIT/taeglich.lock"
flock -n 9 || { echo '[sicherung] Ein täglicher Lauf ist noch aktiv.' >&2; exit 1; }
START="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LAUF="$(date -u +%Y%m%dT%H%M%SZ)"
BELEG="$ARBEIT/belege/$LAUF.json"
TMP="$(mktemp -d "$ARBEIT/.lauf.XXXXXX")"
abschluss() {
  local code=$?
  python3 - "$BELEG" "$START" "$code" "$LAUF" <<'PY'
import datetime,json,os,sys
p,start,code,run=sys.argv[1:]
d=json.load(open(p)) if os.path.exists(p) else {'lauf':run,'gestartet':start}
d.update(beendet=datetime.datetime.now(datetime.timezone.utc).isoformat(),exit=int(code))
with open(p+'.tmp','w') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
os.replace(p+'.tmp',p)
with open(os.path.join(os.path.dirname(os.path.dirname(p)),'letzter-lauf.json')+'.tmp','w') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
os.replace(os.path.join(os.path.dirname(os.path.dirname(p)),'letzter-lauf.json')+'.tmp',os.path.join(os.path.dirname(os.path.dirname(p)),'letzter-lauf.json'))
PY
  rm -rf "$TMP"
}
trap abschluss EXIT
export DATABASE_URL BACKUP_KEEP="${BACKUP_KEEP:-14}"
# Versionsaufnahme vor und nach pg_dump; bei einem gleichzeitigen Deploy keine falsche Herkunft.
curl --fail --silent --show-error --connect-timeout 10 --max-time 30 "$HEALTH_URL" >"$TMP/health-vorher.json"
python3 "$WURZEL/scripts/backup/datenstand.py" sichern "$TMP/bestand.json" "$ARBEIT/sicherungen" >"$TMP/backup.log" 2>&1
cat "$TMP/backup.log"
DUMP="$(sed -n 's/^\[backup\] Dump nach: //p' "$TMP/backup.log" | head -n1)"
test -f "$DUMP"
curl --fail --silent --show-error --connect-timeout 10 --max-time 30 "$HEALTH_URL" >"$TMP/health-nachher.json"
psql -X -v ON_ERROR_STOP=1 -tAc 'SELECT system_identifier FROM pg_control_system()' >"$TMP/systemkennung"
python3 - "$DUMP" "$TMP" "$START" "$PROJEKT" "$ARBEIT/instanz.id" <<'PY'
import datetime,hashlib,json,os,sys,uuid
dump,tmp,start,project,identity=sys.argv[1:]
if not os.path.exists(identity):
    with open(identity,'x') as f:f.write('klarwerk-instanz-'+str(uuid.uuid4())+'\n')
before=json.load(open(tmp+'/health-vorher.json'));after=json.load(open(tmp+'/health-nachher.json'))
if before.get('status')!='ok' or after.get('status')!='ok':raise SystemExit('Live-Anwendung ist nicht gesund')
if before.get('commit')!=after.get('commit'):raise SystemExit('Anwendungsstand wechselte während der Sicherung; erneut sichern')
sha=hashlib.file_digest(open(dump,'rb'),'sha256').hexdigest()
d={'instanz_id':open(identity).read().strip(),'projekt':project,'datenbank':os.environ.get('PGDATABASE','klarwerk'),
   'db_systemkennung':open(tmp+'/systemkennung').read().strip(),'anwendung_health':after,
   'dump':os.path.basename(dump),'sha256':sha,'sicherungsbeginn':start,
   'zeit':datetime.datetime.now(datetime.timezone.utc).isoformat(),
   'weg':'scripts/backup/backup.sh, nativer pg_dump, konsistenter PostgreSQL-Snapshot',
   'datenstand':json.load(open(tmp+'/bestand.json'))}
with open(dump+'.herkunft.json','w') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
from pathlib import Path
for previous in Path(dump).parent.glob('klarwerk-*.dump.herkunft.json'):
    if not Path(str(previous).removesuffix('.herkunft.json')).exists():previous.unlink()
PY
export ARBEIT PROJEKT AUSLAGERUNG_SCHLUESSEL
export STACK="$WURZEL" BELEGE="$ARBEIT/belege" B3_LAUF="$LAUF"
export SICHERUNGSZIEL="$ARBEIT/sicherungen" ZWEITER_ORT="$VERSCHLUESSELT"
export AUSLAGERUNG_TAGE="${AUSLAGERUNG_TAGE:-14}" AUSLAGERUNG_WOCHEN="${AUSLAGERUNG_WOCHEN:-8}" AUSLAGERUNG_MONATE="${AUSLAGERUNG_MONATE:-12}"
bash "$WURZEL/scripts/backup/compose-drill.sh" auslagern "$DUMP"
# VERSCHLUESSELT ist nur die Arbeitsablage. Erst die Rücklesung vom Zweithost zählt.
rsync -a --checksum --delete -e "ssh -F $SSH_KONFIG" "$VERSCHLUESSELT/" "$ZWEITHOST:$ZWEITPFAD/"
NAME="$(basename "$DUMP").tar.enc"
rsync -a -e "ssh -F $SSH_KONFIG" "$ZWEITHOST:$ZWEITPFAD/tage/$NAME" "$ZWEITHOST:$ZWEITPFAD/tage/$NAME.sha256" "$TMP/"
(cd "$TMP" && sha256sum -c "$NAME.sha256")
test "$(sha256sum "$TMP/$NAME" | cut -d' ' -f1)" = "$(sha256sum "$VERSCHLUESSELT/tage/$NAME" | cut -d' ' -f1)"
mkdir "$TMP/ruecklesung"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$AUSLAGERUNG_SCHLUESSEL" -in "$TMP/$NAME" | tar -xf - -C "$TMP/ruecklesung"
cmp "$DUMP" "$TMP/ruecklesung/$(basename "$DUMP")"
cmp "$DUMP.herkunft.json" "$TMP/ruecklesung/$(basename "$DUMP").herkunft.json"
python3 - "$BELEG" "$DUMP" "$TMP/$NAME" "$ZWEITHOST" "$ZWEITPFAD" "$START" <<'PY'
import hashlib,json,os,sys
proof,dump,encrypted,host,path,start=sys.argv[1:]
d={'gestartet':start,'herkunft':json.load(open(dump+'.herkunft.json')),'dump_bytes':os.path.getsize(dump),
   'zweithost':host,'zweitpfad':path,'datei':os.path.basename(encrypted),
   'sha256_verschluesselt':hashlib.file_digest(open(encrypted,'rb'),'sha256').hexdigest(),
   'ruecklesung_vom_zweithost':'verschlüsseltes Paket und entschlüsselter Dump samt Herkunft bytegleich',
   'rpo_ziel_sekunden':None,'rto_ziel_sekunden':None}
with open(proof,'w') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
PY
echo "[sicherung] Verschlüsselte Sicherung auf $ZWEITHOST:$ZWEITPFAD übertragen und zurückgelesen."
