#!/usr/bin/env bash
# SCRUM-469 / MEGA-BATCH-1 WP7 (S1) — Backup-Helper: pg_dump-Wrapper. Liest die DB-URL aus der Umgebung
# und schreibt ein ZEITGESTEMPELTES Dump-File. KEINE Runtime-Integration (rein manuell/Cron/Coolify).
#
# Nutzung:
#   DATABASE_URL=postgres://user:pass@host:5432/db  ./scripts/backup/backup.sh [ZIEL-VERZEICHNIS]
# Standard-Zielverzeichnis: ./backups (per BACKUP_DIR überschreibbar).
# Aufbewahrung: BACKUP_KEEP=<n≥1> behält höchstens n vollständige Sicherungen. NICHT gesetzt =
# es wird nichts gelöscht (heutiges Verhalten; bestehende Installationen verlieren kein Backup).
# Der Wert wird dezimal gelesen, auch mit führender Null: BACKUP_KEEP=08 heisst acht.
#
# Sicherheit: die DB-URL wird NICHT geloggt/ausgegeben. Ohne DATABASE_URL (bzw. KLARWERK_DATABASE_URL)
# bricht das Skript ab, statt gegen eine falsche DB zu laufen.
#
# EXITCODES (dieselben wie in scripts/backup/RESTORE.md):
#   0  Sicherung veroeffentlicht
#   1  Aufruf-/Umgebungsfehler: keine DB-URL, pg_dump fehlt, BACKUP_KEEP ungueltig,
#      Zielverzeichnis nicht anlegbar. Ein FEHLENDES pg_restore ist KEIN Abbruchgrund (siehe unten).
#   3  kein Hashwerkzeug — ohne Pruefsumme wird nichts veroeffentlicht
#   5  der Endname ist belegt UND kein freier Ausweichname (_02 bis _99) zu haben — dieser Lauf
#      veroeffentlicht nichts und laesst den vorhandenen Bestand bytegleich liegen
#   4  der erzeugte Dump ist nicht lesbar — es wird nichts veroeffentlicht. Geprueft hat das
#      entweder `pg_restore --list` oder, wo das fehlt, die Ersatzpruefung (zwei vollstaendige
#      Lesungen). WELCHE von beiden lief, steht in der Ausgabe und in letzter-lauf.json.
#   sonst  der Exitcode des fehlgeschlagenen Werkzeugs (pg_dump, shasum, date, sort, mv, …). JEDER
#          dieser Ausgaenge hinterlegt eine Fehlerspur; dafuer sorgt `abschluss` weiter unten. Kommt
#          der Fehler NACH der Veroeffentlichung, sagt die Spur das — die Sicherung liegt dann da
#          und bleibt gueltig, nur der Lauf ist nicht zu Ende gekommen.
#
# MESSGRENZE, ausdruecklich (JOB 4057) — ZWEI STUFEN, und jeder Lauf sagt, welche er hatte:
#   `pg_restore --list` belegt, dass das ARCHIV LESBAR ist (Header und Inhaltsverzeichnis).
#   Die ERSATZPRUEFUNG (ohne pg_restore) belegt nur, dass die DATEI vollstaendig lesbar und nicht
#   leer ist — ueber das Archivformat sagt sie NICHTS.
# Keine von beiden belegt, dass ein Restore in eine echte Datenbank gelingt. Diesen Nachweis fuehrt
# allein der Drill (`scripts/backup/restore-drill.sh`).
set -euo pipefail

# ==================================================================================================
# JOB 4057 — DAS ZIELVERZEICHNIS ENTSTEHT ZUERST. Es ist der Ort der Ergebnisspur.
# ==================================================================================================
#
# Vorher stand dieser Block NACH den Umgebungspruefungen. Folge: ein Abbruch wegen fehlender DB-URL
# oder fehlendem pg_dump konnte NICHTS hinterlegen — er endete in einem Cron-Log, das niemand liest.
# Im Sicherungsverzeichnis war „gestern ist die Sicherung gescheitert" nicht von „gestern lief kein
# Cron" zu unterscheiden. Beides sah gleich aus: die juengste Datei ist von vorgestern.
#
# Es ist eine reine Umstellung der REIHENFOLGE. WURZEL, die Auflösung von $1 und BACKUP_DIR bleiben
# zeichengleich — der CWD-Vertrag unten gilt unveraendert.
#
# CWD-VERTRAG (JOB 943): Das Standardziel `./backups` war RELATIV zum Aufrufort. Wer dieses
# Skript aus einem anderen Verzeichnis startet — Cron, Coolify, ein Terminal irgendwo —, legte
# sein Backup dort ab und bekam trotzdem "fertig" gemeldet. Bei einem Backup ist das die
# gefaehrlichste Sorte Fehler: Man glaubt, eines zu haben. Der Vertragspruefer
# (`tools/check-cwd-contract.mjs`) hat genau das gefunden.
#
# Die Wurzel wird aus dem Skriptpfad abgeleitet, NICHT per `cd`: Ein `cd` wuerde auch ein
# relativ uebergebenes Zielverzeichnis ($1) anders aufloesen und damit das Verhalten fuer
# Aufrufer aendern, die es heute richtig benutzen. Nur der Standard wird absolut.
WURZEL="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="${1:-${BACKUP_DIR:-$WURZEL/backups}}"
ERGEBNIS="$DEST/letzter-lauf.json"
if ! mkdir -p "$DEST" 2>/dev/null; then
  echo "[backup] ABBRUCH: Zielverzeichnis '$DEST' ist nicht anlegbar." >&2
  echo "[backup] Es konnte KEIN Ergebnis hinterlegt werden ($ERGEBNIS) — dieser Lauf hat nichts" >&2
  echo "[backup] gesichert. Eine Erfolgsmeldung gibt es hier nicht." >&2
  exit 1
fi

