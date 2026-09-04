// ================================================================================================
// JOB 2962 · D1 · F-0458 — MESSSONDE: hält das Lesemodell, was seine eigene Doku zusagt?
// ================================================================================================
//
// Diese Datei ist zunächst ein MESSINSTRUMENT, kein Abnahmetest. Der Auftrag verlangt als erste
// Pflicht eine Messung, nicht einen Bau: „Der Belegstand oben ist ein Hinweis, kein Beweis."
//
// Geprüft werden die Zusagen, die `services/wissensnetz/src/lesemodell.ts` und
// `lesemodell-ports.ts` im Klartext geben — jede mit ihrer Fundstelle. Was hier rot wird, ist die
// Lücke des Durchgangs. Was grün bleibt, ist gemessener Bestand.
import { describe, expect, it } from "vitest";

import {
  BEITRAGENDE_DECKEL,
  KANTEN_ABFRAGE_DECKEL,
  LesemodellService,
  THEMEN_DECKEL,
} from "../../services/wissensnetz/src/lesemodell";
import type {
  WissensnetzKantenLeser,
  WissensnetzKo,
  WissensnetzKoLeser,
} from "../../services/wissensnetz/src/lesemodell-ports";

interface PruefKo extends WissensnetzKo {
  geheim?: boolean;
}

const bestand = (kos: readonly PruefKo[]): WissensnetzKoLeser<PruefKo> => ({
  alle: async () => kos,
});

/** Alles ausser `geheim` ist sichtbar — die Entscheidung kommt von aussen, nie aus dem Modul. */
const OFFEN = (ko: PruefKo): boolean => ko.geheim !== true;

const kantenAus = (mitKante: readonly string[]): WissensnetzKantenLeser<PruefKo> => ({
  kantenFuer: async (koId) => ({ total: mitKante.includes(koId) ? 1 : 0 }),
});

const MENGE: readonly PruefKo[] = [
  { id: "a1", category: "Betrieb", author: "anna" },
  { id: "a2", category: "Betrieb", author: "anna" },
  { id: "a3", category: "Betrieb", author: "bert" },
  { id: "b1", category: "Wartung", author: "bert" },
  { id: "g1", category: "Geheim", author: "chef", geheim: true },
  { id: "o1", category: "   ", author: "dora" },
];

// ================================================================================================
// M1 · DIE ZUSAGE DER PORTS: die Objektgleichung geht auf
// ================================================================================================
//
// `lesemodell-ports.ts:220-221` wörtlich: „Die Summe der Themenzähler ist deshalb
// `objekteGesamt - ohneThema`."
describe("F-0458 · M1: die Objektgleichung der Sicht", () => {
  it("Summe der Themenzähler = objekteGesamt − ohneThema", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht({ sichtbar: OFFEN });

    const summe = sicht.themen.reduce((n, t) => n + t.objekte, 0);
    expect(sicht.abgeschnitten).toBe(false);
    expect(summe).toBe(sicht.objekteGesamt - sicht.ohneThema);
  });

  it("das unsichtbare Thema erscheint nicht einmal dem Namen nach", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht({ sichtbar: OFFEN });

    expect(sicht.themen.map((t) => t.thema)).not.toContain("Geheim");
  });
});

// ================================================================================================
// M2 · DIE ZUSAGE DER PORTS: die Personengleichung geht auf
// ================================================================================================
//
// `lesemodell-ports.ts:229-232`: „verschiedene Urheber über alle `themen[].beitragende` **plus**
// diese Zahl ergibt `beitragendeGesamt`" — gültig, solange `abgeschnitten` false ist (`:234`).
describe("F-0458 · M2: die Personengleichung der Sicht", () => {
  it("Urheber in Themen + beitragendeNurOhneThema = beitragendeGesamt", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht({ sichtbar: OFFEN });

    const inThemen = new Set(sicht.themen.flatMap((t) => t.beitragende.map((b) => b.urheber)));
    expect(sicht.abgeschnitten).toBe(false);
    expect(inThemen.size + sicht.beitragendeNurOhneThema).toBe(sicht.beitragendeGesamt);
  });

  it("je Thema: Summe der Beiträge + ohneBeitragende = objekte", async () => {
    const lm = new LesemodellService<PruefKo>({
      kos: bestand([...MENGE, { id: "a4", category: "Betrieb", author: "  " }]),
    });

    const sicht = await lm.sicht({ sichtbar: OFFEN });

    for (const t of sicht.themen) {
      const beitraege = t.beitragende.reduce((n, b) => n + b.objekte, 0);
      expect(beitraege + t.ohneBeitragende).toBe(t.objekte);
    }
  });
});

