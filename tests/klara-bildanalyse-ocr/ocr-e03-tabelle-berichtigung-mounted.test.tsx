// @vitest-environment jsdom
// ================================================================================================
// OCR-E03 · Nacharbeit 6 — DIE BEARBEITBARE TABELLE AM GELIEFERTEN OCR-E01/E02-WEG, gemountet an
// der Fläche, die jeder RichTextEditor trägt (`BildBefundeImRumpf`).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-tabellen. Bens Befund: Tabellenänderungen lagen nur im lokalen
// Komponentenstatus. Jetzt werden sie als OCR-E02-Berichtigung des Bildes gespeichert (Quelle UND
// Bildfassung), und eine gespeicherte Berichtigung gilt auch in der Tabelle.
//
// Ersetzt sind wie in `fundstelle-korrektur-mounted.test.tsx`: die Texterkennung (liest die Marke
// aus den Bildbytes und liefert eine kontrollierte Tabelle MIT Wortrahmen), die Tintenmessung (jsdom
// hat keine Zeichenfläche; gemessen „leer“), der Frage-/Beschreibungsweg der Fläche samt Quelle
// `ko:<id>`, der Draht des Assistenzprofils und der Draht der Berichtigungen (ein kleiner Server im
// Speicher). Echt sind Analyse, Raster, Berichtigungsstand, Abgleich, Markierung und Oberfläche.
//
//   T1  Tabelle ändern → „Als Berichtigung speichern“ → am Server als Text der Bildfassung; die
//       Tabelle zeigt die Berichtigung gekennzeichnet (mit dem Erkannten); Neuladen behält sie;
//       jede Zelle öffnet ihre Stelle im Original; andere Quelle und verändertes Bild: roh;
//       „Zurücksetzen“ am Bildtext bringt die erkannte Tabelle zurück.
//   T2  Text berichtigt (OCR-E02 „Text berichtigen“): die Berichtigung wirkt in den Zellen; ein
//       ergänztes Wort ohne Zelle wird nicht geraten, sondern benannt.
//   T3  ohne Schreibrecht: kein Speichern, und der Grund steht da.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_src: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
  // jsdom hat keine Zeichenfläche: jede Zelle ohne Wörter ist im Bild gemessen leer.
  bildTintenAnteile: async (_src: string, bereiche: readonly unknown[]) => bereiche.map(() => 0),
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type AssistenzProfilAntwort,
  assistenzProfilApi,
} from "../../apps/web/src/api/assistenzProfil";
import {
  type BildKorrekturAenderung,
  type BildKorrekturAntwort,
  bildKorrekturApi,
} from "../../apps/web/src/api/bildKorrekturen";
import { ApiError } from "../../apps/web/src/api/client";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import {
  type ImageDescribeValue,
  ImageDescribeValueProvider,
} from "../../apps/web/src/app/ImageDescribeContext";
import { BildBefundeImRumpf } from "../../apps/web/src/components/BildBefundeImRumpf";
import i18n from "../../apps/web/src/i18n";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import { bildInhaltskennung } from "../../apps/web/src/lib/bildAutomatik";
import type { BildKorrekturDaten } from "../../apps/web/src/lib/bildKorrektur";
import { verwerfeBildKorrekturen } from "../../apps/web/src/lib/bildKorrekturenStand";
import { bildMitMassen, dataUrl } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// ------------------------------------------------------------------------------------------------
// Die kontrollierte Tabelle (Bild 1000 × 300): Kopfzeile, Dezimalkomma, Vorzeichen, Einheit, eine
// leere Zelle und eine unleserliche Zelle („7“ mit Sicherheit 12).
// ------------------------------------------------------------------------------------------------

function wort(text: string, x0: number, y0: number, sicherheit = 95): OcrWort {
  return { text, confidence: sicherheit, bbox: { x0, y0, x1: x0 + text.length * 18, y1: y0 + 30 } };
}

