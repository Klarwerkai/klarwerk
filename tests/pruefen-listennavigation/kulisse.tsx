// ================================================================================================
// JOB 3504 · PRUEFEN-LISTENNAVIGATION — DIE PRÜFFLÄCHE MONTIEREN UND MIT RAD/TASTE BEDIENEN.
// ================================================================================================
//
// Helfer, keine Testdatei: sie heisst nicht `*.test.tsx` und läuft deshalb nicht selbst als Suite
// (`vitest.config.ts`). Jede Testdatei setzt ihre eigenen `vi.mock`-Zeilen (aus `kulisse-mocks.ts`)
// und benutzt von hier nur das Montieren, das Auslösen und das Ablesen — die AUSSAGEN bleiben in
// den Testdateien.
//
// Montiert wird in der BREITEN Lage (kein `matchMedia`-Stub, `useMediaQuery` liefert dann `false`):
// links die Warteschlange, rechts die Karte — genau die Lage, in der Pedi durch die Liste geht.
import { expect, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ValidationBoardKo } from "../../apps/web/src/api/types";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
// i18n VOR der Seite: initialisiert react-i18next global.
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Fn = ReturnType<typeof vi.fn>;

export const EINTRAG = '[data-testid="pruefen-warteschlange-eintrag"]';
export const KARTE = '[data-testid="pruefen-karte"]';

/**
 * Sechs Zeilen mit den Titeln A…F. `author === originalAuthor` und `trust: 0` bei allen, damit
 * `compareReviewPriority` (reviewSignals.ts:98) allein nach dem TITEL sortiert — die Reihenfolge in
 * der Fläche ist damit vorhersagbar. Gemessen wird trotzdem immer gegen die abgelesene DOM-Folge.
 */
export function zeilen(titel: readonly string[]): ValidationBoardKo[] {
  return titel.map(
    (title, i) =>
      ({
        id: `k${i + 1}`,
        title,
        statement: `Aussage ${title}`,
        conditions: [],
        measures: [],
        type: "best_practice",
        category: "Wartung",
        tags: [],
        confidence: 50,
        trust: 0,
        status: "offen",
        version: 1,
        originalAuthor: "u9",
        author: "u9",
        neededValidations: 3,
        assignments: [],
        reviewVotes: { up: 0, warn: 0, down: 0 },
        staleVotes: 0,
        asset: null,
        createdAt: "2026-08-12T00:00:00.000Z",
        history: [],
        confidentiality: null,
        confidentialityProvenance: "unknown",
        origin: null,
        originSources: [],
      }) as unknown as ValidationBoardKo,
  );
}

export interface Brett {
  container: HTMLDivElement;
  /** Jeder `scrollIntoView`-Aufruf der Fläche — jsdom kennt die Methode nicht von selbst. */
  springen: Fn;
  abbauen: () => void;
}

export async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

export async function mounteBrett(titel: readonly string[]): Promise<Brett> {
  await i18n.changeLanguage("de");
  (endpoints.validation.board as unknown as Fn).mockResolvedValue(zeilen(titel) as never);
  (endpoints.directory.list as unknown as Fn).mockResolvedValue([
    { id: "u9", name: "Erfasser" },
  ] as never);
  const springen = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: springen,
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(ModalBoundaryProvider, {
            hostRef: { current: container },
            children: createElement(Validation),
          }),
        ),
      ),
    );
  });
  for (let i = 0; i < 8 && container.querySelectorAll(KARTE).length === 0; i += 1) {
    await flush();
  }
  const brett: Brett = {
    container,
    springen,
    abbauen: () => {
      act(() => root.unmount());
      qc.clear();
      container.remove();
      if (originalScroll) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    },
  };
  expect(eintraege(brett), "die Warteschlange steht").toHaveLength(titel.length);
  springen.mockClear();
  return brett;
}

export function eintraege(b: Brett): HTMLButtonElement[] {
  return [...b.container.querySelectorAll<HTMLButtonElement>(EINTRAG)];
}

/** Der n-te Eintrag der Warteschlange — fehlt er, ist das ein Testfehler und keine Auslassung. */
export function eintrag(b: Brett, n: number): HTMLButtonElement {
  const el = eintraege(b)[n];
  expect(el, `der ${n + 1}. Eintrag der Warteschlange steht`).toBeTruthy();
  return el as HTMLButtonElement;
}

/** Der erste `scrollIntoView`-Aufruf der Fläche: worauf und mit welcher Einstellung. */
export function sprung(b: Brett, n = 0): { ziel: unknown; einstellung: unknown } {
  return { ziel: b.springen.mock.contexts[n], einstellung: b.springen.mock.calls[n]?.[0] };
}

/** Der Titel des Eintrags, den die Liste als gewählt ausweist (`aria-current="true"`). */
export function gewaehlterEintrag(b: Brett): string | null {
  const el = b.container.querySelector<HTMLElement>(`${EINTRAG}[aria-current="true"]`);
  return el ? (el.textContent ?? "").trim() : null;
}

/** Der Titel, der RECHTS auf der Karte steht — die Antwort, die der Mensch tatsächlich sieht. */
export function kartenTitel(b: Brett): string | null {
  const el = b.container.querySelector<HTMLElement>(`${KARTE} [data-text="titel"]`);
  return el ? (el.textContent ?? "").trim() : null;
}

/** Wie viele Karten rechts stehen — es darf immer genau eine sein. */
export function kartenZahl(b: Brett): number {
  return b.container.querySelectorAll(KARTE).length;
}

/**
 * Eine Taste drücken — auf GENAU dem Element, das sie gedrückt bekommt. Der zurückgegebene
 * Ereigniswert trägt `defaultPrevented`: daran misst sich, ob die Fläche die Taste verbraucht hat
 * (dann scrollt die Seite nicht mit) oder durchgelassen hat.
 */
export async function taste(
  el: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
): Promise<KeyboardEvent> {
  const ev = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  await act(async () => {
    el.dispatchEvent(ev);
  });
  await flush();
  return ev;
}

/** Ein Radschub über einem Element. `deltaY > 0` heisst „nach unten". */
export async function rad(el: HTMLElement, deltaY: number, deltaMode = 0): Promise<WheelEvent> {
  const ev = new WheelEvent("wheel", { deltaY, deltaMode, bubbles: true, cancelable: true });
  await act(async () => {
    el.dispatchEvent(ev);
  });
  await flush();
  return ev;
}

/** Ein Mausereignis, das NICHT klickt — für die Zusage „bloßes Überfahren wählt nichts aus". */
export async function maus(el: HTMLElement, typ: string): Promise<void> {
  const ev = new MouseEvent(typ, { bubbles: typ !== "mouseenter", cancelable: true });
  await act(async () => {
    el.dispatchEvent(ev);
  });
  await flush();
}

export async function klick(el: Element | null | undefined): Promise<void> {
  expect(el, "das Element, auf das geklickt werden sollte, gibt es nicht").toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
}
