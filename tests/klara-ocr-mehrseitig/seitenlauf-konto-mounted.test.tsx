// @vitest-environment jsdom
// ================================================================================================
// OCR-E04 · Nacharbeit 10 (Ben) · DER SEITENLAUF GEHÖRT DEM KONTO — UND „TEXT AUS DATEI EINFÜGEN“
// ZEIGT DEN STAND JE SEITE.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1. Gemountet über die Hülle aus
// `tests/entwurf-verlassen/`; der bestätigte Profilstand ist echt (`lib/assistenzProfil.ts`), ersetzt
// sind der Draht des Profils, das Lesen der PDF, das Zeichnen der Seite und die Texterkennung. Die
// Erkennung von Seite 1 wartet, bis der Test sie freigibt — so liegt der Kontowechsel bzw. die
// Prüfung des Zwischenstands sicher MITTEN im Lauf.
//
//   K1  Gemeinsamer Lauf (`lesePdfDateiSeiten`): Kontowechsel während Seite 1 — keine weitere Seite,
//       kein Zwischenstand mehr, Ergebnis verworfen.
//   K2  „Text aus Datei einfügen“: während des Lesens steht „Seite 1 · wird gelesen“, danach jede
//       Seite mit ihrem Zustand.
//   K3  „Text aus Datei einfügen“: Kontowechsel während des Lesens — nichts eingefügt, kein Stand.
//   K4  „Text aus Datei einfügen“ bei ausgeschalteter Automatik: jede Seite „nicht gelesen ·
//       Automatik aus“ sichtbar, ehrliche Meldung, nichts eingefügt.
//   K5  „Fragen an ein Dokument“: Kontowechsel während des Lesens — keine Fundstellen, kein Stand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import type { PdfDocumentText } from "../../apps/web/src/lib/pdf";

