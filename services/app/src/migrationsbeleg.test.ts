import { describe, expect, it } from "vitest";
import {
  IRREVERSIBLE_DATENMIGRATIONEN,
  MIGRATIONS_SOLLLISTE,
  RISIKOMARKER,
  erzeugeStrukturbeleg,
  istStrukturstufe,
  klassifiziereStufe,
  markerVon,
} from "./migrationsbeleg";

// ==================================================================================================
// JOB 727 · D2 — DAS REINE MODELL. Was es kann, und wo es aufhört.
// ==================================================================================================
//
// Die Fälle unten prüfen zwei Dinge getrennt: dass die Klassifikation trifft, was sie treffen soll,
// und dass sie NICHT trifft, was sie in Ruhe lassen soll. Der zweite Teil ist der wichtigere —
// ein Wächter, der bei jedem zweiten Lauf grundlos rot ist, wird abgeschaltet statt gelesen.

describe("JOB 727 D2 · istStrukturstufe schließt die Filterlücke", () => {
  it("CREATE TABLE zählt", () => {
    expect(istStrukturstufe("CREATE TABLE IF NOT EXISTS foo (id text);")).toBe(true);
  });

  it("eine reine ALTER-Stufe zählt AUCH — genau das war die Lücke", () => {
    expect(istStrukturstufe("ALTER TABLE kos ADD COLUMN IF NOT EXISTS x text;")).toBe(true);
  });

  it("ein Quelltext ohne Tabellenbezug zählt nicht", () => {
    expect(istStrukturstufe('{ "type": "object" }')).toBe(false);
    expect(istStrukturstufe("CREATE INDEX IF NOT EXISTS i ON foo (id);")).toBe(false);
  });
});

describe("JOB 727 D2 · klassifiziereStufe", () => {
  it("ohne Marker ist eine Stufe additiv", () => {
    expect(klassifiziereStufe("CREATE TABLE IF NOT EXISTS foo (id text);")).toBe("ADDITIV");
    expect(klassifiziereStufe("ALTER TABLE foo ADD COLUMN IF NOT EXISTS x text;")).toBe("ADDITIV");
  });

  it("DROP INDEX ist transformierend — der Index kann wieder entstehen", () => {
    expect(klassifiziereStufe("DROP INDEX IF EXISTS foo_uq;")).toBe("TRANSFORMIEREND");
  });

  it("UPDATE mit Ziel ist transformierend", () => {
    expect(klassifiziereStufe("UPDATE sessions SET token = 'x';")).toBe("TRANSFORMIEREND");
  });

  it("DROP COLUMN, DELETE FROM, DROP TABLE und TRUNCATE sind irreversibel", () => {
    expect(klassifiziereStufe("ALTER TABLE foo DROP COLUMN bar CASCADE;")).toBe("IRREVERSIBEL");
    expect(klassifiziereStufe("DELETE FROM foo WHERE x;")).toBe("IRREVERSIBEL");
    expect(klassifiziereStufe("DROP TABLE foo;")).toBe("IRREVERSIBEL");
    expect(klassifiziereStufe("TRUNCATE foo;")).toBe("IRREVERSIBEL");
  });

  it("die höchste Klasse gewinnt, nicht die erste", () => {
    // DROP INDEX (transformierend) steht VOR dem DROP COLUMN (irreversibel).
    const gemischt = "DROP INDEX IF EXISTS i; ALTER TABLE foo DROP COLUMN bar;";
    expect(klassifiziereStufe(gemischt)).toBe("IRREVERSIBEL");
  });

  // ── DIE GEGENPROBEN: was NICHT anschlagen darf ──────────────────────────────────────────────
  it("ALTER COLUMN ist kein Marker — drei additive Bestandsstufen tragen es", () => {
    expect(klassifiziereStufe("ALTER TABLE foo ALTER COLUMN x SET NOT NULL;")).toBe("ADDITIV");
  });

  it("ON CONFLICT DO UPDATE ist kein Marker — ein Upsert schreibt keinen Bestand um", () => {
    const upsert =
      "INSERT INTO foo (id, v) VALUES ('a', 1) ON CONFLICT (id) DO UPDATE SET v = excluded.v;";
    expect(klassifiziereStufe(upsert)).toBe("ADDITIV");
  });

  it("das Wort in einem Kommentar allein genügt nicht für UPDATE", () => {
    expect(
      klassifiziereStufe("-- wir wollen hier kein UPDATE machen\nCREATE TABLE f (id text);"),
    ).toBe("ADDITIV");
  });
});

