// ================================================================================================
// KLARA-OFFICE-02 / UI-MIN-16 · DER NATIVE BAU DIESER FASSUNG — über den VORHANDENEN Bauweg.
// ================================================================================================
//
// produkt:20261011:assistenz-minimalistische-oberflaeche (Ben, Nacharbeit 50): die geänderten
// Swift-Quellen (Fenster.swift, Lage.swift, Steuerung.swift, Schliessen.swift) müssen tatsächlich
// übersetzt werden; Quellenprüfung und Web-Build belegen das nicht, der alte Bau (bddef05c) deckt
// sie nicht. Dieser Fall führt `scripts/klara-office/begleiter-bauen.sh` unverändert aus und bindet
// das Ergebnis an den geprüften Stand: Bau-Kennung = Git-Stand, Fassung = VERSION, Architektur arm64,
// Signaturprüfung des Skripts bestanden, Binär-Prüfsumme vorhanden.
//
// EHRLICHE GRENZE: der Bau braucht macOS mit Swift-Compiler (Xcode bzw. Command Line Tools) und den
// Werkzeugen codesign, lipo, plutil, shasum. Fehlen sie auf dem Prüfrechner, SCHEITERT dieser Fall
// mit genau diesem Grund — er wird nicht übersprungen und nicht als bestanden gemeldet. Er
// installiert und startet nichts (das bleibt die Hostübergabe auf Peters Mac).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL, repoPfad } from "../support/repoPfad";

const APP = "apps/desktop/klara-begleiter";
const WERKZEUGE = ["swiftc", "codesign", "lipo", "plutil", "shasum"];

function vorhanden(befehl: string): boolean {
  return spawnSync("/bin/sh", ["-c", `command -v ${befehl}`], { encoding: "utf8" }).status === 0;
}

describe("N1 · UI-MIN-16 — nativer Bau der geprüften Fassung", () => {
  it("baut das Bündel über begleiter-bauen.sh, gebunden an Git-Stand, Fassung und arm64", () => {
    const fehlend = WERKZEUGE.filter((w) => !vorhanden(w));
    const grund = "Bauumgebung fehlt: macOS mit Swift-Compiler nötig — kein Produktbeleg";
    expect({ plattform: process.platform, fehlend }, grund).toEqual({
      plattform: "darwin",
      fehlend: [],
    });

    const stand = spawnSync("git", ["rev-parse", "--short=8", "HEAD"], {
      cwd: REPO_WURZEL,
      encoding: "utf8",
    });
    expect(stand.status, stand.stderr).toBe(0);
    const bau = stand.stdout.trim();

    const lauf = spawnSync("bash", ["scripts/klara-office/begleiter-bauen.sh"], {
      cwd: REPO_WURZEL,
      encoding: "utf8",
      env: { ...process.env, KLARA_BEGLEITER_BAU: bau },
      timeout: 540_000,
    });
    // Die vollständige Ausgabe (Compilerfehler eingeschlossen) gehört in den Bericht.
    expect(lauf.status, `${lauf.stdout}\n${lauf.stderr}`).toBe(0);

    const text = readFileSync(repoPfad(`${APP}/build/BAU.txt`), "utf8");
    const protokoll: Record<string, string> = {};
    for (const zeile of text.trim().split("\n")) {
      const gleich = zeile.indexOf("=");
      protokoll[zeile.slice(0, gleich)] = zeile.slice(gleich + 1);
    }
    expect(protokoll.bau).toBe(bau);
    expect(protokoll.fassung).toBe(readFileSync(repoPfad(`${APP}/VERSION`), "utf8").trim());
    expect(protokoll.architektur).toBe("arm64");
    expect(protokoll.sha256).toMatch(/^[0-9a-f]{64}$/);
  }, 600_000);
});