const steuerung = vi.hoisted(() => ({
  pdf: { text: "", truncated: false, pageCount: 0 } as PdfDocumentText,
  ocrText: {} as Record<number, string>,
  gezeichnet: [] as number[],
  erkannt: [] as number[],
  tor: null as null | { offen: Promise<void>; oeffnen: () => void },
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  readPdfFile: async () => steuerung.pdf,
  runImageOcr: async (input: unknown): Promise<OcrResult> => {
    const roh = typeof input === "string" ? atob(input.split(",")[1] ?? "") : "";
    const seite = Number(/seite-(\d+)/.exec(roh)?.[1]);
    steuerung.erkannt.push(seite);
    if (seite === 1 && steuerung.tor) {
      await steuerung.tor.offen;
    }
    const text = steuerung.ocrText[seite];
    return text === undefined ? { status: "failed", text: "" } : { status: "success", text };
  },
  pdfSeitenZeichner: async () => ({
    zeichne: async (seite: number) => {
      steuerung.gezeichnet.push(seite);
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

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import {
  type AssistenzProfilAntwort,
  assistenzProfilApi,
} from "../../apps/web/src/api/assistenzProfil";
import i18n from "../../apps/web/src/i18n";
import {
  bestaetigeAssistenzProfil,
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import type { QuellenBefund } from "../../apps/web/src/lib/bildAutomatik";
import { neueBildAnalyse } from "../../apps/web/src/lib/bildAutomatikLauf";
import { FILE_TEXT_INSERT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { LAUF_VERWORFEN, lesePdfDateiSeiten } from "../../apps/web/src/lib/pdfSeitenLauf";
import { Dokumentfragen } from "../../apps/web/src/pages/Dokumentfragen";
import { abbauen, flaeche, flush, grundzustand, mount } from "../entwurf-verlassen/huelle";

const SCAN: Record<number, string> = {
  1: "Pruefkarte 47 wurde am Montag abgezeichnet.",
  2: "Lager 29 ist freigegeben.",
};

function profilMit(bildAutomatik: boolean): AssistenzProfilAntwort {
  return {
    profil: {
      name: null,
      avatar: null,
      bewegung: "standard",
      eingerichtetAm: null,
      fassung: 1,
      geaendertAm: "2026-10-13T08:00:00.000Z",
      bildAutomatik,
    },
    einrichtungOffen: true,
  };
}

function torSchliessen(): void {
  let oeffnen: () => void = () => undefined;
  const offen = new Promise<void>((r) => {
    oeffnen = r;
  });
  steuerung.tor = { offen, oeffnen };
}

async function bis(bedingung: () => boolean, runden = 80): Promise<void> {
  for (let i = 0; i < runden && !bedingung(); i += 1) {
    await act(async () => {
      await flush();
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

async function kontoWechseln(): Promise<void> {
  konto = "konto-b";
  await act(async () => {
    await ladeAssistenzProfil("konto-b");
  });
}

function pdfDatei(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });
}

function zweiScanSeiten(): PdfDocumentText {
  return {
    text: "",
    truncated: false,
    pageCount: 2,
    totalPages: 2,
    pages: ["", ""],
    pageImages: [true, true],
  };
}

/** Den Eingang „Text aus Datei einfügen“ bedienen — ohne auf das Ende des Lesens zu warten. */
async function einfuegen(...dateien: File[]): Promise<void> {
  const input = flaeche().querySelector<HTMLInputElement>(
    `input[type="file"][accept="${FILE_TEXT_INSERT_ACCEPT}"]`,
  );
  if (!input) {
    throw new Error("Kein Eingang „Text aus Datei einfügen“");
  }
  Object.defineProperty(input, "files", { value: dateien, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function einfuegenSeiten(): string[] {
  const liste = flaeche().querySelector("[data-testid=einfuegen-pdf-seiten]");
  const zeilen = liste?.querySelectorAll<HTMLElement>("[data-testid=pdf-seite]") ?? [];
  return [...zeilen].map((el) => {
    const status = el.getAttribute("data-status");
    return `${el.getAttribute("data-seite")}:${status}`;
  });
}

function textDatei(name: string, inhalt: string): File {
  return new File([inhalt], name, { type: "text/plain" });
}

/** Die Dateinamen der gezeigten Seitenstände, in Reihenfolge. */
function einfuegenDateien(): string[] {
  const liste = flaeche().querySelector("[data-testid=einfuegen-pdf-seiten]");
  const koepfe = liste?.querySelectorAll<HTMLElement>("[data-testid=pdf-seiten] output") ?? [];
  return [...koepfe].map((el) => el.textContent ?? "");
}

function eingefuegt(): string {
  return [...flaeche().querySelectorAll("textarea")].map((el) => el.value).join("\n");
}

function sichtbar(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

let profile: Record<string, AssistenzProfilAntwort> = {};
let konto = "konto-a";

beforeEach(async () => {
  await grundzustand();
  steuerung.pdf = zweiScanSeiten();
  steuerung.ocrText = { ...SCAN };
  steuerung.gezeichnet = [];
  steuerung.erkannt = [];
  steuerung.tor = null;
  profile = { "konto-a": profilMit(true), "konto-b": profilMit(true) };
  konto = "konto-a";
  vi.spyOn(assistenzProfilApi, "lesen").mockImplementation(
    async () => profile[konto] ?? { profil: null, einrichtungOffen: true },
  );
  await act(async () => {
    await ladeAssistenzProfil("konto-a");
  });
  await mount("/erfassen", "freitext");
});

afterEach(() => {
  steuerung.tor?.oeffnen();
  abbauen();
  verwerfeAssistenzProfil();
  vi.restoreAllMocks();
});

describe("OCR-E04 · Nacharbeit 10 · Seitenlauf: Konto und Seitenstand", () => {
  it("K1 · gemeinsamer Lauf: Kontowechsel während Seite 1 — keine weitere Seite, verworfen", async () => {
    torSchliessen();
    const staende: QuellenBefund[] = [];
    let fertig = false;
    const lauf = lesePdfDateiSeiten(pdfDatei("fiktiv.pdf"), zweiScanSeiten(), {
      analyse: neueBildAnalyse(),
      onFortschritt: (s) => staende.push(s),
    }).finally(() => {
      fertig = true;
    });
    await bis(() => steuerung.erkannt.length === 1);
    const vorher = staende.length;

    await kontoWechseln();
    await act(async () => {
      steuerung.tor?.oeffnen();
    });
    await bis(() => fertig);

    expect(await lauf).toBe(LAUF_VERWORFEN);
    expect(steuerung.gezeichnet).toEqual([1]);
    expect(steuerung.erkannt).toEqual([1]);
    expect(staende.length).toBe(vorher);
  });

  it("K2 · Text einfügen: Stand je Seite während und nach dem Lesen", async () => {
    torSchliessen();
    await einfuegen(pdfDatei("fiktiver-scan.pdf"));
    await bis(() => steuerung.erkannt.length === 1);
    await bis(() => einfuegenSeiten().length === 2);
    expect(einfuegenSeiten()).toEqual(["1:laeuft", "2:wartet"]);

    await act(async () => {
      steuerung.tor?.oeffnen();
    });
    await bis(() => einfuegenSeiten().every((s) => s.endsWith(":gelesen")));
    expect(einfuegenSeiten()).toEqual(["1:gelesen", "2:gelesen"]);
    expect(eingefuegt()).toContain("Pruefkarte 47");
    expect(eingefuegt()).toContain("Lager 29");
  });

  it("K3 · Text einfügen: Kontowechsel während des Lesens — nichts eingefügt, kein Stand", async () => {
    torSchliessen();
    await einfuegen(pdfDatei("fiktiver-scan.pdf"));
    await bis(() => steuerung.erkannt.length === 1);

    await kontoWechseln();
    await act(async () => {
      steuerung.tor?.oeffnen();
    });
    await bis(() => false, 30);

    expect(steuerung.erkannt).toEqual([1]);
    expect(eingefuegt()).not.toContain("[fiktiver-scan.pdf]");
    expect(eingefuegt()).not.toContain("Pruefkarte 47");
    expect(einfuegenSeiten()).toEqual([]);
  });

  it("K4 · Text einfügen bei ausgeschalteter Automatik: jede Seite sichtbar „nicht gelesen“", async () => {
    // Bestätigte Deaktivierung (derselbe Weg wie nach dem Speichern in Setup › Klara).
    await act(async () => {
      bestaetigeAssistenzProfil("konto-a", profilMit(false));
    });
    await einfuegen(pdfDatei("fiktiver-scan.pdf"));
    await bis(() => sichtbar().includes(i18n.t("pdfscan.leer", { name: "fiktiver-scan.pdf" })));

    expect(steuerung.erkannt).toEqual([]);
    expect(einfuegenSeiten()).toEqual(["1:nicht-analysiert", "2:nicht-analysiert"]);
    const liste = flaeche().querySelector("[data-testid=einfuegen-pdf-seiten]");
    expect(liste?.textContent).toContain(i18n.t("klarabildkontext.grund.automatikAus"));
    const kopf = liste?.querySelector("[data-testid=pdf-seiten]");
    expect(kopf?.getAttribute("data-status")).toBe("aus");
    expect(eingefuegt()).not.toContain("[fiktiver-scan.pdf]");
  });

  it("K6 · Mehrfachauswahl: Kontowechsel während der ersten PDF beendet die ganze Auswahl", async () => {
    torSchliessen();
    await einfuegen(
      pdfDatei("a-scan.pdf"),
      pdfDatei("b-scan.pdf"),
      textDatei("c-notiz.txt", "Notiz aus der Auswahl"),
    );
    await bis(() => steuerung.erkannt.length === 1);

    await kontoWechseln();
    await act(async () => {
      steuerung.tor?.oeffnen();
    });
    await bis(() => false, 40);

    // Nur Seite 1 der ersten PDF wurde je angefasst — die Restschlange lief nicht weiter.
    expect(steuerung.gezeichnet).toEqual([1]);
    expect(steuerung.erkannt).toEqual([1]);
    const text = eingefuegt();
    expect(text).not.toContain("[a-scan.pdf]");
    expect(text).not.toContain("[b-scan.pdf]");
    expect(text).not.toContain("[c-notiz.txt]");
    expect(text).not.toContain("Pruefkarte 47");
    expect(einfuegenSeiten()).toEqual([]);
  });

  it("K7 · Kontrollfall: Mehrfachauswahl ohne Kontowechsel übernimmt jede Datei in Reihenfolge", async () => {
    await einfuegen(
      pdfDatei("a-scan.pdf"),
      pdfDatei("b-scan.pdf"),
      textDatei("c-notiz.txt", "Notiz aus der Auswahl"),
    );
    await bis(() => eingefuegt().includes("[c-notiz.txt]"));

    const text = eingefuegt();
    expect(text.indexOf("[a-scan.pdf]")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("[a-scan.pdf]")).toBeLessThan(text.indexOf("[b-scan.pdf]"));
    expect(text.indexOf("[b-scan.pdf]")).toBeLessThan(text.indexOf("[c-notiz.txt]"));
    expect(text).toContain("Notiz aus der Auswahl");
    expect(steuerung.gezeichnet).toEqual([1, 2, 1, 2]);
    const dateien = einfuegenDateien();
    expect(dateien).toHaveLength(2);
    expect(dateien[0]).toContain("a-scan.pdf");
    expect(dateien[1]).toContain("b-scan.pdf");
  });

  it("K8 · ein veralteter Vorgang räumt den neueren nicht: Auswahl unter Konto B bleibt stehen", async () => {
    torSchliessen();
    await einfuegen(pdfDatei("a-scan.pdf"));
    await bis(() => steuerung.erkannt.length === 1);

    // Kontowechsel, dann eine neue Auswahl unter dem neuen Konto — beide warten auf Seite 1.
    await kontoWechseln();
    await einfuegen(pdfDatei("b-scan.pdf"));
    await bis(() => steuerung.erkannt.length === 2);
    await act(async () => {
      steuerung.tor?.oeffnen();
    });
    await bis(() => eingefuegt().includes("[b-scan.pdf]"));
    await bis(() => false, 20);

    const text = eingefuegt();
    expect(text).toContain("[b-scan.pdf]");
    expect(text).not.toContain("[a-scan.pdf]");
    const dateien = einfuegenDateien();
    expect(dateien).toHaveLength(1);
    expect(dateien[0]).toContain("b-scan.pdf");
    expect(einfuegenSeiten()).toEqual(["1:gelesen", "2:gelesen"]);
  });

  it("K5 · Fragen an ein Dokument: Kontowechsel während des Lesens — keine Fundstellen, kein Stand", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      await act(async () => {
        root.render(createElement(MemoryRouter, null, createElement(Dokumentfragen)));
        await flush();
      });
      torSchliessen();
      const input = container.querySelector<HTMLInputElement>("[data-testid=dokumentfragen-datei]");
      if (!input) {
        throw new Error("Kein Datei-Eingang");
      }
      Object.defineProperty(input, "files", {
        value: [pdfDatei("fiktiver-scan.pdf")],
        configurable: true,
      });
      await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await flush();
      });
      await bis(() => steuerung.erkannt.length === 1);

      await kontoWechseln();
      await act(async () => {
        steuerung.tor?.oeffnen();
      });
      await bis(() => false, 30);

      expect(steuerung.erkannt).toEqual([1]);
      expect(container.querySelector("[data-testid=dokumentfragen-seiten]")).toBeNull();
      expect(container.querySelectorAll("[data-testid=dokumentfragen-stelle]")).toHaveLength(0);
      expect(container.textContent ?? "").not.toContain("Pruefkarte 47");
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
