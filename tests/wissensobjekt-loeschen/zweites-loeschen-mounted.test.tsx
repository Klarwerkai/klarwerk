// @vitest-environment jsdom
// ================================================================================================
// JOB 3637 · NACHTRAG 15:15 — „ERSTEN BERICHT LÖSCHEN GEHT, ZWEITEN DIREKT DANACH NICHT."
// ================================================================================================
//
// Pedis zweiter, schärferer Befund. Der Verdacht im Nachtrag: ein Zustand, der nach dem ersten
// Löschen nicht zurückgeht — `removeKo.isPending` bliebe hängen und der zweite Bestätigungsknopf
// wäre dauerhaft gesperrt („der Knopf ist da, tut aber nichts").
//
// GEMESSEN WIRD DESHALB DIE GANZE KETTE, ZWEIMAL HINTEREINANDER, AN DER ECHTEN FLÄCHE
// `/bibliothek` (`BibliothekFlaeche` → `BibliothekLesen`) — der Fläche, auf der man NACH dem
// Löschen stehen bleibt und sofort das nächste Objekt vor sich hat. Auf `/wissen/:id` gibt es den
// Fall baulich nicht: dort führt `beiLoeschung` zur Bibliothek, das zweite Löschen beginnt also
// ohnehin mit einer frisch gebauten Fläche (`pages/KnowledgeDetail.tsx:67-69`).
//
// Der Serverbestand ist hier ECHT veränderlich: `ko.remove` nimmt den Eintrag wirklich aus der
// Liste, `ko.get` antwortet danach mit 404. Ein Prüfstand, dessen Liste nach dem Löschen unverändert
// bleibt, könnte genau den Fall nicht zeigen, um den es geht.
//
// ================================================================================================
// DAS ERGEBNIS, EHRLICH: DER VERMUTETE ZUSTANDSFEHLER IST NICHT DA.
// ================================================================================================
// Beide Fälle laufen GRÜN — und zwar auch gegen den Stand VOR der Reparatur (Basisstand 098f88b,
// eigener Lauf: `2 passed`). Der Verdacht aus dem Nachtrag ist damit gemessen widerlegt, nicht
// weggeredet: `removeKo.isPending` hängt nicht, es bleibt kein Rest der Rückfrage stehen, und der
// Menüpunkt erscheint am zweiten Objekt genauso wie am ersten. Der bauliche Grund steht in
// `BibliothekFlaeche.tsx:1870`: `BibliothekLesen` trägt `key={gewaehltEffektiv}` und wird beim
// Wechsel auf den nächsten Eintrag NEU GEBAUT — es gibt keinen Zustand, der überleben könnte.
//
// WAS DIESE DATEI DESHALB IST: ein Wächter, kein Reparaturbeleg. Sie hält fest, dass der zweite
// Bedienweg vollständig trägt, und sie fiele, sobald jemand den Neubau über `key` entfernt oder
// einen Zustand einführt, der das erste Löschen überlebt.
//
// WAS PEDI DANN GESEHEN HAT — benannt, nicht behauptet: dieselbe Ursache wie im Hauptbefund. Die
// Rückfrage stand ausserhalb des Blicks (gemessen in `rueckfrage-im-blick-mounted.test.tsx`). Beim
// zweiten Eintrag steht die Fläche wieder oben, die Rückfrage wieder unten — also wieder „tut
// nichts". Dass es GENAU dieser Ablauf war, ist hier NICHT gemessen; gemessen ist nur, dass es
// kein Zustandsrest ist.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  bestand: [] as { id: string; titel: string }[],
  entfernt: [] as string[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
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
          const treffer = globalThis.__job3637Bestand().find((k) => k.id === id);
          if (!treffer) {
            throw new ApiError(404, "not_found", "Eintrag nicht gefunden");
          }
          return treffer;
        }),
        list: vi.fn(async () => globalThis.__job3637Bestand()),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({ center: "", neighbors: [], excludedTags: [], limit: 8 })),
        act: vi.fn(async () => globalThis.__job3637Bestand()[0]),
        remove: vi.fn(async (id: string) => {
          box.entfernt.push(id);
          box.bestand = box.bestand.filter((k) => k.id !== id);
          return undefined;
        }),
      },
      // Die LISTE der Bibliothek kommt aus `GET /api/library/search`, nicht aus `ko.list`
      // (`BibliothekFlaeche.tsx:430`). Sie liest denselben veränderlichen Bestand — sonst zeigte
      // die Liste nach dem ersten Löschen weiter beide Einträge und der Fall wäre nachgestellt
      // statt gemessen.
      library: {
        search: vi.fn(async () => globalThis.__job3637Bestand()),
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
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
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
  var __job3637Bestand: () => KnowledgeObject[];
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function ko(id: string, titel: string): KnowledgeObject {
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
    author: "u1",
    originalAuthor: "u1",
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

globalThis.__job3637Bestand = () =>
  box.bestand.map((k) => ko(k.id, k.titel)) as unknown as KnowledgeObject[];

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

async function mount(): Promise<void> {
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
                  { initialEntries: ["/bibliothek"] },
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

function suche(testId: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

function knopf(testId: string): HTMLElement {
  const treffer = suche(testId);
  if (!treffer) {
    throw new Error(`„${testId}" ist auf der Fläche nicht da`);
  }
  return treffer;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

/** Welcher Bericht steht gerade auf der Fläche? */
function berichtTitel(): string {
  return suche("bib-lesen")?.querySelector("h1,h2")?.textContent?.trim() ?? "";
}

/**
 * Der volle Bedienweg EINES Löschens: Menü „…" → „Wissensobjekt löschen" → „Ja, löschen".
 * Gibt zurück, was auf dem Weg messbar war — daran hängt der ganze Nachtrag.
 */
async function loeschen(): Promise<{
  menuepunktDa: boolean;
  rueckfrageDa: boolean;
  jaGesperrt: boolean | null;
}> {
  await klick(knopf("bib-eintrag-menue"));
  const punkt = suche("bib-menue-loeschen");
  if (!punkt) {
    return { menuepunktDa: false, rueckfrageDa: false, jaGesperrt: null };
  }
  await klick(punkt);
  // Über den TEXT gesucht, nicht über die Testmarke: so misst dieser Helfer den Bedienweg auch am
  // Stand VOR der Reparatur (der trug keine Marke) — nur dann ist die Antwort auf den Nachtrag
  // („war das ZWEITE Löschen je kaputt?") eine Messung und keine Vermutung.
  const frage = i18n.t("ko.deleteQ");
  const rueckfrage =
    [...document.body.querySelectorAll<HTMLElement>("*")].find(
      (el) => el.textContent?.trim() === frage,
    ) ?? null;
  const ja = knopfMitText(i18n.t("ko.deleteYes"));
  const jaGesperrt = ja ? ja.disabled : null;
  if (ja) {
    await klick(ja);
  }
  return { menuepunktDa: true, rueckfrageDa: rueckfrage !== null, jaGesperrt };
}

beforeEach(async () => {
  box.bestand = [
    { id: "ko-1", titel: "Erster Bericht" },
    { id: "ko-2", titel: "Zweiter Bericht" },
  ];
  box.entfernt = [];
  vi.mocked(endpoints.ko.remove).mockClear();
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  await mount();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  qc.clear();
});

describe("JOB 3637 · Nachtrag — das ZWEITE Löschen direkt nach dem ersten", () => {
  it("Z1 · zwei Löschungen hintereinander tragen beide, mit vollem Bedienweg", async () => {
    expect(berichtTitel()).toBe("Erster Bericht");

    const erstes = await loeschen();
    expect(erstes).toEqual({ menuepunktDa: true, rueckfrageDa: true, jaGesperrt: false });
    expect(box.entfernt).toEqual(["ko-1"]);
    // Die Fläche bleibt stehen und rückt auf den nächsten Eintrag — das ist die Lage, in der Pedi
    // den zweiten Klick macht.
    expect(berichtTitel()).toBe("Zweiter Bericht");

    const zweites = await loeschen();
    // DER KERN DES NACHTRAGS. Jede der drei Grössen deckt eine andere Erklärung ab:
    //   · menuepunktDa=false hiesse: `darfLoeschen` verneint am zweiten Objekt (kein Fehler, aber
    //     eine andere Ursache als vermutet).
    //   · rueckfrageDa=false hiesse: der Klick erzeugt wieder nichts.
    //   · jaGesperrt=true wäre genau der Verdacht aus dem Nachtrag: `removeKo.isPending` hängt.
    expect(zweites).toEqual({ menuepunktDa: true, rueckfrageDa: true, jaGesperrt: false });
    expect(box.entfernt).toEqual(["ko-1", "ko-2"]);
    expect(vi.mocked(endpoints.ko.remove).mock.calls).toEqual([["ko-1"], ["ko-2"]]);
  });

  it("Z2 · nach dem ersten Löschen ist kein Rest der Rückfrage übrig", async () => {
    await loeschen();
    // Weder die Rückfrage noch ein Fehlertext des vorigen Laufs dürfen am NÄCHSTEN Eintrag
    // stehen — ein stehen gebliebener Rest wäre eine Aussage über ein Objekt, das es nicht
    // mehr gibt.
    expect(suche("bib-loeschen-rueckfrage")).toBeNull();
    expect(suche("bib-loeschen-fehler")).toBeNull();
    expect(berichtTitel()).toBe("Zweiter Bericht");
  });
});
