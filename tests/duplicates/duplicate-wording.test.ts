import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// SCRUM-486 D: kein leeres „Zusammenführen"-Versprechen. Es gibt keine echte Merge-Aktion (nur
// Getrennt lassen / Verlinken / Fehlalarm), also darf die Copy keinen Merge-Button/CTA vortäuschen.
// Der Merge selbst ist ein bewusst separates Folge-Feature — hier nur ehrliche Sprache.
describe("SCRUM-486 D: ehrliches Merge-Wording", () => {
  const i18n = readFileSync("apps/web/src/i18n.ts", "utf8");

  it("der Seitentitel verspricht kein Zusammenführen mehr", () => {
    expect(i18n).toContain('"dup.title": "Doppelungen klären');
    expect(i18n).not.toContain('"dup.title": "Doppelungen zusammenführen');
    expect(i18n).not.toContain('"dup.title": "Merge duplicates');
  });

  it("die Empfehlung zeigt auf die real vorhandenen Aktionen, nicht auf einen Merge-Button", () => {
    // Das alte, kahle „Zusammenführen" als Empfehlungslabel ist weg.
    expect(i18n).not.toContain('"dup.rec.zusammenfuehren": "Zusammenführen"');
    expect(i18n).not.toContain('"dup.rec.zusammenfuehren_pruefen": "Zusammenführen prüfen"');
    // Die neue Empfehlung nennt eine real vorhandene Handlung (verlinken).
    expect(i18n).toContain("Starke Überschneidung — verlinken");
    expect(i18n).toContain("Strong overlap — link");
  });

  it("das Intro sagt ehrlich, dass es kein automatisches Zusammenführen gibt", () => {
    expect(i18n).toContain("Ein automatisches Zusammenführen gibt es bewusst nicht.");
    expect(i18n).toContain("There is deliberately no automatic merge.");
  });
});
