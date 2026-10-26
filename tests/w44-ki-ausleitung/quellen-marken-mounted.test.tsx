// @vitest-environment jsdom
// Eigener verschärfter Nachweis; die separate Originalkopie bleibt unverändert.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type {
  KlaraGespraech,
  KlaraNachrichtEingabe,
  KlaraObjektbezug,
  KlaraSchritt,
} from "../../apps/web/src/api/klaraGespraech";
import { citedSourceIds } from "../../services/reasoner/src/provider-model";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const ANTWORT =
  "Die Lieferfrist steht in der Rahmenregel [2], die Ausnahme in der Sonderregel [3].";
const KANDIDATEN = [
  { id: "KO-A", title: "Titel A" },
  { id: "KO-B", title: "Titel B" },
  { id: "KO-C", title: "Titel C" },
];
const antwort = {
  answerId: "a1",
  result: {
    answered: true,
    answer: ANTWORT,
    sources: KANDIDATEN.map((k) => k.id),
    citedSources: citedSourceIds(ANTWORT, KANDIDATEN as never),
    demo: false,
    knowledgeClass: "fakt",
    steps: [],
    belastbarkeit: {
      quellen: KANDIDATEN.map((k) => ({ koId: k.id, titel: k.title, version: 1, validiert: true })),
    },
  },
};
const server: { g: KlaraGespraech | null; n: number } = { g: null, n: 0 };
function aktuelles(): KlaraGespraech {
  if (!server.g) throw new Error("Testgespräch fehlt");
  return server.g;
}
vi.mock("../../apps/web/src/api/klaraGespraech", async (orig) => {
  const echt = (await orig()) as Record<string, unknown>;
  const k = () => JSON.parse(JSON.stringify(aktuelles())) as KlaraGespraech;
  return {
    ...echt,
    klaraGespraechApi: {
      aktuelles: async () => ({ gespraech: k() }),
      hole: async () => ({ gespraech: k() }),
      beginne: async () => ({ gespraech: k() }),
      nachricht: async (_id: string, e: KlaraNachrichtEingabe) => {
        const n = {
          id: `m${++server.n}`,
          von: e.von,
          modus: e.modus,
          text: e.text,
          objektbezug: e.objektbezug,
          antwortId: e.antwortId ?? null,
          quellen: e.quellen ?? [],
          ...(e.quellenAngaben ? { quellenAngaben: e.quellenAngaben } : {}),
          wissensklasse: null,
          grund: null,
          angelegtAm: "2026-10-22T00:00:00Z",
        };
        aktuelles().nachrichten.push(n);
        return { nachricht: n, gespraech: k() };
      },
      schritt: async (_id: string, s: KlaraSchritt) => {
        aktuelles().letzterSchritt = s;
        return { gespraech: k() };
      },
      einwilligung: async () => ({ gespraech: k() }),
      loesche: async () => ({ geloescht: 1 }),
      frage: async () => antwort,
    },
  };
});
const echt = await import("../../apps/web/src/components/klara-vorschau/echt");
const { KlaraEchtGespraech } = await import(
  "../../apps/web/src/components/klara-vorschau/KlaraEchtGespraech"
);
const { AuthProvider } = await import("../../apps/web/src/app/AuthContext");
const i18n = (await import("../../apps/web/src/i18n")).default;
const bezug: KlaraObjektbezug = { pfad: "/fragen", seitenName: "Fragen", objekt: "Gespräch" };
function initialisiere(id: string) {
  server.g = {
    id,
    objektbezug: bezug,
    nachrichten: [],
    letzterSchritt: null,
    einwilligungAm: "2026-10-22T00:00:00Z",
    angelegtAm: "x",
    geaendertAm: "x",
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("W4.4 Kandidatenindex", () => {
  it.each(["aktuell", "historisch"])(
    "exakte Quellenchips und ehrlicher Altbestand: %s",
    async (modus) => {
      vi.stubGlobal("fetch", () => new Promise(() => {}));
      await i18n.changeLanguage("de");
      initialisiere(`O-${modus}`);
      await echt.ladeEcht(`k-${modus}`, i18n.t);
      expect(await echt.fragen("Wie lang ist die Lieferfrist?", bezug, "de", i18n.t)).toBe(
        "beantwortet",
      );
      const gespeichert = aktuelles().nachrichten.at(-1);
      expect(gespeichert?.quellen).toEqual(["KO-B", "KO-C"]);
      expect(gespeichert?.quellenAngaben?.map((a) => [a.koId, a.kandidatenIndex])).toEqual([
        ["KO-B", 2],
        ["KO-C", 3],
      ]);
      if (modus === "historisch" && gespeichert) {
        gespeichert.quellenAngaben = gespeichert.quellenAngaben?.map((a) => ({
          koId: a.koId,
          titel: a.titel,
          fassung: a.fassung,
          geprueft: a.geprueft,
        }));
        await echt.pruefeEcht(`k-${modus}`, i18n.t);
      }
      const c = document.createElement("div");
      document.body.appendChild(c);
      const root = createRoot(c);
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      try {
        await act(async () => {
          root.render(
            createElement(
              QueryClientProvider,
              { client: qc },
              createElement(
                AuthProvider,
                null,
                createElement(
                  MemoryRouter,
                  null,
                  createElement(KlaraEchtGespraech, {
                    kontext: bezug,
                    pfad: "/fragen",
                    ki: { abgeschaltet: false, ohneModell: false, unbekannt: false, extern: null },
                    onErneutFragen: () => {},
                    onNeuLaden: () => {},
                  }),
                ),
              ),
            ),
          );
        });
        expect(c.textContent).toContain(ANTWORT);
        const chips = [...c.querySelectorAll('[data-testid="klara-quelle"]')].map(
          (e) => `${e.getAttribute("data-ko") ?? ""} -> ${e.querySelector("a")?.textContent ?? ""}`,
        );
        expect(chips).toEqual(
          modus === "historisch"
            ? ["KO-B -> [?] Titel B", "KO-C -> [?] Titel C"]
            : ["KO-B -> [2] Titel B", "KO-C -> [3] Titel C"],
        );
      } finally {
        await act(async () => root.unmount());
        qc.clear();
        c.remove();
      }
    },
  );
  it("leere belegte Quellen bleiben leer statt Kandidaten zu erfinden", async () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    initialisiere("leer");
    antwort.result.citedSources = [];
    await echt.ladeEcht("k-leer", i18n.t);
    await echt.fragen("Eine Frage", bezug, "de", i18n.t);
    expect(aktuelles().nachrichten.at(-1)?.quellen).toEqual([]);
    expect(aktuelles().nachrichten.at(-1)?.quellenAngaben ?? []).toEqual([]);
  });
});