const TABELLE: { text: string; woerter: OcrWort[] } = {
  text: "Posten Menge Preis\nVentil 4 kg 12,50 €\nDichtung -0,80 €\nFilter 7 3,10",
  woerter: [
    wort("Posten", 20, 10),
    wort("Menge", 300, 10),
    wort("Preis", 560, 10),
    wort("Ventil", 20, 60),
    wort("4", 300, 60),
    wort("kg", 326, 60),
    wort("12,50", 560, 60),
    wort("€", 658, 60),
    wort("Dichtung", 20, 110),
    wort("-0,80", 560, 110),
    wort("€", 658, 110),
    wort("Filter", 20, 160),
    wort("7", 300, 160, 12),
    wort("3,10", 560, 160),
  ],
};

// Dasselbe Bild und eine veränderte Fassung (andere Bytes, gleicher Inhalt für die Erkennung).
const BYTES_TB = bildMitMassen("TB", 1000, 300);
const BILD_TB = dataUrl(BYTES_TB);
const BILD_TC = dataUrl(bildMitMassen("TC", 1000, 300));

const rumpf = (bild: string): string =>
  `<p>Wartungsliste</p><figure><img data-image-id="kw-1" src="${bild}"></figure>`;

// ------------------------------------------------------------------------------------------------
// Ein kleiner Berichtigungsserver im Speicher (wie in `fundstelle-korrektur-mounted.test.tsx`).
// ------------------------------------------------------------------------------------------------

const korrekturServer = {
  liste: [] as BildKorrekturDaten[],
  darf: true,
  aufrufe: [] as BildKorrekturAenderung[],
  uhr: 0,
};

function sicht(): BildKorrekturAntwort {
  return {
    darfBearbeiten: korrekturServer.darf,
    korrekturen: korrekturServer.liste.map((k) => ({ ...k })),
  };
}

function aendernAmServer(a: BildKorrekturAenderung): BildKorrekturAntwort {
  if (!korrekturServer.darf) {
    throw new ApiError(403, "FORBIDDEN", "Keine Berechtigung.");
  }
  korrekturServer.aufrufe.push(a);
  const bisher = korrekturServer.liste.find(
    (k) => k.quelle === a.quelle && k.inhaltskennung === a.inhaltskennung,
  );
  const rest = korrekturServer.liste.filter((k) => k !== bisher);
  korrekturServer.uhr += 1;
  if (a.aktion === "setzen") {
    rest.push({
      quelle: a.quelle,
      inhaltskennung: a.inhaltskennung,
      ort: a.ort ?? null,
      text: a.text,
      schritte: bisher ? bisher.schritte + 1 : 0,
      geaendertAm: `2026-10-17T10:00:${String(korrekturServer.uhr).padStart(2, "0")}.000Z`,
    });
  }
  korrekturServer.liste = rest;
  return sicht();
}

const describeBild = vi.fn(
  async (_src: string): Promise<DescribeImageResult> => ({ text: "Eine Tabelle", demo: false }),
);

function weg(quelle: string): ImageDescribeValue {
  return { available: true, describe: describeBild, quelle };
}

async function abwarten(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function zeige(bild: string, quelle: string): Promise<void> {
  await act(async () => {
    root.render(
      createElement(ImageDescribeValueProvider, {
        value: weg(quelle),
        children: createElement(BildBefundeImRumpf, { html: rumpf(bild) }),
      }),
    );
  });
  await abwarten();
}

async function profilLaden(): Promise<void> {
  await act(async () => {
    await ladeAssistenzProfil("konto-a");
  });
}

/** „Neuladen“: Fläche weg, Browserstände verworfen, neu angemeldet. */
async function neuLaden(): Promise<void> {
  act(() => root.unmount());
  verwerfeAssistenzProfil();
  verwerfeBildKorrekturen();
  root = createRoot(container);
  await profilLaden();
}

const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);

