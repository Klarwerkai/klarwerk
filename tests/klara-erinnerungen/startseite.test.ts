// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · DIE ERINNERUNG AUF DER STARTSEITE.
// ================================================================================================
//
// Nacharbeit 1: die Glocke kennt seit Klara 10 die Art `erinnerung`; „Für dich" auf der Startseite
// (`components/start/forYou.ts`, gespeist aus denselben Meldungen) kannte sie nicht — der
// Produktbau brach an `pages/Start.tsx` ab (TS2322). Geprüft wird, dass die zugestellte Erinnerung
// dort mit eigenem Bereichsnamen (DE/EN/NL) und als Arbeit von heute steht — nicht über den Rückfall.
import { describe, expect, it } from "vitest";
import {
  type MeldungZeile,
  forYouZeilen,
  meldungMetaKey,
} from "../../apps/web/src/components/start/forYou";
import texte from "../../apps/web/src/texte/klaraerinnerung";

function zeile(kind: MeldungZeile["kind"]): MeldungZeile {
  return { id: `n-${kind}`, kind, title: `Titel ${kind}`, to: "/aufgaben?erinnerung=e-1" };
}

describe("Klara 10 · Erinnerung in „Für dich“", () => {
  it("eigener Bereichsname in allen drei Sprachen, Dringlichkeit heute", () => {
    expect(meldungMetaKey("erinnerung")).toBe("klaraerinnerung.meldungArt");
    for (const sprache of ["de", "en", "nl"] as const) {
      expect(texte[sprache]["klaraerinnerung.meldungArt"]?.length ?? 0, sprache).toBeGreaterThan(3);
    }
    const zeilen = forYouZeilen({
      arbeit: [],
      meldungen: [zeile("impact"), zeile("erinnerung")],
      kollision: null,
    });
    const stufe = Object.fromEntries(zeilen.map((z) => [z.id, z.severity]));
    expect(stufe).toEqual({ "meldung-n-erinnerung": "today", "meldung-n-impact": "later" });
    expect(zeilen[0]?.id).toBe("meldung-n-erinnerung");
  });
});
