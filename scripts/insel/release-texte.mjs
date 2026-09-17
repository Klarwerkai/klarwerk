// ================================================================================================
// JOB 4012 — WAS IN JEDEM RELEASE STEHT: sein Name, sein Start, sein Einstieg, sein Rückweg.
// ================================================================================================
//
// WARUM DIESE TEXTE HIER LIEGEN UND NICHT MEHR IN `build-current-release.mjs`: Die Baudatei ist
// nicht prüfbar — sie räumt beim Laden Verzeichnisse ab, ruft `git`, `npm ci` und `zip`. Ein Test
// kann sie deshalb nicht einfuehren, und genau darum lagen ihre drei wichtigsten Erzeugnisse in
// Runde 1 UNGEPRÜFT im Release: der Releasename, der Startbefehl und der Doppelklick. Ben hat in
// allen dreien einen Produktfehler gefunden (Gegenproben BEN1 und Korrekturpflicht 3/4).
//
// Ab hier sind es Funktionen ohne Nebenwirkung. Der Test führt sie aus, schreibt ihr Ergebnis in
// einen echten Ordner und FÄHRT es. Die Baudatei ruft dieselben Funktionen — eine Quelle.

/** Die App-Version, wie sie in `package.json` und damit in `/health` steht. */
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
/** Ein Git-Objektname. Ein Branchname, `latest` oder ein uneingesetztes `$SOURCE_COMMIT` ist keiner. */
const COMMIT_RE = /^[0-9a-f]{7,40}$/i;

/**
 * DER NAME EINES RELEASES — und damit die Antwort auf die Frage, ob es nach einem Update noch eine
 * Vorversion gibt.
 *
 * DER FEHLER, GEGEN DEN DIESE FUNKTION STEHT (Ben, Gegenprobe BEN1): Die Baudatei vergab EINEN
 * festen Namen für jeden Baulauf. Zwei Fassungen hießen gleich, das Update löschte das
 * gleichnamige Zielverzeichnis, und der Rückfall fand danach nur noch das kaputte Release, auf das
 * er gerade zurückfallen wollte. Ein Name, der nicht unterscheidet, ist kein Name.
 *
 * DREI TEILE, weil jeder für sich zu wenig ist: die App-Version (was der Mensch sucht), der Commit
 * (welcher Stand), die Bauzeit (welcher Lauf — zwei Bauläufe desselben Commits sind zwei Pakete).
 *
 * FAIL-CLOSED: Eine unplausible Herkunft wird abgelehnt und nicht in einen Namen eingebaut. Eine
 * halb gefüllte Identität sähe eindeutig aus und wäre es nicht.
 */
export function releaseIdentitaet({ appVersion, commit, gebautAm }) {
  if (typeof appVersion !== "string" || !VERSION_RE.test(appVersion)) {
    throw new Error(`Release-Identität: App-Version „${appVersion}" ist keine Version.`);
  }
  if (typeof commit !== "string" || !COMMIT_RE.test(commit)) {
    throw new Error(`Release-Identität: „${commit}" ist kein Commit (7–40 Hexzeichen).`);
  }
  const zeit = new Date(gebautAm);
  if (Number.isNaN(zeit.getTime())) {
    throw new Error(`Release-Identität: Bauzeit „${gebautAm}" ist kein Zeitpunkt.`);
  }
  const stempel = zeit.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `klarwerk-insel-${appVersion}-${commit.slice(0, 8).toLowerCase()}-${stempel}`;
}

