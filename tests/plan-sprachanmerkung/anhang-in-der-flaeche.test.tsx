// @vitest-environment jsdom
// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · NACHARBEIT 2 · D5 — HOCHGELADENE CAD-ZEICHNUNG ODER PDF:
// HOCHLADEN, SEITE WÄHLEN, STELLE ANTIPPEN, SPRECHEN — AUF DER ECHTEN LESEFLÄCHE
// ================================================================================================
//
// Bauform wie `zeichnung-in-der-flaeche.test.tsx` (echte Route `/wissen/:id`). Das Zeichnen der
// Datei selbst (pdfjs, DXF) misst `zeichnungsanhang.test.tsx`; hier steht dafür ein Doppel, das je
// Seite ein eigenes Bild liefert — gemessen wird der Arbeitsweg darüber.
//
// AZ1 PDF-Anhang wählen, auf Seite 2 blättern, Stelle antippen, Notiz sprechen, senden — die Aktion
//     trägt Anhang, Seite, Punkt und den gesprochenen Text
// AZ2 ein Seitenwechsel hebt einen gesetzten Punkt auf (er lag auf der anderen Seite)
// AZ3 DWG: der Grund und der Ausweg stehen da, keine Zeichnung zum Antippen; die Notiz kann
//     trotzdem an die Datei als Ganzes gehen
// AZ4 eine gespeicherte Notiz zeigt Anhang, Seite und die Seite mit der Marke
// AZ5 ist der Anhang nicht mehr da: „Zuordnung prüfen", der Punkt als Satz, keine Zeichnung
// AZ6 „Zeichnung anhängen (PDF, CAD)" lädt die Datei als Dokument hoch und hängt sie an; das
//     Fotofeld bleibt bei `image/*`
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

const box = vi.hoisted(() => ({
  ko: null as unknown,
  aktionen: [] as Record<string, unknown>[],
  hochgeladen: [] as Record<string, unknown>[],
  geladen: [] as { objectId: string; seite: number }[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => box.ko),
        list: vi.fn(async () => [box.ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async (_id: string, body: Record<string, unknown>) => {
          box.aktionen.push(body);
          return box.ko;
        }),
      },
      objects: {
        upload: vi.fn(async (input: Record<string, unknown>) => {
          box.hochgeladen.push(input);
          return { id: "obj-neu", size: 8 };
        }),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: {
        list: vi.fn(async () => [
          { id: "u1", name: "Eva" },
          { id: "u2", name: "Pedi" },
        ]),
      },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

// Das Zeichnen der Datei steht hier als Doppel: drei Seiten, je Seite ein eigenes Bild; DWG nennt
// seinen echten Grund. Alles andere in der Datei (Art, Stelle, Abdruck) bleibt echt.
vi.mock("../../apps/web/src/lib/zeichnungsanhang", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../apps/web/src/lib/zeichnungsanhang")>();
  return {
    ...echt,
    ladeAnhangsZeichnung: async (a: { objectId: string; name: string; mime: string }, s = 1) => {
      box.geladen.push({ objectId: a.objectId, seite: s });
      if (echt.zeichnungsArt(a) === "dwg") {
        throw new echt.ZeichnungNichtDarstellbar("dwg");
      }
      const seite = Math.min(Math.max(1, s), 3);
      return { src: `data:image/png;base64,SEITE${seite}`, seiten: 3, seite, ausgelassen: 0 };
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { stellenFingerabdruck } from "../../apps/web/src/lib/stellenabdruck";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView =
  () => {};

const PDF = {
  id: "a-pdf",
  name: "Flansch-DN80.pdf",
  mime: "application/pdf",
  objectId: "obj-pdf",
  author: "u1",
  at: "2026-08-01T00:00:00.000Z",
};
const DWG = {
  id: "a-dwg",
  name: "Flansch-DN80.dwg",
  mime: "",
  objectId: "obj-dwg",
  author: "u1",
  at: "2026-08-01T00:00:00.000Z",
};

const GESPROCHEN = "Hier wird oft falsch gemessen, der Bezugspunkt muss die linke Kante sein.";

const amPdf = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  koVersion: 5,
  art: "anhang",
  abschnitt: "",
  text: "obj-pdf",
  fingerabdruck: stellenFingerabdruck("anhang", "", "obj-pdf"),
  ...extra,
});

interface Beitrag {
  id: string;
  author: string;
  text: string;
  at: string;
  koVersion?: number;
  stelle?: Record<string, unknown>;
}

function ko(comments: Beitrag[], attachments: unknown[] = [PDF, DWG]): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Flansch DN 80 bohren",
    statement: "Bohrbild nach Zeichnung, Bezug linke Kante.",
    bodyHtml: "<p>Bezugspunkt ist die linke Kante.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Fertigung",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 5,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments,
    sources: [],
    attachments,
  } as unknown as KnowledgeObject;
}

const notizAnSeite2: Beitrag = {
  id: "frage-1",
  author: "u2",
  text: GESPROCHEN,
  at: "2026-08-02T08:00:00.000Z",
  koVersion: 5,
  stelle: amPdf({ seite: 2, punkt: { x: 0.25, y: 0.75 } }),
};

// ---- Das Rekorder-Doppel ------------------------------------------------------------------------

interface ErgebnisEreignis {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: ErgebnisEreignis) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  gestartet = 0;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {
    this.gestartet += 1;
  }
  stop(): void {
    this.onend?.();
  }
  spricht(text: string): void {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
  }
}

type FensterMitSprache = { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };

function spracherkennung(an: boolean): void {
  (window as unknown as FensterMitSprache).SpeechRecognition = an ? RekorderDoppel : undefined;
  (window as unknown as FensterMitSprache).webkitSpeechRecognition = undefined;
}

// ---- Die Fläche ---------------------------------------------------------------------------------

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function abschnittOeffnen(schluessel: string): Promise<void> {
  const d = container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);
  if (!d) {
    throw new Error(`Der Abschnitt „${schluessel}“ ist nicht gemountet`);
  }
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

async function mount(bestand: KnowledgeObject): Promise<void> {
  box.ko = bestand;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("Der Knopf „Mehr“ fehlt auf der Lesefläche");
  }
  await ausloesen(mehr);
  await abschnittOeffnen("kommentare");
}

async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

async function ereignis(ziel: HTMLElement, e: Event): Promise<void> {
  await act(async () => {
    ziel.dispatchEvent(e);
    await flush();
  });
  await act(flush);
}

async function waehlen(auswahl: HTMLSelectElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(auswahl, wert);
    auswahl.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

const el = (marke: string, wert?: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(wert ? `[${marke}="${wert}"]` : `[${marke}]`);

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

const auswahl = (): HTMLSelectElement => el("data-bib-diskussion-stellenwahl") as HTMLSelectElement;

const optionMit = (teil: string): string => {
  const o = Array.from(auswahl().options).find((x) => x.text.includes(teil));
  if (!o) {
    throw new Error(`Keine Option mit „${teil}“`);
  }
  return o.value;
};

const feld = (): HTMLTextAreaElement =>
  container.querySelector<HTMLTextAreaElement>(
    '[data-bib-abschnitt="kommentare"] textarea',
  ) as HTMLTextAreaElement;

/** Die wählbare Zeichnung des Anhangs — gezeichnet auf 400 × 200 ab (100, 50). */
function zeichnung(): HTMLButtonElement {
  const knopf = el("data-bib-zeichnung", "waehlbar") as HTMLButtonElement | null;
  const bild = knopf?.querySelector("img");
  if (!knopf || !bild) {
    throw new Error("Die wählbare Zeichnung fehlt");
  }
  bild.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250 }) as DOMRect;
  return knopf;
}

const tipp = (x: number, y: number): MouseEvent =>
  new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, clientX: x, clientY: y });

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.aktionen = [];
  box.hochgeladen = [];
  box.geladen = [];
  RekorderDoppel.letzter = null;
  spracherkennung(true);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  spracherkennung(false);
});

