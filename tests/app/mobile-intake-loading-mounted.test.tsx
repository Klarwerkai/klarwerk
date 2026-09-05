// @vitest-environment jsdom
// ================================================================================================
// JOB 1118 · D-036 — MOBIL- UND INTAKE-ANSICHT SAGEN „LÄDT" STATT VOREILIG „NICHTS DA"
// ================================================================================================
//
// GEGENSTAND (Designkatalog Block 2, D-036). Zwei Flächen leiten eine Negativaussage aus fehlenden
// Daten ab: `Mobile.tsx` behauptet „keine Entwürfe" und „kein Treffer", während die tragenden
// Abfragen noch laufen; `KnowledgeIntake.tsx` rendert seinen Leerzustand, bevor der Bestand da ist.
// Der Unterschied zwischen „ich weiss es noch nicht" und „es gibt nichts" geht dabei verloren —
// und der Nutzer sieht die schlechtere der beiden Aussagen zuerst.
//
// WARUM DREI PHASEN UND NICHT ZWEI. Ein Ladezustand allein genuegt nicht: eine dauerhaft
// gescheiterte Abfrage haette dann unbegrenzt „laedt" gezeigt — das behauptet fortgesetzte Arbeit,
// die es nicht gibt. `lib/loadingState.ts` traegt dafuer bereits den Dreiphasenvertrag
// (`loading | loaded | error`), den Start und Analytics benutzen; diese beiden Flaechen ziehen
// nach. Pflicht 3 des Auftrags sagt es woertlich: Fehler und Laden werden nicht vermischt.
//
// GEMESSEN WIRD AM GEMOUNTETEN BAUM, NICHT AM QUELLTEXT. Jeder Fall faehrt die echte Seite und
// steuert den Ausgang der Abfrage ueber ein Promise, das der Test in der Hand behaelt — pending,
// resolve([]) und reject sind dadurch drei unterscheidbare, echte Laufzeitzustaende. Ein Test, der
// `Mobile.tsx` nach einer Zeichenkette durchsucht, bewiese nur, dass ein Wort im Code steht.
//
// DIE KALIBRIERUNG STEHT VOR JEDER ABWESENHEITSAUSSAGE: Block A1 haelt fest, dass die Seiten
// ueberhaupt rendern. Ohne ihn waere „keine Leerbehauptung sichtbar" auch bei einem leeren
// Container gruen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Kanal-Mock nach dem Muster von `analytics-exec-loading-mounted.test.tsx`: JEDER Aufruf der
// queryFn bekommt ein frisches Promise, dessen Ausgang der Test bestimmt.
const kanal = vi.hoisted(() => {
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
  return { drafts: mk(), search: mk(), kos: mk() };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      list: kanal.drafts.fn,
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    library: { search: kanal.search.fn },
    ko: { list: kanal.kos.fn, create: vi.fn(async () => ({ id: "k1" })) },
    ask: { ask: vi.fn(async () => ({ answered: false })) },
    conflicts: { list: vi.fn(async () => []) },
    // JOB 3062 · H3: `/erfassen/neu` rendert jetzt das gemeinsame Blatt. Das Blatt fragt über
    // `useAiBillable` → `useReasonerStatus` den Modellstatus ab, um den Kostenhinweis nur dann zu
    // zeigen, wenn ein Klick WIRKLICH kostet. Ohne diesen Kanal wäre `endpoints.reasoner`
    // undefined und das Mounten stürbe an `reading 'status'` — der Fehler wäre der Doppelgänger,
    // nicht die Fläche. `active: false` heißt: kein Modell, also kein Kostenhinweis; damit misst
    // dieser Test weiter genau seinen Gegenstand (Ladezustand des Intake), ohne neue Anzeige.
    reasoner: { status: vi.fn(async () => ({ active: false, mode: "aus" })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ComponentType, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeIntake } from "../../apps/web/src/pages/KnowledgeIntake";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(Seite: ComponentType, route: string): Promise<void> {
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
            ToastProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(MemoryRouter, { initialEntries: [route] }, createElement(Seite)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function text(): string {
  return container.textContent ?? "";
}

/** Auf einen der drei Mobile-Reiter wechseln — über den echten Knopf, nicht über internen State. */
async function reiter(label: string): Promise<void> {
  const knopf = [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === label,
  );
  if (!knopf) {
    throw new Error(`Reiter nicht gefunden: ${label}`);
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
}

const LAEDT = (): string => i18n.t("state.loading");
const FEHLER = (): string => i18n.t("state.error");
const KEINE_ENTWUERFE = (): string => i18n.t("mob.draftsEmpty");
const KEIN_TREFFER = (): string => i18n.t("mob.searchEmpty");

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

// ================================================================================================
// A1 · KALIBRIERUNG — die Flächen rendern überhaupt
// ================================================================================================
describe("JOB 1118 · D-036 · A1: beide Flächen mounten", () => {
  it("Mobile rendert den Erfassen-Reiter", async () => {
    await mount(Mobile, "/mobile");
    expect(text()).toContain(i18n.t("mob.tabCapture"));
    expect(text()).toContain(i18n.t("mob.drafts"));
  });

  // JOB 3062 · H3: `/erfassen/neu` zeigt kein eigenes Intake-Blatt mehr mit der Überschrift „Was
  // weißt du, das andere wissen sollten?" — die drei Erfassungsadressen zeigen DASSELBE Blatt
  // (`components/erfassen/Blatt.tsx`). Die Kalibrierung misst deshalb, dass die Fläche wirklich
  // rendert, an dem, was sie HEUTE trägt: Werkzeugzeile und Blatt.
  it("KnowledgeIntake rendert das Blatt", async () => {
    await mount(KnowledgeIntake, "/erfassen");
    expect(container.querySelector('[data-testid="blatt"]')).not.toBeNull();
    expect(text()).toContain(i18n.t("erfassen.werkzeug.diktieren"));
  });
});

// ================================================================================================
// A2 · MOBILE / ENTWÜRFE — „lädt" statt „keine Entwürfe"
// ================================================================================================
describe("JOB 1118 · D-036 · A2: die Entwurfsliste behauptet nichts, solange sie lädt", () => {
  it("LADEND: `Lädt …` steht da, `keine Entwürfe` NICHT", async () => {
    await mount(Mobile, "/mobile");

    expect(text()).toContain(LAEDT());
    expect(text()).not.toContain(KEINE_ENTWUERFE());
  });

  it("GELADEN UND LEER: der heutige Leertext steht exakt da, `Lädt …` nicht mehr", async () => {
    await mount(Mobile, "/mobile");
    await act(async () => {
      kanal.drafts.resolve([]);
      await flush();
    });

    expect(text()).toContain(KEINE_ENTWUERFE());
    expect(text()).not.toContain(LAEDT());
  });

  it("GELADEN MIT BESTAND: weder Leertext noch Ladehinweis", async () => {
    await mount(Mobile, "/mobile");
    await act(async () => {
      // Der Entwurfs-Umschlag traegt seine Eingaben unter `payload` (api/types.ts:523-535).
      kanal.drafts.resolve([{ id: "d1", payload: { title: "Dichtungsnorm", statement: "Text" } }]);
      await flush();
    });

    expect(text()).toContain("Dichtungsnorm");
    expect(text()).not.toContain(KEINE_ENTWUERFE());
    expect(text()).not.toContain(LAEDT());
  });

  it("FEHLER: ein ehrlicher Fehlertext — nicht `Lädt …` und nicht die Leerbehauptung", async () => {
    await mount(Mobile, "/mobile");
    await act(async () => {
      kanal.drafts.reject(new Error("kaputt"));
      await flush();
    });

    expect(text()).toContain(FEHLER());
    expect(text()).not.toContain(LAEDT());
    expect(text()).not.toContain(KEINE_ENTWUERFE());
  });
});

// ================================================================================================
// A3 · MOBILE / NACHSCHLAGEN — „lädt" statt „kein Treffer"
// ================================================================================================
describe("JOB 1118 · D-036 · A3: die Trefferliste behauptet nichts, solange sie lädt", () => {
  it("LADEND: `Lädt …` steht da, `kein Treffer` NICHT", async () => {
    await mount(Mobile, "/mobile");
    await reiter(i18n.t("mob.tabLookup"));

    expect(text()).toContain(LAEDT());
    expect(text()).not.toContain(KEIN_TREFFER());
  });

  it("GELADEN UND LEER: der heutige Leertext steht exakt da", async () => {
    await mount(Mobile, "/mobile");
    await reiter(i18n.t("mob.tabLookup"));
    await act(async () => {
      kanal.search.resolve([]);
      await flush();
    });

    expect(text()).toContain(KEIN_TREFFER());
    expect(text()).not.toContain(LAEDT());
  });

  it("FEHLER: ehrlicher Fehlertext statt Leerbehauptung", async () => {
    await mount(Mobile, "/mobile");
    await reiter(i18n.t("mob.tabLookup"));
    await act(async () => {
      kanal.search.reject(new Error("kaputt"));
      await flush();
    });

    expect(text()).toContain(FEHLER());
    expect(text()).not.toContain(KEIN_TREFFER());
  });
});

// ================================================================================================
// A4 · KNOWLEDGE-INTAKE — der Leerzustand wartet, bis der Bestand da ist
// ================================================================================================
//
// Der Leerzustand dieser Seite lebt von einem echten Beispiel aus dem Bestand
// (`pickExampleKo`). Ohne geladene Daten liefert der Helfer `null` — die Seite zeigt dann
// denselben Anblick wie bei einem wirklich leeren Bestand. Genau diese Ununterscheidbarkeit
// schliesst A4.
describe("JOB 1118 · D-036 · A4: der Intake-Leerzustand wartet auf den Bestand", () => {
  // JOB 3062 · H3 — DIE AUSSAGE ZIEHT UM, SIE FÄLLT NICHT WEG.
  //
  // Der Leerzustand des Intake (Frage, Starter-Chips, Beispiel aus dem Bestand) ist als FLÄCHE
  // gelöscht: die Chips stehen im Titel-Menü des leeren Blattes, das Beispiel im „…"-Menü unter
  // „Beispiel ansehen". Die ZUSAGE von A4 hängt aber nicht an den Chips, sondern am Bestand:
  // `pickExampleKo` liefert beim Laden `null` wie bei einem leeren Bestand — wer das nicht
  // unterscheidet, behauptet „kein Beispiel", während er noch lädt. Genau das misst A4 jetzt an
  // seinem neuen Ort. Fällt die Unterscheidung im Blatt weg, wird dieser Block rot.
  async function beispielOeffnen(): Promise<void> {
    await mount(KnowledgeIntake, "/erfassen");
    const mehr = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-mehr"]');
    if (!mehr) {
      throw new Error("Das „…“-Menü des Blattes ist nicht da.");
    }
    await act(async () => {
      mehr.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    const eintrag = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === i18n.t("erfassen.mehr.beispiel"),
    );
    if (!eintrag) {
      throw new Error("Der Eintrag „Beispiel ansehen“ ist nicht da.");
    }
    await act(async () => {
      eintrag.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
  }

  it("LADEND: `Lädt …` steht da, die Leerbehauptung noch nicht", async () => {
    await beispielOeffnen();

    expect(text()).toContain(LAEDT());
    expect(text()).not.toContain(i18n.t("erfassen.beispiel.keins"));
  });

  it("GELADEN UND LEER: jetzt — und erst jetzt — steht die Leerbehauptung da", async () => {
    await beispielOeffnen();
    await act(async () => {
      kanal.kos.resolve([]);
      await flush();
    });

    expect(text()).toContain(i18n.t("erfassen.beispiel.keins"));
    expect(text()).not.toContain(LAEDT());
  });

  it("FEHLER: ehrlicher Fehlertext statt stiller Leere", async () => {
    await beispielOeffnen();
    await act(async () => {
      kanal.kos.reject(new Error("kaputt"));
      await flush();
    });

    expect(text()).toContain(FEHLER());
    expect(text()).not.toContain(LAEDT());
    expect(text()).not.toContain(i18n.t("erfassen.beispiel.keins"));
  });
});
