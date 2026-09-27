// ================================================================================================
// FE-003 · DAS PRÜFGERÜST: die ECHTE Hülle mit der ECHTEN Fragen-Seite, das Netz auf `fetch`-Ebene
// beobachtet.
// ================================================================================================
//
// WARUM `fetch` UND NICHT `endpoints`: Die Demo-Grenze (Kriterium 5) heisst „keine echte Frage,
// kein Dokument, keine Freigabe, keine Nutzerdatenänderung“. Das ist eine Aussage über die LEITUNG,
// nicht über ein bestimmtes Modul. Deshalb läuft hier jeder Abruf durch den echten API-Client
// (`api/client.ts`) bis zu `fetch`, und jede Anfrage wird mit Methode und Pfad protokolliert. Eine
// Mutation — egal über welchen Weg — ist eine Anfrage mit POST/PUT/PATCH/DELETE und fällt auf.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Ask } from "../../apps/web/src/pages/Ask";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

export interface Anfrage {
  methode: string;
  pfad: string;
  body: string | null;
}

export interface Lage {
  /** Ist für die Aufgabe „answer“ ein Modell aktiv? */
  kiAktiv: boolean;
  rolle: "viewer" | "experte" | "controller" | "admin";
}

export const netz: { anfragen: Anfrage[]; lage: Lage } = {
  anfragen: [],
  lage: { kiAktiv: true, rolle: "experte" },
};

export const ECHTE_QUELLE = {
  id: "ko-echt-1",
  title: "Echte Reiserichtlinie",
  statement: "Reisen werden vorab genehmigt.",
  bodyHtml: "<p>Reisen werden vorab genehmigt.</p>",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Personal",
  tags: [],
  confidence: 80,
  trust: 80,
  status: "validiert",
  version: 1,
  originalAuthor: "u-ex",
  author: "u-ex",
  neededValidations: 0,
  assignments: [],
  asset: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  history: [],
  sources: [],
};

export const ECHTE_ANTWORT = "Reisen werden vorab von der Leitung genehmigt [1].";

function antwort(status: number, daten: unknown): Response {
  return new Response(daten === undefined ? "" : JSON.stringify(daten), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lesen(pfad: string): unknown {
  const ohneQuery = pfad.split("?")[0] ?? pfad;
  switch (ohneQuery) {
    case "/api/auth/status":
      return { needsSetup: false };
    case "/api/auth/me":
      return { id: "u-ex", name: "Erik", role: netz.lage.rolle };
    case "/api/reasoner/status":
      return netz.lage.kiAktiv
        ? { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } }
        : { active: false, mode: "deterministic", tasks: { answer: false } };
    case "/api/kos":
      return [ECHTE_QUELLE];
    case "/api/features":
      return { features: {} };
    case "/api/lesevarianten":
      return { eintraege: [] };
    case "/api/gaps/summary":
      return { open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } };
    case "/api/analytics":
      return { total: 0, byStatus: {} };
    case "/api/external/policy":
      return { stage: "off" };
    case "/api/livewall":
      return { fresh: [], saved: [], helped: [], helpedToday: 0 };
    case "/api/reasoner/config":
      return {};
    default:
      return [];
  }
}

export const netzStub = async (
  eingabe: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const pfad =
    typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.pathname : eingabe.url;
  const methode = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init.body : null;
  netz.anfragen.push({ methode, pfad, body });
  if (methode === "GET") {
    return antwort(200, lesen(pfad));
  }
  if (methode === "POST" && pfad === "/api/ask") {
    return antwort(200, {
      result: {
        answered: true,
        answer: ECHTE_ANTWORT,
        knowledgeClass: "gesichert",
        trust: 80,
        sources: [ECHTE_QUELLE.id],
        citedSources: [ECHTE_QUELLE.id],
        steps: [],
        demo: false,
        captionSources: [],
      },
      gap: null,
      receipt: "r-1",
    });
  }
  return antwort(403, { error: "IM_TEST_VERBOTEN" });
};

/** Alle Anfragen, die etwas verändern könnten. */
export function mutationen(ab = 0): Anfrage[] {
  return netz.anfragen.slice(ab).filter((a) => a.methode !== "GET" && a.methode !== "HEAD");
}

