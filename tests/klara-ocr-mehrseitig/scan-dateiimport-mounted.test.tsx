// @vitest-environment jsdom
// ================================================================================================
// OCR-E04 · EINE GESCANNTE, MEHRSEITIGE PDF STEHT OHNE KLICK IN KLARA BEREIT — an der echten
// Erfassungsfläche (Dateiimport).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1. Gemountet über die Hülle aus
// `tests/entwurf-verlassen/` (echter Baum, echte Ablegezone). Ersetzt sind allein das Lesen der PDF
// (`readPdfFileWithOriginal`: bekannter Seiteninhalt), das Zeichnen der Seite (`pdfSeitenZeichner`)
// und die Texterkennung (`runImageOcr`) — damit Inhalt und Fehler je Seite steuerbar sind. Die
// echte pdfjs-Engine misst `pdf-scan-seiten.test.ts`, die echte Erkennung im Browser
// `tests-smoke/klara-ocr-mehrseitige-scans-browser.spec.ts`.
//
//   M1  Gescannte PDF (keine Textebene) ablegen → jede Seite gelesen, ohne Klick; Text der Datei
//       ist die ganze PDF; Klara nennt für Fragen zu erster und letzter Seite die richtige Seite.
//   M2  Gemischte PDF → Textebene und gescannte Seiten je Seite, keine doppelte Passage, keine
//       Bildseite ausgelassen.
//   M3  Fehler auf einer Seite → Fehler sichtbar, die übrigen Seiten gelesen und in Klaras Kontext;
//       Klara und der Status geben sich nicht als vollständig aus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import type { PdfDocumentText } from "../../apps/web/src/lib/pdf";

const steuerung = vi.hoisted(() => ({
  pdf: { text: "", truncated: false, pageCount: 0 } as PdfDocumentText,
  zeichneFehler: new Set<number>(),
  ocrText: {} as Record<number, string>,
  gezeichnet: [] as number[],
  ocr: vi.fn(async (_input: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
  readPdfFileWithOriginal: async () => ({
    pdf: steuerung.pdf,
    original: "data:application/pdf;base64,JVBERi0xLjQK",
  }),
  pdfSeitenZeichner: async () => ({
    zeichne: async (seite: number) => {
      steuerung.gezeichnet.push(seite);
      if (steuerung.zeichneFehler.has(seite)) {
        throw new Error(`seite-${seite}-defekt`);
      }
      return `data:image/png;base64,${btoa(`seite-${seite}`)}`;
    },
    schliessen: async () => undefined,
  }),
}));

vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../entwurf-verlassen/attrappen")).authAttrappe(),
);

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../entwurf-verlassen/attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  abbauen,
  dateiAblegen,
  flaeche,
  flush,
  grundzustand,
  klick,
  mount,
  tippe,
} from "../entwurf-verlassen/huelle";

const SCAN: Record<number, string> = {
  1: "WARTUNGSBERICHT ANLAGE 7\n\nPruefkarte 47 wurde am Montag abgezeichnet.",
  2: "Abschnitt Druckpruefung\n\nDer Druck betrug 4,5 bar.",
  3: "Abschnitt Ventile\n\nVentil V3 wurde getauscht.",
  4: "ABSCHLUSS\n\nLager 29 ist freigegeben.",
};

function pdfDatei(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });
}

async function ablegen(datei: File): Promise<void> {
  await dateiAblegen(datei);
  for (let i = 0; i < 6; i += 1) {
    await act(flush);
  }
}

function q(id: string): HTMLElement | null {
  return flaeche().querySelector<HTMLElement>(`[data-testid=${id}]`);
}

function seiten(): { seite: string | null; teil: string | null; status: string | null }[] {
  return [...flaeche().querySelectorAll<HTMLElement>("[data-testid=pdf-seite]")].map((el) => ({
    seite: el.getAttribute("data-seite"),
    teil: el.getAttribute("data-seitenteil"),
    status: el.getAttribute("data-status"),
  }));
}

async function frage(text: string): Promise<{ art: string | null; text: string }[]> {
  const feld = q("klara-bild-kontext-frage") as HTMLInputElement | null;
  if (!feld) {
    throw new Error("Klara-Frage fehlt");
  }
  await tippe(feld, text);
  const knopf = q("klara-bild-kontext-fragen");
  if (!knopf) {
    throw new Error("Fragen-Knopf fehlt");
  }
  await klick(knopf);
  for (let i = 0; i < 3; i += 1) {
    await act(flush);
  }
  const belege = flaeche().querySelectorAll<HTMLElement>("[data-testid=klara-bild-kontext-beleg]");
  return [...belege].map((el) => ({
    art: el.getAttribute("data-art"),
    text: el.textContent ?? "",
  }));
}

function sichtbar(): string {
  return (flaeche().textContent ?? "").replace(/\s+/g, " ");
}

