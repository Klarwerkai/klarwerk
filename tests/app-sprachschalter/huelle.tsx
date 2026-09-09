// ================================================================================================
// JOB 3323 · APP-SPRACHSCHALTER — DIE GEMEINSAME MONTAGE DER ECHTEN HÜLLE.
// ================================================================================================
//
// Beide Testdateien dieses Auftrags brauchen dasselbe: die ECHTE `AppShell` mit der ECHTEN
// Providerkette aus `App.tsx`, eine ECHTE Seite darin, und die echte Route in der Adresse. Der
// Baustein steht deshalb einmal hier und nicht zweimal dort — sonst prüften zwei Dateien zwei
// verschiedene Hüllen und niemand merkte es.
//
// Diese Datei ist BEWUSST KEINE `.test.tsx`: Vitest sammelt nur `*.test.{ts,tsx}`, ein Helfer ohne
// Fälle würde sonst als leere Testdatei rot.
//
// KEIN `vi.mock` HIER. Mocks werden pro Testdatei gehoben und gelten für deren ganze Modulkette —
// der Helfer erbt sie also, ohne sie zu besitzen. Stünden sie hier, könnte eine Testdatei ihre
// eigene Grenze nicht mehr verstellen.
import type { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
import { QueryClientProvider } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { AppShell } from "../../apps/web/src/shell/AppShell";

/** Ein paar Makrotask-Runden, damit react-query und Suspense wirklich fertig werden. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

/**
 * Die Breitenfrage der Hülle (`shell/useMediaQuery.ts`, NARROW_QUERY „(max-width: 899px)").
 * jsdom rechnet kein Layout, aber `matchMedia` lässt sich deterministisch stellen — genau so misst
 * das Haus die schmale Darstellung schon in `tests/app/mega47-*`.
 */
export function breite(px: number): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: px <= 899,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

export interface Montage {
  container: HTMLDivElement;
  abbauen: () => void;
}

/**
 * Die echte Hülle auf einer echten Route, mit der echten Seite als Inhalt — dieselbe
 * Providerreihenfolge wie `apps/web/src/App.tsx` (Auth → Role → Toast → NavGuard → Router → Shell).
 */
export async function montiere(route: string, seite: unknown, qc: QueryClient): Promise<Montage> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
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
                  createElement(AppShell, null, seite as never),
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
  return {
    container,
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Ein Klick, wie ihn ein Mensch auslöst — mit anschließendem Durchlauf der Warteschlangen. */
export async function klick(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Klickziel fehlt");
  }
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    await flush();
  });
}

/**
 * Der Konto-Kreis im Kopfband — der Weg zum Sprachschalter auf jeder angemeldeten Seite.
 *
 * Der Kreis SCHALTET UM (`menue.umschalten`). Steht das Menü schon offen — und es bleibt nach einem
 * Sprachwechsel offen, weil der Wechsel nichts schließt —, würde ein zweiter Klick es zuklappen.
 * Deshalb wird hier geprüft statt geklickt.
 */
export async function kontoMenueOeffnen(container: HTMLElement): Promise<void> {
  if (container.querySelector('[data-testid="konto-menue"]')) {
    return;
  }
  await klick(container.querySelector('[data-testid="kopfband-konto"]'));
}

/** Die drei Sprachknöpfe, in DOM-Reihenfolge. */
export function sprachKnoepfe(container: HTMLElement): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>('[data-testid="sprach-schalter"] button'),
  ];
}

/**
 * In die Schreibfläche des Erfassen-Blattes schreiben (JOB 3323 R2).
 *
 * Der Editor ist ein unkontrolliertes `contentEditable` (`components/RichTextEditor.tsx`); sein
 * `emit()` hängt an `onInput` (:887) und meldet den Stand nach oben an `Blatt.tsx`. Deshalb wird
 * hier wirklich das DOM beschrieben und ein `input` ausgelöst — einen Zustandseingang gibt es an
 * dieser Fläche nicht, und ein direkt gesetztes `innerHTML` ohne Ereignis käme im Blatt nie an.
 *
 * Steht EINMAL hier und nicht in jeder Testdatei: zwei Fassungen desselben Griffs liefen beim
 * nächsten Umbau des Editors auseinander, und eine davon prüfte dann nichts mehr.
 */
export async function schreibeInRumpf(c: HTMLElement, text: string): Promise<void> {
  const feld = c.querySelector<HTMLElement>('[data-testid="blatt-text"] [role="textbox"]');
  if (!feld) {
    throw new Error("Schreibfläche des Blattes fehlt");
  }
  await act(async () => {
    feld.innerHTML = `<p>${text}</p>`;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Der Knopf einer Sprache — über die Kennung, nicht über den sichtbaren Text. */
export function sprachKnopf(container: HTMLElement, sprache: string): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>(
    `[data-testid="sprach-schalter-${sprache}"]`,
  );
  if (!btn) {
    throw new Error(`Sprachknopf „${sprache}" nicht gefunden`);
  }
  return btn;
}