# --------------------------------------------------------------------------------------------------
# DIE ERGEBNISSPUR. Jeder Ausgang schreibt sie, der gescheiterte zuerst.
# --------------------------------------------------------------------------------------------------
# Genau sieben Felder: zeit, ergebnis, grund, exitcode, datei, bytes, sha256.
#
# WAS IN datei/bytes/sha256 STEHT, RICHTET SICH NACH DEM DATEIBESTAND — nicht nach dem Ausgang:
#   · Fehlschlag OHNE Veroeffentlichung: alle drei `null`. Es gibt keine Datei, also keinen Wert.
#     NIEMALS ein Teilwert, der wie ein Erfolg aussieht.
#   · Fehlschlag NACH der Veroeffentlichung (`sort` scheitert in der Aufbewahrung, BEN R2): alle
#     drei GEFUELLT, denn die Datei liegt da, gelesen und beglaubigt. `ergebnis` bleibt `"fehler"`
#     — der LAUF ist gescheitert —, aber die Spur bestreitet die Sicherung nicht, die es gibt.
#     Eine vorhandene Sicherung zu leugnen ist derselbe Schaden wie eine zu erfinden.
#   · `zeit` ist `null`, wenn `date` selbst ausfaellt: dann ist die Zeit unbekannt, und der `grund`
#     sagt das. Ein Platzhalter waere eine erfundene Uhrzeit.
#
# WAS DIE DATEI NICHT SAGT: „aktuell", „alles in Ordnung" oder „eine Sicherung ist vorhanden". Sie
# sagt ausschliesslich, was der LETZTE LAUF getan hat, mit seinem Zeitstempel. Ob eine brauchbare
# Sicherung existiert, beantwortet das VERZEICHNIS. Fehlt die Datei, hat nie ein Lauf ein Ergebnis
# hinterlegt — das ist NICHT dasselbe wie „in Ordnung".
#
# DIE DB-URL STEHT NIE DARIN. Kein `grund` traegt sie, keine Ausgabe traegt sie (Kopf :11-12).
#
# ATOMAR: eigener Arbeitsname im SELBEN Verzeichnis, dann `mv`. Ein gleichzeitig lesender
# Betrachter sieht immer einen vollstaendigen Datensatz — entweder den alten oder den neuen, nie
# einen halben. (Dieselbe Bedingung wie bei der Veroeffentlichung: `rename(2)` ist nur innerhalb
# eines Dateisystems atomar.)
json_wert() { # "" -> null, sonst ein JSON-String mit maskierten Sonderzeichen
  if [ -z "${1:-}" ]; then
    printf 'null'
    return 0
  fi
  local text="$1"
  text="${text//\\/\\\\}"
  text="${text//\"/\\\"}"
  printf '"%s"' "$text"
}

ERGEBNIS_GEMELDET=nein

# KEIN UNGESCHUETZTER WERKZEUGAUFRUF IN DIESER FUNKTION — der Befund von BEN R2 (Korrekturpflicht 1).
#
# GEMESSEN: ein Erfolgslauf, danach ein Lauf mit `date` Exit 7. Der Ergebnisschreiber ruft `date`
# SELBST auf. Er stand hinter der Markierung „gemeldet", und `set -euo pipefail` beendete ihn genau
# dort: keine neue Spur, kein Hinweis — und das Sicherheitsnetz unten hielt sich fuer erledigt. Im
# Verzeichnis blieb die ERFOLGSSPUR DES VORTAGS BYTEGLEICH stehen. Das Netz zerriss an seinem
# eigenen Werkzeug, also genau dort, wo es tragen muss.
#
# ZWEI REGELN FOLGEN DARAUS, und sie gelten fuer jede kuenftige Zeile hier drin:
#   1. Jeder Werkzeugaufruf steht in einer `if`-Bedingung — dort greift `set -e` nicht, und der
#      Fehlschlag wird zu einem Zweig statt zu einem Abbruch.
#   2. `ERGEBNIS_GEMELDET=ja` faellt ERST, wenn wirklich etwas gemeldet ist: die Datei liegt, oder
#      der Hinweis „KEIN Ergebnis hinterlegt" ist heraus. Vorher waere es eine Zusage auf Kredit.
#
# Faellt `date` aus, ist die Zeit UNBEKANNT und steht als `null` da, mit dem Grund daneben. Ein
# Platzhalter waere eine erfundene Uhrzeit — Wissensluecke statt Erfindung.
ergebnis_hinterlegen() { # <erfolg|fehler> <grund> <exitcode> <endname|""> <bytes|""> <sha256|"">
  local arbeit="$DEST/.letzter-lauf.json.$$"
  local grund="$2"
  local zeit=""
  if ! zeit="$(date -u +%Y%m%dT%H%M%SZ 2>/dev/null)"; then
    zeit=""
    grund="${grund} Zeitstempel unbekannt: date ist fehlgeschlagen."
  fi
  if {
    printf '{\n'
    printf '  "zeit": %s,\n' "$(json_wert "$zeit")"
    printf '  "ergebnis": "%s",\n' "$1"
    printf '  "grund": %s,\n' "$(json_wert "$grund")"
    printf '  "exitcode": %s,\n' "$3"
    printf '  "datei": %s,\n' "$(json_wert "$4")"
    printf '  "bytes": %s,\n' "${5:-null}"
    printf '  "sha256": %s\n' "$(json_wert "$6")"
    printf '}\n'
  } >"$arbeit" 2>/dev/null && mv "$arbeit" "$ERGEBNIS" 2>/dev/null; then
    ERGEBNIS_GEMELDET=ja
    return 0
  fi
  rm -f "$arbeit" 2>/dev/null || true
  echo "[backup] HINWEIS: Es konnte KEIN Ergebnis hinterlegt werden ($ERGEBNIS)." >&2
  ERGEBNIS_GEMELDET=ja
  return 0
}

