import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ==================================================================================================
// B3 — EINE ZUSTANDSBEHAFTETE `docker`-ATTRAPPE FÜR DEN DOCKERFREIEN VERTRAG VON compose-drill.sh.
// ==================================================================================================
//
// Ersetzt wird AUSSCHLIESSLICH der Befehl `docker`. Alles andere ist echt: `compose-drill.sh`,
// die Compose-Adapter `scripts/backup/compose/pg_dump|pg_restore` und das UNVERÄNDERTE
// `scripts/backup/backup.sh` mit seiner Reservierung, Prüfsumme und Aufbewahrung.
//
// Die Attrappe führt einen kleinen Zustand (Abbilder, Namen, Container), damit die ENTSCHEIDUNGEN
// des Skripts gemessen werden können: Wird bei einem krank startenden Abbild wirklich das vorherige
// Abbild wieder ausgerollt? Bleibt bei einer fehlenden Pflichtvariable der laufende Container
// unberührt? Meldet /health nach der Aktualisierung den neuen Stand?
//
// WAS SIE NICHT BELEGT: dass Docker, Compose und PostgreSQL sich so verhalten. Das belegt allein der
// Lauf auf dem Prüfplatz (docs/operations/restore-drill.md, Abschnitt „Compose-Kundeninstanz").
const root = resolve(import.meta.dirname, "../..");
const DRILL = join(root, "scripts/backup/compose-drill.sh");
export const ADAPTER = join(root, "scripts/backup/compose");
const PROJEKT = "b3test";
export const BILDNAME = `${PROJEKT}-app`;
export const KENNWORT = "stub-kennwort-4711";
export const ALT = "a".repeat(40);
export const NEU = "b".repeat(40);

const attrappe = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zustandDatei = process.env.STUB_ZUSTAND;
const args = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify(args) + '\n');
const z = JSON.parse(fs.readFileSync(zustandDatei, 'utf8'));
// Atomar (eigene Datei, dann rename): echte Parallellaeufe des Skripts rufen die Attrappe gleichzeitig.
const speichern = () => {
  const teil = zustandDatei + '.' + process.pid;
  fs.writeFileSync(teil, JSON.stringify(z));
  fs.renameSync(teil, zustandDatei);
};
const aufloesen = (ref) => z.tags[ref] || z.tags[ref + ':latest'] || (z.bilder[ref] ? ref : undefined);
const jetzt = () => new Date(Date.now() + (z.uhr++) * 1000).toISOString();
const neuerContainer = (dienst, bild) => {
  const id = 'c' + (++z.zaehler);
  z.container[id] = { dienst, bild, gestartet: jetzt() };
  return id;
};
const stdinLesen = () => { try { return fs.readFileSync(0); } catch { return Buffer.alloc(0); } };

function envPflichtFehlt(datei) {
  let text = '';
  try { text = fs.readFileSync(datei, 'utf8'); } catch {}
  for (const v of ['POSTGRES_PASSWORD', 'APP_BASE_URL']) {
    if (!new RegExp('^' + v + '=.+', 'm').test(text)) return v;
  }
  return undefined;
}

