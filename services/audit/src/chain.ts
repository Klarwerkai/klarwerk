import { createHash } from "node:crypto";
import type { AuditEntry } from "./types";

export const GENESIS = "GENESIS";

// Hash über den Inhalt + Vorgänger-Hash. Jede nachträgliche Änderung bricht die Kette.
export function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  const material = [
    entry.seq,
    entry.at,
    entry.actor,
    entry.action,
    entry.target,
    JSON.stringify(entry.payload),
    entry.prevHash,
  ].join("|");
  return createHash("sha256").update(material).digest("hex");
}

// FR-AUD-02: Manipulation ist erkennbar — die Kette verifiziert lückenlos.
export function verifyChain(entries: readonly AuditEntry[]): boolean {
  let prev = GENESIS;
  for (const entry of entries) {
    if (entry.prevHash !== prev) {
      return false;
    }
    const expected = hashEntry({
      seq: entry.seq,
      at: entry.at,
      actor: entry.actor,
      action: entry.action,
      target: entry.target,
      payload: entry.payload,
      prevHash: entry.prevHash,
    });
    if (entry.hash !== expected) {
      return false;
    }
    prev = entry.hash;
  }
  return true;
}
