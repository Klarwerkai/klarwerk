import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

// ================================================================================================
// R-0896 · BESTÄTIGUNGSDIALOGE NACH MARKENREGELN — die Rückfrage liegt auf NEUTRALER Fläche, Rot
// steht nur am gefährlichen Knopf selbst. Ampelfarben bleiben für Status reserviert.
// ================================================================================================
//
// `tests/app/destructive-button-colour.test.ts` (SCRUM-412) sichert die eine Hälfte der Regel: der
// zerstörende KNOPF trägt die Warnfarbe. Die andere Hälfte — die FLÄCHE der Rückfrage trägt sie
// nicht — war ungeprüft, und genau dort stand der Bruch: Stufe 2 des Werksresets
// (`AdminDatenDetails.tsx`, SCRUM-450) lag als ganze Karte auf `bg-trust-crit-bg` mit roter Überschrift,
// rotem Symbol und rotem Fließtext, während Stufe 1 derselben Rückfrage schon neutral war.
//
// Gelesen wird der Quelltext der Rückfrage-Karte, Kommentare entfernt — dieselbe Ebene, auf der
// SCRUM-412 die Knopffarbe prüft. Die Karte reicht von ihrem `data-testid` bis zum Ausführen-Knopf.

const ROH = readFileSync(repoPfad("apps/web/src/pages/AdminDatenDetails.tsx"), "utf8");
const QUELLE = ROH.replace(/\/\*[\s\S]*?\*\//g, " ");

function karte(): { flaeche: string; knopf: string } {
  const start = QUELLE.indexOf('data-testid="adm-factory-rueckfrage"');
  expect(start, "Rückfrage-Karte des Werksresets nicht gefunden").toBeGreaterThan(0);
  const ausfuehren = QUELLE.indexOf('t("adm.factory.execute")', start);
  expect(ausfuehren, "Ausführen-Knopf nicht in der Karte gefunden").toBeGreaterThan(start);
  const knopfStart = QUELLE.lastIndexOf("<button", ausfuehren);
  // Bis zum letzten Knopf: Fläche, Überschrift, Symbol, Text und der neutrale Abbrechen-Knopf.
  return { flaeche: QUELLE.slice(start, knopfStart), knopf: QUELLE.slice(knopfStart, ausfuehren) };
}

describe("R-0896 · Werksreset-Rückfrage: neutrale Fläche, Rot nur am Knopf", () => {
  it("N1 · Fläche, Überschrift, Symbol und Text tragen keine Ampelfarbe", () => {
    const { flaeche } = karte();
    expect(flaeche).toContain("adm.factory.confirm2");
    expect(flaeche).toContain("adm.factory.warnBody");
    expect(flaeche).toContain("adm.factory.cancel");
    expect(flaeche, "Ampelfarbe auf der Rückfrage-Fläche").not.toMatch(
      /trust-(crit|warn|pos)-(bg|fill|text)/,
    );
  });

  it("N2 · die Fläche ist dieselbe neutrale Bauform wie Stufe 1 derselben Rückfrage", () => {
    const { flaeche } = karte();
    expect(flaeche).toContain("border-hairline bg-page");
    const stufe1 = QUELLE.indexOf('t("adm.factory.confirm1")');
    const stufe1Karte = QUELLE.lastIndexOf("<div", stufe1);
    expect(QUELLE.slice(stufe1Karte, stufe1)).toContain("border-hairline bg-page");
  });

  it("N3 · der gefährliche Knopf selbst trägt Rot", () => {
    const { knopf } = karte();
    expect(knopf).toMatch(/bg-trust-crit-text|bg-trust-crit-fill/);
  });
});
