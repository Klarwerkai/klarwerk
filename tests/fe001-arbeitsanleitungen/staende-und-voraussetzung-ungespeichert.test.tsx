// @vitest-environment jsdom
// ================================================================================================
// FE-001 LAUF 4 · BENS BEFUNDE BEN-01 (E7) UND BEN-02 (E8) — AN DER MONTIERTEN SEITE, MIT GEGENPROBE.
// ================================================================================================
//
//   BEN-01 · Scheitert das NACHLADEN der Stände (HTTP 500), obwohl eine ältere Liste im
//            Zwischenspeicher liegt, bleibt der Fehler sichtbar — mit „Erneut laden". Vorher stand
//            nur der Ein-Stand-Hinweis da (gemessen: queryStatus=error, sichtbarer Fehler=false).
//            Gegenprobe: ohne Zwischenspeicher zeigt derselbe Fehler den bisherigen Ständefehler.
//   BEN-02 · Eine geänderte, noch nicht übernommene Abschnittsvoraussetzung sperrt das Vorlegen mit
//            sichtbarem Grund; kein POST …/vorlegen. Nach dem Übernehmen ist Vorlegen wieder frei.
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
import { GesamtanweisungSeite } from "../../apps/web/src/components/gesamtanweisung/GesamtanweisungSeite";
import { voraussetzungUngespeichert } from "../../apps/web/src/components/gesamtanweisung/VoraussetzungFeld";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let echtesFetch: typeof globalThis.fetch;

type Antwort = { status: number; rumpf: unknown };
type Anfrage = { adresse: string; methode: string; rumpf: unknown };

let anfragen: Anfrage[] = [];

function serviere(antwortAuf: (anfrage: Anfrage) => Antwort): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const anfrage: Anfrage = {
      adresse: String(eingabe),
      methode: (init?.method ?? "GET").toUpperCase(),
      rumpf: typeof init?.body === "string" ? JSON.parse(init.body) : null,
    };
    anfragen.push(anfrage);
    const { status, rumpf } = antwortAuf(anfrage);
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
  anfragen = [];
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

async function montiere(): Promise<QueryClient> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(GesamtanweisungSeite, { anweisungId: "a-1", darfEntscheiden: false }),
      ),
    );
  });
  return qc;
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

function lesestand(voraussetzung: string | null, version = 3): AnweisungLesestand {
  return {
    id: "a-1",
    titel: "Start im Homeoffice",
    zweck: "Einarbeitung",
    geltungsbereich: "Alle Teams",
    voraussetzungen: "",
    stand: "entwurf",
    version,
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
        voraussetzung,
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
    unvollstaendig: false,
    verborgeneBausteine: 0,
    pruefanbindung: "nicht_angebunden",
  };
}

describe("BEN-01 · E7: ein gescheitertes Nachladen der Stände bleibt sichtbar", () => {
  it("Liste im Zwischenspeicher, dann HTTP 500: Fehler UND „Erneut laden“ sichtbar", async () => {
    let staendeScheitern = false;
    serviere(({ adresse }) => {
      if (adresse === "/api/gesamtanweisungen/a-1") {
        return { status: 200, rumpf: lesestand(null) };
      }
      if (adresse === "/api/gesamtanweisungen/a-1/staende") {
        return staendeScheitern
          ? { status: 500, rumpf: { error: "INTERNAL", message: "kaputt" } }
          : { status: 200, rumpf: { staende: [1] } };
      }
      if (adresse === "/api/directory") {
        return { status: 200, rumpf: [{ id: "u-pia", name: "Pia Beispiel" }] };
      }
      return { status: 404, rumpf: { error: "NOT_FOUND", message: adresse } };
    });
    const qc = await montiere();
    await warteBis(() => marke("ga-vergleich-zu-wenige") !== null, "der Ein-Stand-Hinweis");
    expect(marke("ga-vergleich-staende-auffrischung-fehler")).toBeNull();

    staendeScheitern = true;
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["gesamtanweisung", "a-1", "staende"] }).catch(() => {});
    });
    await warteBis(
      () => marke("ga-vergleich-staende-auffrischung-fehler") !== null,
      "der sichtbare Fehler des Nachladens",
    );
    const alarm = marke("ga-vergleich-staende-auffrischung-fehler");
    expect(alarm?.getAttribute("role")).toBe("alert");
    expect(alarm?.textContent).toContain("nicht neu geladen");
    const knopf = alarm?.querySelector("button") as HTMLButtonElement | null;
    expect(knopf?.textContent).toBe("Erneut laden");

    // Erneuter Versuch klappt → der Fehler verschwindet, die Liste bleibt.
    staendeScheitern = false;
    await act(async () => {
      knopf?.click();
    });
    await warteBis(
      () => marke("ga-vergleich-staende-auffrischung-fehler") === null,
      "der erfolgreiche erneute Abruf",
    );
    expect(marke("ga-vergleich-zu-wenige")).not.toBeNull();
  });

  it("Gegenprobe ohne Zwischenspeicher: derselbe Fehler zeigt den Ständefehler, nicht beide", async () => {
    serviere(({ adresse }) => {
      if (adresse === "/api/gesamtanweisungen/a-1") {
        return { status: 200, rumpf: lesestand(null) };
      }
      if (adresse === "/api/gesamtanweisungen/a-1/staende") {
        return { status: 500, rumpf: { error: "INTERNAL", message: "kaputt" } };
      }
      return { status: 404, rumpf: { error: "NOT_FOUND", message: adresse } };
    });
    await montiere();
    await warteBis(() => marke("ga-vergleich-staende-fehler") !== null, "der Ständefehler");
    expect(marke("ga-vergleich-staende-fehler")?.querySelector("button")?.textContent).toBe(
      "Erneut laden",
    );
    expect(marke("ga-vergleich-staende-auffrischung-fehler")).toBeNull();
    expect(marke("ga-vergleich-zu-wenige")).toBeNull();
  });
});

