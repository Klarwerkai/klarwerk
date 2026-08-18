import { describe, expect, it } from "vitest";
import {
  type Ausnahme,
  type Fallergebnis,
  bilanziere,
  klassifiziere,
  meldung,
  torurteil,
} from "./smoke-torlogik";

// ================================================================================================
// JOB 1050 / D2 — EHRLICHE ERGEBNISSEMANTIK UND FACHLICHE FEHLERKLASSIFIKATION
// ================================================================================================
//
// BEN3 KORREKTURPFLICHT 2 (K1/K2 neu schneiden), woertlich:
//   „Jeder unerwartete Fehler eines unterstuetzten Browsers blockiert zunaechst. Eine Ausnahme
//    wird erst nach Ursachenbeleg, korrektem Produktfallback oder ausdruecklicher
//    Ownerentscheidung mit Verantwortlichem und Ablaufdatum zulaessig; die Engineanzahl allein
//    klassifiziert keine Ursache."
//
// BEN3 KORREKTURPFLICHT 3 (Ergebnissemantik), woertlich:
//   „pro Engine getrennte Zahlen fuer entdeckt, bestanden, fehlgeschlagen und uebersprungen;
//    `95/95` nur bei 95 tatsaechlich bestandenen Faellen; `MESSUNG UNBELEGT` beziehungsweise
//    BLOCKIERT schliesst das Tor nicht und liefert einen definierten Nichtnull-Exit."
// ================================================================================================

const fall = (
  engine: string,
  titel: string,
  status: Fallergebnis["status"],
  extra: Partial<Fallergebnis> = {},
): Fallergebnis => ({ datei: "ui-smoke.spec.ts", titel, engine, status, ...extra });

const ENGINES = ["chromium", "firefox", "webkit"] as const;

describe("JOB 1050 D2 · E — ehrliche Ergebnissemantik (BEN3 Pflicht 3)", () => {
  it("E1 · ein LAUFZEIT-SKIP wird als uebersprungen gezaehlt, nicht als bestanden", () => {
    const ergebnisse = [
      fall("chromium", "A", "passed"),
      fall("chromium", "B", "skipped", { skipGrund: "Browserfaehigkeit fehlt" }),
    ];
    const [chromium] = bilanziere(ergebnisse);
    expect(chromium?.entdeckt, "entdeckt zaehlt beide").toBe(2);
    expect(chromium?.bestanden, "ein Skip ist NICHT bestanden").toBe(1);
    expect(chromium?.uebersprungen, "der Skip muss sichtbar sein").toBe(1);
  });

  it("E2 · `timedOut` und `interrupted` sind nicht bestanden", () => {
    const [b] = bilanziere([
      fall("chromium", "A", "timedOut"),
      fall("chromium", "B", "interrupted"),
    ]);
    expect(b?.bestanden, "ein Timeout ist kein Bestehen").toBe(0);
    expect(b?.fehlgeschlagen, "Timeout und Abbruch sind Fehlschlaege").toBe(2);
  });

  it("E3 · die Zahlen sind PRO ENGINE getrennt", () => {
    const bilanzen = bilanziere([
      fall("chromium", "A", "passed"),
      fall("firefox", "A", "failed"),
      fall("webkit", "A", "skipped"),
    ]);
    expect(bilanzen.map((b) => b.engine)).toEqual(["chromium", "firefox", "webkit"]);
    expect(bilanzen.map((b) => b.bestanden)).toEqual([1, 0, 0]);
    expect(bilanzen.map((b) => b.fehlgeschlagen)).toEqual([0, 1, 0]);
    expect(bilanzen.map((b) => b.uebersprungen)).toEqual([0, 0, 1]);
  });

  it("E4 · `n/n` steht NUR, wenn n Faelle tatsaechlich bestanden sind", () => {
    // Der Kern von BEN3s Scheinbeleg-Befund: 3 entdeckt, 1 uebersprungen → niemals `3/3`.
    const bilanzen = bilanziere([
      fall("chromium", "A", "passed"),
      fall("chromium", "B", "passed"),
      fall("chromium", "C", "skipped", { skipGrund: "dynamischer Browser-Skip" }),
    ]);
    const text = meldung(bilanzen);
    expect(text, "3/3 waere eine Scheinaussage — einer lief gar nicht").not.toMatch(/\b3\/3\b/);
    expect(text, "die Skipzahl muss sichtbar sein").toMatch(/uebersprungen 1|übersprungen 1/);
  });

  it("E5 · MESSUNG UNBELEGT schliesst das Tor NICHT und liefert Nichtnull-Exit", () => {
    // Kein Ergebnis heisst nicht gruen. Genau das war die Luecke: ein Lauf ohne Messung durfte
    // durchgehen.
    const urteil = torurteil([], []);
    expect(urteil.geschlossen, "ein Tor ohne Messung darf nicht schliessen").toBe(false);
    expect(urteil.exit, "ein definierter Nichtnull-Exit").not.toBe(0);
    expect(urteil.text).toMatch(/MESSUNG UNBELEGT/);
  });

  it("E6 · BLOCKIERT schliesst das Tor NICHT und liefert Nichtnull-Exit", () => {
    const bilanzen = bilanziere([fall("chromium", "A", "passed")]);
    const urteil = torurteil(bilanzen, ["BLOCKIERT"]);
    expect(urteil.geschlossen, "ein blockierter Lauf darf nicht schliessen").toBe(false);
    expect(urteil.exit).not.toBe(0);
    expect(urteil.text).toMatch(/BLOCKIERT/);
  });
});

