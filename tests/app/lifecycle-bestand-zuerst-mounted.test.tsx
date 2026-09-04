// @vitest-environment jsdom
// JOB 1112 D1 (D-035, Lebenszyklus-Anteil): auf /lebenszyklus steht der BESTAND vor dem FORMULAR.
//
// Belegt am ECHTEN Produktpfad (`apps/web/src/pages/Lifecycle.tsx`), gemountet — nicht am Quelltext.
// Die Zusage gilt in ALLEN drei Zuständen der Bestandsliste, weil ein Nutzer die Seite in jedem
// davon öffnen kann:
//   ladend  → QueryState zeigt „Lädt …"
//   leer    → QueryState zeigt „Nichts zur Re-Validierung."
//   beladen → die fälligen Objekte stehen als Karten da
// Gemessen wird die DOM-Reihenfolge (compareDocumentPosition), nicht die Quelltextzeile: ein
// Rücktausch der beiden Geschwisterblöcke macht jeden Fall dieser Datei rot.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// „channel"-Mock (Muster aus analytics-exec-loading-mounted): jeder queryFn-Aufruf erhält ein
// FRISCHES Promise, dessen Ausgang der Test über resolve() der zuletzt angeforderten Runde steuert.
// Nur so ist der LADENDE Zustand überhaupt beobachtbar — er ist sonst schon vorbei, wenn der
// erste Assert läuft.
const d = vi.hoisted(() => {
  const mk = () => {
    const state = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
    const fn = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          state.resolve = resolve;
          state.reject = reject;
        }),
    );
    return {
      fn,
      resolve: (v: unknown) => state.resolve(v),
      reject: (e: unknown) => state.reject(e),
    };
  };
  return { pending: mk(), kos: mk() };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      lifecycle: { pending: d.pending.fn, assetChanged: ok([]) },
      ko: { list: d.kos.fn, act: ok({}) },
      // JOB 3061 · H2: der gemeinsame Reiterkopf zaehlt alle vier Reiter aus echten Abrufen.
      // Kulisse wie der Lernpfad — sie darf die Messung nur nicht zerreissen.
      validation: { board: ok([]), overview: ok([]) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      // Der Lernpfad ist auf dieser Seite Kulisse: er steht unterhalb beider geprüfter Blöcke und
      // darf die Messung nicht mit einem eigenen Ladezustand stören.
      learningPaths: {
        byRole: ok(null),
        progress: ok([]),
        complete: ok({}),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import i18n from "../../apps/web/src/i18n";
import { Lifecycle } from "../../apps/web/src/pages/Lifecycle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
              MemoryRouter,
              { initialEntries: ["/lebenszyklus"] },
              createElement(Lifecycle),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

// JOB 3061 · H2 — DIE ABSCHNITTSÜBERSCHRIFTEN GIBT ES NICHT MEHR, DIE REIHENFOLGE SCHON.
//
// Der Reiter „Erneut" trägt keine `SectionLabel`-Überschriften mehr („Fällige Re-Validierung",
// „Anlagenänderung melden"); das Mockup zeigt links die Liste und darunter EINE aufklappbare
// Zeile. Die Zusage von D-035 — der BESTAND steht vor dem FORMULAR — ist davon unberührt und wird
// hier an den neuen Ankern gemessen. Sie ist sogar stärker geworden: das Eingabefeld liegt jetzt
// hinter einem Klick, der Bestand nicht.
function bestandsBlock(): Element {
  const el =
    container.querySelector('[data-testid="pruefen-warteschlange"]') ??
    container.querySelector('[data-testid="pruefen-platzhalter"]') ??
    container.querySelector('[data-testid="pruefen-satz-leer"]');
  if (!el) {
    throw new Error("Weder Liste noch Platzhalter noch Leersatz im DOM");
  }
  return el;
}

/** Die aufklappbare Zeile „Anlage geändert …" — der Ort des Melde-Formulars. */
function meldeZeile(): Element {
  const el = container.querySelector('[data-testid="pruefen-anlage"]');
  if (!el) {
    throw new Error("Melde-Zeile nicht im DOM");
  }
  return el;
}

// true, wenn `a` im DOM VOR `b` steht.
function stehtVor(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

// Das Melde-Formular selbst — nicht nur seine Überschrift. Das ist die eigentliche Zusage:
// der Nutzer sieht erst, was fällig ist, und trifft danach auf das Eingabefeld.
function meldeFeld(): Element {
  const feld = container.querySelector(`input[placeholder="${i18n.t("lcy.assetPlaceholder")}"]`);
  if (!feld) {
    throw new Error("Melde-Eingabefeld nicht im DOM");
  }
  return feld;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("D-035 Lebenszyklus: fällige Objekte stehen vor dem Meldeformular", () => {
  it("LADEND: die Bestandsliste lädt noch — und steht trotzdem vor dem Melde-Formular", async () => {
    await mount();
    // Die Abfrage ist bewusst NICHT aufgelöst → die Fläche zeigt ihre Platzhalterzeilen
    // (JOB 3061 §9: drei graue Zeilen statt eines Wortes „Lädt …").
    expect(container.querySelector('[data-testid="pruefen-platzhalter"]')).not.toBeNull();

    expect(stehtVor(bestandsBlock(), meldeZeile())).toBe(true);
    expect(stehtVor(bestandsBlock(), meldeFeld())).toBe(true);
  });

  it("LEER: nichts fällig — der Leerzustand steht vor dem Melde-Formular", async () => {
    await mount();
    await act(async () => {
      d.pending.resolve([]);
      d.kos.resolve([]);
      await flush();
    });
    expect(container.textContent).toContain(i18n.t("lcy.empty"));

    expect(stehtVor(bestandsBlock(), meldeZeile())).toBe(true);
    expect(stehtVor(bestandsBlock(), meldeFeld())).toBe(true);
  });

  it("BELADEN: das fällige Objekt selbst steht vor dem Melde-Formular", async () => {
    await mount();
    await act(async () => {
      d.pending.resolve(["k1"]);
      d.kos.resolve([
        {
          id: "k1",
          title: "Druckprüfung Kessel 7",
          status: "validiert",
          asset: "K-7",
        },
      ]);
      await flush();
    });

    // Das Objekt ist wirklich gerendert (nicht nur die Überschrift).
    const objekt = container.querySelector('a[href="/wissen/k1"]');
    expect(objekt).not.toBeNull();
    expect(objekt?.textContent).toBe("Druckprüfung Kessel 7");

    expect(stehtVor(bestandsBlock(), meldeZeile())).toBe(true);
    // Die kausale Zusage: das fällige OBJEKT steht vor dem Eingabefeld der Anlagenänderung.
    expect(stehtVor(bestandsBlock(), meldeFeld())).toBe(true);
    expect(objekt).not.toBeNull();
  });
});