# ==================================================================================================
# DAS SICHERHEITSNETZ (BEN R1, Korrekturpflicht 2) — KEIN AUSGANG OHNE SPUR.
# ==================================================================================================
#
# DER BEFUND, der diesen Block erzwungen hat: Ein VORHANDENES Werkzeug, das FEHLSCHLAEGT, war nicht
# abgedeckt. Gemessen von BEN: `shasum` existiert, endet aber mit Exit 7. `set -euo pipefail`
# beendete das Skript sofort — vor jedem `ergebnis_hinterlegen`. Im Zielverzeichnis blieb damit die
# ERFOLGSSPUR DES VORTAGS stehen: `"ergebnis": "erfolg"`, `"exitcode": 0`. Der Betreiber sah „letzter
# Lauf erfolgreich", obwohl der letzte Lauf gescheitert war und nichts veroeffentlicht hatte. Das ist
# genau die Taeuschung, gegen die dieses Paket gebaut ist — nur eine Ebene tiefer als gedacht.
#
# EINE AUFZAEHLUNG VON FEHLERSTELLEN KANN DAS NICHT LOESEN. Jede kuenftige Zeile waere eine neue
# Luecke (`mv`, `wc`, `date`, `awk`, ein voller Datentraeger). Deshalb haengt die Spur nicht an den
# bekannten Abbruechen, sondern am AUSGANG des Prozesses: was auch immer das Skript beendet, hier
# kommt es vorbei.
#
# Der `trap` ersetzt zugleich die alte Aufraeum-Falle fuer den Arbeitsstand (JOB 517) — beides muss
# in EINER Falle stehen, denn ein zweites `trap … EXIT` wuerde das erste ersetzen, nicht ergaenzen.
#
# DIE FALLE FRAGT NACH DEM ERREICHTEN ZUSTAND — der zweite Befund von BEN R2 (Korrekturpflicht 2).
#
# GEMESSEN: `BACKUP_KEEP=1` und `sort` mit Exit 9. `sort` steht in der Aufbewahrung, also NACH der
# Veroeffentlichung. Dump und Sidecar lagen vollstaendig und gueltig im Verzeichnis — und die Spur
# sagte „es wurde nichts veroeffentlicht". Eine vorhandene Sicherung zu bestreiten richtet denselben
# Schaden an wie eine zu behaupten, die es nicht gibt: der Betreiber haelt sich fuer ungesichert.
#
# Deshalb steht hier kein fester Satz mehr, sondern die Frage nach `VEROEFFENTLICHT`. Die Antwort
# kommt aus dem Ablauf selbst (Zeile bei der Veroeffentlichung), nicht aus einer Vermutung.
VEROEFFENTLICHT=nein
abschluss() {
  ABGANG=$?
  # Der Arbeitsstand dieses Laufs. Nach der Veroeffentlichung gibt es ihn nicht mehr, `rm -f` ist
  # dann ein Leerlauf; vorher ist er genau das, was nie unter einem Endnamen liegen darf.
  if [ -n "${STAGE:-}" ]; then
    rm -f "$STAGE" "${STAGE}.sha256" 2>/dev/null || true
  fi
  # Zusage (d) an ihrem Bruchpunkt: Scheitert das ZWEITE `mv` der Veroeffentlichung, liegt der
  # Sidecar schon unter seinem Endnamen und der Dump nicht. Ein Sidecar ohne Dump ist kein Backup,
  # sondern ein Rest, der einen Wiederhersteller in die Irre fuehrt — er kommt hier weg.
  #
  # ES KOMMT NUR WEG, WENN DIESER LAUF IHN SELBST DORTHIN GELEGT HAT — der Befund von BEN R3.
  #
  # GEMESSEN: ein Erfolgslauf, danach ein Lauf mit demselben SEKUNDENSTEMPEL, dessen `pg_dump`
  # scheitert. `VEROEFFENTLICHT=nein` stimmte, sagte aber nur etwas ueber DIESEN Lauf; `${OUT}.sha256`
  # war der Sidecar der BESTEHENDEN Sicherung von eben. Er wurde geloescht, und im Verzeichnis blieb
  # ein Dump ohne Pruefsumme — ein Backup, das der Drill nach `RESTORE.md` verweigert (Exit 10/11).
  # Ein Aufraeumzweig, der fremden Bestand zerstoert, ist schlimmer als der Rest, den er wegnimmt.
  #
  # `SIDECAR_DIESER_LAUF` faellt deshalb nur, wenn beides gilt: unter dem Endnamen lag VORHER nichts,
  # und das erste `mv` dieses Laufs hat ihn dorthin gebracht. Alles andere ist fremder Bestand und
  # wird nicht angefasst — mit oder ohne `BACKUP_KEEP`.
  if [ "$VEROEFFENTLICHT" = nein ] && [ "${SIDECAR_DIESER_LAUF:-nein}" = ja ]; then
    rm -f "${OUT}.sha256" 2>/dev/null || true
  fi
  if [ "$ABGANG" -ne 0 ] && [ "$ERGEBNIS_GEMELDET" = nein ]; then
    if [ "$VEROEFFENTLICHT" = ja ]; then
      echo "[backup] ABBRUCH (Exit ${ABGANG}) an unerwarteter Stelle NACH der Veroeffentlichung —" >&2
      echo "[backup] ein Werkzeug ist fehlgeschlagen. DIE SICHERUNG ${ENDNAME} LIEGT" >&2
      echo "[backup] vollstaendig mit ihrer Pruefsumme im Verzeichnis und bleibt dort. Nicht" >&2
      echo "[backup] abgeschlossen wurde, was danach kommt: die Aufbewahrung. Ergebnis: ${ERGEBNIS}" >&2
      ergebnis_hinterlegen fehler \
        "ABBRUCH an unerwarteter Stelle (Exit ${ABGANG}) NACH der Veroeffentlichung; die Sicherung ${ENDNAME} liegt vollstaendig mit ihrer Pruefsumme im Verzeichnis. Nicht abgeschlossen wurde die Aufbewahrung." \
        "$ABGANG" "$ENDNAME" "${SIZE:-}" "${SUM:-}"
    else
      echo "[backup] ABBRUCH (Exit ${ABGANG}) an unerwarteter Stelle — ein Werkzeug ist" >&2
      echo "[backup] fehlgeschlagen. Der Arbeitsstand ist verworfen, es wurde nichts" >&2
      echo "[backup] veroeffentlicht. Ergebnis: ${ERGEBNIS}" >&2
      ergebnis_hinterlegen fehler \
        "ABBRUCH an unerwarteter Stelle (Exit ${ABGANG}); ein Werkzeug ist fehlgeschlagen, es wurde nichts veroeffentlicht." \
        "$ABGANG" "" "" ""
    fi
  fi
  exit "$ABGANG"
}
trap abschluss EXIT

# Konsistent zum App-Standard: bevorzugt KLARWERK_DATABASE_URL, sonst DATABASE_URL.
DB_URL="${KLARWERK_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "[backup] ABBRUCH: weder KLARWERK_DATABASE_URL noch DATABASE_URL gesetzt." >&2
  ergebnis_hinterlegen fehler \
    "ABBRUCH: weder KLARWERK_DATABASE_URL noch DATABASE_URL gesetzt." 1 "" "" ""
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup] ABBRUCH: pg_dump nicht gefunden (postgresql-client installieren)." >&2
  ergebnis_hinterlegen fehler \
    "ABBRUCH: pg_dump nicht gefunden (postgresql-client installieren)." 1 "" "" ""
  exit 1
fi

