// ================================================================================================
// BENS BEFUND NACHARBEIT-4 — DER RESTORE-DRILL BLEIBT DIREKT AUFRUFBAR.
// ================================================================================================
//
// Die Ergänzung von `confluence_import_schalter` im Pflichttabellensatz hatte den Git-Dateimodus des
// Skripts von 100755 auf 100644 gesetzt. Dokumentiert ist aber der DIREKTE Aufruf
// (`./scripts/backup/restore-drill.sh <dump>`, scripts/backup/RESTORE.md, docs/operations/
// restore-drill.md) — nach einem Checkout mit 100644 bricht er mit „Permission denied" ab.
//
// Gemessen wird am ausgecheckten Baum: Git legt den Modus beim Checkout als Ausführungsbit an, und
// genau diesen Zustand findet der Betreiber vor. Zugleich bleibt der neue Tabelleneintrag stehen —
// die Korrektur des Modus darf ihn nicht zurücknehmen.
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const SKRIPT = repoPfad("scripts/backup/restore-drill.sh");

describe("restore-drill.sh · ausführbar und mit dem Betreiberschalter im Pflichtsatz", () => {
  it("das Skript trägt das Ausführungsbit für den Eigentümer", () => {
    const modus = statSync(SKRIPT).mode;
    expect(
      (modus & 0o100) !== 0,
      `Modus ${(modus & 0o777).toString(8)} — erwartet ausführbar (Git 100755)`,
    ).toBe(true);
  });

  it("der Pflichttabellensatz führt confluence_import_schalter weiter", () => {
    const text = readFileSync(SKRIPT, "utf8");
    const anfang = text.indexOf("PFLICHTTABELLEN=(");
    expect(anfang, "PFLICHTTABELLEN fehlt im Skript").toBeGreaterThanOrEqual(0);
    const satz = text.slice(anfang, text.indexOf(")", anfang));
    expect(satz.split(/\s+/)).toContain("confluence_import_schalter");
  });
});