describe("JOB 1050 D2 · K — Fehlerklassifikation nach URSACHE (BEN3 Pflicht 2)", () => {
  it("K1 · ein unerwarteter Fehler EINER unterstuetzten Engine BLOCKIERT zunaechst", () => {
    // BEN3s Prueflücke 2, Fall „echter UI-Defekt nur in WebKit". Die alte Regel gab ihn als
    // zulaessige Engine-Eigenheit frei, weil nur eine Engine betroffen war.
    const alle = [
      fall("chromium", "Bildanker", "passed"),
      fall("firefox", "Bildanker", "passed"),
      fall("webkit", "Bildanker", "failed", { fehler: "Anker nicht gesetzt" }),
    ];
    expect(
      klassifiziere(alle[2] as Fallergebnis, alle),
      "ein Ein-Engine-Fehler ohne Ursachenbeleg wird freigegeben",
    ).toBe("BLOCKIERT");
  });

  it("K2 · ein Fehler in DREI Engines ist kein Produktbeleg — er blockiert ebenfalls", () => {
    // BEN3s Prueflücke 2, Fall „gemeinsamer Harnessfehler in drei Engines". Die alte Regel
    // erklaerte ihn zum Produktdefekt (K1), obwohl Harness, Server oder Umgebung die Ursache
    // sein koennen. Die Zahl der Engines klassifiziert keine Ursache.
    const alle = ENGINES.map((e) => fall(e, "Anmeldung", "failed", { fehler: "ECONNREFUSED" }));
    expect(
      klassifiziere(alle[0] as Fallergebnis, alle),
      "die Engineanzahl darf keine Ursache behaupten",
    ).toBe("BLOCKIERT");
  });

  it("K3 · eine Ausnahme gilt NUR mit Verantwortlichem, Grund und gueltigem Ablaufdatum", () => {
    const alle = [fall("webkit", "Bildanker", "failed", { fehler: "kein Support" })];
    const ausnahme: Ausnahme = {
      datei: "ui-smoke.spec.ts",
      titel: "Bildanker",
      engine: "webkit",
      grund: "WebKit unterstuetzt die Fähigkeit nachweislich nicht; Produktfallback greift",
      verantwortlich: "Pedi",
      laeuftAb: "2026-12-31",
    };
    expect(klassifiziere(alle[0] as Fallergebnis, alle, [ausnahme], "2026-08-18")).toBe("K2");
  });

  it("K4 · eine ABGELAUFENE Ausnahme traegt nicht mehr", () => {
    const alle = [fall("webkit", "Bildanker", "failed", { fehler: "kein Support" })];
    const abgelaufen: Ausnahme = {
      datei: "ui-smoke.spec.ts",
      titel: "Bildanker",
      engine: "webkit",
      grund: "belegt",
      verantwortlich: "Pedi",
      laeuftAb: "2026-01-01",
    };
    expect(
      klassifiziere(alle[0] as Fallergebnis, alle, [abgelaufen], "2026-08-18"),
      "eine abgelaufene Ausnahme ist keine Ausnahme",
    ).toBe("BLOCKIERT");
  });

  it("K5 · eine Ausnahme OHNE Verantwortlichen oder Grund traegt nicht", () => {
    const alle = [fall("webkit", "Bildanker", "failed")];
    const ohneOwner = {
      datei: "ui-smoke.spec.ts",
      titel: "Bildanker",
      engine: "webkit",
      grund: "",
      verantwortlich: "",
      laeuftAb: "2026-12-31",
    } as Ausnahme;
    expect(klassifiziere(alle[0] as Fallergebnis, alle, [ohneOwner], "2026-08-18")).toBe(
      "BLOCKIERT",
    );
  });

  it("K6 · eine Ausnahme fuer EINE Engine deckt keine andere", () => {
    const alle = [fall("webkit", "Bildanker", "failed"), fall("firefox", "Bildanker", "failed")];
    const nurWebkit: Ausnahme = {
      datei: "ui-smoke.spec.ts",
      titel: "Bildanker",
      engine: "webkit",
      grund: "belegt",
      verantwortlich: "Pedi",
      laeuftAb: "2026-12-31",
    };
    expect(klassifiziere(alle[0] as Fallergebnis, alle, [nurWebkit], "2026-08-18")).toBe("K2");
    expect(
      klassifiziere(alle[1] as Fallergebnis, alle, [nurWebkit], "2026-08-18"),
      "die Ausnahme deckt firefox nicht",
    ).toBe("BLOCKIERT");
  });

  it("K7 · ein blockierender Fehler schliesst das Tor nicht", () => {
    const bilanzen = bilanziere([fall("webkit", "Bildanker", "failed")]);
    const urteil = torurteil(bilanzen, ["BLOCKIERT"]);
    expect(urteil.geschlossen).toBe(false);
    expect(urteil.exit).not.toBe(0);
  });
});