# ==================================================================================================
# JOB 4057 — WELCHE LESEPRUEFUNG DIESER LAUF FAHREN KANN. Entschieden VOR dem Dump, gesagt danach.
# ==================================================================================================
#
# BIS RUNDE 4 STAND HIER EIN ABBRUCH: fehlt `pg_restore`, endet das Skript mit Exit 1. Das Tor hat
# gezeigt, wohin das fuehrt: `tests/insel-update/sicherung-eindeutig.test.ts` (JOB 4012) laeuft auf
# einem Rechner OHNE `postgresql-client`, und der Wartungsweg brach ab — „Vorversion laeuft weiter,
# Grund: sicherung". Eine Lesepruefung, die die Sicherung UNMOEGLICH macht, schuetzt nichts: sie
# nimmt dem Betreiber das Backup weg, das er ohne sie wenigstens gehabt haette.
#
# DESHALB: gelesen wird mit dem Werkzeug, das DA IST. `pg_restore --list`, wenn es vorhanden ist;
# sonst eine Ersatzpruefung, die den Dump wirklich liest (weiter unten). Abgebrochen wird nur, wenn
# die Datei TATSAECHLICH nicht lesbar ist — nicht, weil ein Werkzeug fehlt.
#
# WAS DAMIT NICHT PASSIERT: Die Ersatzpruefung wird nirgends als `pg_restore` ausgegeben. Sie steht
# als solche im Protokoll, in `letzter-lauf.json` und in RESTORE.md. Ehrlichkeit vor Optik — ein
# schwaecherer Nachweis, der sich als starker ausgibt, waere schlimmer als gar keiner.
if command -v pg_restore >/dev/null 2>&1; then
  LESEPRUEFUNG=pg_restore
  LESEPRUEFUNG_TEXT="pg_restore --list"
else
  LESEPRUEFUNG=ersatz
  LESEPRUEFUNG_TEXT="Ersatz (pg_restore fehlt)"
  echo "[backup] HINWEIS: pg_restore nicht gefunden — die Lesepruefung laeuft als ERSATZ." >&2
  echo "[backup] Der Dump wird vollstaendig gelesen, aber NICHT als Archiv geoeffnet." >&2
  echo "[backup] Fuer die volle Pruefung: postgresql-client installieren (siehe RESTORE.md)." >&2
fi

# --------------------------------------------------------------------------------------------------
# BACKUP_KEEP — die angesagte Aufbewahrungsregel, und ihre Pruefung VOR jeder Wirkung.
# --------------------------------------------------------------------------------------------------
# NICHT GESETZT heisst: es wird nichts geloescht. Das ist das heutige Verhalten und bleibt der
# Standard — ein Update darf keiner bestehenden Installation ein Backup wegnehmen.
#
# EIN TIPPFEHLER DARF NIEMALS DEN BESTAND RAEUMEN. `BACKUP_KEEP=zwei` ist keine Zahl,
# `BACKUP_KEEP=0` hiesse „behalte keine" — beides in einer stillen Auslegung („0 heisst alles
# loeschen") der Totalverlust. Solche Werte entstehen genau dort, wo diese Variable getippt wird:
# in einer Coolify-Maske oder einer Cron-Zeile. Deshalb: lauter Abbruch, Exit 1, ohne zu loeschen
# und ohne ueberhaupt einen Dump zu erzeugen.
#
# FUEHRENDE NULLEN WERDEN DEZIMAL GELESEN — der Befund von BEN R1 (Korrekturpflicht 1):
# In `$(( ))` ist `010` OKTAL, also 8, und `08` ist ueberhaupt keine gueltige Zahl. Gemessen hat BEN
# beides: `BACKUP_KEEP=010` behielt 8 statt 10 Sicherungen (drei zu viel geloescht), `BACKUP_KEEP=08`
# raeumte gar nicht auf und meldete trotzdem Erfolg. Wer in eine Maske „08" tippt, meint acht — die
# Null davor ist Gewohnheit aus Uhrzeiten, keine Basisangabe. Deshalb wird der Wert EINMAL hier mit
# `10#` in eine Dezimalzahl uebersetzt, und AB DA rechnet nur noch `$KEEP` weiter; `$BACKUP_KEEP`
# selbst taucht in keiner Arithmetik mehr auf.
KEEP=""
if [ -n "${BACKUP_KEEP+gesetzt}" ]; then
  case "$BACKUP_KEEP" in
    # Nur Ziffern, und kurz genug fuer die Ganzzahlarithmetik der Shell (19 Stellen sprengen sie).
    '' | *[!0-9]*) KEEP="" ;;
    *) if [ "${#BACKUP_KEEP}" -le 18 ]; then KEEP="$((10#$BACKUP_KEEP))"; else KEEP=""; fi ;;
  esac
  if [ -z "$KEEP" ] || [ "$KEEP" -lt 1 ]; then
    echo "[backup] ABBRUCH: BACKUP_KEEP='${BACKUP_KEEP}' ist keine ganze Zahl >= 1." >&2
    echo "[backup] Es wurde NICHTS entfernt und NICHTS gesichert. BACKUP_KEEP weglassen heisst:" >&2
    echo "[backup] keine Aufbewahrungsregel, es wird nie geloescht." >&2
    ergebnis_hinterlegen fehler \
      "ABBRUCH: BACKUP_KEEP ist keine ganze Zahl >= 1; nichts entfernt, nichts gesichert." 1 "" "" ""
    exit 1
  fi
fi

# Zeitstempel UTC, sortierbar. (date ist hier ok — reines Shell-Tool, kein App-Code.)
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASISNAME="klarwerk-${STAMP}"
OUT="$DEST/klarwerk-${STAMP}.dump"
# Der Endname EINMAL, hier, im normalen Ablauf. Das Sicherheitsnetz braucht ihn, wenn es meldet,
# dass diese Sicherung liegt — und es darf dafuer nicht selbst `basename` aufrufen muessen: der
# Fehlerbericht darf an keinem Werkzeug mehr haengen (BEN R2, Korrekturpflicht 1).
ENDNAME="klarwerk-${STAMP}.dump"

