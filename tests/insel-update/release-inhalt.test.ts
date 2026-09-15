// ================================================================================================
// JOB 4012 — DER BETRIEBSWEG MUSS IM RELEASE LIEGEN, sonst gibt es ihn auf der Insel nicht.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT: Auf dem Mac Studio liegt KEIN Repo. Was nicht in `dist/insel/<v>.zip`
// steckt, ist dort nicht vorhanden — und ein Rueckweg, den man erst holen muss, ist im Ernstfall
// keiner. `build-current-release.mjs` legt die vier Wege und den Vertrag deshalb in jedes Release.
//
// WAS HIER GEMESSEN WIRD UND WAS NICHT — die Grenze gehoert an dieselbe Stelle wie die Behauptung:
// Der VOLLE Baulauf ist hier nicht fahrbar (er ruft `npm ci --omit=dev` und `zip`; `zip` fehlt im
// Pruefstand, gemessen am Cloud-Laeufer 8b610ee9). Gemessen werden deshalb die zwei Dinge, die
// wirklich brechen koennen: dass die Datei ladbar ist und ihre Einfuhr die Namen findet, die sie
// benutzt — und dass die Liste der mitgelieferten Wege vollstaendig ist. Ein voller Baulauf samt
// Auspacken auf einem Mac bleibt eine Handprobe und wird hier nicht behauptet.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WURZEL } from "./insel-probe";

const BAU = join(WURZEL, "scripts/insel/build-current-release.mjs");
const quelle = readFileSync(BAU, "utf8");

describe("JOB 4012 · was ein Release mitbringt", () => {
  it("B1 · die Baudatei laedt und ihre Einfuhr findet die benutzten Namen", () => {
    // `node --check` faengt den Syntaxfehler, die Einfuhrprobe den umbenannten Export. Beides sind
    // Fehler, die sonst ERST beim naechsten Release auffielen — also beim Kunden.
    const syntax = spawnSync("node", ["--check", BAU], { encoding: "utf8" });
    expect(syntax.status, syntax.stderr ?? "").toBe(0);

    const einfuhr = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import * as m from ${JSON.stringify(join(WURZEL, "scripts/insel/schema-vertrag.mjs"))};
process.stdout.write(Object.keys(m).sort().join(","));`,
      ],
      { encoding: "utf8" },
    );
    expect(einfuhr.status, einfuhr.stderr ?? "").toBe(0);
    for (const name of ["stufenAusBaum", "vertragstext"]) {
      expect(einfuhr.stdout.split(","), `build-current-release.mjs benutzt ${name}`).toContain(
        name,
      );
    }
  });

  it("B2 · jedes Release traegt beide Betriebswege, den Vertrag und die Sicherungswerkzeuge", () => {
    for (const weg of [
      "update-einspielen.sh",
      "rueckfall.sh",
      "insel-betrieb.sh",
      "schema-vertrag.mjs",
      "backup.sh",
      "restore-drill.sh",
    ]) {
      expect(quelle, `${weg} fehlt in der Mitlieferung`).toContain(`"${weg}"`);
    }
    expect(quelle).toContain('join(releaseDir, "SCHEMA-VERTRAG")');
    expect(quelle, "der Vertrag muss aus dem echten Migrationsbeleg kommen").toContain(
      "stufenAusBaum(repo)",
    );
    // Der Modus wird gesetzt, nicht geerbt: `writeExecutable` schreibt 0755.
    expect(quelle).toMatch(/writeExecutable\(ziel,\s*readFileSync/);
  });

  it("B3 · ABLOESUNG: ROLLBACK.md nennt das Skript und nicht mehr die Handgriffe", () => {
    // NACHGEFUEHRT IN RUNDE 2: Der Text liegt nicht mehr als Vorlage in der Baudatei, sondern in
    // `release-texte.mjs` — dort ist er ohne Nebenwirkung ERZEUGBAR. Gemessen wird deshalb das
    // Erzeugnis selbst statt eines Ausschnitts aus dem Quelltext; die Frage bleibt dieselbe.
    const erzeugt = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { rollbackText } from ${JSON.stringify(join(WURZEL, "scripts/insel/release-texte.mjs"))};
process.stdout.write(rollbackText("klarwerk-insel-probe"));`,
      ],
      { encoding: "utf8" },
    );
    expect(erzeugt.status, erzeugt.stderr ?? "").toBe(0);
    const rollback = erzeugt.stdout;
    expect(quelle, "die Baudatei muss diesen Text ins Release legen").toContain(
      "rollbackText(version)",
    );
    expect(rollback).toContain("rueckfall.sh");
    // Zwei Wege zum selben Ziel heisst: der ungeuebte wird im Ernstfall gefahren. Genau die drei
    // Handgriffe von frueher duerfen nicht danebenstehen bleiben.
    for (const handgriff of ["ln -sfn", "nohup", "server-3002.pid"]) {
      expect(rollback, `„${handgriff}" steht weiter als zweiter Weg daneben`).not.toContain(
        handgriff,
      );
    }
  });
});
