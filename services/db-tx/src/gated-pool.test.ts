import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
// Über die öffentliche index.ts des Reasoner-Moduls — die Modulgrenze gilt auch für Tests.
import { PgAssistPresetRepo } from "../../reasoner";
import { BestandsresetLaeuftError, gatedPool } from "./gated-pool";
import { SPERRSCHLUESSEL_BESTANDSRESET } from "./reset-lock";

// ================================================================================================
// JOB 596 — DIE KAPSELUNG UNTER TEST.
// ================================================================================================
//
// AUSDRÜCKLICHE REICHWEITENGRENZE DIESER DATEI. Alle Fälle laufen gegen ein Postgres-DOPPEL, das
// drei Eigenschaften nachbildet: die Transaktionsklammer, transaktionsgebundene Advisory-Sperren
// und ein Protokoll je Verbindung. BEWIESEN ist damit die LOGIK DIESER SCHICHT — Reihenfolge,
// Verbindungsbindung, Ablehnungsweg, Rollbacksemantik, Privilegierung.
//
// NICHT BEWIESEN ist, dass PostgreSQL sich verhält wie das Doppel. Dass Advisory-Sperren
// datenbankweit gelten und beim Transaktionsende serverseitig freigegeben werden, ist
// dokumentiertes Postgres-Verhalten und bleibt bis zu einem Integrationslauf eine UNBEWIESENE
// HYPOTHESE (Regelwerk Z. 493). Der zugehörige Integrationstest liegt in
// `gated-pool.integration.test.ts`; er läuft gegen echtes Postgres und ist der Ort, an dem diese
// Grenze fällt.

const SCHLUESSEL = String(SPERRSCHLUESSEL_BESTANDSRESET);

interface Doppel {
  pool: Pool;
  protokoll: string[];
  resetLaeuft: { wert: boolean };
}

// Das Doppel protokolliert jede Anweisung MIT der Verbindung, auf der sie lief. Die
// Verbindungskennung ist tragend und nicht Zierrat: Eine Sperre auf Verbindung A schützt eine
// Mutation auf Verbindung B in keiner Weise.
function poolDoppel(): Doppel {
  const protokoll: string[] = [];
  const resetLaeuft = { wert: false };
  let clientZaehler = 0;

  const antwort = (text: string) => {
    if (text.includes("pg_try_advisory")) {
      // Läuft ein exklusiver Reset, bekommt die geteilte Sperre niemand mehr.
      return { rows: [{ erworben: !resetLaeuft.wert }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  // D8: Das Doppel nimmt BEIDE Anweisungsformen entgegen — Text und Konfigurationsobjekt. Vorher
  // kannte es nur den String; ein `{ text, values }` wäre als `undefined` ins Protokoll gelaufen und
  // hätte die Lücke, um die es hier geht, unsichtbar gemacht.
  const alsText = (befehl: string | { text: string }): string =>
    typeof befehl === "string" ? befehl : befehl.text;

  const pool = {
    query: async (befehl: string | { text: string }) => {
      protokoll.push(`pool | ${alsText(befehl)}`);
      return antwort(alsText(befehl));
    },
    connect: async () => {
      const nr = ++clientZaehler;
      return {
        query: async (befehl: string | { text: string }) => {
          protokoll.push(`c${nr} | ${alsText(befehl)}`);
          return antwort(alsText(befehl));
        },
        release: () => {
          protokoll.push(`c${nr} | RELEASE`);
        },
      };
    },
  };

  return { pool: pool as unknown as Pool, protokoll, resetLaeuft };
}

// Die Anweisungen einer Verbindung, in ihrer Reihenfolge — ohne die Verbindungskennung.
function spur(protokoll: string[], verbindung: string): string[] {
  return protokoll
    .filter((zeile) => zeile.startsWith(`${verbindung} | `))
    .map((zeile) => zeile.slice(verbindung.length + 3));
}

describe("A2 — der Sperrweg ist transaktional korrekt und ohne Modusumschalter", () => {
  it("A2-Ordnung: BEGIN → Sperre → Nutzanweisung → COMMIT, in genau dieser Folge", async () => {
    const { pool, protokoll } = poolDoppel();

    await gatedPool(pool).query("UPDATE t SET a=1");

    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "UPDATE t SET a=1",
      "COMMIT",
      "RELEASE",
    ]);
  });

  it("A2-Ablehnung: läuft ein Reset, ist der Weg BEGIN → Sperre → ROLLBACK — die Nutzanweisung wird NIE abgesetzt", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;

    await expect(gatedPool(pool).query("UPDATE t SET a=1")).rejects.toBeInstanceOf(
      BestandsresetLaeuftError,
    );

    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "ROLLBACK",
      "RELEASE",
    ]);
    expect(protokoll.some((zeile) => zeile.includes("UPDATE"))).toBe(false);
  });

  it("A2-kein-READ-ONLY: im gesamten Protokoll kommt weder SET TRANSACTION noch READ ONLY vor", async () => {
    // Der D4-Entwurf wollte einen abgewiesenen Schreiber auf READ ONLY herabstufen. Das ist nach
    // der ersten Anweisung einer Transaktion nicht mehr möglich — und der Fall „Schreiber läuft
    // herabgestuft weiter" kann hier gar nicht erst entstehen: abgewiesen heißt abgewiesen.
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    await gatedPool(pool).query("SELECT 1");
    resetLaeuft.wert = true;
    await gatedPool(pool)
      .query("SELECT 1")
      .catch(() => undefined);

    const alles = protokoll.join("\n");
    expect(alles).not.toContain("SET TRANSACTION");
    expect(alles).not.toContain("READ ONLY");
  });

  it("genau EIN ROLLBACK, wenn die Nutzanweisung selbst scheitert", async () => {
    const protokoll: string[] = [];
    const pool = {
      connect: async () => ({
        query: async (text: string) => {
          protokoll.push(text);
          if (text.includes("pg_try_advisory")) {
            return { rows: [{ erworben: true }], rowCount: 1 };
          }
          if (text.startsWith("UPDATE")) {
            throw new Error("Verbindung verloren");
          }
          return { rows: [], rowCount: 0 };
        },
        release: () => undefined,
      }),
    } as unknown as Pool;

    await expect(gatedPool(pool).query("UPDATE t SET a=1")).rejects.toThrow("Verbindung verloren");
    expect(protokoll.filter((t) => t === "ROLLBACK")).toHaveLength(1);
    expect(protokoll).not.toContain("COMMIT");
  });
});

