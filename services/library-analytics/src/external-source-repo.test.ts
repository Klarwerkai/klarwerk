import { describe, expect, it } from "vitest";
import {
  InMemoryExternalSourceRepo,
  MAX_SOURCE_VERSION,
  externalSourceIdentityKey,
  externalSourceRevisionKey,
  externalSourceSystemKey,
} from "./repo";
import type { ExternalSourceRecord } from "./types";

// ================================================================================================
// W2-A · QUELLREVISION — DER REPO-KERN (KW-W2-17 Zeilen 18-41)
// ================================================================================================
//
// Diese Fälle prüfen die ZUSAGEN des Vertrags, nicht seine Implementierung: zwei getrennte
// Identitäten, eine neue Version als neue Zeile, Idempotenz je Revision, Unveränderlichkeit des
// Bestehenden. Dieselben Fälle laufen in `repo-pg.integration.test.ts` gegen echtes PostgreSQL —
// die Parität ist die eigentliche Aussage (Akzeptanzkriterium 6).

function revision(over: Partial<ExternalSourceRecord> = {}): ExternalSourceRecord {
  return {
    sourceRecordId: "sr-1",
    sourceSystem: "Confluence",
    externalId: "12345",
    sourceVersion: 1,
    url: "https://wiki.example.test/pages/12345",
    title: "Wartung der Spezialpresse",
    rawOrRenderedContentReference: null,
    importedAt: "2026-08-02T14:00:00.000Z",
    contentHash: "hash-v1",
    sourceMetadata: { sourceScope: "TECH" },
    ...over,
  };
}

describe("W2-A · die beiden Identitäten sind getrennt (KW-W2-17 Zeilen 35-37)", () => {
  it("das Quellsystem wird getrimmt und kleingeschrieben — dieselbe Quelle bleibt dieselbe", () => {
    expect(externalSourceSystemKey(" Confluence ")).toBe("confluence");
    expect(externalSourceIdentityKey("CONFLUENCE", "12345")).toBe(
      externalSourceIdentityKey("confluence", "12345"),
    );
  });

  it("die fachliche Identität kennt die Version NICHT, die Revisionsidentität schon", () => {
    const fachlich = externalSourceIdentityKey("Confluence", "12345");
    expect(externalSourceRevisionKey("Confluence", "12345", 1)).not.toBe(fachlich);
    expect(externalSourceRevisionKey("Confluence", "12345", 1)).not.toBe(
      externalSourceRevisionKey("Confluence", "12345", 2),
    );
    // Zwei Quellsysteme mit zufällig gleicher Kennung sind NIE dieselbe Quelle.
    expect(externalSourceIdentityKey("Confluence", "12345")).not.toBe(
      externalSourceIdentityKey("Jira", "12345"),
    );
  });
});

