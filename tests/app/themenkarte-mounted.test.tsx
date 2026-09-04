// @vitest-environment jsdom
// ================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE AM ECHTEN RENDERER.
// ================================================================================================
//
// Die Regeln stehen in `tests/wissensnetz/themenkarte.test.ts` (DOM-frei). Diese Datei prueft den
// SICHTBAREN Vertrag: Erscheint die Karte? Traegt ein Knoten seine Groesse und seine Farbe?
// Fuehrt der Weg in die BESTEHENDE, gefilterte Bibliotheksliste?
//
// JOB 3052 D6: der Klick auf einen Knoten WAEHLT das Thema (die Seitenleiste zeigt seine Objekte
// aus der Bibliothekssuche); der Sprung in die Bibliothek ist der Link „Alle N Objekte oeffnen" in
// der Leiste (K5). Das Layout ist kein Ring mehr, sondern das Netz des Zielbilds: das groesste
// Thema in der Mitte, die uebrigen darum (K8) — weiterhin deterministisch. Die Leiste selbst wird
// in tests/wissensnetz-flaeche/seitenleiste-mounted.test.tsx geprueft; hier antwortet die Suche
// leer, damit die Karte im Vordergrund bleibt.
//
// Bauform wie die Nachbarn (`nav-badges-sidebar-mounted.test.tsx:17-20`): jsdom, relative Importe
// ueber `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock. Die Endpointgrenze ist die
// einzige Attrappe — Seite, i18n, React-Query und Router sind echt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const state = { resolve: (_v: unknown) => {} };
  const fn = vi.fn(
    () =>
      new Promise((resolve) => {
        state.resolve = resolve;
      }),
  );
  const suche = vi.fn(async () => []);
  return { fn, suche, resolve: (v: unknown) => state.resolve(v) };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { wissensnetz: { luecken: d.fn }, library: { search: d.suche } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import {
  Wissensnetz,
  beschriftungen,
  gemeinsamesPraefix,
  netzplaetze,
  themenHref,
  zeichenhoehe,
} from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
}

const KARTE = {
  objekteGesamt: 6,
  ohneThema: 0,
  sichtbareBeitragendeGesamt: 2,
  themen: [],
  themenkarte: {
    themen: [
      { thema: "pumpe", objekte: 4, farbe: "belegt", ohneKanten: false },
      { thema: "dichtung", objekte: 2, farbe: "freigegeben", ohneKanten: false },
      { thema: "pilot-demo", objekte: 6, farbe: "offen", ohneKanten: true },
    ],
    kanten: [{ a: "dichtung", b: "pumpe", gewicht: 2 }],
    weitere: ["randthema"],
    weitereAbgeschnitten: false,
    mindesthaeufigkeit: 1,
  },
};

function knoten(): Element[] {
  return [...container.querySelectorAll('[data-testid="themenknoten"]')];
}

