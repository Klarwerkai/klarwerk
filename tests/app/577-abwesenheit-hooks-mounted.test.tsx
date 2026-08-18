// @vitest-environment jsdom
// ================================================================================================
// JOB 577 · D6 — DER KAUSALE RED-FIRST DIESES DURCHGANGS.
// ================================================================================================
//
// Diese Datei prüft NICHT die Existenz eines Moduls. Sie prüft eine Zusage der VORHANDENEN Hooks
// in `apps/web/src/api/hooks.ts` — der Test lädt, mountet, läuft und misst; er fällt fachlich, weil
// die Zusage auf dem Startstand nicht eingelöst ist. Ein Import- oder Pfadfehler wäre KEIN
// Red-first-Beleg (Auftrag §5.2).
//
// DIE ZUSAGE, um die es geht, ist die von BEN in D5 benannte: Eine Route, die „nicht vorhanden",
// „nicht sichtbar" und „gehört dir nicht" einheitlich mit 404 beantwortet, darf im Client NICHT als
// FEHLER ankommen. Denn eine Fehlermeldung IST selbst die Auskunft — „hier gibt es etwas, das du
// nicht sehen darfst". Genau das ist der Datenschutzfehler, um den JOB 577 die ganze Zeit geht.
//
//   Startstand:  `retry: false` unterdrückt nur die WIEDERHOLUNG. Der Query endet trotzdem in
//                `isError`, und `data` bleibt `undefined`. Was daraus sichtbar wird, entscheidet
//                danach jeder Renderer für sich — fail-OPEN durch Disziplin.
//   Zielstand:   404 wird in den DATENkanal gehoben: `isError === false`, `data === null`. Ein
//                Verbraucher, der NICHTS tut, zeigt NICHTS — fail-closed durch Bauart.
//
// 403, Zeitablauf und echte Fehler bleiben im Fehlerkanal; das prüft die Kalibrierung K4 unten.
// Ohne sie wäre „kein Fehler" auch dann erfüllt, wenn die Schicht pauschal alles verschluckt.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const antwort = vi.hoisted(() => ({
  expertise: null as null | (() => never),
  features: null as null | (() => never),
  importAccess: null as null | (() => never),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    analytics: {
      expertise: vi.fn(async () => {
        if (antwort.expertise) {
          antwort.expertise();
        }
        return [];
      }),
    },
    features: {
      get: vi.fn(async () => {
        if (antwort.features) {
          antwort.features();
        }
        return { features: {} };
      }),
    },
    importAccess: {
      confluence: vi.fn(async () => {
        if (antwort.importAccess) {
          antwort.importAccess();
        }
        return { enabled: true, credentialsUsable: true, lastConnectedAt: null };
      }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { useExpertise, useFeatures, useImportAccessConfluence } from "../../apps/web/src/api/hooks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wirft = (status: number, code: string) => () => {
  throw new ApiError(status, code, `Testantwort ${status}`);
};

interface Sondenbefund {
  istFehler: boolean;
  datenSindNull: boolean;
  datenSindUndefined: boolean;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Eine Sonde statt einer echten Seite: Sie ruft GENAU EINEN Hook auf und schreibt seinen Zustand
// als JSON ins DOM. Damit misst der Test die Hook-Zusage selbst und nicht die Renderentscheidung
// irgendeiner Fläche darüber — die ist Gegenstand der Abnahmefälle in
// `577-abwesenheit-verbraucher-mounted.test.tsx`.
function Sonde({ hook }: { hook: () => { isError: boolean; data: unknown } }): JSX.Element {
  const q = hook();
  const befund: Sondenbefund = {
    istFehler: q.isError,
    datenSindNull: q.data === null,
    datenSindUndefined: q.data === undefined,
  };
  return createElement("div", { id: "befund" }, JSON.stringify(befund));
}

async function messe(hook: () => { isError: boolean; data: unknown }): Promise<Sondenbefund> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, createElement(Sonde, { hook })));
  });
  await act(async () => {
    await flush();
  });
  const text = container.querySelector("#befund")?.textContent ?? "{}";
  return JSON.parse(text) as Sondenbefund;
}

beforeEach(() => {
  antwort.expertise = null;
  antwort.features = null;
  antwort.importAccess = null;
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
});

describe("JOB 577 D6 — 404 erreicht den Client als Abwesenheit, nicht als Fehler (kausaler Red-first)", () => {
  it("K1: useExpertise — ein 404 erzeugt KEINEN Fehlerzustand", async () => {
    antwort.expertise = wirft(404, "NOT_FOUND");

    const befund = await messe(() => useExpertise(true));

    // Auf dem Startstand ist `istFehler` hier `true`: `retry: false` unterdrückt die Wiederholung,
    // nicht den Fehlerkanal. Genau das ist der Befund aus BENs Auflage.
    expect(befund.istFehler).toBe(false);
    expect(befund.datenSindNull).toBe(true);
  });

  it("K2: useFeatures — ein 404 erzeugt KEINEN Fehlerzustand", async () => {
    antwort.features = wirft(404, "NOT_FOUND");

    const befund = await messe(() => useFeatures());

    expect(befund.istFehler).toBe(false);
    expect(befund.datenSindNull).toBe(true);
  });

  it("K3: useImportAccessConfluence — ein 404 erzeugt KEINEN Fehlerzustand", async () => {
    antwort.importAccess = wirft(404, "NOT_FOUND");

    const befund = await messe(() => useImportAccessConfluence(true));

    expect(befund.istFehler).toBe(false);
    expect(befund.datenSindNull).toBe(true);
  });

  it("K4 (Kalibrierung): ein 500 bleibt im Fehlerkanal — die Schicht verschluckt nicht alles", async () => {
    antwort.expertise = wirft(500, "INTERNAL");

    const befund = await messe(() => useExpertise(true));

    expect(befund.istFehler).toBe(true);
    expect(befund.datenSindNull).toBe(false);
  });

  it("K5 (Kalibrierung): ein erfolgreicher Abruf kommt unverändert durch", async () => {
    const befund = await messe(() => useExpertise(true));

    expect(befund.istFehler).toBe(false);
    expect(befund.datenSindNull).toBe(false);
    expect(befund.datenSindUndefined).toBe(false);
  });
});
