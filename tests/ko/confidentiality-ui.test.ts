import { describe, expect, it } from "vitest";
import {
  CONFIDENTIALITY_LEVELS,
  confidentialityOf,
  isConfidential,
  vertraulichkeitsAuskunft,
} from "../../apps/web/src/lib/confidentiality";

describe("SCRUM-415: Vertraulichkeit (Frontend-Helfer)", () => {
  it("kennt genau drei Stufen in stabiler Reihenfolge", () => {
    expect(CONFIDENTIALITY_LEVELS).toEqual(["intern", "vertraulich", "streng_vertraulich"]);
  });

  it("behandelt fehlendes Feld als 'intern'", () => {
    expect(confidentialityOf(undefined)).toBe("intern");
    expect(confidentialityOf(null)).toBe("intern");
    expect(confidentialityOf("vertraulich")).toBe("vertraulich");
    expect(isConfidential(undefined)).toBe(false);
    expect(isConfidential("vertraulich")).toBe(true);
  });

  // JOB 3034: Hier stand die abgelöste Zusage „liefert ein Chip nur für vertrauliche Stufen (nicht
  // für 'intern')" — sie pinnte genau den Satz `showChip: false`, den JOB 3034 entfernt hat, samt
  // der Funktion `confidentialityChip`, die ihn trug. An ihre Stelle tritt dieselbe Prüfung an der
  // Nachfolgerin: JEDE Stufe trägt ein Kennzeichen, und die fehlende sagt, dass sie fehlt.
  // Die Anzeige an den beiden gerenderten Flächen misst `tests/vertraulichkeit-klartext/`.
  it("liefert für JEDE Stufe ein Kennzeichen — auch für 'intern'", () => {
    const i = vertraulichkeitsAuskunft({ confidentiality: "intern" });
    expect(i.showChip).toBe(true);
    expect(i.tone).toBe("neutral");
    expect(i.labelKey).toBe("conf.level.intern");

    const v = vertraulichkeitsAuskunft({ confidentiality: "vertraulich" });
    expect(v.showChip).toBe(true);
    expect(v.tone).toBe("warn");
    expect(v.labelKey).toBe("conf.level.vertraulich");

    const s = vertraulichkeitsAuskunft({ confidentiality: "streng_vertraulich" });
    expect(s.showChip).toBe(true);
    expect(s.tone).toBe("crit");
    expect(s.labelKey).toBe("conf.level.streng_vertraulich");
  });

  it("sagt beim fehlenden Feld 'nicht eingestuft' statt 'intern'", () => {
    const ohne = vertraulichkeitsAuskunft({});
    expect(ohne.showChip).toBe(true);
    expect(ohne.level).toBe(null);
    expect(ohne.provenance).toBe("unknown");
    expect(ohne.labelKey).toBe("conf.level.nichtEingestuft");
  });
});
