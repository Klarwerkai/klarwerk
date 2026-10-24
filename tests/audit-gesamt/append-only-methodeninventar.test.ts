// Reines Prototypinventar der bestehenden Audit-Klassen: explizite Einordnung aller Methoden.
// Die echten PG-Schreib- und Unveränderlichkeitsnachweise bleiben in
// append-only-verweigerung.integration.test.ts. Hier werden keine Instanzen oder Verbindungen erzeugt.
import { describe, expect, it } from "vitest";
import { AuditService, PgAuditRepo } from "../../services/audit";

/** Jede Methode am Prototyp, eingeordnet. Schreibend heißt: kann eine Zeile in `audit` erzeugen. */
// Seit der Zusammenführung mit dem Dubletten-Rückzug laufen `record`/`recordOnce` unter der
// `kettenSperre`; ihr Rumpf steht in je einer privaten Methode — beide hängen nur an (`appendNext`
// bzw. `last` + `append`/`appendOnce`) und werden von den Fällen zu `record`/`recordOnce` geprüft.
const AUDIT_SERVICE_METHODEN = {
  schreibend: ["record", "recordUngeteilt", "recordOnce", "recordOnceUngeteilt", "exportChain"],
  lesend: ["list", "exists", "kopfSeq", "verify", "verifyReport", "baue", "page", "namensbelege"],
};
const PG_AUDIT_REPO_METHODEN = {
  schreibend: ["append", "appendOnce", "appendNext"],
  lesend: [
    "queryable",
    "all",
    "findBy",
    "existsBy",
    "last",
    "findBySeq",
    "findPage",
    "findNamensbelege",
  ],
};

describe("BEN-L5-B2 · Append-only-Methodeninventar (ohne Datenbank)", () => {
  it("Inventar: jede Methode von AuditService und PgAuditRepo ist eingeordnet, keine ändert oder löscht", () => {
    for (const [Klasse, liste] of [
      [AuditService, AUDIT_SERVICE_METHODEN],
      [PgAuditRepo, PG_AUDIT_REPO_METHODEN],
    ] as const) {
      const vorhanden = Object.getOwnPropertyNames(Klasse.prototype)
        .filter((n) => n !== "constructor")
        .sort();
      expect(vorhanden, `${Klasse.name}: Methode ohne Einordnung`).toEqual(
        [...liste.schreibend, ...liste.lesend].sort(),
      );
    }
    process.stderr.write(
      "[KLARWERK][audit-methodeninventar] Nur Prototypen geprüft; keine PG-/HTTP-Ausführung.\n",
    );
  });
});
