// Der Auswahlweg der drei KO-Integrationssuiten (`./pg-pruefplatz`) — ohne Datenbank prüfbar und
// deshalb im schnellen Tor. Gemessen wird, dass eine FEHLENDE Datenbank ROT ist und nie ein Skip,
// dass eine abgelehnte URL nicht still auf Docker ausweicht und dass jede Suite ihre eigene,
// als Test erkennbare Datenbank bekommt.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FEHLENDER_NACHWEIS,
  isolierterName,
  mitDatenbank,
  oeffneIsoliertePg,
  ohneGeheimnis,
} from "./pg-pruefplatz";

// Der Parser, den `pg` selbst benutzt — aufgelöst von `pg` aus, nicht als eigene Abhängigkeit. An
// ihm wird gemessen, was eine Adresse WIRKLICH als Passwort trägt (BEN Runde 1, B1).
const vonPg = createRequire(createRequire(import.meta.url).resolve("pg"));
const { parse: pgParse } = vonPg("pg-connection-string") as {
  parse: (url: string) => { password?: string | null };
};

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

// ================================================================================================
// BEN RUNDE 1 · B1 — KEIN PASSWORT IN HERKUNFT, STDERR ODER FEHLERMELDUNG, IN KEINER PARSERFORM.
// ================================================================================================
// Jede Form wird zuerst am echten Parser gemessen: trägt sie WIRKLICH das Passwort? Erst dann zählt
// die Aussage, dass die Maskierung es entfernt. Die Passwörter sind synthetisch.
const PASSWORTFORMEN: readonly { was: string; url: string; passwort: string }[] = [
  {
    was: "Anmeldedaten vor @",
    url: "postgresql://postgres:Sq7-geheim@127.0.0.1:5432/klarwerk_test",
    passwort: "Sq7-geheim",
  },
  {
    was: "Abfrageparameter password",
    url: "postgresql://postgres@127.0.0.1:5432/klarwerk_test?password=Qx9-geheim",
    passwort: "Qx9-geheim",
  },
  {
    was: "password hinter anderem Parameter",
    url: "postgresql://postgres@127.0.0.1:5432/klarwerk_test?sslmode=disable&password=Wz4-geheim",
    passwort: "Wz4-geheim",
  },
  {
    was: "prozentkodierter Schlüssel p%61ssword",
    url: "postgresql://postgres@127.0.0.1:5432/klarwerk_test?p%61ssword=Kv2-geheim",
    passwort: "Kv2-geheim",
  },
  {
    was: "Socket-Adresse mit password-Parameter",
    url: "postgres://postgres@/klarwerk_test?host=/run/pg&password=Hm3-geheim",
    passwort: "Hm3-geheim",
  },
  {
    was: "unkodiertes @ im Passwort",
    url: "postgresql://postgres:Rt5@geheim@127.0.0.1:5432/klarwerk_test",
    passwort: "Rt5@geheim",
  },
  {
    was: "prozentkodiertes Passwort vor @",
    url: "postgresql://postgres:Lp8%40geheim@127.0.0.1:5432/klarwerk_test",
    passwort: "Lp8@geheim",
  },
];

/** Enthält der Text das Passwort in irgendeiner Schreibung, die in einer Adresse vorkommt? */
function traegt(text: string, passwort: string): boolean {
  return [passwort, encodeURIComponent(passwort), passwort.split("@")[1] ?? passwort].some((teil) =>
    text.includes(teil),
  );
}

/** Eine Verwaltung ohne Datenbank, die jeden Aufruf mitschreibt. */
function scheinVerwaltung(verhalten: (sql: string) => Promise<unknown> = async () => ({})) {
  const aufrufe: string[] = [];
  const end = vi.fn(async () => undefined);
  return {
    aufrufe,
    end,
    oeffnen: () => ({
      query: async (sql: string) => {
        aufrufe.push(sql);
        return verhalten(sql);
      },
      end,
    }),
  };
}

