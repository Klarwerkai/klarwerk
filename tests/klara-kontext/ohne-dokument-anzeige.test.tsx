// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import {
  type KlaraGespraechNachricht,
  klaraGespraechApi,
} from "../../apps/web/src/api/klaraGespraech";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { KlaraEchtGespraech } from "../../apps/web/src/components/klara-vorschau/KlaraEchtGespraech";
import { ladeEcht } from "../../apps/web/src/components/klara-vorschau/echt";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bezug = { pfad: "/begleiter", seitenName: "Klara", objekt: "Klara" };
const antwort: KlaraGespraechNachricht = {
  id: "antwort",
  von: "klara",
  modus: "ki",
  text: "Confirmed by the source. [1]\n\nThe test card is square. [1]",
  objektbezug: bezug,
  antwortId: "a1",
  quellen: ["karte"],
  quellenAngaben: [
    { koId: "karte", titel: "Testkarte", fassung: 1, geprueft: true, kandidatenIndex: 1 },
  ],
  wissensklasse: null,
  grund: null,
  angelegtAm: "2026-11-28T09:00:00Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("Ohne Dokument fragen", () => {
  it("sendet die vollständige getippte Frage; der Seitenbezug behält seinen bisherigen Frageweg", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      expect(url).toBe("/api/ask");
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({});
    });
    const frage = 'Is this correct: "The test card is square"?';
    const signal = new AbortController().signal;
    await klaraGespraechApi.frage(frage, "en", [], signal);
    await klaraGespraechApi.frage(frage, "en", [], signal, { art: "artikel", koId: "karte" });
    expect(bodies).toEqual([
      { question: frage, locale: "en", getippteAussagePruefen: true },
      { question: frage, locale: "en", seitenbezug: { art: "artikel", koId: "karte" } },
    ]);
  });

  it.each(["de", "en", "nl"] as const)(
    "liest beim Wiederöffnen die Freigabe der zitierten Fassung (%s)",
    async (locale) => {
      const nachrichten = [
        antwort,
        {
          ...antwort,
          id: "ohne",
          modus: "ohne_ki",
          text: "Server-Fallback",
          quellen: [],
          quellenAngaben: [],
          grund: "keine_belegte_antwort",
        },
      ];
      const leser = { id: "leser", name: "Aktueller Leser" };
      const pruefer = { id: "pruefer", name: "Mara Berg" };
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const aufrufe: string[] = [];
      let gelieferteFassung = 1;
      vi.stubGlobal("fetch", async (url: string) => {
        aufrufe.push(url);
        if (url === "/api/me/klara/gespraech")
          return Response.json({
            gespraech: {
              id: "g1",
              objektbezug: bezug,
              nachrichten,
              letzterSchritt: null,
              einwilligungAm: "2026-11-28T09:00:00Z",
              angelegtAm: "",
              geaendertAm: "",
            },
          });
        if (url === "/api/auth/status") return Response.json({ needsSetup: false });
        if (url === "/api/auth/me") return Response.json(leser);
        if (url === "/api/directory") return Response.json([leser, pruefer]);
        if (url === "/api/kos/karte?belegfassung=1")
          return Response.json({
            id: "karte",
            fassung: gelieferteFassung,
            titel: "Testkarte",
            freigegebenVon: pruefer.id,
            aktuellBestaetigteFassung: 2,
          });
        return new Promise<Response>(() => {});
      });
      await i18n.changeLanguage(locale);
      await ladeEcht(leser.id + locale, i18n.t);
      const c = document.createElement("div");
      const root = createRoot(c);
      try {
        await act(async () =>
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
                    pfad: bezug.pfad,
                    ki: { abgeschaltet: false, ohneModell: false, unbekannt: false, extern: null },
                    onErneutFragen() {},
                    onNeuLaden() {},
                    minimal: true,
                  }),
                ),
              ),
            ),
          ),
        );
        for (let versuch = 0; versuch < 50 && !c.textContent?.includes(pruefer.name); versuch++) {
          await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 10)));
        }
        const quelle = c.querySelector('[data-testid="klara-quelle"]');
        expect(quelle?.textContent).toContain(i18n.t("klarakontext.fassung", { nr: 1 }));
        expect(quelle?.textContent).toContain(
          i18n.t("begleiter.vergleich.freigegebenVon", { person: pruefer.name }),
        );
        expect(quelle?.textContent).not.toContain(leser.name);
        expect(quelle?.querySelector("a")?.getAttribute("href")).toBe(
          "/wissen/karte?fassung=1&ansicht=gespeichert",
        );
        expect(c.textContent).toContain("Confirmed by the source.");
        expect(c.textContent).toContain("The test card is square.");
        expect(c.textContent).toContain(i18n.t("klaragespraech.antwort.keine"));
        expect(c.textContent).not.toContain("Server-Fallback");
        const luecke = c.querySelector('[data-testid="klara-nachricht"][data-modus="ohne_ki"]');
        expect(luecke?.querySelector('[data-testid="klara-nachricht-als-notiz"]')).toBeNull();
        expect(aufrufe).not.toContain("/api/kos/karte?belegfassung=2");
        // Eine abweichende Serverfassung darf keinen Namen für den alten Beleg liefern.
        gelieferteFassung = 2;
        await act(async () => {
          await qc.invalidateQueries({ queryKey: ["begleiter-belegfassung"] });
          await new Promise<void>((resolve) => setTimeout(resolve, 10));
        });
        expect(quelle?.textContent).not.toContain(pruefer.name);
      } finally {
        await act(async () => root.unmount());
        qc.clear();
      }
    },
  );
});
