// @vitest-environment jsdom
// ================================================================================================
// JOB 3637 — „WISSENSOBJEKT LÖSCHEN GEHT NICHT". WAS WIRKLICH PASSIERT, GEMESSEN STATT GEGLAUBT.
// ================================================================================================
//
// PEDIS BEFUND (11.09., Bildbeleg `gespraech/feedback-20260911-admin-loeschen/wissensobjekt-
// loeschen.png`): „wissensprojekt loeschen geht nicht". Auf dem Bild steht das offene Menü „…" mit
// „Wissensobjekt löschen" — und danach: kein Fehlertext, kein Löschabschluss, nichts.
//
// DER VERDACHT AUS DEM AUFTRAG §3 war: die Rückfrage wird zwar gerendert, aber ganz unten unter dem
// vollständigen Detailinhalt, also ausserhalb des Sichtfelds. Diese Datei MISST das, statt es zu
// glauben — und misst es an der ECHTEN Route `/wissen/:id` (`KnowledgeDetail` → `BibliothekFlaeche`
// → `BibliothekLesen`), mit der echten Modalgrenze der Shell (`ModalBoundaryProvider` auf dem
// scrollenden `<main>`, Bauform aus `shell/AppShell.tsx:92/102`). Nur die HTTP-Grenze ist ersetzt.
//
// WAS DIE MESSUNG VOR DER REPARATUR ERGAB (Lauf vom 11.09., Zahlen aus diesem Prüfstand):
//   · L1: die Rückfrage WIRD gerendert — der Klick ist also nicht wirkungslos, die Bedienung ist es.
//   · L2: sie hing IM Textfluss der Lesespalte (`bib-lesen`), mit 2.614 Zeichen Text dieser Spalte
//     vor ihr, und OHNE jede Overlay-Ebene über sich (an diesem Prüfstand gemessen, Sonde vor der
//     Reparatur: `inSpalte=true zeichenDavor=2614`). In einer 720-px-Lesespalte sind das mehrere
//     Bildschirmhöhen. Der Verdacht aus §3 war damit bestätigt — es ist kein toter Klick, sondern
//     eine Rückfrage ausserhalb des Blicks.
//   · L3: im Bearbeiten-Modus wurde sie ÜBERHAUPT NICHT gerendert. Der Menükopf steht ausserhalb des
//     `edit ? … : …`-Zweigs (`BibliothekLesen.tsx:612-736`), die Rückfrage stand INNERHALB des
//     Sonst-Zweigs — wer beim Bearbeiten löschen will, klickt gegen eine Wand. Das ist ein ZWEITER,
//     eigenständiger Befund, den der Auftrag nicht kannte.
//
// BENANNTE PRÜFLÜCKE: jsdom rechnet kein Layout. „Im Blick, ohne Scrollen" ist hier deshalb nicht
// über Pixel belegbar, sondern über die STRUKTUR, die es im Browser bewirkt: die Rückfrage hängt in
// der Overlay-Ebene der App (`components/Modal.tsx` → `fixed inset-0 z-50`, portiert in den
// Modalgrenzen-Anker) und nicht mehr im Fluss der Lesespalte. Dass ein `fixed inset-0`-Overlay im
// echten Chromium sichtbar über der Seite liegt, misst der UI-Smoke, nicht diese Datei.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  /** Antwort des Löschaufrufs: „ok" oder ein Fehler, den die Fläche zeigen muss. */
  loeschAntwort: { art: "ok" } as { art: "ok" } | { art: "fehler"; status: number; text: string },
  entfernt: [] as string[],
  /**
   * R2 · BEN-Korrekturpflicht 1: der Aufruf ANTWORTET NICHT SOFORT. Nur mit einem gehaltenen
   * Aufruf lässt sich messen, was passiert, wenn jemand die Rückfrage schliesst, WÄHREND das
   * Löschen unterwegs ist — genau die Lücke, die Runde 1 offen hatte.
   */
  haltend: false,
  aufloesen: null as null | (() => void),
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
        get: vi.fn(async () => globalThis.__job3637Ko),
        list: vi.fn(async () => [globalThis.__job3637Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3637Ko),
        remove: vi.fn(async (id: string) => {
          if (box.haltend) {
            // Hängt, bis der Fall `antworten()` ruft. Erst DANN entscheidet `loeschAntwort`,
            // ob es gelingt oder scheitert.
            await new Promise<void>((resolve, reject) => {
              box.aufloesen = () => {
                box.aufloesen = null;
                if (box.loeschAntwort.art === "fehler") {
                  reject(new ApiError(box.loeschAntwort.status, "denied", box.loeschAntwort.text));
                  return;
                }
                box.entfernt.push(id);
                resolve();
              };
            });
            return undefined;
          }
          if (box.loeschAntwort.art === "fehler") {
            throw new ApiError(box.loeschAntwort.status, "denied", box.loeschAntwort.text);
          }
          box.entfernt.push(id);
          return undefined;
        }),
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
        // `null`, nicht `{}`: ohne geladene Konfiguration sagt `aiTaskInfo` ehrlich „unbekannt"
        // (lib/reasonerTaskInfo.ts:45). Ein leeres Objekt behauptete dagegen eine Konfiguration
        // ohne `effectiveProvider` — die es serverseitig nicht gibt — und liess das
        // Bearbeiten-Formular abstürzen, statt L3 messen zu lassen.
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
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

declare global {
  // eslint-disable-next-line no-var
  var __job3637Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

/** Sechzig Abschnitte Fliesstext — das „lange Objekt" aus Pedis Fall, nicht ein kurzer Absatz. */
const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) => `<h2>Abschnitt ${i + 1}</h2><p>Zahlungsziel im Abschnitt ${i + 1}.</p>`,
).join("");

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Standard-Zahlungsziel",
    statement: "Rechnungen sind binnen 30 Tagen fällig.",
    bodyHtml: LANGER_TEXT,
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let ort: string;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Schreibt die aktuelle Adresse mit — so ist der Weg nach `/bibliothek` nach dem Löschen messbar. */
function Ortsschreiber(): null {
  ort = useLocation().pathname;
  return null;
}

