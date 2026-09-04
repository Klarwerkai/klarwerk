// @vitest-environment jsdom
// ================================================================================================
// JOB 3052 · D6 — DIE SEITENLEISTE DES WISSENSNETZES: JEDER ZUSTAND SAGT, WAS ER WEISS.
// ================================================================================================
//
// Das Zustandsmodell des Auftrags (§9) und die Lehren aus JOB 3037 R2–R5 und JOB 3046 R1, am
// echten Renderer:
//
//   S1  laden                 → drei Platzhalterkarten ohne Text, kein Leersatz, keine erfundene Zahl
//   S2  Antwort mit Objekten  → Zaehlsatz aus DERSELBEN Antwort, hoechstens drei Karten mit
//                                „<Status> · <Datum>", Link „Alle N Objekte oeffnen" mit echter Zahl
//   S3  Antwort leer          → der Leersatz („fuer dich nichts sichtbar" — Rechte-Naht, kein Urteil)
//   S4  Fehler ohne Daten     → der Fehlersatz; die Karte bleibt stehen
//   S5  Auffrischung scheitert MIT Daten → die alten Karten bleiben, dazu „Stand von … ·
//                                Auffrischung fehlgeschlagen" (REGELN §7, JOB 3037 R3)
//   S6  Auswahl wechselt, waehrend die Leiste laedt → ein VERSPAETETER Ruecklauf der alten Auswahl
//                                ueberschreibt die neue Leiste nicht (JOB 3046 R1)
//   S7  fehlendes/unlesbares Datum → nur das Statuswort, kein Platzhalter-Datum
//   K1  die KARTE: Auffrischung scheitert MIT Daten → Karte und Auswahl bleiben, Hinweis mit Stand
//   K2  die KARTE: weder Daten noch Fehler noch Laden (pausierte erste Anfrage, offline) → „Noch
//                                keine Antwort" — kein „Nichts vorhanden", kein Offline-Urteil
//
// Bauform wie tests/app/themenkarte-mounted.test.tsx: jsdom, relative Importe ueber
// `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock. Die Endpointgrenze ist die einzige
// Attrappe — Seite, i18n, React-Query und Router sind echt. Die Suche wird je Aufruf mit einer
// EIGENEN, von aussen aufloesbaren Zusage bedient, damit S1/S5/S6 den Zeitpunkt selbst bestimmen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const karte = { resolve: (_v: unknown) => {} };
  const luecken = vi.fn(
    () =>
      new Promise((resolve) => {
        karte.resolve = resolve;
      }),
  );
  /** Jeder Suchaufruf bekommt eine eigene Zusage; `antworten(i, wert)` loest den i-ten Aufruf. */
  const offen: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
  const search = vi.fn(
    (_params: unknown) =>
      new Promise((resolve, reject) => {
        offen.push({ resolve, reject });
      }),
  );
  return { luecken, search, offen, karteAntworten: (v: unknown) => karte.resolve(v) };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { wissensnetz: { luecken: d.luecken }, library: { search: d.search } },
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Wissensnetz } from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/wissensnetz"] },
          createElement(Wissensnetz),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

const KARTE = {
  objekteGesamt: 7,
  ohneThema: 0,
  sichtbareBeitragendeGesamt: 2,
  themen: [],
  themenkarte: {
    themen: [
      { thema: "pumpe", objekte: 4, farbe: "belegt", ohneKanten: false },
      { thema: "dichtung", objekte: 2, farbe: "freigegeben", ohneKanten: false },
      { thema: "entwurf", objekte: 1, farbe: "offen", ohneKanten: false },
    ],
    kanten: [{ a: "dichtung", b: "pumpe", gewicht: 2 }],
    weitere: [],
    weitereAbgeschnitten: false,
    mindesthaeufigkeit: 1,
    unterdruecktDurchUbiquitaet: 0,
  },
};

const objekt = (id: string, status: "validiert" | "offen", createdAt?: string) => ({
  id,
  title: `Objekt ${id}`,
  statement: "",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Technik",
  tags: ["pumpe"],
  confidence: 0.5,
  trust: 0.5,
  status,
  version: 1,
  originalAuthor: "a",
  author: "a",
  neededValidations: 1,
  assignments: [],
  asset: null,
  createdAt: createdAt ?? "2026-08-27T10:15:00.000Z",
  history: [],
});

const PUMPE_OBJEKTE = [
  objekt("p1", "validiert"),
  objekt("p2", "validiert", "2026-08-12T08:00:00.000Z"),
  objekt("p3", "offen"),
  objekt("p4", "validiert"),
];

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const knoten = (thema: string): HTMLElement =>
  container.querySelector(`[data-testid="themenknoten"][data-thema="${thema}"]`) as HTMLElement;

