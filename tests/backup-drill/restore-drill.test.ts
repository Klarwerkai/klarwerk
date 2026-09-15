import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pflichttabellenAusDrill } from "./pflichtsatz";

const root = resolve(import.meta.dirname, "../..");

// ==================================================================================================
// JOB 4097 — DER PRÜFSTAND KENNT DIE VIER NAMEN NICHT MEHR.
// ==================================================================================================
//
// Bis hierher stand hier `const tables = ["kos","users","audit","objects"]` — dieselbe Liste wie im
// Skript, ein zweites Mal abgeschrieben. Genau das ist der zweite Pflegeort, den dieser Auftrag
// abschafft: Die Attrappen beantworten jetzt, was der Drill WIRKLICH fragt, und die Liste kommt aus
// derselben einen Wahrheit, gegen die `tabellensatz.test.ts` sie hält.
const tabellen = pflichttabellenAusDrill();

// Die Tabelle, an der die Störfälle gemessen werden. Bewusst `ko_evidence`: dort steht die
// Zuordnung Datei→Wissensobjekt, und genau sie konnte vor JOB 4097 still verschwinden.
const STOER = "ko_evidence";
const KO = "ko-4097";
const OBJ = "obj-4097";
// JOB 4097 R2: die Kennung der BELEGZEILE selbst (`ko_evidence.id`). Sie ist der Anker des
// strukturierten Vergleichs — der Drill verlangt in der Antwort genau diesen Datensatz und an ihm
// genau diese `objectId`. Ein Textvorkommen irgendwo in der Antwort genügt nicht mehr.
const EV = "ev-4097";

// PATH doubles model only external commands. The real shell script decides all gates.
const stub = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const dir = process.env.PROBE;
const mode = process.env.MODE;
const tabellen = JSON.parse(process.env.PFLICHT);
const STOER = process.env.STOER;
const KO = process.env.KO_ID;
const OBJ = process.env.OBJEKT_ID;
const EV = process.env.EVIDENZ_ID;
fs.appendFileSync(path.join(dir, 'calls'), JSON.stringify([name, ...args]) + '\n');

// JOB 4097 R2: ein Aufruf "node -e <skript>" ist KEIN Anwendungsstart, sondern die strukturierte
// Auswertung der Belegantwort im Drill selbst. Die Attrappe fuehrt sie mit dem ECHTEN node aus —
// gemessen wird damit das echte Skript des Drills, nicht eine gestellte Antwort darueber.
if (name === 'node' && args[0] === '-e') {
  const lauf = require('node:child_process').spawnSync(process.execPath, args, { stdio: 'inherit' });
  process.exit(lauf.status === null ? 1 : lauf.status);
}

// Welche Tabelle fehlt in der wiederhergestellten Datenbank (Strukturgate)?
const strukturFehlt = mode === 'missing' ? ['audit', 'objects'] : [];
// Fuer welche Tabelle fuehrt der Dump ueberhaupt keinen COPY-Block?
const ohneBlock = ['toc-missing', 'kein-block-mit-toc'].includes(mode) ? [STOER] : [];
// Und welche fehlt zusaetzlich im Inhaltsverzeichnis? Genau das ist der Unterschied zwischen
// "gemessene 0" und "fehlender Bestand".
const ohneEintrag = mode === 'toc-missing' ? [STOER] : [];

function dumpZeilen(t) {
  if (mode === 'empty') return 0;
  if (mode === 'nichtkern-mismatch' && t === 'drafts') return 7;
  return 2;
}
function dbZeilen(t) {
  if (mode === 'kein-block-mit-toc' && t === STOER) return 0;
  if (mode === 'empty') return 0;
  if (mode === 'mismatch' && t === 'audit') return 3;
  if (mode === 'nichtkern-mismatch' && t === 'drafts') return 3;
  return 2;
}

