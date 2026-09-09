import {
  type MemoryHistory,
  createMemoryHistory,
} from "../../apps/web/node_modules/@remix-run/router";
// ================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — DIE GEMEINSAME VORRICHTUNG.
// ================================================================================================
//
// Hier steht KEINE Erwartung und KEIN abgeschriebener Name. Diese Datei montiert die ECHTEN
// Bauteile (`pages/Admin`, `shell/CommandPalette`, `shell/ZahnradEintraege`) unter den echten
// Anbietern und liest gerenderten Text zurück; die Fälle wohnen in den `.test.tsx` daneben.
//
// DREI ENTSCHEIDUNGEN, damit die Messung misst, was sie behauptet:
//
//  1  DIE ÜBERSETZUNGEN SIND ECHT (`apps/web/src/i18n.ts` wird importiert, nicht gemockt). Ein Test
//     mit Attrappentexten prüfte seine eigene Attrappe (Regelwerk §7).
//
//  2  DER ROUTER BEKOMMT EINEN ECHTEN VERLAUF (`createMemoryHistory`), nicht `MemoryRouter`. Nur so
//     gibt es einen Zurück-Knopf: `history.go(-1)` ist der Browser-Zurück dieses Prüfstands. Mit
//     `MemoryRouter` ließe sich Kante (d) des Auftrags — „Zurück/Vorwärts/Reload bleiben im Detail"
//     — gar nicht messen, sondern nur behaupten.
//
//     NICHT `createMemoryRouter`: der Datenrouter baut für jede Navigation ein `Request`-Objekt und
//     stößt sich dabei an der `AbortSignal`-Klasse von jsdom („Expected signal to be an instance of
//     AbortSignal"). Gemessen in dieser Runde — 16 Fehler, drei rote Fälle, alle aus dieser einen
//     Wurzel. Der Verlaufsrouter unten ist genau die Bauform, die `unstable_HistoryRouter` in
//     react-router selbst hat, und er kommt ohne `Request` aus.
//
//  3  ES GIBT KEIN NETZ. `fetch` wird abgewiesen, statt Endpunkte einzeln zu mocken. Das ist der
//      EHRLICHERE Prüfstand für eine Navigationsmessung: die Wege müssen auch dann tragen, wenn
//     kein einziger Wert abrufbar ist (REGELN §7 — die Fläche behält Karte, Stufe und Herkunft).
//     Die ANMELDUNG ist die eine Ausnahme; sie wird je Testdatei gemockt, weil `vi.mock` am
//     Modulgraphen der Testdatei hängt.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import {
  type ReactNode,
  act,
  createElement,
  useLayoutEffect,
  useState,
} from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Route, Router, Routes, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Stand {
  container: HTMLDivElement;
  root: Root;
  verlaufsspeicher: MemoryHistory;
}

/** Der Schalter „Erweiterte Module" wohnt im localStorage (`lib/stufe2Storage.ts`). */
export function setzeStufe2(an: boolean): void {
  window.localStorage.setItem("kw.stufe2.v1", an ? "1" : "0");
}

/** Ein aufgezeichneter Ruf ans Netz — Grundlage für die Zusage „hier wurde NICHTS geschrieben". */
export interface Netzruf {
  pfad: string;
  methode: string;
}

/** Das Protokoll aller Rufe seit dem Aufbau des Prüfstands. */
export interface Netzprotokoll {
  rufe: Netzruf[];
  /** Alles außer GET — also jeder Ruf, der etwas verändern könnte. */
  schreibend: () => Netzruf[];
}

/**
 * Kein echtes Netz.
 *
 * OHNE `antworten` scheitert jede Abfrage sofort und ehrlich, statt in einen Zeitablauf zu laufen —
 * das ist der strengere Prüfstand für eine NAVIGATIONSmessung: die Wege müssen auch dann tragen,
 * wenn kein einziger Wert abrufbar ist (REGELN §7).
 *
 * MIT `antworten` beantwortet der Prüfstand genau die genannten GET-Pfade (`/api/users` usw.) und
 * lässt alles Übrige weiterhin scheitern. Das braucht der Fall, der eine NUTZERKARTE öffnet: ohne
 * Bestand gibt es keine Nutzerzeile, und ein Fall, der nur die Rollenkarte anklickt, beweist die
 * Nutzerkarte nicht (Codex, Runde 2, Befund 8).
 *
 * Zurück kommt das Protokoll: JEDER Ruf wird mitgeschrieben, auch die gescheiterten. Damit lässt
 * sich „während des Sprachwechsels wurde nichts gespeichert" MESSEN statt behaupten.
 */