describe("BEN-02 · E8: eine nicht übernommene Voraussetzung sperrt das Vorlegen", () => {
  async function zeige(): Promise<void> {
    let gespeichert: string | null = "Vorher gespeichert";
    let version = 3;
    serviere(({ adresse, methode, rumpf }) => {
      if (adresse === "/api/gesamtanweisungen/a-1") {
        return { status: 200, rumpf: lesestand(gespeichert, version) };
      }
      if (
        adresse === "/api/gesamtanweisungen/a-1/bausteine/b-1/voraussetzung" &&
        methode === "PUT"
      ) {
        gespeichert = (rumpf as { voraussetzung: string | null }).voraussetzung;
        version += 1;
        return { status: 200, rumpf: lesestand(gespeichert, version) };
      }
      if (adresse === "/api/gesamtanweisungen/a-1/vorlegen" && methode === "POST") {
        return {
          status: 200,
          rumpf: { ...lesestand(gespeichert, version + 1), stand: "vorgelegt" },
        };
      }
      if (adresse === "/api/gesamtanweisungen/a-1/staende") {
        return { status: 200, rumpf: { staende: [1, 2, 3] } };
      }
      if (adresse === "/api/directory") {
        return { status: 200, rumpf: [{ id: "u-pia", name: "Pia Beispiel" }] };
      }
      return { status: 404, rumpf: { error: "NOT_FOUND", message: adresse } };
    });
    await montiere();
    await warteBis(
      () => marke("ga-entscheidung-vorlegen") !== null && marke("ga-lesestand-baustein") !== null,
      "der geladene Lesestand mit Vorlegeknopf",
    );
  }

  const vorlegeknopf = () => marke("ga-entscheidung-vorlegen") as HTMLButtonElement;
  const feld = () => container.querySelector("#ga-voraussetzung-b-1") as HTMLInputElement;

  async function tippe(wert: string): Promise<void> {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld(), wert);
      feld().dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("geänderte Voraussetzung: Vorlegen gesperrt, Grund sichtbar, kein POST …/vorlegen", async () => {
    await zeige();
    expect(vorlegeknopf().disabled, "Ausgangslage: vorlegbar").toBe(false);
    expect(feld().value).toBe("Vorher gespeichert");

    await tippe("Noch nicht gespeicherte Voraussetzung");
    expect(vorlegeknopf().disabled).toBe(true);
    const grund = marke("ga-entscheidung-grund");
    expect(grund?.textContent ?? "").toContain("noch nicht übernommene Voraussetzung");
    expect(vorlegeknopf().getAttribute("aria-describedby")).toBe(grund?.id);
    expect(marke("ga-voraussetzung-ungespeichert")?.textContent ?? "").toContain(
      "Noch nicht übernommen",
    );
    await act(async () => {
      vorlegeknopf().click();
    });
    expect(anfragen.some((a) => a.adresse.endsWith("/vorlegen"))).toBe(false);

    // Übernehmen → gespeichert → Vorlegen wieder frei.
    await act(async () => {
      feld()
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await warteBis(() => !vorlegeknopf().disabled, "Vorlegen nach dem Übernehmen");
    const put = anfragen.find((a) => a.methode === "PUT" && a.adresse.endsWith("/voraussetzung"));
    expect(put?.rumpf).toMatchObject({
      version: 3,
      voraussetzung: "Noch nicht gespeicherte Voraussetzung",
    });
    expect(marke("ga-voraussetzung-ungespeichert")).toBeNull();
    expect(marke("ga-entscheidung-grund")).toBeNull();
  });

  it("zurückgetippt auf den gespeicherten Wert: keine Sperre", async () => {
    await zeige();
    await tippe("Anders");
    expect(vorlegeknopf().disabled).toBe(true);
    await tippe("  Vorher gespeichert ");
    expect(vorlegeknopf().disabled).toBe(false);
    expect(marke("ga-voraussetzung-ungespeichert")).toBeNull();
  });

  it("Vergleichsregel: getrimmt, und leer entspricht keiner Voraussetzung", () => {
    expect(voraussetzungUngespeichert("", null)).toBe(false);
    expect(voraussetzungUngespeichert("   ", null)).toBe(false);
    expect(voraussetzungUngespeichert("", "A")).toBe(true);
    expect(voraussetzungUngespeichert(" A ", "A")).toBe(false);
    expect(voraussetzungUngespeichert("B", "A")).toBe(true);
  });
});