describe("A3 — Sperre und Nutzanweisung teilen dieselbe Verbindung", () => {
  it("A3-Bindung: Sperrabfrage und Mutation tragen dieselbe Verbindungskennung", async () => {
    const { pool, protokoll } = poolDoppel();

    await gatedPool(pool).query("UPDATE t SET a=1");

    const kennung = (zeile: string) => zeile.split(" | ")[0];
    const sperre = protokoll.find((z) => z.includes(SCHLUESSEL));
    const mutation = protokoll.find((z) => z.includes("UPDATE"));
    expect(sperre).toBeDefined();
    expect(mutation).toBeDefined();
    expect(kennung(sperre as string)).toBe(kennung(mutation as string));
  });

  it("zwei Einzelqueries laufen auf getrennten Verbindungen — jede mit eigener Sperre", async () => {
    const { pool, protokoll } = poolDoppel();
    const gated = gatedPool(pool);

    await gated.query("UPDATE t SET a=1");
    await gated.query("UPDATE t SET a=2");

    expect(spur(protokoll, "c1")).toContain("UPDATE t SET a=1");
    expect(spur(protokoll, "c2")).toContain("UPDATE t SET a=2");
    expect(protokoll.filter((z) => z.includes(SCHLUESSEL))).toHaveLength(2);
  });

  it("A3-Mehrquery: eine selbst geführte Transaktion bekommt die Sperre als ERSTE Anweisung", async () => {
    const { pool, protokoll } = poolDoppel();
    const client = await gatedPool(pool).connect();

    await client.query("BEGIN");
    await client.query("DELETE FROM t");
    await client.query("COMMIT");
    client.release();

    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "DELETE FROM t",
      "COMMIT",
      "RELEASE",
    ]);
  });

  it("A3-Mehrquery-Ablehnung: bei laufendem Reset scheitert schon das BEGIN; die Nutzanweisung läuft nie", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;
    const client = await gatedPool(pool).connect();

    await expect(client.query("BEGIN")).rejects.toBeInstanceOf(BestandsresetLaeuftError);

    expect(protokoll.some((z) => z.includes("DELETE"))).toBe(false);
  });

  it("R1: der ROHE Pool bleibt unbeschränkt — der Reset blockiert sich nicht selbst", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;

    // Genau der Weg, den der Orchestrator nimmt: am gesperrten Pool vorbei.
    await pool.query("DELETE FROM t");

    expect(protokoll).toEqual(["pool | DELETE FROM t"]);
  });

  it("R3-Freigabe: nach dem Ende des Resets geht dieselbe Mutation wieder durch", async () => {
    const { pool, resetLaeuft } = poolDoppel();
    const gated = gatedPool(pool);

    resetLaeuft.wert = true;
    await expect(gated.query("UPDATE t SET a=1")).rejects.toBeInstanceOf(BestandsresetLaeuftError);

    resetLaeuft.wert = false;
    await expect(gated.query("UPDATE t SET a=1")).resolves.toBeDefined();
  });
});

