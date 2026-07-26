// @vitest-environment jsdom
// AUFTRAG-uxpol3 (bens Restfund 4.1): ECHTE Integrationstiefe für den Capture-Dateityp-Seam. Kein
// nachgebautes Mini-Harness mehr: der Test mountet die EXPORTIERTE Produktionskomponente
// CaptureFileImport — exakt den Baum, den Capture.tsx rendert — und treibt den DORT gerenderten,
// versteckten <input> (realer Ref, echtes onChange → onExtractFile) über die realen Dateikacheln.
// Gepinnt an echtem Verhalten (nicht an Quelltext-Strings):
//  (a) im Erfassen sind JSON, Text/CSV, DOCX, PDF, PPTX und Bild/OCR AKTIV, Excel und Audio/Video
//      bleiben „geplant" (aus der realen Weiche detectFileKind abgeleitet).
//  (b) Klick auf eine aktive Kachel setzt am ECHTEN, gemounteten Input ein typgerechtes `accept` und
//      klickt genau diesen Input — kein breiter Multiformat-Dialog (JSON-Seam geschlossen).
//  (c) eine Datei am echten Input löst über onChange den realen onExtractFile-Pfad aus.
//  (d) „geplant"-Kacheln (Excel/Audio-Video) öffnen NICHTS und zeigen nur den ehrlichen Hinweis.
//  (e) kein aktiver Typ lässt ein inaktives Format zu; kein Fetch/Egress.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { CaptureFileImport } from "../../apps/web/src/components/CaptureFileImport";
import i18n from "../../apps/web/src/i18n";
import { FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { detectFileKind } from "../../apps/web/src/lib/extract";
import {
  acceptForFileSource,
  fileSourcesForSurface,
} from "../../apps/web/src/lib/importSourceGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CAPTURE_ACTIVE = ["json-file", "csv", "docx", "pdf", "pptx", "ocr"] as const;
const CAPTURE_PLANNED = ["xlsx"] as const;
// AUFTRAG-mega15 Block D (SCRUM-382): das Transkript ist gebaut, nur ohne hinterlegten Dienst —
// „geplant" waere hier die Falschaussage.
const CAPTURE_UNCONFIGURED = ["avtranscript"] as const;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let input: HTMLInputElement;
let clickSpy: ReturnType<typeof vi.fn>;
let extractSpy: ReturnType<typeof vi.fn>;
let fetchSpy: ReturnType<typeof vi.fn>;

// Mountet die ECHTE Produktionskomponente und greift den DORT gerenderten versteckten Input ab.
function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  act(() => {
    r.render(
      createElement(CaptureFileImport, {
        onExtractFile: extractSpy as unknown as (e: unknown) => void,
      }),
    );
  });
  const el = container.querySelector('input[type="file"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("versteckter Datei-Input fehlt im gemounteten Produktionsbaum");
  }
  input = el;
  // Es ist der ECHTE gemountete Input — wir beobachten nur seinen .click (kein realer Dateidialog).
  clickSpy = vi.fn();
  input.click = clickSpy;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  extractSpy = vi.fn();
  // „kein neuer Egress": ein Fetch würde hier auffallen — er darf NIE passieren.
  fetchSpy = vi.fn();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
});

afterEach(async () => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  await i18n.changeLanguage("de");
});

