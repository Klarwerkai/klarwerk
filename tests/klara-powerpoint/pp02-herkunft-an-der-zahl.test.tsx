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
//   UI-06/UI-05 (Risiken R17, R2, R3, R4 und Warnfarbe aus CHAT-67/ui04-08, Abschnitt 5):
//   H6  Die Zahl ist ein echter Umschalter: der zweite Klick schließt (dann stimmt `aria-pressed`),
//       die offene Zahl verweist mit `aria-controls` auf die Herkunft; Schließen per Klick, Knopf —
//       auch aus der Tiefe einer Eingabe — gibt den Fokus an die Zahl zurück, die geöffnet hat (R2).
//   H7  Escape in der Herkunft schließt nur sie und erreicht das Dokument nicht — dort hört die
//       Seitenhilfe (`KlaraAssistant`) auf Escape (R3).
//   H8  Escape verwirft keine begonnene Korrektur oder Prüfung und gehört während einer IME-
//       Komposition der Eingabemethode; unberührt schließt Escape wie bisher (R4).
//   Unabhängige Prüfung 0001–0006 (18.10.2026):
//   H10 (B7) dieselbe Zahl an zwei Elementen: Schließen über den zweiten Knopf gibt IHM den Fokus.
//   H11 (P2) „Abbrechen“ setzt die Korrektur auf den Datenpunkt zurück; nichts gilt als unberührt.
//   H9  Warnhinweise der Herkunft tragen eine Farbe, die das Theme kennt (`text-trust-crit-text`);
//       `text-danger` (kein Token) bleibt nur in der Zustandsfarbe an der Zahl, die der PP-03-Anschluss
//       umstellt.
import { readFileSync } from "node:fs";
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
import { repoPfad } from "../support/repoPfad";

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

// Nacharbeit 2: Umsatz wurde inzwischen neu gelesen (Fassung 2). Die Berechnung rechnete mit
// Fassung 1 — so liefert der Server sie für `?fassung=1` (`historisch` gesetzt).
const UMSATZ_DAMALS: DatenpunktSicht = { ...UMSATZ, historisch: { aktuelleFassung: 2 } };
const UMSATZ_HEUTE: DatenpunktSicht = {
  ...UMSATZ,
  fassung: 2,
  wert: "1.550 T€",
  zahl: 1550,
  fundstelle: { ...UMSATZ.fundstelle, zitat: "1.550 T€" } as DatenpunktSicht["fundstelle"],
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
        datenpunkt: UMSATZ_DAMALS,
        aktuell: { fassung: 2, wert: "1.550 T€" },
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
          text: "Kennzahl | Q4\nUmsatz | 1.550 T€",
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
  datenpunkte: [UMSATZ_HEUTE, ERGEBNIS, MANUELL, OCR],
  darfErfassen: false,
  darfFreigeben: false,
};

const ALLE = new Map([UMSATZ_HEUTE, ERGEBNIS, MANUELL, OCR].map((d) => [d.id, d] as const));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Die Aufrufe des Herkunftsabrufs — mit Kennung UND Fassung. */
let abruf: { mock: { calls: unknown[][] } } | undefined;

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

async function montiere(lage: FolienDatenLage = LAGE): Promise<void> {
  vi.spyOn(praesentationDaten, "lage").mockResolvedValue(lage);
  const spion = vi.spyOn(praesentationDaten, "datenpunkt");
  abruf = spion;
  spion.mockImplementation(async (id: string, fassung?: number) => {
    if (id === "dp-umsatz" && fassung === 1) {
      return UMSATZ_DAMALS;
    }
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

async function klick(e: Element | null | undefined): Promise<void> {
  expect(e, "Bedienelement fehlt").toBeTruthy();
  await act(async () => {
    (e as HTMLElement).click();
  });
  await warte();
}

async function escapeDruecken(ziel: Element | null | undefined, extra: KeyboardEventInit = {}) {
  expect(ziel, "Ziel für Escape fehlt").toBeTruthy();
  await act(async () => {
    ziel?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...extra }));
  });
  await warte();
}

