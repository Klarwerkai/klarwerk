// @vitest-environment jsdom
// ================================================================================================
// produkt:20261015:klara-powerpoint-datenherkunft (PP-02) · HERKUNFT DIREKT AN DER ZAHL — montiert.
// ================================================================================================
//
// GEMESSEN an der echten Fläche `FolienDaten` mit echter i18n; ersetzt sind nur die zwei Abrufe
// `praesentationDaten.lage` und `praesentationDaten.datenpunkt` (Netz). Fiktiver Bestand.
//
//   H1  (K1, K2) Am Element stehen manuelle Zahl, OCR-Zahl und berechneter Wert als eigene,
//       unterscheidbare Zahlen (Erfassungsart und Prüfstand an der Zahl, auch für Screenreader).
//   H2  (K1, K2, K5) Ein Klick auf die berechnete Zahl öffnet die Herkunft im Detailbereich neben der
//       Folie: Rechenweg, Rundung, Eingaben; eine Eingabe öffnet ihre eigene Herkunft bis zur Quelle
//       (Tabellenzelle der Quellfassung), „Zurück“ führt zurück, Escape schließt — die Folie bleibt.
//   H3  (K4) Eine für den Nutzer verborgene Quelle steht als „nicht einsehbar“ da, ohne Inhalt; der
//       Prüfstand nennt je Dimension Stand und Grund. Ohne Schreibrecht keine Erfassen-/Prüfknöpfe.
//   H4  (K5) Englisch: dieselbe Fläche mit englischen Bezeichnungen.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import {
  type DatenpunktSicht,
  type FolienDatenLage,
  praesentationDaten,
} from "../../apps/web/src/api/praesentationDaten";
import { FolienDaten } from "../../apps/web/src/components/bibliothek/FolienDaten";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KO = "ko-quartal";
const ANHANG = "anh-1";

function stand(
  zustand: DatenpunktSicht["pruefstand"]["zustand"],
  dimensionen: DatenpunktSicht["pruefstand"]["dimensionen"],
): DatenpunktSicht["pruefstand"] {
  return {
    zustand,
    grund: `Zustand ${zustand} (fiktiv).`,
    naechsteArbeit: [],
    datenFassung: 1,
    erforderlich: dimensionen.filter((d) => d.stand !== "nicht_zutreffend").map((d) => d.dimension),
    dimensionen,
    prognose: false,
  };
}

const bindung = (id: string, shapeId: string, zeile?: number, spalte?: number) => ({
  id,
  koId: KO,
  anhangId: ANHANG,
  anhangName: "Quartal.pptx",
  sldId: "256",
  shapeId,
  ...(zeile !== undefined && spalte !== undefined ? { zeile, spalte } : {}),
  folienPosition: 1,
  folienTitel: "Ergebnis Q4 2025",
  elementName: `Element ${shapeId}`,
  datenFassung: 1,
  am: "2026-10-15T12:00:00Z",
  lage: "aktuell" as const,
});

const basis = {
  heimatKoId: KO,
  fassung: 1,
  art: "zahl" as const,
  annahmen: [],
  erfasstVon: { id: "anna", name: "Anna Beispiel" },
  erfasstAm: "2026-10-15T12:00:00Z",
  korrekturen: [],
  pruefungen: [],
  schutzstufe: "intern" as const,
};

