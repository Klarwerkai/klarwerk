import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  BESTANDSRESET_LOESCHGRAPH,
  BestandsresetGesperrtError,
  fuehreBestandsresetAus,
} from "./bestandsreset";
import { type BestandsresetLauf, bestandsresetBefund } from "./bestandsreset-audit";

// ================================================================================================
// JOB 596 · D8 — DER RESET VOM AUFRUF BIS ZUM BELASTBAREN ABSCHLUSSZUSTAND (BEN D7, Auflage 4).
// ================================================================================================
//
// Wörtlich verlangt: „End-to-End-Tests für Erfolg, Rollback und Verbindungsabbruch vom Aufruf bis
// zum belastbaren Abschlusszustand."
//
// DER DRITTE FALL IST DER, FÜR DEN DER GANZE JOB GEBAUT IST. Erfolg und Rollback sind die leichten
// Hälften — sie haben einen Rückgabewert, aus dem man ablesen kann, was war. Der Verbindungsabbruch
// hat keinen: Der Prozess ist tot, niemand schreibt mehr etwas, und die Frage „steht mein Bestand
// noch?" muss aus dem beantwortet werden, was auf der Platte liegt. Genau dort hat „läuft plus
// freie Sperre" bis D6 zwei entgegengesetzte Wirklichkeiten hinter demselben Bild versteckt.
//
// REICHWEITENGRENZE, VORWEG: Auch diese Fälle laufen gegen ein Postgres-DOPPEL. Bewiesen ist die
// LOGIK DES ABLAUFS — Reihenfolge der drei Transaktionen, Stellung des Commitmerkmals,
// Auflösungsweg nach einem Abbruch. Dass PostgreSQL Advisory-Sperren beim Transaktionsende
// serverseitig freigibt, bleibt bis zu einem Integrationslauf eine UNBEWIESENE HYPOTHESE
// (Regelwerk Z. 493) — s. Rückgabe D8, Auflage 3.

interface Zeile {
  status: "RUNNING" | "OK" | "ROLLED_BACK";
  payload_committed_at: Date | null;
}

interface Doppel {
  pool: Pool;
  protokoll: string[];
  /** Die Audittabelle, wie sie nach einem Absturz auf der Platte läge. */
  tabelle: Map<string, Zeile>;
  sperreFrei: { wert: boolean };
  /** Ab dieser Anweisungsnummer stirbt die Verbindung. `0` = nie. */
  stirbtAb: { wert: number };
}

class VerbindungTot extends Error {
  constructor() {
    super("Connection terminated unexpectedly");
    this.name = "VerbindungTot";
  }
}

/**
 * Ein Doppel mit ECHTER Transaktionssemantik für die Audittabelle.
 *
 * Das ist der Punkt, an dem ein naives Doppel wertlos wäre: Nur wenn ein nicht committetes
 * `UPDATE` beim Verbindungstod WIRKLICH verschwindet, sagt der Abbruchfall etwas aus. Deshalb
 * führt das Doppel die Tabelle zweifach — den committeten Stand und den Stand der offenen
 * Transaktion — und wirft den zweiten bei `ROLLBACK` oder Tod weg.
 */
