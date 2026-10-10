// @vitest-environment jsdom
// ================================================================================================
// WISSENS-VERMÄCHTNIS-BUCH · DIE FLÄCHE — `apps/web/src/components/VermaechtnisBuch.tsx`.
// ================================================================================================
//
// Gemountet wird der ECHTE Bereich an einem ECHTEN QueryClient mit dem ECHTEN i18n. Gefälscht ist
// genau EINE Stelle: `fetch` — damit laufen `api/verantwortung.ts` und `api/client.ts` unverändert
// mit, und der Fall sieht Methode und Pfad so, wie sie beim Server ankämen. Dazu die zwei
// Browserstellen, die jsdom nicht hat: `URL.createObjectURL` (Download) und `window.print` (Druck).
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · R-1642 — „auf Knopfdruck ein gedrucktes oder digitales … Buch": ein Knopf erzeugt es, ein
//        Knopf lädt es als Datei herunter, ein Knopf druckt genau das Buch.
//   K2 · R-2175 — das Buch einer Person ist vor dem Weitergeben sichtbar, samt dem, was fehlt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { VermaechtnisBuch } from "../../apps/web/src/components/VermaechtnisBuch";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BUCH = {
  person: { id: "u-rita", name: "Rita Ruhestand" },
  titel: "Wissens-Vermächtnis von Rita Ruhestand",
  erzeugtAm: "2026-10-09T08:00:00.000Z",
  dateiname: "klarwerk-vermaechtnis-rita-ruhestand-2026-10-09.md",
  aufgenommen: 3,
  zeitraum: { von: "2019-03-01", bis: "2026-09-30" },
  themen: [
    { thema: "Prüfmittel", anzahl: 2 },
    { thema: "Wartung", anzahl: 1 },
  ],
  ausgelassen: { papierkorb: 1, nichtEinsehbar: 0, vertraulich: 1, nichtValidiert: 2 },
  markdown: "# Wissens-Vermächtnis von Rita Ruhestand\n\n## Vorwort\n\nDieses Buch …",
  provenance: [],
};

let behaelter: HTMLDivElement;
let aufrufe: { methode: string; pfad: string }[];
let antwort: { status: number; rumpf: unknown };

function knopf(testId: string): HTMLButtonElement {
  const el = behaelter.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  expect(el, testId).not.toBeNull();
  return el as HTMLButtonElement;
}

async function warte(bedingung: () => boolean): Promise<void> {
  for (let i = 0; i < 50 && !bedingung(); i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  expect(bedingung()).toBe(true);
}

async function montiere(): Promise<void> {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wurzel = createRoot(behaelter);
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(VermaechtnisBuch, { personId: "u-rita" }),
      ),
    );
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  aufrufe = [];
  antwort = { status: 200, rumpf: BUCH };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      aufrufe.push({ methode: init?.method ?? "GET", pfad: String(url) });
      return new Response(JSON.stringify(antwort.rumpf), {
        status: antwort.status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  behaelter.remove();
  document.body.classList.remove("printing-extract");
});