// ================================================================================================
// M3 · DIE ZUSAGE DES DATEIKOPFS: die Kantenzähler sind vollständig oder gar nicht da
// ================================================================================================
//
// `lesemodell.ts:36-39`: „Der zweite lässt die Zähler lieber WEG, als eine falsche Zahl zu
// liefern — eine über einer Teilmenge gebildete Summe sähe aus wie eine Gesamtsumme."
describe("F-0458 · M3: die Kantenzähler", () => {
  it("mit Port und Anforderung: je Thema verknüpft + unverknüpft = objekte", async () => {
    const lm = new LesemodellService<PruefKo>({
      kos: bestand(MENGE),
      kanten: kantenAus(["a1", "b1"]),
    });

    const sicht = await lm.sicht({ sichtbar: OFFEN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(false);
    for (const t of sicht.themen) {
      expect(t.verknuepft).toBeTypeOf("number");
      expect(t.unverknuepft).toBeTypeOf("number");
      expect((t.verknuepft ?? 0) + (t.unverknuepft ?? 0)).toBe(t.objekte);
    }
  });

  it("ohne Anforderung fehlen die Schlüssel — eine Null wäre eine falsche Aussage", async () => {
    const lm = new LesemodellService<PruefKo>({
      kos: bestand(MENGE),
      kanten: kantenAus(["a1"]),
    });

    const sicht = await lm.sicht({ sichtbar: OFFEN });

    for (const t of sicht.themen) {
      expect(t).not.toHaveProperty("verknuepft");
      expect(t).not.toHaveProperty("unverknuepft");
    }
    expect(sicht).not.toHaveProperty("verknuepfungAusgelassenGrund");
  });

  it("ohne Port wird ehrlich ausgelassen, mit benanntem Grund", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht({ sichtbar: OFFEN, mitVerknuepfung: true });

    expect(sicht.verknuepfungAusgelassen).toBe(true);
    expect(sicht.verknuepfungAusgelassenGrund).toBe("kein-kantenport");
  });
});

// ================================================================================================
// M4 · DIE ZUSAGE DES DATEIKOPFS: fail-closed
// ================================================================================================
//
// `lesemodell.ts:95-99`: „ohne übergebene Entscheidung ist NICHTS sichtbar — nicht ‚alles‘."
describe("F-0458 · M4: fail-closed", () => {
  it("ohne Sichtbarkeitsentscheidung ist die Sicht leer", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht();

    expect(sicht.themen).toEqual([]);
    expect(sicht.objekteGesamt).toBe(0);
    expect(sicht.beitragendeGesamt).toBe(0);
  });
});

// ================================================================================================
// M5 · DIE ZUSAGE DER DECKEL
// ================================================================================================
describe("F-0458 · M5: die drei Deckel", () => {
  it("ein unbrauchbarer Deckelwert leert die Sicht nicht", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht({ sichtbar: OFFEN, deckel: Number.NaN });

    expect(sicht.themen.length).toBeGreaterThan(0);
    expect(sicht.abgeschnitten).toBe(false);
  });

  it("die drei Deckel sind endliche, positive Ganzzahlen", () => {
    for (const d of [THEMEN_DECKEL, KANTEN_ABFRAGE_DECKEL, BEITRAGENDE_DECKEL]) {
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
    }
  });
});