describe("JOB 727 D2 · markerVon nennt die Marker, statt sie nur zu zählen", () => {
  it("führt jeden vorkommenden Marker namentlich", () => {
    const ddl =
      "ALTER TABLE f DROP COLUMN c CASCADE; DELETE FROM f WHERE x; DROP INDEX IF EXISTS i;";
    expect(markerVon(ddl)).toEqual(["DROP COLUMN", "DELETE FROM", "DROP INDEX"]);
  });

  it("eine additive Stufe hat keine Marker", () => {
    expect(markerVon("CREATE TABLE IF NOT EXISTS f (id text);")).toEqual([]);
  });

  it("die Reihenfolge ist stabil, nicht die des Vorkommens", () => {
    const a = markerVon("DROP INDEX IF EXISTS i; ALTER TABLE f DROP COLUMN c;");
    const b = markerVon("ALTER TABLE f DROP COLUMN c; DROP INDEX IF EXISTS i;");
    expect(a).toEqual(b);
  });
});

describe("JOB 727 D2 · der Strukturbeleg ist deterministisch und kein Journal", () => {
  const eingaben = [
    { stufe: "A_SCHEMA", ddl: "CREATE TABLE IF NOT EXISTS a (id text);" },
    { stufe: "B_SCHEMA", ddl: "ALTER TABLE a DROP COLUMN alt CASCADE;" },
  ];

  it("zweimal erzeugt ergibt denselben Beleghash", () => {
    expect(erzeugeStrukturbeleg(eingaben).beleghash).toBe(erzeugeStrukturbeleg(eingaben).beleghash);
  });

  it("jede Stufe trägt Kennung, Ordinal, Risiko und Quellhash", () => {
    const beleg = erzeugeStrukturbeleg(eingaben);
    expect(beleg.stufen.map((s) => s.stufe)).toEqual(["A_SCHEMA", "B_SCHEMA"]);
    expect(beleg.stufen.map((s) => s.ordinal)).toEqual([0, 1]);
    expect(beleg.stufen.map((s) => s.risiko)).toEqual(["ADDITIV", "IRREVERSIBEL"]);
    for (const stufe of beleg.stufen) {
      expect(stufe.quellhash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("das höchste Risiko ist das des Gesamtlaufs, nicht das der letzten Stufe", () => {
    expect(erzeugeStrukturbeleg(eingaben).hoechstesRisiko).toBe("IRREVERSIBEL");
    expect(erzeugeStrukturbeleg([eingaben[0] as (typeof eingaben)[0]]).hoechstesRisiko).toBe(
      "ADDITIV",
    );
  });

  it("eine geänderte DDL ändert Quellhash UND Beleghash", () => {
    const geaendert = [
      eingaben[0] as (typeof eingaben)[0],
      { stufe: "B_SCHEMA", ddl: "-- anders" },
    ];
    expect(erzeugeStrukturbeleg(geaendert).beleghash).not.toBe(
      erzeugeStrukturbeleg(eingaben).beleghash,
    );
  });

  it("eine andere Reihenfolge ergibt einen anderen Beleg — die Ordnung ist Vertrag", () => {
    const gedreht = [eingaben[1] as (typeof eingaben)[1], eingaben[0] as (typeof eingaben)[0]];
    expect(erzeugeStrukturbeleg(gedreht).beleghash).not.toBe(
      erzeugeStrukturbeleg(eingaben).beleghash,
    );
  });

  it("der Beleg trägt KEIN Zustandsfeld — er ist ausdrücklich kein Journal", () => {
    const beleg = erzeugeStrukturbeleg(eingaben);
    const felder = Object.keys(beleg.stufen[0] ?? {});
    // Kein `status`, kein `angewandtAm`, kein `laufend` — wer das sucht, sucht ein Journal.
    expect(felder.sort()).toEqual(["marker", "ordinal", "quellhash", "risiko", "stufe"]);
    expect(Object.keys(beleg).sort()).toEqual(["beleghash", "hoechstesRisiko", "stufen"]);
  });

  it("eine leere Eingabe ergibt einen leeren, additiven Beleg — keine Behauptung über Ausführung", () => {
    const leer = erzeugeStrukturbeleg([]);
    expect(leer.stufen).toEqual([]);
    expect(leer.hoechstesRisiko).toBe("ADDITIV");
  });
});

describe("JOB 727 D2 · die Listen sind widerspruchsfrei", () => {
  it("die Sollliste führt jede Stufe genau einmal", () => {
    const namen = MIGRATIONS_SOLLLISTE.map((s) => s.stufe);
    expect(new Set(namen).size).toBe(namen.length);
  });

  it("jeder Risikomarker trägt einen Namen und eine Klasse", () => {
    for (const marker of RISIKOMARKER) {
      expect(marker.name.length).toBeGreaterThan(0);
      expect(["ADDITIV", "TRANSFORMIEREND", "IRREVERSIBEL"]).toContain(marker.klasse);
    }
  });

  it("die irreversiblen Datenmigrationen sind keine DDL-Stufen — sonst stünden sie in der Sollliste", () => {
    const soll = MIGRATIONS_SOLLLISTE.map((s) => s.stufe);
    for (const m of IRREVERSIBLE_DATENMIGRATIONEN) {
      expect(soll).not.toContain(m.stufe);
      expect(m.ort.length).toBeGreaterThan(0);
      expect(m.grund.length).toBeGreaterThan(0);
    }
  });
});