// ================================================================================================
// M — DIE ROLLBACKSEMANTIK DES MEHRQUERY-WEGES (BEN D5, Auflage 2).
// ================================================================================================
//
// Wörtlich gerügt: „Bei bestehenden Mehrquery-Aufrufern rollt die Hülle nach einer beim `BEGIN`
// verweigerten Sperre bereits zurück; deren eigener Catch kann anschließend ein zweites `ROLLBACK`
// senden. Auch dieser reale Aufruferweg fehlt in den Tests."
//
// Er fehlt hier nicht mehr — und M2 fährt ihn nicht nachgebaut, sondern mit dem echten Aufrufer
// aus dem Produktcode.
describe("M — der Mehrquery-Aufrufer sendet genau EIN ROLLBACK", () => {
  it("M1: der eigene Fang des Aufrufers erreicht die Datenbank nicht ein zweites Mal", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;
    const client = await gatedPool(pool).connect();

    // Wortgleich der Bestandsvertrag der vier realen Aufrufer dieses Standes.
    let gefangen: unknown;
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM t");
      await client.query("COMMIT");
    } catch (fehler) {
      gefangen = fehler;
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    expect(gefangen).toBeInstanceOf(BestandsresetLaeuftError);
    expect(spur(protokoll, "c1").filter((t) => t === "ROLLBACK")).toHaveLength(1);
  });

  it("M2: derselbe Nachweis mit dem ECHTEN Aufrufer PgAssistPresetRepo.replaceAll", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;
    const repo = new PgAssistPresetRepo(gatedPool(pool));

    await expect(
      repo.replaceAll([{ id: "p1", name: "N", instruction: "I" }]),
    ).rejects.toBeInstanceOf(BestandsresetLaeuftError);

    // Der Aufrufer behält seinen Fang unverändert — sein Vertrag bleibt gültig. Die Datenbank
    // sieht trotzdem genau ein ROLLBACK.
    expect(spur(protokoll, "c1").filter((t) => t === "ROLLBACK")).toHaveLength(1);
    expect(protokoll.some((z) => z.includes("DELETE FROM assist_presets"))).toBe(false);
  });

  it("M3: auch ein COMMIT des Aufrufers nach dem abgewiesenen BEGIN erreicht die Datenbank nicht", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;
    const client = await gatedPool(pool).connect();

    await client.query("BEGIN").catch(() => undefined);
    await client.query("COMMIT");

    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "ROLLBACK",
    ]);
  });

  it("M4: die Verbindung bleibt benutzbar — ein neues BEGIN nach der Freigabe läuft normal", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    resetLaeuft.wert = true;
    const client = await gatedPool(pool).connect();

    await client.query("BEGIN").catch(() => undefined);
    await client.query("ROLLBACK"); // wirkungslos, die Hülle hat schon aufgeräumt

    resetLaeuft.wert = false;
    await client.query("BEGIN");
    await client.query("UPDATE t SET a=1");
    await client.query("COMMIT");

    // Der Zustand ist nicht dauerhaft verklemmt: das zweite COMMIT erreicht die Datenbank.
    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "ROLLBACK",
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "UPDATE t SET a=1",
      "COMMIT",
    ]);
  });

  it("M5: ein ROLLBACK ohne jede Transaktion erreicht die Datenbank ebenfalls nicht", async () => {
    const { pool, protokoll } = poolDoppel();
    const client = await gatedPool(pool).connect();

    await client.query("ROLLBACK");

    expect(spur(protokoll, "c1")).toEqual([]);
  });

  // ==============================================================================================
  // M6 — ZUGESCHNITTEN AUF SEINE KLASSIFIKATIONSAUSSAGE (BEN D7, Auflage 2).
  // ==============================================================================================
  //
  // WAS D7 HIER FALSCH GEMACHT HAT, in einem Satz: Der Fall behauptete eine Aussage über die
  // ERKENNUNG (`DO $$ BEGIN … END $$` ist kein Transaktionsstart), prüfte aber eine ganz andere —
  // nämlich dass die Anweisung völlig UNGEKLAMMERT durchläuft (`toEqual([<die Anweisung>])`).
  //
  // Diese zweite, ungewollte Hälfte war der Konflikt: Sobald die Hülle eine nackte Nutzanweisung
  // klammert (Fall P), musste M6 fallen — und ein grüner M6 hätte umgekehrt genau den
  // ungesperrten Mutationsweg festgeschrieben, den die Ownerentscheidung ausschließt. Von den zwei
  // möglichen Auflösungen (die Klammer aufgeben oder den Fall zuschneiden) ist nur die zweite
  // zulässig: Die Klammer IST die Zusage.
  //
  // WAS BLEIBT, ist die ursprünglich behauptete Aussage — und sie wird jetzt SCHÄRFER geprüft als
  // vorher. Der Beweis, dass die Anweisung nicht als Transaktionseröffnung gelesen wurde, liegt
  // nicht im Fehlen einer Klammer, sondern im ZUSTAND danach: Hätte `steueranweisung()` sie als
  // `BEGIN` klassifiziert, wäre `transaktionOffen` gesetzt, und ein folgendes COMMIT des Aufrufers
  // erreichte die Datenbank. Genau das darf nicht passieren.
  it("M6: ein BEGIN innerhalb eines größeren Anweisungstextes ist KEINE Transaktionseröffnung", async () => {
    const { pool, protokoll } = poolDoppel();
    const client = await gatedPool(pool).connect();

    await client.query("DO $$ BEGIN PERFORM 1; END $$");

    const spurNachDo = spur(protokoll, "c1");
    // 1. Sie lief als NUTZANWEISUNG in der eigenen Klammer der Hülle — nicht als deren Auslöser.
    expect(spurNachDo).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "DO $$ BEGIN PERFORM 1; END $$",
      "COMMIT",
    ]);
    // 2. Genau EIN BEGIN. Wäre die Anweisung als Transaktionsstart gelesen worden, stünde hier ein
    //    zweites — die Hülle hätte dann ihre eigene Klammer UND den vermeintlichen Start.
    expect(spurNachDo.filter((z) => z === "BEGIN")).toHaveLength(1);

    // 3. DER EIGENTLICHE BEWEIS: Der Aufrufer glaubt, in einer Transaktion zu sein, und committet.
    //    Die DO-Anweisung hat aber keine eröffnet — das COMMIT trifft auf nichts und darf die
    //    Datenbank nicht erreichen. Nach einer Fehlklassifikation als BEGIN wäre es dort gelandet.
    await client.query("COMMIT");
    expect(spur(protokoll, "c1")).toEqual(spurNachDo);
  });
});

