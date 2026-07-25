import { describe, expect, it } from "vitest";
import { GENESIS, hashEntry } from "../../services/audit/src/chain";
// AUFTRAG-mega4 Block E (bens Sammel-Review 4): ENDUNGSLOSER Import. Der Bash-Starter heißt jetzt
// eindeutig `tools/audit-forensics.sh` und kollidiert nicht mehr mit dem Modul `tools/audit-forensics.ts`
// — die frühere repo-weite Ausnahme `allowImportingTsExtensions` ist damit entfallen.
import { type Analyzed, type ForensicRow, analyze, buildReport } from "../../tools/audit-forensics";

// AUFTRAG-mega3 Block E (bens Sammel-Review 3): BEIDE Hashprüfungen jeder Zeile werden UNABHÄNGIG
// ausgewertet UND aggregiert. Reiner Testdatensatz — KEINE DB, kein Import von Live-Daten. Drei Fälle:
//   (1) nur Vorgängerbruch (prevHash falsch, Nutzdatenhash korrekt),
//   (2) nur Nutzdatenbruch (prevHash korrekt, Nutzdatenhash falsch),
//   (3) BEIDE Brüche in DERSELBEN Zeile.
// Der frühere Fehler: pro Zeile wurde nur EINE exklusive Klasse gesetzt; ein Nutzdatenbruch in einer
// bereits als Vorgängerbruch klassifizierten Zeile verschwand aus der Gesamtzählung.

// Eine VALIDE Zeile bauen: der gespeicherte Hash entspricht exakt dem über die Felder (inkl. prevHash)
// berechneten. So ist die Zeile für sich lückenlos, bevor wir gezielt EINE oder BEIDE Prüfungen brechen.
function makeRow(seq: number, prevHash: string, payload: Record<string, unknown>): ForensicRow {
  const base = {
    seq,
    at: `2026-07-24T10:0${seq}:00.000Z`,
    actor: `actor-${seq}`,
    action: "test.action",
    target: `ko-${seq}`,
    payload,
    prevHash,
  };
  const hash = hashEntry(base);
  return {
    seq,
    at: base.at,
    actor: base.actor,
    action: base.action,
    target: base.target,
    payload,
    payload_text: JSON.stringify(payload),
    prev_hash: prevHash,
    hash,
  };
}

// Zeile mit FALSCHEM prevHash, deren gespeicherter Hash aber ZUM (falschen) prevHash passt →
// prevHashOk=false, payloadHashOk=true.
function corruptPrevOnly(row: ForensicRow, wrongPrev: string): ForensicRow {
  const rehashed = hashEntry({
    seq: row.seq,
    at: row.at,
    actor: row.actor,
    action: row.action,
    target: row.target,
    payload: row.payload,
    prevHash: wrongPrev,
  });
  return { ...row, prev_hash: wrongPrev, hash: rehashed };
}

// Nur den gespeicherten Hash verfälschen → payloadHashOk=false (prevHash bleibt korrekt).
function corruptPayloadOnly(row: ForensicRow): ForensicRow {
  return { ...row, hash: `${row.hash.slice(0, -4)}dead` };
}

function findBySeq(analyzed: Analyzed[], seq: number): Analyzed {
  const a = analyzed.find((x) => x.row.seq === seq);
  if (!a) {
    throw new Error(`Zeile seq=${seq} nicht gefunden`);
  }
  return a;
}

describe("AUFTRAG-mega3 Block E: unabhängige Aggregation beider Hashprüfungen", () => {
  it("(1) nur Vorgängerbruch: prevHashOk=false, payloadHashOk=true; genau ein prevHash-Bruch, kein Nutzdatenbruch", () => {
    const r1 = makeRow(1, GENESIS, { a: 1 });
    const r2raw = makeRow(2, r1.hash, { b: 2 });
    const r2 = corruptPrevOnly(r2raw, "NICHT-DER-VORGAENGER");
    const analyzed = analyze([r1, r2]);

    const a2 = findBySeq(analyzed, 2);
    expect(a2.prevHashOk).toBe(false);
    expect(a2.payloadHashOk).toBe(true);
    expect(a2.violationClass).toBe("PREVHASH_BREAK");

    const report = buildReport(analyzed);
    expect(report).toContain("prevHash-Brüche:        1");
    expect(report).toContain("Nutzdaten-Hash-Fehler:  0");
    expect(report).toContain("Zeilen mit BEIDEN:      0");
  });

  it("(2) nur Nutzdatenbruch: prevHashOk=true, payloadHashOk=false; genau ein Nutzdatenbruch, kein prevHash-Bruch", () => {
    const r1 = makeRow(1, GENESIS, { a: 1 });
    const r2 = corruptPayloadOnly(makeRow(2, r1.hash, { b: 2 }));
    const analyzed = analyze([r1, r2]);

    const a2 = findBySeq(analyzed, 2);
    expect(a2.prevHashOk).toBe(true);
    expect(a2.payloadHashOk).toBe(false);
    expect(a2.violationClass).toBe("PAYLOADHASH_MISMATCH");

    const report = buildReport(analyzed);
    expect(report).toContain("prevHash-Brüche:        0");
    expect(report).toContain("Nutzdaten-Hash-Fehler:  1");
    expect(report).toContain("Zeilen mit BEIDEN:      0");
  });

  it("(3) BEIDE Brüche in derselben Zeile: beide Klassen ausgewiesen, erste in Produktionsreihenfolge (prevHash)", () => {
    const r1 = makeRow(1, GENESIS, { a: 1 });
    // Zeile 2: falscher prevHash UND ein danach verfälschter Hash → BEIDE Prüfungen brechen.
    const r2 = corruptPayloadOnly(
      corruptPrevOnly(makeRow(2, r1.hash, { b: 2 }), "FALSCHER-VORGAENGER"),
    );
    const analyzed = analyze([r1, r2]);

    const a2 = findBySeq(analyzed, 2);
    expect(a2.prevHashOk).toBe(false);
    expect(a2.payloadHashOk).toBe(false);
    // Die ERSTE Bruchklasse bleibt in Produktionsreihenfolge benannt: prevHash vor Nutzdatenhash.
    expect(a2.violationClass).toBe("PREVHASH_BREAK");

    const report = buildReport(analyzed);
    // BEIDE Klassen erscheinen — der Nutzdatenbruch verschwindet NICHT hinter dem prevHash-Bruch.
    expect(report).toContain("prevHash-Brüche:        1");
    expect(report).toContain("Nutzdaten-Hash-Fehler:  1");
    expect(report).toContain("Zeilen mit BEIDEN:      1");
    expect(report).toContain("Sequenzen mit BEIDEN Fehlerklassen (prevHash UND Nutzdaten): 2");
    // Die Zwei-Klassen-Diagnose weist beide Sequenzlisten aus.
    expect(report).toContain("ZWEI verschiedene Fehlerklassen");
    // Das erste verletzte Glied wird als PREVHASH_BREAK benannt (Produktionsreihenfolge).
    expect(report).toContain("Fehlerklasse:   PREVHASH_BREAK");
  });
});
