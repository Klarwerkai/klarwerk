// ================================================================================================
// FE-003 · E8 — `tools/fe003-vorschau`: die Vorschau ist dem Kandidaten zugeordnet, oder sie wird
// abgelehnt. Bens Befunde aus Lauf 2, Runde 2, je als eigener Fall:
//   (1) eine laufende Instanz eines ANDEREN Stands oder ein schmutziger Arbeitsbaum wird beim
//       erneuten `start` nicht still wiederverwendet;
//   (2) `status` gibt einen gescheiterten `/health`-Abruf als Fehler weiter;
//   (3) Cloud-Zugangsdaten der Aufrufer-Shell erreichen den Vorschauprozess nicht, und ein aktives
//       Modell macht den Start rot.
// ================================================================================================
//
// Hermetisch: das Skript läuft in einem Wegwerf-Repository. Statt Oberflächenbau und echtem Server
// stehen dort zwei Stellvertreter an genau den Pfaden, die das Skript aufruft (`vite` im Web-Paket,
// `node_modules/.bin/tsx`). Der Server-Stellvertreter schreibt seine Umgebung in eine Datei und
// beantwortet `/health`, `/api/reasoner/status` und `/fragen` so, wie der echte Server es tut —
// den Commit aus `KLARWERK_BUILD_COMMIT`, wie `services/app/src/build-app.ts` (`buildCommit`).
import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SKRIPT = join(__dirname, "../../tools/fe003-vorschau");

const SERVER_STELLVERTRETER = `#!/usr/bin/env node
const http = require("node:http");
const fs = require("node:fs");
const aussen = process.env.HOME + "/.fe003-stellvertreter";
fs.writeFileSync(aussen + "-umgebung.json", JSON.stringify(process.env));
const aktiv = fs.existsSync(aussen + "-modell-aktiv");
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ status: "ok", version: "9.9.9", commit: process.env.KLARWERK_BUILD_COMMIT }));
    }
    if (req.url === "/api/reasoner/status") {
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ active: aktiv, reachable: aktiv ? "ok" : "none" }));
    }
    res.setHeader("content-type", "text/html");
    res.end('<!doctype html><div id="root"></div>');
  })
  .listen(Number(process.env.PORT), "127.0.0.1");
`;

async function freierPort(): Promise<number> {
  return new Promise((ok, nein) => {
    const s = createServer();
    s.once("error", nein);
    s.listen(0, "127.0.0.1", () => {
      const adr = s.address();
      s.close(() => ok(typeof adr === "object" && adr ? adr.port : 0));
    });
  });
}

let repo = "";
let heim = "";
let port = 0;
let schlaefer: ChildProcess | null = null;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

function vorschau(befehl: string, extra: Record<string, string> = {}) {
  const r = spawnSync(join(repo, "tools/fe003-vorschau"), [befehl], {
    cwd: repo,
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, HOME: heim, KLARWERK_VORSCHAU_PORT: String(port), ...extra },
  });
  return { exit: r.status, aus: `${r.stdout}${r.stderr}` };
}

function stellvertreterUmgebung(): Record<string, string> {
  return JSON.parse(readFileSync(join(heim, ".fe003-stellvertreter-umgebung.json"), "utf8"));
}

