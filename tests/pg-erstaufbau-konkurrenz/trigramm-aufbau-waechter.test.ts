import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ================================================================================================
// AUFNAHME pg-start-audit-konkurrenz · DER RÜCKFALL-WÄCHTER FÜR DEN TRIGRAMM-ERSTAUFBAU.
// ================================================================================================
//
// WARUM ES IHN GIBT — GEMESSEN, NICHT VORSORGLICH. Der Auslöser aus JOB 4321 war EINE Zeile:
// `verwaltung.query("CREATE EXTENSION IF NOT EXISTS pg_trgm")` im `beforeAll` einer
// Integrationsdatei. Auf einer frischen Instanz scheitert sie, sobald eine andere Datei des
// gemeinsamen Laufs die Erweiterung gleichzeitig anlegt (`pg_extension_name_index`; reproduziert in
// `erstaufbau-konkurrenz.integration.test.ts`, E1-K). Diese Aufnahme hat die App-Suite auf den
// Schutzpfad `stelleTrigrammErweiterungSicher` umgestellt — und eine Runde später brachte eine neue
// Lieferung (`tests/pptx-importquittung/altbeleg-und-bildbilanz-pg.integration.test.ts`) die blanke
// Zeile wieder mit, abgeschrieben aus der alten Hausform. Integrationsdateien laufen nicht im
// schnellen Tor; ohne diesen Fall bemerkt einen solchen Rückfall erst ein Erstaufbau, der zufällig
// überlappt.
//
// WAS ER PRÜFT. Jede Code-Zeile (keine Kommentarzeile) einer `*.integration.test.ts` unter
// `services/` und `tests/`, die `.query("CREATE EXTENSION …")` blank absetzt. Erlaubt sind genau
// die Dateien unten, und jede nennt ihren Grund: sie legen die Erweiterung ABSICHTLICH ungeschützt
// an, um den Wettlauf herzustellen oder zu kalibrieren. Die Liste ist ABSCHLIESSEND in beide
// Richtungen — fällt eine Ausnahme weg, ist der Fall ebenfalls rot, damit keine veraltete Ausnahme
// stehen bleibt, hinter der sich später ein echter Aufbau versteckt.
//
// WAS ER NICHT PRÜFT. Dass eine Datei den Schutzpfad in einer Überlappung TATSÄCHLICH durchläuft —
// das misst nur ein Lauf gegen echte Datenbank (E1 für die App-Suite). Dieser Fall ist ein Netz
// gegen den abgeschriebenen Rückfall, kein Nachweis der Wirkung.

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = join(HIER, "../..");

/** Absichtlich ungeschützte Anlagen — Datei → Grund. */
const ABSICHTLICH: Record<string, string> = {
  "tests/office-pg-abnahme/rueckweg-pg.integration.test.ts":
    "JOB 4321 Q7: stellt den Wettlauf her und kalibriert den Schutzpfad dagegen",
  "tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts":
    "E1/E1-K: der Halter hält die Anlage offen; die Kalibrierung entfernt bzw. umgeht den Schutz",
  "tests/wiki-diskussion-nutzerweg/diskussion-pg-im-browser.integration.test.ts":
    "Kalibrierung: roher Zweitaufbau neben dem geschützten",
};

const BLANKE_ANLAGE = /\.query\(\s*["'`]CREATE EXTENSION/;

/** Code-Zeilen mit blanker Anlage — Kommentarzeilen zählen nicht. */
function blankeAnlagen(quelle: string): number[] {
  const treffer: number[] = [];
  quelle.split("\n").forEach((zeile, i) => {
    const kopf = zeile.trimStart();
    if (kopf.startsWith("//") || kopf.startsWith("*") || kopf.startsWith("/*")) {
      return;
    }
    if (BLANKE_ANLAGE.test(zeile)) {
      treffer.push(i + 1);
    }
  });
  return treffer;
}

function integrationsdateien(wurzel: string): string[] {
  const ergebnis: string[] = [];
  for (const eintrag of readdirSync(wurzel, { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) {
      continue;
    }
    const pfad = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) {
      ergebnis.push(...integrationsdateien(pfad));
    } else if (
      eintrag.name.endsWith(".integration.test.ts") &&
      // Die zeitweiligen Abschriften aus E1-K (nur während jenes Falls vorhanden, `.gitignore`).
      !/^build-app\.e1-.*\.integration\.test\.ts$/.test(eintrag.name)
    ) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

describe("Aufnahme pg-start-audit-konkurrenz · Rückfall-Wächter Trigramm-Erstaufbau", () => {
  it("W0 · KALIBRIERUNG: der Leser findet die blanke Anlage und übergeht Kommentare", () => {
    expect(
      blankeAnlagen('    await verwaltung.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");'),
    ).toEqual([1]);
    expect(blankeAnlagen("x\n  await p.query(`CREATE EXTENSION pg_trgm`);")).toEqual([2]);
    expect(
      blankeAnlagen('  // `verwaltung.query("CREATE EXTENSION IF NOT EXISTS pg_trgm")`'),
    ).toEqual([]);
    expect(blankeAnlagen('   * query("CREATE EXTENSION …") im Doc-Kommentar')).toEqual([]);
    expect(blankeAnlagen("  await stelleTrigrammErweiterungSicher(verwaltung);")).toEqual([]);
  });

  it("W1 · keine Integrationsdatei legt pg_trgm blank an — ausser den benannten Kalibrierungen", () => {
    const dateien = [
      ...integrationsdateien(join(REPO, "services")),
      ...integrationsdateien(join(REPO, "tests")),
    ];
    // Ohne gelesene Dateien wäre „keine Treffer" wertlos.
    expect(dateien.length).toBeGreaterThan(20);

    const gefunden: Record<string, number[]> = {};
    for (const pfad of dateien) {
      const zeilen = blankeAnlagen(readFileSync(pfad, "utf8"));
      if (zeilen.length > 0) {
        gefunden[relative(REPO, pfad).split("\\").join("/")] = zeilen;
      }
    }
    const unerlaubt = Object.keys(gefunden).filter((d) => !(d in ABSICHTLICH));
    expect(
      unerlaubt.map((d) => `${d}:${gefunden[d]?.join(",")}`),
      "Blanke `CREATE EXTENSION` im Aufbau — bitte `stelleTrigrammErweiterungSicher(…)` aus tests/office-pg-abnahme/rueckweg-erwartung.ts benutzen",
    ).toEqual([]);
    // Und die Gegenrichtung: jede Ausnahme wird noch gebraucht.
    expect(Object.keys(gefunden).sort()).toEqual(Object.keys(ABSICHTLICH).sort());
  });

  it("W2 · jede Datei mit absichtlich ungeschützter Anlage benutzt für ihren EIGENEN Aufbau den Schutzpfad", () => {
    for (const datei of Object.keys(ABSICHTLICH)) {
      expect(readFileSync(join(REPO, datei), "utf8"), datei).toMatch(
        /stelleTrigrammErweiterungSicher\(/,
      );
    }
  });
});