/**
 * Die Shell-Hülle, verkürzt auf das, was hier zählt: ein scrollendes `<main>` als Anker der
 * Modalgrenze (AppShell.tsx:92/102) und die echte Toast-Fläche. Ohne die Grenze fiele `Modal`
 * auf seinen Ersatzweg „an Ort und Stelle rendern" zurück — und dann misse dieser Prüfstand
 * eine Lage, die es in der App nicht gibt.
 */
function Huelle({ children }: { children: React.ReactNode }): JSX.Element {
  const mainRef = useRef<HTMLElement | null>(null);
  // `children` steht IM Eigenschaftsobjekt, nicht als weitere Stelle von `createElement`: der
  // Typ von `ModalBoundaryProvider` verlangt es dort, und die Bauprüfung des Tors liest die
  // Testdateien mit (die Wurzel-`tsconfig.json` allein tut das nicht — hier gemessen).
  return createElement(ModalBoundaryProvider, {
    hostRef: mainRef,
    children: [
      createElement(
        "main",
        { key: "main", ref: mainRef, className: "flex-1 overflow-y-auto px-9 py-7" },
        children,
      ),
      createElement(ToastViewport, { key: "toasts" }),
    ],
  });
}

async function mount(): Promise<void> {
  globalThis.__job3637Ko = ko();
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
                  createElement(Ortsschreiber),
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
                      createElement(Route, {
                        path: "/bibliothek",
                        element: createElement("div", { "data-testid": "seite-bibliothek" }),
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

function knopf(testId: string): HTMLElement {
  const treffer = document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
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

/** Das Menü „…" öffnen und „Wissensobjekt löschen" wählen — genau Pedis zwei Klicks. */
async function loeschenWaehlen(): Promise<void> {
  await klick(knopf("bib-eintrag-menue"));
  await klick(knopf("bib-menue-loeschen"));
}

/**
 * Die Rückfrage wird über ihren TEXT gesucht, nicht über eine Testmarke: der Ausgangszustand hatte
 * keine, und ein roter Fall, der nur „Marke fehlt" sagt, misst nicht den Befund.
 */
function rueckfrage(): HTMLElement | null {
  const frage = i18n.t("ko.deleteQ");
  const alle = [...document.body.querySelectorAll<HTMLElement>("*")].filter(
    (el) => el.textContent?.trim() === frage,
  );
  return alle.length > 0 ? (alle[alle.length - 1] as HTMLElement) : null;
}

/** Die Overlay-Ebene der App: `fixed inset-0` über dem Seiteninhalt (components/Modal.tsx:114). */
function overlayEbene(el: HTMLElement | null): HTMLElement | null {
  let lauf: HTMLElement | null = el;
  while (lauf) {
    const k = lauf.className;
    if (typeof k === "string" && k.includes("fixed") && k.includes("inset-0")) {
      return lauf;
    }
    lauf = lauf.parentElement;
  }
  return null;
}

function enthaelt(text: string): boolean {
  return (document.body.textContent ?? "").includes(text);
}

beforeEach(async () => {
  box.loeschAntwort = { art: "ok" };
  box.entfernt = [];
  box.haltend = false;
  box.aufloesen = null;
  vi.mocked(endpoints.ko.remove).mockClear();
  ort = "";
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

describe("JOB 3637 · die Rückfrage zum Löschen steht da, wo geklickt wurde", () => {
  it("L1 · der Klick ist nicht wirkungslos: die Rückfrage entsteht", async () => {
    expect(rueckfrage(), "vor dem Klick darf keine Rückfrage stehen").toBeNull();
    await loeschenWaehlen();
    // Das ist der Kern von Pedis „geht nicht": es PASSIERT etwas, man sieht es nur nicht.
    expect(rueckfrage(), "der Menüpunkt erzeugt keine Rückfrage").not.toBeNull();
    expect(knopf("bib-eintrag-menue").getAttribute("aria-expanded")).toBe("false");
  });

  it("L2 · sie hängt in der Overlay-Ebene, nicht am Ende der Lesespalte", async () => {
    await loeschenWaehlen();
    const frage = rueckfrage();
    expect(frage).not.toBeNull();

    // (a) Über ihr liegt die Overlay-Ebene der App — das ist das, was „im Blick" im Browser bewirkt.
    const ebene = overlayEbene(frage);
    expect(
      ebene,
      "die Rückfrage steht im Fluss der Seite: auf einem langen Objekt liegt sie damit ausserhalb des Sichtfelds — genau Pedis Befund",
    ).not.toBeNull();
    expect(ebene?.className).toContain("z-50");

    // (b) Und sie steckt nicht mehr IN der Lesespalte hinter dem Fliesstext. Vor der Reparatur
    //     standen 2.614 Zeichen dieser Spalte vor ihr (Sonde, siehe Kopf).
    const spalte = knopf("bib-lesen");
    expect(
      spalte.contains(frage as Node),
      "die Rückfrage liegt weiterhin im Textfluss der Lesespalte",
    ).toBe(false);
  });

  it("L3 · auch im Bearbeiten-Modus erscheint sie (der zweite, stille Befund)", async () => {
    await klick(knopf("bib-eintrag-menue"));
    await klick(knopf("bib-menue-bearbeiten"));
    await loeschenWaehlen();
    expect(
      rueckfrage(),
      "im Bearbeiten-Modus erzeugt der Menüpunkt gar nichts — der Klick geht ins Leere",
    ).not.toBeNull();
  });

  it("L4 · bestätigen löscht GENAU dieses Objekt, meldet es und führt zur Bibliothek", async () => {
    await loeschenWaehlen();
    const ja = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === i18n.t("ko.deleteYes"),
    );
    expect(ja, "der Knopf Ja, löschen fehlt").toBeTruthy();
    await klick(ja as HTMLButtonElement);

    expect(vi.mocked(endpoints.ko.remove).mock.calls).toEqual([["ko-1"]]);
    expect(rueckfrage(), "die Rückfrage bleibt nach dem Löschen stehen").toBeNull();
    expect(enthaelt(i18n.t("ko.deleteDone")), "keine Meldung über den Abschluss").toBe(true);
    // Lieferung 3: der Weg `/wissen/:id` endet nach dem Löschen in der Bibliothek, nicht auf einer
    // toten Kennung (`pages/KnowledgeDetail.tsx:67-69`).
    expect(ort).toBe("/bibliothek");
  });

  it("L5 · abbrechen lässt alles, wie es war", async () => {
    await loeschenWaehlen();
    const behalten = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === i18n.t("ko.deleteKeep"),
    );
    expect(behalten, "der Knopf Behalten fehlt").toBeTruthy();
    await klick(behalten as HTMLButtonElement);

    expect(rueckfrage()).toBeNull();
    expect(vi.mocked(endpoints.ko.remove)).not.toHaveBeenCalled();
    expect(enthaelt("Standard-Zahlungsziel"), "der Eintrag ist von der Fläche verschwunden").toBe(
      true,
    );
    expect(ort).toBe("/wissen/ko-1");
  });

  it("L6 · scheitert das Löschen, steht der Grund AM BEDIENORT und die Rückfrage bleibt offen", async () => {
    box.loeschAntwort = { art: "fehler", status: 403, text: "Dafür fehlt dir das Recht." };
    await loeschenWaehlen();
    const ja = [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === i18n.t("ko.deleteYes"),
    );
    await klick(ja as HTMLButtonElement);

    const frage = rueckfrage();
    expect(frage, "die Rückfrage verschwindet, obwohl nichts gelöscht wurde").not.toBeNull();
    const ebene = overlayEbene(frage);
    expect(ebene, "die Overlay-Ebene ist weg").not.toBeNull();
    expect(
      ebene?.textContent ?? "",
      "der Grund steht nicht dort, wo bedient wurde — nur irgendwo auf der Seite",
    ).toContain("Dafür fehlt dir das Recht.");
    expect(ort).toBe("/wissen/ko-1");
  });

  // ==============================================================================================
  // R2 · BEN-KORREKTURPFLICHT 1 — DER LAUFENDE AUFRUF ÜBERLEBT JEDEN SCHLIESSWEG.
  // ==============================================================================================
  //
  // BENs Gegenprobe an Runde 1, wörtlich: `{"gesperrt":false,"fehlerSichtbar":false}`. Bestätigen,
  // dann Escape — und die Fläche hatte den Sperrzustand UND die spätere Fehlerantwort vergessen.
  // Der Aufruf war beim Server; die Oberfläche tat, als wäre nichts. Escape, der Schliessen-Knopf
  // und der Klick auf den Hintergrund laufen alle drei durch `onClose` von `Modal` — deshalb wird
  // hier JEDER der drei Wege einzeln gefahren, nicht stellvertretend einer.
  //
  // Die Mocks der Fälle oben antworten sofort; genau das konnte diese Lage nicht zeigen. Hier hängt
  // der Aufruf, bis der Fall selbst `antworten()` ruft.

  /** Der Schliessen-Knopf im Kopf der Fläche (`Modal.tsx:135`) — er trägt den Text. */
  function schliessenKnopf(): HTMLButtonElement | undefined {
    return [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === i18n.t("modal.close"),
    );
  }

  /** Die Hintergrundfläche (`Modal.tsx:115`) — beschriftet, aber ohne Text. */
  function hintergrund(): HTMLButtonElement | undefined {
    return [...document.body.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === i18n.t("modal.close") && (b.textContent ?? "") === "",
    );
  }

  function jaKnopf(): HTMLButtonElement | undefined {
    return [...document.body.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === i18n.t("ko.deleteYes"),
    );
  }

  /** Den gehaltenen Aufruf beantworten und die Fläche zur Ruhe kommen lassen. */
  async function antworten(): Promise<void> {
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });
    await act(flush);
  }

  /**
   * Bestätigen, ohne dass der Server antwortet — danach steht der Aufruf und die Fläche muss ihn
   * halten. Gibt den Weg frei, den der jeweilige Fall zum Schliessen versucht.
   */
  async function bestaetigenUndHalten(): Promise<void> {
    box.haltend = true;
    box.loeschAntwort = { art: "fehler", status: 403, text: "Dafür fehlt dir das Recht." };
    await loeschenWaehlen();
    await klick(jaKnopf() as HTMLButtonElement);
    // Die Lage, um die es geht: der Aufruf ist raus, die Antwort steht aus.
    expect(vi.mocked(endpoints.ko.remove)).toHaveBeenCalledTimes(1);
    expect(
      rueckfrage(),
      "die Rückfrage ist schon weg, bevor der Server geantwortet hat",
    ).not.toBeNull();
  }

  /** Die drei Schliesswege, je als eigener Fall — mit demselben Prüfkörper dahinter. */
  const SCHLIESSWEGE: { name: string; schliessen: () => Promise<void> }[] = [
    {
      name: "L7 · Escape",
      schliessen: async () => {
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
          await flush();
        });
        await act(flush);
      },
    },
    {
      name: "L8 · der Schliessen-Knopf",
      schliessen: async () => {
        await klick(schliessenKnopf() as HTMLButtonElement);
      },
    },
    {
      name: "L9 · der Klick auf den Hintergrund",
      schliessen: async () => {
        await klick(hintergrund() as HTMLButtonElement);
      },
    },
  ];

  for (const weg of SCHLIESSWEGE) {
    it(`${weg.name} während des Löschaufrufs verliert weder Sperre noch Fehler`, async () => {
      await bestaetigenUndHalten();
      await weg.schliessen();

      // 1. DIE FLÄCHE BLEIBT STEHEN. Es gibt etwas zu sagen: der Aufruf läuft.
      const frage = rueckfrage();
      expect(frage, "die Rückfrage ist trotz laufendem Aufruf verschwunden").not.toBeNull();
      // 2. DIE SPERRE HÄLT — das war BENs `"gesperrt":false`.
      const kasten = document.body.querySelector<HTMLElement>(
        '[data-testid="bib-loeschen-rueckfrage"]',
      );
      expect(kasten?.getAttribute("aria-busy")).toBe("true");
      expect(jaKnopf()?.disabled, "der Bestätigungsknopf ist wieder frei").toBe(true);

      // 3. KEINE ZWEITE FREIGABE. Auch wer den Menüpunkt jetzt noch erreicht (in jsdom wirkt
      //    `inert` nicht), löst kein zweites Löschen aus.
      const punkt = document.body.querySelector<HTMLElement>('[data-testid="bib-menue-loeschen"]');
      if (punkt) {
        await klick(punkt);
      }
      const jaJetzt = jaKnopf();
      if (jaJetzt && !jaJetzt.disabled) {
        await klick(jaJetzt);
      }
      expect(
        vi.mocked(endpoints.ko.remove),
        "ein zweiter Löschaufruf ging raus, obwohl der erste noch lief",
      ).toHaveBeenCalledTimes(1);

      // 4. DER SPÄTERE FEHLER WIRD SICHTBAR — das war BENs `"fehlerSichtbar":false`.
      await antworten();
      const nachher = document.body.querySelector<HTMLElement>(
        '[data-testid="bib-loeschen-fehler"]',
      );
      expect(nachher?.textContent?.trim(), "der Grund der Absage ging verloren").toBe(
        "Dafür fehlt dir das Recht.",
      );
      expect(box.entfernt, "es wurde doch gelöscht").toEqual([]);
      expect(ort).toBe("/wissen/ko-1");
    });
  }

  it("L10 · nach dem Fehler schliesst derselbe Handgriff die Rückfrage wirklich", async () => {
    // Die Kehrseite von L7–L9: die Fläche bleibt NUR so lange stehen, wie es etwas zu sagen gibt.
    // Bliebe sie auch danach, wäre aus der Reparatur eine Falle geworden.
    await bestaetigenUndHalten();
    await antworten();
    expect(
      document.body.querySelector('[data-testid="bib-loeschen-fehler"]'),
      "der Fehler steht nicht da",
    ).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush();
    });
    await act(flush);
    expect(
      rueckfrage(),
      "die Rückfrage lässt sich nach dem Fehler nicht mehr schliessen",
    ).toBeNull();
  });

  it("L11 · gelingt das gehaltene Löschen, schliesst die Fläche von selbst", async () => {
    box.haltend = true;
    box.loeschAntwort = { art: "ok" };
    await loeschenWaehlen();
    await klick(jaKnopf() as HTMLButtonElement);
    // Auch hier zwischendurch geschlossen — der Erfolg darf davon so wenig verlieren wie der Fehler.
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await flush();
    });
    await act(flush);
    expect(rueckfrage(), "die Fläche ist trotz laufendem Aufruf weg").not.toBeNull();

    await antworten();
    expect(rueckfrage(), "die Fläche bleibt nach dem Erfolg stehen").toBeNull();
    expect(box.entfernt).toEqual(["ko-1"]);
    expect(enthaelt(i18n.t("ko.deleteDone"))).toBe(true);
    expect(ort).toBe("/bibliothek");
  });

  // ==============================================================================================
  // JOB 3777 — EIN SCHON GELÖSCHTES WISSENSOBJEKT IST KEIN FEHLER.
  // ==============================================================================================
  //
  // DIE DRIFT, die `archiv/3637/runde-2/RUECKGABE.md:64` als Rest ausgeschrieben hat: derselbe
  // 404 des Servers („zwischen Öffnen und Bestätigen hat jemand anderes gelöscht") wird auf zwei
  // Flächen gegensätzlich beantwortet — die Prüfliste meldet Erfolg (`pages/Validation.tsx:296`,
  // `ko.deleteAlreadyGone`), die Bibliothek einen roten Satz in der offenen Rückfrage. Gemessen
  // vor der Reparatur an genau diesem Prüfstand: Rückfrage steht (`rueckfrage() != null`),
  // Fehlerkasten trägt „Wissensobjekt nicht gefunden.", keine Erfolgsmeldung.
  //
  // L12 hält die neue Wahrheit, L13 ihre GRENZE: nur der 404 ist „war schon weg". Ohne L13 wäre
  // L12 auch dann grün, wenn jeder beliebige Fehlschlag zur Erfolgsmeldung würde.

  it("L12 · war das Objekt schon weg (404), ist das kein Fehler: Rückfrage zu, Erfolgsmeldung, zurück in die Bibliothek", async () => {
    box.loeschAntwort = { art: "fehler", status: 404, text: "Wissensobjekt nicht gefunden." };
    await loeschenWaehlen();
    await klick(jaKnopf() as HTMLButtonElement);

    // 1. DIE RÜCKFRAGE IST WIRKLICH ZU. Die Halbheit, die hier ausgeschlossen wird: ein `onError`,
    //    das nur meldet — `removeKo.isError` hielte `loeschenOffenEffektiv` weiter offen
    //    (`BibliothekLesen.tsx:330`), und der Nutzer stünde vor Erfolgsmeldung UND offenem Dialog.
    expect(rueckfrage(), "die Rückfrage bleibt stehen, obwohl das Objekt weg ist").toBeNull();
    // 2. UND KEIN FEHLERKASTEN — auch kein leerer.
    expect(
      document.body.querySelector('[data-testid="bib-loeschen-fehler"]'),
      "der rote Satz steht da, obwohl nichts schiefging",
    ).toBeNull();
    // 3. DER WORTLAUT KOMMT AUS DEM KATALOG, nicht aus diesem Test: `ko.deleteAlreadyGone` sagt,
    //    was wirklich geschah („war bereits nicht mehr vorhanden"), nicht „gelöscht" — DIESER
    //    Aufruf hat nichts gelöscht. Und nicht `ko.deleteDone`, sonst wäre es eine Behauptung.
    expect(
      enthaelt(i18n.t("ko.deleteAlreadyGone")),
      "keine Meldung darüber, dass das Objekt schon weg war",
    ).toBe(true);
    expect(enthaelt(i18n.t("ko.deleteDone")), "die Fläche behauptet, SIE habe gelöscht").toBe(
      false,
    );
    // 4. DER AUFRUFER ERFÄHRT ES — dieselbe Stelle, an der L4 den Erfolgsweg misst: `onGeloescht`
    //    nimmt die tote Kennung aus der Adresse (`BibliothekFlaeche.tsx:1889`) und führt von
    //    `/wissen/:id` in die Bibliothek. Ohne diesen Handgriff zeigte die Adresse weiter auf ein
    //    Objekt, das es nicht mehr gibt.
    expect(ort, "die Adresse zeigt weiter auf die tote Kennung").toBe("/bibliothek");
  });

  it("L13 · die Grenze: ein echter Fehlschlag (403) wird NICHT als schon-weg gemeldet", async () => {
    box.loeschAntwort = { art: "fehler", status: 403, text: "Dafür fehlt dir das Recht." };
    await loeschenWaehlen();
    await klick(jaKnopf() as HTMLButtonElement);

    expect(
      enthaelt(i18n.t("ko.deleteAlreadyGone")),
      "ein 403 wird als schon-weg gemeldet — die Statusgrenze ist aufgeweicht",
    ).toBe(false);
    expect(
      rueckfrage(),
      "die Rückfrage schliesst sich nach einem echten Fehlschlag",
    ).not.toBeNull();
    expect(
      document.body.querySelector('[data-testid="bib-loeschen-fehler"]')?.textContent?.trim(),
    ).toBe("Dafür fehlt dir das Recht.");
    expect(ort, "ein echter Fehlschlag führt trotzdem aus dem Bericht heraus").toBe("/wissen/ko-1");
  });
});
