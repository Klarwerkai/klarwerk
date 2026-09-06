// ================================================================================================
// JOB 3112 · V3 · TEST 7 — DER PAARHINWEIS ALS REGEL: OHNE ANTWORT KEINE AUSSAGE.
// ================================================================================================
//
// Rein und DOM-frei. Die härteste Zusicherung steht gleich am Anfang: `undefined` (lädt, oder
// Fehler ohne je geholten Stand) ergibt `null` — nicht einen leeren Hinweis, nicht „keine
// Dublette". Wer das eine durch das andere ersetzt, macht aus einer fehlenden Antwort eine
// Entwarnung.
import { describe, expect, it } from "vitest";

import type { OverlapEntry, OverlapRelation } from "../../apps/web/src/api/types";
import { relationLabelKey } from "../../apps/web/src/lib/duplicateBoard";
import { BEZIEHUNGS_RANG, doppelhinweis } from "../../apps/web/src/lib/validationDoppelhinweis";

function paar(over: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id: "d1",
    koA: "k1",
    koB: "k9",
    relation: "teilweise",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren_pruefen",
    status: "offen",
    pairKey: "k1|k9",
    origin: "auto",
    createdAt: "2026-08-12T00:00:00.000Z",
    ...over,
  };
}

describe("JOB 3112 · D1: ohne Beleg kein Hinweis", () => {
  it("`undefined` (lädt / Fehler ohne Bestand) → null", () => {
    expect(doppelhinweis("k1", undefined)).toBeNull();
  });

  it("leere Liste (Antwort da, nichts drin) → null, nicht „keine Dublette“", () => {
    expect(doppelhinweis("k1", [])).toBeNull();
  });

  it("ein Eintrag, der dieses Objekt gar nicht berührt → null", () => {
    expect(doppelhinweis("k1", [paar({ koA: "k7", koB: "k8" })])).toBeNull();
  });

  it("ein GESCHLOSSENER Eintrag ist kein offenes Doppel mehr → null", () => {
    expect(doppelhinweis("k1", [paar({ status: "geschlossen" })])).toBeNull();
  });

  it("`in_bearbeitung` zählt weiterhin — dieselbe Lesart wie `canClose`", () => {
    expect(doppelhinweis("k1", [paar({ status: "in_bearbeitung" })])?.anzahl).toBe(1);
  });
});

describe("JOB 3112 · D2: getroffen wird über BEIDE Seiten des Paares", () => {
  it("Treffer über `koA`", () => {
    const h = doppelhinweis("k1", [paar({ koA: "k1", koB: "k9" })]);
    expect(h?.anzahl).toBe(1);
    expect(h?.eintragId).toBe("d1");
  });

  it("Treffer über `koB` — die Prüfkarte ist genauso oft die zweite Seite wie die erste", () => {
    const h = doppelhinweis("k1", [paar({ id: "d2", koA: "k9", koB: "k1" })]);
    expect(h?.anzahl).toBe(1);
    expect(h?.eintragId).toBe("d2");
  });

  it("zwei Treffer werden gezählt, nicht bloß gemeldet", () => {
    const h = doppelhinweis("k1", [
      paar({ id: "d1", koB: "k9" }),
      paar({ id: "d2", koB: "k8" }),
      paar({ id: "d3", koA: "k7", koB: "k8" }),
    ]);
    expect(h?.anzahl).toBe(2);
  });
});

describe("JOB 3112 · D3: die stärkste Beziehung führt", () => {
  it("die Rangfolge steht als benannte Konstante da", () => {
    expect(BEZIEHUNGS_RANG).toEqual([
      "identisch",
      "a_enthaelt_b",
      "b_enthaelt_a",
      "teilweise",
      "verwandt",
    ]);
  });

  it("„identisch“ schlägt „verwandt“ — unabhängig von der Reihenfolge in der Antwort", () => {
    const schwachZuerst = doppelhinweis("k1", [
      paar({ id: "dv", relation: "verwandt" }),
      paar({ id: "di", relation: "identisch" }),
    ]);
    expect(schwachZuerst?.beziehung).toBe("identisch");
    expect(schwachZuerst?.eintragId).toBe("di");

    const starkZuerst = doppelhinweis("k1", [
      paar({ id: "di", relation: "identisch" }),
      paar({ id: "dv", relation: "verwandt" }),
    ]);
    expect(starkZuerst?.beziehung).toBe("identisch");
  });

  it("jede Beziehung bringt den Schlüssel aus `duplicateBoard`, nicht aus einer zweiten Tabelle", () => {
    for (const rel of BEZIEHUNGS_RANG as readonly OverlapRelation[]) {
      const h = doppelhinweis("k1", [paar({ relation: rel })]);
      expect(h?.beziehungLabelKey).toBe(relationLabelKey(rel));
    }
  });
});

describe("JOB 3112 · D4: der Hinweis nennt nie die Gegenseite", () => {
  it("weder Kennung noch Text des zweiten Objekts stehen im Ergebnis", () => {
    const h = doppelhinweis("k1", [
      paar({ koB: "k9", eigenanteilA: "GEHEIM A", eigenanteilB: "GEHEIM B" }),
    ]);
    const alsText = JSON.stringify(h);
    expect(alsText).not.toContain("k9");
    expect(alsText).not.toContain("GEHEIM");
    // Was er nennt, ist die Kennung des EINTRAGS — der Weg zum Vergleich, nicht der Inhalt.
    expect(h?.eintragId).toBe("d1");
  });
});