/** Tippen wie ein Mensch: Wert setzen und das native `input`-Ereignis auslösen (React-onChange). */
async function tippen(feld: HTMLInputElement | null | undefined, text: string): Promise<void> {
  expect(feld, "Eingabefeld fehlt").toBeTruthy();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

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
    // Die Zahl ist ein Umschalter (H6): gedrückt, solange ihre Herkunft offen ist, und sie nennt sie.
    expect(zahl("dp-ergebnis").getAttribute("aria-pressed")).toBe("true");
    const detail = aside();
    expect(detail?.dataset.herkunft).toBe("dp-ergebnis");
    expect(zahl("dp-ergebnis").getAttribute("aria-controls")).toBe(detail?.id);
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
    // Nacharbeit 2: der heutige Stand der Eingabe steht als Änderung daneben.
    expect(detail?.querySelector("[data-eingabe-geaendert]")?.textContent).toBe(
      i18n.t("praesentationdaten.eingabeGeaendert", { wert: "1.550 T€", fassung: 2 }),
    );

    await act(async () => {
      detail?.querySelector<HTMLButtonElement>('[data-eingabe="dp-umsatz"]')?.click();
    });
    await warte();
    const eingabe = aside();
    expect(eingabe?.dataset.herkunft).toBe("dp-umsatz");
    // Geöffnet wird die VERWENDETE Fassung 1 — abgerufen mit Kennung UND Fassung.
    expect(abruf?.mock.calls).toContainEqual(["dp-umsatz", 1]);
    expect(eingabe?.dataset.herkunftFassung).toBe("1");
    expect(eingabe?.querySelector("[data-herkunft-historisch]")?.textContent).toContain(
      i18n.t("praesentationdaten.historisch", { fassung: 1, aktuell: 2 }),
    );
    expect(eingabe?.querySelector("h6")?.textContent).toBe("1.500 T€");
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
    // R2: der Fokus kehrt an die Zahl zurück, an der die Herkunft geöffnet wurde.
    expect(document.activeElement).toBe(zahl("dp-ergebnis"));
    expect(zahl("dp-ergebnis").getAttribute("aria-pressed")).toBe("false");
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

  it("H5 · aus der verwendeten Fassung zur aktuellen — ausdrücklich, nicht still", async () => {
    await montiere();
    await act(async () => {
      zahl("dp-ergebnis").click();
    });
    await warte();
    await act(async () => {
      aside()?.querySelector<HTMLButtonElement>('[data-eingabe="dp-umsatz"]')?.click();
    });
    await warte();
    expect(aside()?.dataset.herkunftFassung).toBe("1");
    await act(async () => {
      aside()?.querySelector<HTMLButtonElement>("[data-herkunft-aktuell-oeffnen]")?.click();
    });
    await warte();
    const heute = aside();
    expect(heute?.dataset.herkunftFassung).toBe("2");
    expect(heute?.querySelector("h6")?.textContent).toBe("1.550 T€");
    expect(heute?.querySelector("[data-herkunft-historisch]")).toBeNull();
    // „Zurück“ führt wieder zur verwendeten Fassung.
    await act(async () => {
      heute?.querySelector<HTMLButtonElement>("[data-herkunft-zurueck]")?.click();
    });
    await warte();
    expect(aside()?.dataset.herkunftFassung).toBe("1");
  });

  it("H4 · Englisch", async () => {
    await i18n.changeLanguage("en");
    await montiere();
    expect(container.textContent).toContain("Data on the slides");
    expect(zahl("dp-manuell").textContent).toContain("Entered manually");
    expect(zahl("dp-ocr").textContent).toContain("OCR-recognised");
    expect(zahl("dp-ergebnis").textContent).toContain("Calculated");
  });

  it("H6 · R17 die Zahl schaltet um; R2 Schließen gibt den Fokus an die öffnende Zahl zurück", async () => {
    await montiere();
    const manuell = zahl("dp-manuell");
    expect(manuell.getAttribute("aria-pressed")).toBe("false");
    expect(manuell.hasAttribute("aria-controls")).toBe(false);
    await klick(manuell);
    expect(manuell.getAttribute("aria-pressed")).toBe("true");
    const kennung = manuell.getAttribute("aria-controls") ?? "";
    expect(kennung).not.toBe("");
    expect(aside()?.id).toBe(kennung);
    expect(document.activeElement).toBe(aside()?.querySelector("h6"));
    // Zweiter Klick auf die offene Zahl: die Herkunft schließt, der Fokus steht an der Zahl.
    await klick(manuell);
    expect(aside()).toBeNull();
    expect(manuell.getAttribute("aria-pressed")).toBe("false");
    expect(manuell.hasAttribute("aria-controls")).toBe(false);
    expect(document.activeElement).toBe(manuell);
    // Ein dritter Klick öffnet wieder — echtes Umschalten, keine Einbahn.
    await klick(manuell);
    expect(aside()?.dataset.herkunft).toBe("dp-manuell");

    // Aus der Tiefe (Eingabe einer Berechnung) mit dem Knopf „Schließen“: der Fokus geht an die Zahl,
    // an der der Weg begann — nicht an die Zahl der zuletzt gezeigten Eingabe.
    await klick(zahl("dp-ergebnis"));
    await klick(aside()?.querySelector('[data-eingabe="dp-umsatz"]'));
    expect(aside()?.dataset.herkunft).toBe("dp-umsatz");
    expect(zahl("dp-ergebnis").getAttribute("aria-pressed")).toBe("false");
    await klick(aside()?.querySelector("[data-herkunft-schliessen]"));
    expect(aside()).toBeNull();
    expect(document.activeElement).toBe(zahl("dp-ergebnis"));
  });

  it("H7 · R3 Escape in der Herkunft schließt nur die Herkunft, nicht die Seitenhilfe", async () => {
    await montiere();
    // So hört die Seitenhilfe (`KlaraAssistant`) auf Escape: am Dokument.
    const amDokument = vi.fn();
    document.addEventListener("keydown", amDokument);
    try {
      await klick(zahl("dp-ocr"));
      await escapeDruecken(aside()?.querySelector("h6"));
      expect(aside()).toBeNull();
      expect(amDokument).not.toHaveBeenCalled();
      // Gegenprobe: außerhalb der Herkunft erreicht Escape das Dokument wie bisher.
      await escapeDruecken(zahl("dp-ocr"));
      expect(amDokument).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", amDokument);
    }
  });

  it("H8 · R4 Escape verwirft keine begonnene Korrektur oder Prüfung, IME-Komposition hat Vorrang", async () => {
    await montiere({ ...LAGE, darfErfassen: true });
    const herkunft = () => aside();
    await klick(zahl("dp-umsatz"));
    expect(herkunft()?.dataset.herkunft).toBe("dp-umsatz");
    const kopf = () => herkunft()?.querySelector("h6");

    // Während einer IME-Komposition (isComposing bzw. keyCode 229) gehört Escape der Eingabemethode.
    await escapeDruecken(kopf(), { isComposing: true });
    expect(herkunft()).not.toBeNull();
    await escapeDruecken(kopf(), { keyCode: 229 });
    expect(herkunft()).not.toBeNull();

    // Korrektur geöffnet und Grund eingetippt: Escape lässt Herkunft UND Eingabe stehen.
    await klick(herkunft()?.querySelector("[data-korrigieren-oeffnen]"));
    const korrektur = () => herkunft()?.querySelector<HTMLFormElement>("form[data-korrigieren]");
    const grund = () => korrektur()?.querySelector<HTMLInputElement>('input[id$="-grund"]');
    await tippen(grund(), "Wert aus der Quelle (fiktiv)");
    await escapeDruecken(grund());
    expect(herkunft()?.dataset.herkunft).toBe("dp-umsatz");
    expect(grund()?.value).toBe("Wert aus der Quelle (fiktiv)");
    // Verwerfen bleibt ausdrücklich: „Abbrechen“.
    await klick(korrektur()?.querySelector("[data-korrigieren-abbrechen]"));
    expect(korrektur()).toBeNull();

    // Prüfung begonnen (Grund eingetippt): ebenso geschützt.
    const pruefGrund = () =>
      herkunft()?.querySelector<HTMLInputElement>('form[data-pruefen] input[id$="-g"]');
    await tippen(pruefGrund(), "Struktur nachgesehen (fiktiv)");
    await escapeDruecken(pruefGrund());
    expect(herkunft()?.dataset.herkunft).toBe("dp-umsatz");
    expect(pruefGrund()?.value).toBe("Struktur nachgesehen (fiktiv)");

    // Der Knopf „Schließen“ ist ausdrücklich und schließt; neu geöffnet ist nichts begonnen —
    // dann schließt Escape wie bisher.
    await klick(herkunft()?.querySelector("[data-herkunft-schliessen]"));
    expect(herkunft()).toBeNull();
    await klick(zahl("dp-umsatz"));
    expect(pruefGrund()?.value).toBe("");
    await escapeDruecken(kopf());
    expect(herkunft()).toBeNull();
    expect(document.activeElement).toBe(zahl("dp-umsatz"));
  });

  it("H9 · Warnhinweise der Herkunft in einer Farbe, die das Theme kennt", async () => {
    await montiere();
    await klick(zahl("dp-ocr"));
    const unsicher = [...(aside()?.querySelectorAll("span") ?? [])].find(
      (s) => s.textContent === i18n.t("praesentationdaten.ocrUnsicher"),
    );
    expect(unsicher?.className).toContain("text-trust-crit-text");
    expect(aside()?.innerHTML).not.toContain("text-danger");
    await klick(zahl("dp-ergebnis"));
    expect(aside()?.querySelector("[data-eingabe-geaendert]")?.className).toContain(
      "text-trust-crit-text",
    );
    // Quelle: `text-danger` (kein Token im Theme) steht nur noch in der Zustandsfarbe an der Zahl,
    // die der PP-03-Anschluss (CHAT-67) umstellt — sonst nirgends.
    const quelle = readFileSync(
      repoPfad("apps/web/src/components/bibliothek/FolienDaten.tsx"),
      "utf8",
    );
    const ohneZustandsfarbe = quelle.replace(/const ZUSTANDSFARBE[\s\S]*?\n};\n/, "");
    expect(ohneZustandsfarbe).not.toBe(quelle);
    expect(ohneZustandsfarbe).not.toContain("text-danger");
    const theme = readFileSync(repoPfad("apps/web/tailwind.config.ts"), "utf8");
    expect(theme).toContain('"crit-text": token("trust-crit-text")');
  });

  it("H10 · B7 dieselbe Zahl an zwei Elementen: Schließen über den zweiten Knopf gibt ihm den Fokus", async () => {
    const doppelt: FolienDatenLage = {
      ...LAGE,
      datenpunkte: LAGE.datenpunkte.map((d) =>
        d.id === "dp-manuell" ? { ...d, bindungen: [bindung("b-3", "7"), bindung("b-9", "6")] } : d,
      ),
    };
    await montiere(doppelt);
    const an = (shape: string) =>
      container.querySelector<HTMLButtonElement>(
        `[data-element="256:${shape}"] [data-datenpunkt="dp-manuell"]`,
      );
    expect(an("7") && an("6") && an("7") !== an("6")).toBe(true);
    await klick(an("7"));
    expect(an("6")?.getAttribute("aria-pressed")).toBe("true");
    await klick(an("6"));
    expect(aside()).toBeNull();
    expect(document.activeElement).toBe(an("6"));
  });

  it("H11 · P2 „Abbrechen“ setzt die Korrektur auf den Datenpunkt zurück", async () => {
    await montiere({ ...LAGE, darfErfassen: true });
    await klick(zahl("dp-umsatz"));
    const korrektur = () => aside()?.querySelector<HTMLFormElement>("form[data-korrigieren]");
    const feld = (name: string) =>
      korrektur()?.querySelector<HTMLInputElement>(`input[id$="-${name}"]`);
    await klick(aside()?.querySelector("[data-korrigieren-oeffnen]"));
    await tippen(feld("zeitraum"), "Q1 2026 (fiktiv)");
    await tippen(feld("grund"), "nur ausprobiert (fiktiv)");
    await klick(korrektur()?.querySelector("[data-korrigieren-abbrechen]"));
    await klick(aside()?.querySelector("[data-korrigieren-oeffnen]"));
    expect(feld("wert")?.value).toBe("1.550 T€");
    expect(feld("zeitraum")?.value).toBe("Q4 2025");
    expect(feld("grund")?.value).toBe("");
    expect(korrektur()?.hasAttribute("data-ungespeichert")).toBe(false);
  });
});
