// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BIBLIOTHEK-LÖSCHEN — LÖSCHEN DIREKT AUS DER TREFFERLISTE (R-0959).
// ================================================================================================
//
// „Berechtigte können einen Beitrag direkt aus der Trefferliste löschen; vorher fragt eine ruhige
// Zeile nach." Dazu aus dem Planungspaket `bibliothek`: „Zwei Löschungen hintereinander
// funktionieren" und „Löschsymbol und Ablauf entsprechen den Entwürfen".
//
// GEMESSEN WIRD AN DER ECHTEN FLÄCHE `/bibliothek` (`BibliothekFlaeche` → `BibliothekListe`), mit
// einem ECHT veränderlichen Serverbestand: `ko.remove` nimmt den Eintrag wirklich aus der Liste,
// `ko.get` antwortet danach mit 404. Dieselbe Bühne wie `tests/wissensobjekt-loeschen/
// zweites-loeschen-mounted.test.tsx`, nur dass hier der Treffer selbst der Bedienort ist und nicht
// das „…"-Menü des gelesenen Eintrags.
//
// WAS DIESE DATEI NICHT BELEGT: das Aussehen im echten Browser (Pixel, Farben) und eine Bedienung
// durch einen Menschen. Die Warnfarbe des bestätigenden Knopfs hält `tests/app/
// destructive-button-colour.test.ts` an der Knopf-Variante fest; die Rechte setzt der Server durch
// (`DELETE /api/kos/:id`), was hier nicht nachgestellt wird.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  bestand: [] as { id: string; titel: string; autor: string }[],
  entfernt: [] as string[],
  // Antwortet der Server für diese Kennung mit einem Fehler statt zu löschen?
  fehler: new Map<string, number>(),
  // Der Grund, den der Server bei einem echten Fehlschlag mitgibt — er muss am Bedienort stehen.
  fehlersatz: "Keine Berechtigung für diesen Eintrag.",
  nutzer: { id: "u1", name: "Eva", email: "e@x.de", role: "admin" },
  ort: "",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => box.nutzer),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async (id: string) => {
          const treffer = globalThis.__r0959Bestand().find((k) => k.id === id);
          if (!treffer) {
            throw new ApiError(404, "not_found", "Eintrag nicht gefunden");
          }
          return treffer;
        }),
        list: vi.fn(async () => globalThis.__r0959Bestand()),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({ center: "", neighbors: [], excludedTags: [], limit: 8 })),
        act: vi.fn(async () => globalThis.__r0959Bestand()[0]),
        remove: vi.fn(async (id: string) => {
          const status = box.fehler.get(id);
          if (status === 404) {
            box.bestand = box.bestand.filter((k) => k.id !== id);
            throw new ApiError(404, "not_found", "Eintrag nicht gefunden");
          }
          if (status !== undefined) {
            throw new ApiError(status, "forbidden", box.fehlersatz);
          }
          box.entfernt.push(id);
          box.bestand = box.bestand.filter((k) => k.id !== id);
          return undefined;
        }),
      },
      library: {
        search: vi.fn(async () => globalThis.__r0959Bestand()),
        images: vi.fn(async () => ({ items: [] })),
        importCandidates: { list: leer },
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => null),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useRef } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __r0959Bestand: () => KnowledgeObject[];
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function ko(id: string, titel: string, autor: string): KnowledgeObject {
  return {
    id,
    title: titel,
    statement: `Kernaussage von ${titel}.`,
    bodyHtml: `<p>Fliesstext von ${titel}.</p>`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Kaufmännisch",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "offen",
    version: 1,
    author: autor,
    originalAuthor: autor,
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
  } as KnowledgeObject;
}

globalThis.__r0959Bestand = () =>
  box.bestand.map((k) => ko(k.id, k.titel, k.autor)) as unknown as KnowledgeObject[];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement("main", { key: "main", ref: mainRef, className: "overflow-y-auto" }, children),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

/** Schreibt die aktuelle Adresse mit — daran wird gemessen, ob eine tote Kennung stehen bleibt. */
function Ort(): null {
  const ort = useLocation();
  box.ort = `${ort.pathname}${ort.search}`;
  return null;
}

async function mount(start = "/bibliothek"): Promise<void> {
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
                  { initialEntries: [start] },
                  createElement(Ort),
                  createElement(
                    Huelle,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/bibliothek",
                        element: createElement(BibliothekFlaeche),
                      }),
                    ),
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
}