function zelle(zeile: number, spalte: number): HTMLElement {
  const el = container.querySelector<HTMLElement>(
    `[data-testid=bild-tabelle-zelle][data-zeile="${zeile}"][data-spalte="${spalte}"]`,
  );
  if (!el) {
    throw new Error(`Zelle ${zeile}/${spalte} fehlt`);
  }
  return el;
}

const wert = (zeile: number, spalte: number): string =>
  zelle(zeile, spalte).querySelector("input")?.value ?? "";

function tabellenAttr(name: string): string | null {
  return q("bild-tabelle")?.getAttribute(name) ?? null;
}

/** Die Kennzeichnung einer berichtigten Zelle („berichtigt — erkannt war …“). */
function berichtigtHinweis(zeile: number, spalte: number): string | null {
  const el = zelle(zeile, spalte).querySelector("[data-testid=bild-tabelle-zelle-berichtigt]");
  return el?.textContent ?? null;
}

async function klick(el: Element | null): Promise<void> {
  await act(async () => {
    (el as HTMLButtonElement).click();
  });
  await abwarten();
}

async function tippe(el: Element | null, text: string): Promise<void> {
  const feld = el as HTMLInputElement | HTMLTextAreaElement;
  const proto =
    feld instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function tippeZelle(zeile: number, spalte: number, text: string): Promise<void> {
  await tippe(zelle(zeile, spalte).querySelector("input"), text);
}

async function schliesseAnsicht(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });
  await abwarten();
  expect(q("bild-fundstelle-ansicht")).toBeNull();
}

/** Die Markierungen der offenen Ansicht, links/oben in Prozent des Bildes. */
function markierungen(): { links: number; oben: number }[] {
  const els = container.querySelectorAll<HTMLElement>("[data-testid=bild-fundstelle-markierung]");
  return [...els].map((el) => ({
    links: Number.parseFloat(el.style.left),
    oben: Number.parseFloat(el.style.top),
  }));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  korrekturServer.liste = [];
  korrekturServer.darf = true;
  korrekturServer.aufrufe = [];
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(
    async (): Promise<AssistenzProfilAntwort> => ({ profil: null, einrichtungOffen: true }),
  );
  vi.spyOn(bildKorrekturApi, "lesen").mockImplementation(async () => sicht());
  vi.spyOn(bildKorrekturApi, "aendern").mockImplementation(async (a) => aendernAmServer(a));
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(
    async (): Promise<OcrResult> => ({ status: "success", ...TABELLE }),
  );
  describeBild.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  verwerfeAssistenzProfil();
  verwerfeBildKorrekturen();
  vi.restoreAllMocks();
});