# ==================================================================================================
# JOB 4057 — EIN BELEGTER ENDNAME WIRD NICHT ANGETASTET. Der Befund von BEN R5.
# ==================================================================================================
#
# GEMESSEN: ein Erfolgslauf, danach ein zweiter Lauf in DERSELBEN SEKUNDE mit ANDEREM Dumpinhalt.
# Die Veroeffentlichung schrieb den neuen Sidecar ueber den alten (Sidecar zuerst) — und scheiterte
# dann am `mv` des Dumps. Zurueck blieb: der ALTE Dump mit der NEUEN Pruefsumme. Ein Paar, das
# aussieht wie ein Backup und keines ist: `restore-drill.sh` bricht dafuer mit Exit 11 ab. Die
# gueltige Sicherung war verloren, ohne dass irgendwo „geloescht" stand.
#
# WARUM NICHT EINFACH DIE REIHENFOLGE TAUSCHEN (erst Dump, dann Sidecar)? Weil das den Schaden nur
# verschiebt und dabei groesser macht: dann ueberschreibt `mv` zuerst den ALTEN DUMP, und scheitert
# danach das Sidecar-`mv`, ist der alte Dump WEG statt nur seine Pruefsumme falsch. Ausserdem gaebe
# es dann einen Augenblick, in dem ein `*.dump` OHNE Pruefsumme sichtbar ist — genau der Zustand,
# den JOB 517 mit der Reihenfolge Sidecar-dann-Dump ausgeschlossen hat und an dem JOB 4025 haengt.
#
# DESHALB WIRD GAR NICHT ERST KOLLIDIERT: Ist der Endname dieser Sekunde schon einmal vergeben
# worden, weicht dieser Lauf auf die naechsthoehere Nummer aus — `klarwerk-<STAMP>_02.dump`, `_03`,
# und so fort. Es wird nie in eine bestehende Dump- oder Pruefsummendatei geschrieben. Das
# vorhandene Paar bleibt bytegleich und seine Pruefsumme passt weiterhin — nicht durch sorgfaeltige
# Reihenfolge, sondern weil es nicht angefasst wird.
#
# WARUM AUSWEICHEN UND NICHT ABBRECHEN: Weil beide Sicherungen zaehlen. Ein Abbruch waere der
# einfachere Weg, wuerde aber einem Aufrufer, der zweimal kurz hintereinander sichert, die zweite
# Sicherung verweigern — und im Pruefstand dieser Runde ist genau das gemessen worden: zwei Laeufe
# in Folge treffen auf einem schnellen Rechner regelmaessig dieselbe Sekunde. Dasselbe Ziel, das
# JOB 4012 mit eigenen Laufordnern verfolgt („eine Sicherung darf keine andere loeschen"), gilt
# hier im Verzeichnis.
#
# DIE NUMMER ZAEHLT WEITER, SIE SUCHT NICHT DIE LUECKE (BEN R6, gemessen). Vorher nahm der Lauf den
# naechsten FREIEN Namen. Das war falsch, sobald die Aufbewahrung raeumt:
#
#   Lauf 1 -> …Z.dump · Lauf 2 -> …Z_02 · Lauf 3 -> …Z_03, und BACKUP_KEEP=2 entfernt …Z.dump.
#   Lauf 4 fand …Z.dump FREI und nahm ihn — der JUENGSTE Stand trug damit den lexikalisch
#   KLEINSTEN Namen. Lauf 5 entfernte ihn als „aeltesten": eine juengere Sicherung geloescht, eine
#   aeltere behalten. Die Anzahl stimmte dabei jederzeit, nur der Inhalt war der falsche.
#
# Der neue Name ist deshalb IMMER groesser als jeder fuer diese Sekunde je vergebene: gesucht wird
# die hoechste im Verzeichnis noch sichtbare Nummer dieses Stempels (Dump ODER Pruefsumme zaehlen),
# und darauf kommt eins. Ein frei gewordener Name bleibt frei.
#
# DASS ALLE NAMEN DIESER SEKUNDE VERSCHWINDEN, KANN NICHT PASSIEREN, solange die Sekunde laeuft: es
# raeumt nur, wer selbst gerade veroeffentlicht hat, und der eigene Stand ist unantastbar (Zusage a).
# Wer mit spaeterem Stempel raeumt, hat eine spaetere Sekunde — in diese hier kommt kein Lauf zurueck.
#
# DIE SORTIERUNG IST DAMIT RICHTIG: `_` (0x5F) steht hinter `.` (0x2E), also sortiert
# `klarwerk-<STAMP>_02.dump` HINTER `klarwerk-<STAMP>.dump`, und `_03` hinter `_02` — bei monoton
# steigender Nummer ist die lexikalische Reihung die Altersreihung. Zweistellig, damit `_10` nicht
# vor `_02` rutscht. Der Stempel selbst ist feste Breite, deshalb sortiert auch `…0203Z_99.dump`
# noch vor `…0204Z.dump`.
#
# Die Suche steht VOR dem Dump: der ausgegebene Pfad („Dump nach: …") ist schon der endgueltige.
# Der Insel-Aufrufer liest genau diese Zeile (`scripts/insel/update-einspielen.sh:295`) und prueft
# danach Datei und Pruefsumme — er darf nicht einen Namen genannt bekommen und einen anderen finden.
endname_belegt() { # Rueckgabe 0 = belegt
  [ -e "$OUT" ] || [ -e "${OUT}.sha256" ]
}

abbruch_endname_belegt() {
  echo "[backup] ABBRUCH: ${ENDNAME} oder ${ENDNAME}.sha256 liegt bereits im Zielverzeichnis," >&2
  echo "[backup] und _02 bis _99 dieser Sekunde sind ebenfalls schon vergeben. Dieser Lauf" >&2
  echo "[backup] veroeffentlicht NICHTS und laesst den vorhandenen Bestand unberuehrt:" >&2
  echo "[backup] bytegleich, mit seinen Pruefsummen." >&2
  ergebnis_hinterlegen fehler \
    "ABBRUCH: Endname ${ENDNAME} ist belegt und keine freie Nummer dieser Sekunde mehr offen; nichts veroeffentlicht, der vorhandene Bestand bleibt unberuehrt." \
    5 "" "" ""
  exit 5
}

# Die hoechste fuer DIESEN Stempel bereits vergebene Nummer: 0 = keine, 1 = der Grundname,
# n = `_0n`. Dump UND Pruefsumme zaehlen — ein halbes Paar hat den Namen genauso verbraucht.
hoechste_vergebene_nummer() {
  local hoechste=0
  local pfad name nummer
  if [ -e "$DEST/${BASISNAME}.dump" ] || [ -e "$DEST/${BASISNAME}.dump.sha256" ]; then
    hoechste=1
  fi
  shopt -s nullglob
  for pfad in "$DEST/${BASISNAME}"_[0-9][0-9].dump "$DEST/${BASISNAME}"_[0-9][0-9].dump.sha256; do
    name="${pfad##*/}"
    nummer="${name#"${BASISNAME}"_}"
    nummer="${nummer%%.*}"
    # Dezimal lesen: `_08` waere in Shell-Arithmetik sonst oktal und damit ungueltig (BEN R1).
    nummer="$((10#$nummer))"
    [ "$nummer" -le "$hoechste" ] || hoechste="$nummer"
  done
  shopt -u nullglob
  printf '%s' "$hoechste"
}

