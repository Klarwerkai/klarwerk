// R-1487 — DAS CONTAINER-ABBILD ENTSTEHT AUS EINEM BENANNTEN COMMIT, MIT PRÜFSUMME, OHNE
// VERÖFFENTLICHUNG.
//
// Befund aus der Prüfung (Ben, Kandidat 09a1e475): die Insel-Prüfsumme ersetzt das
// Auslieferungsabbild nicht. `scripts/deploy/abbild-bauen.mjs` baut es jetzt selbst. Gemessen wird
// der echte Bauer als eigener Prozess; `git`, `tar` und `docker` sind Stellvertreter auf dem PATH,
// die jeden Aufruf mitschreiben (dasselbe Muster wie
// `tests/deploy-liefernachweis/live-update-liefernachweis.test.ts`).
// GRENZE: ein echter `docker build` läuft hier nicht. Belegt sind Herleitung der Quellfassung,
// Baukontext, Bauargumente, Prüfsumme, Nachweisdatei und dass nie veröffentlicht wird.
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { fahreNode } from "./hilfen";

const BAUER = repoPfad("scripts/deploy/abbild-bauen.mjs");
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const KENNUNG = `sha256:${"ab".repeat(32)}`;
const INHALT = "ABBILD-ARCHIV-INHALT";
const PAKET = JSON.parse(readFileSync(repoPfad("package.json"), "utf8")) as { version: string };
const VERSION = PAKET.version;
const NAME = `klarwerk-${VERSION}-${COMMIT.slice(0, 12)}`;

interface Nachweis {
  abbild: string;
  abbildKennung: string;
  version: string;
  commit: string;
  sha256: string;
  arbeitsbaumSauber: boolean;
  veroeffentlicht: boolean;
}

const wurzel = mkdtempSync(join(tmpdir(), "kw-abbild-"));
afterAll(() => {
  rmSync(wurzel, { recursive: true, force: true });
});

/** Legt Stellvertreter für git, tar und docker an; jeder Aufruf landet in `aufrufe.log`. */
function platz(name: string): { bin: string; ziel: string; log: string } {
  const ort = join(wurzel, name);
  const bin = join(ort, "bin");
  mkdirSync(bin, { recursive: true });
  const log = join(ort, "aufrufe.log");
  const stub = (befehl: string, rumpf: string[]) => {
    const pfad = join(bin, befehl);
    writeFileSync(pfad, `#!/bin/bash\necho "${befehl} $*" >> "${log}"\n${rumpf.join("\n")}\n`);
    chmodSync(pfad, 0o755);
  };
  // Schreibt `$INHALT_STUB` in die Datei hinter `-o` — so wie `git archive -o` und `docker save -o`.
  const nachO = [
    "while [ $# -gt 0 ]; do",
    '  if [ "$1" = "-o" ]; then printf "%s" "$INHALT_STUB" > "$2"; fi',
    "  shift",
    "done",
  ];
  stub("git", [
    'case "$1" in',
    `  rev-parse) echo ${COMMIT} ;;`,
    '  status) [ -n "$STUB_SCHMUTZIG" ] && echo " M datei.ts" ;;',
    // `git show <commit>:package.json` — die Version DES COMMITS; ohne Vorgabe dieselbe wie im Baum.
    `  show) printf '{"version":"%s"}\\n' "\${STUB_COMMIT_VERSION:-${VERSION}}" ;;`,
    "  archive) INHALT_STUB=quelle",
    ...nachO,
    "  ;;",
    "esac",
    "exit 0",
  ]);
  stub("tar", ["exit 0"]);
  stub("docker", [
    'case "$1" in',
    "  build) exit 0 ;;",
    `  image) echo ${KENNUNG} ;;`,
    `  save) INHALT_STUB=${INHALT}`,
    ...nachO,
    "  ;;",
    "  *) exit 9 ;;",
    "esac",
  ]);
  return { bin, ziel: join(ort, "ziel"), log };
}

