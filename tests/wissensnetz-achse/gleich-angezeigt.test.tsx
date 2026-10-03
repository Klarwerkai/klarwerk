// @vitest-environment jsdom
// ================================================================================================
// THEMENKARTE · KRITERIUM 2 — GLEICH ANGEZEIGT, ABER VERSCHIEDEN GESPEICHERT.
// ================================================================================================
//
// DER AUSGANGSZUSTAND (benannt im Kopf von `themenVon`, `services/wissensnetz/src/themenkarte.ts`):
// `"Dichtungen"` und `" Dichtungen "` sind zwei Themen mit zwei Objektmengen — der Sprung in die
// Bibliothek trifft je seine eigene Menge (`bibliothekstreffer.test.tsx`, L4/L5). Auf der Seite
// standen sie aber mit GLEICHER Beschriftung: zwei Knoten, zwei Zeilen, zwei Leistentitel, die
// niemand unterscheiden konnte. Welche Menge ein Klick traf, war nicht ablesbar.
//
//   S1  themenAnzeige · ohne Doppelgaenger bleibt jeder Name unberuehrt (leere Abbildung)
//   S2  themenAnzeige · Rand-Leerzeichen neben dem blanken Wort → `␣` am Rand, das Wort bleibt
//   S3  themenAnzeige · Tab, Doppel- und geschuetztes Leerzeichen → markiert; was dann noch gleich
//       aussieht, bekommt eine Nummer 1…n in seiner Untergruppe, unabhaengig von der Ankunft
//   S4  themenAnzeige · NFC neben NFD desselben Wortes → nummeriert
//   S5  GERENDERT · Knoten, Zeilen, Leiste und „Alle Themen" zeigen verschiedene Namen — Link,
//       `data-thema` und Suchparameter tragen weiter den GESPEICHERTEN Wert; der Hinweis steht
//   S6  GERENDERT · ein einzelner Name mit Rand → keine Markierung, kein Hinweis (L14 bleibt)
//   S7  NACHARBEIT 1 (BEN) · die Markierung `"␣Dichtungen␣"` trifft einen SO GESPEICHERTEN dritten
//       Namen → alle drei Anzeigen verschieden, ankunftsunabhaengig; auch eine Nummer, die einen
//       gespeicherten Namen `"X #1"` trifft, wird weiter unterschieden
//   S8  NACHARBEIT 1 (BEN) · GERENDERT mit diesem Bestand → drei verschiedene Knotenbeschriftungen,
//       aria-labels und Zeilennamen; Links und `data-thema` tragen die drei gespeicherten Werte
//
// Bauform wie `tests/wissensnetz-leseweg/leseweg.test.tsx`: jsdom, echte Seite, i18n, React-Query
// und Router; die Endpointgrenze ist die einzige Attrappe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const karte = { resolve: (_v: unknown) => {} };
  const luecken = vi.fn(
    () =>
      new Promise((resolve) => {
        karte.resolve = resolve;
      }),
  );
  const search = vi.fn(async (_p: unknown) => []);
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
import {
  LEERRAUM_MARKE,
  Wissensnetz,
  themenAnzeige,
  themenHref,
} from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BLANK = "Dichtungen";
const MIT_RAND = " Dichtungen ";
/** Ein Schlagwort, das GENAU SO gespeichert ist, wie die Markierung von MIT_RAND aussieht. */
const SCHON_MARKIERT = "␣Dichtungen␣";
const NFC = "Café";
const NFD = "Café";

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

