// ================================================================================================
// JOB 3068 (N5) — „GEGEN WIE VIEL WURDE GEPRÜFT", ALS TABELLE, OHNE MOUNT.
// ================================================================================================
//
// Pedis Zeile N5 hat drei Zusagen: der Autor sieht DAUERHAFT, dass sein Beitrag kollidiert, OHNE
// fremden Inhalt, mit ehrlichem Satz, GEGEN WIE VIEL geprüft wurde. Die dritte trug bis zu diesem
// Auftrag niemand an der Fläche: der Server liefert die Deckung seit JOB 3032
// (`services/app/src/duplicate-signal.ts:83-89`, LIVE `1.0.0-beta.1.44`), der Client-Spiegel
// `api/types.ts` warf sie weg, und `Kollisionsauskunft` hatte kein Feld dafür.
//
// WARUM HIER UND NICHT NUR IN CHROMIUM: dieselbe Begründung wie bei `job3025-quellenlage.test.ts`.
// Die Frage „welcher Satz bei welcher Lage, und mit welcher Zahl" ist eine reine Ableitung; steckte
// ihre Probe nur in einem Mount, wäre jede vergessene Kombination erst im Betrieb sichtbar. Diese
// Datei fährt die vier Deckungslagen gegen die sechs Abruflagen — als Tabelle, ohne React, ohne DOM.
//
// DIE DREI ZUSICHERUNGEN, die hier gemessen werden:
//   1. Die Zahlen kommen DURCH (Fall A) — `geprueft`/`bestand` unverändert, roh.
//   2. `null` bleibt `null` (Fall B) — nie `0`. `0` hieße „gegen null geprüft" (eine Auskunft),
//      `null` heißt „darüber liegt keine Auskunft vor" (keine).
//   3. Die Deckung ist eine BESTANDSAUSSAGE und steht nur bei `frisch` (Fall C) — dieselbe Regel
//      und derselbe Entscheider (`bestandsaussageErlaubt`) wie bei der Verneinung.
import { describe, expect, it } from "vitest";
import type {
  Conflict,
  Deckung,
  DeckungsLage,
  EigenerBefund,
  KnowledgeObject,
} from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  LAGE_VON_SCHWACH_NACH_STARK,
  type Lage,
  type Quelle,
  type Quellenzustand,
  eigeneKollisionDetail,
  eigeneKollisionStart,
} from "../../apps/web/src/lib/eigeneKollision";

// ------------------------------------------------------------------------------------------------
// Aufbau — derselbe wie in `job3025-quellenlage.test.ts`: eine Quelle über ihre vier Skalare.
// ------------------------------------------------------------------------------------------------
function quelle<T>(over: Partial<Quellenzustand<T>> & { data?: T }): Quellenzustand<T> {
  return {
    status: "success",
    fetchStatus: "idle",
    isError: false,
    dataUpdatedAt: 1,
    data: undefined,
    ...over,
  };
}

function auffrischbar<T>(z: Quellenzustand<T>): Quelle<T> {
  return { ...z, refetch: () => {} };
}

/**
 * Die vier Skalare je Abruflage — OHNE `data`. Das ist der Kunstgriff dieser Datei: der
 * Zwischenspeicher bleibt in JEDER Lage bestehen (sonst gäbe es in `laedt`/`erstfehler` gar keinen
 * Befund mehr, und Fall C prüfte nicht mehr, was er behauptet), die Lage entsteht allein aus den
 * Skalaren. `dataUpdatedAt: 0` sagt dabei dasselbe wie ein fehlender Wert: er kam nie aus einer
 * Antwort (`quellenlage`, eigeneKollision.ts:103).
 */
type Skalare = Omit<Quellenzustand<never>, "data">;
const QUELLE_FUER: Record<Lage, Partial<Skalare>> = {
  laedt: { status: "pending", fetchStatus: "fetching", dataUpdatedAt: 0 },
  frisch: {},
  erstfehler: { status: "error", isError: true, dataUpdatedAt: 0 },
  auffrischung_laeuft: { fetchStatus: "fetching" },
  auffrischung_gescheitert: { status: "error", isError: true },
  pausiert: { fetchStatus: "paused" },
};

const leer = {
  konflikte: auffrischbar(quelle<readonly Conflict[]>({ data: [] })),
  kos: auffrischbar(quelle<readonly KnowledgeObject[]>({ data: [] })),
};