const UMSATZ: DatenpunktSicht = {
  ...basis,
  id: "dp-umsatz",
  wert: "1.500 T€",
  zahl: 1500,
  einheit: "T€",
  zeitraum: "Q4 2025",
  erfassung: "direkt",
  quelle: {
    lesbar: true,
    koId: KO,
    titel: "Quartalsbericht Q4 2025 (fiktiv)",
    koFassung: 2,
    aktuelleFassung: 2,
    anhangId: ANHANG,
    anhangName: "Quartal.pptx",
    objectId: "obj-1",
    dateiFassung: "a".repeat(64),
  },
  fundstelle: {
    art: "tabellenzelle",
    sldId: "256",
    shapeId: "4",
    folienPosition: 1,
    folienTitel: "Ergebnis Q4 2025",
    elementName: "Tabelle Kennzahlen",
    zeile: 2,
    spalte: 3,
    zeilenkopf: "Umsatz",
    spaltenkopf: "Q4",
    zitat: "1.500 T€",
  },
  rechenweg: null,
  pruefstand: stand("in_pruefung", [
    { dimension: "erkennung", stand: "bestanden", grund: "Wert steht wörtlich an der Fundstelle." },
    { dimension: "struktur", stand: "offen", grund: "Noch nicht geprüft." },
    { dimension: "berechnung", stand: "nicht_zutreffend", grund: "Kein Rechenweg." },
  ]),
  bindungen: [bindung("b-1", "4", 2, 3)],
};

const ERGEBNIS: DatenpunktSicht = {
  ...basis,
  id: "dp-ergebnis",
  wert: "300 T€",
  zahl: 300,
  einheit: "T€",
  erfassung: "berechnet",
  quelle: null,
  fundstelle: { art: "rechenweg" },
  rechenweg: {
    art: "differenz",
    formel: "1.500 T€ − 1.200 T€",
    stellen: 0,
    roh: 300,
    ergebnis: 300,
    eingaben: [
      {
        lesbar: true,
        verwendet: { datenpunktId: "dp-umsatz", fassung: 1, wert: "1.500 T€", zahl: 1500 },
        datenpunkt: UMSATZ,
      },
      { lesbar: false, verwendet: { fassung: 1 } },
    ],
  },
  pruefstand: stand("in_pruefung", [
    { dimension: "berechnung", stand: "bestanden", grund: "Nachgerechnet." },
    { dimension: "fachliche_freigabe", stand: "offen", grund: "Keine fachliche Freigabe." },
  ]),
  bindungen: [bindung("b-2", "6")],
};

const MANUELL: DatenpunktSicht = {
  ...basis,
  id: "dp-manuell",
  wert: "12 %",
  zahl: 12,
  erfassung: "manuell",
  quelle: null,
  fundstelle: { art: "eingabe", beleg: "Auskunft Vertrieb (fiktiv)" },
  rechenweg: null,
  pruefstand: stand("erfasst", [
    { dimension: "erkennung", stand: "nicht_zutreffend", grund: "Manuell eingegeben." },
  ]),
  bindungen: [bindung("b-3", "7")],
};

const OCR: DatenpunktSicht = {
  ...basis,
  id: "dp-ocr",
  wert: "85",
  zahl: 85,
  erfassung: "ocr",
  quelle: { lesbar: false },
  fundstelle: {
    art: "bild",
    sldId: "256",
    shapeId: "8",
    folienPosition: 1,
    folienTitel: "Ergebnis Q4 2025",
    elementName: "Grafik Belegschaft",
    bildKennung: `sha256:${"b".repeat(64)}`,
    ocrText: "Mitarbeitende 2025: 85",
    unsicher: true,
  },
  rechenweg: null,
  pruefstand: stand("erfasst", [
    {
      dimension: "erkennung",
      stand: "offen",
      grund: "OCR-erkannt: noch nicht am Bild bestätigt. OCR allein validiert nicht.",
    },
  ]),
  bindungen: [bindung("b-4", "8")],
};

const LAGE: FolienDatenLage = {
  koId: KO,
  anhangId: ANHANG,
  anhangName: "Quartal.pptx",
  objectId: "obj-1",
  artikelFassung: 2,
  dateiFassung: "a".repeat(64),
  folien: [
    {
      sldId: "256",
      position: 1,
      titel: "Ergebnis Q4 2025",
      ausgeblendet: false,
      elemente: [
        {
          shapeId: "4",
          name: "Tabelle Kennzahlen",
          art: "tabelle",
          text: "Kennzahl | Q4\nUmsatz | 1.500 T€",
        },
        { shapeId: "6", name: "Ergebnis", art: "text", text: "Ergebnis Q4: 300 T€" },
        { shapeId: "7", name: "Marktanteil", art: "text", text: "Marktanteil: 12 %" },
        {
          shapeId: "8",
          name: "Grafik Belegschaft",
          art: "bild",
          text: "",
          bild: { kennung: `sha256:${"b".repeat(64)}`, bildAufFolie: 1 },
        },
      ],
    },
  ],
  datenpunkte: [UMSATZ, ERGEBNIS, MANUELL, OCR],
  darfErfassen: false,
  darfFreigeben: false,
};