// ================================================================================================
// M6 · DER PRODUKTIONSWEG: so wird die Sicht im Betrieb wirklich gerufen
// ================================================================================================
//
// `services/app/src/routes/ko-routes.ts:507-511` übergibt GENAU EINEN Port:
//
//     wissensnetzMetrikFuer({ id, role }, { kos: { alle: () => ko.list({}) } }, …)
//
// Kein `kanten`-Port, kein `mitVerknuepfung`. Die Route zeigt laut ihrem eigenen Kommentar
// (`:481`) „WIE VIEL davon da ist"; WAS zusammenhängt, zeigt `/api/graph`.
//
// Dieser Fall hält den Produktionsweg fest: Ohne Kantenport bleiben die Zähler weg, und die Sicht
// sagt das — sie erfindet keine Null.
describe("F-0458 · M6: der Produktionsweg der Route", () => {
  it("nur der kos-Port verdrahtet, keine Verknüpfung angefordert: keine Zähler, kein Grund", async () => {
    const lm = new LesemodellService<PruefKo>({ kos: bestand(MENGE) });

    const sicht = await lm.sicht({ sichtbar: OFFEN });

    expect(sicht.verknuepfungAusgelassen).toBe(false);
    expect(sicht).not.toHaveProperty("verknuepfungAusgelassenGrund");
    for (const t of sicht.themen) {
      expect(t).not.toHaveProperty("verknuepft");
    }
  });
});

// ================================================================================================
// M7 · DIE GRENZE DER SICHT — protokolliert, nicht zugesichert
// ================================================================================================
//
// BEFUND DIESES DURCHGANGS, nicht Mangel: Die Verknüpfungslage steht NUR je Thema. Ist die
// Themenliste am Deckel beschnitten, ist jede Summe darüber eine Untergrenze — eine
// Gesamtauskunft trägt die Sicht nicht.
//
// Das ist KEIN Bruch einer Zusage: `lesemodell-ports.ts:234-238` sagt für die Personengleichung
// ausdrücklich „**Die Gleichung gilt genau dann, wenn `abgeschnitten` `false` ist** … Bei
// `abgeschnitten: true` ist die Summe deshalb eine Untergrenze — genau das sagt `abgeschnitten`
// an." Dieselbe Regel gilt hier.
//
// Dieser Fall SICHERT deshalb nichts zu, was das Produkt nicht verspricht. Er hält den
// gemessenen Zustand fest und schreibt ihn ins Protokoll — dieselbe Bauform, die
// `tests/design/zielbild-h2-pruefen.test.ts` für offene Werte verwendet (bis JOB 3061 H2 stand
// hier `zielbild-validierung.test.ts:414-421`; jene Messung ist abgeloest). Eine
// Zusicherung daraus zu machen wäre eine erfundene Anforderung.
describe("F-0458 · M7: die Verknüpfungslage bei beschnittener Themenliste", () => {
  it("beschnitten heisst Untergrenze — und die Sicht sagt es an", async () => {
    const viele: PruefKo[] = [];
    for (let i = 0; i < THEMEN_DECKEL + 5; i++) {
      viele.push({ id: `k${i}`, category: `Thema-${String(i).padStart(4, "0")}`, author: "anna" });
    }
    const lm = new LesemodellService<PruefKo>({
      kos: bestand(viele),
      kanten: kantenAus(viele.slice(0, 7).map((k) => k.id)),
    });

    const sicht = await lm.sicht({ sichtbar: OFFEN, mitVerknuepfung: true });

    // Zugesichert wird nur, was das Produkt zusagt: die Ansage der Beschneidung und
    // vollständige Zähler je AUSGELIEFERTEM Thema.
    expect(sicht.abgeschnitten).toBe(true);
    expect(sicht.verknuepfungAusgelassen).toBe(false);
    expect(sicht.themen).toHaveLength(THEMEN_DECKEL);
    for (const t of sicht.themen) {
      expect((t.verknuepft ?? 0) + (t.unverknuepft ?? 0)).toBe(t.objekte);
    }

    // Protokolliert, nicht zugesichert: die Summe über die ausgelieferten Themen ist eine
    // Untergrenze, und eine Gesamtauskunft gibt es nicht.
    const summeVerknuepft = sicht.themen.reduce((n, t) => n + (t.verknuepft ?? 0), 0);
    const hatGesamt = Object.hasOwn(sicht, "verknuepftGesamt");
    const gesamt = hatGesamt ? "vorhanden" : "nicht vorhanden";
    console.info(
      `JOB 2962 D1 · F-0458 · BEFUND: Themen ausgeliefert ${sicht.themen.length} von ${THEMEN_DECKEL + 5} · abgeschnitten=${sicht.abgeschnitten} · Summe verknuepft ueber die ausgelieferten Themen=${summeVerknuepft} (Untergrenze) · Gesamtauskunft in der Sicht: ${gesamt} · Ownerfrage siehe Rueckgabe JOB 2962 D1`,
    );
  });
});