/**
 * DER STARTBEFEHL DES RELEASES.
 *
 * DIE KORREKTUR AUS RUNDE 1 (Bens Korrekturpflicht 3): Der Startbefehl warf `DATABASE_URL`
 * bedingungslos weg (`unset DATABASE_URL`) und schaltete auf das Journal. Auf einer Insel mit
 * Postgres hätte `update-einspielen.sh` also einen `pg_dump` gesichert und die App danach gegen
 * ein Journal gestartet — die Sicherung wäre die Sicherung von Daten gewesen, die niemand mehr
 * benutzt. Jetzt entscheidet die Umgebung, und zwar an EINER Stelle:
 *
 *   DATABASE_URL (oder KLARWERK_DATABASE_URL, den `scripts/backup/backup.sh:14` liest) gesetzt
 *     → Postgres. Kein Journal daneben.
 *   sonst
 *     → Journal, unverändert zum Bestand: Datei anlegen, `KLARWERK_DEV_PERSIST=1`.
 *
 * Die App gäbe Postgres ohnehin den Vorrang (`services/app/src/server.ts:70`); zwei gesetzte
 * Quellen wären trotzdem eine Einladung zum Irrtum beim Lesen der Protokolle.
 *
 * ================================================================================================
 * JOB 4332 — DER STARTBEFEHL ERFÜLLT JETZT DEN STARTVERTRAG, DEN ER SELBST AUSLÖST.
 * ================================================================================================
 *
 * DER BEFUND, GEMESSEN AM ECHTEN PAKET (JOB 4315, Fall B1): Dieser Befehl setzt `NODE_ENV=production`
 * (unten), und der Startvertrag (`services/app/src/start-vertrag.ts`) verlangt in Produktion
 * `APP_BASE_URL` und `DATABASE_URL`. Beide setzte er nicht — `DATABASE_URL` wirft er im Journalzweig
 * sogar ausdrücklich weg. Das Paket brach mit seinem EIGENEN Startbefehl ab: „Serverstart
 * fehlgeschlagen: StartvertragError: … fehlen — APP_BASE_URL, DATABASE_URL". Wer es auf den Mac
 * Studio legte und doppelklickte, bekam keine Instanz.
 *
 * DER VERTRAG IST NICHT DAS PROBLEM UND WIRD NICHT ANGEFASST. Beide Pflichten sind richtig: ohne
 * `APP_BASE_URL` verschickt der Kennwort-Zurücksetzen-Weg eine Mail ohne Link, ohne `DATABASE_URL`
 * liefe Produktion auf nicht dauerhaftem Speicher. Erfüllt werden sie hier auf den zwei dafür
 * vorgesehenen Wegen, und zwar so, dass keine Zeile mehr behauptet als der Zustand hergibt:
 *
 *   APP_BASE_URL — ein VORGABEWERT aus dem tatsächlich verwendeten `PORT`, und nur, wenn der
 *     Betreiber nichts gesetzt hat (`\${APP_BASE_URL:-…}`). Die verwendete Adresse wird ausgegeben:
 *     sie landet in den Links der Kennwort-Mails, und wer sie nicht kennt, sucht den Fehler später
 *     beim Klicken.
 *   KLARWERK_ALLOW_INMEMORY_PROD — die BENANNTE Ausnahme aus SCRUM-498 B3
 *     (`services/app/src/storage-guard.ts:6-8`: „erlaubt den In-Memory-Pfad bewusst … dann nur mit
 *     lauter Warnung"), gesetzt AUSSCHLIESSLICH im Journalzweig. Genau dort ist die Aussage wahr.
 *     Im Postgres-Zweig bleibt er ungesetzt und, falls von aussen gesetzt, unangetastet: dort ist
 *     die Pflicht erfüllt, und ein Override wäre eine Lüge über die Datenhaltung.
 *
 * DIE LAUTE WARNUNG BLEIBT LAUT. Der Start wird NICHT dadurch erkauft, dass die Warnzeile des
 * Speicherwächters („KLARWERK WARN: NODE_ENV=production, KLARWERK_ALLOW_INMEMORY_PROD=1, kein
 * DATABASE_URL → Journal-Speicher …") verschwindet; sie wird hier weder unterdrückt noch
 * umformuliert noch weggefiltert. Sie ist die massgebliche Aussage über die Datenhaltung dieser
 * Insel, und `tests/insel-echter-start/paket-startet.integration.test.ts` (B1) weist sie in der
 * Prozessausgabe des echten Laufs nach.
 */
