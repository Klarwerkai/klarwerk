// ================================================================================================
// JOB 3834 · DIE BÜHNE — `/import` GEMOUNTET, MIT DER ECHTEN SEITENHILFE-SAMMELSTELLE.
// ================================================================================================
//
// WAS DIESE DATEI IST: nur die Bühne. Sie behauptet nichts und misst nichts; jede Aussage steht in
// `naechster-schritt-ist-zugeklappt.test.tsx`.
//
// WAS ECHT IST: `ImportReview` aus `pages/Stufe2.tsx`, das echte Wörterbuch (`i18n.ts`), ein echter
// `QueryClient`, der echte Router und — dafür steht diese Datei — der echte
// `SeitenhilfeProvider` aus `shell/SeitenhilfeContext.tsx`. Attrappe ist allein die
// Endpunktgrenze (`bestand.ts`); die Anmeldemaske kommt über die `vi.mock`-Zeilen der Testdatei.
//
// WARUM DER ECHTE ANBIETER UND KEINE EIGENE SAMMELSTELLE: `HelpTip` rendert nichts (JOB 3060) und
// meldet Titel und Text bei der Seitenhilfe an. Ausserhalb eines Anbieters landet die Anmeldung bei
// einem STUMMEN Sammler (`SeitenhilfeContext.tsx:37`) — ein Fall gegen eine selbstgebaute
// Sammelstelle wäre falsches Grün. Die `HilfeSonde` unten liest deshalb mit dem echten Haken
// `useSeitenhilfe()` und schreibt jede Anmeldung als Attribut ins DOM; gelesen wird, was die Seite
// wirklich angemeldet hat.
//
// WAS DIESE BÜHNE NICHT KANN: kein Browser, kein Layout, kein echtes HTTP, keine Persistenz. Sie
// fährt genau EINEN Abruf (den Bestand aus `bestand.ts`) und keine zweite Auffrischung — Cache,
// laufende oder gescheiterte Auffrischung und Offline sind hier ausdrücklich UNGEMESSEN.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { SeitenhilfeProvider, useSeitenhilfe } from "../../apps/web/src/shell/SeitenhilfeContext";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
// Die Seite misst ihre Fläche (ResizeObserver) und fragt die Fensterbreite (matchMedia) — jsdom
// kennt beides nicht. Beide Attrappen sind ruhig: sie melden nie.
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
(globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
  ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;

/** Die Route, um die es geht. Sie steht hier einmal und wird in jede Fehlermeldung gehängt. */
export const ROUTE = "/import";

/** Die Kennung des Kastens, in dem die Prüfliste liegt (`components/ImportHistory.tsx:26`). */
export const KASTEN_WAHL = "details#import-review-queue";

export const SPRACHEN = ["de", "en", "nl"] as const;
export type Sprache = (typeof SPRACHEN)[number];

/** Der hinterlegte Wert EINER Sprache, AM SCHLÜSSEL und ohne Rückfall auf Deutsch. */
export function wert(lng: Sprache, key: string): string {
  return String(i18n.getResource(lng, "translation", key) ?? "");
}

/**
 * Verstellt einen Wörterbuchwert für die Dauer einer Herkunftsprobe. Rückgabe: die Rücknahme.
 * Damit wird gemessen, welcher SCHLÜSSEL einen gezeichneten Text speist — nicht, welche Wörter
 * darin stehen (Lehre 3798 R1, Literalbefund aus JOB 3832).
 */
export function verstelleWert(lng: Sprache, key: string, neu: string): () => void {
  const vorher = wert(lng, key);
  // `addResourceBundle` mit deep+overwrite und NICHT `addResource`: das Wörterbuch hält FLACHE
  // Schlüssel mit Punkten (`"imp.history.hint"`), und `addResource` würde den Punkt als Pfad lesen
  // und daneben eine verschachtelte Struktur anlegen. Hier wird genau der flache Schlüssel ersetzt.
  i18n.addResourceBundle(lng, "translation", { [key]: neu }, true, true);
  return () => {
    i18n.addResourceBundle(lng, "translation", { [key]: vorher }, true, true);
  };
}

export async function setzeSprache(lng: Sprache): Promise<void> {
  await i18n.changeLanguage(lng);
}

/** Eine angemeldete Seitenhilfe, so wie die Sonde sie aus dem echten Sammler gelesen hat. */
export interface Anmeldung {
  titel: string;
  text: string;
}

/** Liest den echten Seitenhilfe-Sammler und schreibt jede Anmeldung als Attribut ins DOM. */
function HilfeSonde(): ReactElement {
  const eintraege = useSeitenhilfe();
  return createElement(
    "div",
    { "data-testid": "hilfe-sonde" },
    eintraege.map((e) =>
      createElement("div", {
        key: e.id,
        "data-testid": "hilfe-anmeldung",
        "data-titel": e.title,
        "data-text": e.body,
      }),
    ),
  );
}

let behaelterKnoten: HTMLDivElement | null = null;
let wurzel: ReturnType<typeof createRoot> | null = null;

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Der gemountete Baum. Wirft, statt still `null` zu liefern — eine leere Messung wäre trivial grün. */
export function behaelter(): HTMLElement {
  if (behaelterKnoten === null) {
    throw new Error("die Bühne steht nicht — montiereImport() wurde nicht gefahren");
  }
  return behaelterKnoten;
}

export function abbauen(): void {
  const k = behaelterKnoten;
  const w = wurzel;
  behaelterKnoten = null;
  wurzel = null;
  if (k === null || w === null) {
    return;
  }
  act(() => w.unmount());
  k.remove();
}

/** Die ECHTE Import-Seite unter `/import`, mit den Anbietern, die sie braucht. */
export async function montiereImport(): Promise<void> {
  abbauen();
  const k = document.createElement("div");
  document.body.appendChild(k);
  const w = createRoot(k);
  behaelterKnoten = k;
  wurzel = w;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    w.render(
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
                  SeitenhilfeProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: [ROUTE] },
                    createElement(
                      "div",
                      null,
                      createElement(ImportReview),
                      createElement(HilfeSonde),
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
  // Zwei weitere Durchläufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
}

export function alle(testid: string): Element[] {
  return [...behaelter().querySelectorAll(`[data-testid="${testid}"]`)];
}

/** Der Kasten `details#import-review-queue`, so wie die Seite ihn gezeichnet hat. */
export function kasten(): HTMLDetailsElement | null {
  return behaelter().querySelector<HTMLDetailsElement>(KASTEN_WAHL);
}

/** Klappt den Kasten von Hand auf — genau der Klick, den die Seitenhilfe nicht nennt. */
export async function oeffneKasten(): Promise<void> {
  const k = kasten();
  if (k === null) {
    throw new Error(`${KASTEN_WAHL} steht nicht auf der gemounteten Seite ${ROUTE}`);
  }
  await act(async () => {
    k.open = true;
    await flush();
  });
  await act(flush);
}

/** Die Karten der Prüfliste, WIE SIE GEZEICHNET SIND (`Stufe2.tsx:774`, `imp-kandidat-titel`). */
export function kandidatenkarten(): Element[] {
  return alle("imp-kandidat-titel");
}

export function kandidatentitel(): string[] {
  return kandidatenkarten().map((e) => (e.textContent ?? "").trim());
}

/** Jede Seitenhilfe, die die gemountete Seite beim echten Sammler angemeldet hat. */
export function hilfeAnmeldungen(): Anmeldung[] {
  return alle("hilfe-anmeldung").map((e) => ({
    titel: e.getAttribute("data-titel") ?? "",
    text: e.getAttribute("data-text") ?? "",
  }));
}

/** Alle Knopfbeschriftungen UNTERHALB eines Knotens, gestrafft. */
export function knopfbeschriftungenIn(wurzel: Element): string[] {
  return [...wurzel.querySelectorAll("button")].map((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

/** Alle Knopfbeschriftungen der gezeichneten Seite, gestrafft. */
export function knopfbeschriftungen(): string[] {
  return knopfbeschriftungenIn(behaelter());
}

/**
 * DIE KARTE EINES EINZELNEN KANDIDATEN (Korrekturpflicht 1 aus Runde 1: eine seitenweite Anzahl
 * sagt nichts über die Verteilung auf die Karten).
 *
 * Gesucht ist der GRÖSSTE Vorfahr des Titelknotens, der noch genau EINEN Kandidatentitel trägt —
 * also der grösste Bereich, der nachweislich nur diesem Kandidaten gehört. Gemessen wird damit die
 * DOM-Verwandtschaft und nicht ein Klassenname oder eine neue Testkennung des Produkts; die Karte
 * (`Stufe2.tsx:694`, `<Card>`) trägt heute keine eigene Kennung, und eine dafür ins Produkt
 * einzuziehen wäre eine Änderung ausserhalb der Zielpfade.
 *
 * Wirft statt still auszuweichen, wenn der Titel fehlt oder wenn sich kein eigener Bereich abgrenzen
 * lässt (nur ein Kandidat auf der Seite) — dann wäre jede „kartenbezogene“ Aussage in Wahrheit eine
 * seitenweite, und genau das ist der Fehler, den diese Fassung ausschliesst.
 */
export function karteVonTitel(titel: string): HTMLElement {
  const alleTitel = kandidatenkarten();
  if (alleTitel.length < 2) {
    throw new Error(
      `Eine kartenbezogene Messung braucht mindestens zwei gezeichnete Kandidaten — sonst ist der „eigene Bereich“ eines Titels die ganze Seite. Gezeichnet: ${JSON.stringify(kandidatentitel())}`,
    );
  }
  const knoten = alleTitel.filter((e) => gestrafft(e) === titel);
  if (knoten.length !== 1) {
    throw new Error(
      `„${titel}“ steht nicht genau einmal als Kandidatentitel auf ${ROUTE} (gefunden: ` +
        `${knoten.length}). Gezeichnete Titel: ${JSON.stringify(kandidatentitel())}`,
    );
  }
  const rand = behaelter();
  let bereich = knoten[0] as HTMLElement;
  for (let auf = bereich.parentElement; auf !== null && auf !== rand; auf = auf.parentElement) {
    if (auf.querySelectorAll('[data-testid="imp-kandidat-titel"]').length !== 1) {
      break;
    }
    bereich = auf;
  }
  if (bereich === knoten[0]) {
    throw new Error(
      `Um „${titel}“ lässt sich keine eigene Karte abgrenzen: schon der Elternknoten trägt einen zweiten Kandidatentitel. Eine kartenbezogene Messung ist hier nicht zu haben.`,
    );
  }
  return bereich;
}

/** Der gezeichnete Text eines Knotens, gestrafft — für die Diagnose einer roten Messung. */
export function gestrafft(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}