const ALLE = new Map([UMSATZ, ERGEBNIS, MANUELL, OCR].map((d) => [d.id, d] as const));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  await i18n.changeLanguage("de");
});

async function warte(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

async function montiere(): Promise<void> {
  vi.spyOn(praesentationDaten, "lage").mockResolvedValue(LAGE);
  vi.spyOn(praesentationDaten, "datenpunkt").mockImplementation(async (id: string) => {
    const dp = ALLE.get(id);
    if (!dp) {
      throw new Error(`unbekannt: ${id}`);
    }
    return dp;
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(FolienDaten, { koId: KO, anhangId: ANHANG }),
        ),
      ),
    );
  });
  await warte();
}

const zahl = (id: string) => {
  const knopf = container.querySelector<HTMLButtonElement>(`[data-datenpunkt="${id}"]`);
  expect(knopf, `Zahl ${id} fehlt`).not.toBeNull();
  return knopf as HTMLButtonElement;
};

const aside = () => container.querySelector<HTMLElement>("[data-herkunft]");

describe("PP-02 · Herkunft direkt an der Zahl", () => {
  it("H1 · manuelle Zahl, OCR-Zahl und berechneter Wert stehen unterscheidbar an ihren Elementen", async () => {
    await montiere();
    const t = (k: string) => i18n.t(k);
    const element = (shape: string) =>
      container.querySelector<HTMLElement>(`[data-element="256:${shape}"]`);
    expect(element("7")?.querySelector('[data-erfassung="manuell"]')).not.toBeNull();
    expect(element("8")?.querySelector('[data-erfassung="ocr"]')).not.toBeNull();
    expect(element("6")?.querySelector('[data-erfassung="berechnet"]')).not.toBeNull();
    expect(element("4")?.querySelector('[data-erfassung="direkt"]')).not.toBeNull();

    const texte = ["dp-manuell", "dp-ocr", "dp-ergebnis"].map((id) => zahl(id).textContent ?? "");
    expect(texte[0]).toContain(t("praesentationdaten.erfassung.manuell"));
    expect(texte[1]).toContain(t("praesentationdaten.erfassung.ocr"));
    expect(texte[2]).toContain(t("praesentationdaten.erfassung.berechnet"));
    expect(new Set(texte).size).toBe(3);
    // Auch ohne Sehen: der Name der Zahl nennt Wert, Erfassungsart und Prüfstand.
    expect(zahl("dp-ocr").getAttribute("aria-label")).toBe(
      i18n.t("praesentationdaten.herkunftVon", {
        wert: "85",
        erfassung: t("praesentationdaten.erfassung.ocr"),
        zustand: t("praesentationdaten.zustand.erfasst"),
      }),
    );
    expect(aside()).toBeNull();
    // Ohne Schreibrecht keine Erfassen-Knöpfe.
    expect(container.querySelector("[data-erfassen]")).toBeNull();
  });

  it("H2 · Klick öffnet die Herkunft; Eingabe → eigene Herkunft bis zur Tabellenzelle; Zurück; Escape", async () => {
    await montiere();
    await act(async () => {
      zahl("dp-ergebnis").click();
    });
    await warte();
    expect(zahl("dp-ergebnis").getAttribute("aria-pressed")).toBe("true");
    const detail = aside();
    expect(detail?.dataset.herkunft).toBe("dp-ergebnis");
    const erfassung = detail?.querySelector<HTMLElement>("[data-herkunft-erfassung]");
    expect(erfassung?.dataset.herkunftErfassung).toBe("berechnet");
    expect(detail?.querySelector("[data-herkunft-rechenweg]")?.textContent).toContain(
      "1.500 T€ − 1.200 T€",
    );
    expect(detail?.textContent).toContain(
      i18n.t("praesentationdaten.rundung", { roh: 300, stellen: 0, ergebnis: 300 }),
    );
    // Die verborgene Eingabe steht als solche da, ohne Inhalt.
    expect(detail?.querySelector('[data-eingabe="verborgen"]')?.textContent).toBe(
      i18n.t("praesentationdaten.eingabeVerborgen"),
    );
    // Die Folie bleibt daneben sichtbar.
    expect(container.querySelector('[data-folie="256"]')).not.toBeNull();

    await act(async () => {
      detail?.querySelector<HTMLButtonElement>('[data-eingabe="dp-umsatz"]')?.click();
    });
    await warte();
    const eingabe = aside();
    expect(eingabe?.dataset.herkunft).toBe("dp-umsatz");
    const quelle = eingabe?.querySelector<HTMLElement>("[data-herkunft-quelle]");
    expect(quelle?.dataset.herkunftQuelle).toBe(KO);
    const fund = eingabe?.querySelector('[data-herkunft-fundstelle="tabellenzelle"]')?.textContent;
    expect(fund).toContain("Umsatz");
    expect(fund).toContain("Q4");
    expect(fund).toContain("„1.500 T€“");
    expect(eingabe?.textContent).toContain(
      i18n.t("praesentationdaten.quellfassung", { fassung: 2, aktuell: 2 }),
    );

    await act(async () => {
      eingabe?.querySelector<HTMLButtonElement>("[data-herkunft-zurueck]")?.click();
    });
    await warte();
    expect(aside()?.dataset.herkunft).toBe("dp-ergebnis");

    await act(async () => {
      aside()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await warte();
    expect(aside()).toBeNull();
  });

  it("H3 · verborgene Quelle, Prüfstand je Dimension mit Grund, keine Prüfknöpfe ohne Recht", async () => {
    await montiere();
    await act(async () => {
      zahl("dp-ocr").click();
    });
    await warte();
    const detail = aside();
    expect(detail?.querySelector('[data-herkunft-quelle="verborgen"]')?.textContent).toBe(
      i18n.t("praesentationdaten.quelleVerborgen"),
    );
    const fund = detail?.querySelector('[data-herkunft-fundstelle="bild"]')?.textContent ?? "";
    expect(fund).toContain("Mitarbeitende 2025: 85");
    expect(fund).toContain(i18n.t("praesentationdaten.ocrUnsicher"));
    const erkennung = detail?.querySelector<HTMLElement>('[data-dimension="erkennung"]');
    expect(erkennung?.dataset.stand).toBe("offen");
    expect(erkennung?.textContent).toContain("OCR allein validiert nicht");
    expect(detail?.querySelector("[data-herkunft-zustand]")?.textContent).toBe(
      i18n.t("praesentationdaten.zustand.erfasst"),
    );
    expect(detail?.querySelector("[data-pruefen]")).toBeNull();
    expect(detail?.querySelector("[data-korrigieren-oeffnen]")).toBeNull();

    await act(async () => {
      zahl("dp-manuell").click();
    });
    await warte();
    const manuell = aside();
    expect(manuell?.querySelector('[data-herkunft-fundstelle="eingabe"]')?.textContent).toContain(
      "Anna Beispiel",
    );
    expect(manuell?.textContent).toContain(i18n.t("praesentationdaten.keineQuelle"));
  });

  it("H4 · Englisch", async () => {
    await i18n.changeLanguage("en");
    await montiere();
    expect(container.textContent).toContain("Data on the slides");
    expect(zahl("dp-manuell").textContent).toContain("Entered manually");
    expect(zahl("dp-ocr").textContent).toContain("OCR-recognised");
    expect(zahl("dp-ergebnis").textContent).toContain("Calculated");
  });
});
