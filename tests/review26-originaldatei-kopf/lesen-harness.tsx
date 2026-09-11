// ================================================================================================
// JOB 3474 · REVIEW26-ORIGINALDATEI-KOPF — der gemeinsame Prüfstand der drei gemounteten Fälle.
// ================================================================================================
//
// Bauform übernommen von `tests/berichtskopf-spruenge/kopf-fuehrt-zu-quellen-und-anhaengen.test.tsx`
// (JOB 3108 · UX-03): die ECHTE Lesefläche über die echte Route `/wissen/:id`
// (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen`), mit stillgelegter HTTP-Grenze.
// Nichts an der Fläche ist nachgebaut — gemessen wird das Produkt, nicht ein Doppelgänger.
//
// WARUM EIN HELFER UND NICHT DREIMAL DASSELBE: die drei Fälle unterscheiden sich NUR im `bodyHtml`
// des Wissensobjekts. Der `vi.mock`-Kopf bleibt in jeder Testdatei (er wird dateiweise hochgezogen);
// der Bestand reist über `globalThis.__job3474Ko`, weil eine hochgezogene Fabrik nichts aus dem
// Modulrumpf schließen darf.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // eslint-disable-next-line no-var
  var __job3474Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `scrollIntoView` fehlt in jsdom. Statt sie stillzulegen, wird sie MITGESCHRIEBEN — sonst wäre
 * „der Knopf holt die Datei ins Bild" gar nicht messbar (Muster: JOB 3108, ebenda Z.119-130).
 */
export const scrollRufe: { ziel: Element; option: unknown }[] = [];
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView =
  function scrollIntoView(this: Element, o) {
    scrollRufe.push({ ziel: this, option: o ?? null });
  };

/** Sechzig Abschnitte Fließtext — der Befundfall („erst nach dem langen Text verlinkt"). */
export const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) => `<h2>Abschnitt ${i + 1}</h2><p>Reinigung und Prüfung im Abschnitt ${i + 1}.</p>`,
).join("");

/**
 * Ein Wissensobjekt OHNE Quellen und OHNE Anhänge — genau die Lage des Prüferbefunds: der Kopf
 * sagt zu beiden Mengen „keine", während im Text eine funktionierende Originaldatei hängt.
 */
export function ko(bodyHtml: string): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
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
  } as unknown as KnowledgeObject;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient | null = null;

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

export async function mount(bodyHtml: string): Promise<void> {
  unmount();
  globalThis.__job3474Ko = ko(bodyHtml);
  scrollRufe.length = 0;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  qc = client;
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
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
}

/** Abbauen. Mehrfach aufrufbar (`mount` räumt selbst auf) — ein zweiter Ruf tut nichts. */
export function unmount(): void {
  const wurzel = root;
  if (wurzel) {
    act(() => wurzel.unmount());
  }
  container?.remove();
  qc?.clear();
  root = null;
  container = null;
  qc = null;
}

/** Der Abfragespeicher dieses Aufbaus — für Zustände, die einen zweiten Abruf brauchen (§9). */
export function abfragespeicher(): QueryClient {
  if (!qc) {
    throw new Error("Die Lesefläche ist nicht gemountet — `mount(bodyHtml)` fehlt.");
  }
  return qc;
}

function flaeche(): HTMLDivElement {
  if (!container) {
    throw new Error("Die Lesefläche ist nicht gemountet — `mount(bodyHtml)` fehlt.");
  }
  return container;
}

export function suche<T extends Element>(auswahl: string): T | null {
  return flaeche().querySelector<T>(auswahl);
}

export function el(testId: string): HTMLElement {
  const treffer = flaeche().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!treffer) {
    throw new Error(`„${testId}" fehlt auf der Lesefläche`);
  }
  return treffer;
}

export function knopf(testId: string): HTMLButtonElement {
  const treffer = el(testId);
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`„${testId}" ist kein <button>, sondern ${treffer.tagName}`);
  }
  return treffer;
}

export const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

/** Der zugängliche Name eines Knopfes: `aria-label` schlägt den Textinhalt. */
export const zugaenglicherName = (e: HTMLElement): string =>
  (e.getAttribute("aria-label") ?? "").trim() || text(e);

export async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}
