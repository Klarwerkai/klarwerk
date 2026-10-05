// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · PRÜFBOARD-BEDIENUNG — die Konfliktmarkierung an der gemounteten Prüfkarte.
// ================================================================================================
//
// §8.2 „Kennzeichnung von Konflikten", entschieden von Pedi am 03.10.2026 (entscheidung:ebf707cb):
// Markierung an jeder betroffenen Karte, mit eigenem Lade- und Fehlerzustand für die Konfliktdaten.
//
// K1 · betroffene Karte trägt die Markierung, eine nicht betroffene nicht; in der Liste steht der
//      Punkt nur am betroffenen Eintrag.
// K2 · Wahrheitskonflikt und Anzahl werden benannt.
// K3 · der Weg zur Konfliktseite nur für Rollen, die sie betreten dürfen (minRole controller).
// K4 · Laden: ein Ladesatz und KEINE Markierung, kein „kein Konflikt".
// K5 · Fehler ohne Antwort: Fehlersatz + „Erneut laden"; der zweite Abruf bringt die Markierung.
// K6 · gescheiterte Auffrischung: die Markierung bleibt und sagt, dass sie nicht frisch ist.
// K7 · die Entscheidungsknöpfe bleiben in jeder Konfliktlage bedienbar — die Konfliktlage sperrt
//      keine Prüfentscheidung (keine neue Regel jenseits der Quelle).
//
// Gemockt ist der Endpunkt, nicht der Haken — dieselbe Kulisse wie `tests/validierung-stufe/`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "controller" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../validierung-stufe/kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("../validierung-stufe/kulisse-mocks")).toastMock(o as never),
);

import { act } from "../../apps/web/node_modules/react";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { Conflict } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  type Brett,
  de,
  finde,
  flush,
  klick,
  mounteBrett,
  zeile,
} from "../validierung-stufe/kulisse";

type Fn = ReturnType<typeof vi.fn>;
let brett: Brett;

const HINWEIS = '[data-testid="pruefen-konflikthinweis"]';
const LAEDT = '[data-testid="pruefen-konflikt-laedt"]';
const FEHLER = '[data-testid="pruefen-konflikt-fehler"]';
const NICHT_FRISCH = '[data-testid="pruefen-konflikt-nicht-frisch"]';
const LINK = '[data-testid="pruefen-konflikt-link"]';
const PUNKT = '[data-testid="pruefen-warteschlange-konflikt"]';
const LAEUFT = '[data-testid="pruefen-warteschlange-laeuft"]';

function konflikt(over: Partial<Conflict> = {}): Conflict {
  return {
    id: "c1",
    koA: "k1",
    koB: "k9",
    type: "context",
    description: "",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...over,
  };
}

function konfliktAntwort(impl: () => Promise<Conflict[]>): void {
  (endpoints.conflicts.list as unknown as Fn).mockImplementation(impl as never);
}

const eintraege = () =>
  brett.container.querySelectorAll('[data-testid="pruefen-warteschlange-eintrag"]');

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "controller";
  konfliktAntwort(async () => []);
});
afterEach(() => brett?.abbauen());

describe("K1 · nur die betroffene Karte trägt die Markierung", () => {
  it("Karte A betroffen, Karte B nicht — Karte und Listenpunkt", async () => {
    konfliktAntwort(async () => [konflikt({ koA: "k1", koB: "k9" })]);
    brett = await mounteBrett({
      zeilen: [zeile({ id: "k1", title: "Karte A" }), zeile({ id: "k2", title: "Karte B" })],
    });
    await flush();

    expect(finde(brett.container, HINWEIS)?.getAttribute("data-schwere")).toBe("limited");
    expect(finde(brett.container, HINWEIS)?.textContent).toContain(de("conflict.impact.title"));
    expect(eintraege()[0]?.querySelector(PUNKT)).not.toBeNull();
    expect(eintraege()[1]?.querySelector(PUNKT)).toBeNull();
    // Der Punkt verändert den Text des Eintrags nicht — sein Name steht im Zugänglichkeitsnamen.
    expect(eintraege()[0]?.textContent).toBe("Karte A");
    expect(eintraege()[0]?.querySelector(PUNKT)?.getAttribute("aria-label")).toBe(
      de("pruefboard.konfliktMarke"),
    );

    await klick(eintraege()[1]);
    expect(finde(brett.container, HINWEIS)).toBeNull();
    expect(finde(brett.container, LAEDT)).toBeNull();
    expect(finde(brett.container, FEHLER)).toBeNull();
  });
});

describe("K2 · Wahrheitskonflikt und Anzahl", () => {
  it("zwei offene Konflikte, einer davon Wahrheit", async () => {
    konfliktAntwort(async () => [
      konflikt(),
      konflikt({ id: "c2", koA: "k8", koB: "k1", type: "truth", status: "eskaliert" }),
    ]);
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });
    await flush();

    const h = finde(brett.container, HINWEIS);
    expect(h?.getAttribute("data-schwere")).toBe("truth");
    expect(h?.textContent).toContain(de("conflict.impact.truthTitle"));
    expect(h?.textContent).toContain(i18n.t("pruefboard.konfliktAnzahl", { n: 2 }));
  });
});

