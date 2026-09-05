// ================================================================================================
// JOB 3073 · V6 — EINE THEMENACHSE: DIE LISTE SPRICHT ÜBER DIE THEMEN, DIE DAS BILD ZEICHNET.
// ================================================================================================
//
// DER AUSGANGSFEHLER, an der echten Route gemessen und bis JOB 3071 unbehoben
// (`tests/wissensnetz-leseweg/namensraum-kette.test.tsx`, N1 · `archiv/3070/runde-3/ben.md`
// Prüfpunkt 4: „V6 ist damit insgesamt noch nicht abgeschlossen"):
//
//     ko = { category: "Hygienic Design", tags: ["Dichtungen", "Ventile"] }
//       → `sicht.themen`      nannte    ["Hygienic Design"]        (aus `ko.category`)
//       → `sicht.themenkarte` zeichnete ["Dichtungen", "Ventile"]  (aus `ko.tags`)
//
// EINE Antwort, ZWEI Namensräume, kein Feld dazwischen. Auf dem Telefon, wo es die Zeichnung gar
// nicht gibt (`Wissensnetz.tsx`, `LESEN_UNTER = 900`), war die Liste damit eine Auskunft über
// etwas anderes als das Bild.
//
// DIESE DATEI IST DER RED-FIRST-VERTRAG DES AUFTRAGS (§6). Sie misst am DIENST, weil dort die
// Achse entsteht; die echte HTTP-Kette misst `namensraum-kette.test.tsx`, den Bibliothekstreffer
// `bibliothekstreffer.test.ts`, die gebaute Seite `tests/design/zielbild-wissensnetz.test.ts` (T2).
//
//   A1  die Mengen sind GLEICH — nicht „ähnlich", nicht „meistens"
//   A2  liegt in `eine-achse-zeilen.test.tsx` (Zeilen mit Zustand und Nachbarn): die Seite ist eine
//       `.tsx`, und der Node-reine Typecheck dieses Baums nimmt kein JSX (`tsconfig.json:26`)
//   A3  die geänderte Zusage: die Summe der Themenzähler ist keine Objektsumme mehr
//   A4  Objekte OHNE Schlagwort bleiben themenlos — kein erfundenes Sammelthema
//   A5  die Vertraulichkeitsregel hält: ein nur vertraulich getragenes Thema erscheint nicht
//   A6  EINE Kantenabfrage je OBJEKT, nicht je Zuordnung
//   A7  der Themendeckel greift auf der mehrwertigen Achse früher — und sagt es
//   A8  ABLÖSUNG: es gibt GENAU EINE `themenVon`-Definition, und `category` steht in keinem Code
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import type { Confidentiality } from "../../services/knowledge-object";
import { LesemodellService, THEMEN_DECKEL } from "../../services/wissensnetz/src/lesemodell";
import type {
  WissensnetzKantenLeser,
  WissensnetzKoLeser,
} from "../../services/wissensnetz/src/lesemodell-ports";

/** Die Mindestform, die BEIDE Seiten brauchen — Zähler wie Karte. */
interface AchsenKo {
  id: string;
  /** ABSICHTLICH weiter geführt: sie darf auf die Themen keine Wirkung mehr haben (A1). */
  category?: string;
  tags?: readonly string[];
  status?: string;
  sources?: readonly unknown[];
  author?: string | null | undefined;
  confidentiality?: Confidentiality | null | undefined;
}

const bestand = (kos: readonly AchsenKo[]): WissensnetzKoLeser<AchsenKo> => ({
  alle: async () => kos,
});

/** Die ECHTE Entscheidung des Hauses, nicht ein nachgebautes Prädikat (`sichtbarkeit.ts`). */
const EXPERTIN = sichtbarkeitsfilterFuer({ id: "expertin-1", role: "experte" });
const CONTROLLERIN = sichtbarkeitsfilterFuer({ id: "controllerin-1", role: "controller" });

/** Die Kategorie ist in dieser Datei durchgehend KEINES der Schlagworte — das ist der Gegenstand. */
const KATEGORIE_OHNE_WIRKUNG = "Hygienic Design";
const ZWEITE_KATEGORIE = "Reinigungstechnik";

/**
 * Der Streitbestand aus dem Befund. Beide Objekte sind freigegeben und belegt, damit überhaupt
 * eine Kante entstehen kann („zwei Themen im SELBEN freigegebenen Wissensobjekt").
 */
