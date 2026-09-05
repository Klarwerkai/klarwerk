// ================================================================================================
// JOB 3073 · V6 — DER SPRUNG IN DIE BIBLIOTHEK TRIFFT. Gemessen am TREFFER, nicht an der Adresse.
// ================================================================================================
//
// DER BEFUND, älter als JOB 3070 und dort nur benannt (`archiv/3070/runde-3/RUECKGABE.md`, REST):
// `themenHref` (`Wissensnetz.tsx`) baut `/bibliothek?tag=<thema>`. Solange `metrik.themen` aus der
// KATEGORIE entstand, übergab die Leseansicht dort eine Kategorie an einen SCHLAGWORT-Filter —
// das traf nur bei Namensgleichheit, sonst landete der Klick auf einer leeren Bibliotheksseite.
//
// WARUM DIESER TEST NICHT AUF DIE URL SCHAUT (Auftrag §5, Lieferpunkt 5: „Der Beleg ist kein Blick
// auf die URL, sondern ein Treffer"): Eine Zusicherung `href === "/bibliothek?tag=Dichtungen"` wäre
// auch vor dem Umbau grün gewesen — sie misst die Zeichenkette, nicht die Wirkung. Hier läuft
// deshalb die ganze Kette:
//
//   echte App → POST /api/kos (Kategorie ≠ allen Schlagworten)
//     → GET /api/wissensnetz/luecken     (die Route, die die Seite ruft)  → die Themenzeile
//     → themenHref(thema)                (die EINE Linkdefinition der Seite)
//     → facetSelectionFromParams(...)    (wie `BibliothekFlaeche.tsx` den Link liest)
//     → knownFacetValues + pruneFacetSelectionToKnownValues   (ihre Wertprüfung, s. unten)
//     → applyFacetSelection + libraryFilterValues             (ihre Filterung)
//     → die Objekte, die die Zeile zählt
//
// ================================================================================================
// RUNDE 2 · WARUM DIE WERTPRÜFUNG DAZUGEHÖRT — sie war die Lücke, die den Fehler verdeckt hat.
// ================================================================================================
//
// Runde 1 sprang von `facetSelectionFromParams` direkt zu `applyFacetSelection`. Das ist NICHT der
// Weg der Bibliothek: `libraryUrlFilters.ts:32-36` schreibt ausdrücklich vor, dass jede aus der URL
// gelesene Auswahl durch `pruneFacetSelectionToKnownValues` muss, und `BibliothekFlaeche.tsx:236`
// tut das auch. Der Unterschied ist nicht akademisch, er ist der ganze Befund:
//
//   · OHNE Wertprüfung  → ein unbekannter Wert trifft NICHTS  → leere Liste (sichtbar falsch)
//   · MIT  Wertprüfung  → ein unbekannter Wert wird VERWORFEN → die Auswahl ist leer, und
//                         `applyFacetSelection` gibt bei leerer Auswahl ALLES zurück
//
// Der zweite Fall ist der gefährliche: Wer auf ein Thema klickt, sieht die GANZE Bibliothek und
// hält sie für die Objekte dieses Themas. Genau das hat Codex an Runde 1 gemessen
// („Zeile zählt 2 · expected 3 to be 2"), und genau das konnte der Helfer von Runde 1 nicht sehen.
//
//   L1  jede Themenzeile führt auf genau die Objekte, die sie zählt
//   L2  KALIBRIERUNG: ein Kategoriename trifft nichts — genau das war der Zustand vor JOB 3073
//   L3  der Filterschlüssel der Bibliothek heisst wirklich `tag`
//   L4  RAND-LEERZEICHEN: `" Dichtungen "` — die Zeile und der Treffer nennen dieselben Kennungen
//   L5  GEMISCHTE SCHREIBWEISEN: zwei Varianten, zwei Themen, JEWEILS eigene Kennungen
//   L6  DIE REGEL DAHINTER: jeder Themenname ist ein Facettenwert, den die Bibliothek KENNT
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { Sichtmetrik } from "../../apps/web/src/api/types";
import { applyFacetSelection, isFacetGroupActive } from "../../apps/web/src/lib/facets";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import {
  facetSelectionFromParams,
  knownFacetValues,
  pruneFacetSelectionToKnownValues,
} from "../../apps/web/src/lib/libraryUrlFilters";
import { themenHref } from "../../apps/web/src/pages/Wissensnetz";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Der Parametername, unter dem die Bibliothek ihren Schlagwortfilter liest — L3 nagelt ihn fest. */
const TAG_PARAM = "tag";
/** Die Kategorie ist ABSICHTLICH keines der Schlagworte. */
const KATEGORIE_OHNE_WIRKUNG = "Hygienic Design";

