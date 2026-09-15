import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pflichttabellenAusDrill } from "./pflichtsatz";

// ==================================================================================================
// JOB 4010 — DIE PROZESSZUORDNUNG DES RESTORE-DRILLS, AN EINEM ECHTEN PROZESSBAUM GEMESSEN.
// ==================================================================================================
//
// WARUM ES DIESE DATEI BRAUCHT. `restore-drill.test.ts` ersetzt `npx`/`node` durch eine Attrappe,
// die ihre EIGENE PID in die PID-Datei schreibt. Genau daran ist die alte Zuordnung jahrelang
// unbemerkt vorbeigelaufen: im echten Betrieb steht zwischen dem Drill und dem Server der
// npx-Launcher, und der Server hat eine andere PID als `$!`. `start-identitaet.test.ts` misst diese
// Differenz, aber nicht, was der Drill daraus macht.
//
// HIER LAEUFT DER ECHTE BAUM: das unveraenderte `scripts/backup/restore-drill.sh` startet ueber das
// echte `npx` das echte `tsx` und darueber einen echten Serverprozess. Gemessen am 14.09.2026 im
// Cloud-Lauf hingen an einem Start fuenf Prozesse in derselben Gruppe (2234 2247 2248 2256 2266) —
// die Waisen, die der alte Abbruch mit Exit 80 zuruecklassen musste.
//
// WAS HIER FIXTURE IST UND WARUM. Die Rolle der Anwendung spielt eine eigene, winzige `server.ts`
// unter einer Wegwerf-Wurzel; die drei PostgreSQL-Kommandozeilenwerkzeuge sind Attrappen. Dieser
// Test soll OHNE Datenbank und OHNE Docker in jeder Umgebung laufen (Auftrag §5.4), und die
// Prozesszuordnung ist von der Datenhaltung unabhaengig: sie fragt, WELCHEN Prozess der Drill
// trifft, nicht was in der Datenbank steht. `npx`, `tsx`, `node`, `curl` und `ps` sind echt — genau
// die Kette, an der die alte Pruefung gescheitert ist. Der volle Weg mit echtem Dump und echter
// PostgreSQL steht in `echter-wiederanlauf.integration.test.ts`.
//
// DIE WURZEL WIRD UEBER EINEN SYMLINK VERSCHOBEN, NICHT DAS SKRIPT KOPIERT: der Drill leitet seine
// Wurzel aus `dirname "$0"` ab. Unter `<tmp>/scripts/backup/restore-drill.sh` liegt deshalb ein
// Verweis auf die ECHTE Datei — gemessen wird das Original, nicht eine Kopie, die driften kann.
const root = resolve(import.meta.dirname, "../..");