// ================================================================================================
// K — DIE KONFIGURATIONSOBJEKT-FORM (BEN D7, Prüflücke 1).
// ================================================================================================
//
// Wörtlich gerügt: „eine Mutation über `client.query({ text, values })` während gehaltener
// Resetsperre senden; erwartet ist, dass sie die Datenbank nicht erreicht, während derselbe Aufruf
// ohne Reset funktioniert."
//
// DIE LÜCKE WAR REAL UND STAND IM QUELLTEXT. Bis D7 hieß es in `gated-pool.ts`: „In den 25
// Pg-Adaptern dieses Standes kommt sie nicht vor; sie wird deshalb behandelt wie eine
// Nutzanweisung: durch, aber ohne Zustandswechsel." Das erste Halbsatz-Argument stimmt und trägt
// trotzdem nicht: Eine Kapselung, die nur hält, solange niemand eine zweite gültige Aufrufform
// benutzt, ist keine Kapselung, sondern eine Verabredung. `client.query({text, values})` ist die
// dokumentierte pg-Form; sie hier durchzulassen hieß, neben der gesperrten Fläche einen offenen
// Weg in dieselbe Datenbank stehen zu lassen.
describe("K — die Konfigurationsobjekt-Form läuft nicht am Gate vorbei", () => {
  it("K1: läuft ein Reset, erreicht client.query({text,values}) die Datenbank NICHT", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const client = await gatedPool(pool).connect();
    resetLaeuft.wert = true;

    await expect(
      client.query({ text: "UPDATE t SET a=$1 WHERE id=$2", values: [1, 2] }),
    ).rejects.toBeInstanceOf(BestandsresetLaeuftError);

    // Die Nutzanweisung steht NICHT in der Spur — sie wurde nie abgesetzt.
    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "ROLLBACK",
    ]);
  });

  it("K2: die Sperre ist auch hier die ERSTE Anweisung und liegt auf derselben Verbindung", async () => {
    const { pool, protokoll } = poolDoppel();
    const client = await gatedPool(pool).connect();

    await client.query({ text: "UPDATE t SET a=1", values: [] });

    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "UPDATE t SET a=1",
      "COMMIT",
    ]);
  });

  it("K3 — Kalibrierung: ohne laufenden Reset geht derselbe Aufruf durch", async () => {
    // Ohne diesen Fall wäre K1 auch von einer Hülle erfüllt, die die Objektform IMMER abweist —
    // also von einer kaputten. Erst die Kalibrierung macht aus K1 eine Aussage über den Reset.
    const { pool, resetLaeuft } = poolDoppel();
    const client = await gatedPool(pool).connect();
    resetLaeuft.wert = false;

    await expect(client.query({ text: "UPDATE t SET a=$1", values: [7] })).resolves.toBeDefined();
  });

  it("K4: auch die Objektform hebt COMMIT/ROLLBACK des Aufrufers nicht aus den Angeln", async () => {
    // Die Objektform ist eine NUTZANWEISUNG, keine Transaktionssteuerung. Nach ihrer eigenen,
    // sofort geschlossenen Klammer ist keine Transaktion mehr offen — ein COMMIT des Aufrufers
    // trifft deshalb auf nichts und darf die Datenbank nicht erreichen.
    const { pool, protokoll } = poolDoppel();
    const client = await gatedPool(pool).connect();

    await client.query({ text: "UPDATE t SET a=1", values: [] });
    await client.query("COMMIT");

    expect(spur(protokoll, "c1").filter((z) => z === "COMMIT")).toHaveLength(1);
  });
});