# Ab der uebergebenen Nummer aufwaerts — nie darunter. Die Belegtpruefung bleibt trotzdem drin: sie
# faengt ab, was von ausserhalb dieses Skripts unter einem solchen Namen liegt.
freien_endnamen_suchen() {
  local versuch="$1"
  local kandidat
  while [ "$versuch" -le 99 ]; do
    kandidat="$(printf '%s_%02d.dump' "$BASISNAME" "$versuch")"
    OUT="$DEST/$kandidat"
    ENDNAME="$kandidat"
    if ! endname_belegt; then
      echo "[backup] HINWEIS: ${BASISNAME}.dump ist fuer diese Sekunde schon vergeben" >&2
      echo "[backup] (mehrere Laeufe in derselben Sekunde). Diese Sicherung heisst deshalb" >&2
      echo "[backup] ${ENDNAME} — die Nummer zaehlt weiter und wird nie wiederverwendet." >&2
      echo "[backup] Der vorhandene Bestand wird NICHT angefasst — weder ueberschrieben noch" >&2
      echo "[backup] geloescht." >&2
      return 0
    fi
    versuch=$((versuch + 1))
  done
  OUT="$DEST/${BASISNAME}.dump"
  ENDNAME="${BASISNAME}.dump"
  abbruch_endname_belegt
}

VERGEBEN="$(hoechste_vergebene_nummer)"
if [ "$VERGEBEN" -gt 0 ]; then
  freien_endnamen_suchen "$((VERGEBEN + 1))"
fi

# JOB 517 — ERZEUGUNG UND VEROEFFENTLICHUNG SIND GETRENNT.
#
# Vorher wurde der Dump DIREKT unter seinem Endnamen geschrieben. Daraus folgten zwei Loecher,
# beide ohne jede Fehlermeldung:
#
#   L1  Kein Hashwerkzeug vorhanden -> der Dump blieb OHNE Pruefsumme liegen, Exit 0, und der
#       Text "(sha256 nicht verfuegbar)" wurde als WERT gefuehrt. Ein unbeglaubigtes Backup,
#       das aussieht wie ein beglaubigtes.
#   L2  `pg_dump` scheitert mittendrin -> eine TEILDATEI blieb unter dem Endnamen liegen.
#       `set -euo pipefail` beendete das Skript, raeumte aber nichts weg. Wer im Verzeichnis
#       das juengste `klarwerk-*.dump` greift, greift die Teildatei — am Namen ist sie von
#       einem fertigen Backup nicht zu unterscheiden.
#
# Deshalb: NICHTS wird unter dem Endnamen geschrieben. Der Endname entsteht ausschliesslich
# durch Umbenennen, und zwar Sidecar zuerst, Dump zuletzt. So gibt es keinen Zeitpunkt, zu dem
# ein `*.dump` ohne seine Pruefsumme sichtbar ist — Konsumenten suchen nach genau diesem Muster.
#
# Der Arbeitsname liegt im SELBEN Verzeichnis, nicht in /tmp: `mv` ist nur innerhalb eines
# Dateisystems atomar (`rename(2)`). Zeigt BACKUP_DIR auf eine Netzfreigabe mit anderer
# Semantik, gilt die Atomizitaetszusage nicht — das steht so auch in RESTORE.md.
#
# Aufgeraeumt wird der Arbeitsstand in `abschluss` weiter oben — die EINE Falle dieses Skripts.
# (Bis BEN R1 stand hier ein eigenes `trap 'rm -f …' EXIT`; ein zweites `trap … EXIT` ERSETZT das
# erste, damit haette die Ergebnisspur des Sicherheitsnetzes ab dieser Zeile nicht mehr gegriffen.)
STAGE="${OUT}.partial"

echo "[backup] Dump nach: $OUT"
# -Fc = Custom-Format (komprimiert, für pg_restore). Die URL steht NUR im Argument, nicht im Log.
# Der Exitcode wird selbst geprueft statt `set -e` zu ueberlassen: ein gescheiterter Dump muss noch
# seine Ergebnisspur schreiben koennen, und sein eigener Exitcode bleibt erhalten.
set +e
pg_dump --format=custom --no-owner --no-privileges --file "$STAGE" "$DB_URL"
DUMP_CODE=$?
set -e
if [ "$DUMP_CODE" -ne 0 ]; then
  echo "[backup] ABBRUCH: pg_dump gescheitert (Exit ${DUMP_CODE}). Der Arbeitsstand wird" >&2
  echo "[backup] verworfen — es bleibt nichts liegen." >&2
  ergebnis_hinterlegen fehler \
    "ABBRUCH: pg_dump gescheitert (Exit ${DUMP_CODE}); es wurde nichts veroeffentlicht." \
    "$DUMP_CODE" "" "" ""
  exit "$DUMP_CODE"
fi

# ==================================================================================================
# JOB 4057 — DER DUMP WIRD GELESEN, BEVOR ER VEROEFFENTLICHT WIRD.
# ==================================================================================================
#
# Die Pruefsumme unten belegt, dass die Bytes seit dem Schreiben unveraendert sind. Sie belegt
# NICHT, dass `pg_restore` das Archiv oeffnen kann — das erfuhr der Betreiber erst im Drill, also
# moeglicherweise Wochen spaeter und im Ernstfall. Zwischen `pg_dump` und der Pruefsumme stand
# vorher kein einziger Aufruf, der den Arbeitsstand wieder oeffnet.
#
# `--list` liest Header und Inhaltsverzeichnis des Custom-Archivs. Es laeuft gegen den
# ARBEITSSTAND, nicht gegen den Endnamen: ein Lesetest NACH der Veroeffentlichung waere wertlos,
# weil der unlesbare Dump dann schon unter seinem Endnamen liegt und von einem guten nicht zu
# unterscheiden ist. Scheitert er, raeumt der `trap` alles weg und es bleibt NICHTS liegen.
#
# OHNE `pg_restore` LAEUFT DIE ERSATZPRUEFUNG (Tor R4, JOB 4012). Sie liest den Arbeitsstand
# VOLLSTAENDIG — jedes Byte, zweimal, ueber zwei unabhaengige Wege — und vergleicht die beiden
# Laengen. Was sie belegt: die Datei existiert, ist nicht leer, laesst sich von Anfang bis Ende
# lesen und aendert sich dabei nicht. WAS SIE NICHT BELEGT, und das steht auch so in jeder Ausgabe:
# dass es ein gueltiges pg_dump-Archiv ist. Dafuer braucht es `pg_restore`.
#
# Kein Magic-Byte-Vergleich: das Format des Arbeitsstands haengt an den `pg_dump`-Schaltern, und ein
# Kopf-Vergleich wuerde beim naechsten Formatwechsel still falsch. Eine Pruefung, die das Falsche
# genau misst, ist schlechter als eine, die ehrlich weniger misst.
if [ "$LESEPRUEFUNG" = pg_restore ]; then
  if ! pg_restore --list "$STAGE" >/dev/null; then
    echo "[backup] ABBRUCH: pg_restore kann den erzeugten Dump nicht lesen." >&2
    echo "[backup] Arbeitsstand: ${STAGE} — er wird verworfen, es wird nichts veroeffentlicht." >&2
    ergebnis_hinterlegen fehler \
      "ABBRUCH: pg_restore --list konnte den erzeugten Dump nicht lesen; nichts veroeffentlicht." \
      4 "" "" ""
    exit 4
  fi