function befund(deckung: Deckung): EigenerBefund {
  return { koId: "ko-1", dublette: true, konflikt: false, deckung };
}

/** Die Signal-Quelle mit genau diesem Befund, in genau dieser Abruflage. */
function mitBefund(deckung: Deckung, lage: Lage = "frisch"): Quelle<readonly EigenerBefund[]> {
  return auffrischbar(
    quelle<readonly EigenerBefund[]>({ ...QUELLE_FUER[lage], data: [befund(deckung)] }),
  );
}

const auskunftMit = (deckung: Deckung, lage: Lage = "frisch") =>
  eigeneKollisionDetail({ koId: "ko-1", ...leer, befunde: mitBefund(deckung, lage) });

/**
 * DIE ZAHLENFORM, DIE DER SERVER ZU EINER LAGE WIRKLICH LIEFERT (JOB 3068 R2, bens Befund).
 *
 * `conflicts-routes.ts` (`lageAus`/`deckungAus`) entscheidet beides GETRENNT: die Lage aus dem
 * Laufstatus, die Zahlen aus dem Abdeckungsprotokoll. Nur `vollstaendig` setzt ein Protokoll zwingend
 * voraus (`isCompleteRun` liest es); `unvollstaendig` gibt es MIT Protokoll (gedeckelt/abgebrochen)
 * und OHNE (`status: "failed"`/`"pending"`). Genau diese zweite Form fehlte in Runde 1.
 */
function deckung(lage: DeckungsLage): Deckung {
  return lage === "vollstaendig" || lage === "unvollstaendig"
    ? { lage, geprueft: 12, bestand: 40 }
    : { lage, geprueft: null, bestand: null };
}

// ------------------------------------------------------------------------------------------------
// Fall A — DER KERNBELEG: die Zahlen kommen an der Fläche an.
// ------------------------------------------------------------------------------------------------
describe("JOB 3068 · Fall A — die Deckung erreicht die Auskunft", () => {
  it("D-1 · unvollständiger Lauf: 12 von 40 stehen unverändert in der Auskunft", () => {
    // GEGENPROBE (Auftrag §8.2a): in `schluss()` (eigeneKollision.ts) `deckung` hart auf `null`
    // stellen → dieser Fall wird rot.
    const a = auskunftMit({ lage: "unvollstaendig", geprueft: 12, bestand: 40 });
    expect(a.art).toBe("dublette");
    expect(a.deckung).not.toBeNull();
    expect(a.deckung?.geprueft).toBe(12);
    expect(a.deckung?.bestand).toBe(40);
    expect(a.deckung?.lage).toBe<DeckungsLage>("unvollstaendig");
  });

  it("D-2 · jede der vier Lagen bekommt genau einen, und je einen eigenen Satz", () => {
    const keys = new Map<DeckungsLage, string>();
    for (const lage of ["vollstaendig", "unvollstaendig", "ohne_protokoll", "kein_lauf"] as const) {
      // JOB 3068 R2: mit der Zahlenform, die der Server zu dieser Lage WIRKLICH liefert — die zwei
      // belegten Lagen mit Protokoll, die zwei unbelegten ohne. Runde 1 speiste alle vier mit
      // `null/null`; genau diese Nachlässigkeit verdeckte bens Befund.
      const a = auskunftMit(deckung(lage));
      const key = a.deckung?.satzKey;
      expect(key, `Lage ${lage} ohne Satz`).toBeTruthy();
      keys.set(lage, key as string);
    }
    // Vier Lagen, vier verschiedene Sätze. Besonders: `ohne_protokoll` und `kein_lauf` dürfen nie
    // zusammenfallen — „ein Lauf, dessen Reichweite unbelegt ist" ist nicht „gar kein Lauf"
    // (duplicate-signal.ts:64-71).
    expect(new Set(keys.values()).size).toBe(4);
    expect(keys.get("ohne_protokoll")).not.toBe(keys.get("kein_lauf"));
  });

  it("D-3 · `0` bleibt `0` — eine gemessene Null ist eine Auskunft, keine Lücke", () => {
    const a = auskunftMit({ lage: "unvollstaendig", geprueft: 0, bestand: 7 });
    expect(a.deckung?.geprueft).toBe(0);
    expect(a.deckung?.bestand).toBe(7);
  });

  it("D-4 · die Auskunft trägt weiter NICHTS über die Gegenseite (A28, OFFEN.md:165)", () => {
    const gegenseite: Conflict = {
      id: "c-1",
      koA: "ko-1",
      koB: "ko-geheim-9",
      type: "truth",
      status: "offen",
      description: "Der Kessel läuft mit 6 bar.",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      createdAt: "2026-09-01T00:00:00Z",
    };
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      konflikte: auffrischbar(quelle<readonly Conflict[]>({ data: [gegenseite] })),
      befunde: mitBefund({ lage: "vollstaendig", geprueft: 40, bestand: 40 }),
    });
    // Kalibrierung: die Eingabe trägt den fremden Inhalt wirklich.
    expect(JSON.stringify([gegenseite])).toContain("ko-geheim-9");
    const verschriftet = JSON.stringify(a);
    expect(verschriftet).not.toContain("ko-geheim-9");
    expect(verschriftet).not.toContain("6 bar");
    // …und die Deckung ist trotzdem da: sie beschreibt MEINEN Lauf, nicht das fremde Objekt.
    expect(a.deckung?.bestand).toBe(40);
  });
});