beforeEach(async () => {
  port = await freierPort();
  heim = mkdtempSync(join(tmpdir(), "fe003-heim-"));
  repo = mkdtempSync(join(tmpdir(), "fe003-repo-"));
  mkdirSync(join(repo, "tools"));
  copyFileSync(SKRIPT, join(repo, "tools/fe003-vorschau"));
  chmodSync(join(repo, "tools/fe003-vorschau"), 0o755);
  writeFileSync(join(repo, "package.json"), '{ "name": "probe", "version": "9.9.9" }\n');
  mkdirSync(join(repo, "apps/web/node_modules/.bin"), { recursive: true });
  writeFileSync(join(repo, "apps/web/node_modules/.bin/vite"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(repo, "apps/web/node_modules/.bin/vite"), 0o755);
  mkdirSync(join(repo, "node_modules/.bin"), { recursive: true });
  writeFileSync(join(repo, "node_modules/.bin/tsx"), SERVER_STELLVERTRETER);
  chmodSync(join(repo, "node_modules/.bin/tsx"), 0o755);
  writeFileSync(join(repo, ".gitignore"), ".local/\nnode_modules/\napps/web/node_modules/\n");
  git("init", "-q");
  git("-c", "user.name=probe", "-c", "user.email=probe@example.invalid", "add", "-A");
  git("-c", "user.name=probe", "-c", "user.email=probe@example.invalid", "commit", "-qm", "a");
});

afterEach(() => {
  vorschau("stop");
  schlaefer?.kill();
  schlaefer = null;
  rmSync(repo, { recursive: true, force: true });
  rmSync(heim, { recursive: true, force: true });
});

describe("FE-003 E8 · tools/fe003-vorschau ordnet die Vorschau dem Kandidaten zu", () => {
  it("frischer Start: Commit und Version geprüft, KI aus, Cloud-Zugangsdaten erreichen den Server nicht", () => {
    const r = vorschau("start", {
      ANTHROPIC_API_KEY: "probe-nicht-echt",
      OPENAI_API_KEY: "probe-nicht-echt",
      KLARWERK_REASONER_POLICY: "cloud",
      DATABASE_URL: "postgres://probe.invalid/x",
    });
    expect(r.exit, r.aus).toBe(0);
    expect(r.aus).toContain(`/health commit:  ${git("rev-parse", "HEAD")}`);
    expect(r.aus).toContain("KI: active=false, reachable=none");
    const umgebung = stellvertreterUmgebung();
    for (const name of [
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "KLARWERK_REASONER_POLICY",
      "DATABASE_URL",
    ]) {
      expect(umgebung[name], `${name} darf den Vorschauserver nicht erreichen`).toBeUndefined();
    }
    expect(umgebung.KLARWERK_SKIP_KEYCHAIN).toBe("1");
    expect(umgebung.KLARWERK_BUILD_COMMIT).toBe(git("rev-parse", "HEAD"));
    expect(umgebung.EXTERNAL_SEARCH).toBe("off");
    expect(vorschau("status").exit).toBe(0);
  });

  it("(1) eine laufende Instanz eines anderen Stands wird abgelehnt — bei start UND status", () => {
    expect(vorschau("start").exit).toBe(0);
    git(
      "-c",
      "user.name=probe",
      "-c",
      "user.email=probe@example.invalid",
      "commit",
      "--allow-empty",
      "-qm",
      "b",
    );
    const neu = vorschau("start");
    expect(neu.exit).not.toBe(0);
    expect(neu.aus).toContain("ABGELEHNT");
    expect(neu.aus).toContain(git("rev-parse", "HEAD"));
    expect(vorschau("status").exit).not.toBe(0);
  });

  it("(1) ein schmutziger Arbeitsbaum wird auch bei laufender Instanz abgelehnt", () => {
    expect(vorschau("start").exit).toBe(0);
    writeFileSync(join(repo, "neu.txt"), "nicht festgehalten\n");
    const r = vorschau("start");
    expect(r.exit).not.toBe(0);
    expect(r.aus).toContain("Arbeitsbaum");
    expect(vorschau("status").exit).not.toBe(0);
  });

  it("(2) status mit lebender PID, aber ohne erreichbaren Server: Fehler statt leerer Felder", () => {
    schlaefer = spawn("sleep", ["60"]);
    mkdirSync(join(repo, ".local/run"), { recursive: true });
    writeFileSync(join(repo, `.local/run/fe003-vorschau-${port}.pid`), String(schlaefer.pid));
    const r = vorschau("status");
    expect(r.exit).not.toBe(0);
    expect(r.aus).toContain("/health");
    expect(vorschau("start").exit, "auch start verwendet sie nicht wieder").not.toBe(0);
  });

  it("(3) meldet der Server ein aktives Modell, ist der Start rot und die Instanz wieder weg", () => {
    writeFileSync(join(heim, ".fe003-stellvertreter-modell-aktiv"), "");
    const r = vorschau("start");
    expect(r.exit).not.toBe(0);
    expect(r.aus).toContain("zugesagt ist KI aus");
    expect(existsSync(join(repo, `.local/run/fe003-vorschau-${port}.pid`))).toBe(false);
  });
});