else
  LESE_GRUND=""
  if [ ! -f "$STAGE" ]; then
    LESE_GRUND="der Arbeitsstand ist keine regulaere Datei"
  elif [ ! -s "$STAGE" ]; then
    LESE_GRUND="der Arbeitsstand ist leer (0 Bytes)"
  else
    # Zwei unabhaengige vollstaendige Lesungen. `cat … | wc -c` liest jedes Byte durch die Pipe;
    # `wc -c < …` liest dieselbe Datei noch einmal. Ist die Datei unlesbar, scheitert das hier —
    # nicht erst im Ernstfall. Beide Wege stehen in einer `if`-Bedingung, damit `set -e` den
    # Fehlschlag nicht am Fehlerbericht vorbeireisst.
    LESE_A=""
    LESE_B=""
    if ! LESE_A="$(cat "$STAGE" 2>/dev/null | wc -c | tr -d ' ')"; then LESE_A=""; fi
    if ! LESE_B="$(wc -c < "$STAGE" 2>/dev/null | tr -d ' ')"; then LESE_B=""; fi
    if [ -z "$LESE_A" ] || [ -z "$LESE_B" ]; then
      LESE_GRUND="der Arbeitsstand liess sich nicht vollstaendig lesen"
    elif [ "$LESE_A" != "$LESE_B" ]; then
      LESE_GRUND="der Arbeitsstand aenderte sich beim Lesen (${LESE_A} statt ${LESE_B} Bytes)"
    fi
  fi
  if [ -n "$LESE_GRUND" ]; then
    echo "[backup] ABBRUCH: Ersatz-Lesepruefung fehlgeschlagen — ${LESE_GRUND}." >&2
    echo "[backup] Arbeitsstand: ${STAGE} — er wird verworfen, es wird nichts veroeffentlicht." >&2
    ergebnis_hinterlegen fehler \
      "ABBRUCH: Ersatz-Lesepruefung fehlgeschlagen (${LESE_GRUND}); nichts veroeffentlicht." \
      4 "" "" ""
    exit 4
  fi
  echo "[backup] Lesepruefung: Ersatz (pg_restore fehlt) — ${LESE_A} Bytes vollstaendig gelesen."
fi

# Pruefsumme ist PFLICHT, nicht "best effort": ohne sie wird nichts veroeffentlicht.
if command -v shasum >/dev/null 2>&1; then
  SUM="$(shasum -a 256 "$STAGE" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  SUM="$(sha256sum "$STAGE" | awk '{print $1}')"
else
  echo "[backup] ABBRUCH: weder shasum noch sha256sum gefunden — ohne Pruefsumme wird kein" >&2
  echo "[backup] Backup veroeffentlicht. Der unvollstaendige Arbeitsstand wird verworfen." >&2
  ergebnis_hinterlegen fehler \
    "ABBRUCH: weder shasum noch sha256sum gefunden; ohne Pruefsumme nichts veroeffentlicht." \
    3 "" "" ""
  exit 3
fi

SIZE="$(wc -c < "$STAGE" | tr -d ' ')"
# Sidecarformat wie `shasum -a 256`: 64 Hex, zwei Leerzeichen, DER ENDNAME (nicht der Arbeitsname).
echo "${SUM}  ${ENDNAME}" > "${STAGE}.sha256"

# DIE VEROEFFENTLICHUNG. Reihenfolge ist nicht beliebig: Sidecar zuerst, Dump zuletzt.
#
# DIE ZWEITE PRUEFUNG AUF DEN BELEGTEN ENDNAMEN, unmittelbar vor dem ersten `mv`. Die erste steht
# oben vor dem Dump; zwischen beiden kann ein gleichzeitig laufender Lauf veroeffentlicht haben.
# Diese hier ist die verbindliche: ab ihr liegen nur noch die beiden `mv`.
#
# (Ein Restrisiko bleibt und wird nicht verschwiegen: zwischen dieser Pruefung und dem `mv` liegt
# ein Augenblick, in dem ein dritter Lauf dazwischengehen koennte. `mv` allein kann das nicht
# ausschliessen — dafuer braeuchte es eine Sperrdatei, und die waere eine Verhaltensaenderung
# ausserhalb dieses Auftrags. Die Sekundenkollision, die BEN gemessen hat, ist damit zu.)
if endname_belegt; then
  abbruch_endname_belegt
fi
mv "${STAGE}.sha256" "${OUT}.sha256"
# NACHWEISLICH DER EIGENE: unter dem Endnamen lag nichts, dieses `mv` hat ihn belegt. Nur diesen
# einen darf das Sicherheitsnetz oben wieder wegnehmen, wenn das `mv` des Dumps scheitert.
SIDECAR_DIESER_LAUF=ja
mv "$STAGE" "$OUT"
# AB HIER GIBT ES DIESE SICHERUNG. Was danach noch scheitert — die Aufbewahrung, die
# Abschlussmeldung —, aendert daran nichts, und kein Fehlerbericht darf es bestreiten (BEN R2).
VEROEFFENTLICHT=ja

