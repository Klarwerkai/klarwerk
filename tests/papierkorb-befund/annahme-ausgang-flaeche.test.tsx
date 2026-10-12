// @vitest-environment jsdom
// ================================================================================================
// LAUF gesamt-import-adoption:2 RUNDE 3 (Bens B3) — DER BESTAND ÄNDERT SICH ZWISCHEN EINREIHEN
// UND ANNEHMEN.
// ================================================================================================
//
// `flaeche.test.tsx` misst die Fälle, in denen der Befund schon beim EINREIHEN feststeht (der
// Anker liegt dann bereits aktiv im Bestand bzw. im Papierkorb). Ben hat den Fall gemessen, in dem
// er erst bei der ANNAHME entsteht: beide Fassungen werden eingereiht, BEVOR die erste angenommen
// ist — die zweite trug `nicht_gestellt`, wurde aber in As Objekt fortgeschrieben bzw. traf es im
// Papierkorb, und die Karte sagte „KO erzeugt". Seit Runde 3 schreibt die Annahme den Ausgang am
// Herkunftsanker in Antwort und Kandidaten (`acceptToKo`, service.ts).
//
// Derselbe Weg wie Bens Probe: echte Route, echte Seite `ImportReview`, gelesen wird der Kartentext.
import { afterEach, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type FlaechenBruecke,
  type Gemountet,
  flaechenBruecke,
  mounteImportReview,
} from "./flaeche-bruecke";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let b: FlaechenBruecke | undefined;
let m: Gemountet | undefined;

afterEach(() => {
  m?.abbauen();
  b?.abbauen();
  m = undefined;
  b = undefined;
});

for (const papierkorb of [false, true]) {
  const fall = papierkorb
    ? "nach dem Einreihen gelöscht: API und Fläche nennen den Papierkorb mit Kennung"
    : "vor der ersten Anlage eingereiht: API und Fläche nennen die Wiederverwendung mit Kennung";

  it(`B3 · ${fall}`, async () => {
    await i18n.changeLanguage("de");
    b = await flaechenBruecke();
    const bruecke = b;
    const einreihen = async (version: number): Promise<string> => {
      const r = await bruecke.app.inject({
        method: "POST",
        url: "/api/library/import/candidates",
        headers: bruecke.kopf,
        payload: {
          items: [
            {
              title: `B3 Quelle Fassung ${version}`,
              statement: "Den Filter wechseln",
              type: "best_practice",
              category: "Wartung",
              provider: "wiki",
              externalId: "b3-quelle",
              sourceVersion: version,
            },
          ],
        },
      });
      expect(r.statusCode, r.body).toBe(201);
      const id = (r.json() as Array<{ id: string }>)[0]?.id;
      expect(id).toBeTruthy();
      return id as string;
    };
    const annehmen = async (id: string) => {
      const r = await bruecke.app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${id}`,
        headers: bruecke.kopf,
        payload: { action: "accept" },
      });
      expect(r.statusCode, r.body).toBe(200);
      return r.json() as { koId: string | null; dublettenbefund?: unknown };
    };

    const a = await einreihen(1);
    const zweiter = await einreihen(2);
    const zuerst = await annehmen(a);
    expect(zuerst.koId).toBeTruthy();
    if (papierkorb) {
      const weg = await bruecke.app.inject({
        method: "DELETE",
        url: `/api/kos/${zuerst.koId}`,
        headers: bruecke.kopf,
      });
      expect(weg.statusCode, weg.body).toBe(204);
    }
    const danach = await annehmen(zweiter);
    expect(danach.koId, "Keine zweite Kennung.").toBe(zuerst.koId);
    expect(danach.dublettenbefund).toEqual({
      ergebnis: papierkorb ? "im_papierkorb" : "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: zuerst.koId },
    });

    m = await mounteImportReview();
    expect(m.karte("B3 Quelle Fassung 2")).toEqual([
      "Angenommen",
      papierkorb
        ? `liegt im Papierkorb, Kennung ${zuerst.koId}`
        : `vorhanden, Kennung ${zuerst.koId} wiederverwendet`,
    ]);
    // Die erste Fassung hat wirklich angelegt — dort bleibt das Erzeugt-Abzeichen richtig (seit
    // R-0908 „Wissensobjekt angelegt" statt „KO erzeugt", `fachwort.fund.angelegt`).
    expect(m.karte("B3 Quelle Fassung 1")).toContain("Wissensobjekt angelegt");
  });
}