// ================================================================================================
// LV — DER EINE LESEVERTRAG, FÜR ALLE POOLZUGÄNGE GLEICH (BEN D7, Auflage 1 / Prüflücke 2).
// ================================================================================================
//
// WAS SICH GEGENÜBER D7 GEÄNDERT HAT — und warum die alten Fälle L1–L3 nicht bleiben durften:
//
// L1–L3 hielten fest, was der Stand TUT, und nannten die Frage ausdrücklich offen. BEN hat das als
// Verstoß gewertet, und zu Recht: Ein Test, der einen unentschiedenen Zustand grün festschreibt,
// macht die Entscheidung teurer, statt sie vorzubereiten — beim nächsten Umbau fällt er, und
// niemand weiß dann, ob das ein Fehler oder die beabsichtigte Entscheidung war.
//
// OV-8 IST JETZT ENTSCHIEDEN (schriftlich in `gated-pool.ts`, Abschnitt „ENTSCHEIDUNG OV-8"):
// Lesezugriffe werden während eines Bestandsresets MIT abgewiesen. Diese Fälle prüfen nicht mehr
// den Ist-Zustand, sondern den BESCHLOSSENEN Vertrag — und zwar für JEDE der fünf Zugangsformen
// dieselbe Aussage. Genau das verlangt die Auflage: „genau einen neutralen, widerspruchsfreien
// Lesevertrag für ALLE Poolzugänge".
//
// DASS ES FÜNF FORMEN SIND UND NICHT ZWEI, ist der Kern. In D7 war der Vertrag nur für zwei davon
// geprüft; die Objektform lief ungesperrt durch (s. K). Ein Vertrag, der für vier Formen gilt und
// für die fünfte nicht, ist kein Vertrag.
interface Zugang {
  readonly name: string;
  readonly lesen: (pool: Pool) => Promise<unknown>;
}

