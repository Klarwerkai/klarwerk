import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

// SCRUM-403 (Pedi 03.07.): Interview mit Sprache — Frage vorlesen (SpeechSynthesis) + Antwort
// diktieren (bestehendes Diktat-Muster). Die Browser-APIs selbst sind nicht headless testbar;
// hier wird der sichtbare, ehrliche Wortlaut (DE+EN) absichert: Knöpfe + Nicht-verfügbar-Hinweis.
describe("SCRUM-403: Interview-Sprache i18n", () => {
  const keys = ["capture.ivReadAloud", "capture.ivReadStop", "capture.ivDictNa"];

  it("alle Sprach-Keys sind in DE und EN vorhanden", () => {
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("der Nicht-verfügbar-Hinweis bleibt ehrlich (kein Fake-Feature)", () => {
    expect(String(i18n.getResource("de", "translation", "capture.ivDictNa"))).toMatch(
      /nicht verfügbar/i,
    );
  });
});
