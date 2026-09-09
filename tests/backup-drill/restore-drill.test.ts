import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const tables = ["kos", "users", "audit", "objects"];
// PATH doubles model only external commands. The real shell script decides all gates.
const stub = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const dir = process.env.PROBE;
const mode = process.env.MODE;
fs.appendFileSync(path.join(dir, 'calls'), JSON.stringify([name, ...args]) + '\n');
if (name === 'createdb') process.exit(0);
if (name === 'psql') {
  const sql = args.at(-1);
  if (sql.includes('information_schema.tables')) {
    const table = sql.match(/table_name='([^']+)'/)?.[1];
    console.log(table ? ((['start-only','mismatch'].includes(mode) || ['kos','users','audit','objects'].includes(table)) && !(mode === 'missing' && ['audit','objects'].includes(table)) ? 1 : 0) : (mode === 'occupied' ? 7 : 0));
  } else {
    const table = sql.match(/FROM (?:public\.)?"?(\w+)/)?.[1];
    if (!['kos','users','audit','objects'].includes(table)) process.exit(94);
    if (mode === 'query-error') process.exit(1);
    console.log(mode === 'empty' ? 0 : (mode === 'mismatch' && table === 'audit' ? 3 : 2));
  }
  process.exit(0);
}
if (name === 'pg_restore') {
  if (!args.includes('--data-only')) process.exit(mode === 'restore-error' ? 1 : 0);
  const table = args.find(a => a.startsWith('--table='))?.slice(8);
  if (!table || !args.includes('--schema=public') || args.at(-1) !== path.join(dir, 'input.dump')) process.exit(95);
  if (mode === 'extract-error') process.exit(1);
  if (mode === 'no-copy') process.exit(0);
  console.log('-- PostgreSQL database dump\nSET statement_timeout = 0;');
  console.log('COPY public.' + table + ' (id, body) FROM stdin;');
  if (mode !== 'empty') console.log('1\ttext with escaped newline\\nnext\n2\t\\\\.');
  if (mode !== 'truncated') console.log('\\.\n\n-- PostgreSQL database dump complete');
  process.exit(0);
}
if (name === 'npx' || name === 'node') {
  if (args.includes('--version')) process.exit(mode === 'tool-missing' ? 1 : 0);
  fs.writeFileSync(path.join(dir, 'start'), JSON.stringify([name, ...args]));
  fs.writeFileSync(process.env.KLARWERK_PID_FILE, String(mode === 'foreign-pid' ? process.ppid : process.pid));
  fs.writeFileSync(path.join(dir, 'actual-pid'), String(process.pid));
  process.on('SIGTERM', () => { fs.writeFileSync(path.join(dir, 'terminated'), 'yes'); process.exit(0); });
  setTimeout(() => process.exit(0), 15000);
} else if (name === 'curl') {
  const url = args.at(-1);
  if (url.endsWith('/health')) console.log('200');
  else if (url.endsWith('/login')) console.log('{"token":"fixture"}\n' + (mode === 'login-error' ? '401' : '200'));
  else console.log(JSON.stringify({ ok: false, serialisationDeviations: 12, linkageBreaks: mode === 'linkage' ? 1 : 0, unresolvedDeviations: mode === 'unresolved' ? 2 : 0, uncheckedDeviations: mode === 'unchecked' ? 3 : 0 }) + '\n' + (mode === 'forbidden' ? '403' : '200'));
} else if (name !== 'npx' && name !== 'node') process.exit(96);
`;

function run(mode = "complete") {
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
        RESTORE_DB: "fixture_drill",
        DRILL_WORKDIR: dir,
        DRILL_LOGIN_EMAIL: "fixture@example.test",
        DRILL_LOGIN_PASSWORT: "fixture",
      },
      encoding: "utf8",
      timeout: 25000,
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
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("Restore-Drill: Schema, Dumpabgleich und Aufrufdisziplin", () => {
  it("A akzeptiert die vier heutigen Kerntabellen", () => {
    const r = run();
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("Glied 4");
  });
  it("B nennt alle fehlenden Tabellen in einer Meldung", () => {
    const r = run("missing");
    expect(r.code, r.output).toBe(22);
    expect(r.output).toMatch(/ABBRUCH \(22\):[^\n]*audit[^\n]*objects/);
    expect(r.start).toBe("");
  });
  it("C zeichnet den produktiven Startbefehl auf", () => {
    const r = run("start-only");
    expect(r.start, r.output).toBe(JSON.stringify(["npx", "tsx", "services/app/src/server.ts"]));
  });
  it("D erkennt Datenverlust mit Tabellenname und beiden Zahlen", () => {
    const r = run("mismatch");
    expect(r.code, r.output).toBe(23);
    expect(r.output).toMatch(/ABBRUCH \(23\):[^\n]*audit[^\n]*Dump=2[^\n]*Datenbank=3/);
    expect(r.start).toBe("");
  });
  it("E vollständiger Stand nennt alle vier Paare und beendet seinen Prozess", () => {
    const r = run();
    expect(r.code, r.output).toBe(0);
    for (const table of tables) expect(r.output).toContain(`${table}: Dump=2 Datenbank=2`);
    expect(r.terminated).toBe("yes");
    expect(r.pidRemains).toBe(false);
  });
  it("leere Kerntabellen sind gemessene 0 = 0", () => {
    const r = run("empty");
    expect(r.code, r.output).toBe(0);
    for (const table of tables) expect(r.output).toContain(`${table}: Dump=0 Datenbank=0`);
  });
  it.each(["extract-error", "no-copy", "truncated", "query-error"])(
    "unmessbare Zählung (%s) scheitert geschlossen",
    (mode) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(24);
      expect(r.output).toMatch(/ABBRUCH \(24\):[^\n]*kos/);
      expect(r.start).toBe("");
    },
  );
  it("fehlendes Startwerkzeug hat eigenen Exitcode", () => {
    const r = run("tool-missing");
    expect(r.code, r.output).toBe(31);
    expect(r.output).toContain("ABBRUCH (31)");
    expect(r.start).toBe("");
  });
  it.each([
    ["no-sidecar", 10],
    ["bad-sidecar", 11],
    ["occupied", 20],
  ] as const)("%s verhindert jeden pg_restore-Aufruf", (mode, code) => {
    const r = run(mode);
    expect(r.code, r.output).toBe(code);
    expect(r.calls).not.toContain('"pg_restore"');
  });
  it.each([
    ["restore-error", 21],
    ["login-error", 60],
    ["forbidden", 61],
    ["linkage", 70],
    ["unresolved", 71],
    ["unchecked", 72],
  ] as const)("bestehendes Gate %s behält Exit %i", (mode, code) => {
    const r = run(mode);
    expect(r.code, r.output).toBe(code);
  });
  it("Reaping lehnt eine fremde PID ohne Signal ab", () => {
    const r = run("foreign-pid");
    expect(r.code, r.output).toBe(80);
    expect(r.output).toContain("KEIN Signal");
    expect(r.terminated).toBe("");
  });
});