# ==================================================================================================
# JOB 4057 — DIE AUFBEWAHRUNG. Vier Zusagen, und jede davon ist die Stelle, an der ein naives
# Aufraeumen den Bestand vernichtet, den es schuetzen soll.
# ==================================================================================================
#
#   (a) DIE SOEBEN VEROEFFENTLICHTE SICHERUNG WIRD NIE GELOESCHT, auch bei BACKUP_KEEP=1 nicht.
#   (b) EIN `*.dump` OHNE SIDECAR wird weder mitgezaehlt noch geloescht: nach dem Vertrag aus
#       RESTORE.md ist es kein regulaer entstandenes Backup dieses Skripts. Wuerde es mitgezaehlt,
#       verschoebe sich die Grenze und ein ECHTES Paar fiele zu frueh weg.
#   (c) `*.partial` wird nie angefasst — das ist der Arbeitsstand eines gleichzeitig laufenden
#       Laufs. Wer ihn loescht, zerstoert eine Sicherung, die gerade entsteht.
#   (d) ES ENTSTEHT ZU KEINEM ZEITPUNKT EIN DUMP OHNE SEINEN SIDECAR: geloescht wird Dump zuerst,
#       Sidecar ZULETZT — spiegelbildlich zur Veroeffentlichung darueber.
#
# DIE REIHUNG NACH ALTER KOMMT AUS DEM DATEINAMEN (`klarwerk-<STAMP>`, UTC und sortierbar), NICHT
# aus der Aenderungszeit: ein Kopiervorgang verstellt mtime, den Namen nicht.
#
# DASS DER NAME DAS ALTER WIRKLICH TRAEGT, HAENGT AN DER VERGABE OBEN: die Nummer einer Sekunde
# zaehlt monoton weiter und wird nie wiederverwendet. Ohne das waere diese Sortierung eine
# Altersaussage, die sie nicht halten kann — genau der Befund BEN R6.
ENTFERNT_NAMEN=""
ENTFERNT_ANZAHL=0
BEHALTEN=0
if [ -n "${BACKUP_KEEP+gesetzt}" ]; then
  # Vollstaendige Sicherungen: Dump MIT Sidecar. Der Rest bleibt unberuehrt.
  PAARE=""
  shopt -s nullglob
  for pfad in "$DEST"/klarwerk-*.dump; do
    [ -f "${pfad}.sha256" ] || continue
    PAARE="${PAARE}${pfad}
"
  done
  shopt -u nullglob
  GEORDNET="$(printf '%s' "$PAARE" | LC_ALL=C sort)"
  GESAMT=0
  while IFS= read -r pfad; do
    [ -n "$pfad" ] || continue
    GESAMT=$((GESAMT + 1))
  done <<EOF
$GEORDNET
EOF
  # `$KEEP` ist die dezimal gelesene Zahl von oben, NIE `$BACKUP_KEEP` — sonst waere `010` hier
  # wieder oktal (BEN R1).
  UEBERZAHL=$((GESAMT - KEEP))
  BEHALTEN=$GESAMT
  if [ "$UEBERZAHL" -gt 0 ]; then
    while IFS= read -r pfad; do
      [ -n "$pfad" ] || continue
      [ "$ENTFERNT_ANZAHL" -lt "$UEBERZAHL" ] || break
      # Zusage (a): der eigene, gerade veroeffentlichte Stand ist unantastbar.
      [ "$pfad" != "$OUT" ] || continue
      if rm -f "$pfad" 2>/dev/null && rm -f "${pfad}.sha256" 2>/dev/null; then
        ENTFERNT_NAMEN="${ENTFERNT_NAMEN}$(basename "$pfad") $(basename "$pfad").sha256 "
        ENTFERNT_ANZAHL=$((ENTFERNT_ANZAHL + 1))
        BEHALTEN=$((BEHALTEN - 1))
      else
        echo "[backup] HINWEIS: $(basename "$pfad") konnte nicht entfernt werden." >&2
      fi
    done <<EOF
$GEORDNET
EOF
  fi
  # Wie der gelesene Wert heisst: bei `08` steht beides da, damit niemand raten muss.
  KEEP_TEXT="$KEEP"
  [ "$BACKUP_KEEP" = "$KEEP" ] || KEEP_TEXT="${BACKUP_KEEP} (dezimal gelesen: ${KEEP})"
  if [ "$ENTFERNT_ANZAHL" -gt 0 ]; then
    echo "[backup] Aufbewahrung BACKUP_KEEP=${KEEP_TEXT} — behalten: ${BEHALTEN}," \
      "entfernt: ${ENTFERNT_ANZAHL} (${ENTFERNT_NAMEN% })"
  elif [ "$UEBERZAHL" -gt 0 ]; then
    # EHRLICH STATT BEQUEM: „nichts zu tun" waere hier falsch — es gab etwas zu tun, und es ist
    # nicht gelungen. Der Satz nennt beides, und der `grund` der Ergebnisspur ebenfalls.
    echo "[backup] Aufbewahrung BACKUP_KEEP=${KEEP_TEXT} — ${UEBERZAHL} Sicherung(en) zu viel," \
      "aber NICHTS entfernt (siehe Hinweise oben). Behalten: ${BEHALTEN}." >&2
  else
    echo "[backup] Aufbewahrung BACKUP_KEEP=${KEEP_TEXT} — behalten: ${BEHALTEN}, nichts zu tun."
  fi
fi

# Die SICHERUNG ist erfolgreich — sie liegt da, gelesen und beglaubigt. Blieb das AUFRAEUMEN
# unvollstaendig, steht das im selben Satz: ein „erfolg" ohne diesen Zusatz hiesse, dass auch die
# Aufbewahrungsregel eingehalten wurde, und das waere dann unwahr (BEN R1, Pruefpunkt 5).
# Der `grund` nennt die Lesepruefung, die WIRKLICH lief — nie die staerkere (Tor R4).
GRUND_ERFOLG="Sicherung veroeffentlicht und gelesen (Lesepruefung: ${LESEPRUEFUNG_TEXT})."
if [ "${UEBERZAHL:-0}" -gt "$ENTFERNT_ANZAHL" ]; then
  GRUND_ERFOLG="${GRUND_ERFOLG} Aufbewahrung unvollstaendig: $((UEBERZAHL - ENTFERNT_ANZAHL)) Sicherung(en) konnten nicht entfernt werden."
fi
ergebnis_hinterlegen erfolg "$GRUND_ERFOLG" 0 "$ENDNAME" "$SIZE" "$SUM"

echo "[backup] fertig — ${SIZE} Bytes, sha256=${SUM}"
echo "[backup] Pruefsumme: ${OUT}.sha256"
echo "[backup] Ergebnis dieses Laufs: ${ERGEBNIS}"
echo "[backup] Wiederherstellung: siehe scripts/backup/RESTORE.md"
