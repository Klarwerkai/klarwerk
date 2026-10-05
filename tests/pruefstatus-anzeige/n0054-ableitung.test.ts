// ================================================================================================
// PRÜFSTATUS-ANZEIGE (N-0054) · „NOCH NICHT FACHLICH GEPRÜFT" — DIE ABLEITUNG UND IHRE GEGENFÄLLE.
// ================================================================================================
//
// Die Einordnung steht nur, wenn die vorhandenen Prüfdaten belegen, dass noch niemand fachlich
// geprüft hat. Jeder Gegenfall unten ist ein Beleg einer Prüfung — dann wird nichts behauptet.
// Die montierte Bibliotheksfläche prüft `n0054-einordnung-am-wert.test.tsx`.
import { describe, expect, it } from "vitest";
import {
  type Pruefeinordnungsquelle,
  nochNichtFachlichGeprueft,
} from "../../apps/web/src/lib/pruefeinordnung";

const UNGEPRUEFT: Pruefeinordnungsquelle = { status: "offen", trust: 0 };

describe("A · nochNichtFachlichGeprueft — nur, was die Daten belegen", () => {
  it("offen, Prüfwert 0, kein Entscheid, keine Stimmen → noch nicht fachlich geprüft", () => {
    expect(nochNichtFachlichGeprueft(UNGEPRUEFT)).toBe(true);
    expect(nochNichtFachlichGeprueft({ ...UNGEPRUEFT, anzeigestatus: "pruefung" })).toBe(true);
    expect(
      nochNichtFachlichGeprueft({ ...UNGEPRUEFT, reviewVotes: { up: 0, warn: 0, down: 0 } }),
    ).toBe(true);
  });

  it.each([
    ["validiert", { status: "validiert" }],
    ["Prüfwert > 0", { trust: 12 }],
    ["Entscheidungsverweis vorhanden", { validationDecisionRef: { auditSeq: 3, auditHash: "h" } }],
    ["rote Stimme (Prüfwert bleibt 0)", { reviewVotes: { up: 0, warn: 0, down: 1 } }],
    ["Server meldet abgelehnt", { anzeigestatus: "abgelehnt" }],
    ["Server meldet Re-Validierung", { anzeigestatus: "revalidierung" }],
  ] as const)("Gegenfall %s → keine Einordnung", (_name, abweichung) => {
    expect(
      nochNichtFachlichGeprueft({
        ...UNGEPRUEFT,
        ...(abweichung as Partial<Pruefeinordnungsquelle>),
      }),
    ).toBe(false);
  });
});
