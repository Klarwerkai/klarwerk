// @vitest-environment jsdom
// ================================================================================================
// JOB 3070 · V6 — DER LESEWEG DES WISSENSNETZES: SÄTZE STATT DER ZEICHNUNG, DIESELBE QUELLE.
// ================================================================================================
//
// DER AUSGANGSFEHLER, geometrisch und nicht gefuehlt: Die Zeile der `Karte` traegt die
// Zeichenflaeche (mindestens 200 px, `Wissensnetz.tsx:746`) NEBEN einer Leiste fester Breite
// (340 px, `:630`) plus 32 px Polster — zusammen 572 px Mindestbreite; `overflow-hidden` (`:793`)
// schneidet darunter ab. Ein Telefon hat rund 390 px. Bis JOB 3070 stand dort die abgeschnittene
// Zeichnung, und in Worten sagten die Zeilen nur die zwei Zahlen von JOB 3067 — nicht den Zustand
// (Fuellfarbe), nicht die Ubiquitaet (Strichelung), nicht das gemeinsame Vorkommen (Kante).
//
// DIE FESSEL VON JOB 3067 GILT WEITER (`luecken.ts:13-16`): die Sicht ist VOR der Auswertung
// getrimmt. Deshalb faellt auch der Leseweg kein Urteil — und vor allem entsteht bei einem
// FEHLENDEN Kartenknoten KEIN negativer Satz: „kommt mit keinem Thema zusammen vor" waere eine
// Behauptung ohne Grundlage (die Karte fuehrt hoechstens 40 Knoten, `metrik.themen` bis 200).
// Genau dafuer ist `zusammenMit` `null` und nicht `[]`.
//
//   L1  leseThemen · Knoten mit zwei Nachbarn   → Zustand, ubiquitaer false, beide Kantenrichtungen
//   L2  leseThemen · Thema OHNE Knoten          → alle drei Felder null, Zahlen unveraendert
//   L3  leseThemen · Knoten mit ohneKanten      → zusammenMit null, NICHT []
//   L4  leseThemen · keine themenkarte          → alle drei Felder null
//   L5  leseThemen · Reihenfolge                → unveraendert die von JOB 3067
//   L6  GERENDERT · zusammenMit null            → kein Traeger, kein „keine/ohne/leer" fuer das Feld
//   L7  GERENDERT · schmales Fenster            → kein <svg>, keine Seitenleiste, kein Umschalter
//   L8  GERENDERT · breites Fenster             → Vorgabe „Netz", „Lesen" nimmt das <svg> aus dem DOM
//   L9  GERENDERT · de/en/nl                    → jede Zahl-Beschriftung traegt ihr Sichtbarkeitswort
//
// Bauform wie tests/wissensnetz-sichtmetrik/flaeche.test.tsx: jsdom, relative Importe ueber
// `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock. Die Endpointgrenze ist die einzige
// Attrappe — Seite, i18n, React-Query und Router sind echt. `matchMedia` fehlt in jsdom; L7/L8
// setzen es ausdruecklich, und der Ausgangszustand (gar kein `matchMedia`) ist „breit".
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
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { Sichtmetrik } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { Wissensnetz, leseThemen } from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- Die Attrappe fuer `matchMedia` -------------------------------------------------------------
// Sie ist bewusst so schmal wie moeglich: sie beantwortet GENAU die Abfrage der Seite und fuehrt
// ihre Hoerer, damit ein Wechsel der Breite auch ankommt. Ohne sie (Ausgangszustand von jsdom) gilt
// „breit" — genau das prueft L8 mit.
type Hoerer = () => void;
let hoerer: Hoerer[] = [];
function setzeBreite(schmal: boolean): void {
  hoerer = [];
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    matches: schmal && /max-width:\s*899px/.test(abfrage),
    media: abfrage,
    addEventListener: (_typ: string, fn: Hoerer) => {
      hoerer.push(fn);
    },
    removeEventListener: (_typ: string, fn: Hoerer) => {
      hoerer = hoerer.filter((h) => h !== fn);
    },
  });
}
function ohneMatchMedia(): void {
  hoerer = [];
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = undefined;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

async function mitAntwort(antwort: unknown): Promise<void> {
  await mount();
  await act(async () => {
    d.antworten(antwort);
    await flush();
  });
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const zeile = (thema: string): Element | null =>
  container.querySelector(`[data-testid="metrik-thema"][data-thema="${thema}"]`);

const thema = (
  name: string,
  objekte: number,
  sichtbareBeitragende: number,
  beitragendeAbgeschnitten = false,
) => ({ thema: name, objekte, sichtbareBeitragende, beitragendeAbgeschnitten });
const knoten = (name: string, objekte: number, farbe: string, ohneKanten = false) => ({
  thema: name,
  objekte,
  farbe,
  ohneKanten,
});

/**
 * Der Bestand, an dem alles haengt: „ventil" traegt einen Knoten mit ZWEI Nachbarn, und beide
 * Kanten sind ABSICHTLICH verschieden herum notiert („dichtung—ventil" und „ventil—pumpe") — nur so
 * misst L1, dass beide Richtungen gelesen werden. „abfuellung" steht in `themen`, aber NICHT in der
 * Karte: das ist der Fall, der kein negatives Wort erzeugen darf.
 */
const KARTE = {
  themen: [
    knoten("ventil", 5, "belegt"),
    knoten("dichtung", 3, "freigegeben"),
    knoten("pumpe", 3, "offen"),
  ],
  kanten: [
    { a: "dichtung", b: "ventil", gewicht: 1 },
    { a: "ventil", b: "pumpe", gewicht: 2 },
  ],
  weitere: [],
  weitereAbgeschnitten: false,
  mindesthaeufigkeit: 1,
  unterdruecktDurchUbiquitaet: 0,
};
const VIER_THEMEN = [
  thema("ventil", 5, 2),
  thema("abfuellung", 9, 0),
  thema("pumpe", 3, 2),
  thema("dichtung", 3, 2),
];
const METRIK = {
  objekteGesamt: 20,
  ohneThema: 2,
  sichtbareBeitragendeGesamt: 4,
  themen: VIER_THEMEN,
  themenkarte: KARTE,
} as unknown as Sichtmetrik;

/** Die zwei Zahl-Beschriftungen der Leseansicht und das Sichtbarkeitswort je Sprache (wie F1b). */
const SICHTWORT: Readonly<Record<string, string>> = {
  de: "sichtbar",
  en: "visible",
  nl: "zichtba",
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  ohneMatchMedia();
});

afterEach(() => {
  abbauen();
  ohneMatchMedia();
  vi.clearAllMocks();
});

describe("JOB 3070 V6 · leseThemen — die Zeichnung in Worten, ohne eigene Rechnung", () => {
  it("L1 · Thema mit Knoten und zwei Nachbarn: Zustand, ubiquitaer false, zusammenMit alphabetisch, dublettenfrei, beide Kantenrichtungen", () => {
    const zeilen = leseThemen(METRIK);
    const v = zeilen.find((z) => z.thema === "ventil");
    expect(v).toBeDefined();
    expect(v?.zustand).toBe("belegt");
    expect(v?.ubiquitaer).toBe(false);
    // „dichtung—ventil" steht mit `ventil` als b, „ventil—pumpe" mit `ventil` als a: nur wer BEIDE
    // Richtungen liest, findet zwei Nachbarn. Alphabetisch, jeder genau einmal.
    expect(v?.zusammenMit).toEqual(["dichtung", "pumpe"]);
    expect(zeilen.find((z) => z.thema === "dichtung")?.zusammenMit).toEqual(["ventil"]);
    expect(zeilen.find((z) => z.thema === "pumpe")?.zusammenMit).toEqual(["ventil"]);
    // Die Zahlen kommen unveraendert aus `metrik.themen` — nichts wird hier ausgerechnet.
    expect(v?.objekte).toBe(5);
    expect(v?.sichtbareBeitragende).toBe(2);
    expect(v?.beitragendeAbgeschnitten).toBe(false);
  });

  it("L2 · Thema OHNE Knoten (in metrik.themen, nicht in themenkarte.themen): zustand, ubiquitaer und zusammenMit sind null", () => {
    const a = leseThemen(METRIK).find((z) => z.thema === "abfuellung");
    expect(a).toBeDefined();
    expect(a?.zustand).toBeNull();
    expect(a?.ubiquitaer).toBeNull();
    // NICHT `[]`: die Karte fuehrt hoechstens 40 Knoten, `metrik.themen` bis 200 — ueber das
    // gemeinsame Vorkommen dieses Themas ist schlicht nichts erhoben.
    expect(a?.zusammenMit).toBeNull();
    expect(a?.objekte).toBe(9);
    expect(a?.sichtbareBeitragende).toBe(0);
  });

  it("L3 · Knoten mit ohneKanten: zusammenMit ist null, NICHT die leere Liste — ein ubiquitaeres Thema bekommt grundsaetzlich keine Kanten", () => {
    const metrik = {
      ...METRIK,
      themenkarte: {
        ...KARTE,
        themen: [knoten("ventil", 5, "belegt", true), knoten("dichtung", 3, "freigegeben")],
        kanten: [],
      },
    } as unknown as Sichtmetrik;
    const v = leseThemen(metrik).find((z) => z.thema === "ventil");
    expect(v?.ubiquitaer).toBe(true);
    expect(v?.zustand).toBe("belegt");
    expect(v?.zusammenMit).toBeNull();
    expect(v?.zusammenMit).not.toEqual([]);
    // Der NICHT ubiquitaere Knoten ohne Kanten ist ein anderer Fall: dort ist nachgesehen worden.
    expect(leseThemen(metrik).find((z) => z.thema === "dichtung")?.zusammenMit).toEqual([]);
  });

  it("L4 · fehlt die themenkarte ganz, sind alle drei Felder null — und die Zahlen bleiben unveraendert", () => {
    const metrik = {
      objekteGesamt: 20,
      ohneThema: 2,
      sichtbareBeitragendeGesamt: 4,
      themen: VIER_THEMEN,
    } as unknown as Sichtmetrik;
    const zeilen = leseThemen(metrik);
    expect(zeilen).toHaveLength(4);
    for (const z of zeilen) {
      expect(z.zustand, z.thema).toBeNull();
      expect(z.ubiquitaer, z.thema).toBeNull();
      expect(z.zusammenMit, z.thema).toBeNull();
    }
    expect(zeilen.map((z) => z.objekte)).toEqual([9, 3, 3, 5]);
  });

  it("L5 · die Reihenfolge ist unveraendert die von JOB 3067: Beitragende, dann Objekte, dann Name", () => {
    expect(leseThemen(METRIK).map((z) => z.thema)).toEqual([
      "abfuellung",
      "dichtung",
      "pumpe",
      "ventil",
    ]);
  });
});

describe("JOB 3070 V6 · die gerenderte Seite — der Leseweg an der echten Komponente", () => {
  it("L6 · bei zusammenMit null steht KEIN Zusammen-Traeger im DOM und kein negatives Wort in dieser Zeile", async () => {
    await mitAntwort(METRIK);

    // (a) Thema ohne Kartenknoten: keiner der drei Traeger, und kein Wort, das etwas verneint.
    const ohneKnoten = zeile("abfuellung");
    expect(ohneKnoten, "die Zeile steht").not.toBeNull();
    expect(ohneKnoten?.querySelector('[data-testid="metrik-thema-zusammen"]')).toBeNull();
    expect(ohneKnoten?.querySelector('[data-testid="metrik-thema-zustand"]')).toBeNull();
    expect(ohneKnoten?.querySelector('[data-testid="metrik-thema-ubiquitaer"]')).toBeNull();
    const text = ohneKnoten?.textContent ?? "";
    for (const wort of ["gemeinsam", "kein", "ohne", "leer", "nicht"]) {
      expect(text.toLowerCase(), `„${wort}" in „${text}"`).not.toContain(wort);
    }
    // Die Zeile sagt genau das, was erhoben ist — als SATZ, nicht als Bruchstueckkette
    // (JOB 3070 D2, Korrekturpflicht 3): Name, Doppelpunkt, die zwei Zahlensaetze, Schlusspunkt.
    expect(text).toBe(
      `abfuellung: ${i18n.t("wissensnetz.metrik.zeile.objekte", { count: 9 })}, ${i18n.t(
        "wissensnetz.metrik.zeile.beitragende",
        { count: 0 },
      )}.`,
    );

    // (b) Das Gegenstueck: wo es Nachbarn GIBT, steht der Satz mit den Namen — sonst misst (a) nur,
    // dass die Leseansicht gar nichts kann.
    const mitNachbarn = zeile("ventil");
    expect(mitNachbarn?.querySelector('[data-testid="metrik-thema-zusammen"]')?.textContent).toBe(
      i18n.t("wissensnetz.lesen.zusammen", { themen: "dichtung, pumpe" }),
    );
    expect(mitNachbarn?.querySelector('[data-testid="metrik-thema-zustand"]')?.textContent).toBe(
      i18n.t("wissensnetz.lesen.zustand", { wort: i18n.t("wissensnetz.farbe.belegt") }),
    );
    // Und der Weg in die Bibliothek bleibt der EINE vorhandene — kein zweiter Link je Zeile.
    expect(mitNachbarn?.querySelectorAll("a").length).toBe(1);
    expect(mitNachbarn?.querySelector("a")?.getAttribute("href")).toBe("/bibliothek?tag=ventil");
  });

  it("L6b · ein ubiquitaerer Knoten sagt, WARUM kein Zusammen-Satz danebensteht — statt zu behaupten, es gaebe keine Nachbarn", async () => {
    await mitAntwort({
      ...METRIK,
      themenkarte: {
        ...KARTE,
        themen: [knoten("ventil", 5, "belegt", true), knoten("dichtung", 3, "belegt")],
        kanten: [],
      },
    });

    const v = zeile("ventil");
    expect(v?.querySelector('[data-testid="metrik-thema-ubiquitaer"]')?.textContent).toBe(
      i18n.t("wissensnetz.lesen.ubiquitaer"),
    );
    expect(v?.querySelector('[data-testid="metrik-thema-zusammen"]')).toBeNull();
    // Der nicht-ubiquitaere Knoten ohne Nachbarn bekommt KEINEN Ubiquitaetssatz — sonst waere er ein
    // Dauerwort ohne Aussage.
    expect(zeile("dichtung")?.querySelector('[data-testid="metrik-thema-ubiquitaer"]')).toBeNull();
    expect(zeile("dichtung")?.querySelector('[data-testid="metrik-thema-zusammen"]')).toBeNull();
  });

  it("L7 · schmales Fenster: kein <svg>, keine Seitenleiste, kein Umschalter — die Themenzeilen stehen an ihrer Stelle", async () => {
    setzeBreite(true);
    await mitAntwort(METRIK);

    expect(container.querySelector("svg"), "die Zeichnung ist NICHT im DOM").toBeNull();
    expect(marke("themenkarte")).toBeNull();
    expect(marke("netz-seitenleiste"), "auch die 340-px-Leiste ist weg").toBeNull();
    expect(marke("netz-umschalter"), "auf schmal gibt es nichts zu waehlen").toBeNull();
    // Was BLEIBT: die Ablesekarte von JOB 3067 und der Leseweg.
    expect(marke("netz-metrik")).not.toBeNull();
    expect(alle("metrik-thema")).toHaveLength(4);
    expect(zeile("ventil")?.querySelector('[data-testid="metrik-thema-zusammen"]')).not.toBeNull();
  });

  it("L8 · breites Fenster: Vorgabe „Netz“ zeigt die Zeichnung, „Lesen“ nimmt sie aus dem DOM, „Netz“ bringt sie zurück — aria-pressed folgt", async () => {
    setzeBreite(false);
    await mitAntwort(METRIK);

    const netz = marke("netz-ansicht-netz") as HTMLButtonElement | null;
    const lesen = marke("netz-ansicht-lesen") as HTMLButtonElement | null;
    expect(netz, "der Umschalter steht auf breiten Fenstern").not.toBeNull();
    // Die Gruppenbeschriftung sitzt an einem echten <fieldset> — implizite Rolle plus aria-label.
    expect(marke("netz-umschalter")?.tagName).toBe("FIELDSET");
    expect(marke("netz-umschalter")?.getAttribute("aria-label")).toBe(
      i18n.t("wissensnetz.lesen.gruppe"),
    );
    expect(netz?.getAttribute("aria-pressed"), "Vorgabe ist Netz").toBe("true");
    expect(lesen?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(marke("netz-seitenleiste")).not.toBeNull();

    await act(async () => {
      lesen?.click();
      await flush();
    });
    expect(
      container.querySelector("svg"),
      "auf „Lesen“ verlaesst die Zeichnung das DOM",
    ).toBeNull();
    expect(marke("netz-seitenleiste")).toBeNull();
    expect((marke("netz-ansicht-lesen") as HTMLButtonElement).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect((marke("netz-ansicht-netz") as HTMLButtonElement).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(alle("metrik-thema")).toHaveLength(4);

    await act(async () => {
      (marke("netz-ansicht-netz") as HTMLButtonElement).click();
      await flush();
    });
    expect(container.querySelector("svg")).not.toBeNull();
    expect((marke("netz-ansicht-netz") as HTMLButtonElement).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("L8b · ohne matchMedia (jsdom, SSR) gilt „breit“ — kein Aufhaenger, die Zeichnung steht", async () => {
    ohneMatchMedia();
    await mitAntwort(METRIK);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(marke("netz-umschalter")).not.toBeNull();
  });

  it("L9 · de/en/nl: jede Zahl-Beschriftung der Leseansicht traegt ihr sprachgerechtes Sichtbarkeitswort", async () => {
    for (const [sprache, wort] of Object.entries(SICHTWORT)) {
      await i18n.changeLanguage(sprache);
      setzeBreite(true);
      await mitAntwort(METRIK);

      const zahlen = [
        ...alle("metrik-thema-objekte").map((e) => e.textContent),
        ...alle("metrik-thema-beitragende").map((e) => e.textContent),
      ];
      expect(zahlen.length, `${sprache}: acht Zahlensaetze`).toBe(8);
      for (const z of zahlen) {
        expect(z?.toLowerCase(), `${sprache}: „${z}" nennt „${wort}" nicht`).toContain(wort);
      }
      // Beweis, dass wirklich die uebersetzte Flaeche steht und kein roher Schluessel: die drei
      // neuen Saetze kommen aus dem Woerterbuch dieser Sprache.
      const v = zeile("ventil");
      expect(v?.querySelector('[data-testid="metrik-thema-zusammen"]')?.textContent).toBe(
        i18n.t("wissensnetz.lesen.zusammen", { themen: "dichtung, pumpe" }),
      );
      expect(v?.querySelector('[data-testid="metrik-thema-zusammen"]')?.textContent).not.toContain(
        "wissensnetz.",
      );
      expect(v?.querySelector('[data-testid="metrik-thema-zustand"]')?.textContent).toBe(
        i18n.t("wissensnetz.lesen.zustand", { wort: i18n.t("wissensnetz.farbe.belegt") }),
      );
    }
  });

  // ==============================================================================================
  // JOB 3070 D2 · KORREKTURPFLICHT 3 — DER VORLESETEST: DIE GANZE ZEILE, NICHT IHRE BRUCHSTUECKE.
  // ==============================================================================================
  //
  // D1 pinnte in L6 noch `abfuellung9 sichtbare Objekte0 sichtbare Beitragende` als `textContent`
  // — vier Bruchstuecke ohne eine einzige hoerbare Trennung. Ein Vorleser liest den Textinhalt,
  // nicht das Flex-Layout: fuer ihn stand dort ein Wort. Dieser Fall misst deshalb NICHT einzelne
  // Traeger, sondern den vollstaendigen zugaenglichen Zeilentext — in jeder Sprache.
  it("L10 · de/en/nl: die ganze Zeile ist EIN vorlesbarer Satz mit hoerbaren Trennungen", async () => {
    for (const sprache of Object.keys(SICHTWORT)) {
      await i18n.changeLanguage(sprache);
      setzeBreite(true);
      await mitAntwort(METRIK);

      // (a) Die Zeile MIT allen drei Saetzen: Name, Doppelpunkt, zwei Zahlen mit Komma, Punkt,
      //     dann Zustandssatz und Zusammen-Satz — jeder mit eigenem Schlusspunkt, getrennt durch
      //     ein echtes Leerzeichen.
      const erwartetVentil = [
        `ventil: ${i18n.t("wissensnetz.metrik.zeile.objekte", { count: 5 })}`,
        `, ${i18n.t("wissensnetz.metrik.zeile.beitragende", { count: 2 })}.`,
        ` ${i18n.t("wissensnetz.lesen.zustand", { wort: i18n.t("wissensnetz.farbe.belegt") })}`,
        ` ${i18n.t("wissensnetz.lesen.zusammen", { themen: "dichtung, pumpe" })}`,
      ].join("");
      expect(zeile("ventil")?.textContent, `${sprache}: ganzer Zeilentext`).toBe(erwartetVentil);

      // (b) Die Zeile OHNE Kartenknoten endet nach dem Zahlensatz — kein loser Punkt, kein
      //     Leerzeichen am Ende, kein Platzhalter.
      const erwartetOhne = `abfuellung: ${i18n.t("wissensnetz.metrik.zeile.objekte", {
        count: 9,
      })}, ${i18n.t("wissensnetz.metrik.zeile.beitragende", { count: 0 })}.`;
      expect(zeile("abfuellung")?.textContent, `${sprache}: Zeile ohne Knoten`).toBe(erwartetOhne);

      // (c) DIE EIGENSCHAFT, die den Rueckfall auf D1 rot macht, unabhaengig vom Wortlaut:
      //     jede Zeile endet auf einen Punkt, und nirgends stossen Wort und Zahl ohne Trennung
      //     aneinander („Objekte0"). Genau das war der Befund.
      for (const z of alle("metrik-thema")) {
        const text = z.textContent ?? "";
        expect(text, `${sprache}: „${text}" endet nicht auf einen Punkt`).toMatch(/\.$/);
        expect(text, `${sprache}: Buchstabe direkt an Ziffer in „${text}"`).not.toMatch(
          /\p{L}\p{N}|\p{N}\p{L}/u,
        );
        // Und die Zeichensetzung ist wirklich da, nicht nur zufaellig kein Zusammenstoss.
        expect(text, `${sprache}: kein Doppelpunkt in „${text}"`).toContain(": ");
        expect(text, `${sprache}: kein Komma in „${text}"`).toContain(", ");
        // (d) JEDER Satztraeger ist fuer sich ein Satz: Grossbuchstabe vorn, Punkt hinten. Ohne
        //     diese Prueflinie waere ein Woerterbuch, das den Satzrahmen wieder auf das blosse
        //     Legendenfragment zurueckstellt („freigegeben, ohne Quelle"), unbemerkt gruen — die
        //     Erwartung oben baut sich ja SELBST aus demselben Woerterbuch und wanderte mit.
        for (const anker of ["zustand", "ubiquitaer", "zusammen"]) {
          const satz = z.querySelector(`[data-testid="metrik-thema-${anker}"]`)?.textContent;
          if (satz === undefined || satz === null) {
            continue;
          }
          expect(satz, `${sprache}/${anker}: „${satz}" endet nicht auf einen Punkt`).toMatch(/\.$/);
          expect(satz, `${sprache}/${anker}: „${satz}" beginnt klein`).toMatch(/^\p{Lu}/u);
        }
      }
    }
  });

  // Jeder Knoten, den die Antwort fuehrt, bekommt in der Zeile seines Namens den Zustand — die
  // Zuordnung selbst funktioniert. Dass sie an der ECHTEN Route trotzdem oft ins Leere greift,
  // liegt an den zwei Themenachsen des Servers und ist in
  // `tests/wissensnetz-leseweg/namensraum-kette.test.tsx` gemessen (N1).
  it("L11 · jeder gezeichnete Knoten findet seine Zeile — und eine Zeile ohne Knoten bleibt ohne Zustand", async () => {
    setzeBreite(true);
    await mitAntwort(METRIK);

    const gezeichnet = KARTE.themen.map((k) => k.thema).sort();
    const mitZustand = alle("metrik-thema")
      .filter((z) => z.querySelector('[data-testid="metrik-thema-zustand"]') !== null)
      .map((z) => z.getAttribute("data-thema"))
      .sort();
    expect(mitZustand).toEqual(gezeichnet);
    // Kalibrierung: es gibt wirklich eine Zeile, die KEINEN Knoten hat — sonst misst der Vergleich
    // nur, dass alles gleich ist.
    expect(alle("metrik-thema").length).toBeGreaterThan(gezeichnet.length);
  });

  // ==============================================================================================
  // JOB 3070 D3 · DIE ZWEITE ACHSE WIRD ANGESAGT — die Liste behauptet nicht stumm Vollstaendigkeit.
  // ==============================================================================================
  //
  // Der Server fuehrt `metrik.themen` nach KATEGORIE und die Knoten nach SCHLAGWORT (gemessen in
  // `namensraum-kette.test.tsx`, N1). Diese Seite kann das nicht heilen — `services/**` ist kein
  // Zielpfad —, aber sie darf es nicht verschweigen. Der Satz haengt an der gemessenen Zahl.
  it("L12 · gezeichnete Themen ohne Zeile werden mit ihrer Zahl angesagt — und sonst steht kein Satz", async () => {
    setzeBreite(true);
    // (a) Der Bestand oben: JEDER Knoten hat seine Zeile → kein Satz. Ein Dauerhinweis waere ein
    //     Wort ohne Aussage.
    await mitAntwort(METRIK);
    expect(marke("metrik-themen-zweite-achse"), "nichts anzusagen, also kein Satz").toBeNull();

    // (b) Zwei gezeichnete Themen, die in `themen` nicht vorkommen — genau der Fall der echten
    //     Route bei getrennten Achsen.
    await mitAntwort({
      objekteGesamt: 3,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 1,
      themen: [thema("Hygienic Design", 1, 1)],
      themenkarte: {
        ...KARTE,
        themen: [knoten("Dichtungen", 1, "belegt"), knoten("Ventile", 1, "offen")],
        kanten: [],
      },
    });
    expect(marke("metrik-themen-zweite-achse")?.textContent).toBe(
      i18n.t("wissensnetz.lesen.nichtInListe", { count: 2 }),
    );
    expect(marke("metrik-themen-zweite-achse")?.textContent).toContain("2");
    // Der Satz ist eine ANSAGE, keine zweite Liste: kein Name, kein Link, kein Zaehler je Thema.
    expect(marke("metrik-themen-zweite-achse")?.querySelector("a")).toBeNull();
    for (const name of ["Dichtungen", "Ventile"]) {
      expect(marke("metrik-themen-zweite-achse")?.textContent).not.toContain(name);
    }
    // Und die eine Zeile, die es gibt, behauptet weiterhin nichts ueber Knoten, die sie nicht hat.
    expect(
      zeile("Hygienic Design")?.querySelector('[data-testid="metrik-thema-zustand"]'),
    ).toBeNull();
  });

  it("L12b · de/en/nl: die Ansage kommt aus dem Woerterbuch und nennt die Zahl", async () => {
    for (const sprache of Object.keys(SICHTWORT)) {
      await i18n.changeLanguage(sprache);
      setzeBreite(true);
      await mitAntwort({
        objekteGesamt: 3,
        ohneThema: 0,
        sichtbareBeitragendeGesamt: 1,
        themen: [thema("Hygienic Design", 1, 1)],
        themenkarte: {
          ...KARTE,
          themen: [knoten("Dichtungen", 1, "belegt"), knoten("Ventile", 1, "offen")],
          kanten: [],
        },
      });
      const satz = marke("metrik-themen-zweite-achse")?.textContent ?? "";
      expect(satz, `${sprache}: kein roher Schluessel`).not.toContain("wissensnetz.");
      expect(satz, `${sprache}: keine offene Variable`).not.toContain("{{");
      expect(satz, `${sprache}: die Zahl steht im Satz`).toContain("2");
    }
  });
});
