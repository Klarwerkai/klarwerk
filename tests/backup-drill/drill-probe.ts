import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
export const tabellen = pflichttabellenAusDrill();

// Die Tabelle, an der die Störfälle gemessen werden. Bewusst `ko_evidence`: dort steht die
// Zuordnung Datei→Wissensobjekt, und genau sie konnte vor JOB 4097 still verschwinden.
const STOER = "ko_evidence";
export const KO = "ko-4097";
export const OBJ = "obj-4097";
// JOB 4097 R2: die Kennung der BELEGZEILE selbst (`ko_evidence.id`). Sie ist der Anker des
// strukturierten Vergleichs — der Drill verlangt in der Antwort genau diesen Datensatz und an ihm
// genau diese `objectId`. Ein Textvorkommen irgendwo in der Antwort genügt nicht mehr.
export const EV = "ev-4097";
// ADMIN-13: das Kennwort der Anmeldefixture — fiktiv, aber unverwechselbar, damit seine
// Abwesenheit im Protokoll eine Aussage ist.
export const KENNWORT = "drill-kennwort-admin13";

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
  // ADMIN-13 · Glied 3b: die Rollenverteilung der wiederhergestellten Konten.
  if (sql.includes('GROUP BY role')) {
    if (mode === 'rechte-sql-fehler') process.exit(1);
    if (mode === 'empty') process.exit(0);
    console.log(mode === 'rechte-abweichung' ? 'admin/t=2' : 'experte/t=1\nadmin/t=1');
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
  // ADMIN-13: die Konten tragen Rolle und Freigabe — genau die zwei Spalten, die Glied 3b liest.
  if (table === 'users') {
    console.log('COPY public.users (id, name, role, approved) FROM stdin;');
    if (dumpZeilen(table) > 0) console.log('u1\tAda\tadmin\tt\nu2\tBea\texperte\tt');
    console.log('\\.\n');
    console.log('-- PostgreSQL database dump complete');
    process.exit(0);
  }
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

export function run(mode = "complete", fremdPid?: number) {
  const dir = mkdtempSync(join(tmpdir(), "klarwerk-restore-drill-"));
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
        // ADMIN-13: ein eigener, erkennbarer Wert — der Prüfstand sucht ihn im Protokoll und darf
        // ihn dort nicht finden.
        DRILL_LOGIN_PASSWORT: KENNWORT,
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
      // ADMIN-13: das Protokoll der Probe liegt neben dem Dump.
      protokoll: read("letzter-drill.json"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