const LESEZUGAENGE: readonly Zugang[] = [
  {
    name: "pool.query(Text)",
    lesen: (pool) => gatedPool(pool).query("SELECT a FROM t"),
  },
  {
    name: "pool.query(Objekt)",
    lesen: (pool) => gatedPool(pool).query({ text: "SELECT a FROM t", values: [] }),
  },
  {
    name: "connect().query(Text) ohne eigenes BEGIN",
    lesen: async (pool) => (await gatedPool(pool).connect()).query("SELECT a FROM t"),
  },
  {
    name: "connect().query(Objekt) ohne eigenes BEGIN",
    lesen: async (pool) =>
      (await gatedPool(pool).connect()).query({ text: "SELECT a FROM t", values: [] }),
  },
  {
    name: "connect() mit eigenem BEGIN",
    lesen: async (pool) => {
      const client = await gatedPool(pool).connect();
      await client.query("BEGIN");
      return client.query("SELECT a FROM t");
    },
  },
];

describe("LV — der beschlossene Lesevertrag gilt für jeden Poolzugang gleich (OV-8)", () => {
  for (const zugang of LESEZUGAENGE) {
    it(`LV-Sperre · ${zugang.name}: während eines Resets wird das Lesen abgewiesen`, async () => {
      const { pool, resetLaeuft } = poolDoppel();
      resetLaeuft.wert = true;

      await expect(zugang.lesen(pool)).rejects.toBeInstanceOf(BestandsresetLaeuftError);
    });

    it(`LV-Freigabe · ${zugang.name}: ohne Reset läuft es, und die Sperre ist die erste Anweisung`, async () => {
      // Die Kalibrierungshälfte. Ohne sie wäre „abgewiesen" auch von einer Hülle erfüllt, die
      // grundsätzlich alles abweist — und der Vertrag sagte nichts über den Reset aus.
      const { pool, protokoll } = poolDoppel();

      await expect(zugang.lesen(pool)).resolves.toBeDefined();

      const spurC1 = spur(protokoll, "c1");
      expect(spurC1[0]).toBe("BEGIN");
      expect(spurC1[1]).toContain(SCHLUESSEL);
      // Und die Nutzanweisung kommt NACH der Sperre — nie davor.
      expect(spurC1.indexOf("SELECT a FROM t")).toBeGreaterThan(1);
    });
  }

  it("LV-Preis: der Vertrag kostet jeden Lesezugriff eine Transaktionsklammer — benannt, nicht versteckt", async () => {
    // Der Preis der Entscheidung, als Test und nicht als Fußnote. Ein reiner SELECT, der ohne die
    // Hülle EINE Anweisung wäre, sendet mit ihr VIER. Wer diese Zahl senken will, ändert den
    // Vertrag und bricht diesen Fall — das ist beabsichtigt.
    const { pool, protokoll } = poolDoppel();

    await gatedPool(pool).query("SELECT a FROM t WHERE id=$1");

    expect(spur(protokoll, "c1")).toEqual([
      "BEGIN",
      expect.stringContaining(SCHLUESSEL),
      "SELECT a FROM t WHERE id=$1",
      "COMMIT",
      "RELEASE",
    ]);
  });
});

describe("die Hülle erhält den Rest des Pools und des Clients unverändert", () => {
  it("release, end und Zusatzfähigkeiten bleiben erreichbar und wirksam", async () => {
    let freigegeben = false;
    let beendet = false;
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => ({
        query: async (text: string) =>
          text.includes("pg_try_advisory")
            ? { rows: [{ erworben: true }], rowCount: 1 }
            : { rows: [], rowCount: 0 },
        release: () => {
          freigegeben = true;
        },
        escapeIdentifier: (wert: string) => `"${wert}"`,
      }),
      end: async () => {
        beendet = true;
      },
      totalCount: 7,
    } as unknown as Pool;

    const gated = gatedPool(pool);
    const client = (await gated.connect()) as PoolClient & { escapeIdentifier(w: string): string };

    expect(client.escapeIdentifier("a b")).toBe('"a b"');
    client.release();
    expect(freigegeben).toBe(true);

    expect(gated.totalCount).toBe(7);
    await gated.end();
    expect(beendet).toBe(true);
  });
});

