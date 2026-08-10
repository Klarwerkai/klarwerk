import { describe, expect, it } from "vitest";
import { GENESIS, hashEntry, verifyChain } from "./chain";
import { pruefeValidationDecisionRef } from "./repo";
import type { AuditEntry } from "./types";

// ================================================================================================
// BEN-70 ROT-1 — DIE KETTENBINDUNG (KW-W3-19, Leseablauf Schritt 3)
// ================================================================================================
//
// BENs Widerlegung, woertlich nachgebaut: eine Zweierkette wird am VORGAENGER manipuliert. Der
// Zieleintrag bleibt selbst unveraendert und traegt einen korrekten Selbsthash — er wurde von
// `pruefeValidationDecisionRef` trotzdem als `OK` akzeptiert.
//
// Der Fehler war ein Denkfehler ueber die Auditkette: der Selbsthash beweist, dass DIESE Zeile
// nicht angefasst wurde. Er beweist NICHT, dass sie noch an derselben Geschichte haengt. Genau
// dafuer gibt es `verifyChain`, und KW-W3-19 verlangt den Schritt ausdruecklich —
// „Der Hash ersetzt nicht die Pruefung der Auditkette."

function kette(): AuditEntry[] {
  const erster: AuditEntry = {
    seq: 1,
    at: "2026-08-02T09:00:00.000Z",
    actor: "anna",
    action: "ko.created",
    target: "ko-1",
    payload: { titel: "Erstanlage" },
    prevHash: GENESIS,
    hash: "",
  };
  erster.hash = hashEntry(erster);
  const zweiter: AuditEntry = {
    seq: 2,
    at: "2026-08-02T09:05:00.000Z",
    actor: "bea",
    action: "ko.rated",
    target: "ko-1",
    payload: { verdict: "up", koVersion: 3 },
    prevHash: erster.hash,
    hash: "",
  };
  zweiter.hash = hashEntry(zweiter);
  return [erster, zweiter];
}

const SUBJECT = { koId: "ko-1", koVersion: 3 } as const;

describe("BEN-70/ROT-1 · OK nur bei verifizierter Auditkette", () => {
  it("die unversehrte Kette liefert OK — der Positivfall bleibt erreichbar", () => {
    const k = kette();
    const ziel = k[1] as AuditEntry;
    expect(verifyChain(k)).toBe(true);
    expect(
      pruefeValidationDecisionRef(ziel, { auditSeq: 2, auditHash: ziel.hash }, SUBJECT, k),
    ).toBe("OK");
  });

  it("BENs Fall: manipulierter VORGAENGER, unversehrtes Ziel ⇒ NICHT OK", () => {
    const k = kette();
    const ziel = k[1] as AuditEntry;
    // Nur der Vorgaenger wird veraendert. Das Ziel bleibt bitgleich und behaelt seinen
    // korrekten Selbsthash — genau BENs Aufbau.
    k[0] = { ...(k[0] as AuditEntry), payload: { titel: "nachtraeglich veraendert" } };
    expect(verifyChain(k), "die Kette ist nachweislich gebrochen").toBe(false);
    expect(hashEntry(ziel), "das Ziel selbst ist unversehrt").toBe(ziel.hash);

    expect(
      pruefeValidationDecisionRef(ziel, { auditSeq: 2, auditHash: ziel.hash }, SUBJECT, k),
    ).not.toBe("OK");
  });

  it("der gebrochene Kettenbefund ist HASH_MISMATCH — die Bindung, nicht das Ereignis, ist kaputt", () => {
    const k = kette();
    const ziel = k[1] as AuditEntry;
    k[0] = { ...(k[0] as AuditEntry), payload: { titel: "veraendert" } };
    expect(
      pruefeValidationDecisionRef(ziel, { auditSeq: 2, auditHash: ziel.hash }, SUBJECT, k),
    ).toBe("HASH_MISMATCH");
  });

  it("ein Ziel, das gar nicht in der uebergebenen Kette liegt, ist MISSING", () => {
    const k = kette();
    const fremd: AuditEntry = { ...(k[1] as AuditEntry), seq: 99 };
    expect(
      pruefeValidationDecisionRef(fremd, { auditSeq: 99, auditHash: fremd.hash }, SUBJECT, k),
    ).toBe("MISSING");
  });

  it("eine leere Kette kann nichts belegen ⇒ MISSING, niemals OK", () => {
    const ziel = kette()[1] as AuditEntry;
    expect(
      pruefeValidationDecisionRef(ziel, { auditSeq: 2, auditHash: ziel.hash }, SUBJECT, []),
    ).toBe("MISSING");
  });

  it("die Reihenfolge bleibt: eine falsche Action faellt auch in intakter Kette auf", () => {
    const k = kette();
    const ziel = k[1] as AuditEntry;
    const umgewidmet: AuditEntry = { ...ziel, action: "ko.assigned", hash: "" };
    umgewidmet.hash = hashEntry(umgewidmet);
    const k2 = [k[0] as AuditEntry, umgewidmet];
    expect(verifyChain(k2), "die Kette selbst ist intakt").toBe(true);
    expect(
      pruefeValidationDecisionRef(
        umgewidmet,
        { auditSeq: 2, auditHash: umgewidmet.hash },
        SUBJECT,
        k2,
      ),
    ).toBe("WRONG_EVENT_TYPE");
  });
});