async function mitAntwort(antwort: unknown): Promise<void> {
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
  steht = true;
  await act(async () => {
    d.antworten(antwort);
    await flush();
  });
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const knotenEl = (thema: string): Element | undefined =>
  [...container.querySelectorAll('[data-testid="themenknoten"]')].find(
    (k) => k.getAttribute("data-thema") === thema,
  );
const zeileEl = (thema: string): Element | undefined =>
  [...container.querySelectorAll('[data-testid="metrik-thema"]')].find(
    (z) => z.getAttribute("data-thema") === thema,
  );

const thema = (name: string, objekte: number) => ({
  thema: name,
  objekte,
  sichtbareBeitragende: 1,
  beitragendeAbgeschnitten: false,
});
const knoten = (name: string, objekte: number, farbe: string) => ({
  thema: name,
  objekte,
  farbe,
  ohneKanten: false,
});

/** Zwei gleich aussehende Themen im Bild, ein Nachbar, und ein NFC/NFD-Paar hinter „Alle Themen". */
const DOPPELT = {
  objekteGesamt: 4,
  ohneThema: 0,
  sichtbareBeitragendeGesamt: 1,
  themen: [thema(BLANK, 2), thema(MIT_RAND, 1), thema("Ventile", 1)],
  themenkarte: {
    themen: [
      knoten(BLANK, 2, "belegt"),
      knoten(MIT_RAND, 1, "offen"),
      knoten("Ventile", 1, "belegt"),
    ],
    kanten: [{ a: MIT_RAND, b: "Ventile", gewicht: 1 }],
    weitere: [NFC, NFD],
    weitereAbgeschnitten: false,
    mindesthaeufigkeit: 1,
    unterdruecktDurchUbiquitaet: 0,
  },
} as unknown as Sichtmetrik;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("Kriterium 2 · themenAnzeige — nur das Schriftbild aendert sich, nie die Identitaet", () => {
  it("S1 · ohne Doppelgaenger: leere Abbildung, jeder Name bleibt, wie er ist", () => {
    expect(themenAnzeige([BLANK, "Ventile", "Reinigung"]).size).toBe(0);
    // Ein einzelner Name mit Rand hat keinen Doppelgaenger — L14 (getrimmte Zeile) bleibt gueltig.
    expect(themenAnzeige([MIT_RAND, "Ventile"]).size).toBe(0);
  });

  it("S2 · Rand-Leerzeichen neben dem blanken Wort: der Rand wird sichtbar, das Wort bleibt", () => {
    const a = themenAnzeige([BLANK, MIT_RAND, BLANK]);
    expect(a.get(MIT_RAND)).toBe(`${LEERRAUM_MARKE}Dichtungen${LEERRAUM_MARKE}`);
    expect(a.get(BLANK)).toBe(BLANK);
    expect(a.get(MIT_RAND)).not.toBe(a.get(BLANK));
  });

  it("S3 · Tab, Doppel- und geschuetztes Leerzeichen: markiert, Rest-Gleiche nummeriert 1…n, ankunftsunabhaengig", () => {
    const namen = ["Hygienic Design", "Hygienic  Design", "Hygienic Design", "Hygienic\tDesign"];
    const a = themenAnzeige(namen);
    const b = themenAnzeige([...namen].reverse());
    expect(a.get("Hygienic Design")).toBe("Hygienic Design");
    expect(a.get("Hygienic  Design")).toBe(`Hygienic${LEERRAUM_MARKE}${LEERRAUM_MARKE}Design`);
    // Tab und geschuetztes Leerzeichen sehen auch markiert gleich aus → Nummer in der Untergruppe,
    // geordnet nach Codepunkt (Tab vor U+00A0).
    expect(a.get("Hygienic\tDesign")).toBe(`Hygienic${LEERRAUM_MARKE}Design #1`);
    expect(a.get("Hygienic Design")).toBe(`Hygienic${LEERRAUM_MARKE}Design #2`);
    expect([...b.entries()].sort()).toEqual([...a.entries()].sort());
    expect(new Set(a.values()).size, "jede Anzeige ist eindeutig").toBe(namen.length);
  });

  it("S4 · NFC neben NFD desselben Wortes: nummeriert, eindeutig", () => {
    const a = themenAnzeige([NFC, NFD]);
    expect(a.get(NFD)).toBe(`${NFD} #1`);
    expect(a.get(NFC)).toBe(`${NFC} #2`);
  });

  it("S7 · die Markierung trifft einen so gespeicherten Namen: alle Anzeigen bleiben verschieden", () => {
    const namen = [BLANK, MIT_RAND, SCHON_MARKIERT];
    const a = themenAnzeige(namen);
    const zeige = (m: Map<string, string>, n: string): string => m.get(n) ?? n;
    // Der Befund woertlich: vorher trugen MIT_RAND und SCHON_MARKIERT beide "␣Dichtungen␣".
    expect(new Set(namen.map((n) => zeige(a, n))).size, "drei Namen, drei Anzeigen").toBe(3);
    expect(zeige(a, BLANK)).toBe(BLANK);
    // Codepunktordnung: U+0020 vor U+2423 — der Randname bekommt #1, der gespeicherte #2.
    expect(zeige(a, MIT_RAND)).toBe(`${SCHON_MARKIERT} #1`);
    expect(zeige(a, SCHON_MARKIERT)).toBe(`${SCHON_MARKIERT} #2`);
    // Ankunftsunabhaengig.
    const b = themenAnzeige([...namen].reverse());
    for (const n of namen) {
      expect(zeige(b, n), n).toBe(zeige(a, n));
    }
    // Auch was im SCHRIFTBILD gleich aussaehe (Browser ziehen Leerraum zusammen), ist verschieden.
    const bild = (s: string): string => s.normalize("NFKC").replace(/\s+/g, " ").trim();
    expect(new Set(namen.map((n) => bild(zeige(a, n)))).size).toBe(3);

    // Die Nummer selbst kann einen gespeicherten Namen treffen — auch dann bleibt alles verschieden.
    const mitNummer = [...namen, `${SCHON_MARKIERT} #1`];
    const c = themenAnzeige(mitNummer);
    expect(new Set(mitNummer.map((n) => bild(zeige(c, n)))).size).toBe(mitNummer.length);
  });
});

describe("Kriterium 2 · gerendert — verschiedene Namen sichtbar, gespeicherter Wert im Sprung", () => {
  it("S5 · Knoten, Zeilen, Leiste, Zusammen-Satz und „Alle Themen“ unterscheiden die Doppelgaenger", async () => {
    await mitAntwort(DOPPELT);
    const markiert = `${LEERRAUM_MARKE}Dichtungen${LEERRAUM_MARKE}`;

    // Der Hinweis steht und erklaert die Marke.
    expect(marke("netz-schreibweisen-hinweis")?.textContent).toBe(
      i18n.t("wissensnetz.schreibweisen.hinweis", { marke: LEERRAUM_MARKE }),
    );

    // KNOTEN: Identitaet gespeichert, Name im Bild und im aria-label verschieden.
    const kBlank = knotenEl(BLANK);
    const kRand = knotenEl(MIT_RAND);
    expect(kBlank, "Knoten fuer das blanke Wort").toBeDefined();
    expect(kRand, "Knoten fuer das Wort mit Rand").toBeDefined();
    expect(kRand?.getAttribute("aria-label")).toContain(markiert);
    expect(kBlank?.getAttribute("aria-label")).not.toContain(LEERRAUM_MARKE);
    expect(kRand?.querySelector("text")?.textContent).not.toBe(
      kBlank?.querySelector("text")?.textContent,
    );

    // ZEILEN: sichtbarer Name verschieden, Link traegt den gespeicherten Wert.
    const zBlank = zeileEl(BLANK)?.querySelector("a");
    const zRand = zeileEl(MIT_RAND)?.querySelector("a");
    expect(zBlank?.textContent).toBe(BLANK);
    expect(zRand?.textContent).toBe(markiert);
    expect(zBlank?.getAttribute("href")).toBe(themenHref(BLANK));
    expect(zRand?.getAttribute("href")).toBe(themenHref(MIT_RAND));
    expect(zRand?.getAttribute("href")).not.toBe(zBlank?.getAttribute("href"));
    // Der Zusammen-Satz der Nachbarzeile nennt den markierten Namen, nicht das blanke Wort.
    expect(zeileEl("Ventile")?.textContent).toContain(markiert);

    // LEISTE: Vorgabe ist das groesste Thema (blank); Klick auf den Randknoten waehlt GENAU ihn.
    expect(marke("leiste-titel")?.textContent).toBe(BLANK);
    await act(async () => {
      kRand?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    expect(marke("leiste-titel")?.textContent).toBe(markiert);
    expect(marke("leiste-alle")?.getAttribute("href")).toBe(themenHref(MIT_RAND));
    expect(d.search).toHaveBeenCalledWith({ tag: MIT_RAND });
    expect(d.search).toHaveBeenCalledWith({ tag: BLANK });

    // „ALLE THEMEN“: das NFC/NFD-Paar ist nummeriert, die Links bleiben verschieden.
    await act(async () => {
      (marke("alle-themen-schalter") as HTMLButtonElement | null)?.click();
      await flush();
    });
    const links = [...(marke("alle-themen-liste")?.querySelectorAll("a") ?? [])];
    expect(links.map((l) => l.textContent)).toEqual([`${NFC} #2`, `${NFD} #1`]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([themenHref(NFC), themenHref(NFD)]);
  });

  it("S6 · ein einzelner Name mit Rand: keine Marke, kein Hinweis — die Zeile bleibt getrimmt", async () => {
    await mitAntwort({
      objekteGesamt: 2,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 1,
      themen: [thema(MIT_RAND, 2)],
      themenkarte: {
        ...DOPPELT.themenkarte,
        themen: [knoten(MIT_RAND, 2, "belegt")],
        kanten: [],
        weitere: [],
      },
    });
    expect(marke("netz-schreibweisen-hinweis")).toBeNull();
    expect(zeileEl(MIT_RAND)?.querySelector("a")?.textContent).toBe(BLANK);
    expect(container.textContent ?? "").not.toContain(LEERRAUM_MARKE);
  });

  it("S8 · drei gespeicherte Werte, einer davon schon markiert: drei verschiedene Namen auf der Fläche", async () => {
    const namen = [BLANK, MIT_RAND, SCHON_MARKIERT];
    await mitAntwort({
      objekteGesamt: 3,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: 1,
      themen: [thema(BLANK, 3), thema(MIT_RAND, 2), thema(SCHON_MARKIERT, 1)],
      themenkarte: {
        ...DOPPELT.themenkarte,
        themen: [
          knoten(BLANK, 3, "belegt"),
          knoten(MIT_RAND, 2, "offen"),
          knoten(SCHON_MARKIERT, 1, "belegt"),
        ],
        kanten: [],
        weitere: [],
      },
    });
    expect(marke("netz-schreibweisen-hinweis")).not.toBeNull();

    // KNOTEN: drei gespeicherte Identitaeten, drei verschiedene Namen im aria-label.
    const knotenListe = namen.map((n) => knotenEl(n));
    expect(
      knotenListe.every((k) => k !== undefined),
      "jeder Wert hat seinen Knoten",
    ).toBe(true);
    const labels = knotenListe.map((k) => k?.getAttribute("aria-label") ?? "");
    expect(new Set(labels).size, `aria-labels: ${labels.join(" | ")}`).toBe(3);

    // ZEILEN: drei verschiedene sichtbare Namen, Links mit dem jeweils gespeicherten Wert.
    const links = namen.map((n) => zeileEl(n)?.querySelector("a"));
    const texte = links.map((l) => l?.textContent ?? "");
    expect(new Set(texte).size, `Zeilennamen: ${texte.join(" | ")}`).toBe(3);
    expect(links.map((l) => l?.getAttribute("href"))).toEqual(namen.map((n) => themenHref(n)));

    // LEISTE: der schon markierte Wert wird gewaehlt und gesucht — nicht der Randname.
    await act(async () => {
      knotenEl(SCHON_MARKIERT)?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    expect(marke("leiste-titel")?.textContent).toBe(texte[2]);
    expect(marke("leiste-alle")?.getAttribute("href")).toBe(themenHref(SCHON_MARKIERT));
    expect(d.search).toHaveBeenCalledWith({ tag: SCHON_MARKIERT });
  });
});