// Spielt im Prozessbaum die Rolle der Anwendung: horcht, schreibt die PID-Datei NACH dem Horchen
// (wie `services/app/src/server.ts`) und beantwortet die drei Routen, die der Drill abfragt.
// FIXTURE_FREMD_PID schreibt bewusst eine FREMDE PID in die Datei — der Fall, den der Drill
// fail-closed abweisen muss.
const fixtureServer = `import { writeFileSync } from "node:fs";
import { createServer } from "node:http";

const server = createServer((req, res) => {
  const url = req.url ?? "";
  if (url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (url.startsWith("/api/auth/login")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ token: "fixture-token" }));
    return;
  }
  if (url.startsWith("/api/audit/verify")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: false,
        serialisationDeviations: 12,
        linkageBreaks: 0,
        unresolvedDeviations: 0,
        uncheckedDeviations: 0,
      }),
    );
    return;
  }
  // JOB 4097 · Glied 7b — die zwei Abrufe des Nutzennachweises. Auch sie gehoeren in diese Fixture:
  // der Drill faehrt sie am ECHTEN curl gegen einen ECHTEN Serverprozess, und genau der Prozessbaum
  // ist die Frage dieser Datei.
  if (url.startsWith("/api/kos/") && url.endsWith("/evidence")) {
    res.writeHead(200, { "content-type": "application/json" });
    // JOB 4097 R2: der Drill vergleicht den DATENSATZ — dieselbe \`id\` wie in der Datenbank, und an
    // ihr dieselbe \`objectId\`. Eine Antwort mit irgendeiner Kennung im Text genuegt ihm nicht mehr.
    res.end(
      JSON.stringify([
        { id: "ev-drill-4097", kind: "attachment", objectId: "obj-drill-4097" },
      ]),
    );
    return;
  }
  if (url.startsWith("/api/objects/") && url.endsWith("/raw")) {
    const bytes = Buffer.alloc(64, 7);
    res.writeHead(200, { "content-type": "application/octet-stream" });
    res.end(bytes);
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("nein");
});

server.listen(Number(process.env.PORT), "0.0.0.0", () => {
  const eigene = process.env.FIXTURE_ECHTE_PID_DATEI;
  if (eigene) {
    writeFileSync(eigene, String(process.pid), "utf8");
  }
  writeFileSync(
    String(process.env.KLARWERK_PID_FILE),
    \`\${process.env.FIXTURE_FREMD_PID ?? process.pid}\\n\`,
    "utf8",
  );
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
`;