describe("T1 · Tabellenänderung als OCR-E02-Berichtigung: speichern, Neuladen, Quellwechsel", () => {
  it("gespeichert an Quelle und Bildfassung, gekennzeichnet, nach Neuladen da, nur am selben Bild", async () => {
    await profilLaden();
    await zeige(BILD_TB, "ko:fiktiv-1");
    // Die erkannte Tabelle — dauerhaft speicherbar, unleserliche Zelle ohne erfundenen Wert.
    expect(tabellenAttr("data-dauerhaft")).toBe("ja");
    expect(wert(3, 1)).toBe("[unleserlich]");
    expect(zelle(3, 1).getAttribute("data-zustand")).toBe("unleserlich");
    expect(wert(2, 1)).toBe("");
    expect(zelle(2, 1).getAttribute("data-zustand")).toBe("leer");

    await tippeZelle(3, 1, "7 kg");
    await tippeZelle(2, 1, "2 kg");
    expect(korrekturServer.aufrufe).toEqual([]);
    await klick(q("bild-tabelle-speichern"));
    expect(q("bild-tabelle-gespeichert")?.getAttribute("data-ergebnis")).toBe("gespeichert");

    // Am Server: EINE Berichtigung des Bildes, gebunden an Quelle und Bildfassung, die Tabelle als
    // Block — Dezimalkomma, Vorzeichen und Einheiten wörtlich.
    const kennung = await bildInhaltskennung(BYTES_TB);
    expect(korrekturServer.aufrufe).toEqual([
      {
        aktion: "setzen",
        quelle: "ko:fiktiv-1",
        inhaltskennung: kennung,
        ort: expect.any(String),
        text: "Posten\tMenge\tPreis\nVentil\t4 kg\t12,50 €\nDichtung\t2 kg\t-0,80 €\nFilter\t7 kg\t3,10",
      },
    ]);
    // Die Tabelle zeigt die Berichtigung — gekennzeichnet, mit dem, was erkannt war.
    expect(tabellenAttr("data-geaendert")).toBe("0");
    expect(tabellenAttr("data-berichtigt")).toBe("ja");
    expect(wert(3, 1)).toBe("7 kg");
    expect(zelle(3, 1).getAttribute("data-berichtigt")).toBe("ja");
    expect(zelle(3, 1).getAttribute("data-bearbeitet")).toBe("nein");
    expect(berichtigtHinweis(3, 1)).toBe("berichtigt — erkannt war „[unleserlich]“");
    expect(zelle(1, 2).getAttribute("data-berichtigt")).toBe("nein");
    // Der Bildtext trägt dieselbe Berichtigung (ein Speicher, ein Rückgängig/Zurücksetzen).
    expect(q("bild-berichtigung")?.getAttribute("data-berichtigt")).toBe("true");

    // Neuladen: Stände verworfen, neu gelesen — die Tabelle trägt die Berichtigung weiter.
    await neuLaden();
    await zeige(BILD_TB, "ko:fiktiv-1");
    expect([wert(2, 1), wert(3, 1)]).toEqual(["2 kg", "7 kg"]);
    expect(zelle(2, 1).getAttribute("data-berichtigt")).toBe("ja");
    expect([wert(1, 1), wert(1, 2), wert(2, 2)]).toEqual(["4 kg", "12,50 €", "-0,80 €"]);

    // Fundstelle je Zelle (OCR-E01): „12,50 €“ liegt bei 56 % / 20 % des Bildes, die berichtigte
    // „7 kg“ an der Stelle der erkannten „7“ (30 % / 53,3 %).
    await klick(zelle(1, 2).querySelector("[data-testid=bild-tabelle-zelle-fundstelle]"));
    expect(q("bild-fundstelle-ansicht")?.getAttribute("data-art")).toBe("bereich");
    expect(q("bild-fundstelle-bild")?.getAttribute("src")).toBe(BILD_TB);
    expect(markierungen()[0]?.links).toBeCloseTo(56, 4);
    expect(markierungen()[0]?.oben).toBeCloseTo(20, 4);
    await schliesseAnsicht();
    await klick(zelle(3, 1).querySelector("[data-testid=bild-tabelle-zelle-fundstelle]"));
    expect(markierungen()).toHaveLength(1);
    expect(markierungen()[0]?.links).toBeCloseTo(30, 4);
    expect(markierungen()[0]?.oben).toBeCloseTo((160 / 300) * 100, 4);
    await schliesseAnsicht();
    // Die vorher leere Zelle hat keine Wörter: markiert wird ihr Bereich im Bild.
    await klick(zelle(2, 1).querySelector("[data-testid=bild-tabelle-zelle-fundstelle]"));
    expect(q("bild-fundstelle-ansicht")?.getAttribute("data-art")).toBe("bereich");
    expect(markierungen()[0]?.links).toBeCloseTo(30, 4);
    expect(markierungen()[0]?.oben).toBeCloseTo((110 / 300) * 100, 4);
    await schliesseAnsicht();

    // Quellwechsel: anderes Dokument mit demselben Bild — keine Übertragung.
    await zeige(BILD_TB, "ko:fiktiv-2");
    expect(wert(3, 1)).toBe("[unleserlich]");
    expect(wert(2, 1)).toBe("");
    expect(tabellenAttr("data-berichtigt")).toBe("nein");
    // Verändertes Bild an derselben Quelle — keine Übertragung, sichtbar benannt.
    await zeige(BILD_TC, "ko:fiktiv-1");
    expect(wert(3, 1)).toBe("[unleserlich]");
    expect(tabellenAttr("data-berichtigt")).toBe("nein");
    expect(q("bild-berichtigung-andere-fassung")).not.toBeNull();

    // Zurück zum berichtigten Bild; „Zurücksetzen“ am Bildtext bringt die erkannte Tabelle zurück.
    await zeige(BILD_TB, "ko:fiktiv-1");
    expect(wert(3, 1)).toBe("7 kg");
    await klick(q("bild-berichtigung-zuruecksetzen"));
    expect(korrekturServer.liste).toEqual([]);
    expect(wert(3, 1)).toBe("[unleserlich]");
    expect(wert(2, 1)).toBe("");
    expect(tabellenAttr("data-berichtigt")).toBe("nein");
  });
});

