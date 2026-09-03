// A28 (OFFEN.md:165) — DER SIGNALKERN GEGEN ECHTE, PERSISTIERTE BEFUNDE.
//
// WARUM DIESE DATEI EXISTIERT, und zwar genau so:
// JOB 1500 D1 hat den Entscheidungskern `services/app/src/duplicate-signal.ts` gebaut und mit 17
// Faellen belegt (Commit `7fb6ace`, BEN GRUEN) — aber ausschliesslich gegen HANDGESCHRIEBENE Paare
// (`{ koA: "ko-mein-1", koB: … }`). BEN hat das im D1-Urteil als Prueflaecke 1 benannt, woertlich:
//
//   „Kein Test bindet reale persistierte Overlap-/Conflict-Daten an den Kern."
//
// Das ist der Unterschied zwischen „die Funktion rechnet richtig" und „die Funktion passt auf das,
// was der Bestand wirklich hergibt". Diese Datei schliesst genau diese Luecke: sie legt Befunde
// ueber die ECHTEN Dienste an (`OverlapService.detectForSubject`, `ConflictService.create`),
// liest sie ueber die ECHTEN Lesewege zurueck (`unresolved()`) und gibt GENAU DAS in den Kern.
//
// ================================================================================================
// DIE TRAGENDE EIGENSCHAFT: DIE RICHTUNG DES PAARES — und warum sie eine SICHERHEITSZUSAGE ist.
// ================================================================================================
//
// Der Kern unterscheidet „mein Einreichen hat etwas gefunden" (erlaubt) von „ein fremdes Objekt
// dupliziert meines" (GESPERRT bis zu Pedis Entscheidung, A28) allein daran, ob `koA` mir gehoert.
// Die gesamte Sperre haengt also an einer einzigen Annahme: `koA` IST das eingereichte Subjekt.
//
// Bis heute war das eine LESART DES QUELLTEXTS — ein Kommentar in `duplicate-signal.ts:27-30`, der
// auf `overlap-service.ts:358` und `conflicts/src/service.ts:387` zeigt. Keine Zusicherung.
// Kippte jemand dort die Reihenfolge, meldete das System klaglos genau den Fall, den Pedi
// ausdruecklich noch nicht entschieden hat — und kein Test haette es bemerkt.
//
// Hier wird die Annahme zur MESSUNG: der Aufbau reicht ein BEKANNTES Subjekt herein und prueft,
// was der Dienst daraus wirklich persistiert.
//
// Herkunft: gebaut in JOB 1500 (PRO6) gegen dieselbe Base, dort nie integriert; in JOB 1546 D1 an
// die Namensmuster-Stelle der Lease uebernommen.
import { describe, expect, it } from "vitest";
import { type Deckung, eigeneBefunde } from "../../services/app/src/duplicate-signal";
import {
  ConflictService,
  type DetectSubject,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
} from "../../services/conflicts";

// ------------------------------------------------------------------------------------------------
// Aufbau — bewusst ohne Modell: der judge liefert ein festes Urteil, damit der Lauf deterministisch
// ist. Die deterministische Deckungspruefung des Dienstes laeuft davon unberuehrt.
// ------------------------------------------------------------------------------------------------

function subjekt(id: string, titel: string, aussage: string): DetectSubject {
  return {
    refId: id,
    title: titel,
    statement: aussage,
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
  };
}

// Die Form ist NICHT geraten: `OverlapAspect` traegt `beschreibung|zitatA|zitatB`
// (duplicate-detect.ts:25-29), und `empfehlung` ist eine geschlossene Menge (:31-35). Ein erster
// Entwurf dieses Aufbaus setzte `{ text, a, b }` und `"merge"` — der Lauf brach in
// `normalizeForCompare` (detect.ts:147), weil der Dienst das Zitat gegen den Kerntext prueft.
// Genau das ist der Wert dieser Datei: eine Handform, die nicht passt, faellt hier auf.
const URTEIL: OverlapVerdict = {
  beziehung: "identisch",
  aspects: [
    {
      beschreibung: "Pumpe entlueften",
      zitatA: "Pumpe entlueften",
      zitatB: "Pumpe entlueften",
    },
  ],
  nurInA: "",
  nurInB: "",
  empfehlung: "zusammenfuehren",
  confidence: 0.95,
  begruendung: "Testaufbau",
};