const STREIT: readonly AchsenKo[] = [
  {
    id: "s1",
    category: KATEGORIE_OHNE_WIRKUNG,
    tags: ["Dichtungen", "Ventile"],
    status: "validiert",
    sources: [{ art: "beleg" }],
    author: "anna",
    confidentiality: "intern",
  },
  {
    id: "s2",
    category: ZWEITE_KATEGORIE,
    tags: ["Reinigung", "Ventile"],
    status: "validiert",
    sources: [{ art: "beleg" }],
    author: "bert",
    confidentiality: "intern",
  },
];

async function sichtVon(
  kos: readonly AchsenKo[],
  opts: {
    sichtbar?: typeof EXPERTIN;
    kanten?: WissensnetzKantenLeser<AchsenKo>;
    deckel?: number;
  } = {},
) {
  const lm = new LesemodellService<AchsenKo>({
    kos: bestand(kos),
    ...(opts.kanten !== undefined ? { kanten: opts.kanten } : {}),
  });
  return lm.sicht({
    sichtbar: opts.sichtbar ?? EXPERTIN,
    mitThemenkarte: true,
    ...(opts.kanten !== undefined ? { mitVerknuepfung: true } : {}),
    ...(opts.deckel !== undefined ? { deckel: opts.deckel } : {}),
  });
}

const namen = (xs: readonly { thema: string }[]): string[] => xs.map((x) => x.thema).sort();