if (args[0] === 'compose') {
  let i = 1; let projektOrdner = ''; let envDatei = '';
  while (i < args.length) {
    if (args[i] === '--project-directory') { projektOrdner = args[i + 1]; i += 2; continue; }
    if (args[i] === '--env-file') { envDatei = args[i + 1]; i += 2; continue; }
    if (args[i] === '-p' || args[i] === '-f') { i += 2; continue; }
    break;
  }
  const befehl = args[i]; const rest = args.slice(i + 1);
  const fehlt = envPflichtFehlt(envDatei || path.join(projektOrdner, '.env'));
  if (fehlt) {
    console.error('required variable ' + fehlt + ' is missing a value: ' + fehlt + ' setzen');
    process.exit(15);
  }
  if (befehl === 'config') process.exit(0);
  if (befehl === 'ps') { console.log(z.aktuell[rest[rest.length - 1]] || ''); process.exit(0); }
  if (befehl === 'build') {
    const arg = rest.find((a) => a.startsWith('SOURCE_COMMIT=')) || 'SOURCE_COMMIT=';
    const commit = arg.slice('SOURCE_COMMIT='.length);
    if (process.env.STUB_BAU_ROT === '1') { console.error('build failed'); process.exit(17); }
    const id = 'sha256:' + crypto.createHash('sha256').update('bild-' + commit + '-' + z.zaehler).digest('hex');
    z.bilder[id] = { commit, kaputt: false };
    z.tags[z.bildname] = id; speichern(); process.exit(0);
  }
  if (befehl === 'up') {
    if (process.env.STUB_UP_ROT === '1') { console.error('Error response from daemon: attrappe'); process.exit(19); }
    const dienst = rest[rest.length - 1];
    z.aktuell[dienst] = neuerContainer(dienst, aufloesen(z.bildname)); speichern(); process.exit(0);
  }
  if (befehl === 'restart') {
    for (const dienst of rest) { const c = z.container[z.aktuell[dienst]]; if (c) c.gestartet = jetzt(); }
    z.postmaster = jetzt(); speichern(); process.exit(0);
  }
  if (befehl === 'exec') {
    const dienst = rest[1]; const cmd = rest.slice(2);
    if (dienst === 'app') {
      const c = z.container[z.aktuell.app]; const bild = z.bilder[c.bild] || {};
      const commit = process.env.STUB_FALSCHER_COMMIT === '1' && bild.commit === process.env.STUB_NEU ? 'c'.repeat(40) : (bild.commit || 'unbekannt');
      console.log(JSON.stringify({ status: 'ok', version: '1.0.0-test', commit }));
      process.exit(0);
    }
    if (cmd[0] === 'pg_isready') process.exit(0);
    if (cmd[0] === 'pg_dump') {
      z.dumps = (z.dumps || 0) + 1; speichern();
      process.stdout.write('PGDMP-attrappe-' + z.dumps + '-' + cmd.join(' '));
      process.exit(0);
    }
    if (cmd[0] === 'pg_restore') {
      stdinLesen();
      if (cmd[1] === '--list') { console.log(';\n; Archive'); process.exit(0); }
      const ziel = cmd[cmd.indexOf('-d') + 1];
      if (process.env.STUB_RESTORE_ROT === '1') { console.error('pg_restore: error: attrappe'); process.exit(1); }
      z.tabellen[ziel] = 45; speichern(); process.exit(0);
    }
    if (cmd[0] === 'psql') {
      const sql = cmd[cmd.length - 1];
      const db = cmd[cmd.indexOf('-d') + 1];
      if (process.env.STUB_SQL_ROT && sql.includes(process.env.STUB_SQL_ROT)) { console.error('ERROR: attrappe'); process.exit(1); }
      const name = (re) => (re.exec(sql) || [])[1];
      if (sql.includes('pg_postmaster_start_time')) console.log(z.postmaster);
      else if (sql.includes('md5')) console.log('1:1:' + 'a'.repeat(32) + ':' + 'b'.repeat(32));
      else if (sql.includes('system_identifier')) console.log('7400000000000000001');
      else if (sql.includes('FROM pg_database')) console.log(z.datenbanken.includes(name(/datname='([^']+)'/)) ? '1' : '0');
      else if (sql.includes('information_schema.tables')) console.log(String(z.tabellen[db] ?? 0));
      else if (sql.startsWith('ALTER DATABASE')) {
        const [, von, nach] = /ALTER DATABASE "?([^" ]+)"? RENAME TO "?([^" ]+)"?/.exec(sql);
        z.datenbanken = z.datenbanken.map((d) => (d === von ? nach : d));
        z.tabellen[nach] = z.tabellen[von]; delete z.tabellen[von]; speichern();
      } else if (sql.startsWith('CREATE DATABASE')) {
        const n = name(/CREATE DATABASE "?([^" ]+)"?/); z.datenbanken.push(n); z.tabellen[n] = 0; speichern();
      } else if (sql.startsWith('DROP DATABASE')) {
        const n = name(/EXISTS "?([^" ]+)"?/); z.datenbanken = z.datenbanken.filter((d) => d !== n); delete z.tabellen[n]; speichern();
      }
      process.exit(0);
    }
    process.exit(0);
  }
  if (befehl === 'logs') process.exit(0);
  if (befehl === 'stop') process.exit(process.env.STUB_STOP_ROT === '1' ? 1 : 0);
  console.error('Attrappe: unbekannter compose-Befehl ' + befehl); process.exit(99);
}

