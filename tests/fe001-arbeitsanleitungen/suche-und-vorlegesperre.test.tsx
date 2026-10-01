// @vitest-environment jsdom
// ================================================================================================
// FE-001 RUNDE 3 · BENS BEFUNDE E4 UND E8 — AN DER GEZEICHNETEN FLÄCHE, MIT GEGENPROBE.
// ================================================================================================
//
//   E4 · Eine GESCHEITERTE Auffrischung der Suche bleibt sichtbar, auch wenn noch Treffer aus einer
//        früheren Suche dastehen — mit erneutem Versuch. Vorher verschwand der Fehler still hinter
//        den alten Treffern (gemessen: queryStatus='error', visibleSearchError=false).
//   E8 · Ein UNVOLLSTÄNDIGER Lesestand (verborgene Abschnitte) sperrt das Vorlegen mit sichtbarem
//        Grund. Gegenprobe: derselbe Stand ohne verborgene Abschnitte ist vorlegbar.
//
// `fetch` ist adressabhängig festgelegt; es gibt kein Netz in diesem Prüfstand.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { AnweisungLesestand } from "../../apps/web/src/api/types";
import { BausteinAufnahme } from "../../apps/web/src/components/gesamtanweisung/BausteinAufnahme";
import { GesamtanweisungSeite } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungSeite";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let echtesFetch: typeof globalThis.fetch;

type Antwort = { status: number; rumpf: unknown };

function serviere(antwortAuf: (adresse: string) => Antwort): void {
  globalThis.fetch = (async (eingabe: unknown) => {
    const { status, rumpf } = antwortAuf(String(eingabe));
    return {
      status,
      ok: status >= 200 && status < 300,
      statusText: String(status),
      text: async () => JSON.stringify(rumpf),
    } as unknown as Response;
  }) as typeof globalThis.fetch;
}

beforeEach(() => {
  echtesFetch = globalThis.fetch;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = echtesFetch;
});

async function montiere(element: ReturnType<typeof createElement>): Promise<void> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client: qc }, element));
  });
}

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 200 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((fertig) => setTimeout(fertig, 10));
    });
  }
  expect(bedingung(), `Die Fläche hat nie erreicht: ${was}`).toBe(true);
}

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);

