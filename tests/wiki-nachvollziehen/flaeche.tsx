// ================================================================================================
// JOB 4213 · DIE EINE VORRICHTUNG FÜR DIE GEMOUNTETEN FÄLLE DIESES AUFTRAGS.
// ================================================================================================
//
// BAUFORM ÜBERNOMMEN aus `tests/ux28-fassungen/flaeche.tsx` (JOB 3475): echte `useQuery`-Abrufe
// gegen einen echten `QueryClient`, nur das „Netz" darunter (`./netz.ts`) ist ein Doppel. Gemountet
// wird `MehrAbschnitte` mit den Anbietern, die die Lesefläche darum legt — der Abschnitt
// „Schnappschüsse" ist der Gegenstand, und das Markup stammt aus der echten Fläche.
//
// WAS DIESE VORRICHTUNG MESSEN KANN UND WAS NICHT — wörtlich dieselbe Grenze wie dort, und sie wird
// hier nicht grösser behauptet: jsdom kennt KEINE Tabulator-Taste und setzt die Eingabetaste NICHT
// in ein Klick-Ereignis um. Gemessen wird deshalb die Tabulator-Reihenfolge als Menge der
// fokussierbaren Elemente in DOM-Reihenfolge, der Fokus über `document.activeElement` und die
// AUSLÖSUNG über das Klick-Ereignis (das ein Browser an einem nativen `<button>` aus Eingabe- UND
// Leertaste erzeugt). Über die Taste selbst behauptet keine Zeile dieses Ordners etwas.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { MehrAbschnitte } from "../../apps/web/src/components/bibliothek/MehrAbschnitte";
import i18n from "../../apps/web/src/i18n";
import { ko } from "./netz";

export const FASSUNGEN = "schnappschuesse";
export const HISTORIE = "historie";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let montiert = false;

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche aufbauen und einen Abschnitt öffnen — den, um den es im jeweiligen Fall geht. */
export async function flaecheMit(
  abschnittSchluessel: string = FASSUNGEN,
  stand: Partial<KnowledgeObject> = {},
  sprache = "de",
): Promise<void> {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = () => {};
  // DIE SPRACHE IST EIN PARAMETER, keine feste Vorgabe: der Fall „auf Englisch steht dort Englisch"
  // stellt sie selbst — eine Vorrichtung, die hier bedingungslos auf „de" zurückstellte, machte
  // seinen Nachweis unmöglich und wäre trotzdem grün gewesen.
  await i18n.changeLanguage(sprache);
  qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  montiert = true;
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
                  createElement(MehrAbschnitte, { ko: ko(stand) }),
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
  await abschnittOeffnen(abschnittSchluessel);
}

export function abbauen(): void {
  if (!montiert) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  qc.clear();
  montiert = false;
}

export const abschnitt = (schluessel: string = FASSUNGEN): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);

export const text = (e: Element | null): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();

export async function abschnittOeffnen(schluessel: string = FASSUNGEN): Promise<void> {
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt auf der Fläche`);
  }
  await act(async () => {
    d.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

/** Das Ereignis, das ein Browser an einem nativen `<button>` aus Maus, Eingabe- UND Leertaste erzeugt. */
export async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Eine Auswahl am nativen `<select>` treffen, so wie ein Browser sie meldet. */
export async function waehlen(feld: HTMLSelectElement, wert: string): Promise<void> {
  await act(async () => {
    feld.value = wert;
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function eines(selektor: string, was: string): HTMLElement {
  const treffer = abschnitt()?.querySelector<HTMLElement>(selektor) ?? null;
  if (!treffer) {
    throw new Error(`${was} fehlt auf der Fläche (${selektor})`);
  }
  return treffer;
}

export const fassungsKnopf = (version: number): HTMLButtonElement =>
  eines(
    `[data-bib-fassung="ko-1:${version}"]`,
    `der Aufklapper der Fassung v${version}`,
  ) as HTMLButtonElement;

export const fassungsInhalt = (version: number): HTMLElement | null =>
  abschnitt()?.querySelector<HTMLElement>(`[data-bib-fassung-inhalt="ko-1:${version}"]`) ?? null;

export const uebernahmeKnopf = (version: number): HTMLButtonElement =>
  eines(
    `[data-bib-fassung-uebernehmen="ko-1:${version}"]`,
    `der Übernahmeknopf der Fassung v${version}`,
  ) as HTMLButtonElement;

export const uebernahmeKnopfOderNull = (version: number): HTMLButtonElement | null => {
  const e =
    abschnitt()?.querySelector<HTMLElement>(`[data-bib-fassung-uebernehmen="ko-1:${version}"]`) ??
    null;
  return e instanceof HTMLButtonElement ? e : null;
};

export const erneutKnopf = (version: number): HTMLButtonElement | null => {
  const e =
    abschnitt()?.querySelector<HTMLElement>(
      `[data-bib-fassung-uebernehmen-erneut="ko-1:${version}"]`,
    ) ?? null;
  return e instanceof HTMLButtonElement ? e : null;
};

export const uebernahmeLage = (version: number): HTMLElement | null =>
  abschnitt()?.querySelector<HTMLElement>(`[data-bib-fassung-uebernahme-lage="ko-1:${version}"]`) ??
  null;

export const vergleichsFlaeche = (): HTMLElement | null =>
  abschnitt()?.querySelector<HTMLElement>("[data-bib-fassung-vergleich-flaeche]") ?? null;

export const vergleichsWahl = (welche: "von" | "bis"): HTMLSelectElement =>
  eines(
    `[data-bib-fassung-vergleich="${welche}"]`,
    `die Auswahl „${welche}" des Fassungsvergleichs`,
  ) as HTMLSelectElement;

export const vergleichsFeld = (feld: string): HTMLElement | null =>
  abschnitt()?.querySelector<HTMLElement>(`[data-bib-fassung-vergleich-feld="${feld}"]`) ?? null;

export const historienVermerk = (version: number): HTMLElement | null =>
  abschnitt(HISTORIE)?.querySelector<HTMLElement>(`[data-bib-historie-vermerk="${version}"]`) ??
  null;

export const fassungsVermerk = (version: number): HTMLElement | null =>
  abschnitt()?.querySelector<HTMLElement>(`[data-bib-fassung-vermerk="ko-1:${version}"]`) ?? null;

/**
 * Die Elemente, die ein Tabulator innerhalb des Abschnitts erreicht: in DOM-Reihenfolge, ohne die
 * ausgenommenen (`tabIndex < 0`) und ohne die echt gesperrten (`disabled` fällt aus der Folge).
 */
export function tabFolge(): HTMLElement[] {
  const d = abschnitt();
  if (!d) {
    return [];
  }
  return [
    ...d.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]',
    ),
  ].filter((e) => e.tabIndex >= 0 && !(e instanceof HTMLButtonElement && e.disabled));
}

export { i18n };