// ------------------------------------------------------------------------------------------------
// Fall B — `null` bleibt `null`, und der Satz nennt dann keine Zahl.
// ------------------------------------------------------------------------------------------------
describe("JOB 3068 · Fall B — ohne Protokoll steht keine Zahl da", () => {
  it("D-5 · `ohne_protokoll`: beide Zahlen bleiben `null`, nichts wird auf 0 normalisiert", () => {
    // GEGENPROBE (Auftrag §8.2c): `geprueft`/`bestand` in `deckungsauskunft` mit `?? 0` versehen →
    // dieser Fall wird rot.
    const a = auskunftMit({ lage: "ohne_protokoll", geprueft: null, bestand: null });
    expect(a.deckung?.geprueft).toBeNull();
    expect(a.deckung?.bestand).toBeNull();
    expect(a.deckung?.geprueft).not.toBe(0);
    expect(a.deckung?.bestand).not.toBe(0);
  });

  it("D-6 · und der Satz ist ein anderer als bei `kein_lauf`", () => {
    const ohneProtokoll = auskunftMit({ lage: "ohne_protokoll", geprueft: null, bestand: null });
    const keinLauf = auskunftMit({ lage: "kein_lauf", geprueft: null, bestand: null });
    expect(ohneProtokoll.deckung?.satzKey).not.toBe(keinLauf.deckung?.satzKey);
  });
});

