// @vitest-environment jsdom
// ================================================================================================
// JOB 512 (R5) — DIE GANZE KETTE: Importer → Entwurfsnutzlast → geladener Entwurf → SICHTBARE MELDUNG.
// ================================================================================================
//
// BENs Auflage (D4-Urteil): „Ein gemounteter Vertrag muss einen Verlust vor `bodyHtml`-Erzeugung vom
// Import bis zur sichtbaren Meldung rot-first/grün prüfen sowie Gleichstand, unbekannte Quellzahl und
// bildlose Quelle als Negativfälle absichern."
//
// DER BEFUND, DER DIE KETTE LÄNGER MACHT, ALS SIE AUSSAH: Der Ganzdokument-Import setzt `bodyHtml`
// NICHT im Editor. Er legt einen Entwurf serverseitig an (Capture.tsx:955-1027), räumt danach den
// gesamten Dateizustand — `setFileImageInfo(null)`, Capture.tsx:1045 — und verlinkt auf die
// VORDERTÜR (`?draft=<id>`, Capture.tsx:4322). Die Entwurfsgalerie rendert also an einem GELADENEN
// Entwurf, nie am flüchtigen Importzustand. Die Quellbildzahl muss deshalb in der ENTWURFSNUTZLAST
// reisen; eine Übergabe aus `fileImageInfo` wäre auf diesem Weg toter Code (zum Renderzeitpunkt
// immer `null`).
//
// Die Kette wird in DREI Gliedern gemessen, jedes mit ECHTEM Produktcode:
//   1. Erhebung   — `extractPptxRich` auf echten Folien-Bytes: 3 Quellbilder, 0 im Body.
//   2. Transport  — `wholeDocumentDraftPayload` trägt die Zahl in die Ladung, die gespeichert wird.
//   3. Anzeige    — die GEMOUNTETE Vordertür lädt genau so eine Ladung und zeigt die Meldung.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Die Galerie-Kachel führt zum Bildbeschreibungs-Formular und verlangt dafür `useImageDescribe`.
// Der ECHTE Provider fragt dazu die KI-Verfügbarkeit über `endpoints` ab, die dieser Test bewusst
// schmal hält — ohne diese Naht liefe ein Teil des Baums über einen Fehlerpfad, und ein Test, der
// durch einen Fehler hindurch grün wird, belegt nichts. Dieselbe Naht benutzt bereits
// tests/capture/draft-save-fullstate-mounted.test.tsx.
vi.mock("../../apps/web/src/app/ImageDescribeContext", () => ({
  ImageDescribeProvider: ({ children }: { children?: unknown }) => children as JSX.Element,
  ImageDescribeValueProvider: ({ children }: { children?: unknown }) => children as JSX.Element,
  useImageDescribe: () => ({
    available: false,
    billable: false,
    describe: async () => ({ text: null, demo: true }),
  }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      get: vi.fn(),
      create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
      update: vi.fn(async () => ({})),
      promote: vi.fn(async () => ({})),
    },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import { frontDoorBodyFromDraft } from "../../apps/web/src/lib/captureFrontDoor";
import { type PptxUnzip, extractPptxRich } from "../../apps/web/src/lib/pptx";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getMock = endpoints.drafts.get as unknown as ReturnType<typeof vi.fn>;

// ------------------------------------------------------------------------------------------------
// Glied 1: ECHTE PPTX-Auswertung. Kein Mock des Importers — nur die Zip-Naht, die auch die
// bestehenden Budget-Tests benutzen (tests/capture/wp-d9b-image-budget.test.ts).
// ------------------------------------------------------------------------------------------------
const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function noiseBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  let s = 0x9e3779b9;
  for (let i = 0; i < length; i += 1) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s |= 0;
    out[i] = s & 0xff;
  }
  return out;
}

function unzipOf(files: Record<string, Uint8Array>): PptxUnzip {
  return () => files;
}

function pictureSlide(rid: string, text: string): string {
  const sp = `<p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const pic = `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`;
  return `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${sp}${pic}</p:spTree></p:cSld></p:sld>`;
}

function slideRels(rid: string, target: string): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`;
}

/** Ein Deck mit DREI Bildern, deren Base64 zusammen NICHT ins Bodybudget passt. */
async function deckMitDreiBildernOhnePlatz() {
  const files: Record<string, Uint8Array> = {};
  for (let i = 1; i <= 3; i += 1) {
    files[`ppt/slides/slide${i}.xml`] = enc(pictureSlide(`rId${i + 1}`, `Folie ${i}`));
    files[`ppt/slides/_rels/slide${i}.xml.rels`] = enc(
      slideRels(`rId${i + 1}`, `../media/b${i}.png`),
    );
    files[`ppt/media/b${i}.png`] = noiseBytes(60_000);
  }
  return extractPptxRich(new ArrayBuffer(0), {
    unzip: unzipOf(files),
    imageCaptionPlaceholder: "Noch keine Bildbeschreibung",
    imageRunToken: "job512",
    budgetBytes: 2_000, // Platz für den Text, für KEIN einziges Base64-Bild
  });
}

// ------------------------------------------------------------------------------------------------
// Glied 3: die GEMOUNTETE Vordertür — der echte Renderort der Entwurfsgalerie.
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(url: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [url] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  // Glied 1 und 2 mounten nichts — ohne diese Wache scheitert ihr Abbau statt ihrer Sache, und der
  // rote Lauf zeigte etwas anderes an, als er behauptet.
  if (root) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
  root = undefined as unknown as ReturnType<typeof createRoot>;
  vi.clearAllMocks();
});