function poolDoppel(vorbelegung: Map<string, Zeile> = new Map()): Doppel {
  const protokoll: string[] = [];
  const sperreFrei = { wert: true };
  const stirbtAb = { wert: 0 };
  let committet = new Map(vorbelegung);
  let offen: Map<string, Zeile> | null = null;
  let nr = 0;

  const sicht = (): Map<string, Zeile> => offen ?? committet;

  const client = {
    query: async (befehl: string, werte?: unknown[]) => {
      nr += 1;
      protokoll.push(befehl.trim().split("\n")[0] ?? befehl);
      if (stirbtAb.wert !== 0 && nr >= stirbtAb.wert) {
        // Der Tod nimmt die offene Transaktion mit — serverseitig, ohne Zutun.
        offen = null;
        throw new VerbindungTot();
      }
      const t = befehl.trim().toUpperCase();
      if (t === "BEGIN") {
        offen = new Map(committet);
        return { rows: [], rowCount: 0 };
      }
      if (t === "COMMIT") {
        if (offen) {
          committet = offen;
        }
        offen = null;
        return { rows: [], rowCount: 0 };
      }
      if (t === "ROLLBACK") {
        offen = null;
        return { rows: [], rowCount: 0 };
      }
      if (befehl.includes("pg_try_advisory_xact_lock")) {
        return { rows: [{ erworben: sperreFrei.wert }], rowCount: 1 };
      }
      if (befehl.includes("INSERT INTO bestandsreset_laeufe")) {
        sicht().set(String(werte?.[0]), { status: "RUNNING", payload_committed_at: null });
        return { rows: [], rowCount: 1 };
      }
      if (befehl.includes("SET payload_committed_at")) {
        const z = sicht().get(String(werte?.[0]));
        if (z) {
          sicht().set(String(werte?.[0]), { ...z, payload_committed_at: new Date() });
        }
        return { rows: [], rowCount: 1 };
      }
      if (befehl.includes("SET status = $2")) {
        const z = sicht().get(String(werte?.[0]));
        if (z) {
          sicht().set(String(werte?.[0]), { ...z, status: werte?.[1] as Zeile["status"] });
        }
        return { rows: [], rowCount: 1 };
      }
      if (befehl.includes("SELECT id, status, payload_committed_at")) {
        const eintrag = [...sicht().entries()][0];
        return eintrag
          ? { rows: [{ id: eintrag[0], ...eintrag[1] }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {
      protokoll.push("RELEASE");
    },
  };

  const pool = {
    query: client.query,
    connect: async () => client,
  };

  return {
    pool: pool as unknown as Pool,
    protokoll,
    get tabelle() {
      return committet;
    },
    sperreFrei,
    stirbtAb,
  } as Doppel;
}

/**
 * Der Wiederanlauf: liest, was auf der Platte liegt, und fragt die Sperre.
 *
 * DER TOD WIRD HIER AUFGEHOBEN, und das ist keine Bequemlichkeit: Der Wiederanlauf ist ein NEUER
 * Prozess mit einer NEUEN Verbindung. Der abgestürzte ist weg; er liest nichts mehr. Ließe man das
 * Sterben stehen, prüfte der Test „stirbt eine tote Verbindung erneut" statt „was findet der
 * Nachfolger vor" — und genau Letzteres ist die Frage, für die JOB 596 gebaut ist.
 */
async function wiederanlauf(doppel: Doppel) {
  doppel.stirbtAb.wert = 0;
  return bestandsresetBefund(
    doppel.pool as unknown as Parameters<typeof bestandsresetBefund>[0],
    async () => !doppel.sperreFrei.wert,
  );
}

describe("E1 — Erfolg: vom Aufruf bis zum belastbaren OK", () => {
  it("die drei Transaktionen laufen in der festgelegten Ordnung, Merkmal ZULETZT", async () => {
    const doppel = poolDoppel();

    const befund = await fuehreBestandsresetAus(doppel.pool, "lauf-1", ["kos", "drafts"]);

    expect(doppel.protokoll).toEqual([
      "BEGIN",
      expect.stringContaining("INSERT INTO bestandsreset_laeufe"),
      "COMMIT",
      "BEGIN",
      expect.stringContaining("pg_try_advisory_xact_lock"),
      "DELETE FROM kos",
      "DELETE FROM drafts",
      expect.stringContaining("SET payload_committed_at"),
      "COMMIT",
      expect.stringContaining("SET status = $2"),
      "RELEASE",
    ]);
    expect(befund).toMatchObject({ zustand: "OK", erfolgMeldbar: true, bestandIstP0: false });
  });

  it("das Commitmerkmal steht IN der Nutzdatentransaktion — nicht dahinter", async () => {
    // Die Stellung ist der ganze Vertrag. Stünde das Merkmal nach dem COMMIT, gäbe es ein zweites
    // Fenster, in dem „Daten weg, Merkmal fehlt" entstehen könnte — genau der Fehler, den der
    // Auditautomat ausschließen soll.
    const doppel = poolDoppel();

    await fuehreBestandsresetAus(doppel.pool, "lauf-1", ["kos"]);

    const merkmal = doppel.protokoll.findIndex((z) => z.includes("SET payload_committed_at"));
    const commits = doppel.protokoll.flatMap((z, i) => (z === "COMMIT" ? [i] : []));
    // Nach T1s COMMIT und VOR T2s COMMIT.
    expect(merkmal).toBeGreaterThan(commits[0] ?? -1);
    expect(merkmal).toBeLessThan(commits[1] ?? -1);
  });

  it("der Standard-Löschgraph löscht das Wissen und lässt Zugänge, Einstellungen und Audit stehen", async () => {
    // Der Vorschlag V-1 als Test: Wer die Trennlinie verschiebt, bricht diesen Fall — und soll das.
    expect(BESTANDSRESET_LOESCHGRAPH).toContain("kos");
    expect(BESTANDSRESET_LOESCHGRAPH).not.toContain("users");
    expect(BESTANDSRESET_LOESCHGRAPH).not.toContain("sessions");
    expect(BESTANDSRESET_LOESCHGRAPH).not.toContain("audit");
    expect(BESTANDSRESET_LOESCHGRAPH).not.toContain("bestandsreset_laeufe");
    // Der eine echte Fremdschlüssel: das Kind steht VOR dem Elternteil.
    expect(BESTANDSRESET_LOESCHGRAPH.indexOf("import_run_item_refs")).toBeLessThan(
      BESTANDSRESET_LOESCHGRAPH.indexOf("import_runs"),
    );
  });
});

describe("E2 — Rollback: der Bestand steht, und der Lauf sagt das auch", () => {
  it("scheitert eine Löschung, wird zurückgerollt UND der Abschluss geschrieben", async () => {
    const doppel = poolDoppel();
    const echt = doppel.pool.connect.bind(doppel.pool);
    doppel.pool.connect = (async () => {
      const c = await echt();
      const original = c.query.bind(c);
      c.query = (async (befehl: string, werte?: unknown[]) => {
        if (typeof befehl === "string" && befehl.startsWith("DELETE FROM kos")) {
          throw new Error("deadlock detected");
        }
        return original(befehl, werte);
      }) as typeof c.query;
      return c;
    }) as typeof doppel.pool.connect;

    await expect(fuehreBestandsresetAus(doppel.pool, "lauf-2", ["kos"])).rejects.toThrow(
      "deadlock detected",
    );

    expect(doppel.protokoll).toContain("ROLLBACK");
    // Der Lauf steht als sauber zurückgerollt da — nicht als RUNNING, sonst wäre er vom Absturz
    // nicht zu unterscheiden.
    expect(doppel.tabelle.get("lauf-2")).toMatchObject({
      status: "ROLLED_BACK",
      payload_committed_at: null,
    });
    await expect(wiederanlauf(doppel)).resolves.toMatchObject({
      zustand: "ROLLED_BACK",
      bestandIstP0: true,
      erfolgMeldbar: false,
    });
  });

  it("läuft bereits ein Reset, beginnt der zweite gar nicht erst", async () => {
    const doppel = poolDoppel();
    doppel.sperreFrei.wert = false;

    await expect(fuehreBestandsresetAus(doppel.pool, "lauf-3", ["kos"])).rejects.toBeInstanceOf(
      BestandsresetGesperrtError,
    );

    // Keine einzige Löschung.
    expect(doppel.protokoll.filter((z) => z.startsWith("DELETE"))).toEqual([]);
    expect(doppel.tabelle.get("lauf-3")).toMatchObject({ status: "ROLLED_BACK" });
  });
});

describe("E3 — Verbindungsabbruch: kein erfundener Abschluss", () => {
  it("Abbruch VOR dem Commit: der Wiederanlauf sagt „Bestand steht“ — belegt, nicht geraten", async () => {
    const doppel = poolDoppel();
    // Anweisung 7 ist das Commitmerkmal (BEGIN, INSERT, COMMIT, BEGIN, Sperre, DELETE, Merkmal).
    doppel.stirbtAb.wert = 7;

    await expect(fuehreBestandsresetAus(doppel.pool, "lauf-4", ["kos"])).rejects.toBeInstanceOf(
      Error,
    );

    // Auf der Platte: RUNNING, KEIN Merkmal. Die Sperre ist mit der toten Transaktion frei.
    expect(doppel.tabelle.get("lauf-4")).toMatchObject({
      status: "RUNNING",
      payload_committed_at: null,
    });
    await expect(wiederanlauf(doppel)).resolves.toMatchObject({
      zustand: "ROLLED_BACK_BY_CRASH",
      bestandIstP0: true,
      erfolgMeldbar: false,
    });
  });

  it("Abbruch NACH dem Commit: der Wiederanlauf sagt „Daten weg, Erfolg NICHT meldbar“", async () => {
    // DER FALL, DEN „läuft plus freie Sperre" NICHT SEHEN KANN — und der Grund für das
    // Commitmerkmal. Ohne es wäre dieser Zustand von dem obigen nicht zu unterscheiden, und wer
    // ihn für „zurückgerollt" hielte, behauptete, der Bestand stehe — während er gelöscht ist.
    const doppel = poolDoppel();
    // Die Anweisungsfolge: 1 BEGIN · 2 INSERT · 3 COMMIT · 4 BEGIN · 5 Sperre · 6 DELETE ·
    // 7 Merkmal · 8 COMMIT · 9 Abschluss. Der Tod bei 9 liegt also NACH dem Commit der
    // Nutzdaten und VOR dem Auditabschluss — genau das gesuchte Fenster.
    doppel.stirbtAb.wert = 9;

    await expect(fuehreBestandsresetAus(doppel.pool, "lauf-5", ["kos"])).rejects.toBeInstanceOf(
      Error,
    );

    expect(doppel.tabelle.get("lauf-5")).toMatchObject({ status: "RUNNING" });
    expect(doppel.tabelle.get("lauf-5")?.payload_committed_at).not.toBeNull();

    const befund = await wiederanlauf(doppel);
    expect(befund).toMatchObject({
      zustand: "COMMITTED_AUDIT_MISSING",
      bestandIstP0: false,
      erfolgMeldbar: false,
    });
  });

  it("ein LEBENDER Lauf wird nicht angefasst — die gehaltene Sperre ist das Lebenszeichen", async () => {
    const doppel = poolDoppel(
      new Map([["lauf-6", { status: "RUNNING" as const, payload_committed_at: null }]]),
    );
    doppel.sperreFrei.wert = false; // jemand hält sie

    await expect(wiederanlauf(doppel)).resolves.toMatchObject({
      zustand: "RUNNING",
      bestandIstP0: undefined,
      erfolgMeldbar: false,
    });
  });
});

describe("E4 — es gibt keinen Weg, auf dem ein unbelegter Erfolg entsteht", () => {
  it("über alle Abbruchpunkte hinweg ist erfolgMeldbar niemals ohne Commitmerkmal wahr", async () => {
    // Der erschöpfende Riegel: Wir lassen die Verbindung an JEDER Anweisung sterben und prüfen
    // nach jedem Durchgang den Befund des Wiederanlaufs. Ein einziger Punkt, an dem „Erfolg
    // meldbar" ohne Commitmerkmal herauskäme, würde diesen Fall kippen.
    for (let punkt = 1; punkt <= 9; punkt += 1) {
      const doppel = poolDoppel();
      doppel.stirbtAb.wert = punkt;

      await fuehreBestandsresetAus(doppel.pool, "lauf-x", ["kos"]).catch(() => undefined);

      const befund = await wiederanlauf(doppel);
      if (befund?.erfolgMeldbar) {
        const lauf = doppel.tabelle.get("lauf-x") as unknown as BestandsresetLauf | undefined;
        expect(
          doppel.tabelle.get("lauf-x")?.payload_committed_at,
          `Abbruchpunkt ${punkt} meldet Erfolg ohne Commitmerkmal (${JSON.stringify(lauf)})`,
        ).not.toBeNull();
      }
    }
  });
});