// ------------------------------------------------------------------------------------------------
// Fall B2 — DER GEGENFALL AUS RUNDE 1 (bens Korrekturpflicht 1): eine LAGE ist noch keine ZAHL.
// ------------------------------------------------------------------------------------------------
//
// `unvollstaendig` MIT `null/null` ist ein gültiger Serverzustand: `lageAus` liest den Laufstatus
// (`failed`/`pending` → unvollständig), `deckungAus` liest das Protokoll (fehlt → beide `null`) —
// zwei getrennte Entscheidungen in `conflicts-routes.ts`. Runde 1 wählte den Satz allein nach der
// Lage und schrieb deshalb „Gegen  von  Einträgen im Bestand geprüft": zwei Löcher statt einer
// Auskunft. Diese Fälle halten die Regel fest, die das behebt.
describe("JOB 3068 R2 · Fall B2 — unvollständig OHNE Zahlen sagt es, statt Löcher zu lassen", () => {
  const OHNE_ZAHLEN: Deckung = { lage: "unvollstaendig", geprueft: null, bestand: null };

  it("D-5b · der gewählte Satz ist NICHT der mit den Platzhaltern", () => {
    // GEGENPROBE: in `DECKUNG_SATZ` (eigeneKollision.ts) bei `unvollstaendig` `ohneZahlen` auf
    // `"kollision.deckung.unvollstaendig"` stellen → dieser Fall und D-17 werden rot.
    const mitZahlen = auskunftMit({ lage: "unvollstaendig", geprueft: 12, bestand: 40 });
    const ohneZahlen = auskunftMit(OHNE_ZAHLEN);
    expect(ohneZahlen.deckung?.satzKey).not.toBe(mitZahlen.deckung?.satzKey);
    expect(ohneZahlen.deckung?.nenntZahlen).toBe(false);
    expect(mitZahlen.deckung?.nenntZahlen).toBe(true);
  });

  it("D-5c · die Lage bleibt `unvollstaendig` — abgeschwächt wird der SATZ, nicht der Befund", () => {
    const a = auskunftMit(OHNE_ZAHLEN);
    expect(a.deckung?.lage).toBe<DeckungsLage>("unvollstaendig");
    expect(a.deckung?.geprueft).toBeNull();
    expect(a.deckung?.bestand).toBeNull();
  });

  it("D-5d · und er fällt NICHT mit `ohne_protokoll` oder `kein_lauf` zusammen", () => {
    // Der Unterschied trägt eine Aussage: „ein abgeschlossener Lauf ohne Protokoll" ist etwas
    // anderes als „ein Lauf, der nicht als vollständig belegt ist" (duplicate-signal.ts:64-71).
    const a = auskunftMit(OHNE_ZAHLEN).deckung?.satzKey;
    expect(a).not.toBe(
      auskunftMit({ lage: "ohne_protokoll", geprueft: null, bestand: null }).deckung?.satzKey,
    );
    expect(a).not.toBe(
      auskunftMit({ lage: "kein_lauf", geprueft: null, bestand: null }).deckung?.satzKey,
    );
  });

  it("D-5e · EINE fehlende Zahl genügt — halbe Zahlen sind keine Auskunft", () => {
    for (const halb of [
      { lage: "unvollstaendig", geprueft: 12, bestand: null },
      { lage: "unvollstaendig", geprueft: null, bestand: 40 },
    ] as const) {
      const a = auskunftMit(halb);
      expect(a.deckung?.nenntZahlen, JSON.stringify(halb)).toBe(false);
      // Die vorhandene Hälfte wird nicht weggeworfen — sie steht nur in keinem Satz.
      expect(a.deckung?.geprueft, JSON.stringify(halb)).toBe(halb.geprueft);
      expect(a.deckung?.bestand, JSON.stringify(halb)).toBe(halb.bestand);
    }
  });

  it("D-5f · `vollstaendig` ohne Protokoll behauptet keine Vollständigkeit mehr", () => {
    // Diesen Fall kann der Server heute nicht erzeugen (`isCompleteRun` LIEST das Protokoll, ohne
    // Protokoll gibt es kein `vollstaendig`). Die Tabelle beantwortet ihn trotzdem, statt ihn
    // offenzulassen: ohne Protokoll ist die Vollständigkeit unbelegt, es bleibt die schwächere
    // Aussage „ein Lauf hat angesehen, seine Reichweite ist nicht belegt".
    const a = auskunftMit({ lage: "vollstaendig", geprueft: null, bestand: null });
    expect(a.deckung?.nenntZahlen).toBe(false);
    expect(a.deckung?.satzKey).toBe(
      auskunftMit({ lage: "ohne_protokoll", geprueft: null, bestand: null }).deckung?.satzKey,
    );
  });

  it("D-5g · ein vollständiger Lauf mit übersprungenen Kandidaten reicht die Rohzahlen durch", () => {
    // bens Prüflücken-Hinweis: `alreadyOpen > 0` erlaubt „8 von 9 … vollständig belegt". Das ist
    // kein Widerspruch, sondern die Buchhaltung des Servers: `completed` zählt die tatsächlich
    // verglichenen Kandidaten, `available` den Bestand, und `isCompleteRun` bewertet den LAUF.
    // Die Fläche rechnet daran NICHTS nach — sie reicht roh durch, was gemessen wurde.
    const a = auskunftMit({ lage: "vollstaendig", geprueft: 8, bestand: 9 });
    expect(a.deckung?.geprueft).toBe(8);
    expect(a.deckung?.bestand).toBe(9);
    expect(a.deckung?.nenntZahlen).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// Fall C — die Deckung ist eine Bestandsaussage: NUR bei `frisch`.
// ------------------------------------------------------------------------------------------------
describe("JOB 3068 · Fall C — kein Deckungssatz ohne frische Datengrundlage", () => {
  const DECKUNG: Deckung = { lage: "vollstaendig", geprueft: 40, bestand: 40 };

  it("D-7 · in den fünf anderen Lagen ist `deckung` null — der Befund bleibt", () => {
    // GEGENPROBE (Auftrag §8.2b): `bestandsaussageErlaubt(lage)` in `deckungsauskunft` durch `true`
    // ersetzen → dieser Fall wird rot.
    for (const lage of LAGE_VON_SCHWACH_NACH_STARK) {
      if (lage === "frisch") {
        continue;
      }
      const a = auskunftMit(DECKUNG, lage);
      expect(a.lage, `Aufbau der Lage ${lage}`).toBe(lage);
      expect(a.deckung, `Lage ${lage} trägt eine Zahl, die sie nicht belegen kann`).toBeNull();
      // Der Befund selbst verschwindet nie — er wird eingeordnet, nicht kassiert.
      expect(a.art, `Lage ${lage}`).toBe("dublette");
    }
  });

  it("D-8 · KALIBRIERUNG: bei `frisch` steht sie da (sonst wäre D-7 vakuös)", () => {
    const a = auskunftMit(DECKUNG, "frisch");
    expect(a.lage).toBe<Lage>("frisch");
    expect(a.deckung?.bestand).toBe(40);
  });

  it("D-9 · auch eine ANDERE schwache Quelle nimmt die Deckung zurück, nicht nur die Signalquelle", () => {
    // Die Deckung hängt an `gesamtlage`, nicht an der Lage der Signalquelle allein: „gegen 40 von 40
    // geprüft" ist eine Aussage über den BESTAND, und ohne aktuellen Bestand ist sie unbelegt.
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      befunde: mitBefund(DECKUNG),
      kos: auffrischbar(quelle<readonly KnowledgeObject[]>({ data: [], fetchStatus: "paused" })),
    });
    expect(a.lage).toBe<Lage>("pausiert");
    expect(a.deckung).toBeNull();
    expect(a.art).toBe("dublette");
  });
});

// ------------------------------------------------------------------------------------------------
// Die Ränder: ohne Befund keine Deckung, und die Startseite bekommt keine.
// ------------------------------------------------------------------------------------------------
describe("JOB 3068 · die Ränder", () => {
  it("D-10 · kein Befund → `deckung` ist null, und die Verneinung steht allein da", () => {
    // Und das ist kein Versäumnis: `/api/duplicate-signal` liefert je Objekt MIT Befund einen
    // Eintrag; die Deckung hängt an ihm und erzeugt keinen (duplicate-signal.ts:262-264). Über ein
    // Objekt OHNE Befund spricht `/api/ai-check/coverage-summary`, nicht diese Auskunft.
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [] })),
    });
    expect(a.art).toBe("keine");
    expect(a.satzKey).toBe("kollision.detail.keine");
    expect(a.deckung).toBeNull();
  });

  it("D-11 · ein Befund an einem ANDEREN Objekt liefert hier keine Deckung (Generationsdrift)", () => {
    // LEHREN.md JOB 3056 R5: beim Blättern wechselt `koId`. Die Deckung wird je Kennung aus den
    // Daten gelesen (`find(b => b.koId === koId)`) und nie in einen Zustand gespiegelt — die Zahl
    // des vorigen Eintrags kann deshalb nicht am neuen landen.
    const a = eigeneKollisionDetail({
      koId: "ko-2",
      ...leer,
      befunde: mitBefund({ lage: "vollstaendig", geprueft: 40, bestand: 40 }),
    });
    expect(a.art).toBe("keine");
    expect(a.deckung).toBeNull();
  });

  it("D-11b · ein Draht OHNE `deckung` stürzt nicht ab, er sagt nichts", () => {
    // DER TYP IST NICHT DER DRAHT: während eines rollenden Deploys antwortet eine ältere Fassung
    // von `/api/duplicate-signal` ohne das Feld (der Server trägt es erst seit `1.0.0-beta.1.44`).
    // Der Zugriff `befund.deckung.lage` stürzte daran ab — und eine abgestürzte Fläche sagt der
    // Autorin auch über ihren BEFUND nichts mehr. GEGENPROBE: die `undefined`-Prüfung in
    // `deckungsauskunft` entfernen → dieser Fall wird rot (TypeError).
    const alterDraht = {
      koId: "ko-1",
      dublette: true,
      konflikt: false,
    } as unknown as EigenerBefund;
    const a = eigeneKollisionDetail({
      koId: "ko-1",
      ...leer,
      befunde: auffrischbar(quelle<readonly EigenerBefund[]>({ data: [alterDraht] })),
    });
    expect(a.art).toBe("dublette");
    expect(a.deckung).toBeNull();
  });

  it("D-12 · die Startseite trägt keine Deckung — mehrere Objekte haben keine gemeinsame Zahl", () => {
    const a = eigeneKollisionStart({
      ...leer,
      befunde: mitBefund({ lage: "vollstaendig", geprueft: 40, bestand: 40 }),
    });
    expect(a.anzahl).toBe(1);
    expect(a.deckung).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// DIE BESCHRIFTUNG — in allen drei Sprachen, und jede nennt, WAS sie zählt.
// ------------------------------------------------------------------------------------------------
//
// Lehre JOB 3067 R1: eine Zahl ohne Bezugsgröße ist keine Auskunft. „12 von 40" allein lässt offen,
// was gezählt wurde; der Satz muss es sagen — und zwar in JEDER Sprache, nicht nur auf Deutsch. Der
// naheliegende Halbfehler dieses Auftrags wäre ein deutscher Satz mit englischer Behelfsbeschriftung.
const SPRACHEN = ["de", "en", "nl"] as const;

/** Das Wort, an dem die Bezugsgröße hängt: der Bestand, gegen den geprüft wurde. */
const BEZUGSWORT: Record<(typeof SPRACHEN)[number], RegExp> = {
  de: /Bestand/,
  en: /library/i,
  nl: /bibliotheek/i,
};

const DECKUNGSLAGEN: readonly DeckungsLage[] = [
  "vollstaendig",
  "unvollstaendig",
  "ohne_protokoll",
  "kein_lauf",
];

/** Der Satzschlüssel je Lage — aus der ABLEITUNG geholt, nicht abgeschrieben. */
function satzKeyFuer(lage: DeckungsLage): string {
  const a = auskunftMit({ lage, geprueft: 12, bestand: 40 });
  return a.deckung?.satzKey ?? "(kein Satz)";
}

describe("JOB 3068 · der Deckungssatz ist in de/en/nl beschriftet", () => {
  for (const lng of SPRACHEN) {
    it(`D-13-${lng} · alle vier Sätze stehen, keiner ist ein durchgereichter Rohschlüssel`, async () => {
      await i18n.changeLanguage(lng);
      for (const lage of DECKUNGSLAGEN) {
        const key = satzKeyFuer(lage);
        const satz = i18n.t(key, { geprueft: 12, bestand: 40 });
        expect(satz, `${lng}/${lage}`).not.toBe(key);
        expect(satz, `${lng}/${lage}`).not.toContain("{{");
        expect(satz.length, `${lng}/${lage}`).toBeGreaterThan(20);
      }
    });

    it(`D-14-${lng} · jeder Satz nennt, WAS gezählt wird (Lehre JOB 3067 R1)`, async () => {
      // GEGENPROBE (Auftrag §8.2e): das Bezugswort aus EINER der drei Sprachen entfernen → genau
      // dieser Fall wird für diese Sprache rot.
      await i18n.changeLanguage(lng);
      for (const lage of DECKUNGSLAGEN) {
        const satz = i18n.t(satzKeyFuer(lage), { geprueft: 12, bestand: 40 });
        expect(BEZUGSWORT[lng].test(satz), `${lng}/${lage}: „${satz}"`).toBe(true);
      }
    });

    it(`D-15-${lng} · mit Zahl: zwei Lagen nennen sie, zwei nennen KEINE`, async () => {
      await i18n.changeLanguage(lng);
      const mitZahl = (lage: DeckungsLage): string =>
        i18n.t(satzKeyFuer(lage), { geprueft: 12, bestand: 40 });
      // Die zwei belegten Lagen nennen beide Zahlen …
      for (const lage of ["vollstaendig", "unvollstaendig"] as const) {
        expect(mitZahl(lage), `${lng}/${lage}`).toContain("12");
        expect(mitZahl(lage), `${lng}/${lage}`).toContain("40");
      }
      // … die zwei unbelegten nennen keine. Eine Zahl dort wäre erfunden: sie hängt am Protokoll,
      // und genau das fehlt in diesen beiden Lagen.
      for (const lage of ["ohne_protokoll", "kein_lauf"] as const) {
        expect(/\d/.test(mitZahl(lage)), `${lng}/${lage}: „${mitZahl(lage)}"`).toBe(false);
      }
    });

    it(`D-16-${lng} · die vier Sätze sind wirklich vier verschiedene`, async () => {
      await i18n.changeLanguage(lng);
      expect(vierVerschiedeneSaetze(lng)).toBe(true);
    });

    // --------------------------------------------------------------------------------------------
    // D-17 · DIE VOLLSTÄNDIGE KREUZPROBE (JOB 3068 R2, bens Korrekturpflicht 1 und
    // Promptverbesserung): JEDE Lage gegen BEIDE Zahlenformen, in JEDER Sprache.
    // --------------------------------------------------------------------------------------------
    it(`D-17-${lng} · jede Lage × beide Zahlenformen: eine Ziffer genau dann, wenn gemessen wurde`, async () => {
      await i18n.changeLanguage(lng);
      for (const lage of DECKUNGSLAGEN) {
        for (const zahlen of [
          { geprueft: 12, bestand: 40 },
          { geprueft: null, bestand: null },
        ] as const) {
          const a = auskunftMit({ lage, ...zahlen }).deckung;
          expect(a, `${lng}/${lage}/${JSON.stringify(zahlen)}`).not.toBeNull();
          const satz = i18n.t((a as { satzKey: string }).satzKey, {
            geprueft: zahlen.geprueft,
            bestand: zahlen.bestand,
          });
          const marke = `${lng}/${lage}/${JSON.stringify(zahlen)}: „${satz}"`;
          // 1. Die Zusage selbst: Ziffer genau dann, wenn der Satz Zahlen nennt.
          expect(/\d/.test(satz), marke).toBe((a as { nenntZahlen: boolean }).nenntZahlen);
          // 2. KEIN Loch. „Gegen  von  Einträgen …" (Runde 1) hinterließ genau das: doppelte
          //    Leerzeichen an den Stellen der leeren Interpolation.
          expect(satz.includes("  "), marke).toBe(false);
          expect(satz.includes("{{"), marke).toBe(false);
          // 3. Und der Satz sagt weiterhin, WAS gezählt würde (Lehre JOB 3067 R1).
          expect(BEZUGSWORT[lng].test(satz), marke).toBe(true);
        }
      }
    });

    it(`D-18-${lng} · unvollständig OHNE Zahlen: ein eigener, ganzer Satz ohne jede Ziffer`, async () => {
      // Der Fall, an dem Runde 1 fiel — hier wörtlich in allen drei Sprachen gemessen.
      await i18n.changeLanguage(lng);
      const ohne = auskunftMit({ lage: "unvollstaendig", geprueft: null, bestand: null }).deckung;
      const satz = i18n.t((ohne as { satzKey: string }).satzKey, {
        geprueft: null,
        bestand: null,
      });
      expect(/\d/.test(satz), `${lng}: „${satz}"`).toBe(false);
      expect(satz.includes("  "), `${lng}: „${satz}"`).toBe(false);
      expect(BEZUGSWORT[lng].test(satz), `${lng}: „${satz}"`).toBe(true);
      // Und er ist nicht der Satz einer anderen Lage.
      const andere = (["vollstaendig", "ohne_protokoll", "kein_lauf"] as const).map((lage) =>
        i18n.t(satzKeyFuer(lage), { geprueft: 12, bestand: 40 }),
      );
      expect(andere, `${lng}`).not.toContain(satz);
    });
  }
});

/**
 * Tragen die vier Sätze wirklich VIER verschiedene Aussagen — in dieser Sprache?
 *
 * Ohne diesen Vergleich könnten vier Schlüssel auf denselben Text zeigen und alle Fälle oben blieben
 * grün. Besonders `ohne_protokoll` und `kein_lauf` dürfen nie zusammenfallen (duplicate-signal.ts:
 * 64-71), und `vollstaendig`/`unvollstaendig` unterscheiden sich nur in der Verneinung.
 */
function vierVerschiedeneSaetze(lng: (typeof SPRACHEN)[number]): boolean {
  const saetze = DECKUNGSLAGEN.map((lage) =>
    i18n.t(satzKeyFuer(lage), { geprueft: 12, bestand: 40, lng }),
  );
  return new Set(saetze).size === DECKUNGSLAGEN.length;
}