describe("K1/K2 · Vermächtnis-Buch in der Kontokarte", () => {
  it("lädt nichts von selbst; ein Knopf erzeugt das Buch und zeigt Umfang, Lücken und Vorschau", async () => {
    await montiere();
    expect(aufrufe).toEqual([]);
    expect(behaelter.textContent).toContain("Wissens-Vermächtnis");

    await act(async () => knopf("vermaechtnis-erzeugen").click());
    await warte(() => behaelter.querySelector('[data-testid="vermaechtnis-ergebnis"]') !== null);

    expect(aufrufe).toEqual([
      { methode: "GET", pfad: "/api/verantwortung/person/u-rita/vermaechtnis" },
    ]);
    const umfang = behaelter.querySelector('[data-testid="vermaechtnis-umfang"]')?.textContent;
    expect(umfang).toBe("3 Beiträge in 2 Themen, festgehalten von 2019-03-01 bis 2026-09-30.");
    const luecken = behaelter.querySelector('[data-testid="vermaechtnis-ausgelassen"]');
    expect(luecken?.textContent).toContain("2 noch nicht validiert");
    expect(luecken?.textContent).toContain("1 vertraulich");
    expect(luecken?.textContent).toContain("1 im Papierkorb");
    expect(luecken?.textContent).not.toContain("nicht einsehbar");
    const vorschau = behaelter.querySelector('[data-testid="vermaechtnis-vorschau"]');
    expect(vorschau?.textContent).toBe(BUCH.markdown);
    expect(vorschau?.classList.contains("print-area")).toBe(true);
  });

  it("digital: der Download trägt den Dateinamen des Servers und genau den Buchtext", async () => {
    // jsdom kennt `createObjectURL` nicht — für diesen Fall eingesetzt und danach zurückgestellt.
    const vorher = { anlegen: URL.createObjectURL, freigeben: URL.revokeObjectURL };
    const erzeugt: Blob[] = [];
    URL.createObjectURL = (b: Blob) => {
      erzeugt.push(b);
      return "blob:vermaechtnis";
    };
    URL.revokeObjectURL = () => {};
    const anker: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      anker.push(this);
    });
    try {
      await montiere();
      await act(async () => knopf("vermaechtnis-erzeugen").click());
      await warte(() => behaelter.querySelector('[data-testid="vermaechtnis-download"]') !== null);

      await act(async () => knopf("vermaechtnis-download").click());
      expect(anker).toHaveLength(1);
      expect(anker[0]?.download).toBe(BUCH.dateiname);
      expect(erzeugt).toHaveLength(1);
      expect(erzeugt[0]?.type).toBe("text/markdown;charset=utf-8");
      expect(erzeugt[0]?.size).toBe(new TextEncoder().encode(BUCH.markdown).length);
    } finally {
      URL.createObjectURL = vorher.anlegen;
      URL.revokeObjectURL = vorher.freigeben;
    }
  });

  it("gedruckt: der Druck markiert nur den Buchbereich und räumt danach auf", async () => {
    const drucke = vi.spyOn(window, "print").mockImplementation(() => {});
    await montiere();
    await act(async () => knopf("vermaechtnis-erzeugen").click());
    await warte(() => behaelter.querySelector('[data-testid="vermaechtnis-drucken"]') !== null);

    await act(async () => knopf("vermaechtnis-drucken").click());
    expect(drucke).toHaveBeenCalledTimes(1);
    expect(document.body.classList.contains("printing-extract")).toBe(true);
    window.dispatchEvent(new Event("afterprint"));
    expect(document.body.classList.contains("printing-extract")).toBe(false);
  });

  it("ein Fehler des Servers steht als Satz da, kein Buch wird vorgetäuscht", async () => {
    antwort = { status: 403, rumpf: { error: "FORBIDDEN", message: "Keine Berechtigung." } };
    await montiere();
    await act(async () => knopf("vermaechtnis-erzeugen").click());
    await warte(() => behaelter.querySelector('[data-testid="vermaechtnis-fehler"]') !== null);
    expect(behaelter.querySelector('[data-testid="vermaechtnis-fehler"]')?.textContent).toBe(
      "Das Buch konnte nicht erzeugt werden: Keine Berechtigung.",
    );
    expect(behaelter.querySelector('[data-testid="vermaechtnis-ergebnis"]')).toBeNull();
  });

  it("DE/EN/NL: jeder Text des Bereichs ist in allen drei Sprachen da", async () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      for (const schluessel of [
        "vermaechtnis.titel",
        "vermaechtnis.erzeugen",
        "vermaechtnis.download",
        "vermaechtnis.drucken",
        "vermaechtnis.umfang",
      ]) {
        expect(i18n.t(schluessel), `${sprache}: ${schluessel}`).not.toBe(schluessel);
      }
    }
  });
});
