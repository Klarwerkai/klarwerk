// @vitest-environment jsdom
// AUFTRAG-mega14 Block B (bens SB-2, mein O-3 aus mega13): Die Mobil-Erfassung meldete sich am
// In-App-Wächter an (`Mobile.tsx:149-174`), hatte aber keinen `beforeunload`-Schutz. Der In-App-
// Wächter sieht nur SPA-Navigation; Neuladen, Tab-Schließen und ein Dokumentwechsel liefen still
// an ihm vorbei und nahmen die begonnene Eingabe mit.
//
// bens Einordnung, die ich teile: „Das ist kein Komfortthema, sondern derselbe Datenverlusttyp, den
// der History-Waechter fuer SPA-Navigation gerade schliessen soll."
//
// Dieser Test ist der ECHTE beforeunload-Beleg — kein Nachweis, dass der Hook aufgerufen wird,
// sondern ein am Fenster abgefeuertes Ereignis, dessen Abbruch geprüft wird. Er pinnt beide Ränder
// (sauber = keine Warnung, befüllt = Warnung) und das Abhängen, damit der Handler nicht leckt.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    library: { search: vi.fn(async () => []) },
    ask: { ask: vi.fn(async () => ({ answered: false })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Idempotent und in afterEach garantiert: eine fehlgeschlagene Erwartung darf die Seite nicht
// montiert zurücklassen, sonst überlebt ihr Handler am globalen `window` und verfälscht den
// nächsten Fall.
let mounted = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mounted = true;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/mobile"] },
              createElement(
                Routes,
                null,
                createElement(Route, { path: "/mobile", element: createElement(Mobile) }),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function unmount(): void {
  if (!mounted) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  mounted = false;
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

// Der eigentliche Beleg: ein echtes, abbrechbares `beforeunload` am Fenster. `defaultPrevented`
// ist genau das, woran der Browser entscheidet, ob er seinen Verlassen-Dialog zeigt.
function beforeUnloadBlocked(): boolean {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function fillStatement(text: string): Promise<void> {
  const box = container.querySelector("textarea");
  if (!(box instanceof HTMLTextAreaElement)) {
    throw new Error("Eingabefeld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(box) as object,
    "value",
  )?.set;
  setter?.call(box, text);
  await act(async () => {
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

describe("Block B: /mobile warnt vor Neuladen, Tab-Schließen und Dokumentwechsel", () => {
  it("leeres Formular warnt NICHT — die Warnung darf nicht dauernd im Weg stehen", async () => {
    await mount();
    expect(beforeUnloadBlocked(), "sauberes Formular hat gewarnt").toBe(false);
  });

  it("befüllte Eingabe → der Browser fragt vor dem Verlassen des Dokuments", async () => {
    await mount();
    expect(beforeUnloadBlocked()).toBe(false);

    await fillStatement("Nach dem Schichtwechsel den Dosierwert kontrollieren.");

    // Vor der Behebung war dies `false`: Neuladen/Tab-Schließen nahm die Eingabe still mit.
    expect(beforeUnloadBlocked(), "befüllte Mobil-Eingabe hat NICHT gewarnt").toBe(true);
  });

  it("dasselbe Dirty-Prädikat wie der In-App-Wächter — keine zweite Autorität", async () => {
    await mount();
    await fillStatement("Dosierwert kontrollieren.");
    expect(beforeUnloadBlocked()).toBe(true);

    // Der In-App-Wächter hält bei demselben Stand ebenfalls fest: dieselbe Quelle
    // (isDraftFormFillable), also können die beiden nicht auseinanderlaufen.
    await act(async () => {
      buttonByText(i18n.t("mob.tabLookup")).click();
      await flush();
    });
    expect(beforeUnloadBlocked(), "Tab-Wechsel innerhalb der Seite hat den Schutz verloren").toBe(
      true,
    );
  });

  it("wieder geleerte Eingabe warnt nicht mehr", async () => {
    await mount();
    await fillStatement("Etwas getippt.");
    expect(beforeUnloadBlocked()).toBe(true);

    await fillStatement("");

    expect(beforeUnloadBlocked(), "geleertes Formular warnt weiter").toBe(false);
  });

  it("nach dem Aushängen der Seite warnt nichts mehr (kein Handler-Leck)", async () => {
    await mount();
    await fillStatement("Etwas getippt.");
    expect(beforeUnloadBlocked()).toBe(true);

    unmount();

    expect(beforeUnloadBlocked(), "der Handler überlebt das Aushängen").toBe(false);
  });
});
