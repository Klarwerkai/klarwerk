// ================================================================================================
// WISSENSAUSKUNFT · FASSUNG JE BELEG UND ZURÜCKGENOMMENE VORGÄNGE (R-1644, Nacharbeit BEN).
// ================================================================================================
//
// Gemessen am rechnenden Kern `wissensauskunft()` mit Audit-Einträgen in genau der Form, die die
// Schreibwege ablegen (`ko.revised {version}`, `ko.proposed {baseVersion}`, `ko.admin-validated
// {koVersion}`, `ask.query` ohne Fassung, `ko.change-rolled-back {rolledBackSeqs}` —
// services/knowledge-object/src/service.ts, services/validation/src/service.ts,
// services/ask/src/service.ts).
//
//   B1  Die Fassung kommt aus der Angabe des Belegs je Ereignisart — nie aus dem Zeitpunkt.
//   B2  Eine Antwortquelle trägt keine Fassung, auch wenn zum Zeitpunkt schon eine neue galt.
//   B3  Ein zurückgenommener Vorgang ist ausdrücklich gekennzeichnet und zählt weder als
//       Freigabe noch als Papierkorbwechsel — aber erst ab dem Zeitpunkt seiner Rücknahme.
import { describe, expect, it } from "vitest";
import { type Wissensauskunft, wissensauskunft } from "../../services/app/src/wissensauskunft";
import type { AuditEntry } from "../../services/audit";
import type { KnowledgeObject, KoVersionSnapshot } from "../../services/knowledge-object";

const T0 = Date.parse("2026-03-02T08:00:00.000Z");
const um = (minuten: number): string => new Date(T0 + minuten * 60_000).toISOString();

let seq = 0;
function beleg(
  minuten: number,
  actor: string,
  action: string,
  payload: Record<string, unknown> = {},
): AuditEntry {
  seq += 1;
  return {
    seq,
    at: um(minuten),
    actor,
    action,
    target: "ko-1",
    payload,
    prevHash: "",
    hash: "",
  };
}

function fassung(version: number, minuten: number, author: string): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version,
    snapshot: {
      id: "ko-1",
      version,
      title: `Titel V${version}`,
      statement: `Aussage V${version}`,
    } as KnowledgeObject,
    at: um(minuten),
    author,
    note: "",
  };
}

function auskunft(
  audit: AuditEntry[],
  versionen: KoVersionSnapshot[],
  minuten: number,
): Wissensauskunft {
  return wissensauskunft({
    ko: { id: "ko-1", version: Math.max(...versionen.map((v) => v.version)) },
    zeitpunkt: T0 + minuten * 60_000,
    versionen,
    audit,
    kenntnisnahmen: [],
    namen: new Map(),
  });
}

const belegeVon = (a: Wissensauskunft, id: string) =>
  a.personen.find((p) => p.id === id)?.belege ?? [];

describe("B1/B2 · die Fassung steht im Beleg oder gar nicht", () => {
  it("revised → version, proposed → baseVersion, ask.query → keine, Kommentar → keine", () => {
    seq = 0;
    const versionen = [fassung(1, 0, "ada"), fassung(2, 20, "erik")];
    const audit = [
      beleg(0, "ada", "ko.created"),
      // Fran fragt bei Minute 15 — die Antwort läuft noch, da speichert Erik bei Minute 20
      // Fassung 2; erst danach wird `ask.query` angehängt (Minute 21). Zum Zeitpunkt des Belegs
      // galt also schon V2, ausgeliefert wurde aber, was der Lauf in der Hand hatte.
      beleg(20, "erik", "ko.revised", { version: 2 }),
      beleg(21, "fran", "ask.query", { answered: true }),
      beleg(22, "gus", "ko.proposed", { proposalId: "p-1", baseVersion: 1 }),
      beleg(23, "gus", "ko.commented"),
    ];
    const a = auskunft(audit, versionen, 30);
    expect(belegeVon(a, "ada").map((b) => b.fassung)).toEqual([1]);
    expect(belegeVon(a, "erik").map((b) => [b.art, b.fassung])).toEqual([["ueberarbeitet", 2]]);
    expect(belegeVon(a, "fran").map((b) => [b.art, b.fassung])).toEqual([["antwortquelle", null]]);
    expect(belegeVon(a, "gus").map((b) => [b.art, b.fassung])).toEqual([
      ["vorgeschlagen", 1],
      ["kommentiert", null],
    ]);
  });

  it("ko.merged-into → eigeneVersion, nicht die Fassung des Zielartikels; ohne Angabe keine", () => {
    seq = 0;
    const versionen = [fassung(1, 0, "ada"), fassung(2, 10, "ada")];
    const audit = [
      beleg(0, "ada", "ko.created"),
      beleg(10, "ada", "ko.revised", { version: 2 }),
      // Der abgefragte Eintrag steht bei V2 und geht in einen Zielartikel auf, der bei V7 steht.
      beleg(20, "hedi", "ko.merged-into", {
        koId: "ko-ziel",
        version: 7,
        overlapId: "ov-1",
        eigeneVersion: 2,
      }),
      beleg(25, "ina", "ko.merged-into", { koId: "ko-ziel", version: 8, overlapId: "ov-2" }),
    ];
    const a = auskunft(audit, versionen, 30);
    expect(belegeVon(a, "hedi").map((b) => [b.art, b.fassung])).toEqual([
      ["sonstige_bearbeitung", 2],
    ]);
    expect(belegeVon(a, "ina").map((b) => [b.art, b.fassung])).toEqual([
      ["sonstige_bearbeitung", null],
    ]);
  });

  it("eine unbeantwortete Frage ist kein Kontakt", () => {
    seq = 0;
    const a = auskunft(
      [beleg(0, "ada", "ko.created"), beleg(5, "fran", "ask.query", { answered: false })],
      [fassung(1, 0, "ada")],
      10,
    );
    expect(belegeVon(a, "fran")).toEqual([]);
  });
});