export interface Medien {
  schmal?: boolean;
  reduziert?: boolean;
}

export function medienStub({ schmal = false, reduziert = false }: Medien = {}): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches:
        (q.includes("max-width: 899px") && schmal) ||
        (q.includes("prefers-reduced-motion: reduce") && reduziert),
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

export async function ruhe(schritte = 20): Promise<void> {
  await act(async () => {
    for (let i = 0; i < schritte; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

export async function warte(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

export async function bis(bedingung: () => boolean, versuche = 60): Promise<void> {
  for (let i = 0; i < versuche && !bedingung(); i++) {
    await warte(25);
  }
}

export interface Montiert {
  container: HTMLDivElement;
  abbauen: () => void;
}

export async function montiere(
  route = "/fragen",
  kind: "fragen" | "leer" = "fragen",
): Promise<Montiert> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seite =
    kind === "fragen" ? createElement(Ask) : createElement("div", { "data-testid": "leere-seite" });
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
                  { initialEntries: [route] },
                  createElement(AppShell, null, seite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  return {
    container,
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export async function klick(el: Element | null | undefined): Promise<void> {
  if (!el) {
    throw new Error("Klickziel fehlt");
  }
  await act(async () => {
    (el as HTMLElement).click();
  });
  await ruhe(5);
}

/** Tippt wie ein Mensch in ein kontrolliertes React-Feld. */
export async function tippe(feld: HTMLInputElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ruhe(3);
}

export async function taste(el: Element, key: string): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
  await ruhe(3);
}

export const q = <T extends Element = HTMLElement>(wurzel: ParentNode, testId: string): T | null =>
  wurzel.querySelector<T>(`[data-testid="${testId}"]`);

export const alle = <T extends Element = HTMLElement>(wurzel: ParentNode, testId: string): T[] =>
  Array.from(wurzel.querySelectorAll<T>(`[data-testid="${testId}"]`));

/** Das ECHTE Fragefeld der Seite — ausdrücklich NICHT das der Demo. */
export function echtesFeld(wurzel: ParentNode): HTMLInputElement {
  const feld = Array.from(
    wurzel.querySelectorAll<HTMLInputElement>('[data-tutorial-ziel="fragen.fragefeld"]'),
  ).find((el) => !el.closest("[data-tutorial-demo]"));
  if (!feld) {
    throw new Error("echtes Fragefeld fehlt");
  }
  return feld;
}

export function demo(wurzel: ParentNode): HTMLElement {
  const d = q(wurzel, "tutorial-demo");
  if (!d) {
    throw new Error("Demo fehlt");
  }
  return d;
}

export async function oeffneTutorial(wurzel: ParentNode): Promise<void> {
  await klick(q(wurzel, "tutorial-knopf"));
  await bis(() => {
    const d = q(wurzel, "tutorial-demo");
    return Boolean(d?.querySelector("[data-tutorial-ziel]"));
  });
}

export async function zuKapitel(wurzel: ParentNode, schritt: string): Promise<void> {
  await klick(wurzel.querySelector(`[data-testid="tutorial-kapitel"][data-schritt="${schritt}"]`));
}

export async function zuTeil(wurzel: ParentNode, index: number): Promise<void> {
  await klick(alle(wurzel, "tutorial-teil")[index]);
}

/** Das Blatt „Mehr“ der DEMO — ein Portal am Rand der Anwendung, nicht in der Miniatur. */
export function demoBlatt(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="tutorial-demo-mehr"]');
}

/** Der tatsächliche Weg der Seite, in der Demo bedient: „…“ an der Antwortkarte → „Mehr …“. */
export async function mehrUeberMenue(wurzel: ParentNode): Promise<void> {
  await klick(demo(wurzel).querySelector('[data-testid="tutorial-demo-menue"]'));
  await klick(document.querySelector('[data-testid="tutorial-demo-menue-punkt-mehr"]'));
}

/** Schliesst ein Seitenblatt über seinen eigenen Schliessen-Knopf (nicht über die Kulisse). */
export async function blattSchliessen(blatt: HTMLElement | null): Promise<void> {
  const knopf = blatt?.querySelector<HTMLButtonElement>("div > button[aria-label]");
  await klick(knopf);
}
