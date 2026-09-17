// @vitest-environment jsdom
// ================================================================================================
// JOB 4155 · WG-LUECKEN — L5: DIE GESETZTEN BEZIEHUNGEN STEHEN DA, OHNE DASS JEMAND AUFKLAPPT.
// ================================================================================================
//
// DER BEFUND, den dieser Fall schliesst, ist von Codex gemessen (2df61f13) und im Auftrag §2.4
// wörtlich festgehalten: Der `WissensbeziehungenBereich` aus JOB 4153 hing ausschliesslich in
// `KnowledgeNeighborhood` — also als Abschnitt 13 hinter der Zeile „Mehr"
// (`MehrAbschnitte.tsx:1853-1860`), zugeklappt als Vorgabe. Eine Anwenderin sah ihre eigene,
// ausdrücklich gesetzte Fachbeziehung nur nach einem Klick, den niemand ihr ansagt. Codex hat
// deshalb festgelegt: dieser Einbau zählt NICHT als App-Anzeige.
//
// WIE HIER GEMESSEN WIRD, und warum genau so:
//   · Gemountet wird die ECHTE Route `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche` →
//     `BibliothekLesen`). Den Bereich einzeln zu mounten hätte die Frage „steht er auf der Seite?"
//     gar nicht gestellt — genau sie ist der Gegenstand.
//   · Gemessen wird VOR JEDER INTERAKTION. Kein Klick, kein Aufklappen, kein `scrollIntoView`.
//     Wäre der Bereich weiterhin nur hinter „Mehr", stünde er zu diesem Zeitpunkt nicht im DOM —
//     `MehrAbschnitte` wird erst gerendert, wenn `mehrOffen` wahr ist (`BibliothekLesen.tsx`).
//   · Und er steht GENAU EINMAL. Das ist die Gegenprobe zu Lieferung 6 (Ablösung statt Ergänzung):
//     würde der alte Einbau in `KnowledgeNeighborhood` wieder hinzukommen, stünde dieselbe Liste
//     nach dem Aufklappen ein zweites Mal da — und zwei Flächen, die denselben Bestand zeigen,
//     laufen früher oder später auseinander.
//
// BENANNTE PRÜFLÜCKE: jsdom rechnet kein Layout. „Sichtbar ohne Scrollen" ist hier nicht über Pixel
// belegt, sondern über die STRUKTUR, die es im Browser bewirkt — der Bereich hängt im Fluss der
// Lesespalte (`bib-lesen`, 720 px, `gap-[18px]`) und nicht in einem eingeklappten Abschnitt. Die
// geometrische Aussage gehört zur Browser-Abnahme (G1/G7), nicht hierher.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Die Antwort des Beziehungs-Lesewegs — oder ein Fehler, den die Fläche tragen muss. */
  beziehungen: null as null | { koId: string; kanten: unknown[]; total: number },
  fehler: null as null | { status: number; code: string; text: string },
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
        get: vi.fn(async () => globalThis.__job4155Ko),
        list: vi.fn(async () => [globalThis.__job4155Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: { id: "ko-1", title: "Standard-Zahlungsziel", status: "offen" },
          neighbors: [],
          total: 0,
          truncated: false,
          excludedTags: [],
        })),
        act: vi.fn(async () => globalThis.__job4155Ko),
        beziehungen: vi.fn(async () => {
          if (box.fehler) {
            throw new ApiError(box.fehler.status, box.fehler.code, box.fehler.text);
          }
          return box.beziehungen;
        }),
        beziehungSetzen: vi.fn(async () => {
          throw new Error("nicht Gegenstand dieses Falls");
        }),
        beziehungWiderrufen: vi.fn(async () => {
          throw new Error("nicht Gegenstand dieses Falls");
        }),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      library: { search: leer },
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
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // eslint-disable-next-line no-var
  var __job4155Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Standard-Zahlungsziel",
    statement: "Rechnungen sind binnen 30 Tagen fällig.",
    bodyHtml: "<p>Zahlungsziel.</p>",
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