describe("W2-A · Speicherung, Idempotenz und Unveränderlichkeit (InMemory)", () => {
  it("eine Revision wird gespeichert und ist über beide Wege wiederauffindbar", async () => {
    const repo = new InMemoryExternalSourceRepo();
    const r = revision();
    expect(await repo.insertIfAbsent(r)).toBe(true);
    expect(await repo.findByRevision("Confluence", "12345", 1)).toEqual(r);
    expect(await repo.findById("sr-1")).toEqual(r);
  });

  it("dieselbe Revisionsidentität zweimal → genau EINE Zeile, die erste bleibt wertgleich", async () => {
    const repo = new InMemoryExternalSourceRepo();
    const erste = revision({ contentHash: "hash-original" });
    expect(await repo.insertIfAbsent(erste)).toBe(true);

    // Ein zweiter Lauf derselben Quellversion — mit ABWEICHENDEM Inhalt und anderer interner Id.
    // Er darf NICHTS überschreiben; genau das wäre das stille Umschreiben aus KW-W2-17 Zeile 39.
    const zweite = revision({
      sourceRecordId: "sr-2",
      contentHash: "hash-anders",
      title: "Anderer Titel",
    });
    expect(await repo.insertIfAbsent(zweite)).toBe(false);

    const alle = await repo.listBySource("Confluence", "12345");
    expect(alle).toHaveLength(1);
    expect(alle[0]).toEqual(erste);
    expect(await repo.findById("sr-2")).toBeUndefined();
  });

  it("eine NEUE Quellversion erzeugt eine NEUE Zeile — die alte bleibt unangetastet", async () => {
    const repo = new InMemoryExternalSourceRepo();
    const v1 = revision({ sourceVersion: 1, contentHash: "hash-v1", title: "Fassung 1" });
    const v2 = revision({
      sourceRecordId: "sr-2",
      sourceVersion: 2,
      contentHash: "hash-v2",
      title: "Fassung 2",
    });
    expect(await repo.insertIfAbsent(v1)).toBe(true);
    expect(await repo.insertIfAbsent(v2)).toBe(true);

    const alle = await repo.listBySource("Confluence", "12345");
    expect(alle.map((r) => r.sourceVersion)).toEqual([1, 2]);
    // Die alte Revision ist WERTGLEICH geblieben — Feld für Feld.
    expect(alle[0]).toEqual(v1);
    expect(await repo.latestVersion("Confluence", "12345")).toBe(2);
  });

  it("Groß-/Kleinschreibung des Quellsystems erzeugt KEINE zweite Revision", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.insertIfAbsent(revision({ sourceSystem: "Confluence" }))).toBe(true);
    expect(
      await repo.insertIfAbsent(revision({ sourceRecordId: "sr-2", sourceSystem: "confluence" })),
    ).toBe(false);
    expect(await repo.listBySource("CONFLUENCE", "12345")).toHaveLength(1);
  });

  it("ein anderes Quellsystem mit gleicher Kennung ist eine EIGENE Quelle", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.insertIfAbsent(revision({ sourceSystem: "Confluence" }))).toBe(true);
    expect(
      await repo.insertIfAbsent(revision({ sourceRecordId: "sr-2", sourceSystem: "Jira" })),
    ).toBe(true);
    expect(await repo.listBySource("Confluence", "12345")).toHaveLength(1);
    expect(await repo.listBySource("Jira", "12345")).toHaveLength(1);
  });

  it("der Vertrag kennt kein update und kein delete — Unveränderlichkeit ist strukturell", () => {
    const repo = new InMemoryExternalSourceRepo() as unknown as Record<string, unknown>;
    for (const verboten of ["update", "delete", "remove", "removeAll", "upsert"]) {
      expect(repo[verboten]).toBeUndefined();
    }
  });

  it("eine unbekannte Quelle liefert ehrlich nichts — keine erfundene Leerrevision", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.findByRevision("Confluence", "gibt-es-nicht", 1)).toBeUndefined();
    expect(await repo.listBySource("Confluence", "gibt-es-nicht")).toEqual([]);
    expect(await repo.latestVersion("Confluence", "gibt-es-nicht")).toBeUndefined();
  });
});