describe("E4 · ein Suchfehler verschwindet nicht hinter alten Treffern", () => {
  async function suche(begriff: string): Promise<void> {
    const feld = container.querySelector("#ga-aufnahme-suche") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        feld,
        begriff,
      );
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      marke("ga-aufnahme-suche-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  }

  it("Treffer UND gescheiterte Auffrischung: beides sichtbar, erneuter Versuch angeboten", async () => {
    let sucheScheitert = false;
    let sucheAbrufe = 0;
    serviere((adresse) => {
      if (adresse.startsWith("/api/library/search")) {
        sucheAbrufe += 1;
        return sucheScheitert
          ? { status: 500, rumpf: { error: "INTERNAL", message: "kaputt" } }
          : {
              status: 200,
              rumpf: [{ id: "ko-a", title: "Anlage entlüften", statement: "Kurz.", version: 1 }],
            };
      }
      return { status: 404, rumpf: { error: "NOT_FOUND", message: adresse } };
    });
    await montiere(
      createElement(BausteinAufnahme, {
        aufnehmen: async () => true,
        gesperrt: false,
        grund: null,
      }),
    );

    await suche("Anlage");
    await warteBis(() => marke("ga-aufnahme-treffer-eintrag") !== null, "der erste Treffer");
    expect(marke("ga-aufnahme-suche-auffrischung-fehler")).toBeNull();

    // Dieselbe Suche noch einmal — jetzt scheitert der Server.
    sucheScheitert = true;
    await suche("Anlage");
    await warteBis(
      () => marke("ga-aufnahme-suche-auffrischung-fehler") !== null,
      "der sichtbare Fehler der Auffrischung",
    );
    expect(sucheAbrufe, "„Suchen“ mit gleichem Begriff muss neu anfragen").toBe(2);
    const alarm = marke("ga-aufnahme-suche-auffrischung-fehler");
    expect(alarm?.getAttribute("role")).toBe("alert");
    expect(alarm?.textContent).toContain("nicht aktualisiert");
    expect(alarm?.textContent).toContain("Erneut suchen");
    // Die alten Treffer bleiben stehen — gekennzeichnet, nicht weggeräumt.
    expect(marke("ga-aufnahme-treffer-eintrag")).not.toBeNull();

    // Erneuter Versuch klappt → der Fehler verschwindet.
    sucheScheitert = false;
    await act(async () => {
      (alarm?.querySelector("button") as HTMLButtonElement).click();
    });
    await warteBis(
      () => marke("ga-aufnahme-suche-auffrischung-fehler") === null,
      "der erfolgreiche erneute Versuch",
    );
    expect(marke("ga-aufnahme-treffer-eintrag")).not.toBeNull();
  });

  it("Gegenprobe: derselbe Fehler ohne vorhandene Treffer steht als Suchfehler da", async () => {
    serviere(() => ({ status: 500, rumpf: { error: "INTERNAL", message: "kaputt" } }));
    await montiere(
      createElement(BausteinAufnahme, {
        aufnehmen: async () => true,
        gesperrt: false,
        grund: null,
      }),
    );
    await suche("Anlage");
    await warteBis(() => marke("ga-aufnahme-suche-fehler") !== null, "der Suchfehler");
    expect(marke("ga-aufnahme-treffer-eintrag")).toBeNull();
  });
});

describe("E8 · ein unvollständiger Lesestand sperrt das Vorlegen mit sichtbarem Grund", () => {
  function lesestand(verborgen: number): AnweisungLesestand {
    return {
      id: "a-1",
      titel: "Start im Homeoffice",
      zweck: "Einarbeitung",
      geltungsbereich: "Alle Teams",
      voraussetzungen: "",
      stand: "entwurf",
      version: 3,
      urheber: "u-pia",
      erstelltAm: "2026-09-26T08:00:00.000Z",
      geaendertAm: "2026-09-26T09:00:00.000Z",
      bausteine: [
        {
          id: "b-1",
          position: 0,
          koId: "ko-a",
          koVersion: 1,
          nachweisHash: null,
          voraussetzung: null,
          herkunft: {
            titel: "Arbeitsplatz einrichten",
            autor: "u-pia",
            fassungAm: "2026-09-25T08:00:00.000Z",
            status: "validated",
          },
          rumpfHtml: "<p>Dockingstation anschließen.</p>",
          aktuelleKoVersion: 1,
          aktualisierungsvorschlag: null,
          inhalt: { tabellenUeberschriften: [], abbildungen: [], geltung: null },
        },
      ],
      unvollstaendig: verborgen > 0,
      verborgeneBausteine: verborgen,
      pruefanbindung: "nicht_angebunden",
    };
  }

  async function zeige(verborgen: number): Promise<HTMLButtonElement> {
    serviere((adresse) => {
      if (adresse === "/api/gesamtanweisungen/a-1") {
        return { status: 200, rumpf: lesestand(verborgen) };
      }
      if (adresse === "/api/gesamtanweisungen/a-1/staende") {
        return { status: 200, rumpf: { staende: [1, 2, 3] } };
      }
      if (adresse === "/api/directory") {
        return { status: 200, rumpf: [{ id: "u-pia", name: "Pia Beispiel" }] };
      }
      return { status: 404, rumpf: { error: "NOT_FOUND", message: adresse } };
    });
    await montiere(
      createElement(GesamtanweisungSeite, { anweisungId: "a-1", darfEntscheiden: false }),
    );
    await warteBis(
      () => marke("ga-entscheidung-vorlegen") !== null && marke("ga-lesestand-baustein") !== null,
      "der geladene Lesestand mit Vorlegeknopf",
    );
    return marke("ga-entscheidung-vorlegen") as HTMLButtonElement;
  }

  it("verborgene Abschnitte: Vorlegen gesperrt, Grund sichtbar", async () => {
    const knopf = await zeige(1);
    expect(knopf.disabled, "unvollständiger Stand darf nicht vorlegbar sein").toBe(true);
    const grund = marke("ga-entscheidung-grund");
    expect(grund?.textContent ?? "").toContain("nicht alle Abschnitte");
    expect(knopf.getAttribute("aria-describedby")).toBe(grund?.id);
  });

  it("Gegenprobe: ohne verborgene Abschnitte ist derselbe Stand vorlegbar", async () => {
    const knopf = await zeige(0);
    expect(knopf.disabled).toBe(false);
    expect(marke("ga-entscheidung-grund")).toBeNull();
  });
});