describe("K3 · der Weg zur Konfliktseite", () => {
  it("Controller sieht ihn", async () => {
    konfliktAntwort(async () => [konflikt()]);
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });
    await flush();
    expect(finde(brett.container, LINK)?.getAttribute("href")).toBe("/konflikte");
  });

  it("ohne Zugang zur Konfliktseite: Markierung ja, toter Link nein", async () => {
    stand.rolle = "experte";
    konfliktAntwort(async () => [konflikt()]);
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });
    await flush();
    expect(finde(brett.container, HINWEIS)).not.toBeNull();
    expect(finde(brett.container, LINK)).toBeNull();
  });
});

describe("K4 · eigener Ladezustand", () => {
  it("solange die Konflikte laden: Ladesatz, keine Markierung, keine Entwarnung", async () => {
    konfliktAntwort(() => new Promise<Conflict[]>(() => undefined));
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });

    expect(finde(brett.container, LAEDT)?.textContent).toBe(de("pruefboard.konfliktLaedt"));
    expect(finde(brett.container, HINWEIS)).toBeNull();
    expect(finde(brett.container, FEHLER)).toBeNull();
    expect(eintraege()[0]?.querySelector(PUNKT)).toBeNull();
  });
});

describe("K5 · eigener Fehlerzustand", () => {
  it("Fehler ohne Antwort: Satz + Erneut laden; der zweite Abruf bringt die Markierung", async () => {
    konfliktAntwort(async () => {
      throw new ApiError(503, "unavailable", "weg");
    });
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });
    await flush();

    expect(finde(brett.container, FEHLER)?.textContent).toContain(de("pruefboard.konfliktFehler"));
    expect(finde(brett.container, HINWEIS)).toBeNull();
    // Die Prüffläche selbst bleibt stehen: kein Erstfehler der Warteschlange.
    expect(finde(brett.container, '[data-testid="pruefen-erstfehler"]')).toBeNull();
    expect(finde(brett.container, '[data-testid="pruefen-karte"]')).not.toBeNull();

    konfliktAntwort(async () => [konflikt()]);
    await klick(finde(brett.container, '[data-testid="pruefen-konflikt-neu-laden"]'));
    await flush();
    expect(finde(brett.container, FEHLER)).toBeNull();
    expect(finde(brett.container, HINWEIS)).not.toBeNull();
  });
});

describe("K6 · gescheiterte Auffrischung", () => {
  it("die Markierung bleibt und sagt, dass sie nicht frisch ist", async () => {
    konfliktAntwort(async () => [konflikt()]);
    brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });
    await flush();
    expect(finde(brett.container, NICHT_FRISCH)).toBeNull();

    konfliktAntwort(async () => {
      throw new ApiError(503, "unavailable", "weg");
    });
    await act(async () => {
      await brett.qc.invalidateQueries({ queryKey: ["conflicts"] });
    });
    await flush();

    expect(finde(brett.container, HINWEIS)).not.toBeNull();
    expect(finde(brett.container, NICHT_FRISCH)?.textContent).toBe(
      de("pruefboard.konfliktNichtFrisch"),
    );
  });
});

// R-0213 gehört nicht zur Konfliktlage, wohnt aber an derselben Stelle (dem Listeneintrag): eine
// laufende Prüfung ist schon in der Liste erkennbar, nicht erst an der Karte.
describe("R-0213 · laufende Prüfung ist in der Liste erkennbar", () => {
  it("nur der Eintrag mit laufender Prüfung trägt das Schloss, sein Text bleibt der Titel", async () => {
    brett = await mounteBrett({
      zeilen: [
        zeile({
          id: "k1",
          title: "Läuft",
          aiCheck: { status: "pending", requestedAt: "2026-10-01T00:00:00.000Z" },
        } as Parameters<typeof zeile>[0]),
        zeile({ id: "k2", title: "Fertig" }),
      ],
    });
    await flush();
    const marke = eintraege()[0]?.querySelector(LAEUFT);
    expect(marke?.getAttribute("aria-label")).toBe(de("val.aiCheck.pending"));
    expect(eintraege()[0]?.textContent).toBe("Läuft");
    expect(eintraege()[1]?.querySelector(LAEUFT)).toBeNull();
  });
});

const LAGEN: Array<[string, () => Promise<Conflict[]>]> = [
  ["betroffen", async () => [konflikt()]],
  ["laedt", () => new Promise<Conflict[]>(() => undefined)],
  ["fehler", () => Promise.reject(new ApiError(503, "unavailable", "weg"))],
];

describe("K7 · die Konfliktlage sperrt keine Prüfentscheidung", () => {
  for (const [name, impl] of LAGEN) {
    it(`Lage ${name}: Freigeben, Rückfrage und Ablehnen bleiben bedienbar`, async () => {
      konfliktAntwort(impl);
      brett = await mounteBrett({ zeilen: [zeile({ id: "k1" })] });
      await flush();
      for (const v of ["up", "warn", "down"]) {
        const knopf = finde(
          brett.container,
          `[data-testid="pruefen-entscheidung-${v}"]`,
        ) as HTMLButtonElement | null;
        expect(knopf, `Knopf ${v} fehlt`).not.toBeNull();
        expect(knopf?.disabled).toBe(false);
      }
    });
  }
});