if (args[0] === 'inspect') {
  const fmt = args[2]; const c = z.container[args[3]];
  if (!c) process.exit(1);
  const bild = z.bilder[c.bild] || { kaputt: true };
  if (fmt.includes('NetworkSettings')) console.log(z.projekt + '_default');
  else if (fmt.includes('config_files')) console.log(z.configFiles);
  else if (fmt.includes('.State.Status')) console.log(bild.kaputt ? 'restarting|starting|3|1|' + c.gestartet : 'running|healthy|0|0|' + c.gestartet);
  else if (fmt === '{{.Config.Image}}') console.log(z.bildname);
  else if (fmt === '{{.Image}}') console.log(c.bild);
  else if (fmt === '{{.State.StartedAt}}') console.log(c.gestartet);
  process.exit(0);
}
if (args[0] === 'tag') {
  const id = aufloesen(args[1]);
  if (!id) { console.error('no such image ' + args[1]); process.exit(1); }
  z.tags[args[2]] = id; speichern(); process.exit(0);
}
if (args[0] === 'build') {
  const text = args[args.length - 1] === '-' ? stdinLesen().toString('utf8') : 'werkzeug';
  const name = args[args.indexOf('-t') + 1];
  const id = 'sha256:' + crypto.createHash('sha256').update(text).digest('hex');
  z.bilder[id] = { commit: 'kaputt', kaputt: text.includes('Stoerprobe') };
  z.tags[name] = id; speichern(); process.exit(0);
}
if (args[0] === 'logs') { console.log('KLARWERK-Stoerprobe B3: diese Ausgabe startet absichtlich nicht'); process.exit(0); }
if (args[0] === 'image') process.exit(1);
if (args[0] === 'run') {
  const v = []; for (let k = 0; k < args.length; k++) if (args[k] === '-v') v.push(args[k + 1]);
  const austausch = (v.find((m) => m.endsWith(':/austausch')) || '').slice(0, -':/austausch'.length);
  const vitest = args.find((a) => a.startsWith('--outputFile.json=/austausch/'));
  if (vitest) {
    const skip = process.env.STUB_VITEST_SKIP === '1' ? 1 : 0;
    fs.writeFileSync(path.join(austausch, vitest.split('/').pop()), JSON.stringify({ numPendingTests: skip, numTodoTests: 0, numFailedTests: 0 }));
    process.exit(0);
  }
  const stelle = args.indexOf('/b3/nutzlast.mjs');
  if (stelle >= 0) {
    const modus = args[stelle + 1]; const aus = args[stelle + 4] || args[stelle + 3];
    // STUB_VERGLEICH_ROT_NUR=<belegname> stört genau EINEN Vergleich (vergleich-<belegname>.json) — so
    // bleibt z. B. der Vergleich nach dem Rückweg grün, und nur der Rückfallvergleich ist rot (B2).
    const nur = process.env.STUB_VERGLEICH_ROT_NUR;
    const rot = modus === 'vergleichen' && (process.env.STUB_VERGLEICH_ROT === '1' || (!!nur && path.basename(aus) === 'vergleich-' + nur + '.json'));
    fs.writeFileSync(path.join(austausch, path.basename(aus)), JSON.stringify({ ergebnis: rot ? 'abweichung' : 'gleich' }));
    process.exit(rot ? 1 : 0);
  }
  process.exit(0);
}
if (args[0] === 'ps') {
  // Nur die Suche über die Compose-Kennzeichen kennt die Attrappe — und nur Dienst-Container,
  // keine Einmal-Container (oneoff=False muss verlangt sein).
  const dienst = (args.find((a) => a.startsWith('label=com.docker.compose.service=')) || '').split('=').pop();
  if (dienst && args.includes('label=com.docker.compose.oneoff=False')) console.log(z.aktuell[dienst] || '');
  process.exit(0);
}
if (args[0] === 'rm') process.exit(0);
console.error('Attrappe: unbekannter Befehl ' + args.join(' ')); process.exit(98);
`;

export interface Buehne {
  ort: string;
  stack: string;
  arbeit: string;
  belege: string;
  log: string;
  zustand: string;
  env: NodeJS.ProcessEnv;
}

/** Eine Instanz auf der Attrappe: alter Stand läuft gesund, .env vollständig. */
export function buehne(): Buehne {
  const ort = mkdtempSync(join(tmpdir(), "klarwerk-b3-compose-"));
  const bin = join(ort, "bin");
  const stack = join(ort, "instanz");
  const arbeit = join(ort, "arbeit");
  const belege = join(ort, "belege");
  mkdirSync(bin);
  mkdirSync(stack);
  writeFileSync(join(bin, "package.json"), JSON.stringify({ type: "commonjs" }));
  writeFileSync(join(bin, "docker"), `#!${process.execPath}\n${attrappe}`, { mode: 0o755 });
  writeFileSync(
    join(stack, ".env"),
    `POSTGRES_PASSWORD=${KENNWORT}\nAPP_BASE_URL=https://b3.test\n`,
  );
  writeFileSync(join(stack, "docker-compose.prod.yml"), "services: {}\n");
  writeFileSync(join(stack, "Dockerfile"), "FROM scratch\n");
  writeFileSync(join(stack, "PRUEFPLATZ-STAND"), `commit=${ALT} tree=x\n`);
  // Der Bestand, den der Schritt `bestand` über die echte Anwendung anlegen würde — ohne ihn sagt
  // jeder Vergleich ehrlich „nicht gemessen" (Fall O1).
  mkdirSync(join(arbeit, "austausch"), { recursive: true });
  writeFileSync(join(arbeit, "austausch/bestand.json"), JSON.stringify({ koId: "ko-b3" }));
  const log = join(ort, "docker.log");
  writeFileSync(log, "");
  const zustand = join(ort, "zustand.json");
  const altBild = `sha256:${"1".repeat(64)}`;
  writeFileSync(
    zustand,
    JSON.stringify({
      projekt: PROJEKT,
      bildname: BILDNAME,
      zaehler: 2,
      uhr: 0,
      postmaster: "2026-09-25 08:00:00+00",
      bilder: { [altBild]: { commit: ALT, kaputt: false } },
      tags: { [BILDNAME]: altBild },
      container: {
        c1: { dienst: "app", bild: altBild, gestartet: "2026-09-25T08:00:00Z" },
        c2: { dienst: "db", bild: "sha256:pg", gestartet: "2026-09-25T08:00:00Z" },
      },
      aktuell: { app: "c1", db: "c2" },
      configFiles: join(stack, "docker-compose.prod.yml"),
      datenbanken: ["postgres", "klarwerk_prod"],
      tabellen: { klarwerk_prod: 45 },
    }),
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH ?? ""}`,
    STUB_LOG: log,
    STUB_ZUSTAND: zustand,
    STUB_NEU: NEU,
    PROJEKT,
    STACK: stack,
    ARBEIT: arbeit,
    BELEGE: belege,
    B3_LAUF: "20260925T080000Z",
    WARTEN_GESUND: "5",
  };
  env.KLARWERK_DATABASE_URL = undefined;
  env.DATABASE_URL = undefined;
  env.APP_BASE_URL = undefined;
  env.POSTGRES_PASSWORD = undefined;
  env.STOERUNG = undefined;
  env.NEUSTART_AUSLASSEN = undefined;
  return { ort, stack, arbeit, belege, log, zustand, env };
}

/** Eine neuere Ausgabe als Quellbaum (was `PRUEFPLATZ-B.sh vorbereiten <commit>` hinlegt). */
export function neueAusgabe(b: Buehne): string {
  const quelle = join(b.ort, "quelle");
  mkdirSync(quelle);
  writeFileSync(join(quelle, "docker-compose.prod.yml"), "services: {}\n");
  writeFileSync(join(quelle, "Dockerfile"), "FROM scratch\n");
  writeFileSync(join(quelle, "PRUEFPLATZ-STAND"), `commit=${NEU} tree=y\n`);
  return quelle;
}

export function fahre(b: Buehne, args: string[], zusatz: NodeJS.ProcessEnv = {}) {
  const r = spawnSync("bash", [DRILL, ...args], {
    encoding: "utf8",
    env: { ...b.env, ...zusatz },
    timeout: 120_000,
  });
  return { status: r.status, ausgabe: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

export function aufrufe(b: Buehne): string[][] {
  return readFileSync(b.log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((z) => JSON.parse(z) as string[]);
}

export function zustand(b: Buehne): {
  aktuell: Record<string, string>;
  container: Record<string, { bild: string; gestartet: string }>;
  tags: Record<string, string>;
} {
  return JSON.parse(readFileSync(b.zustand, "utf8"));
}

export function belegJson(b: Buehne, name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(b.belege, `b3-20260925T080000Z-${name}`), "utf8"));
}

/** Ändert den Zustand der Attrappe (z. B. die Compose-Dateien, mit denen die Instanz „läuft"). */
export function setzeZustand(b: Buehne, aenderung: Record<string, unknown>): void {
  const z = JSON.parse(readFileSync(b.zustand, "utf8"));
  writeFileSync(b.zustand, JSON.stringify({ ...z, ...aenderung }));
}

/** Die Datenbanken, die die Attrappe führt, und ihre Tabellenzahl. */
export function datenbanken(b: Buehne): {
  datenbanken: string[];
  tabellen: Record<string, number>;
} {
  return JSON.parse(readFileSync(b.zustand, "utf8"));
}

/** Startet das Skript ASYNCHRON — für echte, gleichzeitig laufende Prozesse. */
export function fahreParallel(
  b: Buehne,
  args: string[],
  zusatz: NodeJS.ProcessEnv = {},
): Promise<{ status: number | null; ausgabe: string }> {
  return new Promise((fertig) => {
    const kind = spawn("bash", [DRILL, ...args], { env: { ...b.env, ...zusatz } });
    let ausgabe = "";
    kind.stdout.on("data", (d) => {
      ausgabe += d;
    });
    kind.stderr.on("data", (d) => {
      ausgabe += d;
    });
    kind.on("close", (status) => fertig({ status, ausgabe }));
  });
}
