// ================================================================================================
// R-1089 × R-0894 · DIE ZUSAMMENGEFÜHRTE MELDUNGSART-TABELLE DER STARTSEITE.
// ================================================================================================
//
// `components/start/forYou.ts` war Konfliktstelle zwischen dieser Arbeit (Art `reklamation`) und
// main (Arten `escalation`, `return`; seit Nacharbeit 14 zusätzlich `frische`). Geprüft wird, dass BEIDE Seiten wirken: jede Art behält ihren
// Bereichsnamen und ihre Dringlichkeit; keine fällt still auf den Rückfall `start.fuerdich.art.*`.
import { describe, expect, it } from "vitest";
import {
  type MeldungZeile,
  forYouZeilen,
  meldungMetaKey,
} from "../../apps/web/src/components/start/forYou";

function zeile(kind: MeldungZeile["kind"]): MeldungZeile {
  return { id: `n-${kind}`, kind, title: `Titel ${kind}`, to: null };
}

describe("Meldungsarten nach der Zusammenführung", () => {
  it("Bereichsnamen: Antwortmeldung (R-1089) und Eskalation/Rückgabe (R-0894) stehen nebeneinander", () => {
    expect(meldungMetaKey("reklamation")).toBe("antwortmeldung.meldungArt");
    expect(meldungMetaKey("escalation")).toBe("meldungsart.eskalation.art");
    expect(meldungMetaKey("return")).toBe("meldungsart.rueckgabe.art");
    expect(meldungMetaKey("kenntnisnahme")).toBe("kenntnisnahme.meldungArt");
    // Zweite Zusammenführung (Nacharbeit 14): die Frische-Meldung aus main steht daneben.
    expect(meldungMetaKey("frische")).toBe("frische.meldungArt");
    expect(meldungMetaKey("impact")).toBe("start.fuerdich.art.impact");
  });

  it("Dringlichkeit: Eskalation kritisch, Antwortmeldung und Rückgabe heute, Wirkung später", () => {
    const zeilen = forYouZeilen({
      arbeit: [],
      meldungen: [
        zeile("impact"),
        zeile("reklamation"),
        zeile("frische"),
        zeile("return"),
        zeile("escalation"),
      ],
      kollision: null,
    });
    const stufe = Object.fromEntries(zeilen.map((z) => [z.id, z.severity]));
    expect(stufe).toEqual({
      "meldung-n-escalation": "critical",
      "meldung-n-reklamation": "today",
      "meldung-n-frische": "today",
      "meldung-n-return": "today",
      "meldung-n-impact": "later",
    });
    // Die Reihung folgt der Dringlichkeit: die Eskalation zuerst, die Wirkung zuletzt.
    expect(zeilen[0]?.id).toBe("meldung-n-escalation");
    expect(zeilen[zeilen.length - 1]?.id).toBe("meldung-n-impact");
  });
});