/** Eine gesetzte, aktive Beziehung in der Form des verbindlichen API-Vertrags. */
function eineKante(): { koId: string; kanten: unknown[]; total: number } {
  return {
    koId: "ko-1",
    total: 1,
    kanten: [
      {
        id: "k-1",
        art: "ergaenzt",
        richtung: "ungerichtet",
        gegenstueck: { id: "ko-2", title: "Skontoregel", status: "validiert" },
        urheber: "u1",
        gesetztAm: "2026-09-16T08:00:00.000Z",
        status: "aktiv",
        version: 1,
        herkunft: "kuratiert",
        beurteilt: { quelleVersion: 1, zielVersion: 1, quelleFassungAm: null, zielFassungAm: null },
        aktuell: { quelleVersion: 1, zielVersion: 1 },
        abweichung: "unveraendert",
      },
    ],
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [createElement("main", { key: "main", ref: mainRef }, children)],
  });
}

async function mount(): Promise<void> {
  globalThis.__job4155Ko = ko();
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
                    Huelle,
                    null,
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
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

const alle = (marke: string): HTMLElement[] => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${marke}"]`),
];
const eins = (marke: string): HTMLElement | null =>
  document.body.querySelector<HTMLElement>(`[data-testid="${marke}"]`);

/**
 * ================================================================================================
 * WARTEN, BIS DIE ABFRAGE WIRKLICH GESCHEITERT IST — UND NICHT NUR LANGE GENUG FLUSHEN.
 * ================================================================================================
 *
 * GEMESSEN und nicht vermutet (Cloud-Lauf f0d18dcb dieser Gruppe): mit `box.fehler` stand nach den
 * 75 Mikrotask-Runden von `mount()` WEDER der Fehlersatz NOCH der Bereich — der Abruf war schlicht
 * noch unterwegs. Ein Prüfstand, der an dieser Stelle eine Abwesenheit misst, ist dann grün, weil
 * nichts fertig ist, und nicht, weil das Produkt sich richtig verhält.
 *
 * DAS TRIFFT BEIDE FEHLERFÄLLE, und den 403-Fall am gefährlichsten: „der Bereich erscheint nicht"
 * wäre dort auch für eine noch laufende Abfrage wahr gewesen — ein falsches Grün über genau die
 * Zusage, die der Fall beweisen soll.
 *
 * Deshalb wartet dieser Helfer auf den ZUSTAND der Abfrage im Cache (`error`), nicht auf eine
 * Anzahl Runden. Er nimmt ausserdem in Kauf, dass React Query die Abfrage wiederholt: die Schleife
 * läuft bis zu drei Sekunden und stellt am Ende ausdrücklich fest, dass der Fehler da ist.
 */