/**
 * RUNDE 2, Codex' Korrekturpflicht 1: dasselbe Wort mit Rand-Leerzeichen, so wie es die echten
 * Routen annehmen und zurückgeben. Bis Runde 1 machte die Themenbildung daraus „Dichtungen" —
 * einen Namen, den die Bibliothek nicht kennt.
 */
const TAG_MIT_RAND = " Dichtungen ";
/** Und dieselbe Sache in anderer Schreibweise — ein DRITTER Facettenwert, kein vierter Name. */
const TAG_KLEIN = "dichtungen";

interface KoZeile {
  id: string;
  title: string;
  tags?: readonly string[] | null;
}

/** Ein Bestand samt seiner Antwort — jeder Fall unten baut sich seinen eigenen. */
interface Lage {
  app: ReturnType<typeof buildApp>;
  metrik: Sichtmetrik;
  bestand: KoZeile[];
  /** Titel → Kennung, damit die Erwartungen unabhängig von der Filterung entstehen. */
  kennung: Map<string, string>;
}

const laeufe: Lage[] = [];

async function lageMit(
  email: string,
  objekte: readonly { titel: string; tags: readonly string[] }[],
): Promise<Lage> {
  const app = buildApp(buildServices());
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  await app.inject({ method: "POST", url: "/api/auth/notice", headers });

  const kennung = new Map<string, string>();
  for (const o of objekte) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: o.titel,
        statement: "Kurzfassung fuer den Pruefstand.",
        type: "best_practice",
        category: KATEGORIE_OHNE_WIRKUNG,
        tags: [...o.tags],
        neededValidations: 1,
      },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Anlage von ${o.titel} scheiterte: ${res.statusCode} ${res.body}`);
    }
    kennung.set(o.titel, (res.json() as { id: string }).id);
  }

  const netz = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken", headers });
  if (netz.statusCode !== 200) {
    throw new Error(`Wissensnetzroute scheiterte: ${netz.statusCode} ${netz.body}`);
  }
  const suche = await app.inject({ method: "GET", url: "/api/library/search", headers });
  if (suche.statusCode !== 200) {
    throw new Error(`Bibliothekssuche scheiterte: ${suche.statusCode} ${suche.body}`);
  }

  const lage: Lage = {
    app,
    metrik: netz.json() as Sichtmetrik,
    bestand: suche.json() as KoZeile[],
    kennung,
  };
  laeufe.push(lage);
  return lage;
}

/** Der einfache Bestand: drei Objekte, drei Schlagworte, keine Randfälle. */
let einfach: Lage;
/** Rand-Leerzeichen: ZWEI Objekte tragen `" Dichtungen "`, eines etwas anderes. */
let mitRand: Lage;
/** Zwei Schreibweisen desselben Wortes NEBENEINANDER — jede mit ihren eigenen Objekten. */
let gemischt: Lage;

beforeAll(async () => {
  einfach = await lageMit("pedi@job3073-bibliothek.test", [
    { titel: "CIP-Reinigung mit Dichtungswechsel", tags: ["Dichtungen", "Ventile"] },
    { titel: "Reinigungsplan Linie 4", tags: ["Reinigung", "Ventile"] },
    { titel: "Werkstoffliste Dichtungen", tags: ["Dichtungen"] },
  ]);
  mitRand = await lageMit("pedi@job3073-bibliothek-rand.test", [
    { titel: "CIP-Reinigung mit Dichtungswechsel", tags: [TAG_MIT_RAND, "Ventile"] },
    { titel: "Werkstoffliste Dichtungen", tags: [TAG_MIT_RAND] },
    { titel: "Ventilwartung Entwurf", tags: ["Ventile"] },
  ]);
  gemischt = await lageMit("pedi@job3073-bibliothek-gemischt.test", [
    { titel: "Gross geschrieben", tags: ["Dichtungen"] },
    { titel: "Klein geschrieben", tags: [TAG_KLEIN] },
    { titel: "Mit Rand", tags: [TAG_MIT_RAND] },
  ]);
}, 120_000);

afterAll(async () => {
  for (const l of laeufe) {
    await l.app?.close();
  }
});

/**
 * Genau so liest und prüft `BibliothekFlaeche.tsx` einen Deep-Link, in ihrer Reihenfolge:
 * aus der Adresse lesen (`:165`), gegen den geladenen Bestand bereinigen (`:236-248`), filtern
 * (`:312`). Kein Schritt weggelassen — die Bereinigung IST der Schritt, der Runde 1 gefehlt hat.
 */
function trefferFuer(lage: Lage, href: string): { treffer: KoZeile[]; bereinigt: boolean } {
  const params = new URL(href, "http://klarwerk.test").searchParams;
  const ausUrl = facetSelectionFromParams(params, [TAG_PARAM]);
  expect(ausUrl[TAG_PARAM], `der Link ${href} wählt keinen Schlagwortfilter`).toBeDefined();

  const jetzt = Date.now();
  const werte = (ko: KoZeile) => libraryFilterValues(ko as never, jetzt);
  const bekannt = knownFacetValues(lage.bestand.map(werte), [TAG_PARAM]);
  const auswahl = pruneFacetSelectionToKnownValues(ausUrl, bekannt);

  return {
    treffer: applyFacetSelection(lage.bestand, werte, auswahl),
    // `true`, wenn die Wertprüfung den Filter weggeworfen hat — dann zeigt die Bibliothek ALLES.
    // Gemessen mit ihrer eigenen Frage (`isFacetGroupActive`), nicht mit einer nachgebauten.
    bereinigt: !isFacetGroupActive(auswahl[TAG_PARAM]),
  };
}

/** Die Kennungen, die eine Themenzeile meint — aus dem BESTAND gebildet, nicht aus dem Filter. */
function erwarteteKennungen(lage: Lage, thema: string): string[] {
  return lage.bestand
    .filter((k) => (k.tags ?? []).includes(thema))
    .map((k) => k.id)
    .sort();
}

/** Ein Thema vollständig prüfen: Zahl, Kennungen, und dass der Filter überhaupt stehen blieb. */
function pruefeThema(lage: Lage, thema: string, zaehlt: number, titel: readonly string[]): void {
  const { treffer, bereinigt } = trefferFuer(lage, themenHref(thema));
  expect(
    bereinigt,
    `„${thema}“: die Bibliothek hat den Filter verworfen — sie zeigt dann ALLES`,
  ).toBe(false);
  expect(treffer.length, `„${thema}“: Zeile zählt ${zaehlt}`).toBe(zaehlt);
  const erwartet = titel.map((t) => lage.kennung.get(t) ?? `unbekannt:${t}`).sort();
  expect(treffer.map((k) => k.id).sort(), `„${thema}“: dieselben Objekte`).toEqual(erwartet);
  // Und dieselbe Menge noch einmal aus dem Bestand gebildet — zwei unabhängige Wege, ein Ergebnis.
  expect(treffer.map((k) => k.id).sort()).toEqual(erwarteteKennungen(lage, thema));
}

describe("JOB 3073 · L · der Weg von der Themenzeile in die Bibliothek trifft wirklich", () => {
  it("L1 · jede Themenzeile führt auf genau die Objekte, die sie zählt", () => {
    // Kalibrierung: es sind die Schlagworte, nicht die Kategorie — sonst misst alles unten nichts.
    const themen = einfach.metrik.themen.map((t) => t.thema).sort();
    expect(themen).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
    expect(themen).not.toContain(KATEGORIE_OHNE_WIRKUNG);
    expect(einfach.bestand.length, "die Bibliothek hat den Bestand").toBe(3);

    for (const zeile of einfach.metrik.themen) {
      const { treffer, bereinigt } = trefferFuer(einfach, themenHref(zeile.thema));
      expect(bereinigt, `„${zeile.thema}“: Filter verworfen`).toBe(false);
      expect(treffer.length, `„${zeile.thema}“: Zeile zählt ${zeile.objekte}`).toBe(zeile.objekte);
      expect(treffer.map((k) => k.id).sort(), `„${zeile.thema}“: dieselben Objekte`).toEqual(
        erwarteteKennungen(einfach, zeile.thema),
      );
      expect(treffer.length, `„${zeile.thema}“: kein leerer Treffer`).toBeGreaterThan(0);
    }
    expect(einfach.metrik.themen.find((t) => t.thema === "Ventile")?.objekte).toBe(2);
    expect(einfach.metrik.themen.find((t) => t.thema === "Dichtungen")?.objekte).toBe(2);
    expect(einfach.metrik.themen.find((t) => t.thema === "Reinigung")?.objekte).toBe(1);
  });

  it("L2 · KALIBRIERUNG: der Kategoriename trifft nichts — und die Bibliothek wirft ihn sogar weg", () => {
    // Vor JOB 3073 stand in der Zeile die Kategorie, und der Link trug sie in den Schlagwortfilter.
    // Dieser Fall zeigt, was das bedeutete — und zwar in seiner schlimmen Form: nicht eine leere
    // Seite, sondern die GANZE Bibliothek, weil die Wertprüfung den unbekannten Wert entfernt.
    const { treffer, bereinigt } = trefferFuer(einfach, themenHref(KATEGORIE_OHNE_WIRKUNG));
    expect(bereinigt, "ein unbekannter Wert wird verworfen, nicht zu null Treffern").toBe(true);
    expect(treffer.length, "und dann steht der ganze Bestand da").toBe(einfach.bestand.length);
    // Die Kategorie ist dabei am Bestand durchaus gesetzt — sie ist nur kein Schlagwort.
    expect(einfach.bestand.every((k) => !(k.tags ?? []).includes(KATEGORIE_OHNE_WIRKUNG))).toBe(
      true,
    );
  });

  it("L3 · die Bibliothek liest ihren Schlagwortfilter wirklich unter diesem Parameternamen", () => {
    // Ohne diesen Pin könnte die Bibliothek ihren Schlüssel umbenennen und L1 bliebe grün, weil er
    // hier fest steht — der Klick auf der echten Seite ginge trotzdem ins Leere.
    const flaeche = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/bibliothek/BibliothekFlaeche.tsx"),
      "utf8",
    );
    expect(flaeche, "die Bibliothek führt eine Facette `tag`").toContain(`key: "${TAG_PARAM}"`);
    expect(themenHref("Dichtungen")).toBe(`/bibliothek?${TAG_PARAM}=Dichtungen`);
  });

  it('L4 · RAND-LEERZEICHEN: ein Schlagwort `" Dichtungen "` führt auf genau seine zwei Objekte', () => {
    // Codex' Korrekturpflicht 1, mit ihrem Bestand. Bis Runde 1 hiess das Thema hier „Dichtungen",
    // die Bibliothek kannte diesen Wert nicht, warf den Filter weg — und zeigte alle drei Objekte.
    const zeile = mitRand.metrik.themen.find((t) => t.thema.trim() === "Dichtungen");
    expect(zeile, "das Thema steht in der Liste").toBeDefined();
    expect(zeile?.objekte, "die Zeile zählt zwei Träger").toBe(2);
    // Kalibrierung: der Bestand hat wirklich drei Objekte, es werden also zwei von drei getroffen.
    expect(mitRand.bestand.length).toBe(3);
    expect(mitRand.bestand.filter((k) => (k.tags ?? []).includes(TAG_MIT_RAND))).toHaveLength(2);

    // DER TREFFER — und zwar für den Namen, den die Zeile WIRKLICH trägt. Genau hier lag der
    // Fehler: trug sie „Dichtungen", verschwand der Filter und es standen drei statt zwei da.
    pruefeThema(mitRand, zeile?.thema ?? "", 2, [
      "CIP-Reinigung mit Dichtungswechsel",
      "Werkstoffliste Dichtungen",
    ]);

    // Und die Regel, die das erklärt: die IDENTITÄT ist der gespeicherte Wert, nicht der getrimmte.
    expect(zeile?.thema, "der Themenname ist das gespeicherte Schlagwort").toBe(TAG_MIT_RAND);
  });

  it("L5 · GEMISCHTE SCHREIBWEISEN: drei Varianten desselben Wortes sind drei Themen — jedes mit seinen eigenen Kennungen", () => {
    // Zuerst der Treffer für JEDEN Namen, den die Antwort führt — unabhängig davon, wie viele
    // Themen sie führt. So ist dieser Fall auch dann aussagekräftig, wenn eine Normalisierung
    // Varianten zusammenwirft: dann trifft mindestens einer der Namen nicht mehr.
    for (const t of gemischt.metrik.themen) {
      const { treffer, bereinigt } = trefferFuer(gemischt, themenHref(t.thema));
      expect(bereinigt, `„${t.thema}“: die Bibliothek hat den Filter verworfen`).toBe(false);
      expect(treffer.length, `„${t.thema}“: Zeile zählt ${t.objekte}`).toBe(t.objekte);
      expect(treffer.map((k) => k.id).sort()).toEqual(erwarteteKennungen(gemischt, t.thema));
    }

    const namen = gemischt.metrik.themen.map((x) => x.thema).sort();
    expect(namen, "jede gespeicherte Variante ist ein eigenes Thema").toEqual(
      ["Dichtungen", TAG_KLEIN, TAG_MIT_RAND].sort(),
    );

    // Und JEDES trifft genau sein eigenes Objekt — die Erwartungen entstehen unabhängig, aus den
    // Kennungen der Anlage, nicht aus dem Filter.
    pruefeThema(gemischt, "Dichtungen", 1, ["Gross geschrieben"]);
    pruefeThema(gemischt, TAG_KLEIN, 1, ["Klein geschrieben"]);
    pruefeThema(gemischt, TAG_MIT_RAND, 1, ["Mit Rand"]);

    // Die drei Mengen sind wirklich verschieden — sonst hiesse „eigene Kennungen" nichts.
    const ids = [
      gemischt.kennung.get("Gross geschrieben"),
      gemischt.kennung.get("Klein geschrieben"),
      gemischt.kennung.get("Mit Rand"),
    ];
    expect(new Set(ids).size, "drei verschiedene Objekte").toBe(3);
  });

  it("L6 · DIE REGEL DAHINTER: JEDER Themenname ist ein Facettenwert, den die Bibliothek kennt", () => {
    // Das ist die Zusage in einem Satz — und der Wächter, der jede künftige Normalisierung in der
    // Themenbildung sofort rot macht, ohne dass jemand an einen bestimmten Randfall denken muss.
    const jetzt = Date.now();
    for (const lage of [einfach, mitRand, gemischt]) {
      const bekannt =
        knownFacetValues(
          lage.bestand.map((ko) => libraryFilterValues(ko as never, jetzt)),
          [TAG_PARAM],
        ).get(TAG_PARAM) ?? new Set<string>();
      for (const t of lage.metrik.themen) {
        expect(
          bekannt.has(t.thema),
          `„${t.thema}“ ist der Bibliothek unbekannt — der Sprung dorthin verlöre den Filter`,
        ).toBe(true);
      }
      // Kalibrierung: es gibt überhaupt Themen und überhaupt bekannte Werte.
      expect(lage.metrik.themen.length).toBeGreaterThan(0);
      expect(bekannt.size).toBeGreaterThan(0);
    }
  });
});