export function ohneNetz(antworten: Record<string, unknown> = {}): Netzprotokoll {
  const rufe: Netzruf[] = [];
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: async (eingabe: unknown, init?: { method?: string }) => {
      const pfad = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      rufe.push({ pfad, methode });
      const antwort = methode === "GET" ? antworten[pfad] : undefined;
      if (antwort === undefined) {
        throw new Error(`kein Netz in diesem Prüfstand: ${methode} ${pfad}`);
      }
      // Genau die vier Felder, die `api/client.ts` liest — keine Attrappe eines ganzen `Response`.
      return {
        status: 200,
        ok: true,
        statusText: "OK",
        text: async () => JSON.stringify(antwort),
      };
    },
  });
  return { rufe, schreibend: () => rufe.filter((r) => r.methode !== "GET") };
}

/** Zeigt den aktuellen Pfad samt Query — damit ein Fall den Ort belegen kann, statt ihn zu glauben. */
function Ortsanzeige(): JSX.Element {
  const ort = useLocation();
  return createElement(
    "div",
    { "data-testid": "ort", "data-anker": ort.hash },
    `${ort.pathname}${ort.search}`,
  );
}

function Seitenweiche(): JSX.Element {
  return createElement(
    Routes,
    null,
    createElement(Route, { path: "/admin", element: createElement(Admin) }),
    createElement(Route, {
      path: "*",
      element: createElement("div", { "data-testid": "fremde-seite" }),
    }),
  );
}

function Rahmen({ kinder }: { kinder?: ReactNode }): JSX.Element {
  return createElement(
    AuthProvider,
    null,
    createElement(
      RoleProvider,
      null,
      createElement(
        ToastProvider,
        null,
        createElement(
          ImageDescribeProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(Ortsanzeige),
            kinder ?? null,
            createElement(Seitenweiche),
          ),
        ),
      ),
    ),
  );
}

/**
 * Montiert die Anwendungshülle an `pfad`. `kinder` sind zusätzliche Bauteile im selben Baum (etwa
 * die Schnellnavigation oder die Zahnrad-Einträge) — EINE Instanz, EIN RoleProvider, EINE i18n.
 */
/** Die Bauform von `unstable_HistoryRouter`: der Verlauf treibt, React folgt. */
function VerlaufsRouter({
  verlaufsspeicher,
  children,
}: {
  verlaufsspeicher: MemoryHistory;
  children?: ReactNode;
}): JSX.Element {
  const [zustand, setZustand] = useState({
    action: verlaufsspeicher.action,
    location: verlaufsspeicher.location,
  });
  useLayoutEffect(() => verlaufsspeicher.listen(setZustand), [verlaufsspeicher]);
  return createElement(Router, {
    location: zustand.location,
    navigationType: zustand.action,
    navigator: verlaufsspeicher,
    children,
  });
}

export function montiere(pfad: string, kinder?: ReactNode): Stand {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // `v5Compat: true` ist hier keine Zierde: OHNE dieses Flag meldet `push`/`replace` KEINEM
  // Zuhörer etwas (`@remix-run/router/dist/router.cjs.js:170,182` — `if (v5Compat && listener)`).
  // Der Baum wäre dann bei jeder Navigation stehengeblieben, und die Fälle unten hätten „die Zeile
  // öffnet keine Karte" gemeldet, wo die Fläche in Ordnung ist. Genau so gemessen in dieser Runde.
  const verlaufsspeicher = createMemoryHistory({
    initialEntries: [pfad],
    initialIndex: 0,
    v5Compat: true,
  });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(VerlaufsRouter, { verlaufsspeicher }, createElement(Rahmen, { kinder })),
      ),
    );
  });
  return { container, root, verlaufsspeicher };
}

export function abbauen(stand: Stand): void {
  act(() => {
    stand.root.unmount();
  });
  stand.container.remove();
}