describe("B3 · zurückgenommene Vorgänge", () => {
  function geschichte(): { audit: AuditEntry[]; versionen: KoVersionSnapshot[] } {
    seq = 0;
    const audit = [
      beleg(0, "ada", "ko.created"), // 1
      beleg(10, "ada", "ko.admin-validated", { koVersion: 1 }), // 2 — wird zurückgenommen
      beleg(12, "system", "ko.change-rolled-back", { version: 1, rolledBackSeqs: [2] }), // 3
      beleg(20, "erik", "ko.revised", { version: 2 }), // 4 — wird zurückgenommen
      beleg(20, "erik", "ko.deleted", { trash: true }), // 5 — wird zurückgenommen
      beleg(21, "system", "ko.change-rolled-back", {
        version: 2,
        restoredVersion: 1,
        rolledBackSeqs: [4, 5],
      }), // 6
    ];
    // Die Fassung V2 wurde bei der Rücknahme wieder entfernt (`versions.remove`): nur V1 bleibt.
    return { audit, versionen: [fassung(1, 0, "ada")] };
  }

  it("nach der Rücknahme: keine Freigabe, nicht im Papierkorb, Belege als zurückgenommen gekennzeichnet", () => {
    const { audit, versionen } = geschichte();
    const a = auskunft(audit, versionen, 30);
    expect(a.fassung?.version).toBe(1);
    expect(a.freigabe).toBeNull();
    expect(a.imPapierkorb).toBe(false);
    expect(belegeVon(a, "ada").map((b) => [b.art, b.zurueckgenommen])).toEqual([
      ["angelegt", false],
      ["freigegeben", true],
    ]);
    expect(belegeVon(a, "erik").map((b) => [b.art, b.fassung, b.zurueckgenommen])).toEqual([
      ["ueberarbeitet", 2, true],
      ["sonstige_bearbeitung", null, true],
    ]);
    // Die Rücknahme selbst ist kein Kontakt einer Person.
    expect(a.personen.map((p) => p.id)).not.toContain("system");
  });

  it("vor der Rücknahme galt der Vorgang noch: die Freigabe zählt, unmarkiert", () => {
    const { audit, versionen } = geschichte();
    const a = auskunft(audit, versionen, 11);
    expect(a.freigabe).toEqual({ am: um(10), von: { id: "ada", name: "" } });
    expect(belegeVon(a, "ada").find((b) => b.art === "freigegeben")?.zurueckgenommen).toBe(false);
  });

  it("eine nicht zurückgenommene Freigabe derselben Fassung zählt weiter", () => {
    const { audit, versionen } = geschichte();
    audit.push(beleg(25, "ada", "ko.admin-validated", { koVersion: 1 }));
    const a = auskunft(audit, versionen, 30);
    expect(a.freigabe).toEqual({ am: um(25), von: { id: "ada", name: "" } });
  });
});
