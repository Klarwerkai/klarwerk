// ================================================================================================
// BEN, Nacharbeit 2 — DIE OBERGRENZEN DES GEFÜHRTEN LERNEFFEKTS, OHNE STILLEN INHALTSVERLUST.
// ================================================================================================
//
//   G1 Server und Fläche nennen dieselben Grenzen (apps/web importiert nichts aus services/, s.
//      `apps/web/src/lib/draftLimits.ts` — die Drift fängt dieser Vergleich).
//   G2 Die Normalform kürzt nichts mehr: ein Text über der Grenze kommt unverändert zurück; die
//      Grenzprüfung nennt ihn stattdessen.
//   G3 Die Fläche zählt wie der Server (getrimmt, Warnsignale ohne Leer- und Doppelzeilen) und
//      meldet jede Überschreitung mit Feld, Ist und Grenze.
import { describe, expect, it } from "vitest";
import * as web from "../../apps/web/src/lib/negativwissen";
import {
  NEGATIVWISSEN_LIMITS,
  negativwissenGrenzfehler,
  normalizeNegativwissen,
} from "../../services/knowledge-object/src/negativwissen";

describe("Obergrenzen des Lerneffekts", () => {
  it("G1 — Server und Fläche nennen dieselben Grenzen", () => {
    expect(web.NEGATIVWISSEN_LIMITS).toEqual(NEGATIVWISSEN_LIMITS);
  });

  it("G2 — die Normalform kürzt nicht; die Grenzprüfung nennt die Überschreitung", () => {
    const lang = "R".repeat(NEGATIVWISSEN_LIMITS.text + 1);
    const viele = Array.from({ length: NEGATIVWISSEN_LIMITS.warnsignale + 1 }, (_, i) => `W${i}`);
    expect(normalizeNegativwissen({ avoidanceRule: lang })?.avoidanceRule).toBe(lang);
    expect(normalizeNegativwissen({ earlyWarningSigns: viele })?.earlyWarningSigns).toEqual(viele);
    expect(negativwissenGrenzfehler({ avoidanceRule: lang })).toMatch(/avoidanceRule/);
    expect(negativwissenGrenzfehler({ earlyWarningSigns: viele })).toMatch(/höchstens 20/);
    expect(negativwissenGrenzfehler({ earlyWarningSigns: ["S".repeat(301)] })).toMatch(/301/);
    // Genau an der Grenze — und Leer-/Doppelzeilen zählen nicht mit.
    expect(
      negativwissenGrenzfehler({
        avoidanceRule: ` ${"R".repeat(NEGATIVWISSEN_LIMITS.text)} `,
        earlyWarningSigns: [...viele.slice(0, 20), "", "W0"],
      }),
    ).toBeUndefined();
  });

  it("G3 — die Fläche zählt wie der Server und nennt Feld, Ist und Grenze", () => {
    expect(web.negativwissenUeberschreitungen(web.LEERE_NEGATIVWISSEN_FORM)).toEqual([]);
    const zwanzig = Array.from({ length: 20 }, (_, i) => `W${i}`);
    expect(
      web.negativwissenUeberschreitungen({
        ...web.LEERE_NEGATIVWISSEN_FORM,
        impact: "I".repeat(2000),
        warnsignale: [...zwanzig.slice(0, 19), "", "W0", "S".repeat(300)].join("\n"),
      }),
    ).toEqual([]);
    expect(
      web.negativwissenUeberschreitungen({
        ...web.LEERE_NEGATIVWISSEN_FORM,
        impact: "I".repeat(2001),
        warnsignale: [...zwanzig, "W20", "S".repeat(301)].join("\n"),
      }),
    ).toEqual([
      { feld: "impact", art: "zeichen", ist: 2001, max: 2000 },
      { feld: "warnsignale", art: "anzahl", ist: 22, max: 20 },
      { feld: "warnsignale", art: "zeichen", ist: 301, max: 300 },
    ]);
  });
});