/** Die Sitzung (`/auth/me`) und die gescheiterten Abfragen zur Ruhe kommen lassen. */
export async function beruhige(runden = 20): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Einen Klick auslösen und die Folge abwarten. */
export async function klicke(el: Element | null | undefined): Promise<void> {
  if (!el) {
    throw new Error("Element zum Klicken nicht gefunden.");
  }
  await act(async () => {
    (el as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(3);
}

/**
 * Eine Eingabe in ein gesteuertes Feld — über den NATIVEN Setter, sonst sieht React sie nicht.
 *
 * (React hängt an `value` einen eigenen Setter; wer nur `el.value = …` schreibt, ändert das DOM,
 * ohne dass der Zustand davon erfährt — der Test fühlte sich richtig an und misst nichts.)
 */
export async function tippe(feld: Element | null | undefined, wert: string): Promise<void> {
  if (!(feld instanceof window.HTMLInputElement)) {
    throw new Error("Eingabefeld nicht gefunden.");
  }
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(2);
}

/** Das Eingabefeld hinter einer `Field`-Beschriftung (ui.tsx: <label><span>Text</span><input/></label>). */
export function feldMitBeschriftung(stand: Stand, beschriftung: string): HTMLInputElement | null {
  const label = [...stand.container.querySelectorAll("label")].find(
    (l) => l.querySelector("span")?.textContent?.trim() === beschriftung,
  );
  return label?.querySelector("input") ?? null;
}

/** Einen Verlaufsschritt gehen (Browser Zurück/Vorwärts) und die Folge abwarten. */
export async function verlauf(stand: Stand, schritte: number): Promise<void> {
  await act(async () => {
    stand.verlaufsspeicher.go(schritte);
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(3);
}

/** Ein Neuladen: dieselbe Adresse, ein frisch gebauter Baum — kein Zustand überlebt im Speicher. */
export function neuLaden(stand: Stand, kinder?: ReactNode): Stand {
  const adresse = `${stand.verlaufsspeicher.location.pathname}${stand.verlaufsspeicher.location.search}`;
  abbauen(stand);
  return montiere(adresse, kinder);
}

/** Der Ort, den die Anwendung gerade WIRKLICH einnimmt. */
export function ort(stand: Stand): string {
  return stand.container.querySelector('[data-testid="ort"]')?.textContent ?? "";
}

/**
 * Derselbe Ort, aber MIT Anker — der ganze Weg, so wie ihn ein Ziel verspricht.
 *
 * JOB 3337 R6: `ort()` lässt den Anker weg, und für die allermeisten Fälle ist das genau richtig
 * (sie prüfen Reiter und Detail, beides steht in der Query). Zwei Ziele des Direktzugangs tragen
 * ihren Anker aber IM Weg — „Audit-Log (in Analytics)" auf `/analytics#analytics-audit` und die
 * Beispielpakete auf `/import#demopakete`. Wer diese Ziele misst, verglich mit `ort()` eine
 * gekürzte Adresse gegen einen vollständigen Anspruch und bekam einen Fehlschlag, an dem das
 * Produkt unschuldig war. Deshalb ein ZWEITER Griff statt einer Änderung an `ort()`: die
 * bestehenden Fälle messen unverändert weiter, und wer den Anker braucht, sagt es.
 */
export function ortMitAnker(stand: Stand): string {
  const anzeige = stand.container.querySelector('[data-testid="ort"]');
  return `${anzeige?.textContent ?? ""}${anzeige?.getAttribute("data-anker") ?? ""}`;
}

/** Die Beschriftungen der Themenspalte (`data-einst="reiter"`), in Bildreihenfolge. */
export function reiterNamen(stand: Stand): string[] {
  return [...stand.container.querySelectorAll('[data-einst="reiter"]')].map((b) =>
    (b.textContent ?? "").trim(),
  );
}

/** Der Name des aktuell ausgezeichneten Themas — die Vorlage verlangt ihn sichtbar markiert. */
export function aktivesThema(stand: Stand): string {
  return (
    stand.container
      .querySelector('[data-einst="reiter"][aria-pressed="true"]')
      ?.textContent?.trim() ?? ""
  );
}

/** Die Sprache umstellen und neu zeichnen lassen — ohne Neumontage, wie im echten Sprachschalter. */
export async function sprache(lng: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(lng);
    await new Promise((r) => setTimeout(r, 0));
  });
  await beruhige(3);
}