function tileById(id: string): HTMLButtonElement {
  const btn = container?.querySelector(`button[data-id="${id}"]`);
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Kachel [data-id=${id}] fehlt`);
  }
  return btn;
}

describe("uxpol3: Capture-Dateityp-Seam (echte Produktionskomponente gemountet)", () => {
  it("(a) Zustände: JSON/Text-CSV/DOCX/PDF/PPTX/OCR aktiv, Excel geplant, Audio-Video unkonfiguriert", () => {
    const byId = new Map(fileSourcesForSurface("capture").map((s) => [s.id, s.state]));
    for (const id of CAPTURE_ACTIVE) {
      expect(byId.get(id), id).toBe("active");
    }
    for (const id of CAPTURE_PLANNED) {
      expect(byId.get(id), id).toBe("planned");
    }
    for (const id of CAPTURE_UNCONFIGURED) {
      expect(byId.get(id), id).toBe("unconfigured");
      expect(byId.get(id), id).not.toBe("planned");
    }
  });

  it("(b) jede aktive Kachel setzt am ECHTEN gemounteten Input das typgerechte accept + klickt ihn", () => {
    mount();
    // Der gemountete Input trägt zunächst den realen Default-accept des Erfassen-Imports.
    expect(input.accept).toBe(FILE_IMPORT_ACCEPT);
    for (const id of CAPTURE_ACTIVE) {
      clickSpy.mockClear();
      act(() => {
        tileById(id).click();
      });
      const expected = acceptForFileSource(id);
      expect(expected, id).not.toBeNull();
      // GENAU der angeklickte Typ am realen Input — kein breiter Multiformat-accept mehr.
      expect(input.accept, id).toBe(expected);
      // Die aktive Kachel hat über die ECHTE onActivate-Verdrahtung genau diesen Input geklickt.
      expect(clickSpy, id).toHaveBeenCalledTimes(1);
      // Das accept lässt KEIN als inaktiv markiertes Format zu (Excel/Audio/Video).
      expect(input.accept).not.toContain(".xlsx");
      expect(input.accept).not.toContain("video/");
      expect(input.accept).not.toContain("audio/");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(c) eine Datei am echten Input löst über onChange den realen onExtractFile-Pfad aus", () => {
    mount();
    // Aktive JSON-Kachel klicken (setzt accept), dann eine echte Datei am realen Input liefern.
    act(() => {
      tileById("json-file").click();
    });
    expect(input.accept).toBe(acceptForFileSource("json-file"));
    const file = new File(["{}"], "a.json", { type: "application/json" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // Der reale onChange-Handler der Produktionskomponente hat onExtractFile mit dem echten Input als
    // Ziel (und der gewählten Datei) aufgerufen — genau der Erfassen-Extraktionspfad.
    expect(extractSpy).toHaveBeenCalledTimes(1);
    const evt = extractSpy.mock.calls[0]?.[0] as { target: HTMLInputElement };
    expect(evt.target).toBe(input);
    expect(evt.target.files?.[0]?.name).toBe("a.json");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(d) geplant-Kacheln (Excel/Audio-Video) öffnen NICHTS und zeigen nur den ehrlichen Hinweis", () => {
    mount();
    for (const id of CAPTURE_PLANNED) {
      clickSpy.mockClear();
      act(() => {
        tileById(id).click();
      });
      // Kein Dialog: onActivate wird für „planned" nie aufgerufen → der Input wird nie geklickt.
      expect(clickSpy, id).not.toHaveBeenCalled();
      expect(acceptForFileSource(id), id).toBeNull();
      // Kein onExtractFile ohne Datei-Auswahl.
      expect(extractSpy).not.toHaveBeenCalled();
    }
    // Ehrlicher Hinweis erscheint (nicht-modales <output>), aber nie ein Import/Fetch.
    expect(container?.querySelector("output")).not.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(e) kein aktiver Typ lässt ein inaktives Format zu; jeder aktive Typ ist real unterstützt", () => {
    const samples: Record<string, { name: string; type?: string }> = {
      "json-file": { name: "a.json" },
      csv: { name: "a.csv" },
      docx: { name: "a.docx" },
      pdf: { name: "a.pdf" },
      pptx: { name: "a.pptx" },
      ocr: { name: "a.png", type: "image/png" },
    };
    for (const id of CAPTURE_ACTIVE) {
      expect(detectFileKind(samples[id] ?? { name: "x" }), id).not.toBe("unsupported");
    }
    expect(detectFileKind({ name: "a.xlsx" })).toBe("unsupported");
    expect(detectFileKind({ name: "a.mp4", type: "video/mp4" })).toBe("unsupported");
    expect(FILE_IMPORT_ACCEPT).not.toContain(".xlsx");
    expect(FILE_IMPORT_ACCEPT).not.toContain("video/");
    expect(FILE_IMPORT_ACCEPT).not.toContain("audio/");
  });

  it("(f) Verdrahtungs-Pin (nur ergänzend): Capture.tsx rendert die echte CaptureFileImport-Komponente", () => {
    // Reiner Zusatz zum gemounteten Verhaltensbeweis oben — belegt, dass die getestete Komponente auch
    // wirklich in die Seite eingehängt ist (nicht der alleinige Nachweis).
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    expect(src).toContain("<CaptureFileImport onExtractFile={(e) => void onExtractFile(e)} />");
  });
});