beforeEach(async () => {
  await grundzustand();
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(async (input: unknown): Promise<OcrResult> => {
    const roh = typeof input === "string" ? atob(input.split(",")[1] ?? "") : "";
    const seite = Number(/seite-(\d+)/.exec(roh)?.[1]);
    const text = steuerung.ocrText[seite];
    return text === undefined
      ? { status: "failed", text: "", error: "engine-fehler" }
      : { status: "success", text };
  });
  steuerung.zeichneFehler = new Set();
  steuerung.gezeichnet = [];
  await mount("/erfassen", "datei");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("OCR-E04 · Dateiimport: gescannte, mehrseitige PDF", () => {
  it("M1 · ohne Klick jede Seite gelesen; erste und letzte Seite mit richtiger Seitenzahl", async () => {
    steuerung.pdf = {
      text: "",
      truncated: false,
      pageCount: 4,
      totalPages: 4,
      pages: ["", "", "", ""],
      pageImages: [true, true, true, true],
    };
    steuerung.ocrText = { ...SCAN };
    await ablegen(pdfDatei("fiktiver-bericht-scan.pdf"));

    expect(steuerung.gezeichnet).toEqual([1, 2, 3, 4]);
    expect(steuerung.ocr).toHaveBeenCalledTimes(4);
    expect(q("pdf-seiten")?.getAttribute("data-status")).toBe("vollstaendig");
    expect(seiten().map((s) => `${s.seite}:${s.status}`)).toEqual([
      "1:gelesen",
      "2:gelesen",
      "3:gelesen",
      "4:gelesen",
    ]);
    expect(sichtbar()).toContain(
      i18n.t("pdfscan.quelle.vollstaendig", { name: "fiktiver-bericht-scan.pdf", gesamt: 4 }),
    );
    // Klara: die Quelle ist vollständig gelesen, ohne separaten Auftrag.
    expect(q("klara-bild-kontext")?.getAttribute("data-vollstaendig")).toBe("true");

    const erste = await frage("Welche Pruefkarte wurde abgezeichnet?");
    expect(erste[0]?.text).toContain("fiktiver-bericht-scan.pdf · Seite 1, erkannt");
    expect(erste[0]?.text).toContain("Pruefkarte 47");
    const letzte = await frage("Welches Lager ist freigegeben?");
    expect(letzte[0]?.text).toContain("fiktiver-bericht-scan.pdf · Seite 4, erkannt");
    expect(letzte[0]?.text).toContain("Lager 29");
    expect(letzte.some((b) => b.text.includes("Seite 1"))).toBe(false);
  });

  it("M2 · gemischt: Textebene und gescannte Seiten je Seite, nichts doppelt, nichts ausgelassen", async () => {
    steuerung.pdf = {
      text: "Abschnitt Druckpruefung\nDer Druck betrug 4,5 bar laut Messprotokoll.\n\nAbschnitt Ventile\nDie Ventile wurden einzeln geprueft.",
      truncated: false,
      pageCount: 4,
      totalPages: 4,
      pages: [
        "",
        "Abschnitt Druckpruefung\nDer Druck betrug 4,5 bar laut Messprotokoll.",
        "Abschnitt Ventile\nDie Ventile wurden einzeln geprueft.",
        "",
      ],
      pageImages: [true, false, true, true],
    };
    steuerung.ocrText = { 1: SCAN[1] ?? "", 3: SCAN[3] ?? "", 4: SCAN[4] ?? "" };
    await ablegen(pdfDatei("fiktiv-gemischt.pdf"));

    // Die reine Textseite 2 wird nicht gezeichnet; jede andere Seite schon.
    expect(steuerung.gezeichnet).toEqual([1, 3, 4]);
    expect(seiten().map((s) => `${s.seite}:${s.teil}:${s.status}`)).toEqual([
      "1:bild:gelesen",
      "2:textebene:gelesen",
      "3:textebene:gelesen",
      "3:bild:gelesen",
      "4:bild:gelesen",
    ]);
    expect(q("pdf-seiten")?.getAttribute("data-status")).toBe("vollstaendig");
    // Seite 3: die erkannte Überschrift steht schon in der Textebene — einmal, mit Hinweis.
    expect(q("pdf-seite-doppelt")?.textContent).toBe(i18n.t("pdfscan.doppelt", { anzahl: 1 }));
    const texte = flaeche().querySelectorAll("[data-testid=pdf-seite-text]");
    const alle = [...texte].map((el) => el.textContent ?? "").join("\n");
    expect(alle.split("Abschnitt Ventile").length - 1).toBe(1);

    const belege = await frage("Welches Ventil wurde getauscht?");
    expect(belege[0]?.text).toContain("fiktiv-gemischt.pdf · Seite 3, erkannt");
    expect(belege.every((b) => b.art === "bild")).toBe(true);
  });

  it("M3 · Fehler auf einer Seite: Fehler sichtbar, übrige Seiten gelesen und im Kontext", async () => {
    steuerung.pdf = {
      text: "",
      truncated: false,
      pageCount: 4,
      totalPages: 4,
      pages: ["", "", "", ""],
      pageImages: [true, true, true, true],
    };
    steuerung.ocrText = { 1: SCAN[1] ?? "", 2: SCAN[2] ?? "", 4: SCAN[4] ?? "" };
    steuerung.zeichneFehler = new Set([2]);
    await ablegen(pdfDatei("fiktiv-defekt.pdf"));

    expect(seiten().map((s) => `${s.seite}:${s.status}`)).toEqual([
      "1:gelesen",
      "2:fehlgeschlagen",
      "3:fehlgeschlagen",
      "4:gelesen",
    ]);
    expect(q("pdf-seiten")?.getAttribute("data-status")).toBe("teilweise");
    expect(sichtbar()).toContain(
      i18n.t("pdfscan.quelle.teilweise", { name: "fiktiv-defekt.pdf", fertig: 2, gesamt: 4 }),
    );
    expect(sichtbar()).toContain(i18n.t("bildautomatik.status.fehlgeschlagen"));
    expect(q("klara-bild-kontext")?.getAttribute("data-vollstaendig")).toBe("false");

    const belege = await frage("Welches Lager ist freigegeben?");
    expect(belege[0]?.text).toContain("fiktiv-defekt.pdf · Seite 4, erkannt");
    expect(q("klara-bild-kontext-unvollstaendig")?.textContent).toBe(
      i18n.t("klarabildkontext.antwort.unvollstaendig", { offen: 2, gesamt: 4 }),
    );
  });
});
