import { describe, expect, it } from "vitest";
import { GENESIS, hashEntry, inspectChain } from "./chain";
import type { AuditEntry } from "./types";

// AUFTRAG-mega14 Block A (bens SB-1) — inspectChain unterscheidet die URSACHE einer Abweichung.
//
// Die Nutzdaten stammen aus dem frischen READ-ONLY-Export des Live-Bestandes
// (`_relay/spikes/audit-forensik-25072026/nachlauf-1629/rows.tsv`, 871 Einträge, 25.07.2026 16:29),
// NICHT aus erfundenen Beispielen. Verwendet werden zwei der 182 abweichenden Zeilen:
//   seq  24  ask.query      — 5 flache Schlüssel
//   seq 714  examples.load  — 4 Schlüssel, davon einer ein verschachteltes 3-Schlüssel-Objekt
// Die Payloads stehen hier in der jsonb-RÜCKLESEFORM (kanonisch: Schlüssellänge, dann bytweise),
// genau so, wie `repo-pg.ts` sie liefert. Die gespeicherten Hashes sind die unveränderten
// Originalwerte aus dem Export.

// Zeile seq 24, rows.tsv Spalten seq/at/actor/action/target/payload/prev_hash/hash.
const LIVE_SEQ_24: AuditEntry = {
  seq: 24,
  at: "2026-07-05T18:41:57.988Z",
  actor: "19bfba49-d554-4775-8b8f-9d3fa55a7717",
  action: "ask.query",
  target: "-",
  payload: {
    topK: 8,
    answered: false,
    retrievalMode: "prefilter",
    candidateCount: 0,
    prefilterCount: 0,
  },
  prevHash: "48dce30aa86e7c4c726807cfe3e892053801ec2000b247b29d8338a5c2ef4006",
  hash: "d60122909d410d47dd4174b1e1f9b115d49dacb5164d734edacc09c2628a5102",
};

// Zeile seq 714 — der Fall, an dem eine NICHT-rekursive Umordnungssuche scheitert.
const LIVE_SEQ_714: AuditEntry = {
  seq: 714,
  at: "2026-07-23T05:07:46.708Z",
  actor: "d699f3e7-f948-4601-bb53-a060ab40b38a",
  action: "examples.load",
  target: "konflikte",
  payload: {
    created: 6,
    skipped: 0,
    conflicts: { failed: 0, created: 3, skipped: 0 },
    skippedInTrash: 0,
  },
  prevHash: "33dcacc88ef27cf6a1214be95c167bbd39275820131d3e52d7300aaf4b9d59c2",
  hash: "70a6844f484a9a74178549ea6c6bdf9553b19e35b8f0e3b3c724a40f75dd5c7f",
};

// Einen gültigen Eintrag versiegeln — der gespeicherte Hash ist der über die Felder berechnete.
function seal(partial: Omit<AuditEntry, "hash">): AuditEntry {
  return { ...partial, hash: hashEntry(partial) };
}

// Den jsonb-Effekt naturgetreu nachstellen: geschrieben (und gehasht) wird `written`, zurückgelesen
// wird `readBack` — dieselben Schlüssel, dieselben Werte, andere Reihenfolge. Der gespeicherte Hash
// bleibt der des Schreibvorgangs. Genau das erzeugt Postgres beim Zurücklesen.
function jsonbReadBack(
  partial: Omit<AuditEntry, "hash" | "payload">,
  written: Record<string, unknown>,
  readBack: Record<string, unknown>,
): AuditEntry {
  return { ...seal({ ...partial, payload: written }), payload: readBack };
}

function base(seq: number, prevHash: string, action = "test.action") {
  return {
    seq,
    at: `2026-07-25T10:0${seq}:00.000Z`,
    actor: "actor-1",
    action,
    target: `ko-${seq}`,
    prevHash,
  };
}

describe("inspectChain — heile Kette", () => {
  it("leere Kette gilt als intakt (count 0, keine Abweichung)", () => {
    expect(inspectChain([])).toEqual({
      ok: true,
      count: 0,
      linkageBreaks: 0,
      payloadDeviations: 0,
      serialisationDeviations: 0,
      unresolvedDeviations: 0,
      uncheckedDeviations: 0,
    });
  });

  it("lückenlose Kette → ok:true, KEINE firstDeviation", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: { a: 1, b: 2 } });
    const e2 = seal({ ...base(2, e1.hash), payload: { c: 3 } });
    const report = inspectChain([e1, e2]);
    expect(report.ok).toBe(true);
    expect(report.count).toBe(2);
    expect(report.linkageBreaks).toBe(0);
    expect(report.payloadDeviations).toBe(0);
    expect(report.firstDeviation).toBeUndefined();
  });
});