// ================================================================================================
// P — DER WEG OHNE EIGENES `BEGIN` (BEN D6, Auflage 4 · PRÜFLÜCKE 1).
// ================================================================================================
//
// BENs Befund im Wortlaut: „über `pool.connect()` ohne vorheriges `BEGIN` eine Mutation senden,
// während die exklusive Resetsperre gehalten wird; erwartet ist, dass die Mutation die Datenbank
// nicht erreicht. Das Paket belegt nur den Mehrquery-Weg mit eigenem `BEGIN`."
//
// WARUM DAS EINE ECHTE LÜCKE IST UND KEIN RANDFALL. `connect()` verpflichtet zu nichts. Ein
// Aufrufer darf sich eine Verbindung holen und darauf eine einzelne Anweisung absetzen — Postgres
// führt sie dann im Autocommit aus. Für diesen Weg gibt es im Client-Gate bis hierher KEINEN
// Zweig: `steueranweisung()` liefert `undefined`, und die Anweisung geht unbesehen durch. Damit
// steht neben der gekapselten Fläche ein offener Weg in dieselbe Datenbank — genau das, was die
// Ownerentscheidung „zentrale Sperrrichtung" ausschließen soll.
describe("P — eine Mutation ohne eigenes BEGIN läuft nicht am Gate vorbei", () => {
  it("P1: läuft ein Reset, erreicht eine nackte Mutation auf connect() die Datenbank NICHT", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const gated = gatedPool(pool);
    const client = await gated.connect();

    resetLaeuft.wert = true;

    await expect(client.query("DELETE FROM ko WHERE id = $1", ["k-1"])).rejects.toBeInstanceOf(
      BestandsresetLaeuftError,
    );

    // Die Nutzanweisung darf in KEINEM Protokoll stehen — weder auf dieser noch auf einer anderen
    // Verbindung. Ein „geworfen, aber trotzdem gesendet" wäre der schlimmere Fall: der Aufrufer
    // sähe einen Fehler, die Zeile wäre trotzdem weg.
    expect(protokoll.some((zeile) => zeile.includes("DELETE FROM ko"))).toBe(false);
  });

  it("P2: die Sperre ist auch hier die ERSTE Anweisung und liegt auf derselben Verbindung", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const gated = gatedPool(pool);
    const client = await gated.connect();

    resetLaeuft.wert = false;
    await client.query("UPDATE ko SET titel = $1 WHERE id = $2", ["neu", "k-1"]);

    const spurC1 = spur(protokoll, "c1");
    expect(spurC1[0]).toBe("BEGIN");
    expect(spurC1[1]).toContain(SCHLUESSEL);
    expect(spurC1[2]).toContain("UPDATE ko");
    expect(spurC1[3]).toBe("COMMIT");
  });

  it("P3 — Kalibrierung: ohne laufenden Reset geht dieselbe Mutation durch und liefert ihr Ergebnis", async () => {
    // Ohne diesen Fall bestünde P1 auch bei einer Hülle, die schlicht ALLES abweist. Eine
    // Totalsperre erklärt jede Messung und beweist keine.
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const gated = gatedPool(pool);
    const client = await gated.connect();

    resetLaeuft.wert = false;
    const ergebnis = await client.query("INSERT INTO ko(id) VALUES ($1)", ["k-2"]);

    expect(ergebnis).toBeDefined();
    expect(protokoll.some((zeile) => zeile.includes("INSERT INTO ko"))).toBe(true);
  });

  it("P4: der Weg mit eigenem BEGIN bleibt unverändert — die Korrektur klammert nicht doppelt", async () => {
    const { pool, protokoll, resetLaeuft } = poolDoppel();
    const gated = gatedPool(pool);
    const client = await gated.connect();

    resetLaeuft.wert = false;
    await client.query("BEGIN");
    await client.query("INSERT INTO ko(id) VALUES ($1)", ["k-3"]);
    await client.query("COMMIT");

    const spurC1 = spur(protokoll, "c1");
    // Genau eine Klammer: BEGIN, Sperre, Nutzanweisung, COMMIT — kein zweites BEGIN dazwischen.
    expect(spurC1.filter((z) => z === "BEGIN")).toHaveLength(1);
    expect(spurC1.filter((z) => z === "COMMIT")).toHaveLength(1);
    expect(spurC1[2]).toContain("INSERT INTO ko");
  });
});
