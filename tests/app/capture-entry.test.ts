// SCRUM-384 / AG-12 / KG-UX-001/002/003/010: Erzähl-Einstieg als Standardweg, Formular als
// Expertenpfad. DOM-freier Helfer — hier ohne DOM getestet.
//
// JOB 3062 · H3 — WAS AUS DIESER DATEI GESTRICHEN IST UND WARUM:
//   · „Erstbesuch → firstRun true" und „defensiv: kaputter Storage" prüften `isCaptureFirstRun` /
//     `markCaptureIntroSeen`. Beide steuerten AUSSCHLIESSLICH die Erstnutzer-Führung
//     (`KnowledgeRescueIntro`) auf der alten Erfassungsseite; sie ist mit dem Standardweg-Kasten
//     gelöscht, ihre Erklärungen liegen im „?"-Menü des Blattes (Auftrag §5).
//   · „Copy ist DE und EN vorhanden" und „Ehrlichkeit: Expertenpfad …" prüften
//     `CAPTURE_ENTRY_TEXT` — die Beschriftungen der gelöschten Modus-Leiste.
// Was diese Datei WEITER prüft, ist der Kern, der geblieben ist: die Modus-Aufzählung und die
// Unterscheidung Erzählweg / Expertenformular. Sie steuert jetzt das Menü „Datei ▾" des Blattes.
import { describe, expect, it } from "vitest";
import {
  CAPTURE_MODES,
  EXPERT_MODE,
  NARRATE_MODES,
  isExpertMode,
} from "../../apps/web/src/lib/captureEntry";

describe("SCRUM-384: captureEntry", () => {
  it("Erzähl-Modi enthalten NICHT das Formular; nichts geht verloren", () => {
    expect(NARRATE_MODES).not.toContain(EXPERT_MODE);
    // Alle Modi bleiben bekannt: die Erzählwege plus der Expertenpfad ergeben die volle Liste.
    expect([...NARRATE_MODES, EXPERT_MODE].sort()).toEqual([...CAPTURE_MODES].sort());
  });

  it("isExpertMode erkennt genau das Formular", () => {
    expect(isExpertMode(EXPERT_MODE)).toBe(true);
    for (const m of NARRATE_MODES) {
      expect(isExpertMode(m)).toBe(false);
    }
  });
});