describe("JOB 3073 · A · eine Themenachse — gesprochen und gezeichnet sind DASSELBE", () => {
  it("A1 · die Menge der genannten Themen ist GLEICH der Menge der gezeichneten Knoten — obwohl die Kategorie auseinanderläuft", async () => {
    const sicht = await sichtVon(STREIT);

    const gesprochen = namen(sicht.themen);
    const gezeichnet = namen(sicht.themenkarte?.themen ?? []);

    // Kalibrierung: der Bestand IST der Streitfall — die Kategorien kommen in keinem Schlagwort vor.
    expect(gesprochen.length, "es gibt überhaupt Themen").toBeGreaterThan(0);
    expect(gesprochen, "kein Kategoriename in der Liste").not.toContain(KATEGORIE_OHNE_WIRKUNG);
    expect(gesprochen).not.toContain(ZWEITE_KATEGORIE);

    expect(gesprochen).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
    expect(gesprochen, "eine Achse: dieselben Namen").toEqual(gezeichnet);

    // Und nicht nur die NAMEN: dieselben Trägerzahlen. „Ventile" trägt beide Objekte.
    const zahlGesprochen = new Map(sicht.themen.map((t) => [t.thema, t.objekte]));
    const zahlGezeichnet = new Map(
      (sicht.themenkarte?.themen ?? []).map((k) => [k.thema, k.objekte]),
    );
    expect([...zahlGesprochen.entries()].sort()).toEqual([...zahlGezeichnet.entries()].sort());
    expect(zahlGesprochen.get("Ventile"), "beide Objekte tragen Ventile").toBe(2);
    expect(zahlGesprochen.get("Dichtungen")).toBe(1);
  });

  it("A3 · die geänderte Zusage steht: die Summe der Themenzähler ist keine Objektsumme mehr", async () => {
    const sicht = await sichtVon(STREIT);

    const summe = sicht.themen.reduce((n, t) => n + t.objekte, 0);
    expect(sicht.abgeschnitten).toBe(false);
    expect(sicht.objekteGesamt, "zwei Objekte").toBe(2);
    expect(sicht.ohneThema).toBe(0);
    // Vier Zuordnungen aus zwei Objekten — das ist der Bruch, den `lesemodell-ports.ts` ausschreibt.
    expect(summe).toBe(4);
    expect(summe).toBeGreaterThan(sicht.objekteGesamt - sicht.ohneThema);

    // KALIBRIERUNG der neuen Zusage: trägt jedes Objekt HÖCHSTENS ein Schlagwort, gilt weiterhin
    // die Gleichheit. Die Ungleichung oben ist also keine Beliebigkeit.
    const einwertig = await sichtVon([
      {
        id: "e1",
        category: KATEGORIE_OHNE_WIRKUNG,
        tags: ["Dichtungen"],
        confidentiality: "intern",
      },
      { id: "e2", category: KATEGORIE_OHNE_WIRKUNG, tags: ["Ventile"], confidentiality: "intern" },
      { id: "e3", category: KATEGORIE_OHNE_WIRKUNG, tags: [], confidentiality: "intern" },
    ]);
    const summeEinwertig = einwertig.themen.reduce((n, t) => n + t.objekte, 0);
    expect(summeEinwertig).toBe(einwertig.objekteGesamt - einwertig.ohneThema);
  });

  it("A4 · Objekte OHNE Schlagwort bleiben themenlos — kein erfundenes Sammelthema, und die Personengleichung hält", async () => {
    const sicht = await sichtVon([
      ...STREIT,
      // Kein Schlagwort, aber eine Kategorie: früher wäre daraus ein Thema geworden.
      {
        id: "o1",
        category: "Sonderfall ohne Schlagwort",
        tags: [],
        author: "dora",
        confidentiality: "intern",
      },
      {
        id: "o2",
        category: KATEGORIE_OHNE_WIRKUNG,
        tags: ["  ", ""],
        author: "dora",
        confidentiality: "intern",
      },
      { id: "o3", author: "dora", confidentiality: "intern" },
    ]);

    expect(sicht.ohneThema, "drei Objekte ohne jedes Schlagwort").toBe(3);
    expect(namen(sicht.themen)).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
    expect(namen(sicht.themen)).not.toContain("Sonderfall ohne Schlagwort");
    expect(namen(sicht.themen)).not.toContain("Sonstiges");

    // `beitragendeNurOhneThema` trifft dieselbe Art von Aussage wie vor dem Umbau: dora trägt
    // ausschliesslich zu themenlosen Objekten bei und steht deshalb in keinem `beitragende`.
    const inThemen = new Set(sicht.themen.flatMap((t) => t.beitragende.map((b) => b.urheber)));
    expect([...inThemen].sort()).toEqual(["anna", "bert"]);
    expect(sicht.beitragendeGesamt, "anna, bert, dora").toBe(3);
    expect(sicht.beitragendeNurOhneThema, "nur dora").toBe(1);
    expect(inThemen.size + sicht.beitragendeNurOhneThema).toBe(sicht.beitragendeGesamt);
  });

  it("A5 · VERTRAULICHKEIT: ein Thema, das nur vertrauliche Objekte trägt, erscheint nicht — auch nicht als Knoten", async () => {
    const mitGeheimem: readonly AchsenKo[] = [
      ...STREIT,
      {
        id: "g1",
        category: KATEGORIE_OHNE_WIRKUNG,
        tags: ["Lieferantenpreise", "Ventile"],
        status: "validiert",
        sources: [{ art: "beleg" }],
        author: "chef",
        confidentiality: "vertraulich",
      },
    ];

    const fuerExpertin = await sichtVon(mitGeheimem);
    const roh = JSON.stringify(fuerExpertin);
    expect(namen(fuerExpertin.themen)).not.toContain("Lieferantenpreise");
    expect(namen(fuerExpertin.themenkarte?.themen ?? [])).not.toContain("Lieferantenpreise");
    expect(roh, "weder Name noch Urheber noch Kennung reisen mit").not.toContain(
      "Lieferantenpreise",
    );
    expect(roh).not.toContain("chef");
    expect(roh).not.toContain("g1");
    // Und das vertrauliche Objekt hebt auch keine Trägerzahl: „Ventile" bleibt bei zwei.
    expect(fuerExpertin.themen.find((t) => t.thema === "Ventile")?.objekte).toBe(2);

    // KALIBRIERUNG: für die erweiterte Sichtbarkeit ist dasselbe Thema da — sonst misst der
    // Negativfall nur, dass gar nichts geliefert wird.
    const fuerControllerin = await sichtVon(mitGeheimem, { sichtbar: CONTROLLERIN });
    expect(namen(fuerControllerin.themen)).toContain("Lieferantenpreise");
    expect(namen(fuerControllerin.themenkarte?.themen ?? [])).toContain("Lieferantenpreise");
    expect(fuerControllerin.themen.find((t) => t.thema === "Ventile")?.objekte).toBe(3);
  });

  it("A6 · EINE Kantenabfrage je OBJEKT, nicht je Zuordnung — der Deckel misst weiter, was er deckelt", async () => {
    const gefragt: string[] = [];
    const sicht = await sichtVon(
      [
        {
          id: "viel",
          category: KATEGORIE_OHNE_WIRKUNG,
          tags: ["a", "b", "c", "d"],
          status: "validiert",
          author: "anna",
          confidentiality: "intern",
        },
        {
          id: "leer",
          category: KATEGORIE_OHNE_WIRKUNG,
          tags: [],
          author: "anna",
          confidentiality: "intern",
        },
      ],
      {
        kanten: {
          kantenFuer: async (koId) => {
            gefragt.push(koId);
            return { total: 1 };
          },
        },
      },
    );

    // Vier Themen aus einem Objekt — aber genau EINE Abfrage. Das themenlose Objekt löst keine aus.
    expect(sicht.themen).toHaveLength(4);
    expect(gefragt, "genau ein Aufruf, für das thematisierte Objekt").toEqual(["viel"]);
    // Das Ergebnis gilt für jedes Thema dieses Objekts — eine Eigenschaft des Objekts, nicht der
    // Zuordnung.
    for (const t of sicht.themen) {
      expect(t.verknuepft, t.thema).toBe(1);
      expect(t.unverknuepft, t.thema).toBe(0);
    }
    expect(sicht.verknuepfungAusgelassen).toBe(false);
  });

  it("A7 · der Themendeckel greift auf der mehrwertigen Achse früher — und sagt es an", async () => {
    // Halb so viele Objekte wie Themen: erst die mehrwertige Achse bringt den Deckel zum Greifen.
    const viele: AchsenKo[] = Array.from({ length: THEMEN_DECKEL / 2 + 3 }, (_, i) => ({
      id: `k${i}`,
      category: KATEGORIE_OHNE_WIRKUNG,
      tags: [`Thema-A-${String(i).padStart(4, "0")}`, `Thema-B-${String(i).padStart(4, "0")}`],
      author: "anna",
      confidentiality: "intern" as const,
    }));

    const sicht = await sichtVon(viele);

    expect(sicht.objekteGesamt, "weniger Objekte als der Deckel").toBeLessThan(THEMEN_DECKEL);
    expect(sicht.themen, "trotzdem am Deckel").toHaveLength(THEMEN_DECKEL);
    expect(sicht.abgeschnitten, "und es steht in der Antwort").toBe(true);
    // Keine Zahl der Weggelassenen — dieselbe Regel wie vor dem Umbau.
    expect(Object.keys(sicht)).not.toContain("weggelassen");
  });

  it("A8 · ABLÖSUNG: genau EINE Themenbildung im Modul, und `category` steht in keiner Codezeile mehr", () => {
    // Der alte Weg muss WEG, nicht danebenliegen (Auftrag §8, Prüfpunkt 7). Zwei Zerleger wären
    // genau der Zustand, den JOB 3073 abgelöst hat — und eine gebliebene `ko.category`-Lesung die
    // Tür dorthin zurück.
    const wurzel = resolve(process.cwd(), "services/wissensnetz/src");
    const dateien = readdirSync(wurzel).filter((n) => n.endsWith(".ts"));
    expect(dateien.length, "das Modul hat Quelldateien").toBeGreaterThan(3);

    const definitionen: string[] = [];
    const kategorieZeilen: string[] = [];
    for (const name of dateien) {
      const zeilen = readFileSync(join(wurzel, name), "utf8").split("\n");
      zeilen.forEach((zeile, i) => {
        if (/function\s+themenVon\b/.test(zeile)) {
          definitionen.push(`${name}:${i + 1}`);
        }
        // Kommentare erklären die Ablösung und dürfen das Wort tragen; CODE nicht mehr.
        const ohneKommentar = zeile.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
        if (/\bcategory\b/.test(ohneKommentar)) {
          kategorieZeilen.push(`${name}:${i + 1} ${zeile.trim()}`);
        }
      });
    }

    // Keine Zeilennummer als Pin: sie wäre bei jeder Kommentaränderung rot, ohne dass sich an der
    // Sache etwas ändert. Gepinnt ist, was zählt — EINE Stelle, und zwar diese Datei.
    expect(definitionen, `Themenbildungen: ${JSON.stringify(definitionen)}`).toHaveLength(1);
    expect(definitionen[0]).toMatch(/^themenkarte\.ts:\d+$/);
    expect(kategorieZeilen, "keine Kategorie mehr im Code").toEqual([]);
  });
});