function umgebung(bin: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}`, ...extra };
}

function aufrufe(log: string): string[] {
  return readFileSync(log, "utf8").split("\n");
}

describe("R-1487 · Containerbau mit Quellfassung und Prüfsumme, ohne Veröffentlichung", () => {
  it("C1 · baut aus dem Commit, weist Abbild, Kennung und Prüfsumme gemeinsam aus", async () => {
    const p = platz("sauber");
    const lauf = await fahreNode([BAUER, "--ziel", p.ziel], umgebung(p.bin));
    expect(lauf.code, lauf.stderr).toBe(0);
    const aus = JSON.parse(lauf.stdout) as Nachweis;
    const sha = createHash("sha256").update(INHALT).digest("hex");
    expect(aus.abbild).toBe(`klarwerk:${VERSION}-${COMMIT.slice(0, 12)}`);
    expect(aus.abbildKennung).toBe(KENNUNG);
    expect(aus.commit).toBe(COMMIT);
    expect(aus.version).toBe(VERSION);
    expect(aus.sha256).toBe(sha);
    expect(aus.veroeffentlicht).toBe(false);
    expect(aus.arbeitsbaumSauber).toBe(true);
    expect(readFileSync(join(p.ziel, `${NAME}.tar.sha256`), "utf8")).toBe(`${sha}  ${NAME}.tar\n`);
    const nachweis = JSON.parse(readFileSync(join(p.ziel, `${NAME}.json`), "utf8")) as Nachweis;
    expect(nachweis.sha256).toBe(sha);
    expect(nachweis.commit).toBe(COMMIT);
    expect(nachweis.abbildKennung).toBe(KENNUNG);
  });

  it("C2 · Bau mit Commit im Wegwerfkontext, nie im Arbeitsbaum", async () => {
    const p = platz("argumente");
    const lauf = await fahreNode([BAUER, "--ziel", p.ziel], umgebung(p.bin));
    expect(lauf.code, lauf.stderr).toBe(0);
    const zeilen = aufrufe(p.log);
    const archiv = zeilen.find((z) => z.startsWith("git archive")) ?? "";
    expect(archiv.startsWith("git archive --format=tar -o ")).toBe(true);
    expect(archiv.endsWith(` ${COMMIT}`)).toBe(true);
    const bau = zeilen.find((z) => z.startsWith("docker build")) ?? "";
    expect(bau).toContain(`--build-arg SOURCE_COMMIT=${COMMIT}`);
    expect(bau).toContain(`--label org.opencontainers.image.revision=${COMMIT}`);
    expect(bau).toContain(`--label org.opencontainers.image.version=${VERSION}`);
    const kontext = bau.split(" ").pop() ?? "";
    expect(kontext).toContain("klarwerk-abbild-");
    expect(kontext.startsWith(repoPfad("."))).toBe(false);
    // Der Wegwerfkontext ist danach wieder weg.
    expect(existsSync(kontext)).toBe(false);
  });

  it("C3 · nie veröffentlicht: kein push, kein login, kein tag", async () => {
    const p = platz("ohne-veroeffentlichung");
    const lauf = await fahreNode([BAUER, "--ziel", p.ziel], umgebung(p.bin));
    expect(lauf.code, lauf.stderr).toBe(0);
    const docker = aufrufe(p.log).filter((z) => z.startsWith("docker "));
    expect(docker.map((z) => z.split(" ")[1])).toEqual(["build", "image", "save"]);
    expect(readFileSync(BAUER, "utf8")).not.toMatch(/\["(push|login|tag)"/);
  });

  it("C4 · schmutziger Arbeitsbaum: gebaut wird der Commit, und das wird gesagt", async () => {
    const p = platz("schmutzig");
    const env = umgebung(p.bin, { STUB_SCHMUTZIG: "1" });
    const lauf = await fahreNode([BAUER, "--ziel", p.ziel], env);
    expect(lauf.code, lauf.stderr).toBe(0);
    const aus = JSON.parse(lauf.stdout) as Nachweis;
    expect(aus.arbeitsbaumSauber).toBe(false);
    expect(lauf.stderr).toContain("NICHT im Abbild");
  });

  it("C6 · abweichende package.json im Arbeitsbaum: Version kommt aus dem Commit", async () => {
    // Ben, Kandidat fda81e3d: der Baukontext kam aus dem Commit, die Version aus dem Arbeitsbaum.
    // Hier nennt der Commit eine andere Version als die package.json daneben (schmutziger Baum).
    const p = platz("versionsabweichung");
    const imCommit = "9.9.9-im-commit";
    const env = umgebung(p.bin, { STUB_SCHMUTZIG: "1", STUB_COMMIT_VERSION: imCommit });
    const lauf = await fahreNode([BAUER, "--ziel", p.ziel], env);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(imCommit).not.toBe(VERSION);
    const aus = JSON.parse(lauf.stdout) as Nachweis & { arbeitsbaumVersion: string | null };
    const name = `klarwerk-${imCommit}-${COMMIT.slice(0, 12)}`;
    expect(aus.version).toBe(imCommit);
    expect(aus.abbild).toBe(`klarwerk:${imCommit}-${COMMIT.slice(0, 12)}`);
    expect(aus.arbeitsbaumVersion).toBe(VERSION);
    expect(existsSync(join(p.ziel, `${name}.json`))).toBe(true);
    expect(existsSync(join(p.ziel, `${name}.tar.sha256`))).toBe(true);
    const zeilen = aufrufe(p.log);
    expect(zeilen).toContain(`git show ${COMMIT}:package.json`);
    const bau = zeilen.find((z) => z.startsWith("docker build")) ?? "";
    expect(bau).toContain(`--label org.opencontainers.image.version=${imCommit}`);
    expect(bau).not.toContain(`org.opencontainers.image.version=${VERSION}`);
    expect(lauf.stderr).toContain(
      `package.json im Arbeitsbaum nennt ${VERSION}, der Commit ${imCommit}`,
    );
  });

  it("C5 · unbekanntes Argument: Exit 2, nichts gebaut", async () => {
    const p = platz("falsch");
    const lauf = await fahreNode([BAUER, "--zeil", p.ziel], umgebung(p.bin));
    expect(lauf.code).toBe(2);
    expect(existsSync(p.log)).toBe(false);
  });
});
