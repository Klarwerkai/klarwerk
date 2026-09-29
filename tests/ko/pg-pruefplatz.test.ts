// Der Auswahlweg der drei KO-Integrationssuiten (`./pg-pruefplatz`) — ohne Datenbank prüfbar und
// deshalb im schnellen Tor. Gemessen wird, dass eine FEHLENDE Datenbank ROT ist und nie ein Skip,
// dass eine abgelehnte URL nicht still auf Docker ausweicht und dass jede Suite ihre eigene,
// als Test erkennbare Datenbank bekommt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FEHLENDER_NACHWEIS,
  isolierterName,
  mitDatenbank,
  oeffneIsoliertePg,
} from "./pg-pruefplatz";

const SUITEN = [
  "g27-welle1-single-active-projection.integration.test.ts",
  "job2685-anhang-traeger.integration.test.ts",
  "trash-tx-pg.integration.test.ts",
] as const;

function keinContainer() {
  return vi.fn(async () => {
    throw new Error("Could not find a working container runtime strategy");
  });
}

describe("KO-PG-Prüfplatz · fehlende Ressource ist ein fehlender Nachweis", () => {
  it("ohne URL und ohne Container-Laufzeit WIRFT er — mit Grund, statt zu überspringen", async () => {
    const starter = keinContainer();
    await expect(oeffneIsoliertePg("g27", { env: {}, containerStarten: starter })).rejects.toThrow(
      `${FEHLENDER_NACHWEIS} (g27): weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit — nichts gemessen: Could not find a working container runtime strategy`,
    );
    expect(starter).toHaveBeenCalledTimes(1);
  });

  it("eine abgelehnte URL (kein „test“ im Namen) wirft und fällt NICHT auf den Container zurück", async () => {
    const starter = keinContainer();
    const env = { KLARWERK_PG_TEST_URL: "postgresql://postgres:geheim@127.0.0.1:5432/klarwerk" };
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await expect(
        oeffneIsoliertePg("job2685", { env, containerStarten: starter }),
      ).rejects.toThrow(
        `${FEHLENDER_NACHWEIS} (job2685): KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt`,
      );
    } finally {
      stderr.mockRestore();
    }
    expect(starter).not.toHaveBeenCalled();
  });

  it("eine genannte, aber nicht erreichbare Datenbank wirft — ohne Passwort in der Meldung, ohne Container", async () => {
    const starter = keinContainer();
    // Port 1 nimmt nichts an: die Verbindung scheitert sofort.
    const env = { KLARWERK_PG_TEST_URL: "postgresql://postgres:geheim@127.0.0.1:1/klarwerk_test" };
    let meldung = "";
    try {
      await oeffneIsoliertePg("trashtx", { env, containerStarten: starter });
    } catch (fehler) {
      meldung = fehler instanceof Error ? fehler.message : String(fehler);
    }
    expect(meldung).toContain(`${FEHLENDER_NACHWEIS} (trashtx): die Datenbank unter`);
    expect(meldung).toContain("postgres:***@127.0.0.1:1/klarwerk_test");
    expect(meldung).not.toContain("geheim");
    expect(starter).not.toHaveBeenCalled();
  });

  it("ohne URL, aber mit Container-Laufzeit, misst er gegen den Container und räumt ihn ab", async () => {
    const stoppen = vi.fn(async () => undefined);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const pg = await oeffneIsoliertePg("g27", {
        env: {},
        containerStarten: async () => ({
          url: "postgresql://postgres:test@localhost:55432/klarwerk_test",
          stoppen,
        }),
      });
      expect(pg.url).toBe("postgresql://postgres:test@localhost:55432/klarwerk_test");
      expect(pg.herkunft).toContain("postgres:***@localhost:55432");
      await pg.abraeumen();
    } finally {
      stderr.mockRestore();
    }
    expect(stoppen).toHaveBeenCalledTimes(1);
  });
});

describe("KO-PG-Prüfplatz · jede Suite bekommt ihre eigene Testdatenbank", () => {
  it("der Name trägt „test“, ist eindeutig und ein gültiger PostgreSQL-Bezeichner", () => {
    const a = isolierterName("job2685");
    const b = isolierterName("job2685");
    expect(a).not.toBe(b);
    for (const name of [a, b]) {
      expect(name).toContain("_test_");
      expect(name).toMatch(/^[a-z0-9_]+$/);
      expect(name.length).toBeLessThanOrEqual(63);
    }
    expect(() => isolierterName("Böse; DROP")).toThrow("kein zulässiger Namensteil");
  });

  it("nur der Datenbankname wird ersetzt — Anmeldung, Port und Socket-Abfrage bleiben", () => {
    expect(mitDatenbank("postgresql://u:p@127.0.0.1:5432/klarwerk_test", "neu_test")).toBe(
      "postgresql://u:p@127.0.0.1:5432/neu_test",
    );
    expect(mitDatenbank("postgres://u@/klarwerk_test?host=/run/pg", "neu_test")).toBe(
      "postgres://u@/neu_test?host=/run/pg",
    );
    expect(mitDatenbank("postgresql://u@127.0.0.1:5432", "neu_test")).toBe(
      "postgresql://u@127.0.0.1:5432/neu_test",
    );
  });

  it("alle drei Suiten gehen über diesen Weg — kein eigener Container, kein Skip", () => {
    for (const datei of SUITEN) {
      const text = readFileSync(join(import.meta.dirname, datei), "utf8");
      expect(text, datei).toContain('from "./pg-pruefplatz"');
      expect(text, datei).toMatch(/oeffneIsoliertePg\("[a-z0-9_]+"\)/);
      expect(text, datei).not.toContain("GenericContainer");
      expect(text, datei).not.toContain(".skip(");
    }
  });
});