describe("T2 · Text berichtigt (OCR-E02) — die Tabelle übernimmt es, ohne zu raten", () => {
  it("ähnliche Wörter landen in ihrer Zelle; ein ergänztes Wort wird benannt, nicht verteilt", async () => {
    await profilLaden();
    await zeige(BILD_TB, "ko:fiktiv-1");
    await klick(q("bild-berichtigung-bearbeiten"));
    await tippe(
      q("bild-berichtigung-feld"),
      "Posten Menge Preis\nVentil 4 kg 12,60 €\nDichtung ca. -0,80 €\nFilter 7 3,10",
    );
    await klick(q("bild-berichtigung-speichern"));
    expect(q("bild-berichtigung")?.getAttribute("data-berichtigt")).toBe("true");

    expect(wert(1, 2)).toBe("12,60 €");
    expect(zelle(1, 2).getAttribute("data-berichtigt")).toBe("ja");
    expect(berichtigtHinweis(1, 2)).toBe("berichtigt — erkannt war „12,50 €“");
    // Die unleserliche Zelle trägt jetzt den Wert der Person — nicht einen der Erkennung.
    expect(wert(3, 1)).toBe("7");
    expect(zelle(3, 1).getAttribute("data-berichtigt")).toBe("ja");
    // „ca.“ hat keine Stelle im Bild: keine Zelle bekommt es, der Hinweis nennt es.
    expect([wert(2, 0), wert(2, 1), wert(2, 2)]).toEqual(["Dichtung", "", "-0,80 €"]);
    expect(q("bild-tabelle-nicht-zugeordnet")?.textContent).toContain("ca.");

    // Aus dieser Tabelle gespeichert: der Block ersetzt die Tabellenzeilen, „ca.“ bleibt erhalten.
    await tippeZelle(2, 1, "1 kg");
    await klick(q("bild-tabelle-speichern"));
    expect(korrekturServer.liste.map((k) => k.text)).toEqual([
      "Posten\tMenge\tPreis\nVentil\t4 kg\t12,60 €\nDichtung\t1 kg\t-0,80 €\nFilter\t7\t3,10\nca.",
    ]);
    expect(q("bild-tabelle-nicht-zugeordnet")).toBeNull();
    expect(wert(2, 1)).toBe("1 kg");
  });
});

describe("T3 · ohne Schreibrecht: nur Ansicht, mit Grund", () => {
  it("kein Speichern; Änderungen gelten sichtbar nur in dieser Ansicht", async () => {
    korrekturServer.darf = false;
    await profilLaden();
    await zeige(BILD_TB, "ko:fiktiv-1");
    expect(tabellenAttr("data-dauerhaft")).toBe("kein-recht");
    await tippeZelle(3, 1, "7 kg");
    expect(q("bild-tabelle-speichern")).toBeNull();
    expect(q("bild-tabelle-nur-ansicht")?.textContent?.length).toBeGreaterThan(0);
    expect(korrekturServer.aufrufe).toEqual([]);
  });
});