async function bisAbfrageGescheitert(): Promise<void> {
  for (let i = 0; i < 150; i++) {
    if (qc.getQueryState(["ko-beziehungen", "ko-1"])?.status === "error") {
      break;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  // Und danach noch echte Zeitschritte, damit die Benachrichtigung der Beobachter und das
  // anschliessende Rendern wirklich durch sind: der Zustand im Cache ist EHER da als das DOM.
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  await act(flush);
  expect(
    qc.getQueryState(["ko-beziehungen", "ko-1"])?.status,
    "die Abfrage ist nicht gescheitert — der Fall misst sonst nur eine laufende Abfrage",
  ).toBe("error");
}

beforeEach(() => {
  box.beziehungen = eineKante();
  box.fehler = null;
  vi.clearAllMocks();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  qc?.clear();
});

describe("JOB 4155 · L5 — der Beziehungsbereich steht in der Lesespalte, ohne Aufklappen", () => {
  it("er steht im DOM, BEVOR irgendjemand die Zeile Mehr anfasst", async () => {
    await mount();

    // Belegt zuerst, dass die Lesespalte überhaupt steht — sonst misst der Fall nichts.
    expect(eins("bib-lesen"), "die Lesespalte steht nicht").not.toBeNull();
    // Und dass die Zeile „Mehr" ZUGEKLAPPT ist: der Bereich steht also nicht deshalb da, weil
    // dieser Prüfstand aus Versehen aufgeklappt hat.
    const mehr = eins("bib-mehr");
    expect(mehr, "die Zeile Mehr steht nicht").not.toBeNull();
    expect((mehr as HTMLElement).getAttribute("aria-expanded")).toBe("false");

    const bereich = eins("wissensbeziehungen");
    expect(
      bereich,
      "der Beziehungsbereich steht nicht in der Lesespalte — er haengt weiter hinter der Zeile Mehr",
    ).not.toBeNull();
    // Der Inhalt ist wirklich da, nicht nur die Hülle: das Gegenstück steht mit Namen.
    expect((bereich as HTMLElement).textContent ?? "").toContain("Skontoregel");
  });

  it("er hängt im Fluss der Lesespalte und NICHT in einem eingeklappten Abschnitt", async () => {
    await mount();
    const bereich = eins("wissensbeziehungen") as HTMLElement;
    const spalte = eins("bib-lesen") as HTMLElement;
    expect(spalte.contains(bereich), "der Bereich steht ausserhalb der Lesespalte").toBe(true);
    // Und er steht VOR der Zeile „Mehr" in der Dokumentordnung — oben, nicht am Ende.
    const mehr = eins("bib-mehr") as HTMLElement;
    const ordnung = bereich.compareDocumentPosition(mehr);
    expect(
      (ordnung & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      "die Zeile Mehr steht vor dem Beziehungsbereich",
    ).toBe(true);
  });

  // ==============================================================================================
  // DIE GEGENPROBE ZU LIEFERUNG 6: ABLÖSUNG, NICHT ERGÄNZUNG.
  // ==============================================================================================
  //
  // Nach dem Aufklappen ist der gesamte Abschnitt 13 (`KnowledgeNeighborhood`) im DOM. Stünde der
  // alte Einbau dort weiterhin, gäbe es DEN BEREICH ZWEIMAL — zweimal dieselben Beziehungen,
  // zweimal Schreibknöpfe darauf, und keine Fläche wüsste vom Stand der anderen.
  it("nach dem Aufklappen der Zeile Mehr steht er GENAU EINMAL da, nicht zweimal", async () => {
    await mount();
    expect(alle("wissensbeziehungen")).toHaveLength(1);

    await act(async () => {
      (eins("bib-mehr") as HTMLElement).click();
      await flush();
    });
    await act(flush);
    expect((eins("bib-mehr") as HTMLElement).getAttribute("aria-expanded")).toBe("true");

    // Die dreizehn Abschnitte sind EINZELN zugeklappt (`MehrAbschnitte`, `Abschnitt`: die Kinder
    // entstehen erst bei `offen`). Abschnitt 13 wird deshalb ausdrücklich geöffnet — jsdom löst den
    // `toggle` eines `<details>` nicht von selbst aus, also wird er hier gesetzt und gemeldet.
    const abschnitt = document.body.querySelector<HTMLDetailsElement>(
      '[data-bib-abschnitt="nachbarschaft"]',
    );
    expect(abschnitt, "Abschnitt 13 steht nicht hinter Mehr").not.toBeNull();
    await act(async () => {
      (abschnitt as HTMLDetailsElement).open = true;
      (abschnitt as HTMLDetailsElement).dispatchEvent(new Event("toggle", { bubbles: false }));
      await flush();
    });
    await act(flush);

    // Die Nachbarschaft ist jetzt wirklich da — sonst prüfte die Zählung unten nichts.
    expect(eins("knowledge-neighborhood"), "Abschnitt 13 wurde nicht gerendert").not.toBeNull();
    expect(
      alle("wissensbeziehungen"),
      "die kuratierten Beziehungen stehen zweimal — der Zwischenweg läuft daneben weiter",
    ).toHaveLength(1);
  });

  // ==============================================================================================
  // DAS ZUSTANDSMODELL (Auftrag §9), soweit es DIESE Stelle trägt.
  // ==============================================================================================
  it("keine Rechte (403): der Bereich erscheint gar nicht — kein Platzhalter, keine Zahl", async () => {
    box.fehler = { status: 403, code: "FORBIDDEN", text: "Kein Zugriff." };
    await mount();
    await bisAbfrageGescheitert();

    expect(eins("bib-lesen"), "die Lesespalte steht nicht").not.toBeNull();
    expect(eins("bib-beziehungen"), "ein gesperrter Platzhalter steht da").toBeNull();
    expect(eins("wissensbeziehungen")).toBeNull();
    // Und ausdrücklich auch KEIN Fehlersatz: er wäre die Auskunft, dass es hier etwas gäbe.
    expect(eins("wb-fehler")).toBeNull();
  });

  it("Fehler ohne Bestand: ein Satz UND ein erreichbarer erneuter Versuch", async () => {
    box.fehler = { status: 500, code: "INTERNAL", text: "Unerwarteter Fehler." };
    await mount();
    await bisAbfrageGescheitert();

    expect(eins("bib-beziehungen"), "der Bereich fehlt ganz").not.toBeNull();
    expect(eins("wb-fehler"), "der eine Satz fehlt").not.toBeNull();
    const erneut = eins("bib-beziehungen-erneut");
    expect(erneut, "der Weg zurück fehlt — eine Sackgasse ist kein Zustand").not.toBeNull();
    // Ein EIGENER Wortlaut, nicht der der Lesefläche: auf einer Fläche mit zwei Wiederholwegen
    // wäre derselbe Text für einen Vorleser nicht unterscheidbar.
    expect((erneut as HTMLElement).textContent ?? "").toBe(i18n.t("wb.erneut"));
    expect((erneut as HTMLElement).textContent ?? "").not.toBe(i18n.t("lib.liste.erneut"));

    // ============================================================================================
    // DIE GEGENPROBE ZUM KREISLAUF, den dieser Auftrag hier gefunden und behoben hat.
    // ============================================================================================
    //
    // Der erste Entwurf hängte den Unterbau an dieselbe Abfrage, die er selbst beobachtet: der
    // Fehler hängte ihn EIN, sein Anmelden frischte die gescheiterte Abfrage auf, die Auffrischung
    // setzte den Zustand auf `pending` zurück und hängte ihn wieder AUS — Abruf um Abruf, und am
    // Ende stand die Fläche leer. Gemessen: abwechselnd `[true/…/500]` und `[false/…/undefined]`,
    // so lange der Prüfstand lief.
    //
    // EINE ANZAHL STATT EINES ZUSTANDS: Genau diesen Kreislauf sieht man an den ABRUFEN, nicht am
    // Bild — beim Bild wäre nur die Momentaufnahme sichtbar. Erlaubt sind der Erstabruf und die EINE
    // Auffrischung beim Anmelden des Unterbaus; alles darüber ist der Kreislauf.
    expect(
      (endpoints.ko.beziehungen as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
      "die Beziehungen werden im Kreis abgerufen — der Bereich hängt sich selbst aus und wieder ein",
    ).toBeLessThanOrEqual(2);
  });

  it("erfolgreich leer: der Leersatz steht — und ausdrücklich keine Konfliktfreiheit", async () => {
    box.beziehungen = { koId: "ko-1", kanten: [], total: 0 };
    await mount();

    const leerBlock = eins("wb-leer");
    expect(leerBlock, "der Leerfall wird gar nicht angezeigt").not.toBeNull();
    const text = (leerBlock as HTMLElement).textContent ?? "";
    expect(text).toContain(i18n.t("wb.leer"));
    // DIE EHRLICHKEITSAUFLAGE: „keine Beziehung" darf nicht als „nichts widerspricht sich" gelesen
    // werden. Ohne diesen Satz wäre der Leerfall die stillste Falschaussage der ganzen Fläche.
    expect(text).toContain(i18n.t("wb.leerHinweis"));
  });
});