describe("KO-PG-Prüfplatz · B1 · das Passwort erscheint nirgends", () => {
  for (const form of PASSWORTFORMEN) {
    it(`${form.was}: der echte Parser liest ein Passwort, die Maskierung zeigt es nicht`, () => {
      expect(pgParse(form.url).password).toBe(form.passwort);
      const maskiert = ohneGeheimnis(form.url);
      expect(traegt(maskiert, form.passwort), maskiert).toBe(false);
      expect(maskiert).toContain("***");
      expect(maskiert).toContain("klarwerk_test");
    });

    it(`${form.was}: weder herkunft noch die stderr-Bereitschaftsmeldung tragen es`, async () => {
      const schein = scheinVerwaltung();
      const geschrieben: string[] = [];
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation((text) => {
        geschrieben.push(String(text));
        return true;
      });
      try {
        const pg = await oeffneIsoliertePg("b1", {
          env: { KLARWERK_PG_TEST_URL: form.url },
          verwaltungOeffnen: schein.oeffnen,
        });
        expect(traegt(pg.herkunft, form.passwort), pg.herkunft).toBe(false);
        // Die Verbindung selbst behält das Passwort — sonst könnte die Suite sich nicht anmelden.
        expect(pgParse(pg.url).password).toBe(form.passwort);
        await pg.abraeumen();
      } finally {
        stderr.mockRestore();
      }
      const alles = geschrieben.join("");
      expect(alles).toContain("KO-PG-Prüfplatz (b1): bereit");
      expect(traegt(alles, form.passwort), alles).toBe(false);
    });

    it(`${form.was}: die Meldung „nicht erreichbar" trägt es nicht — auch nicht aus dem Fehlergrund`, async () => {
      const schein = scheinVerwaltung(async () => {
        throw new Error(`Verbindung abgelehnt für ${form.url} (Passwort ${form.passwort})`);
      });
      let meldung = "";
      try {
        await oeffneIsoliertePg("b1", {
          env: { KLARWERK_PG_TEST_URL: form.url },
          verwaltungOeffnen: schein.oeffnen,
        });
      } catch (fehler) {
        meldung = fehler instanceof Error ? fehler.message : String(fehler);
      }
      expect(meldung).toContain(`${FEHLENDER_NACHWEIS} (b1): die Datenbank unter`);
      expect(traegt(meldung, form.passwort), meldung).toBe(false);
      expect(schein.end).toHaveBeenCalledTimes(1);
    });
  }

  it("eine Adresse ohne schema:// wird gar nicht wiedergegeben", () => {
    expect(ohneGeheimnis("host=127.0.0.1 password=Zz1-geheim")).toBe(
      "(Verbindungsadresse nicht darstellbar)",
    );
  });

  it("ohne Passwort bleibt die Adresse lesbar — Host, Port, Datenbank und harmlose Parameter", () => {
    expect(ohneGeheimnis("postgres://u@/klarwerk_test?host=/run/pg&sslmode=disable")).toBe(
      "postgres://u:***@/klarwerk_test?host=/run/pg&sslmode=disable",
    );
    expect(ohneGeheimnis("postgresql://127.0.0.1:5432/klarwerk_test")).toBe(
      "postgresql://127.0.0.1:5432/klarwerk_test",
    );
  });
});

// ================================================================================================
// BEN RUNDE 1 · B2 — DER VERWALTUNGSPOOL WIRD AUCH BEI GESCHEITERTER ANLAGE GESCHLOSSEN.
// ================================================================================================
describe("KO-PG-Prüfplatz · B2 · kein offener Verwaltungspool", () => {
  const URL_OHNE_GEHEIMNIS = "postgresql://postgres@127.0.0.1:5432/klarwerk_test";

  it("SELECT 1 gelingt, CREATE DATABASE scheitert: derselbe Fehler fliegt, end() genau einmal", async () => {
    const abgewiesen = new Error("permission denied to create database");
    const schein = scheinVerwaltung(async (sql) => {
      if (sql.startsWith("CREATE DATABASE")) {
        throw abgewiesen;
      }
      return {};
    });
    await expect(
      oeffneIsoliertePg("b2", {
        env: { KLARWERK_PG_TEST_URL: URL_OHNE_GEHEIMNIS },
        verwaltungOeffnen: schein.oeffnen,
      }),
    ).rejects.toBe(abgewiesen);
    expect(schein.aufrufe[0]).toBe("SELECT 1");
    expect(schein.aufrufe[1]).toMatch(
      /^CREATE DATABASE klarwerk_ko_b2_test_\w+ TEMPLATE template0$/,
    );
    expect(schein.end).toHaveBeenCalledTimes(1);
  });

  it("gelingt die Anlage, schließt erst abraeumen() den Pool — nach dem DROP, genau einmal", async () => {
    const schein = scheinVerwaltung();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const pg = await oeffneIsoliertePg("b2", {
        env: { KLARWERK_PG_TEST_URL: URL_OHNE_GEHEIMNIS },
        verwaltungOeffnen: schein.oeffnen,
      });
      expect(schein.end).not.toHaveBeenCalled();
      await pg.abraeumen();
    } finally {
      stderr.mockRestore();
    }
    const name = /^CREATE DATABASE (\w+) /.exec(schein.aufrufe[1] ?? "")?.[1];
    expect(name).toBeDefined();
    // Nacharbeit 33: erst wird gefragt, ob noch Sitzungen auf der Datenbank stehen (der Schein
    // antwortet ohne Zeilen = keine), dann gelöscht.
    expect(schein.aufrufe[2]).toBe(
      `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = '${name}'`,
    );
    expect(schein.aufrufe[3]).toBe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    expect(schein.end).toHaveBeenCalledTimes(1);
  });

  it("scheitert auch das DROP beim Abräumen, wird der Pool trotzdem geschlossen", async () => {
    const schein = scheinVerwaltung(async (sql) => {
      if (sql.startsWith("DROP DATABASE")) {
        throw new Error("DROP abgewiesen");
      }
      return {};
    });
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const pg = await oeffneIsoliertePg("b2", {
        env: { KLARWERK_PG_TEST_URL: URL_OHNE_GEHEIMNIS },
        verwaltungOeffnen: schein.oeffnen,
      });
      await expect(pg.abraeumen()).rejects.toThrow("DROP abgewiesen");
    } finally {
      stderr.mockRestore();
    }
    expect(schein.end).toHaveBeenCalledTimes(1);
  });
});
