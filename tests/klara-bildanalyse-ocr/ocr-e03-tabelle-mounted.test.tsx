// @vitest-environment jsdom
// ================================================================================================
// OCR-E03 · DIE BEARBEITBARE TABELLE UNTER DEM BEFUND — gemountet (Auftrag
// produkt:20261012:klara-ocr-tabellen).
// ================================================================================================
//
// Gemountet ist `BildBefundListe` — dieselbe Liste, die Dateiimport, Bildanhänge, Bilder im Text und
// Office im Artikel zeigen. Der Befund kommt aus der echten Rasterbildung (`bildTabelleAusWoertern`)
// über kontrollierte Wortrahmen; ersetzt ist nur die Zwischenablage des Browsers.
//
//   M1  Kopfzeile als <th>, leere Zellen leer und als „leer“ benannt, Werte wörtlich (K1, K2).
//   M2  unleserliche/unsichere Zelle sichtbar benannt (nicht nur Farbe), kein Wert erfunden (K3).
//   M3  Zelle ändern, zurücksetzen; der Befund bleibt (K1).
//   M4  „Tabelle kopieren“ legt HTML-Tabelle (mit Änderung und Herkunft) UND Tabulatortext ab (K4).
//   M5  anderes Bild (andere Inhaltskennung): keine Änderung wandert mit (Quellwechsel, K6).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { BildBefundListe } from "../../apps/web/src/components/BildBefundListe";
import i18n from "../../apps/web/src/i18n";
import {
  type BildBefund,
  type BildTabelle,
  type QuellenBefund,
  bildTabelleAusWoertern,
  leererBefund,
  markiereUnerkannteInhalte,
} from "../../apps/web/src/lib/bildAutomatik";
import type { OcrWort } from "../../apps/web/src/lib/ocr";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function wort(text: string, x0: number, y0: number, sicherheit = 95): OcrWort {
  return { text, confidence: sicherheit, bbox: { x0, y0, x1: x0 + text.length * 18, y1: y0 + 30 } };
}

const WOERTER: OcrWort[] = [
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
];

