// @vitest-environment jsdom
// ================================================================================================
// JOB 3067 · V4 — DIE ERHOBENE SICHTMETRIK BEKOMMT EINE FLAECHE.
// ================================================================================================
//
// Der Server erhebt fuenf Felder (`services/wissensnetz/src/luecken.ts:47-64`), die Seite nahm
// bisher genau eines (`themenkarte`) und warf vier weg. Diese Datei haelt fest, dass
// `objekteGesamt`, `ohneThema`, `sichtbareBeitragendeGesamt` und `themen[]` ABLESBAR sind — und
// dass die Flaeche dabei kein Urteil faellt.
//
// DIE FESSEL, die hier mitgeprueft wird, steht im Kopf des Servers (`luecken.ts:13-16`): die Sicht
// ist VOR der Auswertung getrimmt, „ein Thema, dessen Beitragende saemtlich vertraulich sind, sieht
// danach exakt aus wie ein Thema ohne Beitragende". Wer daraus eine „Luecke" macht, behauptet
// etwas, das die Daten nicht hergeben. F4 misst das an der gerenderten Flaeche.
//
//   F1  drei Gesamtzahlen        → jede an ihrem eigenen Traeger, wortgleich aus der Antwort,
//                                  und JEDE der drei Beschriftungen traegt das Sichtbarkeitswort
//   F1b dieselbe Wortbindung     → in jeder Sprache, die i18n.ts fuehrt (de/en/nl)
//   F2  Themenliste              → deterministische Lesereihenfolge, Link in die BESTEHENDE Bibliothek
//   F3  abgeschnittene Zaehlung  → „mindestens N", weil der Server den Wert eine Untergrenze nennt
//   F4  die Fessel               → kein Urteilswort auf der Flaeche, „sichtbar" an jeder Beitragendenzahl
//   F5  Bestand ohne Schlagwort  → der Leersatz UND die drei Zahlen (heute schweigt die Seite hier)
//   F6  Zustand                  → (a) gescheiterte Auffrischung haelt die Zahlen, (b) keine Antwort zeigt keine
//   F7  Deckel                   → hoechstens 40 Zeilen, der Rest hinter einem Aufklapper mit echter Zahl
//   F8  ohneThema ohne Weg       → eine Zahl und ein Satz, kein toter Knopf
//
// Bauform wie tests/wissensnetz-flaeche/seitenleiste-mounted.test.tsx: jsdom, relative Importe
// ueber `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock. Die Endpointgrenze ist die
// einzige Attrappe — Seite, i18n, React-Query und Router sind echt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const karte = { resolve: (_v: unknown) => {} };
  const luecken = vi.fn(
    () =>
      new Promise((resolve) => {
        karte.resolve = resolve;
      }),
  );
  const search = vi.fn(async () => []);
  return { luecken, search, antworten: (v: unknown) => karte.resolve(v) };
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
/** Steht gerade ein Baum? F1b baut je Sprache einen neuen — ohne den vorigen liegen zu lassen. */
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function abbauen(): void {
  if (!steht) return;
  act(() => root.unmount());
  container.remove();
  steht = false;
}

async function mount(): Promise<void> {
  abbauen();
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
  steht = true;
}

/** Eine Themenkarte, damit das Netz erscheint — der Gegenstand dieser Datei liegt DARUNTER. */
const THEMENKARTE = {
  themen: [
    { thema: "ventil", objekte: 5, farbe: "belegt", ohneKanten: false },
    { thema: "dichtung", objekte: 3, farbe: "freigegeben", ohneKanten: false },
  ],
  kanten: [{ a: "dichtung", b: "ventil", gewicht: 1 }],
  weitere: [],
  weitereAbgeschnitten: false,
  mindesthaeufigkeit: 1,
  unterdruecktDurchUbiquitaet: 0,
};

const thema = (
  name: string,
  objekte: number,
  sichtbareBeitragende: number,
  beitragendeAbgeschnitten = false,
) => ({ thema: name, objekte, sichtbareBeitragende, beitragendeAbgeschnitten });

/**
 * F2/F4: die Servierreihenfolge ist bewusst NICHT die Lesereihenfolge, und alle drei Stufen des
 * Vertrags werden gebraucht — Beitragende (abfuellung 0 zuerst), dann Objekte (dichtung/pumpe 3 vor
 * ventil 5), dann alphabetisch (dichtung vor pumpe).
 */
const VIER_THEMEN = [
  thema("ventil", 5, 2),
  thema("abfuellung", 9, 0),
  thema("pumpe", 3, 2),
  thema("dichtung", 3, 2),
];
const VIER_GELESEN = ["abfuellung", "dichtung", "pumpe", "ventil"];

