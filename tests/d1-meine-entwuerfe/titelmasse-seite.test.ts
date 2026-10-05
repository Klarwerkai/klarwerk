// ================================================================================================
// AUFNAHME gesamt-entwurf-einreichen (Ben Lauf :3 Runde 3, B3-R2) — DIE MESSFUNKTION DER ÜBERSICHT
// OHNE BROWSER.
// ================================================================================================
//
// Ben hat `TITELMASSE_SEITE` unverändert ausgewertet und mit dem Fixture-Titel gefüttert. Der
// Template-String trug `\s` nur EINFACH maskiert, im ausgewerteten Quelltext stand deshalb `/s+/g`.
// Die Messung machte aus „Ausgabe“ „Au gabe“, und der Vergleich mit `ALLE_TITEL` in Fall L2 wäre
// auch bei ganz sichtbarem Titel gescheitert. Ein Chromium-Lauf hätte das erst auf dem Linux-Tor
// gezeigt. Hier wird dieselbe Zeichenkette so ausgewertet wie im Browser
// (`new Function`, wie `fn` in `zugang-schmal-chromium.test.ts`). Nur `document` und
// `getComputedStyle` sind nachgebildet, mit Maßen, die nichts abschneiden.
import { describe, expect, it } from "vitest";
import { TITELMASSE_SEITE } from "./titelmasse-seite";

interface Mass {
  text: string;
  sichtbreite: number;
  textbreite: number;
  sichthoehe: number;
  texthoehe: number;
  umbruch: string;
  kuerzung: string;
}

interface Kasten {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  textOverflow: string;
}

const PASSEND: Kasten = {
  clientWidth: 300,
  scrollWidth: 300,
  clientHeight: 40,
  scrollHeight: 40,
  textOverflow: "clip",
};

function messe(titel: readonly string[], behaelter: Kasten = PASSEND): Mass[] {
  const stile = new Map<object, Kasten>();
  const zeilen = titel.map((text) => {
    const zeile = { ...behaelter };
    const el = { ...PASSEND, textContent: text, parentElement: zeile };
    stile.set(el, PASSEND);
    stile.set(zeile, behaelter);
    return { querySelector: () => el };
  });
  const dokument = { querySelectorAll: () => zeilen };
  const stilVon = (k: object) => ({
    whiteSpace: "normal",
    textOverflow: stile.get(k)?.textOverflow ?? "clip",
  });
  const auswerten = new Function(
    "document",
    "getComputedStyle",
    `return (${TITELMASSE_SEITE})();`,
  ) as (d: unknown, g: unknown) => Mass[];
  return auswerten(dokument, stilVon);
}

// Die Titel der Fixture in `zugang-schmal-chromium.test.ts` (`TITEL_1` bis `TITEL_3`).
const FIXTURE = [
  "Freigabe Notfallplan Standort mit Fluchtwegen und Meldeketten — Ausgabe Nord 2026",
  "Freigabe Notfallplan Standort mit Fluchtwegen und Meldeketten — Ausgabe Süd 2026",
  "Notfallplan_Standort_Nord_Ausgabe_2026_Freigabe_und_Meldeketten.docx",
];

describe("B3-R2 · TITELMASSE_SEITE liest den Titel unverändert", () => {
  it("S1 · ungekürzt gemessen kommt jeder Fixture-Titel Zeichen für Zeichen zurück", () => {
    expect(messe(FIXTURE).map((m) => m.text)).toEqual(FIXTURE);
  });

  it("S2 · Leerraum (Tabulator, Doppel-Leerzeichen, Umbruch) wird zusammengezogen, Buchstaben bleiben", () => {
    expect(messe(["  Ausgabe\tSüd   mit\nMeldeketten  "]).map((m) => m.text)).toEqual([
      "Ausgabe Süd mit Meldeketten",
    ]);
  });

  it("S3 · eine Kürzung am Zeilenträger wird gemeldet, nicht vom ungekürzten Titelträger verdeckt", () => {
    const [m] = messe([FIXTURE[0] as string], {
      ...PASSEND,
      scrollWidth: 520,
      textOverflow: "ellipsis",
    });
    expect(m?.kuerzung).toBe("ellipsis");
    expect(m?.textbreite).toBe(520);
  });
});