describe("inspectChain — linkage: echter Kettenbruch", () => {
  it("verbogener prevHash → kind 'linkage' mit der richtigen seq", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: { a: 1 } });
    const e2 = seal({ ...base(2, e1.hash), payload: { b: 2 } });
    // Der dritte Eintrag zeigt bewusst NICHT auf e2, sondern auf e1 — die Verkettung bricht.
    const e3 = seal({ ...base(3, e1.hash), payload: { c: 3 } });
    const report = inspectChain([e1, e2, e3]);
    expect(report.ok).toBe(false);
    expect(report.linkageBreaks).toBe(1);
    // Der Eintrag ist in sich stimmig — nur die Verkettung ist verletzt.
    expect(report.payloadDeviations).toBe(0);
    expect(report.firstDeviation).toEqual({
      seq: 3,
      at: e3.at,
      action: "test.action",
      kind: "linkage",
    });
  });

  it("linkage rangiert INNERHALB einer Zeile vor der Nutzdaten-Abweichung", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: { a: 1 } });
    // prevHash falsch UND gespeicherter Hash verfälscht — die Zeile zählt in BEIDEN Zählern,
    // benannt wird sie (wie in verifyChain, das prevHash zuerst prüft) als 'linkage'.
    const e2: AuditEntry = {
      ...seal({ ...base(2, GENESIS), payload: { b: 2 } }),
      hash: "0".repeat(64),
    };
    const report = inspectChain([e1, e2]);
    expect(report.linkageBreaks).toBe(1);
    expect(report.payloadDeviations).toBe(1);
    expect(report.firstDeviation?.kind).toBe("linkage");
  });
});

describe("inspectChain — serialisation: nur die Schlüsselreihenfolge weicht ab", () => {
  it("ECHTE Live-Zeile seq 24 (ask.query, 5 flache Schlüssel) → serialisation", () => {
    // Einzelne Zeile aus der Kette herausgeschnitten: ihr prevHash zeigt auf seq 23, der hier
    // nicht vorliegt — deshalb meldet der Bericht erwartungsgemäß EINEN linkage-Bruch. Geprüft
    // wird hier ausschließlich die EINORDNUNG der Nutzdaten-Abweichung.
    const report = inspectChain([LIVE_SEQ_24]);
    expect(report.payloadDeviations).toBe(1);
    expect(report.serialisationDeviations).toBe(1);
    expect(report.unresolvedDeviations).toBe(0);
    expect(report.uncheckedDeviations).toBe(0);
  });

  it("ECHTE Live-Zeile seq 714 (examples.load, VERSCHACHTELT) → serialisation", () => {
    const report = inspectChain([LIVE_SEQ_714]);
    expect(report.payloadDeviations).toBe(1);
    expect(report.serialisationDeviations).toBe(1);
    expect(report.unresolvedDeviations).toBe(0);
  });

  it("heile Kette mit den echten Werten aus seq 24 → firstDeviation.kind = 'serialisation'", () => {
    // Dieselben Werte, aber in einer lückenlosen Kette: kein linkage-Bruch, nur der jsonb-Effekt.
    const written = LIVE_SEQ_24.payload;
    const readBack = {
      prefilterCount: written.prefilterCount,
      candidateCount: written.candidateCount,
      retrievalMode: written.retrievalMode,
      answered: written.answered,
      topK: written.topK,
    };
    const e1 = jsonbReadBack(base(1, GENESIS, "ask.query"), written, readBack);
    const report = inspectChain([e1]);
    expect(report.ok).toBe(false);
    expect(report.linkageBreaks).toBe(0);
    expect(report.payloadDeviations).toBe(1);
    expect(report.serialisationDeviations).toBe(1);
    expect(report.firstDeviation).toEqual({
      seq: 1,
      at: e1.at,
      action: "ask.query",
      kind: "serialisation",
    });
  });

  it("NUR das verschachtelte Objekt ist umgeordnet — ohne Rekursion fiele dieser Test durch", () => {
    // Die äußere Schlüsselreihenfolge ist IDENTISCH. Abweichend ist ausschließlich die Reihenfolge
    // innerhalb von `conflicts`. Eine Umordnungssuche, die nur die oberste Ebene permutiert, kann
    // den gespeicherten Hash nicht treffen und würde fälschlich 'unresolved' melden — und damit
    // eine falsche Warnung in der Oberfläche auslösen.
    const written = {
      created: 6,
      skipped: 0,
      conflicts: { created: 3, skipped: 0, failed: 0 },
      skippedInTrash: 0,
    };
    const readBack = {
      created: 6,
      skipped: 0,
      conflicts: { failed: 0, created: 3, skipped: 0 },
      skippedInTrash: 0,
    };
    expect(Object.keys(written)).toEqual(Object.keys(readBack));
    const e1 = jsonbReadBack(base(1, GENESIS, "examples.load"), written, readBack);
    const report = inspectChain([e1]);
    expect(report.serialisationDeviations).toBe(1);
    expect(report.unresolvedDeviations).toBe(0);
    expect(report.firstDeviation?.kind).toBe("serialisation");
  });

  it("Arrays behalten ihre Reihenfolge (wie jsonb) — nur Objektschlüssel werden umgeordnet", () => {
    const written = { ids: ["a", "b"], mode: "x" };
    const e1 = jsonbReadBack(base(1, GENESIS), written, { mode: "x", ids: ["a", "b"] });
    expect(inspectChain([e1]).serialisationDeviations).toBe(1);
    // Eine ECHTE Umsortierung der Array-Elemente ist eine Inhaltsänderung, keine Reihenfolge-
    // normierung — sie darf NICHT wegerklärt werden.
    const e2 = jsonbReadBack(base(1, GENESIS), written, { mode: "x", ids: ["b", "a"] });
    expect(inspectChain([e2]).unresolvedDeviations).toBe(1);
  });
});

