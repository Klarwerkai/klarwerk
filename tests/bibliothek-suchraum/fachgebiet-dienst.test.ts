// ================================================================================================
// R-0431 / R-1728 / FR-LIB-01 (K2, K20, K28 · BEN NACHARBEIT 9) — DAS FACHGEBIET AM OBJEKT.
// ================================================================================================
// Datenmodell und Speicherung am echten `KoService` (InMemory-Ablage, echtes Audit), dazu die
// Ableitung der Bibliotheksfacette. Gemessen wird auch, was NICHT passieren darf: kein Fachgebiet
// aus der Kategorie, kein Leerwert im Bestand, kein Beleg ohne Änderung.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject as WebKo } from "../../apps/web/src/api/types";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, InMemoryKoVersionRepo, KoService } from "../../services/knowledge-object";

function stack() {
  const repo = new InMemoryKoRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const ko = new KoService({ repo, versions: new InMemoryKoVersionRepo(), audit });
  return { repo, audit, ko };
}

const EINGABE = {
  title: "Lager fetten",
  statement: "Lager alle 500 h fetten.",
  type: "best_practice" as const,
  category: "Anlage 1",
  author: "anna",
};

const belege = async (audit: AuditService, id: string) =>
  audit.list({ action: "ko.domain-changed", target: id });

describe("K2 · Fachgebiet: Anlage und Speicherung", () => {
  it("F1 · mitgebrachtes Fachgebiet wird in Normalform gespeichert und wieder gelesen", async () => {
    const { ko } = stack();
    const erstellt = await ko.create({ ...EINGABE, domain: "  Instand   haltung " });
    expect(erstellt.domain).toBe("Instand haltung");
    expect((await ko.get(erstellt.id))?.domain).toBe("Instand haltung");
    expect(erstellt.category, "die Kategorie bleibt unberührt").toBe("Anlage 1");
  });

  it("F2 · ohne Angabe kein Feld — und keine Ableitung aus der Kategorie", async () => {
    const { ko } = stack();
    const ohne = await ko.create({ ...EINGABE });
    expect("domain" in ohne).toBe(false);
    const leer = await ko.create({ ...EINGABE, domain: "   " });
    expect("domain" in leer).toBe(false);
  });
});

describe("K2 · Fachgebiet: nachträglich setzen, ändern, entfernen", () => {
  it("F3 · setzen und ändern schreiben den Wert und je einen Beleg mit vorher/nachher", async () => {
    const { ko, audit } = stack();
    const erstellt = await ko.create({ ...EINGABE });
    await ko.setDomain(erstellt.id, "Qualität", "bernd");
    expect((await ko.get(erstellt.id))?.domain).toBe("Qualität");
    await ko.setDomain(erstellt.id, "Instandhaltung", "bernd");
    const nachher = await ko.get(erstellt.id);
    expect(nachher?.domain).toBe("Instandhaltung");
    expect(nachher?.category, "die Kategorie bleibt unberührt").toBe("Anlage 1");
    const liste = await belege(audit, erstellt.id);
    expect(liste).toHaveLength(2);
    expect(liste.map((e) => e.payload)).toEqual(
      expect.arrayContaining([
        { vorher: undefined, nachher: "Qualität" },
        { vorher: "Qualität", nachher: "Instandhaltung" },
      ]),
    );
    expect(liste.every((e) => e.actor === "bernd")).toBe(true);
  });

  it("F4 · ein leerer Wert entfernt die Angabe — das Feld fehlt danach wieder", async () => {
    const { ko, audit } = stack();
    const erstellt = await ko.create({ ...EINGABE, domain: "Qualität" });
    await ko.setDomain(erstellt.id, " ", "bernd");
    const nachher = await ko.get(erstellt.id);
    expect(nachher && "domain" in nachher).toBe(false);
    const liste = await belege(audit, erstellt.id);
    expect(liste.map((e) => e.payload)).toEqual([{ vorher: "Qualität", nachher: undefined }]);
  });

  it("F5 · derselbe Wert (auch anders umrandet) erzeugt keinen Beleg", async () => {
    const { ko, audit } = stack();
    const erstellt = await ko.create({ ...EINGABE, domain: "Qualität" });
    await ko.setDomain(erstellt.id, "  Qualität ", "bernd");
    expect((await ko.get(erstellt.id))?.domain).toBe("Qualität");
    expect(await belege(audit, erstellt.id)).toHaveLength(0);
  });
});

describe("K2 · Fachgebiet: Ableitung der Bibliotheksfacette", () => {
  const webKo = (extra: Partial<WebKo>): WebKo =>
    ({
      id: "k",
      title: "Lager fetten",
      statement: "",
      conditions: [],
      measures: [],
      type: "best_practice",
      category: "Anlage 1",
      tags: [],
      confidence: 0,
      trust: 0,
      status: "validiert",
      version: 1,
      originalAuthor: "anna",
      author: "anna",
      neededValidations: 2,
      assignments: [],
      asset: null,
      createdAt: "2026-08-20T00:00:00.000Z",
      history: [],
      ...extra,
    }) as unknown as WebKo;
  const NOW = Date.parse("2026-10-01T00:00:00.000Z");

  it("F6 · die Achse trägt genau den gespeicherten Wert, ohne Wert bleibt sie leer", () => {
    expect(libraryFilterValues(webKo({ domain: "Instandhaltung" }), NOW).domain).toEqual([
      "Instandhaltung",
    ]);
    const ohne = libraryFilterValues(webKo({}), NOW);
    expect(ohne.domain, "nichts aus der Kategorie abgeleitet").toEqual([]);
    expect(ohne.category).toEqual(["Anlage 1"]);
  });
});