describe("PLAN-SPRACHANMERKUNG · D5 — hochgeladene Zeichnung auf der Lesefläche", () => {
  it("AZ1 · PDF wählen, auf Seite 2 blättern, antippen, sprechen, senden — Anhang, Seite, Punkt und Text reisen mit", async () => {
    await mount(ko([]));

    await waehlen(auswahl(), optionMit("Flansch-DN80.pdf"));
    expect(el("data-bib-anhangszeichnung-seite", "1/3")).not.toBeNull();
    expect(text(el("data-bib-anhangszeichnung-seite"))).toBe("Seite 1 von 3");

    await ausloesen(el("data-bib-anhangszeichnung-weiter") as HTMLElement);
    expect(el("data-bib-anhangszeichnung-seite", "2/3")).not.toBeNull();
    expect(box.geladen).toContainEqual({ objectId: "obj-pdf", seite: 2 });
    expect(zeichnung().querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,SEITE2",
    );

    await ereignis(zeichnung(), tipp(200, 200));
    expect(el("data-bib-zeichnung-marke", "25,75")).not.toBeNull();

    await ausloesen(el("data-bib-diskussion-sprechen") as HTMLElement);
    await act(async () => {
      RekorderDoppel.letzter?.spricht(GESPROCHEN);
      await flush();
    });
    await ausloesen(el("data-bib-diskussion-sprechen") as HTMLElement);
    expect(feld().value).toBe(GESPROCHEN);

    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    expect(box.aktionen.at(-1)).toEqual({
      action: "comment",
      text: GESPROCHEN,
      clientKey: expect.any(String),
      stelle: amPdf({ seite: 2, punkt: { x: 0.25, y: 0.75 } }),
    });
  });

  it("AZ2 · ein Seitenwechsel hebt den gesetzten Punkt auf", async () => {
    await mount(ko([]));
    await waehlen(auswahl(), optionMit("Flansch-DN80.pdf"));
    await ereignis(zeichnung(), tipp(300, 100));
    expect(el("data-bib-zeichnung-marke", "50,25")).not.toBeNull();

    await ausloesen(el("data-bib-anhangszeichnung-weiter") as HTMLElement);

    expect(el("data-bib-anhangszeichnung-seite", "2/3")).not.toBeNull();
    expect(el("data-bib-zeichnung-marke")).toBeNull();
    expect(el("data-bib-diskussion-punkt")).toBeNull();
    // Auf der letzten Seite ist „weiter" gesperrt.
    await ausloesen(el("data-bib-anhangszeichnung-weiter") as HTMLElement);
    expect((el("data-bib-anhangszeichnung-weiter") as HTMLButtonElement).disabled).toBe(true);
  });

  it("AZ3 · DWG: Grund und Ausweg statt Zeichnung; die Notiz kann an die Datei als Ganzes gehen", async () => {
    await mount(ko([]));
    await waehlen(auswahl(), optionMit("Flansch-DN80.dwg"));

    expect(text(el("data-bib-anhangszeichnung-fehler", "dwg"))).toBe(
      "DWG-Dateien kann KLARWERK nicht darstellen. Bitte die Zeichnung als PDF oder DXF exportieren und diese Datei anhängen.",
    );
    expect(el("data-bib-zeichnung")).toBeNull();

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(feld(), "Welche Revision ist das?");
      feld().dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    expect(box.aktionen.at(-1)?.stelle).toEqual({
      koVersion: 5,
      art: "anhang",
      abschnitt: "",
      text: "obj-dwg",
      fingerabdruck: stellenFingerabdruck("anhang", "", "obj-dwg"),
    });
  });

  it("AZ4 · eine gespeicherte Notiz zeigt Anhang, Seite und die Seite mit der Marke", async () => {
    await mount(ko([notizAnSeite2]));

    const bezug = el("data-bib-diskussion-stelle", "frage-1");
    expect(text(bezug)).toContain("Zeichnung (Anhang) · Seite 2 · Fassung v5");
    expect(text(el("data-bib-diskussion-stelle-zitat", "frage-1"))).toBe("Flansch-DN80.pdf");
    expect(el("data-bib-diskussion-stelle-lage", "dieseFassung")).not.toBeNull();
    const punkt = el("data-bib-diskussion-stelle-punkt", "frage-1");
    expect(text(punkt)).toContain("Punkt in der Zeichnung: 25 % von links, 75 % von oben");
    expect(punkt?.querySelector('[data-bib-zeichnung-marke="25,75"]')).not.toBeNull();
    expect(punkt?.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,SEITE2");
    expect(box.geladen).toContainEqual({ objectId: "obj-pdf", seite: 2 });
  });

  it("AZ5 · ist der Anhang nicht mehr da: Zuordnung prüfen, Punkt als Satz, keine Zeichnung", async () => {
    await mount(ko([notizAnSeite2], [DWG]));

    expect(el("data-bib-diskussion-stelle-lage", "unklar")).not.toBeNull();
    const punkt = el("data-bib-diskussion-stelle-punkt", "frage-1");
    expect(text(punkt)).toBe("Punkt in der Zeichnung: 25 % von links, 75 % von oben");
    expect(punkt?.querySelector("[data-bib-zeichnung]")).toBeNull();
    expect(box.geladen).not.toContainEqual({ objectId: "obj-pdf", seite: 2 });
  });

  it("AZ6 · „Zeichnung anhängen (PDF, CAD)“ lädt als Dokument hoch und hängt an; das Fotofeld bleibt", async () => {
    await mount(ko([]));
    await abschnittOeffnen("anhaenge");

    const bereich = el("data-bib-abschnitt", "anhaenge") as HTMLElement;
    expect(bereich.querySelector('input[type="file"]')?.getAttribute("accept")).toBe("image/*");
    expect(text(el("data-bib-zeichnung-anhaengen"))).toBe("Zeichnung anhängen (PDF, CAD)");
    const datei = el("data-bib-zeichnung-datei") as HTMLInputElement;
    for (const art of [".pdf", ".dxf", ".dwg"]) {
      expect(datei.getAttribute("accept")).toContain(art);
    }

    const plan = new File(["%PDF-1.4"], "Plan.pdf", { type: "application/pdf" });
    Object.defineProperty(datei, "files", { value: [plan], configurable: true });
    await ereignis(datei, new Event("change", { bubbles: true }));

    expect(box.hochgeladen.at(-1)).toMatchObject({
      name: "Plan.pdf",
      mime: "application/pdf",
      kind: "document",
      purpose: "attachment",
    });
    expect(String(box.hochgeladen.at(-1)?.data)).toMatch(/^data:application\/pdf;base64,/);
    expect(box.aktionen.at(-1)).toEqual({
      action: "attach",
      attachment: { name: "Plan.pdf", mime: "application/pdf", objectId: "obj-neu", size: 8 },
    });
  });
});