/** Karte liefern und die Vorgabe-Auswahl (pumpe, groesstes Thema) abwarten. */
async function mitKarte(): Promise<void> {
  await mount();
  await act(async () => {
    d.karteAntworten(KARTE);
    await flush();
  });
}
/** Den i-ten Suchaufruf beantworten (0-basiert). */
async function suchantwort(i: number, wert: unknown): Promise<void> {
  await act(async () => {
    d.offen[i]?.resolve(wert);
    await flush();
  });
}
async function suchfehler(i: number): Promise<void> {
  await act(async () => {
    d.offen[i]?.reject(new Error("Pruefstand: Suche gestoert"));
    await flush();
  });
}
async function klick(thema: string): Promise<void> {
  await act(async () => {
    knoten(thema).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.offen.length = 0;
  onlineManager.setOnline(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3052 D6 · die Seitenleiste des Wissensnetzes — jeder Zustand sagt, was er weiss", () => {
  it("S1 · laden: drei Platzhalterkarten ohne Text, kein Leersatz, kein Zaehlsatz, Link ohne Zahl", async () => {
    await mitKarte();
    expect(marke("leiste-titel")?.textContent).toBe("pumpe");
    expect(d.search).toHaveBeenCalledWith({ tag: "pumpe" });
    expect(alle("leiste-platzhalter")).toHaveLength(3);
    for (const p of alle("leiste-platzhalter")) {
      expect(p.textContent).toBe("");
    }
    expect(marke("leiste-leer")).toBeNull();
    expect(marke("leiste-fehler")).toBeNull();
    expect(marke("leiste-zaehlung")).toBeNull();
    expect(alle("leiste-objekt")).toHaveLength(0);
    expect(marke("leiste-alle")?.textContent).toBe(i18n.t("wissensnetz.leiste.oeffnen"));
    expect(marke("leiste-alle")?.getAttribute("href")).toBe("/bibliothek?tag=pumpe");
  });

  it("S2 · Antwort mit Objekten: Zaehlsatz aus derselben Antwort, hoechstens drei Karten mit Status und Datum, Link mit echter Zahl", async () => {
    await mitKarte();
    await suchantwort(0, PUMPE_OBJEKTE);
    expect(alle("leiste-platzhalter")).toHaveLength(0);
    expect(marke("leiste-zaehlung")?.textContent).toBe(
      i18n.t("wissensnetz.leiste.zaehlung", { frei: 3, pruefung: 1 }),
    );
    const karten = alle("leiste-objekt");
    expect(karten, "hoechstens drei — das Zielbild zeigt drei").toHaveLength(3);
    expect(
      karten.map((k) => k.querySelector('[data-testid="leiste-objekt-titel"]')?.textContent),
    ).toEqual(["Objekt p1", "Objekt p2", "Objekt p3"]);
    const unterzeilen = karten.map(
      (k) => k.querySelector('[data-testid="leiste-objekt-unterzeile"]')?.textContent,
    );
    expect(unterzeilen[0]).toBe("freigegeben · 27.08.2026");
    expect(unterzeilen[1]).toBe("freigegeben · 12.08.2026");
    expect(unterzeilen[2]).toBe("in Prüfung · 27.08.2026");
    expect(marke("leiste-alle")?.textContent).toBe(i18n.t("wissensnetz.leiste.alle", { count: 4 }));
    // Keine Prozentanzeige, kein „1 von 3 gruen" (keine Datenquelle — Verlustliste).
    expect(container.textContent ?? "").not.toMatch(/\d+\s*%/);
    expect(container.textContent ?? "").not.toMatch(/von \d+ grün/);
  });

  it("S3 · Antwort leer: der Leersatz — kein Zaehlsatz, keine Karten, der Link bleibt", async () => {
    await mitKarte();
    await suchantwort(0, []);
    expect(marke("leiste-leer")?.textContent).toBe(i18n.t("wissensnetz.leiste.leer"));
    expect(marke("leiste-zaehlung")).toBeNull();
    expect(alle("leiste-objekt")).toHaveLength(0);
    expect(alle("leiste-platzhalter")).toHaveLength(0);
    expect(marke("leiste-alle")?.getAttribute("href")).toBe("/bibliothek?tag=pumpe");
  });

  it("S4 · Fehler ohne Daten: der Fehlersatz, keine Platzhalter, die Karte bleibt stehen", async () => {
    await mitKarte();
    await suchfehler(0);
    expect(marke("leiste-fehler")?.textContent).toBe(i18n.t("wissensnetz.leiste.fehler"));
    expect(alle("leiste-platzhalter")).toHaveLength(0);
    expect(marke("leiste-leer")).toBeNull();
    expect(marke("themenkarte"), "die Karte bleibt").not.toBeNull();
    expect(knoten("pumpe").getAttribute("aria-pressed")).toBe("true");
  });

  it("S5 · Auffrischung scheitert MIT Daten: die alten Karten bleiben, dazu Stand und das Wort „fehlgeschlagen“", async () => {
    await mitKarte();
    await suchantwort(0, PUMPE_OBJEKTE);
    expect(alle("leiste-objekt")).toHaveLength(3);
    // Die Auffrischung: dieselbe Anfrage noch einmal, und diesmal scheitert sie.
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["library", "search"] });
      await flush();
    });
    await suchfehler(1);
    expect(alle("leiste-objekt"), "die zuletzt geholten Karten bleiben sichtbar").toHaveLength(3);
    expect(marke("leiste-zaehlung")).not.toBeNull();
    expect(marke("leiste-fehler"), "kein Fehlersatz an Stelle der Daten").toBeNull();
    const hinweis = marke("leiste-hinweis")?.textContent ?? "";
    expect(hinweis).toMatch(/^Stand von \d{2}:\d{2} · Auffrischung fehlgeschlagen$/);
  });

  it("S6 · die Antwort ist an die Auswahl gebunden: ein verspaeteter Ruecklauf der alten Auswahl ueberschreibt die neue Leiste nicht", async () => {
    await mitKarte();
    // Aufruf 0: pumpe (haengt). Wechsel auf dichtung → Aufruf 1.
    await klick("dichtung");
    expect(marke("leiste-titel")?.textContent).toBe("dichtung");
    expect(d.search).toHaveBeenLastCalledWith({ tag: "dichtung" });
    await suchantwort(1, [objekt("d1", "validiert")]);
    expect(alle("leiste-objekt")).toHaveLength(1);
    expect(marke("leiste-objekt-titel")?.textContent).toBe("Objekt d1");
    // JETZT kommt die alte Antwort fuer pumpe — vier Objekte. Sie darf die Leiste nicht aendern.
    await suchantwort(0, PUMPE_OBJEKTE);
    expect(marke("leiste-titel")?.textContent).toBe("dichtung");
    expect(alle("leiste-objekt")).toHaveLength(1);
    expect(marke("leiste-objekt-titel")?.textContent).toBe("Objekt d1");
    expect(marke("leiste-zaehlung")?.textContent).toBe(
      i18n.t("wissensnetz.leiste.zaehlung", { frei: 1, pruefung: 0 }),
    );
    // Zurueck auf pumpe: die inzwischen eingetroffene Antwort steht bereit — ohne Platzhalter.
    await klick("pumpe");
    expect(marke("leiste-titel")?.textContent).toBe("pumpe");
    expect(alle("leiste-objekt")).toHaveLength(3);
  });

  it("S7 · fehlendes oder unlesbares Datum: nur das Statuswort, kein erfundenes Datum", async () => {
    await mitKarte();
    await suchantwort(0, [
      { ...objekt("x1", "validiert"), createdAt: "" },
      { ...objekt("x2", "offen"), createdAt: "kein-datum" },
    ]);
    const unterzeilen = alle("leiste-objekt-unterzeile").map((u) => u.textContent);
    expect(unterzeilen).toEqual(["freigegeben", "in Prüfung"]);
  });

  it("K1 · die KARTE: scheitert ihre Auffrischung, bleiben Karte und Auswahl sichtbar — mit Stand und dem Wort „fehlgeschlagen“", async () => {
    await mitKarte();
    await suchantwort(0, PUMPE_OBJEKTE);
    await klick("dichtung");
    // Die zweite Antwort der Karte scheitert.
    d.luecken.mockImplementationOnce(() => Promise.reject(new Error("Pruefstand: Karte gestoert")));
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["wissensnetz", "luecken"] });
      await flush();
    });
    expect(marke("themenkarte"), "die Karte bleibt").not.toBeNull();
    expect(alle("themenknoten")).toHaveLength(3);
    expect(knoten("dichtung").getAttribute("aria-pressed"), "die Auswahl bleibt").toBe("true");
    expect(marke("netz-auffrischung-hinweis")?.textContent).toMatch(
      /^Stand von \d{2}:\d{2} · Auffrischung fehlgeschlagen$/,
    );
    expect(container.textContent).not.toContain(i18n.t("state.error"));
  });

  it("K2 · die KARTE: pausierte erste Anfrage (offline) — „Noch keine Antwort“, kein „Nichts vorhanden“, kein Offline-Urteil", async () => {
    onlineManager.setOnline(false);
    await mount();
    expect(d.luecken, "offline wird nichts abgerufen").not.toHaveBeenCalled();
    expect(marke("netz-keine-antwort")?.textContent).toBe(i18n.t("wissensnetz.keineAntwort"));
    expect(container.textContent).not.toContain(i18n.t("state.empty"));
    expect(container.textContent ?? "").not.toMatch(/offline/i);
    expect(marke("themenkarte")).toBeNull();
    // Wieder online: die Anfrage laeuft, die Karte kommt.
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    await act(async () => {
      d.karteAntworten(KARTE);
      await flush();
    });
    expect(marke("netz-keine-antwort")).toBeNull();
    expect(marke("themenkarte")).not.toBeNull();
  });
});