// Nur die drei externen PostgreSQL-Werkzeuge. Sie antworten wie ein vollstaendiger, leerer
// Zielbestand mit je zwei Datenzeilen je Pflichttabelle — mehr braucht die Prozessfrage nicht.
//
// JOB 4097: Der Pflichtsatz kommt aus dem Skript selbst (`PFLICHT`), nicht aus einer Abschrift —
// dieselbe eine Wahrheit, gegen die `tabellensatz.test.ts` ihn haelt.
const pgStub = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const tabellen = JSON.parse(process.env.PFLICHT);
if (name === 'createdb') process.exit(0);
if (name === 'psql') {
  const sql = args.at(-1);
  if (sql.includes('FROM ko_evidence')) {
    // JOB 4097 R2: zwei Fragen an denselben Bestand — der Waisen-Scan (keine verwaiste Belegzeile)
    // und die ungefilterte Kandidatenzeile (Belegzeile, Wissensobjekt, Anhang).
    console.log(sql.includes('NOT EXISTS') ? '0 -' : 'ev-drill-4097 ko-drill-4097 obj-drill-4097');
  } else if (sql.includes('information_schema.tables')) {
    console.log(/table_name='([^']+)'/.test(sql) ? 1 : 0);
  } else {
    console.log(2);
  }
  process.exit(0);
}
if (name === 'pg_restore') {
  if (args.includes('--list')) {
    let nr = 100;
    for (const t of tabellen) console.log((nr++) + '; 0 16400 TABLE DATA public ' + t + ' eigentuemer');
    process.exit(0);
  }
  if (!args.includes('--data-only')) process.exit(0);
  const table = args.find(a => a.startsWith('--table='))?.slice(8);
  console.log('COPY public.' + table + ' (id, body) FROM stdin;');
  console.log('1\tzeile eins\n2\tzeile zwei');
  console.log('\\.');
  process.exit(0);
}
process.exit(97);
`;

async function freierPort(): Promise<number> {
  const srv = createServer();
  await new Promise<void>((fertig) => srv.listen(0, "127.0.0.1", fertig));
  const port = (srv.address() as AddressInfo).port;
  await new Promise<void>((fertig) => srv.close(() => fertig()));
  return port;
}

async function portFrei(port: number): Promise<boolean> {
  return await new Promise<boolean>((fertig) => {
    const srv = createServer();
    srv.once("error", () => fertig(false));
    srv.listen(port, "0.0.0.0", () => srv.close(() => fertig(true)));
  });
}

function lebt(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Gemessen wird die GRUPPE, nicht eine einzelne PID: genau die Waisen hinter dem Launcher sind
// der Schaden, den Lieferung 2 ausschliesst.
function gruppenMitglieder(pgid: number): number[] {
  const r = spawnSync("ps", ["-Ao", "pid=,pgid="], { encoding: "utf8" });
  return (r.stdout ?? "")
    .split("\n")
    .map((zeile) => zeile.trim().split(/\s+/))
    .filter((teile) => teile.length === 2 && Number(teile[1]) === pgid)
    .map((teile) => Number(teile[0]));
}

interface Lauf {
  code: number | null;
  ausgabe: string;
  serverPid: number;
  gruppe: number;
  echtePid: number;
  pidDateiBleibt: boolean;
}

const aufraeumen: Array<() => void> = [];
afterEach(() => {
  while (aufraeumen.length > 0) {
    aufraeumen.pop()?.();
  }
});

async function drillLauf(port: number, fremdPid?: number): Promise<Lauf> {
  const wurzel = mkdtempSync(join(tmpdir(), "klarwerk-drill-4010-"));
  aufraeumen.push(() => rmSync(wurzel, { recursive: true, force: true }));

  mkdirSync(join(wurzel, "scripts/backup"), { recursive: true });
  mkdirSync(join(wurzel, "services/app/src"), { recursive: true });
  mkdirSync(join(wurzel, "bin"));
  mkdirSync(join(wurzel, "arbeit"));
  symlinkSync(
    join(root, "scripts/backup/restore-drill.sh"),
    join(wurzel, "scripts/backup/restore-drill.sh"),
  );
  symlinkSync(join(root, "node_modules"), join(wurzel, "node_modules"));
  writeFileSync(
    join(wurzel, "package.json"),
    JSON.stringify({ name: "drill-fixture", type: "module" }),
  );
  writeFileSync(join(wurzel, "services/app/src/server.ts"), fixtureServer);
  writeFileSync(join(wurzel, "bin/package.json"), JSON.stringify({ type: "commonjs" }));
  for (const werkzeug of ["createdb", "psql", "pg_restore"]) {
    writeFileSync(join(wurzel, "bin", werkzeug), `#!${process.execPath}\n${pgStub}`, {
      mode: 0o755,
    });
  }

  const arbeit = join(wurzel, "arbeit");
  const dump = join(arbeit, "quelle.dump");
  writeFileSync(dump, "custom archive, von der pg_restore-Attrappe vertreten");
  writeFileSync(`${dump}.sha256`, createHash("sha256").update(readFileSync(dump)).digest("hex"));
  const echtePidDatei = join(arbeit, "echte-server.pid");

  const ergebnis = spawnSync("bash", [join(wurzel, "scripts/backup/restore-drill.sh"), dump], {
    cwd: wurzel,
    encoding: "utf8",
    timeout: 180_000,
    env: {
      ...process.env,
      PATH: `${join(wurzel, "bin")}:${process.env.PATH}`,
      RESTORE_DB: "fixture_drill_test",
      DRILL_PORT: String(port),
      DRILL_WORKDIR: arbeit,
      DRILL_LOGIN_EMAIL: "fixture@example.test",
      DRILL_LOGIN_PASSWORT: "fixture",
      PFLICHT: JSON.stringify(pflichttabellenAusDrill()),
      FIXTURE_ECHTE_PID_DATEI: echtePidDatei,
      ...(fremdPid === undefined ? {} : { FIXTURE_FREMD_PID: String(fremdPid) }),
    },
  });

  const ausgabe = `${ergebnis.stdout ?? ""}${ergebnis.stderr ?? ""}`;
  const echtePid = existsSync(echtePidDatei)
    ? Number(readFileSync(echtePidDatei, "utf8").trim())
    : 0;
  // Falls der Drill seine Zusage bricht, darf der Test keine Waise zuruecklassen.
  aufraeumen.push(() => {
    if (echtePid > 0 && lebt(echtePid)) {
      try {
        process.kill(echtePid, "SIGKILL");
      } catch {
        /* schon fort */
      }
    }
  });

  return {
    code: ergebnis.status,
    ausgabe,
    serverPid: Number(/Serverprozess (\d+)/.exec(ausgabe)?.[1] ?? 0),
    gruppe: Number(/Prozessgruppe (\d+)/.exec(ausgabe)?.[1] ?? 0),
    echtePid,
    pidDateiBleibt: existsSync(join(arbeit, "klarwerk-drill.pid")),
  };
}