describe("W2-A · fail-closed am Repo-Rand: unvollständige Identität wird nicht gespeichert", () => {
  it("leeres Quellsystem wird abgewiesen — NICHT still zu Confluence gemacht", async () => {
    const repo = new InMemoryExternalSourceRepo();
    await expect(repo.insertIfAbsent(revision({ sourceSystem: "   " }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await repo.listBySource("confluence", "12345")).toEqual([]);
  });

  it("leere externalId und leere sourceRecordId werden abgewiesen", async () => {
    const repo = new InMemoryExternalSourceRepo();
    await expect(repo.insertIfAbsent(revision({ externalId: " " }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(repo.insertIfAbsent(revision({ sourceRecordId: "" }))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("gebrochene Versionen werden abgewiesen — die Lehre aus der source_version-Heilung", async () => {
    const repo = new InMemoryExternalSourceRepo();
    for (const kaputt of [1.5, Number.NaN, -1, MAX_SOURCE_VERSION + 1]) {
      await expect(repo.insertIfAbsent(revision({ sourceVersion: kaputt }))).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    // Die Grenze selbst ist gültig — die Prüfung ist eine Grenze, keine Verengung.
    expect(await repo.insertIfAbsent(revision({ sourceVersion: MAX_SOURCE_VERSION }))).toBe(true);
  });
});

// ================================================================================================
// BEN-33 BEFUND A — UNVERAENDERLICHKEIT IST EIN SCHNAPPSCHUSS, KEIN `readonly`
// ================================================================================================
//
// BEN hat den Kern der Sache getroffen: `readonly` im Interface ist eine Uebersetzungshilfe und
// keine Laufzeitzusage. Wer dieselbe Objektreferenz ablegt und wieder herausgibt, hat nichts
// unveraenderlich gemacht — er hat nur aufgeschrieben, dass man es nicht tun soll.
//
// Der Massstab ist PostgreSQL, nicht die Bequemlichkeit: dort geht der Datensatz durch
// `JSON.stringify` in eine `jsonb`-Spalte und kommt beim Lesen als FRISCHES Objekt zurueck. Genau
// dieses Verhalten muss die InMemory-Ablage spiegeln, sonst ist die Paritaet an der Stelle
// gebrochen, an der es am meisten weh tut: bei der zentralen Zusage des ganzen Schnitts.
const VERSCHACHTELT = { sourceScope: "TECH", pfad: { ordner: ["A", "B"] } } as const;

describe("W2-A · BEN-33 Befund A: der Bestand ist ein tiefer Schnappschuss", () => {
  it("eine Mutation des EINGABEwerts — auch verschachtelt — erreicht den Bestand nicht", async () => {
    const repo = new InMemoryExternalSourceRepo();
    const eingabe = revision({ sourceMetadata: structuredClone(VERSCHACHTELT) });
    expect(await repo.insertIfAbsent(eingabe)).toBe(true);

    // Genau BENs Probe: nach dem Schreiben am Eingabeobjekt herumschreiben.
    (eingabe as { title: string }).title = "nachtraeglich veraendert";
    const meta = eingabe.sourceMetadata as { sourceScope: string; pfad: { ordner: string[] } };
    meta.sourceScope = "MUTIERT";
    meta.pfad.ordner.push("C");

    const gelesen = await repo.findByRevision("Confluence", "12345", 1);
    expect(gelesen?.title).toBe("Wartung der Spezialpresse");
    expect(gelesen?.sourceMetadata).toEqual(VERSCHACHTELT);
  });

  it("eine Mutation des LESEwerts — auch verschachtelt — erreicht den Bestand nicht", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(
      await repo.insertIfAbsent(revision({ sourceMetadata: structuredClone(VERSCHACHTELT) })),
    ).toBe(true);

    const ersterLesewert = await repo.findByRevision("Confluence", "12345", 1);
    (ersterLesewert as unknown as { title: string }).title = "ueber Lesewert veraendert";
    const meta = ersterLesewert?.sourceMetadata as { pfad: { ordner: string[] } };
    meta.pfad.ordner.push("C");

    const zweiterLesewert = await repo.findByRevision("Confluence", "12345", 1);
    expect(zweiterLesewert?.title).toBe("Wartung der Spezialpresse");
    expect(zweiterLesewert?.sourceMetadata).toEqual(VERSCHACHTELT);
    // Auch der Weg ueber die interne Id liefert den unversehrten Stand.
    expect((await repo.findById("sr-1"))?.title).toBe("Wartung der Spezialpresse");
  });

  it("auch listBySource liefert Schnappschuesse — nicht den Bestand selbst", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(
      await repo.insertIfAbsent(revision({ sourceMetadata: structuredClone(VERSCHACHTELT) })),
    ).toBe(true);

    const liste = await repo.listBySource("Confluence", "12345");
    (liste[0] as unknown as { title: string }).title = "ueber Liste veraendert";
    (liste[0]?.sourceMetadata as { pfad: { ordner: string[] } }).pfad.ordner.push("C");

    const nachher = await repo.listBySource("Confluence", "12345");
    expect(nachher[0]?.title).toBe("Wartung der Spezialpresse");
    expect(nachher[0]?.sourceMetadata).toEqual(VERSCHACHTELT);
  });

  it("zwei Lesevorgaenge liefern gleiche WERTE, aber nicht dieselbe Referenz", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.insertIfAbsent(revision())).toBe(true);
    const a = await repo.findByRevision("Confluence", "12345", 1);
    const b = await repo.findByRevision("Confluence", "12345", 1);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

// ================================================================================================
// BEN-33 BEFUND B — DIE INTERNE ID IST EIN SCHLUESSEL, ALSO MUSS SIE EINDEUTIG SEIN
// ================================================================================================
//
// PostgreSQL fuehrt `source_record_id` als PRIMARY KEY. Die InMemory-Ablage indizierte bisher nur
// nach Revisionsidentitaet — dieselbe interne Id konnte zweimal fuer zwei verschiedene Revisionen
// vergeben werden, und `findById` haette dann geliefert, was in der Map zuerst lag.
//
// WICHTIG IST DIE REIHENFOLGE DER PRUEFUNG, denn sie ist die Paritaet: PostgreSQL prueft beim
// `ON CONFLICT (source_system, external_id, source_version_key) DO NOTHING` ZUERST den
// Arbiter-Index. Trifft der Datensatz dieselbe Revision, ist das Ergebnis ein stiller No-op —
// AUCH wenn die interne Id gleich ist. Erst wenn die Revision NEU ist und die interne Id schon
// vergeben, schlaegt der Primaerschluessel zu. Die InMemory-Ablage muss in genau dieser
// Reihenfolge urteilen, sonst wuerde ein harmloser Wiederholungslauf ploetzlich werfen.
describe("W2-A · BEN-33 Befund B: die interne Id ist in beiden Ablagen eindeutig", () => {
  it("dieselbe sourceRecordId fuer eine ANDERE Revision wird abgewiesen — nichts halb geschrieben", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.insertIfAbsent(revision())).toBe(true);

    await expect(
      repo.insertIfAbsent(revision({ externalId: "andere-seite", sourceVersion: 2 })),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(await repo.findByRevision("Confluence", "andere-seite", 2)).toBeUndefined();
    expect(await repo.listBySource("Confluence", "andere-seite")).toEqual([]);
    // Der erste Datensatz ist unversehrt.
    expect((await repo.findById("sr-1"))?.externalId).toBe("12345");
  });

  it("dieselbe sourceRecordId bei GLEICHER Revision bleibt idempotent — kein Fehler", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.insertIfAbsent(revision())).toBe(true);
    // Derselbe Wiederholungslauf derselben Quellversion: stiller No-op, wie der Arbiter-Index.
    expect(await repo.insertIfAbsent(revision({ contentHash: "anders" }))).toBe(false);
    expect((await repo.findById("sr-1"))?.contentHash).toBe("hash-v1");
  });

  it("findById ist nicht reihenfolgeabhaengig — es gibt hoechstens EINEN Traeger je interner Id", async () => {
    const repo = new InMemoryExternalSourceRepo();
    expect(await repo.insertIfAbsent(revision())).toBe(true);
    await expect(repo.insertIfAbsent(revision({ sourceVersion: 2 }))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    // Wiederholtes Lesen liefert denselben Traeger — es gibt gar keinen zweiten Kandidaten.
    expect((await repo.findById("sr-1"))?.sourceVersion).toBe(1);
    expect((await repo.findById("sr-1"))?.sourceVersion).toBe(1);
    expect(await repo.listBySource("Confluence", "12345")).toHaveLength(1);
  });
});