function befund(inhaltskennung: string): QuellenBefund {
  const tabelle = bildTabelleAusWoertern(WOERTER);
  const fundstelle = { quelle: "liste.pptx", art: "pptx", bild: 2, folie: 3, bildAufFolie: 1 };
  const b: BildBefund = {
    ...leererBefund({ ...fundstelle, art: "pptx" }, "gelesen"),
    inhaltskennung,
    text: "Posten Menge Preis",
    textGekennzeichnet: "Posten Menge Preis",
    bildTabelle: tabelle,
  };
  return {
    quelle: "liste.pptx",
    art: "pptx",
    status: "teilweise",
    befunde: [b],
    nichtGelesen: [],
    hinweise: [],
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const abgelegt: Record<string, Blob>[] = [];

async function zeige(q: QuellenBefund): Promise<void> {
  await act(async () => {
    root.render(createElement(BildBefundListe, { befund: q }));
  });
}

function zellen(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-testid=bild-tabelle-zelle]")];
}

function zelle(zeile: number, spalte: number): HTMLElement {
  const el = container.querySelector<HTMLElement>(
    `[data-testid=bild-tabelle-zelle][data-zeile="${zeile}"][data-spalte="${spalte}"]`,
  );
  if (!el) {
    throw new Error(`Zelle ${zeile}/${spalte} fehlt`);
  }
  return el;
}

function geaendert(): string | null {
  const tabelle = container.querySelector("[data-testid=bild-tabelle]");
  return tabelle?.getAttribute("data-geaendert") ?? null;
}

function wert(zeile: number, spalte: number): string {
  return zelle(zeile, spalte).querySelector("input")?.value ?? "";
}

async function tippe(zeile: number, spalte: number, text: string): Promise<void> {
  const input = zelle(zeile, spalte).querySelector("input") as HTMLInputElement;
  const setzen = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzen?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function lies(blob: Blob | undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!blob) {
      reject(new Error("kein Eintrag"));
      return;
    }
    const leser = new FileReader();
    leser.onload = () => resolve(String(leser.result));
    leser.onerror = () => reject(leser.error);
    leser.readAsText(blob);
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  abgelegt.length = 0;
  vi.stubGlobal(
    "ClipboardItem",
    class {
      constructor(daten: Record<string, Blob>) {
        abgelegt.push(daten);
      }
    },
  );
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { write: vi.fn(async () => {}), writeText: vi.fn(async () => {}) },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe("OCR-E03 · bearbeitbare Tabelle im Befund", () => {
  it("M1/M2 · Kopf, Zeilen, leere und unleserliche Zellen — sichtbar benannt, nichts ergänzt", async () => {
    await zeige(befund("sha256:eins"));
    const tabelle = container.querySelector("[data-testid=bild-tabelle]");
    expect(tabelle?.getAttribute("data-zeilen")).toBe("4");
    expect(tabelle?.getAttribute("data-spalten")).toBe("3");
    expect(tabelle?.getAttribute("data-kopfzeilen")).toBe("1");
    expect(zellen()).toHaveLength(12);
    // Kopfzeile als Spaltenkopf.
    const kopf = [...container.querySelectorAll("[data-testid=bild-tabelle-raster] thead th")];
    expect(kopf.map((th) => th.querySelector("input")?.value)).toEqual([
      "Posten",
      "Menge",
      "Preis",
    ]);
    expect(kopf.every((th) => th.getAttribute("scope") === "col")).toBe(true);
    // Werte wörtlich, leere Zelle leer.
    expect([wert(1, 0), wert(1, 1), wert(1, 2)]).toEqual(["Ventil", "4 kg", "12,50 €"]);
    expect([wert(2, 0), wert(2, 1), wert(2, 2)]).toEqual(["Dichtung", "", "-0,80 €"]);
    expect(zelle(2, 1).getAttribute("data-zustand")).toBe("leer");
    expect(zelle(2, 1).textContent).toContain("leer");
    // Unleserlich: keine Lesung, sichtbares Wort statt nur Farbe.
    expect(wert(3, 1)).toBe("[unleserlich]");
    expect(zelle(3, 1).getAttribute("data-zustand")).toBe("unleserlich");
    expect(zelle(3, 1).textContent).toContain("nicht lesbar");
    expect(container.querySelector("[data-testid=bild-tabelle-unsicher]")?.textContent).toContain(
      "Unsichere Zellen: 1",
    );
    // Jede Zelle ist per Name erreichbar.
    expect(zelle(3, 1).querySelector("input")?.getAttribute("aria-label")).toBe(
      "Zeile 4, Spalte 2",
    );
  });

  it("M3 · ändern, einzeln zurücksetzen, alles verwerfen", async () => {
    await zeige(befund("sha256:eins"));
    await tippe(2, 1, "6 kg");
    expect(wert(2, 1)).toBe("6 kg");
    expect(zelle(2, 1).getAttribute("data-bearbeitet")).toBe("ja");
    expect(zelle(2, 1).textContent).toContain("geändert");
    const zurueck = zelle(2, 1).querySelector<HTMLButtonElement>(
      "[data-testid=bild-tabelle-zelle-zuruecksetzen]",
    );
    await act(async () => {
      zurueck?.click();
    });
    expect(wert(2, 1)).toBe("");
    expect(zelle(2, 1).getAttribute("data-bearbeitet")).toBe("nein");

    await tippe(3, 1, "7 kg");
    await tippe(1, 0, "Ventil DN 50");
    expect(geaendert()).toBe("2");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=bild-tabelle-verwerfen]")?.click();
    });
    expect([wert(1, 0), wert(3, 1)]).toEqual(["Ventil", "[unleserlich]"]);
  });

  it("M4 · Kopieren legt die geänderte Tabelle als HTML (mit Herkunft) UND als Text ab", async () => {
    await zeige(befund("sha256:eins"));
    await tippe(3, 1, "7 kg");
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=bild-tabelle-kopieren]")?.click();
    });
    const ergebnis = container.querySelector("[data-testid=bild-tabelle-kopiert]");
    expect(ergebnis?.getAttribute("data-ergebnis")).toBe("tabelle");
    expect(ergebnis?.textContent).toContain("als Tabelle (HTML)");
    expect(abgelegt).toHaveLength(1);
    const html = await lies(abgelegt[0]?.["text/html"]);
    const text = await lies(abgelegt[0]?.["text/plain"]);
    expect(html).toBe(
      [
        "<table><caption>Tabelle aus liste.pptx, Folie 3, Bild 1 (Texterkennung)</caption>",
        "<thead><tr><th>Posten</th><th>Menge</th><th>Preis</th></tr></thead><tbody>",
        "<tr><td>Ventil</td><td>4 kg</td><td>12,50 €</td></tr>",
        "<tr><td>Dichtung</td><td></td><td>-0,80 €</td></tr>",
        "<tr><td>Filter</td><td>7 kg</td><td>3,10</td></tr>",
        "</tbody></table>",
      ].join(""),
    );
    expect(text).toBe(
      "Posten\tMenge\tPreis\nVentil\t4 kg\t12,50 €\nDichtung\t\t-0,80 €\nFilter\t7 kg\t3,10",
    );
  });

  it("M4 · ohne HTML-Zwischenablage ehrlich „nur als Text“", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    await zeige(befund("sha256:eins"));
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=bild-tabelle-kopieren]")?.click();
    });
    const ergebnis = container.querySelector("[data-testid=bild-tabelle-kopiert]");
    expect(ergebnis?.getAttribute("data-ergebnis")).toBe("nur-text");
    expect(ergebnis?.textContent).toContain("nur als Text");
  });

  it("M6 · nicht geprüfte Leerzelle: sichtbar benannt und in der Kopie gekennzeichnet", async () => {
    const q = befund("sha256:eins");
    const b = q.befunde[0] as BildBefund;
    // Die Messung lieferte kein Ergebnis (Nacharbeit 5): die Zelle ohne Wörter ist ungeprüft.
    const tabelle = markiereUnerkannteInhalte(b.bildTabelle as BildTabelle, []);
    const ungeprueft: QuellenBefund = { ...q, befunde: [{ ...b, bildTabelle: tabelle }] };
    await zeige(ungeprueft);
    expect(wert(2, 1)).toBe("[ungeprüft]");
    expect(zelle(2, 1).getAttribute("data-zustand")).toBe("ungeprueft");
    expect(zelle(2, 1).textContent).toContain("nicht geprüft");
    expect(container.querySelector("[data-testid=bild-tabelle-unsicher]")?.textContent).toContain(
      "Unsichere Zellen: 2",
    );
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=bild-tabelle-kopieren]")?.click();
    });
    expect(await lies(abgelegt[0]?.["text/plain"])).toContain("Dichtung\t[ungeprüft]\t-0,80 €");
    expect(await lies(abgelegt[0]?.["text/html"])).toContain(
      "<tr><td>Dichtung</td><td>[ungeprüft]</td><td>-0,80 €</td></tr>",
    );
  });

  it("M5 · anderes Bild: die Änderungen des vorigen Bildes gelten nicht", async () => {
    await zeige(befund("sha256:eins"));
    await tippe(3, 1, "7 kg");
    expect(wert(3, 1)).toBe("7 kg");
    await zeige(befund("sha256:zwei"));
    expect(wert(3, 1)).toBe("[unleserlich]");
    expect(geaendert()).toBe("0");
  });
});