export function startBefehlText() {
  return `#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SHARED_ROOT="\${KLARWERK_SHARED_ROOT:-/Users/Shared/Klarwerk_Insel}"
PORT="\${PORT:-3002}"

mkdir -p "$SHARED_ROOT/data" "$SHARED_ROOT/logs"

export PORT
export NODE_ENV=production
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Die oeffentliche Adresse dieser Instanz. Vorgabe aus dem wirklich verwendeten PORT; ein vom
# Betreiber gesetzter Wert gewinnt. Sie wird ausgegeben, weil sie in Kennwort-Mails landet.
export APP_BASE_URL="\${APP_BASE_URL:-http://127.0.0.1:$PORT}"
echo "[start] Adresse (APP_BASE_URL): $APP_BASE_URL - unter dieser Adresse stehen die Links in Kennwort-Mails"

# Postgres oder Journal — eine Entscheidung, an einer Stelle, aus der Umgebung.
DB_URL="\${KLARWERK_DATABASE_URL:-\${DATABASE_URL:-}}"
if [ -n "$DB_URL" ]; then
  export DATABASE_URL="$DB_URL"
  unset KLARWERK_DEV_PERSIST || true
  echo "[start] Datenhaltung: Postgres"
else
  unset DATABASE_URL || true
  STATE_FILE="\${KLARWERK_DEV_PERSIST_FILE:-$SHARED_ROOT/data/state.jsonl}"
  if [ ! -f "$STATE_FILE" ]; then
    : > "$STATE_FILE"
  fi
  export KLARWERK_DEV_PERSIST=1
  export KLARWERK_DEV_PERSIST_FILE="$STATE_FILE"
  # Die benannte Ausnahme aus SCRUM-498 B3 — NUR hier, wo das Journal wirklich die Datenhaltung ist.
  # Die laute Warnung des Speicherwaechters bleibt und wird nicht gefiltert.
  export KLARWERK_ALLOW_INMEMORY_PROD=1
  echo "[start] Datenhaltung: Journal ($STATE_FILE)"
fi

export KLARWERK_LOCAL_LLM_URL="\${KLARWERK_LOCAL_LLM_URL:-http://127.0.0.1:11434/v1}"
export KLARWERK_LOCAL_LLM_MODEL="\${KLARWERK_LOCAL_LLM_MODEL:-mistral:latest}"
export KLARWERK_LOCAL_LLM_KEY="\${KLARWERK_LOCAL_LLM_KEY:-}"

cd "$ROOT"
NODE_BIN="\${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ]; then
  echo "node not found; expected Homebrew Node under /opt/homebrew/bin/node" >&2
  exit 1
fi
exec "$NODE_BIN" "$ROOT/node_modules/tsx/dist/cli.mjs" "$ROOT/services/app/src/server.ts"
`;
}

/**
 * DER DOPPELKLICK — und ab dieser Runde nichts weiter als ein Einstieg.
 *
 * WAS ER FRÜHER TAT (Bens Korrekturpflicht 4): Er sicherte das Journal (und nur das), packte aus,
 * bog `current` um, startete den Server und wartete auf `/health` — und ließ bei Rot die kaputte
 * App stehen. Er war damit ein ZWEITER Umschaltweg neben `update-einspielen.sh`, nur ohne
 * Schema-Vertrag, ohne Postgres-Sicherung und ohne Rückfall. Wer ihn benutzte, hatte kein Netz.
 *
 * WARUM ER NICHT EINFACH GELÖSCHT WIRD: Die Übergabe nennt ihn (`UEBERGABE-KLARWERK-Insel.md`
 * §4.4), und auf dem Mac Studio ist der Doppelklick der geübte Griff. Er bleibt — er übergibt nur.
 * Zusätzliche Argumente (`--nicht-umkehrbar-einspielen`, `--datenstand-unbekannt-uebernehmen`)
 * reicht er durch.
 */
export function installBefehlText() {
  return `#!/bin/bash
set -euo pipefail

# Dieses Skript schaltet NICHTS selbst um. Es übergibt an den einen abgesicherten Weg:
# sichern -> Schema-Vertrag prüfen -> umschalten -> Health mit Version -> bei Rot zurück.
SOURCE="$(cd "$(dirname "$0")" && pwd)"
WEG="$SOURCE/scripts/insel/update-einspielen.sh"

if [ ! -f "$WEG" ]; then
  echo "AUF MAC STUDIO: ABBRUCH - $WEG fehlt; dieses Paket ist unvollstaendig." >&2
  exit 1
fi

echo "AUF MAC STUDIO: einspielen ueber update-einspielen.sh (Sicherung, Vertrag, Health, Rueckweg)"
exec bash "$WEG" "$SOURCE" "$@"
`;
}