const SEL_ZEILE = '[data-testid="bib-zeile"]';
const SEL_BLOCK = '[data-testid="bib-zeilenblock"]';
const SEL_KORB = '[data-testid="bib-zeile-loeschen"]';
const SEL_FRAGE = '[data-testid="bib-zeile-loeschen-rueckfrage"]';
const SEL_FEHLER = '[data-testid="bib-zeile-loeschen-fehler"]';

function block(id: string): HTMLElement | undefined {
  const bloecke = [...document.body.querySelectorAll<HTMLElement>(SEL_BLOCK)];
  return bloecke.find((b) => b.dataset.bibId === id);
}

function papierkorb(id: string): HTMLButtonElement | null {
  return block(id)?.querySelector<HTMLButtonElement>(SEL_KORB) ?? null;
}

function rueckfrage(id: string): HTMLElement | null {
  return block(id)?.querySelector<HTMLElement>(SEL_FRAGE) ?? null;
}

function knopfIn(el: HTMLElement, text: string): HTMLButtonElement {
  const k = [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
  if (!k) {
    throw new Error(`Knopf „${text}" fehlt`);
  }
  return k;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

function zeilenIds(): string[] {
  const zeilen = [...document.body.querySelectorAll<HTMLElement>(SEL_ZEILE)];
  return zeilen.map((z) => z.dataset.bibId ?? "");
}

/** Der volle Bedienweg EINES Löschens am Treffer: Papierkorb → ruhige Zeile → „Ja, löschen". */
async function loeschenAmTreffer(id: string): Promise<void> {
  const korb = papierkorb(id);
  if (!korb) {
    throw new Error(`am Treffer ${id} steht kein Papierkorb`);
  }
  await klick(korb);
  const zeile = rueckfrage(id);
  if (!zeile) {
    throw new Error(`am Treffer ${id} erscheint keine Rückfrage`);
  }
  await klick(knopfIn(zeile, i18n.t("ko.deleteYes")));
}

async function aufbauen(
  bestand: { id: string; titel: string; autor: string }[],
  nutzer: { id: string; role: string },
  start?: string,
): Promise<void> {
  box.bestand = bestand;
  box.entfernt = [];
  box.fehler = new Map();
  box.nutzer = { ...box.nutzer, ...nutzer };
  await mount(start);
}

const ZWEI = [
  { id: "ko-1", titel: "Erster Bericht", autor: "u1" },
  { id: "ko-2", titel: "Zweiter Bericht", autor: "u1" },
];
const DREI = [...ZWEI, { id: "ko-3", titel: "Dritter Bericht", autor: "u1" }];
const ADMIN = { id: "u1", role: "admin" };

beforeEach(async () => {
  vi.mocked(endpoints.ko.remove).mockClear();
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("R-0959 · Löschen direkt aus der Trefferliste, vorher eine ruhige Zeile", () => {
  it("L1 · Papierkorb am Treffer öffnet eine ruhige Zeile UNTER genau diesem Treffer — kein Dialog, noch nichts gelöscht", async () => {
    await aufbauen(ZWEI, { id: "u1", role: "admin" });
    expect(zeilenIds()).toEqual(["ko-1", "ko-2"]);
    const korb = papierkorb("ko-2");
    expect(korb, "kein Papierkorb am Treffer").not.toBeNull();
    // Der Symbolknopf nennt den Beitrag, um den es geht.
    expect(korb?.getAttribute("aria-label")).toBe("„Zweiter Bericht“ löschen");
    expect(korb?.getAttribute("aria-expanded")).toBe("false");

    await klick(korb as HTMLButtonElement);

    const zeile = rueckfrage("ko-2");
    expect(zeile, "keine Rückfrage am Treffer").not.toBeNull();
    expect(zeile?.textContent).toContain(i18n.t("ko.deleteQ"));
    // Ruhig heisst: im Block des Treffers, nicht als Overlay. Die Dialogfläche der Lesefläche
    // (`data-bib-loeschen`) bleibt zu, und am anderen Treffer steht keine Rückfrage.
    expect(document.body.querySelector("[data-bib-loeschen]")).toBeNull();
    expect(rueckfrage("ko-1")).toBeNull();
    expect(papierkorb("ko-2")?.getAttribute("aria-expanded")).toBe("true");
    // Fokus auf dem BEWAHRENDEN Knopf: ein versehentliches Enter löscht nichts.
    expect(document.activeElement?.textContent?.trim()).toBe(i18n.t("ko.deleteKeep"));
    expect(endpoints.ko.remove).not.toHaveBeenCalled();
    // Die Auswahl rechts hat der Papierkorb nicht gewechselt: keine Wahl in der Adresse.
    expect(box.ort).not.toContain("eintrag=");
  });

  it("L2 · „Behalten“ schliesst die Zeile, löscht nichts und gibt den Fokus an den Papierkorb zurück", async () => {
    await aufbauen(ZWEI, { id: "u1", role: "admin" });
    await klick(papierkorb("ko-1") as HTMLButtonElement);
    await klick(knopfIn(rueckfrage("ko-1") as HTMLElement, i18n.t("ko.deleteKeep")));

    expect(rueckfrage("ko-1")).toBeNull();
    expect(endpoints.ko.remove).not.toHaveBeenCalled();
    expect(zeilenIds()).toEqual(["ko-1", "ko-2"]);
    expect(document.activeElement).toBe(papierkorb("ko-1"));
  });

  it("L3 · zwei Löschungen hintereinander aus der Trefferliste tragen beide — ohne Rest der ersten", async () => {
    await aufbauen(DREI, ADMIN);

    await loeschenAmTreffer("ko-1");
    expect(box.entfernt).toEqual(["ko-1"]);
    expect(zeilenIds()).toEqual(["ko-2", "ko-3"]);
    expect(document.body.textContent).toContain(i18n.t("ko.deleteDone"));
    // Kein Rest der ersten Rückfrage am nächsten Treffer.
    expect(document.body.querySelector(SEL_FRAGE)).toBeNull();

    await loeschenAmTreffer("ko-2");
    expect(box.entfernt).toEqual(["ko-1", "ko-2"]);
    expect(vi.mocked(endpoints.ko.remove).mock.calls).toEqual([["ko-1"], ["ko-2"]]);
    expect(zeilenIds()).toEqual(["ko-3"]);
    // Die Lesefläche rechts rückt auf den verbliebenen Eintrag, statt einen toten zu zeigen.
    const lesen = document.body.querySelector('[data-testid="bib-lesen"]');
    expect(lesen?.textContent).toContain("Dritter Bericht");
  });

  it("L4 · nur Berechtigte sehen den Papierkorb: als Expertin nur am eigenen Beitrag", async () => {
    await aufbauen(
      [
        { id: "ko-1", titel: "Fremder Bericht", autor: "u1" },
        { id: "ko-2", titel: "Eigener Bericht", autor: "u2" },
      ],
      { id: "u2", role: "experte" },
    );
    expect(zeilenIds()).toEqual(["ko-1", "ko-2"]);
    expect(papierkorb("ko-1")).toBeNull();
    expect(papierkorb("ko-2")).not.toBeNull();
  });

  it("L5 · als Leserin steht an keinem Treffer ein Papierkorb", async () => {
    await aufbauen(ZWEI, { id: "u3", role: "viewer" });
    expect(zeilenIds()).toEqual(["ko-1", "ko-2"]);
    expect(document.body.querySelectorAll(SEL_KORB).length).toBe(0);
  });

  it("L6 · ein echter Fehlschlag (403) bleibt in der ruhigen Zeile stehen; der Treffer bleibt", async () => {
    await aufbauen(ZWEI, { id: "u1", role: "admin" });
    box.fehler.set("ko-1", 403);
    await loeschenAmTreffer("ko-1");

    const zeile = rueckfrage("ko-1");
    expect(zeile, "die Rückfrage ist beim Fehlschlag verschwunden").not.toBeNull();
    expect(zeile?.querySelector(SEL_FEHLER)?.textContent).toBe(box.fehlersatz);
    expect(zeilenIds()).toEqual(["ko-1", "ko-2"]);
    expect(document.body.textContent).not.toContain(i18n.t("ko.deleteDone"));
  });

  it("L7 · schon gelöscht (404) ist kein Fehlschlag: Zeile zu, ehrlicher Satz, Liste frisch", async () => {
    await aufbauen(ZWEI, { id: "u1", role: "admin" });
    box.fehler.set("ko-2", 404);
    await loeschenAmTreffer("ko-2");

    expect(rueckfrage("ko-2")).toBeNull();
    expect(document.body.querySelector(SEL_FEHLER)).toBeNull();
    expect(document.body.textContent).toContain(i18n.t("ko.deleteAlreadyGone"));
    expect(zeilenIds()).toEqual(["ko-1"]);
  });

  it("L8 · ist der gelöschte Treffer auch der gelesene, verlässt seine Kennung die Adresse", async () => {
    await aufbauen(ZWEI, { id: "u1", role: "admin" }, "/bibliothek?eintrag=ko-2");
    expect(box.ort).toContain("eintrag=ko-2");
    await loeschenAmTreffer("ko-2");

    expect(box.entfernt).toEqual(["ko-2"]);
    expect(box.ort).not.toContain("eintrag=");
    expect(document.body.textContent).not.toContain(i18n.t("lib.lesen.fehler"));
  });
});