if (name === 'createdb') process.exit(0);
if (name === 'psql') {
  const sql = args.at(-1);
  // JOB 4097 · Glied 7b: zwei Fragen an denselben Bestand.
  if (sql.includes('FROM ko_evidence')) {
    // 7b-1 — der Bestandsscan: Belegzeilen, deren Anhang in objects fehlt (Zahl, Beispiel).
    if (sql.includes('NOT EXISTS')) {
      if (mode === 'waisen-sql-fehler') process.exit(1);
      if (mode === 'waisen-unlesbar') { console.log('keine-zahl -'); process.exit(0); }
      console.log(mode === 'waise' ? '1 ' + KO + ' ' + OBJ : '0 -');
      process.exit(0);
    }
    // 7b-2 — der Kandidat: Belegzeile, Wissensobjekt, Anhangskennung. OHNE Filterung.
    if (mode === 'beleg-sql-fehler') process.exit(1);
    if (mode === 'kandidat-unvollstaendig') { console.log(EV + ' ' + KO); process.exit(0); }
    if (mode !== 'kein-beleg') console.log(EV + ' ' + KO + ' ' + OBJ);
    process.exit(0);
  }
  if (sql.includes('information_schema.tables')) {
    const table = sql.match(/table_name='([^']+)'/)?.[1];
    if (!table) {
      // Die Leerheitspruefung der Zieldatenbank (Glied 2).
      console.log(mode === 'occupied' ? 7 : 0);
      process.exit(0);
    }
    if (!tabellen.includes(table)) process.exit(93);
    console.log(strukturFehlt.includes(table) ? 0 : 1);
    process.exit(0);
  }
  const table = sql.match(/FROM (?:public\.)?"?(\w+)/)?.[1];
  if (!tabellen.includes(table)) process.exit(94);
  if (mode === 'query-error' && table === STOER) process.exit(1);
  console.log(dbZeilen(table));
  process.exit(0);
}
if (name === 'pg_restore') {
  if (args.includes('--list')) {
    if (args.at(-1) !== path.join(dir, 'input.dump')) process.exit(95);
    if (mode === 'toc-error') process.exit(1);
    let nr = 100;
    for (const t of tabellen) {
      // Die STRUKTUR steht auch dann im Archiv, wenn der Bestand fehlt — sonst waere die Tabelle
      // nach dem Restore gar nicht da und das Strukturgate haette schon gegriffen.
      console.log((nr++) + '; 1259 16400 TABLE public ' + t + ' eigentuemer');
      if (!ohneEintrag.includes(t)) {
        console.log((nr++) + '; 0 16400 TABLE DATA public ' + t + ' eigentuemer');
      }
    }
    process.exit(0);
  }
  if (!args.includes('--data-only')) process.exit(mode === 'restore-error' ? 1 : 0);
  const table = args.find(a => a.startsWith('--table='))?.slice(8);
  if (!table || !args.includes('--schema=public') || args.at(-1) !== path.join(dir, 'input.dump')) process.exit(95);
  if (mode === 'extract-error' && table === STOER) process.exit(1);
  console.log('-- PostgreSQL database dump\nSET statement_timeout = 0;');
  if (ohneBlock.includes(table)) process.exit(0);
  const bloecke = mode === 'doppelblock' && table === STOER ? 2 : 1;
  for (let i = 0; i < bloecke; i++) {
    console.log('COPY public.' + table + ' (id, body) FROM stdin;');
    const zeilen = dumpZeilen(table);
    // Zeile 1 traegt einen escapten Zeilenumbruch, Zeile 2 einen literalen Punkt-Wert — beides
    // darf die Zaehlung nicht verstellen.
    if (zeilen > 0) console.log('1\ttext with escaped newline\\nnext\n2\t\\\\.');
    for (let z = 3; z <= zeilen; z++) console.log(z + '\tzeile ' + z);
    if (!(mode === 'truncated' && table === STOER)) console.log('\\.\n');
  }
  console.log('-- PostgreSQL database dump complete');
  process.exit(0);
}
if (name === 'npx' || name === 'node') {
  if (args.includes('--version')) process.exit(mode === 'tool-missing' ? 1 : 0);
  fs.writeFileSync(path.join(dir, 'start'), JSON.stringify([name, ...args]));
  fs.writeFileSync(process.env.KLARWERK_PID_FILE, String(mode === 'foreign-pid' ? process.env.FREMD_PID : process.pid));
  fs.writeFileSync(path.join(dir, 'actual-pid'), String(process.pid));
  process.on('SIGTERM', () => { fs.writeFileSync(path.join(dir, 'terminated'), 'yes'); process.exit(0); });
  setTimeout(() => process.exit(0), 20000);
} else if (name === 'curl') {
  const url = args.at(-1);
  const ziel = args[args.indexOf('-o') + 1];
  if (url.endsWith('/health')) console.log('200');
  else if (url.endsWith('/login')) console.log('{"token":"fixture"}\n' + (mode === 'login-error' ? '401' : '200'));
  else if (url.endsWith('/evidence')) {
    if (url.indexOf('/api/kos/' + KO + '/evidence') < 0) process.exit(97);
    const code = mode === 'ko-weg' ? '404' : (mode === 'beleg-403' ? '403' : '200');
    // Der treue Datensatz, wie ihn listByKo ausgibt: der gespeicherte EvidenceRecord.
    const satz = { id: EV, koId: KO, kind: 'attachment', label: 'pruefbericht.png', objectId: OBJ };
    let rumpf = JSON.stringify([satz]);
    // JOB 4097 R2 — die drei Antworten, die eine Textsuche bestanden haette und die KEINE
    // Anhangszuordnung sind: die Kennung als TEIL einer anderen, die Kennung nur im Feld label,
    // und die Kennung an einem FREMDEN Belegdatensatz.
    if (mode === 'beleg-weg') rumpf = '[]';
    if (mode === 'beleg-teiltreffer') rumpf = JSON.stringify([{ ...satz, objectId: OBJ + '-zwei' }]);
    if (mode === 'beleg-nur-label') rumpf = JSON.stringify([{ id: EV, koId: KO, kind: 'source', label: 'Quelle zu ' + OBJ }]);
    if (mode === 'beleg-fremder-satz') rumpf = JSON.stringify([{ ...satz, id: 'ev-fremd' }]);
    if (mode === 'beleg-unlesbar') rumpf = '<html>' + OBJ + '</html>';
    console.log(rumpf + '\n' + code);
  } else if (url.endsWith('/raw')) {
    if (url.indexOf('/api/objects/' + OBJ + '/raw') < 0) process.exit(98);
    if (mode === 'anhang-weg') { console.log('404 0'); process.exit(0); }
    if (mode === 'anhang-403') { console.log('403 0'); process.exit(0); }
    const bytes = mode === 'anhang-leer' ? Buffer.alloc(0) : Buffer.alloc(64, 7);
    fs.writeFileSync(ziel, bytes);
    console.log('200 ' + bytes.length);
  }
  else console.log(JSON.stringify({ ok: false, serialisationDeviations: 12, linkageBreaks: mode === 'linkage' ? 1 : 0, unresolvedDeviations: mode === 'unresolved' ? 2 : 0, uncheckedDeviations: mode === 'unchecked' ? 3 : 0 }) + '\n' + (mode === 'forbidden' ? '403' : '200'));
} else if (name !== 'npx' && name !== 'node') process.exit(96);
`;

function run(mode = "complete", fremdPid?: number) {
  const dir = mkdtempSync(join(root, "tests/backup-drill/.probe-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "package.json"), JSON.stringify({ type: "commonjs" }));
  for (const name of ["psql", "pg_restore", "createdb", "curl", "npx", "node"]) {
    writeFileSync(join(bin, name), `#!${process.execPath}\n${stub}`, { mode: 0o755 });
  }
  const dump = join(dir, "input.dump");
  writeFileSync(dump, "fixture custom archive represented by pg_restore double");
  if (mode !== "no-sidecar") {
    writeFileSync(
      `${dump}.sha256`,
      mode === "bad-sidecar"
        ? "0".repeat(64)
        : createHash("sha256").update(readFileSync(dump)).digest("hex"),
    );
  }
  const read = (name: string) =>
    existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "";
  try {
    const result = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PROBE: dir,
        MODE: mode,
        PFLICHT: JSON.stringify(tabellen),
        STOER,
        KO_ID: KO,
        OBJEKT_ID: OBJ,
        EVIDENZ_ID: EV,
        RESTORE_DB: "fixture_drill",
        DRILL_WORKDIR: dir,
        DRILL_LOGIN_EMAIL: "fixture@example.test",
        DRILL_LOGIN_PASSWORT: "fixture",
        ...(fremdPid === undefined ? {} : { FREMD_PID: String(fremdPid) }),
      },
      encoding: "utf8",
      timeout: 120000,
    });
    const actualPid = read("actual-pid");
    const terminated = read("terminated");
    if (actualPid && !terminated) {
      try {
        process.kill(Number(actualPid), "SIGTERM");
      } catch {
        /* Already exited. */
      }
    }
    return {
      code: result.status,
      output: result.stdout + result.stderr,
      calls: read("calls"),
      start: read("start"),
      terminated,
      pidRemains: existsSync(join(dir, "klarwerk-drill.pid")),
      anhangRemains: existsSync(join(dir, "klarwerk-drill.anhang")),
      belegeRemains: existsSync(join(dir, "klarwerk-drill.belege.json")),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("Restore-Drill: Schema, Dumpabgleich und Aufrufdisziplin", () => {
  // EIN vollständiger Lauf, alle Zusagen daran gemessen. Bewusst nicht drei Läufe mit derselben
  // Attrappe: jeder Lauf des Prüfstands fährt den echten Pflichtsatz durch (zwei Prozessaufrufe je
  // Tabelle), und drei identische Läufe hätten den Torlauf um Minuten verlängert, ohne eine einzige
  // zusätzliche Frage zu beantworten.
  it("A vollständiger Stand: jede Pflichttabelle, jedes Paar, Startbefehl, Nachweis, Abräumen", () => {
    const r = run();
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("Glied 4");
    expect(r.output).toContain(`alle ${tabellen.length} Pflichttabellen vorhanden`);
    for (const table of tabellen) expect(r.output).toContain(`${table}: Dump=2 Datenbank=2`);
    // Der produktive Startbefehl, wörtlich wie im Produktionsimage.
    expect(r.start, r.output).toBe(JSON.stringify(["npx", "tsx", "services/app/src/server.ts"]));
    // JOB 4097 · Glied 7b: Beleg UND Anhangsinhalt, über die laufende Anwendung zurückgelesen.
    expect(r.output).toContain("Bestandsscan: keine Belegzeile ohne ihren Anhang in objects");
    expect(r.output).toContain(`Glied 7b — Wissensobjekt ${KO} mit Beleg auf ${OBJ}`);
    expect(r.output).toContain(`(Belegzeile ${EV})`);
    expect(r.output).toContain("64 Bytes Anhangsinhalt zurueckgelesen");
    expect(r.output).toContain("DRILL BESTANDEN");
    // Und das Abräumen: kein Prozess, keine PID-Datei, keine zurückgelassene Anhangs- oder
    // Belegdatei.
    expect(r.terminated).toBe("yes");
    expect(r.pidRemains).toBe(false);
    expect(r.anhangRemains).toBe(false);
    expect(r.belegeRemains).toBe(false);
  }, 120_000);
  it("B nennt alle fehlenden Tabellen in einer Meldung", () => {
    const r = run("missing");
    expect(r.code, r.output).toBe(22);
    expect(r.output).toMatch(/ABBRUCH \(22\):[^\n]*audit[^\n]*objects/);
    expect(r.start).toBe("");
  }, 120_000);
  it("D erkennt Datenverlust mit Tabellenname und beiden Zahlen", () => {
    const r = run("mismatch");
    expect(r.code, r.output).toBe(23);
    expect(r.output).toMatch(/ABBRUCH \(23\):[^\n]*audit[^\n]*Dump=2[^\n]*Datenbank=3/);
    expect(r.start).toBe("");
  }, 120_000);
  it("leere Pflichttabellen sind gemessene 0 = 0", () => {
    const r = run("empty");
    expect(r.code, r.output).toBe(0);
    for (const table of tabellen) expect(r.output).toContain(`${table}: Dump=0 Datenbank=0`);
  }, 120_000);

  // ================================================================================================
  // JOB 4097 · RED-FIRST A — DER FEHLENDE BESTAND EINER NICHT-KERNTABELLE
  // ================================================================================================
  //
  // DIE LÜCKE, GEMESSEN: Ein Dump aus `pg_dump --exclude-table-data=ko_evidence` führt die Struktur
  // von `ko_evidence`, aber KEINEN Bestand. Nach dem Restore steht die Tabelle leer da — die
  // Anhangszuordnung Datei→Wissensobjekt ist weg, die Dateien liegen ohne Zugehörigkeit in der
  // Ablage. Vor JOB 4097 endete dieser Lauf mit **Exit 0**, weil `ko_evidence` in
  // `KERNTABELLEN=(kos users audit objects)` schlicht nicht vorkam.
  it("A(4097) ein Dump ohne Bestand fuer ko_evidence faellt durch — mit dem Namen in der Meldung", () => {
    const r = run("toc-missing");
    expect(r.code, r.output).toBe(22);
    expect(r.output).toMatch(/ABBRUCH \(22\):[^\n]*ko_evidence/);
    expect(r.start).toBe("");
  }, 120_000);
  // DIE GEGENRICHTUNG, damit die Regel nicht zur pauschalen Härte wird: Steht die Tabelle im
  // Inhaltsverzeichnis, ist ein fehlender COPY-Block eine ehrlich gemessene 0 — und kein Abbruch.
  it("A2(4097) dieselbe Tabelle MIT Eintrag im Inhaltsverzeichnis ist eine gemessene 0", () => {
    const r = run("kein-block-mit-toc");
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("ko_evidence: Dump=0 Datenbank=0");
  }, 120_000);
  // ================================================================================================
  // JOB 4097 · RED-FIRST B — DIE ZEILENABWEICHUNG EINER NICHT-KERNTABELLE
  // ================================================================================================
  it("B(4097) Zeilenverlust in `drafts` endet mit 23 und beiden Zahlen", () => {
    const r = run("nichtkern-mismatch");
    expect(r.code, r.output).toBe(23);
    expect(r.output).toMatch(/ABBRUCH \(23\):[^\n]*drafts: Dump=7 Datenbank=3/);
    expect(r.start).toBe("");
  }, 120_000);

  it.each(["extract-error", "truncated", "doppelblock", "query-error"])(
    "unmessbare Zählung (%s) scheitert geschlossen",
    (mode) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(24);
      expect(r.output).toMatch(/ABBRUCH \(24\):[^\n]*ko_evidence/);
      expect(r.start).toBe("");
    },
    120_000,
  );
  it("ein unlesbares Inhaltsverzeichnis ist nicht messbar, nicht leer", () => {
    const r = run("toc-error");
    expect(r.code, r.output).toBe(24);
    expect(r.output).toContain("Inhaltsverzeichnis des Dumps nicht lesbar");
    expect(r.start).toBe("");
  }, 120_000);
  it("fehlendes Startwerkzeug hat eigenen Exitcode", () => {
    const r = run("tool-missing");
    expect(r.code, r.output).toBe(31);
    expect(r.output).toContain("ABBRUCH (31)");
    expect(r.start).toBe("");
  }, 120_000);
  it.each([
    ["no-sidecar", 10],
    ["bad-sidecar", 11],
    ["occupied", 20],
  ] as const)(
    "%s verhindert jeden pg_restore-Aufruf",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.calls).not.toContain('"pg_restore"');
    },
    120_000,
  );
  it.each([
    ["restore-error", 21],
    ["login-error", 60],
    ["forbidden", 61],
    ["linkage", 70],
    ["unresolved", 71],
    ["unchecked", 72],
  ] as const)(
    "bestehendes Gate %s behält Exit %i",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
    },
    120_000,
  );

  // ================================================================================================
  // JOB 4097 · GLIED 7b — DER NUTZENNACHWEIS UND SEINE SAUBERE TRENNUNG
  // ================================================================================================
  //
  // Dieselbe Linie wie 60/61 gegen 70/71/72, eine Stufe weiter: Ein AUFBAUFEHLER (62) darf nie wie
  // ein BEFUND am Bestand (73) aussehen. Und der Fall „der Bestand führt gar kein Objekt mit Beleg"
  // ist WEDER das eine NOCH das andere — er wird als nicht gemessen ausgewiesen.
  it("ohne Beleg im Bestand ist der Punkt NICHT gemessen — kein Fehlschlag und kein Erfolg", () => {
    const r = run("kein-beleg");
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("kein Wissensobjekt mit Beleg im Bestand");
    expect(r.output).toContain("NICHT gemessen");
    expect(r.output).toContain("Wissensnachweis: kein Wissensobjekt mit Beleg im Bestand");
    // Die starke Aussage darf hier NICHT dastehen.
    expect(r.output).not.toContain("Anhangsinhalt zurueckgelesen");
  }, 120_000);
  it.each([
    ["ko-weg", 73],
    ["beleg-weg", 73],
    ["anhang-weg", 73],
    ["anhang-leer", 73],
  ] as const)(
    "Befund am Bestand (%s) endet mit %i",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.output).toContain("ABBRUCH (73)");
      expect(r.output).not.toContain("DRILL BESTANDEN");
    },
    120_000,
  );
  // ================================================================================================
  // JOB 4097 · RUNDE 2 · RED-FIRST E — EIN TEXTVORKOMMEN IST KEINE ANHANGSZUORDNUNG.
  // ================================================================================================
  //
  // DIE LÜCKE, GEMESSEN (BENs Gegenproben zu Runde 1): Glied 7b prüfte die Belegantwort mit
  // `grep -qF "$OBJEKT_ID"` — ein Textvorkommen IRGENDWO in der Antwort. Alle drei Antworten unten
  // enthalten die Kennung als Text und tragen trotzdem KEINE Zuordnung; vor dieser Runde endete
  // jede von ihnen mit **Exit 0 und „DRILL BESTANDEN"**. Der Betreiber hätte gelesen, sein Beleg
  // sei zurück, während die Zuordnung Datei→Wissensobjekt fehlte.
  //
  // Gemessen wird jetzt der Datensatz, den die Datenbank genannt hat: dieselbe `id`, und an ihr
  // dieselbe `objectId`.
  it.each([
    // Die Kennung als TEIL einer anderen: `obj-4097-zwei` enthält `obj-4097`.
    ["beleg-teiltreffer", "zeigt in der Antwort NICHT auf"],
    // Die Kennung nur im `label`, der Beleg selbst ohne jede `objectId`.
    ["beleg-nur-label", "zeigt in der Antwort NICHT auf"],
    // Die Kennung an einem FREMDEN Belegdatensatz; der genannte Beleg fehlt.
    ["beleg-fremder-satz", "fuehrt den Beleg"],
  ] as const)(
    "E(4097 R2) %s ist ein BEFUND (73), kein bestandener Drill",
    (mode, satz) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(73);
      expect(r.output).toContain("ABBRUCH (73)");
      expect(r.output).toContain(satz);
      expect(r.output).not.toContain("DRILL BESTANDEN");
      expect(r.output).not.toContain("Anhangsinhalt zurueckgelesen");
    },
    120_000,
  );

  // ================================================================================================
  // JOB 4097 · RUNDE 2 · RED-FIRST F — EIN BELEG OHNE SEINEN ANHANG IST EIN BEFUND, KEINE LEERE.
  // ================================================================================================
  //
  // DIE LÜCKE, GEMESSEN: Runde 1 filterte die Kandidaten über einen `JOIN objects` — eine
  // Belegzeile, deren Anhang nach dem Restore fehlt, fiel damit aus der Auswahl. Gab es nur sie,
  // meldete der Drill „kein Wissensobjekt mit Beleg im Bestand — NICHT gemessen" und endete mit 0:
  // der schlimmste Fall sah aus wie der harmloseste. Jetzt scannt Glied 7b zuerst den ganzen
  // Bestand und nennt Zahl und Beispiel.
  it("F(4097 R2) eine verwaiste Belegzeile endet mit 73 — und nie mit „nicht gemessen“", () => {
    const r = run("waise");
    expect(r.code, r.output).toBe(73);
    expect(r.output).toMatch(/ABBRUCH \(73\): 1 Belegzeile\(n\)/);
    expect(r.output).toContain(`${KO} ${OBJ}`);
    // Die harmlose Lesart darf hier NICHT stehen.
    expect(r.output).not.toContain("kein Wissensobjekt mit Beleg im Bestand");
    expect(r.output).not.toContain("NICHT gemessen");
    expect(r.output).not.toContain("DRILL BESTANDEN");
  }, 120_000);

  it.each([
    ["beleg-403", 62],
    ["anhang-403", 62],
    ["beleg-sql-fehler", 62],
    // Die Trennung gilt auch für die neuen Schritte: ein unbefragbarer Bestand, eine unlesbare
    // Zahl, eine unvollständige Zeile und eine Antwort, die keine JSON-Liste ist, sind
    // AUFBAUFEHLER — sie dürfen nie wie ein Befund am Bestand aussehen.
    ["waisen-sql-fehler", 62],
    ["waisen-unlesbar", 62],
    ["kandidat-unvollstaendig", 62],
    ["beleg-unlesbar", 62],
  ] as const)(
    "Aufbaufehler (%s) endet mit %i und sagt ausdrücklich, dass es KEIN Befund ist",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.output).toContain("ABBRUCH (62)");
      expect(r.output).toContain("KEIN Befund am Bestand");
    },
    120_000,
  );

  // JOB 4010: DIESELBE ZUSAGE, SCHÄRFER GEMESSEN. Vorher stand in der PID-Datei die PID der
  // Drill-Shell selbst, und belegt wurde nur „die Attrappe bekam kein SIGTERM". Das war schwächer
  // als die Zusage: Seit der Zuordnung über die Prozessgruppe gehört die Attrappe ja zur EIGENEN
  // Nachkommenschaft — sie MUSS abgeräumt werden, sonst bliebe eine Waise auf dem Drill-Port
  // zurück. Gemessen wird jetzt, worauf es ankommt: ein WIRKLICH fremder Prozess in eigener
  // Prozessgruppe lebt danach nachweislich noch, der Drill endet mit 80, und trotzdem läuft von
  // seinem eigenen Start nichts weiter.
  it("Reaping lehnt eine fremde PID ab, ohne sie anzufassen — und räumt die eigene trotzdem ab", () => {
    const fremd = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
      detached: true,
      stdio: "ignore",
    });
    fremd.unref();
    const fremdPid = fremd.pid as number;
    try {
      const r = run("foreign-pid", fremdPid);
      expect(r.code, r.output).toBe(80);
      expect(r.output).toContain("Es wird KEIN Signal an ihn gesendet.");
      expect(r.output).toContain(`PID-Datei nennt ${fremdPid}`);
      let fremdLebt = true;
      try {
        process.kill(fremdPid, 0);
      } catch {
        fremdLebt = false;
      }
      expect(fremdLebt).toBe(true);
      expect(r.terminated).toBe("yes");
      expect(r.pidRemains).toBe(false);
    } finally {
      try {
        process.kill(fremdPid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
  }, 120_000);
});