/**
 * Die drei Gesamtbeschriftungen. JEDE muss im eigenen Wort sagen, dass sie das SICHTBARE zaehlt —
 * der Kartentitel und der Fussnotensatz reichen nicht: wer nur eine Zeile liest, liest genau diese
 * eine (Lehre JOB 3067 R1, Ben: „Davon ohne Schlagwort" liess offen, wovon).
 */
const GESAMT_LABEL = [
  "metrik-objekte-gesamt-label",
  "metrik-ohne-thema-label",
  "metrik-beitragende-gesamt-label",
] as const;

/**
 * Das Sichtbarkeitswort je Sprache, die `i18n.ts` fuehrt — als STAMM, nicht als ganzes Wort:
 * das Niederlaendische flektiert („zichtbaar" praedikativ, „zichtbare" attributiv), ein Test auf
 * „zichtbaar" wuerde die falsche Form „Zichtbaar objecten" erzwingen. „zichtba" deckt beide.
 */
const SICHTWORT: Readonly<Record<string, string>> = {
  de: "sichtbar",
  en: "visible",
  nl: "zichtba",
};

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const text = (id: string): string | null => marke(id)?.textContent ?? null;
const zeilen = (): Element[] => alle("metrik-thema");
const zeilenThemen = (): (string | null)[] => zeilen().map((z) => z.getAttribute("data-thema"));

