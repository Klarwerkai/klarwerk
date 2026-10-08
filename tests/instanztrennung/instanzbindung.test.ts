// ================================================================================================
// INSTANZTRENNUNG · DIE BINDUNG DATENBANK → ANLAGE, OHNE POSTGRES GEMESSEN.
// ================================================================================================
//
// R-0597 / R-0790 / R-0860: eine Firma je Instanz, die Datengrenze ist die Grenze der Anlage, und
// die Trennung ist ERZWUNGEN. Dieser Fall misst die Entscheidung von `bindeInstanz` gegen eine
// Speicherattrappe, die genau die zwei Anweisungen der Funktion nachbildet (INSERT … ON CONFLICT DO
// NOTHING, SELECT). Dass dieselben Anweisungen an echtem PostgreSQL und im echten `server.ts`-Start
// so wirken, belegt `zwei-anlagen-eine-datenbank-pg.integration.test.ts`.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  INSTANZBINDUNG_SCHEMA,
  InstanzbindungError,
  anlageAusBasisadresse,
  beurteileInstanzbindung,
  bindeInstanz,
} from "../../services/app/src/instanzbindung";

/** Nachbildung der einen Tabellenzeile; zählt die Anweisungen mit. */
function attrappe(vorhanden?: string) {
  let zeile: string | undefined = vorhanden;
  const anweisungen: string[] = [];
  const pool = {
    query: async (sql: string, werte?: unknown[]) => {
      anweisungen.push(sql.trim().split(/\s+/)[0] ?? "");
      if (/^\s*INSERT INTO instanz_bindung/.test(sql)) {
        if (zeile === undefined) {
          zeile = String(werte?.[0]);
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (/^\s*SELECT anlage FROM instanz_bindung/.test(sql)) {
        return { rowCount: zeile === undefined ? 0 : 1, rows: zeile ? [{ anlage: zeile }] : [] };
      }
      throw new Error(`unerwartete Anweisung: ${sql}`);
    },
  };
  return {
    pool: pool as unknown as Pick<Pool, "query">,
    zeile: () => zeile,
    anweisungen,
  };
}

describe("Instanztrennung · die Anlagenkennung", () => {
  it("ist der Hostname der öffentlichen Adresse — Schema und Port zählen nicht", () => {
    expect(anlageAusBasisadresse("https://Wissen.Firma-A.de")).toBe("wissen.firma-a.de");
    expect(anlageAusBasisadresse("http://wissen.firma-a.de:8080/pfad")).toBe("wissen.firma-a.de");
    expect(anlageAusBasisadresse("  http://127.0.0.1:3002  ")).toBe("127.0.0.1");
  });

  it("fehlt oder ist unlesbar → keine Kennung (es wird dann nicht gebunden)", () => {
    expect(anlageAusBasisadresse(undefined)).toBeUndefined();
    expect(anlageAusBasisadresse("   ")).toBeUndefined();
    expect(anlageAusBasisadresse("kein-url")).toBeUndefined();
  });
});

describe("Instanztrennung · bindeInstanz", () => {
  it("erster Start bindet die Datenbank an diese Anlage", async () => {
    const a = attrappe();
    await expect(bindeInstanz(a.pool, "https://wissen.firma-a.de")).resolves.toEqual({
      art: "gebunden",
      anlage: "wissen.firma-a.de",
    });
    expect(a.zeile()).toBe("wissen.firma-a.de");
  });

  it("derselbe Hostname startet weiter — auch mit anderem Schema oder Port", async () => {
    const a = attrappe("wissen.firma-a.de");
    await expect(bindeInstanz(a.pool, "http://wissen.firma-a.de:3001")).resolves.toEqual({
      art: "passt",
      anlage: "wissen.firma-a.de",
    });
  });

  it("eine ANDERE Anlage gegen dieselbe Datenbank wird abgewiesen, die Bindung bleibt stehen", async () => {
    const a = attrappe("wissen.firma-a.de");
    const versuch = bindeInstanz(a.pool, "https://wissen.firma-b.de");
    await expect(versuch).rejects.toBeInstanceOf(InstanzbindungError);
    await expect(versuch).rejects.toThrow(/firma-a\.de.*firma-b\.de/);
    expect(a.zeile()).toBe("wissen.firma-a.de");
  });

  it("die Meldung nennt den Ausweg und keinen Verbindungswert", async () => {
    const fehler = new InstanzbindungError("wissen.firma-a.de", "wissen.firma-b.de");
    expect(fehler.message).toContain("eigene DATABASE_URL");
    expect(fehler.message).toContain("DELETE FROM instanz_bindung");
    expect(fehler.message).not.toMatch(/postgres(ql)?:\/\//);
  });

  it("ohne APP_BASE_URL wird die Datenbank weder gebunden noch befragt", async () => {
    const a = attrappe();
    await expect(bindeInstanz(a.pool, undefined)).resolves.toEqual({ art: "ohne_adresse" });
    expect(a.anweisungen).toEqual([]);
    expect(a.zeile()).toBeUndefined();
  });

  it("eine nach dem Binden leere Tabelle gilt nicht als „passt“", async () => {
    const pool = {
      query: async () => ({ rowCount: 0, rows: [] }),
    } as unknown as Pick<Pool, "query">;
    await expect(bindeInstanz(pool, "https://wissen.firma-a.de")).rejects.toThrow(/nicht lesbar/);
  });

  it("die reine Entscheidung unterscheidet neu gebunden, passend und fremd", () => {
    expect(beurteileInstanzbindung("a.de", "a.de", true)).toEqual({
      art: "gebunden",
      anlage: "a.de",
    });
    expect(beurteileInstanzbindung("a.de", "a.de", false)).toEqual({
      art: "passt",
      anlage: "a.de",
    });
    expect(beurteileInstanzbindung("a.de", "b.de", false)).toEqual({
      art: "fremd",
      gebunden: "a.de",
      aktuell: "b.de",
    });
  });

  it("das Schema erlaubt genau eine Zeile", () => {
    expect(INSTANZBINDUNG_SCHEMA).toMatch(
      /einzig boolean PRIMARY KEY DEFAULT true CHECK \(einzig\)/,
    );
    expect(INSTANZBINDUNG_SCHEMA).toMatch(/CREATE TABLE IF NOT EXISTS instanz_bindung/);
  });
});