const judge = async (): Promise<OverlapVerdict> => URTEIL;

/** Zwei fast gleiche Objekte — hohe Textdeckung, damit der Dienst wirklich einen Eintrag anlegt. */
const MEIN = subjekt(
  "ko-mein-1",
  "Pumpe entlueften",
  "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlueften.",
);
const FREMD = subjekt(
  "ko-fremd-9",
  "Pumpe entlueften",
  "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlueften.",
);

const MEINE_IDS = ["ko-mein-1", "ko-mein-2"];

async function overlapDienst(): Promise<OverlapService> {
  return new OverlapService({ repo: new InMemoryOverlapRepo() });
}

function konfliktDienst(): ConflictService {
  return new ConflictService({ repo: new InMemoryConflictRepo() });
}

// JOB 3032 (N5): der Kern nimmt seit diesem Auftrag die DECKUNGSLAGE je eigener Kennung entgegen —
// wie weit der Pruef-Lauf reichte, der das Objekt angesehen hat. Diese Datei misst den Kern gegen
// ECHTE Overlap-/Konfliktdaten und stellt deshalb KEINE Lage: die Dienste hier fuehren keinen
// Pruef-Lauf, also gibt es ueber ihn auch nichts zu sagen. Genau das ist die erwartete Antwort —
// `kein_lauf` mit zwei `null`, fail-honest statt Entwarnung. Wo die Lage ENTSTEHT und dass sie mit
// der Bestandsauswertung uebereinstimmt, prueft `tests/eigenes-signal/`.
const KEINE_LAGE = new Map<string, Deckung>();
const OHNE_AUSKUNFT: Deckung = { lage: "kein_lauf", geprueft: null, bestand: null };

// ------------------------------------------------------------------------------------------------

describe("A28 · der Signalkern gegen ECHTE Overlap-Daten", () => {
  it("E-1 · mein Einreichen legt einen echten Eintrag an — und der Kern meldet ihn als meinen", async () => {
    const overlaps = await overlapDienst();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });

    const offen = await overlaps.unresolved();
    expect(offen.length, "der Dienst hat keinen Eintrag angelegt — der Aufbau traegt nicht").toBe(
      1,
    );

    // Die Richtungsannahme des Kerns, hier gemessen statt gelesen:
    expect(offen[0]?.koA, "koA ist NICHT das eingereichte Subjekt").toBe("ko-mein-1");
    expect(offen[0]?.koB).toBe("ko-fremd-9");

    const befunde = eigeneBefunde(MEINE_IDS, offen, [], KEINE_LAGE);
    expect(befunde).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: false, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("E-2 · fremdes Einreichen gegen mein Objekt: echter Eintrag, aber KEIN Signal", async () => {
    const overlaps = await overlapDienst();
    // Diesmal ist das SUBJEKT das fremde Objekt — genau die Lage, die A28 Pedi vorbehaelt.
    await overlaps.detectForSubject(FREMD, [MEIN], judge, { minConfidence: 0.5 });

    const offen = await overlaps.unresolved();
    expect(offen.length).toBe(1);
    expect(offen[0]?.koA, "der Aufbau trifft die gesperrte Richtung nicht").toBe("ko-fremd-9");
    expect(offen[0]?.koB).toBe("ko-mein-1");

    // Der Eintrag existiert und betrifft mein Objekt — trotzdem entsteht kein Signal.
    expect(eigeneBefunde(MEINE_IDS, offen, [], KEINE_LAGE)).toEqual([]);
  });

  it("E-3 · derselbe Bestand, zwei Betrachter: der Kern trennt sie an der Richtung", async () => {
    const overlaps = await overlapDienst();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });
    const offen = await overlaps.unresolved();

    // Der Autor des Subjekts sieht das Signal …
    expect(eigeneBefunde(["ko-mein-1"], offen, [], KEINE_LAGE)).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: false, deckung: OHNE_AUSKUNFT },
    ]);
    // … der Autor des vorgefundenen Kandidaten nicht.
    expect(eigeneBefunde(["ko-fremd-9"], offen, [], KEINE_LAGE)).toEqual([]);
  });
});

