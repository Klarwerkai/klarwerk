// ================================================================================================
// JOB 3475 · UX-28 — DIE EINE VORRICHTUNG FÜR DIE DREI GEMOUNTETEN FÄLLE.
// ================================================================================================
//
// WARUM EINE gemeinsame Vorrichtung und nicht dreimal derselbe Aufbau: die drei gemounteten Fälle
// (Tastaturweg, fehlender Inhalt, Rückweg) brauchen denselben Abschnitt mit denselben Fassungen.
// Stünde der Aufbau dreimal als Literal da, wären es über kurz oder lang drei verschiedene Flächen
// — dieselbe Begründung, mit der `AbschnittNachladen` (JOB 3430) zu EINER Bauform wurde.
//
// BAUFORM ÜBERNOMMEN aus `tests/q1c-nachladen/mehr-abschnitte-holen-nach.test.tsx` (JOB 3430):
// echte `useQuery`-Abrufe gegen einen echten `QueryClient`, nur das „Netz" darunter
// (`api/endpoints`) ist ein Doppel (`./netz.ts`). Gemountet wird `MehrAbschnitte` mit den Anbietern,
// die die Lesefläche darum legt — der Abschnitt „Schnappschüsse" ist der Gegenstand.
//
// WAS DIESE VORRICHTUNG MESSEN KANN UND WAS NICHT (Lehre LEHREN.md:1980, Korrekturpflicht Codex an
// JOB 3420 R2): jsdom kennt KEINE Tabulator-Taste und setzt die Eingabetaste NICHT in ein
// Klick-Ereignis um. Gemessen wird deshalb, was in jsdom wirklich messbar ist: die
// Tabulator-Reihenfolge als Menge der fokussierbaren Elemente in DOM-Reihenfolge, der Fokus über
// `document.activeElement` und die AUSLÖSUNG über das Klick-Ereignis (das ein Browser an einem
// nativen `<button>` aus Eingabe- UND Leertaste erzeugt). Keine Behauptung über die Taste selbst.
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
import { MehrAbschnitte } from "../../apps/web/src/components/bibliothek/MehrAbschnitte";
import i18n from "../../apps/web/src/i18n";
import { ko } from "./netz";

/** Der Abschnittsschlüssel — Sollwert als Literal, nicht aus dem Produkt geholt. */
export const FASSUNGEN = "schnappschuesse";
/** Die Marke der Fassungskarte, über die der Test sie findet — ebenfalls Sollwert. */
export const FASSUNG_MARKE = "data-bib-fassung";
/** Die Marke des geöffneten Inhalts einer Fassung. */
export const INHALT_MARKE = "data-bib-fassung-inhalt";
/** Die Marke des Rückwegs aus einer geöffneten Fassung. */
export const RUECKWEG_MARKE = "data-bib-fassung-zurueck";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche aufbauen und den Abschnitt „Schnappschüsse" öffnen — der Ort, um den es geht. */
export async function flaecheMitFassungen(): Promise<void> {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
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
                  createElement(MehrAbschnitte, { ko: ko() }),
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
  await abschnittOeffnen();
}

export function abbauen(): void {
  act(() => root.unmount());
  container.remove();
  qc.clear();
}

export const abschnitt = (): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${FASSUNGEN}"]`);

export const text = (e: Element | null): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Den Abschnitt von Hand aufklappen — der Weg, den ein Mensch am `<summary>` geht. */
export async function abschnittOeffnen(): Promise<void> {
  const d = abschnitt();
  if (!d) {
    throw new Error(`Abschnitt „${FASSUNGEN}" fehlt auf der Fläche`);
  }
  await act(async () => {
    d.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

/**
 * AUSLÖSEN — das Ereignis, das ein Browser an einem nativen `<button>` aus Maus, Eingabe- UND
 * Leertaste erzeugt. Was jsdom daran nicht leistet (die Umsetzung der Taste in dieses Ereignis),
 * behauptet kein Fall dieser Datei.
 */
export async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Die Fassungskarten des Abschnitts, in der Reihenfolge der Fläche. */
export function fassungsKnoepfe(): HTMLButtonElement[] {
  return [...(abschnitt()?.querySelectorAll<HTMLElement>(`[${FASSUNG_MARKE}]`) ?? [])].filter(
    (e): e is HTMLButtonElement => e instanceof HTMLButtonElement,
  );
}

/** Der Knopf EINER Fassung. Fehlt er, sagt der Fehler, was fehlt. */
export function fassungsKnopf(version: number): HTMLButtonElement {
  const marke = `ko-1:${version}`;
  const treffer = fassungsKnoepfe().find((k) => k.getAttribute(FASSUNG_MARKE) === marke);
  if (!treffer) {
    const gefunden = [
      ...(abschnitt()?.querySelectorAll<HTMLElement>(`[${FASSUNG_MARKE}]`) ?? []),
    ].map((e) => `${e.tagName}:${e.getAttribute(FASSUNG_MARKE)}`);
    throw new Error(
      `Die Fassung v${version} ist nicht als fokussierbarer Knopf erreichbar (${FASSUNG_MARKE}="${marke}"). Gefunden: ${JSON.stringify(gefunden)}`,
    );
  }
  return treffer;
}

/** Der geöffnete Inhalt einer Fassung — `null`, solange sie zu ist. */
export function fassungsInhalt(version: number): HTMLElement | null {
  return abschnitt()?.querySelector<HTMLElement>(`[${INHALT_MARKE}="ko-1:${version}"]`) ?? null;
}

/** Der Rückweg aus der geöffneten Fassung — `null`, solange sie zu ist. */
export function rueckweg(version: number): HTMLButtonElement | null {
  const treffer =
    abschnitt()?.querySelector<HTMLElement>(`[${RUECKWEG_MARKE}="ko-1:${version}"]`) ?? null;
  return treffer instanceof HTMLButtonElement ? treffer : null;
}

/**
 * Die Elemente, die ein Tabulator innerhalb des Abschnitts erreicht: in DOM-Reihenfolge, ohne die
 * ausgenommenen (`tabIndex < 0`) und ohne die echt gesperrten (`disabled` fällt aus der Folge).
 * Das ist die messbare Form der Frage „überspringt der Tabulator die Karten?".
 */
export function tabFolge(): HTMLElement[] {
  const d = abschnitt();
  if (!d) {
    return [];
  }
  const kandidaten = [
    ...d.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]',
    ),
  ];
  return kandidaten.filter(
    (e) => e.tabIndex >= 0 && !(e instanceof HTMLButtonElement && e.disabled),
  );
}

export { i18n };