async function mitAntwort(antwort: unknown): Promise<void> {
  await mount();
  await act(async () => {
    d.antworten(antwort);
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  onlineManager.setOnline(true);
});

afterEach(() => {
  abbauen();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3067 V4 · die Sichtmetrik wird ablesbar — ohne ein Urteil zu faellen", () => {
  it("F1 · die drei Gesamtzahlen stehen auf der Flaeche, jede an ihrem eigenen Traeger und mit ihrer eigenen Sichtbarkeits-Beschriftung", async () => {
    await mitAntwort({
      objekteGesamt: 12,
      ohneThema: 3,
      sichtbareBeitragendeGesamt: 4,
      themen: VIER_THEMEN,
      themenkarte: THEMENKARTE,
    });

    expect(marke("netz-metrik"), "die Ablesekarte steht unter dem Netz").not.toBeNull();
    expect(text("metrik-objekte-gesamt")).toBe("12");
    expect(text("metrik-ohne-thema")).toBe("3");
    expect(text("metrik-beitragende-gesamt")).toBe("4");
    // Jede Zahl traegt ihre eigene Beschriftung, und jede dieser drei sagt fuer sich, dass sie das
    // SICHTBARE zaehlt. Nicht nur die Beitragenden: auch „Objekte" und „ohne Schlagwort" sind
    // getrimmte Mengen, und eine Beschriftung, die das verschweigt, behauptet mehr als die Daten
    // hergeben.
    for (const traeger of GESAMT_LABEL) {
      const beschriftung = text(traeger);
      expect(beschriftung, `${traeger} fehlt`).not.toBeNull();
      expect(beschriftung?.toLowerCase(), `${traeger}: „${beschriftung}"`).toContain(SICHTWORT.de);
    }
    // Die Karte des Netzes bleibt, wo sie war — die Flaeche steht DARUNTER, nicht darin.
    expect(marke("themenkarte")).not.toBeNull();
  });

  it("F1b · dieselbe Wortbindung in jeder Sprache, die i18n.ts fuehrt — de, en, nl", async () => {
    for (const [sprache, wort] of Object.entries(SICHTWORT)) {
      await i18n.changeLanguage(sprache);
      await mitAntwort({
        objekteGesamt: 12,
        ohneThema: 3,
        sichtbareBeitragendeGesamt: 4,
        themen: VIER_THEMEN,
        themenkarte: THEMENKARTE,
      });

      // Erst der Beweis, dass ueberhaupt die uebersetzte Flaeche steht und nicht ein Schluesselname.
      expect(text("metrik-ohne-thema"), `${sprache}: die Zahl steht`).toBe("3");
      for (const traeger of GESAMT_LABEL) {
        const beschriftung = text(traeger);
        expect(beschriftung, `${sprache}/${traeger} fehlt`).not.toBeNull();
        expect(
          beschriftung?.toLowerCase(),
          `${sprache}/${traeger}: „${beschriftung}" nennt „${wort}" nicht`,
        ).toContain(wort);
      }
    }
  });

  it("F2 · die Lesereihenfolge ist deterministisch (Beitragende, Objekte, Name) und jede Zeile fuehrt in die bestehende Bibliothek", async () => {
    await mitAntwort({
      objekteGesamt: 20,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 3,
      themen: VIER_THEMEN,
      themenkarte: THEMENKARTE,
    });

    expect(zeilenThemen()).toEqual(VIER_GELESEN);
    const erste = zeilen()[0];
    expect(erste?.querySelector("a")?.getAttribute("href")).toBe("/bibliothek?tag=abfuellung");
    expect(erste?.querySelector('[data-testid="metrik-thema-objekte"]')?.textContent).toBe(
      i18n.t("wissensnetz.metrik.zeile.objekte", { count: 9 }),
    );
    expect(erste?.querySelector('[data-testid="metrik-thema-beitragende"]')?.textContent).toBe(
      i18n.t("wissensnetz.metrik.zeile.beitragende", { count: 0 }),
    );
    // Kein zweiter Weg in die Bibliothek: derselbe `themenHref` wie Seitenleiste und „Alle Themen".
    expect(
      zeilen()[3]?.querySelector("a")?.getAttribute("href"),
      "auch die letzte Zeile geht denselben Weg",
    ).toBe("/bibliothek?tag=ventil");
    // Jede Zeile traegt genau EINEN Weg — kein zweiter Knopf daneben.
    expect(zeilen().map((z) => z.querySelectorAll("a").length)).toEqual([1, 1, 1, 1]);
  });

  it("F3 · ist die Beitragendenliste am Deckel beschnitten, sagt die Zeile „mindestens N“ — die Zahl ist eine Untergrenze", async () => {
    await mitAntwort({
      objekteGesamt: 30,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 25,
      themen: [thema("gedeckelt", 30, 25, true), thema("klein", 1, 1, false)],
      themenkarte: THEMENKARTE,
    });

    const gedeckelt = container.querySelector(
      '[data-testid="metrik-thema"][data-thema="gedeckelt"]',
    );
    const klein = container.querySelector('[data-testid="metrik-thema"][data-thema="klein"]');
    expect(gedeckelt?.querySelector('[data-testid="metrik-thema-beitragende"]')?.textContent).toBe(
      i18n.t("wissensnetz.metrik.zeile.beitragendeMindestens", { count: 25 }),
    );
    expect(
      gedeckelt?.querySelector('[data-testid="metrik-thema-beitragende"]')?.textContent,
    ).toContain("mindestens");
    // Die ungedeckelte Zeile sagt es NICHT — sonst waere „mindestens" ein Dauerwort ohne Aussage.
    expect(
      klein?.querySelector('[data-testid="metrik-thema-beitragende"]')?.textContent,
    ).not.toContain("mindestens");
  });

  it("F4 · die Fessel: kein Urteilswort auf der Flaeche, und jede Beitragendenzahl traegt „sichtbar“", async () => {
    await mitAntwort({
      objekteGesamt: 20,
      ohneThema: 2,
      sichtbareBeitragendeGesamt: 3,
      themen: VIER_THEMEN,
      themenkarte: THEMENKARTE,
    });

    const flaeche = container.textContent ?? "";
    // Woerter, die eine Bewertung waeren. „gap" und „arm" mit Wortgrenze: sie stecken sonst
    // harmlos in deutschen Woertern (Alarm, Warmluft) und der Test soll die Aussage messen,
    // nicht die Buchstabenfolge.
    for (const wort of ["lücke", "luecke", "fehlt", "fehlend", "leer"]) {
      expect(flaeche.toLowerCase(), `Urteilswort „${wort}" auf der Flaeche`).not.toContain(wort);
    }
    for (const wort of ["gap", "arm"]) {
      expect(flaeche, `Urteilswort „${wort}" auf der Flaeche`).not.toMatch(
        new RegExp(`\\b${wort}\\b`, "i"),
      );
    }
    // Jede Beitragenden-Beschriftung sagt, dass sie sich auf das SICHTBARE bezieht.
    const beitragende = [
      text("metrik-beitragende-gesamt-label"),
      ...alle("metrik-thema-beitragende").map((e) => e.textContent),
    ];
    expect(beitragende.length).toBe(5);
    for (const b of beitragende) {
      expect(b?.toLowerCase(), JSON.stringify(beitragende)).toContain("sichtbar");
    }
    // Und die Ueberschrift der Liste nennt die Lesereihenfolge, nicht eine Rangfolge von Maengeln.
    expect(text("metrik-themen-titel")).toBe(i18n.t("wissensnetz.metrik.themenTitel"));
  });

  it("F5 · Bestand ohne ein einziges Schlagwort: der Leersatz UND die drei Zahlen — 9 Objekte sind kein leerer Bestand", async () => {
    await mitAntwort({
      objekteGesamt: 9,
      ohneThema: 9,
      sichtbareBeitragendeGesamt: 2,
      themen: [],
      themenkarte: undefined,
    });

    expect(container.textContent).toContain(i18n.t("wissensnetz.leer"));
    expect(marke("themenkarte"), "ohne Karte kein Netz").toBeNull();
    expect(text("metrik-objekte-gesamt")).toBe("9");
    expect(text("metrik-ohne-thema")).toBe("9");
    expect(text("metrik-beitragende-gesamt")).toBe("2");
    // Keine Themenliste, weil es kein Thema gibt — und kein leerer Listenrahmen.
    expect(zeilen()).toHaveLength(0);
    expect(marke("metrik-themen")).toBeNull();
  });

  it("F6a · scheitert die Auffrischung, bleiben die Zahlen stehen — dazu der Stand", async () => {
    await mitAntwort({
      objekteGesamt: 12,
      ohneThema: 3,
      sichtbareBeitragendeGesamt: 4,
      themen: VIER_THEMEN,
      themenkarte: THEMENKARTE,
    });
    expect(text("metrik-objekte-gesamt")).toBe("12");

    d.luecken.mockImplementationOnce(() => Promise.reject(new Error("Pruefstand: Netz gestoert")));
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["wissensnetz", "luecken"] });
      await flush();
    });

    expect(text("metrik-objekte-gesamt"), "die zuletzt geholten Zahlen bleiben").toBe("12");
    expect(text("metrik-ohne-thema")).toBe("3");
    expect(text("metrik-beitragende-gesamt")).toBe("4");
    expect(zeilenThemen()).toEqual(VIER_GELESEN);
    expect(text("netz-auffrischung-hinweis")).toMatch(
      /^Stand von \d{2}:\d{2} · Auffrischung fehlgeschlagen$/,
    );
  });

  it("F6b · keine Antwort (weder Laden noch Fehler noch Daten): keine einzige Zahl, und kein „0“ als Ersatz", async () => {
    onlineManager.setOnline(false);
    await mount();

    expect(d.luecken, "offline wird nichts abgerufen").not.toHaveBeenCalled();
    expect(text("netz-keine-antwort")).toBe(i18n.t("wissensnetz.keineAntwort"));
    expect(marke("netz-metrik"), "keine Ablesekarte ohne Antwort").toBeNull();
    expect(marke("metrik-objekte-gesamt")).toBeNull();
    expect(marke("metrik-ohne-thema")).toBeNull();
    expect(marke("metrik-beitragende-gesamt")).toBeNull();
    expect(zeilen()).toHaveLength(0);
    // Insbesondere steht keine erfundene Null da, wo eine Zahl stuende.
    expect(container.textContent ?? "").not.toMatch(/\b0\b/);
  });

  it("F7 · hoechstens 40 Zeilen; der Rest liegt hinter einem Aufklapper, dessen Schalter die verborgene Zahl nennt", async () => {
    // 45 Themen — der Server deckelt bei 200 (`lesemodell.ts` THEMEN_DECKEL), die Flaeche bei 40.
    const viele = Array.from({ length: 45 }, (_, i) =>
      thema(`thema-${String(i + 1).padStart(2, "0")}`, 1, i),
    );
    await mitAntwort({
      objekteGesamt: 45,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 45,
      themen: viele,
      themenkarte: THEMENKARTE,
    });

    expect(zeilen()).toHaveLength(40);
    expect(zeilenThemen()[0]).toBe("thema-01");
    expect(zeilenThemen()[39]).toBe("thema-40");
    const schalter = marke("metrik-mehr-schalter");
    expect(schalter?.textContent).toBe(i18n.t("wissensnetz.metrik.mehr", { count: 5 }));
    await act(async () => {
      (schalter as HTMLButtonElement).click();
      await flush();
    });
    expect(zeilen()).toHaveLength(45);
    expect(zeilenThemen()[44]).toBe("thema-45");
  });

  it("F8 · `ohneThema` bekommt KEINEN Link — es gibt keinen Bibliotheksfilter, der genau diese Menge trifft", async () => {
    await mitAntwort({
      objekteGesamt: 9,
      ohneThema: 4,
      sichtbareBeitragendeGesamt: 2,
      themen: [],
      themenkarte: undefined,
    });

    const block = marke("metrik-ohne-thema-block");
    expect(block).not.toBeNull();
    expect(block?.querySelector("a"), "kein toter Knopf").toBeNull();
    expect(block?.querySelector("button")).toBeNull();
    expect(text("metrik-ohne-thema-hinweis")).toBe(i18n.t("wissensnetz.metrik.ohneThemaHinweis"));
  });
});