/**
 * Wartet den Entwurfsabruf UND die Debounce-Pause der Galerie ab — in DIESER Reihenfolge und
 * getrennt. Beides in eine Wartezeit zu legen war ein Fehler: die Debounce-Pause beginnt erst,
 * wenn der Abruf den Body gesetzt hat. Eine gemeinsame Frist von 350 ms lief deshalb ab, BEVOR die
 * 300 ms der Pause voll waren — der R5-Fall wurde falsch rot und der Gleichstandsfall falsch grün.
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, LIBRARY_SEARCH_DEBOUNCE_MS + 100));
  });
}

function meldung(): HTMLElement | null {
  return container.querySelector<HTMLElement>("[data-testid=draft-gallery-loss]");
}

async function vordertuerMitEntwurf(payload: Record<string, unknown>): Promise<void> {
  getMock.mockResolvedValue({ id: "d-512", payload });
  mount("/capture/frontdoor?draft=d-512");
  await settle();
}

describe("JOB 512 R5 · Glied 1 — der Verlust entsteht VOR der bodyHtml-Erzeugung", () => {
  it("echte PPTX-Auswertung: 3 Quellbilder, 0 Bilder im erzeugten Body", async () => {
    const res = await deckMitDreiBildernOhnePlatz();
    // Die Quellzahl zählt ALLE erkannten `a:blip` — erhoben VOR jedem Budgetabzug (pptx.ts:565/1103).
    expect(res.imageCount).toBe(3);
    // Im erzeugten Body kommt keines an: genau der Verlust, den JOB 512 sichtbar machen soll.
    expect(res.embeddedImages).toBe(0);
    expect(extractBodyImages(res.html)).toHaveLength(0);
    // Der Text überlebt vollständig — es ist ein Bildverlust, kein Importfehler.
    expect(res.html).toContain("Folie 1");
  });
});

describe("JOB 512 R5 · Glied 2 — die Zahl reist in der Entwurfsnutzlast", () => {
  it("wholeDocumentDraftPayload trägt die Quellbildzahl in die gespeicherte Ladung", async () => {
    const res = await deckMitDreiBildernOhnePlatz();
    const payload = wholeDocumentDraftPayload({
      fileName: "deck.pptx",
      text: res.text,
      html: res.html,
      sourceKind: "pptx",
      sourceImageCount: res.imageCount,
    });
    expect(payload.sourceImageCount).toBe(3);
  });

  it("KALIBRIERUNG: ohne übergebene Quellzahl trägt die Ladung KEINE erfundene Zahl", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "deck.pptx",
      text: "Text",
      html: "<p>Text</p>",
      sourceKind: "pptx",
    });
    expect(payload.sourceImageCount).toBeUndefined();
  });
});

describe("JOB 512 R5 · Glied 3 — die sichtbare Meldung am geladenen Entwurf", () => {
  it("DER FALL VON JOB 512: 3 Quellbilder, 0 im Entwurf → die Meldung steht sichtbar da", async () => {
    const res = await deckMitDreiBildernOhnePlatz();
    const payload = wholeDocumentDraftPayload({
      fileName: "deck.pptx",
      text: res.text,
      html: res.html,
      sourceKind: "pptx",
      sourceImageCount: res.imageCount,
    });
    await vordertuerMitEntwurf(payload as unknown as Record<string, unknown>);

    const el = meldung();
    expect(el).not.toBeNull();
    // Die Meldung nennt BEIDE Zahlen — was fehlt und woraus.
    expect(el?.textContent).toBe(i18n.t("ko.galleryLoss", { n: 3, m: 3 }));
    expect(el?.textContent).toContain("3");
  });

  it("NEGATIV — Gleichstand: alle Quellbilder sind im Entwurf → keine Meldung", async () => {
    const figure = (id: string): string =>
      `<figure><img data-image-id="${id}" src="data:image/png;base64,QQ=="><figcaption data-image-id="${id}">B</figcaption></figure>`;
    const bodyHtml = `<p>Text</p>${figure("kw-img-a-1")}${figure("kw-img-a-2")}`;
    // KALIBRIERUNG durch die ECHTE Ladeumformung: Die Vordertür rendert nicht den Rohbody, sondern
    // `frontDoorBodyFromDraft` (verankert nackte <img> nach). Gezählt werden muss, was danach da
    // ist — sonst prüfte der Fall eine Zahl, die im Produkt nie entsteht.
    expect(extractBodyImages(frontDoorBodyFromDraft({ bodyHtml }))).toHaveLength(2);
    await vordertuerMitEntwurf({ title: "T", bodyHtml, sourceImageCount: 2 });
    // WACHPOSTEN gegen ein Grün aus dem falschen Grund: Die Galerie muss ihre zwei Kacheln WIRKLICH
    // rendern. Ohne diese Zusicherung wäre „keine Meldung" auch dann erfüllt, wenn die Debounce-
    // Pause noch lief und die Komponente deshalb ohnehin nichts vergleicht — genau dieser Fehlpass
    // ist in diesem Durchgang einmal aufgetreten.
    expect(container.querySelectorAll("button img")).toHaveLength(2);
    expect(meldung()).toBeNull();
  });

  it("NEGATIV — unbekannte Quellzahl: der Entwurf trägt keine → keine Meldung, keine Behauptung", async () => {
    // Ein Entwurf, der nie aus einem Dateiimport kam (getippt, Klara, Altbestand). Aus dem Fehlen
    // von Bildern auf einen Verlust zu schließen wäre eine Falschmeldung.
    await vordertuerMitEntwurf({ title: "T", bodyHtml: "<p>Nur Text</p>" });
    expect(meldung()).toBeNull();
  });

  it("NEGATIV — bildlose Quelle: 0 Quellbilder, 0 im Entwurf → keine Meldung", async () => {
    await vordertuerMitEntwurf({ title: "T", bodyHtml: "<p>Nur Text</p>", sourceImageCount: 0 });
    expect(meldung()).toBeNull();
  });

  it("NEGATIV — unbrauchbare Quellzahl aus einer Altladung wird wie unbekannt behandelt", async () => {
    // Ein Altentwurf mit kaputtem Feld darf keine Meldung erzeugen — fail-closed bis in die Anzeige.
    await vordertuerMitEntwurf({
      title: "T",
      bodyHtml: "<p>Nur Text</p>",
      sourceImageCount: -1,
    });
    expect(meldung()).toBeNull();
  });
});