describe("inspectChain — unresolved: echte Wertänderung wird NICHT wegerklärt", () => {
  it("ECHTE Live-Zeile seq 714 mit EINER geänderten Zahl (created 6 → 7) → unresolved", () => {
    const changed: AuditEntry = {
      ...LIVE_SEQ_714,
      payload: { ...LIVE_SEQ_714.payload, created: 7 },
    };
    const report = inspectChain([changed]);
    expect(report.payloadDeviations).toBe(1);
    expect(report.unresolvedDeviations).toBe(1);
    expect(report.serialisationDeviations).toBe(0);
  });

  it("geänderter Wert in heiler Kette → firstDeviation.kind = 'unresolved'", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: { a: 1, b: 2 } });
    const tampered: AuditEntry = { ...e1, payload: { a: 1, b: 99 } };
    const report = inspectChain([tampered]);
    expect(report.linkageBreaks).toBe(0);
    expect(report.firstDeviation?.kind).toBe("unresolved");
  });
});

describe("inspectChain — unchecked: die Schranke ist ehrlich", () => {
  // 9 Schlüssel = 362.880 Umordnungen > MAX_PAYLOAD_ORDERINGS (50.000). Der Eintrag wird GAR NICHT
  // geprüft. „nicht geprüft" muss von „geprüft und nicht aufgelöst" unterscheidbar bleiben.
  const NINE_KEYS = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 };

  it("Eintrag über der Schranke → 'unchecked', NICHT 'unresolved'", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: NINE_KEYS });
    const tampered: AuditEntry = { ...e1, payload: { ...NINE_KEYS, a: 111 } };
    const report = inspectChain([tampered]);
    expect(report.payloadDeviations).toBe(1);
    expect(report.uncheckedDeviations).toBe(1);
    expect(report.unresolvedDeviations).toBe(0);
    expect(report.serialisationDeviations).toBe(0);
    expect(report.firstDeviation?.kind).toBe("unchecked");
  });

  it("derselbe Eintrag mit angehobener Schranke wird geprüft → 'unresolved'", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: NINE_KEYS });
    const tampered: AuditEntry = { ...e1, payload: { ...NINE_KEYS, a: 111 } };
    const report = inspectChain([tampered], { maxOrderings: 400_000 });
    expect(report.uncheckedDeviations).toBe(0);
    expect(report.unresolvedDeviations).toBe(1);
  });

  it("der real vorkommende Höchstfall (6 Schlüssel + verschachteltes 3er-Objekt = 4.320) wird geprüft", () => {
    const written = {
      k1: 1,
      k2: 2,
      k3: 3,
      k4: 4,
      k5: 5,
      nested: { a: 1, b: 2, c: 3 },
    };
    const readBack = {
      nested: { c: 3, b: 2, a: 1 },
      k5: 5,
      k4: 4,
      k3: 3,
      k2: 2,
      k1: 1,
    };
    const e1 = jsonbReadBack(base(1, GENESIS), written, readBack);
    const report = inspectChain([e1]);
    expect(report.uncheckedDeviations).toBe(0);
    expect(report.serialisationDeviations).toBe(1);
  });
});

describe("inspectChain — mehrere Abweichungen", () => {
  it("firstDeviation nennt die KLEINSTE seq, die Zähler stimmen unabhängig", () => {
    const e1 = seal({ ...base(1, GENESIS), payload: { a: 1 } });
    // seq 2: reine Reihenfolgeabweichung (jsonb-Effekt), Verkettung intakt.
    const e2 = jsonbReadBack(base(2, e1.hash), { x: 1, y: 2 }, { y: 2, x: 1 });
    // seq 3: echter Kettenbruch (zeigt auf e1 statt e2).
    const e3 = seal({ ...base(3, e1.hash), payload: { c: 3 } });
    // seq 4: echte Wertänderung, Verkettung intakt.
    const e4Valid = seal({ ...base(4, e3.hash), payload: { d: 4 } });
    const e4: AuditEntry = { ...e4Valid, payload: { d: 44 } };

    const report = inspectChain([e1, e2, e3, e4]);
    expect(report.ok).toBe(false);
    expect(report.count).toBe(4);
    expect(report.linkageBreaks).toBe(1);
    expect(report.payloadDeviations).toBe(2);
    expect(report.serialisationDeviations).toBe(1);
    expect(report.unresolvedDeviations).toBe(1);
    expect(report.uncheckedDeviations).toBe(0);
    // Kleinste seq mit Abweichung ist 2 — NICHT der schwerere linkage-Bruch bei seq 3.
    expect(report.firstDeviation).toEqual({
      seq: 2,
      at: e2.at,
      action: "test.action",
      kind: "serialisation",
    });
  });
});
