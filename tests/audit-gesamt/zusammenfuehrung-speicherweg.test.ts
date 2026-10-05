// Aufnahme gesamt-auditprotokoll · Zusammenführung mit gesamt-dubletten-rueckzug — der Weg OHNE
// Datenbank (Dev-Journal und Rücknahme-Klammer).
//
// `AuditRepo.appendNext` (Lauf 3: Vorgänger lesen und anhängen als EIN Schritt) schreibt in
// `InMemoryAuditRepo` direkt, an `append`/`appendOnce` vorbei. Die beiden Hüllen des Speicherwegs
// sehen aber nur diese zwei Methoden: das Dev-Journal (`dev-persist.ts`, `MUTATING_METHODS`)
// schrieb einen solchen Eintrag nicht mit — nach einem Neustart fehlte er in der Kette —, und die
// Rücknahme-Klammer (`speicher-vorgang.ts`) hätte ihn bei einem gescheiterten Vorgang nicht
// zurückgestellt. Beide Hüllen bieten `appendNext` deshalb nicht an; der Audit-Dienst nimmt dort
// `last` + `append`/`appendOnce`, ungeteilt unter der `kettenSperre` der Klammer.
//
// Geprüft wird ohne Datenbank, mit einer Journaldatei im temporären Verzeichnis.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inMemoryRepos } from "../../services/app/src/build-app";
import { buildDevPersistServices } from "../../services/app/src/dev-persist";
import { speicherVorgang } from "../../services/app/src/speicher-vorgang";
import { type AuditEntry, inspectChain } from "../../services/audit";

const ordner: string[] = [];
afterEach(() => {
  for (const o of ordner.splice(0)) {
    rmSync(o, { recursive: true, force: true });
  }
});

function journalDatei(): string {
  const o = mkdtempSync(join(tmpdir(), "kw-audit-journal-"));
  ordner.push(o);
  return join(o, "journal.jsonl");
}

/** Lückenlos, eindeutig, jeder Eintrag verweist auf die Prüfsumme seines tatsächlichen Vorgängers. */
function pruefeKette(eintraege: readonly AuditEntry[]): void {
  expect(eintraege.map((e) => e.seq)).toEqual(eintraege.map((_, i) => i + 1));
  eintraege.forEach((e, i) => {
    if (i > 0) {
      expect(e.prevHash, `seq ${e.seq}`).toBe(eintraege[i - 1]?.hash);
    }
  });
  const bericht = inspectChain([...eintraege]);
  expect(bericht.linkageBreaks).toBe(0);
  expect(bericht.ok).toBe(true);
}

describe("Zusammenführung · Auditkette ohne Datenbank", () => {
  it("die erfassende Ablage der Rücknahme-Klammer bietet appendNext nicht an, append und appendOnce schon", () => {
    const vorgang = speicherVorgang(inMemoryRepos());
    expect(vorgang, "Klammer gebaut").toBeDefined();
    const ablage = vorgang?.repos.auditRepo as unknown as Record<string, unknown>;
    expect(ablage.appendNext).toBeUndefined();
    expect(typeof ablage.append).toBe("function");
    expect(typeof ablage.appendOnce).toBe("function");
  });

  it("Dev-Journal: gleichzeitige Einträge bilden eine intakte Kette und stehen nach dem Neustart unverändert da", async () => {
    const datei = journalDatei();
    const erste = await buildDevPersistServices(datei);
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        erste.audit.record({ actor: "a", action: "l5.parallel", target: `t${i}`, payload: { i } }),
      ),
    );
    expect(
      await erste.audit.recordOnce("l5:einmal", { actor: "a", action: "l5.einmal", target: "t" }),
    ).toBe(true);
    const vorher = await erste.audit.list();
    expect(vorher.filter((e) => e.action === "l5.parallel")).toHaveLength(8);
    pruefeKette(vorher);

    // Neustart: das Journal wird in frische Ablagen zurückgespielt.
    const zweite = await buildDevPersistServices(datei);
    const nachher = await zweite.audit.list();
    expect(nachher).toEqual(vorher);
    pruefeKette(nachher);
    // Exactly-once übersteht den Neustart ebenfalls.
    expect(
      await zweite.audit.recordOnce("l5:einmal", { actor: "b", action: "l5.einmal", target: "t" }),
    ).toBe(false);
  });
});