/**
 * `ROLLBACK.md` — der Hinweis auf das Skript, nicht der zweite Weg daneben.
 *
 * Die sieben Handgriffe von früher (Zeiger umbiegen, PID lesen, `kill`, `nohup`, `curl`) stehen
 * hier bewusst nicht mehr: Wer sie braucht, hat gerade eine kaputte App vor sich und keine Ruhe
 * zum Abtippen — und ein zweiter Weg heißt, dass im Ernstfall der ungeübte gefahren wird.
 *
 * DER ABSCHNITT „DATEN" IST EINE ZUSAGE UND WIRD ALS SOLCHE GEMESSEN (JOB 4107). Bis dahin stand
 * hier pauschal „Zurueckgespielt wird nur auf Ansage: `rueckfall.sh --daten-zurueck <sicherung>`" —
 * für das Journal stimmt das, für einen Postgres-Dump nicht: dort PRÜFT `restore-drill.sh` nur, in
 * einer eigenen leeren Zieldatenbank, und die Produktivdaten bleiben, wie sie sind. Das Release
 * versprach damit etwas, das sein eigenes Werkzeug nicht tut. Seitdem sagen beide Orte dasselbe,
 * und `tests/insel-update/rueckweg-vertrag.test.ts` hält sie gegeneinander: der Text nennt je
 * Datenhaltung den Ausgang, den `rueckfall.sh` wirklich liefert.
 */
export function rollbackText(version) {
  return `# Rueckfall ${version}

AUF MAC STUDIO, ein Befehl:

\`\`\`bash
bash /Users/Shared/Klarwerk_Insel/current/scripts/insel/rueckfall.sh
\`\`\`

Er schaltet \`current\` auf die Vorversion, beendet den alten Server, startet, prueft \`/health\`
samt Version und endet mit einer Zeile: \`Vorversion <version> aktiv\` oder
\`Rueckfall gescheitert, Grund: <health|version|…>\`. Eine bestimmte Fassung: Releasename als
Argument (\`… rueckfall.sh ${version}\`).

Die Handgriffe von frueher — den Zeiger von Hand umbiegen, den Serverprozess selbst beenden und
neu starten — stehen hier bewusst NICHT mehr daneben: zwei Wege zum selben Ziel heisst, dass im
Ernstfall der ungeuebte gefahren wird.

**Daten.** Von sich aus fasst der Rueckfall sie nicht an — er ist ein CODE-Weg.
\`update-einspielen.sh\` sichert VOR jedem Umschalten und nennt den Pfad in seiner Ergebniszeile
(Journal: \`/Users/Shared/Klarwerk_Insel/backups/<zeitstempel>-<lauf>/state.jsonl\`,
Postgres: der Dump aus \`scripts/backup/backup.sh\`). An Daten ruehrt nur \`--daten-zurueck\`, und
die zwei Datenhaltungen tun dabei NICHT dasselbe:

- **Journal** (\`*.jsonl\`): \`rueckfall.sh --daten-zurueck <sicherung>\` spielt den Stand wirklich
  zurueck — die Journaldatei wird ersetzt, der bisherige Stand davor daneben gesichert. Der Weg
  endet mit \`Vorversion <version> aktiv\`, **Exit 0**.
- **Postgres** (\`*.dump\`): \`rueckfall.sh --daten-zurueck <dump>\` spielt NICHTS in die
  Produktivdatenbank. Der Dump wird von \`scripts/backup/restore-drill.sh\` nur GEPRUEFT, in einer
  eigenen leeren Zieldatenbank; die Produktivdaten bleiben unveraendert. Der Weg schaltet den Code
  zurueck und endet mit einer eigenen Zeile („die Produktivdatenbank ist UNVERAENDERT …") und
  **Exit 11**. Wer diesen Datenstand wirklich haben will, muss ihn von Hand einspielen
  (\`pg_restore\` in die Produktivdatenbank) — das ist eine eigene Entscheidung, weil es die
  laufenden Daten ueberschreibt, und dieses Skript trifft sie nicht.

Fehlt zu einem Dump die Pruefsumme (\`<dump>.sha256\`), bricht der Weg VOR dem Anhalten des Servers
ab (**Exit 9**); die laufende Fassung bleibt dann unberuehrt.

**Jedes Release bleibt liegen.** Releases werden nie ueberschrieben (jeder Baulauf hat seinen
eigenen Namen). Eine bestimmte aeltere Fassung faehrst du mit ihrem Namen an; \`ls\` auf
\`/Users/Shared/Klarwerk_Insel/releases\` zeigt sie alle.
`;
}
