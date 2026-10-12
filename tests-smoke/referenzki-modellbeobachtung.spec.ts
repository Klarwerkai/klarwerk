// produkt:20261009:referenzki-pruefdienst (REF-02, K10, Ben nacharbeit-6) — ECHTE MODELLBEOBACHTUNG
// ÜBER DEN BESTEHENDEN BETREIBERWEG DES VOLLEN SMOKES.
//
// Ben: Der vorhandene erlaubte Zugang soll über den regulären Betreiberweg im Prüfprozess verfügbar
// werden. Für den vollen Smoke gibt es diesen Weg schon: `npm run smoke:ui` füllt den
// Anthropic-Zugang aus `KLARWERK_SHIP_SMOKE_API_KEY`. Fehlt die Variable, bricht
// `playwright.smoke.config.ts` laut ab. Diese Datei liest keinen Schlüsselwert. Sie startet das
// vorhandene Beobachtungsskript (`scripts/referenzki/beobachtung.ts`) als Kindprozess mit der
// geerbten Umgebung. Den Bericht hängt sie als nativen Anhang an.
//
// `@modell`: Das hermetische Tor (`smoke:ui:gate`, `--grep-invert @modell`) führt die Datei nicht
// aus. Gelaufen wird nur einmal, im Projekt `chromium`, damit Firefox und WebKit die echten
// Prüfaufrufe nicht verdreifachen. Kein Ersatzmodus: Ist der Zugang nicht eingerichtet, wird die
// Datei ROT, und der Grund (Variablenname, nie ein Wert) steht im Anhang.
//
// Zugesichert werden die technischen Zusagen und dass wirklich Prüfmodelle gerufen wurden. Nicht
// zugesichert ist, dass das Modell jedes Urteil wie erwartet trifft; Abweichungen stehen im Bericht.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const SKRIPT = "scripts/referenzki/beobachtung.ts";
const WAHL = process.env.KLARWERK_REFERENZ_BEOBACHTUNG_PRUEFER?.trim() || "anthropic";

interface Bericht {
  modellaufrufeNachweis: { pruefLaeufe: number; mitModell: number; modelle: string[] };
  kostengrundlage: Record<string, unknown>;
  ergebnisse: {
    kennung: string;
    erwartet: string[];
    beobachtet: string[];
    status: string;
    grund: string | null;
    pruefer: { modell?: string } | null;
    messung: { modellaufrufe: number };
  }[];
  laufprotokoll: { task: string; model: string | null; dauerMs: number }[];
}

function lauf(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((fertig, fehler) => {
    const kind = spawn("npx", ["--no-install", "tsx", SKRIPT, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    kind.stdout.on("data", (d) => {
      stdout += String(d);
    });
    kind.stderr.on("data", (d) => {
      stderr += String(d);
    });
    kind.on("error", fehler);
    kind.on("close", (code) => fertig({ code, stdout, stderr }));
  });
}

test("REF-02 · K10 — sieben fiktive Fälle gegen das echte Prüfmodell @modell", async () => {
  const info = test.info();
  test.skip(info.project.name !== "chromium", "Einmal je Lauf: nur im Projekt chromium.");
  test.setTimeout(360_000);
  const berichtPfad = info.outputPath("referenzki-beobachtung.json");

  const { code, stdout, stderr } = await lauf(["--pruefer", WAHL, "--bericht", berichtPfad]);
  await info.attach("referenzki-beobachtung-ausgabe.txt", {
    body: `exit ${code}\n--- stdout\n${stdout}\n--- stderr\n${stderr}`,
    contentType: "text/plain",
  });
  // Exit 1 ohne Bericht = Zugang nicht eingerichtet (Grund steht in stderr); Exit 1 mit Bericht =
  // kein einziger Prüflauf mit Modell. Beides ist KEINE Modellbeobachtung.
  expect(code, `Beobachtungsskript endete mit ${code}: ${stderr.trim()}`).toBe(0);

  const text = readFileSync(berichtPfad, "utf8");
  await info.attach("beobachtung.json", { body: text, contentType: "application/json" });
  const bericht = JSON.parse(text) as Bericht;
  console.info(`REF-02 · K10 · Nachweis → ${JSON.stringify(bericht.modellaufrufeNachweis)}`);
  console.info(`REF-02 · K10 · Kostengrundlage → ${JSON.stringify(bericht.kostengrundlage)}`);

  expect(bericht.ergebnisse).toHaveLength(7);
  // Wirklich geprüft: die fünf Fälle mit Fundstelle haben je einen Prüflauf MIT Modell (wie V1).
  expect(bericht.modellaufrufeNachweis.mitModell).toBeGreaterThanOrEqual(5);
  expect(bericht.modellaufrufeNachweis.modelle.length).toBeGreaterThan(0);
  expect(bericht.modellaufrufeNachweis.modelle).not.toContain("fixtur-antwort");
  for (const l of bericht.laufprotokoll.filter((x) => x.task === "referenz")) {
    expect(l.dauerMs).toBeGreaterThanOrEqual(0);
  }
  const nach = (k: string) => bericht.ergebnisse.find((r) => r.kennung === k);
  expect(nach("erfundener_link")?.beobachtet).toEqual(["nicht_pruefbar"]);
  expect(nach("erfundener_link")?.messung.modellaufrufe).toBe(0);
  expect(nach("prueferausfall")?.status).toBe("nicht_pruefbar");
  expect(nach("prueferausfall")?.grund).toBe("zeitlimit");
  for (const r of bericht.ergebnisse) {
    expect(r.pruefer?.modell ?? null).not.toBe("fixtur-antwort");
    expect(r.beobachtet.length).toBeGreaterThan(0);
  }
});