function knotenFuer(thema: string): Element | null {
  return container.querySelector(`[data-testid="themenknoten"][data-thema="${thema}"]`);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2600 D1: die Themenkarte auf der bestehenden Oberflaeche", () => {
  it("K1 · die Karte erscheint, mit einem Knoten je Thema", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    expect(container.querySelector('[data-testid="themenkarte"]')).not.toBeNull();
    expect(knoten().length).toBe(3);
    expect(knotenFuer("pumpe")).not.toBeNull();
  });

  it("K2 · Knotengroesse folgt der Menge zugeordneten Wissens", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    const gross = knotenFuer("pilot-demo")?.querySelector("circle");
    const mittel = knotenFuer("pumpe")?.querySelector("circle");
    const klein = knotenFuer("dichtung")?.querySelector("circle");
    const r = (el: Element | null | undefined) => Number(el?.getAttribute("r") ?? "0");
    // 6 > 4 > 2 Traeger ⇒ streng fallende Radien. Die Zahl steht am Knoten, nicht im Bild.
    expect(r(gross)).toBeGreaterThan(r(mittel));
    expect(r(mittel)).toBeGreaterThan(r(klein));
    expect(knotenFuer("pumpe")?.getAttribute("data-objekte")).toBe("4");
  });

  it("K3 · die Farbe traegt den Freigabe- und Quellenstatus — drei Werte, keine Prozente", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    expect(knotenFuer("pumpe")?.getAttribute("data-farbe")).toBe("belegt");
    expect(knotenFuer("dichtung")?.getAttribute("data-farbe")).toBe("freigegeben");
    expect(knotenFuer("pilot-demo")?.getAttribute("data-farbe")).toBe("offen");
    // Keine Prozentanzeige irgendwo auf der Seite (§3 des Auftrags).
    expect(container.textContent ?? "").not.toMatch(/\d+\s*%/);
  });

  it("K4 · eine Kante wird gezeichnet — und nie an einem ubiquitaeren Thema", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    const kanten = [...container.querySelectorAll('[data-testid="themenkante"]')];
    expect(kanten.length).toBe(1);
    expect(kanten[0]?.getAttribute("data-a")).toBe("dichtung");
    expect(kanten[0]?.getAttribute("data-b")).toBe("pumpe");
    expect(
      kanten.some((k) => k.getAttribute("data-a") === "pilot-demo"),
      "eine Kante haengt am ubiquitaeren Thema",
    ).toBe(false);
  });

  it("K5 · der Klick WAEHLT das Thema, und der Link der Leiste fuehrt in die BESTEHENDE, gefilterte Bibliotheksliste", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    // Vorgabe: das groesste Thema (pilot-demo, 6 Traeger) ist gewaehlt, die Leiste zeigt es.
    expect(knotenFuer("pilot-demo")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-testid="leiste-titel"]')?.textContent).toBe("pilot-demo");
    // Kein Anker mehr am Knoten — der Klick springt nicht, er waehlt.
    expect(knotenFuer("pumpe")?.querySelector("a")).toBeNull();
    await act(async () => {
      (knotenFuer("pumpe") as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flush();
    });
    expect(knotenFuer("pumpe")?.getAttribute("aria-pressed")).toBe("true");
    expect(knotenFuer("pilot-demo")?.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector('[data-testid="leiste-titel"]')?.textContent).toBe("pumpe");
    // Die Leiste hat die Suche mit DEMSELBEN Parameter gefragt wie die Facette der Bibliothek.
    expect(d.suche).toHaveBeenCalledWith({ tag: "pumpe" });
    const link = container.querySelector('[data-testid="leiste-alle"]');
    expect(link?.getAttribute("href")).toBe("/bibliothek?tag=pumpe");
    // Der Name reist kodiert — ein Schlagwort mit Leerzeichen darf die URL nicht zerbrechen.
    expect(themenHref("dampf turbine")).toBe("/bibliothek?tag=dampf%20turbine");
  });

  it("K5c · gewaehlt UND ubiquitaer: der Auswahlstil hat Vorrang (Orange, Rand 2.5), die Strichelung bleibt (Runde 2, BEN)", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });
    // `pilot-demo` ist das groesste Thema (Vorgabe-Auswahl) UND ubiquitaer (`ohneKanten: true`).
    const g = knotenFuer("pilot-demo");
    expect(g?.getAttribute("aria-pressed")).toBe("true");
    const kreis = g?.querySelector("circle");
    expect(kreis?.getAttribute("stroke-width")).toBe("2.5");
    expect(kreis?.getAttribute("stroke-dasharray")).toBe("4 3");
    expect(kreis?.getAttribute("fill-opacity")).toBe("0.14");
    expect((kreis as SVGCircleElement).style.stroke).toContain("--kw-funke-deep");
    expect((kreis as SVGCircleElement).style.fill).toContain("--kw-brand");
    // Nach dem Wechsel traegt derselbe Knoten wieder Randbreite 3 (ubiquitaer, nicht gewaehlt).
    await act(async () => {
      (knotenFuer("pumpe") as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await flush();
    });
    expect(kreis?.getAttribute("stroke-width")).toBe("3");
    expect(kreis?.getAttribute("stroke-dasharray")).toBe("4 3");
    expect((kreis as SVGCircleElement).style.stroke).toContain("--kw-trust-warn-text");
  });

  it("K5b · Enter auf dem fokussierten Knoten waehlt ihn — der Tastaturweg", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });
    const knoten = knotenFuer("dichtung") as HTMLElement;
    expect(knoten.getAttribute("role")).toBe("button");
    expect(knoten.getAttribute("tabindex")).toBe("0");
    await act(async () => {
      knoten.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await flush();
    });
    expect(knoten.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-testid="leiste-titel"]')?.textContent).toBe("dichtung");
  });

  it("K6 · „Alle Themen“ zeigt die uebrigen Namen, und erst auf Klick", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    expect(container.querySelector('[data-testid="alle-themen-liste"]')).toBeNull();
    const schalter = container.querySelector('[data-testid="alle-themen-schalter"]');
    expect(schalter).not.toBeNull();
    await act(async () => {
      (schalter as HTMLButtonElement).click();
      await flush();
    });
    const liste = container.querySelector('[data-testid="alle-themen-liste"]');
    expect(liste?.textContent).toContain("randthema");
  });

  it("K7 · ohne Schlagwoerter sagt die Seite das, statt eine leere Karte zu zeigen", async () => {
    await mount();
    await act(async () => {
      d.resolve({ ...KARTE, themenkarte: { ...KARTE.themenkarte, themen: [], kanten: [] } });
      await flush();
    });

    expect(container.querySelector('[data-testid="themenkarte"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t("wissensnetz.leer"));
  });

  it("K8 · das Netzlayout ist deterministisch und haengt nicht am Zufall: das groesste Thema mittig, Radius 22…46", () => {
    const themen = [
      { thema: "b", objekte: 1, farbe: "offen" as const, ohneKanten: false },
      { thema: "a", objekte: 3, farbe: "offen" as const, ohneKanten: false },
      { thema: "c", objekte: 2, farbe: "offen" as const, ohneKanten: false },
    ];
    expect(netzplaetze(themen)).toEqual(netzplaetze(themen));
    expect(netzplaetze([])).toEqual([]);
    // Das groesste Thema sitzt in der Mitte der 880×660-Flaeche — nach der Traegerzahl, nicht
    // nach der Listenposition; die uebrigen liegen auf dem Ring darum.
    const plaetze = netzplaetze(themen);
    const mitte = plaetze.find((p) => p.knoten.thema === "a");
    expect(mitte).toMatchObject({ x: 440, y: 330, r: 46 });
    // Die Ellipse misst rx 360 / ry 190 — jeder uebrige Knoten liegt mindestens 190 von der Mitte.
    for (const p of plaetze.filter((x) => x.knoten.thema !== "a")) {
      expect(Math.hypot(p.x - 440, p.y - 330)).toBeGreaterThanOrEqual(190);
    }
    // Die Wurzelskala des Zielbilds: der kleinste Knoten 22, der groesste 46.
    expect(plaetze.find((p) => p.knoten.thema === "b")?.r).toBe(22);
    // Gleiche Groesse ⇒ gleicher Radius; eine Division durch null gibt es nicht.
    const gleich = netzplaetze([
      { thema: "a", objekte: 2, farbe: "offen" as const, ohneKanten: false },
      { thema: "b", objekte: 2, farbe: "offen" as const, ohneKanten: false },
    ]);
    expect(gleich[0]?.r).toBe(gleich[1]?.r);
  });

  it("K10 · Dichte gemessen (Runde 2/3, BEN): bei 8, 13, 14, 25 und 40 Themen mit Langschwanz-Verteilung schneidet sich kein Kreis-Rechteck; jeder Knoten bleibt in der Flaeche; der unrealistische Grenzfall wird gemessen und genannt", () => {
    // Zwei Verteilungen der Traegerzahlen:
    //   · LANGSCHWANZ (Haeufigkeit ∝ 1/Rang) — so sehen Schlagwortbestaende aus: wenige grosse,
    //     viele kleine Themen. Hier MUSS das Bild beruehrungsfrei sein.
    //   · LINEAR HART (9 → 1 gleichmaessig) — fast alle Radien nahe 46. 40 solche Kreise passen auf
    //     880×660 auf keine Bahn beruehrungsfrei (Flaeche); dieser Fall wird gemessen und genannt,
    //     nicht behauptet.
    const langschwanz = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        thema: `thema-${i}`,
        objekte: Math.max(1, Math.round(60 / (i + 1))),
        farbe: "offen" as const,
        ohneKanten: false,
      }));
    const linearHart = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        thema: `thema-${i}`,
        objekte: Math.max(1, Math.round(9 - (8 * i) / Math.max(n - 1, 1))),
        farbe: "offen" as const,
        ohneKanten: false,
      }));
    // Dasselbe Mass wie der Chromium-Fall G4: die KREIS-RECHTECKE (2r × 2r) sind disjunkt, wenn sie
    // sich in x ODER in y um mindestens r1 + r2 unterscheiden.
    const schnitte = (plaetze: ReturnType<typeof netzplaetze>): string[] => {
      const out: string[] = [];
      for (let i = 0; i < plaetze.length; i++) {
        for (let j = i + 1; j < plaetze.length; j++) {
          const a = plaetze[i] as (typeof plaetze)[number];
          const b = plaetze[j] as (typeof plaetze)[number];
          const disjunkt = Math.abs(a.x - b.x) >= a.r + b.r || Math.abs(a.y - b.y) >= a.r + b.r;
          if (!disjunkt) {
            out.push(`${a.knoten.thema}/${b.knoten.thema}`);
          }
        }
      }
      return out;
    };
    // Runde 6: die Flaeche ist 880 breit und im Zielbild-Verhaeltnis hoch — bei Dichte quadratisch
    // (`zeichenhoehe`); jeder Knoten samt Radius bleibt darin.
    const inFlaeche = (plaetze: ReturnType<typeof netzplaetze>): void => {
      const hoehe = zeichenhoehe(plaetze.length, 880);
      for (const p of plaetze) {
        expect(p.x - p.r).toBeGreaterThanOrEqual(0);
        expect(p.x + p.r).toBeLessThanOrEqual(880);
        expect(p.y - p.r).toBeGreaterThanOrEqual(0);
        expect(p.y + p.r).toBeLessThanOrEqual(hoehe);
      }
    };
    // Runde 3 (BEN): auf EINER Ellipse beruehrten sich bei 39 Knoten 45 Nachbarpaare (Runde 2,
    // gemessen). Jetzt kommen ab 14 uebrigen Themen weitere Bahnen hinzu (bis drei) — und mit
    // Langschwanz-Verteilung schneidet sich an keiner der Schwellen ein Kreis-Rechteck.
    for (const n of [8, 13, 14, 25, 27, 40]) {
      const plaetze = netzplaetze(langschwanz(n));
      inFlaeche(plaetze);
      expect(schnitte(plaetze), `${n} Themen (Langschwanz)`).toEqual([]);
    }
    // Das Zielbild zeigt acht Themen — auch mit lauter grossen Radien beruehrungsfrei, und ohne
    // Verkleinerung: der groesste bleibt 46, der kleinste 22.
    const acht = netzplaetze(linearHart(8));
    expect(schnitte(acht)).toEqual([]);
    expect(Math.max(...acht.map((p) => p.r))).toBe(46);
    expect(Math.min(...acht.map((p) => p.r))).toBe(22);
    // Runde 5 (BEN): der zulaessige Grenzfall — 40 GLEICH haeufige Themen (alle `objekte: 1`) und der
    // harte lineare Fall. Der Platzfaktor verkleinert die Radien proportional, bis kein Kreis-Rechteck
    // ein anderes schneidet: kein Protokoll mehr, eine Zusicherung.
    const gleich = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        thema: `thema-${i}`,
        objekte: 1,
        farbe: "offen" as const,
        ohneKanten: false,
      }));
    const vierzigGleich = netzplaetze(gleich(40));
    inFlaeche(vierzigGleich);
    expect(schnitte(vierzigGleich), "40 gleiche Themen").toEqual([]);
    // Alle gleich gross — die Ordnung „gleiche Menge ⇒ gleicher Radius" bleibt trotz Faktor.
    expect(new Set(vierzigGleich.map((p) => p.r.toFixed(3))).size).toBe(1);
    const hart = netzplaetze(linearHart(40));
    inFlaeche(hart);
    expect(schnitte(hart), "40 Themen linear hart").toEqual([]);
    // Die Groessenordnung bleibt unter dem Faktor erhalten (mehr Objekte ⇒ nie kleinerer Radius).
    for (let i = 1; i < hart.length; i++) {
      const a = hart[i - 1] as (typeof hart)[number];
      const b = hart[i] as (typeof hart)[number];
      if (a.knoten.objekte > b.knoten.objekte) {
        expect(a.r).toBeGreaterThan(b.r);
      }
    }
    // Runde 6/7 (BEN): die Flaeche der Huelle bei 1280×800 ist 582 px breit; bei Dichte wird sie
    // quadratisch (zeichenhoehe). Auch dort: 40 gleiche Themen ohne Schnitt — und OHNE
    // Verkleinerung: Radius 22, das Zielbild-Mass des kleinsten Knotens (Schrift 10,5).
    expect(zeichenhoehe(41, 582)).toBe(582);
    expect(zeichenhoehe(5, 582)).toBe(Math.round((582 * 660) / 880));
    const schmal = netzplaetze(gleich(40), 582, zeichenhoehe(40, 582));
    for (const p of schmal) {
      expect(p.x - p.r).toBeGreaterThanOrEqual(0);
      expect(p.x + p.r).toBeLessThanOrEqual(582);
      expect(p.y - p.r).toBeGreaterThanOrEqual(0);
      expect(p.y + p.r).toBeLessThanOrEqual(582);
    }
    expect(schnitte(schmal), "40 gleiche Themen bei 582 px").toEqual([]);
    expect(new Set(schmal.map((p) => p.r))).toEqual(new Set([22]));
    expect(new Set(vierzigGleich.map((p) => p.r))).toEqual(new Set([22]));
    // Und 40 lange, gleich beginnende Namen bleiben bei diesem Radius sichtbar verschieden — die
    // zweite Zeile zeigt die Stelle, ab der sich ein Name von seiner Familie unterscheidet; ueber
    // ALLE Labels des Bildes kollisionsfrei (beschriftungen). Schriftgrad 10,5, nie kleiner.
    const r = schmal[1]?.r ?? 0;
    const eintraege = (namen: string[]) => namen.map((name) => ({ name, r }));
    const sichtbarVon = (namen: string[]) =>
      beschriftungen(eintraege(namen)).map((b) => b.zeilen.join(" "));
    // (a) Runde 7: ein gemeinsames Praefix, Unterschied mitten im Wort.
    const segmente = Array.from(
      { length: 40 },
      (_, i) => `Ventilanlage Produktionsbereich Segment${String(i + 1).padStart(2, "0")}`,
    );
    expect(gemeinsamesPraefix(segmente)).toBe("Ventilanlage Produktionsbereich Segment".length);
    const segLabels = beschriftungen(eintraege(segmente));
    expect(new Set(segLabels.map((b) => b.zeilen.join(" "))).size).toBe(40);
    expect(segLabels[6]?.zeilen).toEqual(["Ventil…", "…07"]);
    for (const b of segLabels) {
      expect(b.grad).toBe(10.5);
    }
    // (b) Runde 8 (BEN): EIN frueh abweichendes Thema, 39 mit langem gemeinsamem Gruppenrest — ein
    // globales Praefix allein ergaebe 39-mal „…gme…"; die Familie der Segmente beginnt tiefer.
    const bens = [
      "Ventilanlage Produktionsbereich Sektor Sonderzweig",
      ...Array.from(
        { length: 39 },
        (_, i) =>
          `Ventilanlage Produktionsbereich SegmentGemeinsamerUnterscheidungsblock${String(i + 1).padStart(2, "0")}`,
      ),
    ];
    const bensLabels = sichtbarVon(bens);
    expect(new Set(bensLabels).size).toBe(40);
    expect(bensLabels[0]).toBe("Ventil… …ktor…");
    expect(bensLabels[7]).toBe("Ventil… …07");
    // (c) Zwei Familien, deren zweite Zeilen sonst gleich waeren („1"/„2" in beiden): das
    // Familienzeichen wird eingeblendet — kollisionsfrei ueber alle Labels.
    const zweiFamilien = [
      "Anlage Halle Gamma Linie 1",
      "Anlage Halle Gamma Linie 2",
      "Anlage Halle Delta Fertigung Sued 1",
      "Anlage Halle Delta Fertigung Sued 2",
    ];
    const zfLabels = sichtbarVon(zweiFamilien);
    expect(new Set(zfLabels).size).toBe(4);
    for (const l of zfLabels) {
      // Kopf gekuerzt, dann Familienzeichen (G/D) und die Nummer: „Anlag… …G…1".
      expect(l, JSON.stringify(zfLabels)).toMatch(/^Anlag… …[GD]…[12]$/);
    }
    // (d) Ein einzelner Name hat kein Praefix — die Kopf-Kuerzung bleibt; Namen, die passen, bleiben ganz.
    expect(gemeinsamesPraefix(["Werkstoffkennzeichnung"])).toBe(0);
    const kurz = sichtbarVon(["CIP", "Reinigung", "Dichtungen"]);
    expect(kurz[0]).toBe("CIP");
    // Laengere Namen brechen bei r 22 mit Trennstrich — aber vollstaendig, ohne Auslassung.
    expect(kurz.map((l) => l.replace(/[- ]/g, ""))).toEqual(["CIP", "Reinigung", "Dichtungen"]);
    const sichtbar = segLabels;
    console.info(
      `JOB 3052 D6 · K10 · 40 gleiche Themen r=${vierzigGleich[0]?.r.toFixed(1)} (880 px) · r=${r.toFixed(1)} (582 px, „${sichtbar[6]?.zeilen.join(" / ")}") · 40 linear hart r=${Math.min(...hart.map((p) => p.r)).toFixed(1)}…${Math.max(...hart.map((p) => p.r)).toFixed(1)}`,
    );
  });

  it("K9 · der Name steht IM Kreis (nicht darunter) und bricht bei Bedarf am Leerzeichen um", async () => {
    await mount();
    await act(async () => {
      d.resolve({
        ...KARTE,
        themenkarte: {
          ...KARTE.themenkarte,
          themen: [
            { thema: "Hygienic Design", objekte: 4, farbe: "belegt", ohneKanten: false },
            { thema: "CIP", objekte: 1, farbe: "freigegeben", ohneKanten: false },
          ],
          kanten: [],
        },
      });
      await flush();
    });
    const gross = knotenFuer("Hygienic Design");
    const kreis = gross?.querySelector("circle");
    const text = gross?.querySelector("text");
    // Der Text sitzt auf der Kreismitte (x/y = cx/cy), nicht unter dem Kreis (cy + r + 12).
    expect(text?.getAttribute("x")).toBe(kreis?.getAttribute("cx"));
    expect(text?.getAttribute("y")).toBe(kreis?.getAttribute("cy"));
    expect([...(text?.querySelectorAll("tspan") ?? [])].map((s) => s.textContent)).toEqual([
      "Hygienic",
      "Design",
    ]);
    const klein = knotenFuer("CIP")?.querySelector("text");
    expect([...(klein?.querySelectorAll("tspan") ?? [])].map((s) => s.textContent)).toEqual([
      "CIP",
    ]);
  });
});