describe("A28 · der Signalkern gegen ECHTE Konfliktdaten", () => {
  it("E-4 · ein echter Konflikt an meinem Objekt wird als Konflikt gemeldet, nicht als Dublette", async () => {
    const conflicts = konfliktDienst();
    await conflicts.create({
      koA: "ko-mein-1",
      koB: "ko-fremd-9",
      type: "truth",
      description: "Testaufbau: widersprechende Angaben.",
    });

    const offen = await conflicts.unresolved();
    expect(offen.length).toBe(1);
    expect(offen[0]?.koA).toBe("ko-mein-1");

    expect(eigeneBefunde(MEINE_IDS, [], offen, KEINE_LAGE)).toEqual([
      { koId: "ko-mein-1", dublette: false, konflikt: true, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("E-5 · fremdes koA, mein koB: echter Konflikt, KEIN Signal", async () => {
    const conflicts = konfliktDienst();
    await conflicts.create({
      koA: "ko-fremd-9",
      koB: "ko-mein-1",
      type: "truth",
      description: "Testaufbau: gesperrte Richtung.",
    });

    const offen = await conflicts.unresolved();
    expect(offen.length).toBe(1);
    expect(eigeneBefunde(MEINE_IDS, [], offen, KEINE_LAGE)).toEqual([]);
  });

  it("E-6 · beide Arten am selben Objekt, beide aus echten Diensten", async () => {
    const overlaps = await overlapDienst();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });
    const conflicts = konfliktDienst();
    await conflicts.create({
      koA: "ko-mein-1",
      koB: "ko-fremd-8",
      type: "context",
      description: "Testaufbau: zweite Art.",
    });

    const befunde = eigeneBefunde(
      MEINE_IDS,
      await overlaps.unresolved(),
      await conflicts.unresolved(),
      KEINE_LAGE,
    );
    expect(befunde).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: true, deckung: OHNE_AUSKUNFT },
    ]);
  });
});

describe("A28 · die Grenze haelt auch gegen echte Eintraege", () => {
  it("G-1 · die Ausgabe traegt keine Kennung der Gegenseite — geprueft am verschrifteten Ergebnis", async () => {
    const overlaps = await overlapDienst();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });
    const conflicts = konfliktDienst();
    await conflicts.create({
      koA: "ko-mein-1",
      koB: "ko-fremd-8",
      type: "truth",
      description: "Testaufbau.",
    });

    const befunde = eigeneBefunde(
      MEINE_IDS,
      await overlaps.unresolved(),
      await conflicts.unresolved(),
      KEINE_LAGE,
    );
    const verschriftet = JSON.stringify(befunde);
    expect(verschriftet).not.toContain("ko-fremd-9");
    expect(verschriftet).not.toContain("ko-fremd-8");
  });

  it("G-2 · und auch keinen INHALT der Gegenseite — der echte Eintrag traegt ihn, das Signal nicht", async () => {
    // Der springende Punkt: `OverlapEntry` fuehrt `aspects` (woertliche gemeinsame Aussagen) und
    // `eigenanteilA`/`eigenanteilB` — also genau das, was NUR in je einem der beiden Objekte steht.
    // Wenn der Kern jemals mehr als Vorhandensein und Art durchreichte, faellt es hier auf.
    const overlaps = await overlapDienst();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });
    const offen = await overlaps.unresolved();

    // Kalibrierung: der echte Eintrag traegt den Inhalt tatsaechlich — sonst pruefte G-2 nichts.
    expect(JSON.stringify(offen)).toContain("Pumpe entlueften");

    const verschriftet = JSON.stringify(eigeneBefunde(MEINE_IDS, offen, [], KEINE_LAGE));
    expect(verschriftet).not.toContain("Pumpe entlueften");
    // JOB 3032 (N5): aus drei Feldern sind vier geworden. `deckung` ist eine Aussage ueber den
    // EIGENEN Pruef-Lauf und traegt hier mangels Lauf `kein_lauf` mit zwei `null`.
    expect(Object.keys(JSON.parse(verschriftet)[0]).sort()).toEqual([
      "deckung",
      "dublette",
      "koId",
      "konflikt",
    ]);
  });
});