describe("JOB 4010 · Prozesszuordnung am echten npx/tsx-Baum", () => {
  it("P1 · trifft den echten Serverprozess, raeumt die ganze Gruppe ab und gibt den Port frei", async () => {
    const port = await freierPort();
    const lauf = await drillLauf(port);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    // Die acht Glieder sind der Text, den der Betreiber liest — jedes einzeln, keines verschwiegen.
    for (const glied of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(lauf.ausgabe).toContain(`Glied ${glied} —`);
    }
    expect(lauf.ausgabe).toContain("DRILL BESTANDEN");
    // JOB 4097: Glied 7b faehrt am ECHTEN curl gegen den ECHTEN Serverprozess dieser Fixture —
    // beide Abrufe (Belegliste, Anhangsinhalt) und die Byte-Zahl stehen in der Ausgabe.
    expect(lauf.ausgabe).toContain(
      "Glied 7b — Wissensobjekt ko-drill-4097 mit Beleg auf obj-drill-4097",
    );
    expect(lauf.ausgabe).toContain("64 Bytes Anhangsinhalt zurueckgelesen");

    // DER KERN: der Prozess, den der Drill als Server benannt hat, ist derjenige, der auch wirklich
    // horchte — und er ist tot. Beides zusammen, sonst hiesse „beendet" nur „irgendetwas beendet".
    expect(lauf.echtePid).toBeGreaterThan(0);
    expect(lauf.serverPid).toBe(lauf.echtePid);
    expect(lauf.serverPid).not.toBe(lauf.gruppe);
    expect(lebt(lauf.serverPid)).toBe(false);
    expect(gruppenMitglieder(lauf.gruppe)).toEqual([]);
    expect(lauf.pidDateiBleibt).toBe(false);
    expect(await portFrei(port)).toBe(true);
  }, 200_000);

  it("P2 · weist eine fremde PID in der PID-Datei fail-closed ab, ohne sie anzufassen", async () => {
    const port = await freierPort();
    // Ein eigener Prozess in EIGENER Gruppe (detached) — genau das, was der Drill nie treffen darf.
    const fremd = spawn(process.execPath, ["-e", "setTimeout(() => {}, 120000)"], {
      detached: true,
      stdio: "ignore",
    });
    fremd.unref();
    const fremdPid = fremd.pid as number;
    aufraeumen.push(() => {
      try {
        process.kill(fremdPid, "SIGKILL");
      } catch {
        /* schon fort */
      }
    });

    const lauf = await drillLauf(port, fremdPid);

    expect(lauf.code, lauf.ausgabe).toBe(80);
    expect(lauf.ausgabe).toContain(`PID-Datei nennt ${fremdPid}`);
    expect(lauf.ausgabe).toContain("Es wird KEIN Signal an ihn gesendet.");
    // Der Fremdprozess lebt nachweislich noch.
    expect(lebt(fremdPid)).toBe(true);
    // Und die eigene Nachkommenschaft ist trotzdem restlos fort — fail-closed heisst nicht,
    // Waisen zu hinterlassen (Lieferung 2).
    expect(lauf.echtePid).toBeGreaterThan(0);
    expect(lebt(lauf.echtePid)).toBe(false);
    expect(gruppenMitglieder(lauf.gruppe)).toEqual([]);
    expect(await portFrei(port)).toBe(true);
  }, 200_000);
});
