// ================================================================================================
// JOB B4-INSEL-RELEASE — DER VERTRAGSPRÜFER ARBEITET AUCH, WENN MAN IHN SO RUFT, WIE ES DIE ANLEITUNG SAGT.
// ================================================================================================
//
// DER BEFUND, GEMESSEN AM ECHT GEBAUTEN PAKET (`tests/insel-auslieferung/`): Die Betriebswege rufen
// `schema-vertrag.mjs` über `…/Klarwerk_Insel/current/scripts/insel/` — und `current` ist ein
// Symlink. Die Hauptlauf-Erkennung verglich `resolve(argv[1])` (löst keinen Symlink) mit dem echten
// Ort des Moduls. Beide waren nie gleich, und jeder Aufruf endete mit Exit 0 OHNE Wirkung:
// `pruefen` ließ damit auch einen Downgrade durch, `stand-schreiben` schrieb nichts, `app-version`
// blieb leer — und `rueckfall.sh` meldete nach einem Startfehler „Version nicht belegbar".
//
// Die übrigen Fälle in `tests/insel-update/` rufen den Prüfer über seinen ECHTEN Ort und konnten das
// deshalb nicht sehen. Hier wird er genau so gerufen wie auf der Insel: über `current`.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GRUNDSTUFEN, WURZEL, vertragstext } from "./insel-probe";

const QUELLE = readFileSync(join(WURZEL, "scripts/insel/schema-vertrag.mjs"), "utf8");
const RELEASE = "klarwerk-insel-9.9.9-abcdef12-20260925T000000Z";

let ordner: string | undefined;
afterEach(() => {
  if (ordner !== undefined) {
    rmSync(ordner, { recursive: true, force: true });
    ordner = undefined;
  }
});

/**
 * Eine Insel im Kleinen: `releases/<name>/` mit dem Prüfer und seinem Vertrag, `current` als
 * Symlink darauf. `quelltext` erlaubt der Gegenprobe, den Prüfer mit der alten Erkennung abzulegen.
 */
function insel(quelltext = QUELLE): { wurzel: string; release: string; ueberCurrent: string } {
  ordner = mkdtempSync(join(tmpdir(), "klarwerk-aufruf-current-"));
  const release = join(ordner, "releases", RELEASE);
  mkdirSync(join(release, "scripts", "insel"), { recursive: true });
  writeFileSync(join(release, "scripts", "insel", "schema-vertrag.mjs"), quelltext);
  writeFileSync(
    join(release, "SCHEMA-VERTRAG"),
    vertragstext({ release: RELEASE, appVersion: "9.9.9", stufen: GRUNDSTUFEN }),
  );
  symlinkSync(release, join(ordner, "current"));
  return {
    wurzel: ordner,
    release,
    ueberCurrent: join(ordner, "current", "scripts", "insel", "schema-vertrag.mjs"),
  };
}

function rufe(skript: string, argumente: readonly string[]) {
  const lauf = spawnSync("node", [skript, ...argumente], { encoding: "utf8" });
  return { code: lauf.status, stdout: lauf.stdout ?? "", stderr: lauf.stderr ?? "" };
}

describe("JOB B4-INSEL-RELEASE · schema-vertrag.mjs über den Symlink `current`", () => {
  it("C1 · `app-version` nennt die Version des Releases, auch über `current` gerufen", () => {
    const i = insel();
    const lauf = rufe(i.ueberCurrent, ["app-version", i.release]);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(lauf.stdout).toBe("9.9.9");
  });

  it("C2 · `pruefen` lehnt einen Downgrade auch über `current` ab (Exit 3) — keine stille 0", () => {
    const i = insel();
    const stand = join(i.wurzel, "SCHEMA-STAND");
    writeFileSync(
      stand,
      vertragstext({
        release: "spaeter",
        appVersion: "10.0.0",
        stufen: [...GRUNDSTUFEN, { stufe: "SPAETER_SCHEMA", risiko: "ADDITIV" }],
        bestaetigt: "ja",
      }),
    );
    const lauf = rufe(i.ueberCurrent, ["pruefen", stand, join(i.release, "SCHEMA-VERTRAG")]);
    expect(lauf.code, `${lauf.stdout}${lauf.stderr}`).toBe(3);
    expect(`${lauf.stdout}${lauf.stderr}`).toContain("SPAETER_SCHEMA");
  });

  it("C3 · `stand-schreiben` schreibt den Stand neben die Daten, auch über `current` gerufen", () => {
    const i = insel();
    const ziel = join(i.wurzel, "data", "SCHEMA-STAND");
    mkdirSync(join(i.wurzel, "data"));
    const lauf = rufe(i.ueberCurrent, [
      "stand-schreiben",
      join(i.release, "SCHEMA-VERTRAG"),
      ziel,
      "--bestaetigt",
      "nein",
    ]);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(existsSync(ziel), "der Stand wurde nicht geschrieben").toBe(true);
    expect(readFileSync(ziel, "utf8")).toContain(`release=${RELEASE}`);
  });

  it("C4 · Gegenprobe: mit der alten Erkennung bleibt `app-version` über `current` stumm", () => {
    // Belegt, dass C1 den Fehler wirklich sieht: dieselbe Datei, nur mit der Erkennung von vorher.
    const alt = QUELLE.replace(
      /if \(\n {2}process\.argv\[1\] !== undefined &&\n {2}echterOrt\(process\.argv\[1\]\) === echterOrt\(fileURLToPath\(import\.meta\.url\)\)\n\) \{/,
      "if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {",
    );
    expect(
      alt,
      "die Hauptlauf-Erkennung ließ sich für die Gegenprobe nicht zurückstellen",
    ).not.toBe(QUELLE);
    const i = insel(alt);
    const lauf = rufe(i.ueberCurrent, ["app-version", i.release]);
    expect(lauf.code).toBe(0);
    expect(lauf.stdout, "die alte Erkennung hätte hier nichts ausgeben dürfen").toBe("");
  });
});
