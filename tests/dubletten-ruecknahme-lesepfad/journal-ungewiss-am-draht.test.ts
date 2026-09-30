import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { inMemoryRepos } from "../../services/app/src/build-app";
import {
  type JournalEntry,
  bestaetigungInDatei,
  journaledRepos,
} from "../../services/app/src/dev-persist";
import { befund, welt } from "../eigene-ruecknahme/welt";

// ================================================================================================
// Auftrag gesamt-dubletten-rueckzug, Lauf 5, Runde 3 — Bens BEN-R5-3: DER UNGEWISSE AUSGANG AM DRAHT.
// ================================================================================================
//
// Ben: die echte Löschroute antwortete bei ungewissem Journalabschluss mit HTTP 400 und trug die
// rohe Datenträgerursache (samt Dateipfad) in der Meldung. Soll: kein Eingabefehler (≥ 500), keine
// interne Ursache in der Antwort. Geliefert: 503 mit dem Code `JOURNAL_AUSGANG_UNGEWISS` und einem
// festen Satz (http.ts, `STATUS_BY_CODE`).

const verzeichnisse: string[] = [];
afterEach(() => {
  for (const dir of verzeichnisse.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const MARKER = "SYNTHETISCHER_INTERNER_DATEIPFAD";

it("DELETE /api/kos/:id bei ungewissem Abschluss: 503, Code sichtbar, keine interne Ursache, keine Kennung", async () => {
  const dir = mkdtempSync(join(tmpdir(), "klarwerk-ungewiss-draht-"));
  verzeichnisse.push(dir);
  const datei = join(dir, "journal.jsonl");
  let scharf = false;
  const repos = journaledRepos(
    inMemoryRepos(),
    (e: JournalEntry) => {
      if (scharf && e.method === "widerruf") {
        throw Object.assign(new Error(`ENOSPC: '${MARKER}'`), { code: "ENOSPC" });
      }
      appendFileSync(datei, `${JSON.stringify(e)}\n`, "utf8");
      if (scharf && e.method === "bestaetigung") {
        throw Object.assign(new Error(`EIO: close '${MARKER}'`), { code: "EIO" });
      }
    },
    false,
    (vorgang) => {
      if (scharf) {
        throw new Error(`EIO beim Lesen '${MARKER}'`);
      }
      return bestaetigungInDatei(datei)(vorgang);
    },
  );
  const w = await welt({ repos });
  try {
    const a = await w.services.ko.create({
      title: "Eigene Seite",
      statement: "Pumpe prüfen.",
      type: "best_practice",
      category: "Wartung",
      author: w.autorin.id,
    });
    const b = await w.services.ko.create({
      title: "Gegenseite",
      statement: "Pumpe prüfen.",
      type: "best_practice",
      category: "Wartung",
      author: w.fremde.id,
    });
    await befund(w.services, a.id, b.id);
    scharf = true;

    const antwort = await w.app.inject({
      method: "DELETE",
      url: `/api/kos/${a.id}`,
      headers: w.autorin.headers,
    });
    expect(antwort.statusCode).toBe(503);
    expect(antwort.json().error).toBe("JOURNAL_AUSGANG_UNGEWISS");
    expect(antwort.body).not.toContain(MARKER);
    expect(antwort.body).not.toContain("EIO");
    expect(antwort.body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // keine Vorgangskennung

    // Auch ein lesender Aufruf während der ungeklärten Lage: dieselbe Abbildung, kein Leck.
    const lesen = await w.app.inject({
      method: "GET",
      url: `/api/kos/${b.id}`,
      headers: w.autorin.headers,
    });
    expect(lesen.statusCode).toBeGreaterThanOrEqual(500);
    expect(lesen.body).not.toContain(MARKER);
  } finally {
    await w.app.close();
  }
});
