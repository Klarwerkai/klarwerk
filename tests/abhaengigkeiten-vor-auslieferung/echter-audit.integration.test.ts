// ================================================================================================
// R-1398 · BEN nacharbeit-2 — DIE ECHTE MESSUNG, NICHT NUR DIE AUSWERTUNG.
// ================================================================================================
//
// Befund: für `apps/web` gab es keinen einzigen echten Auditbericht; die übrigen Tests füttern die
// Auswertung mit synthetischen Berichten. Diese Datei fragt die Registry WIRKLICH — mit demselben
// Starter, den der Ship-Weg ruft, und demselben Werkzeug, das die Dockerfile-Stufe ausführt — für
// beide ausgelieferten Bestände, und druckt jede Meldung mit Kennung, Paket, gebundener Version,
// Ort, Schwere und betroffenem Bereich in den Lauf. Diese Ausgabe IST der Messbeleg.
//
// Warum `.integration.test.ts`: das reguläre Tor ist hermetisch (kein Egress); `npm audit` braucht
// die Registry. Der Integrationslauf (`npm run test:integration`, in CI mit Netz) ist der Ort für
// Prüfungen gegen echte Infrastruktur.
//
// Rot heisst hier dasselbe wie im Lieferweg: eine Meldung ohne Bewertung an der gebundenen Version
// (Exit 1) oder keine Antwort der Registry (Exit 2). Dann wird nicht dieser Test angepasst, sondern
// die Meldung an ihrem Aufrufpfad bewertet oder gezielt behoben.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ordner = mkdtempSync(join(tmpdir(), "klarwerk-echter-audit-"));
afterAll(() => {
  rmSync(ordner, { recursive: true, force: true });
});

describe("R-1398 · echter npm audit beider ausgelieferten Bestände", () => {
  it("jede gemeldete Advisory (Laufzeit und gebündelte SPA) ist an der gebundenen Version bewertet", () => {
    const ergebnis = join(ordner, "abhaengigkeiten-audit.txt");
    const r = spawnSync(
      "bash",
      [join(WURZEL, "tools/abhaengigkeiten-audit.sh"), "--ausgabe", ergebnis],
      { cwd: WURZEL, encoding: "utf8", timeout: 110_000 },
    );
    const aus = `${r.stdout}${r.stderr}`;
    // Der Beleg: die vollständige Ausgabe steht im Lauf, auch wenn er grün ist.
    console.log(aus);
    const datei = readFileSync(ergebnis, "utf8");
    expect(datei).toContain("Quelle wurzel: npm audit, jetzt");
    expect(datei).toContain("Quelle web: npm audit, jetzt");
    expect(r.status, aus).toBe(0);
    expect(datei).toMatch(/Bestand web \(apps\/web\/package-lock\.json\): \d+ Meldungen/);
  });
});
