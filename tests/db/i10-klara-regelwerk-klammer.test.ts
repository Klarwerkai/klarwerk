// ================================================================================================
// JOB 2376 · D1 — DIE TRANSAKTIONSKLAMMER, DIE KLARAS ZUSTIMMUNG SCHREIBT.
// ================================================================================================
//
// DER BEFUND, der diesen Bau ausgeloest hat (JOB 2375 D1, Befund 3): Von neun Transaktions-
// klammern im Baum waren zwei nicht verhaltensgeprueft. Diese hier —
// `services/reasoner/src/klara-policy-store.ts:667`, die private `casMitConsent` — hatte
// **keine einzige Testdatei**. Sie schreibt den Zustimmungszustand einer Klara-Sitzung.
//
// WARUM SIE ZAEHLT: Sie klammert ZWEI Tabellen. Der erste Schritt setzt den Sitzungszustand
// (`klara_sessions`), der zweite entwertet die alte Zustimmung und legt die neue an
// (`klara_session_consents`). Bricht die Klammer dazwischen, stuende eine Sitzung auf
// `consent_state='granted'` — OHNE dass eine gueltige Zustimmungszeile existiert. Das ist der
// Teilzustand, den niemand sieht: Die Sitzung behauptet eine Einwilligung, die es nicht gibt.
//
// WIE GEPRUEFT WIRD: `PgKlaraSessionRepo` nimmt seinen `Pool` im Konstruktor (`:591`) — ein
// Doppel genuegt, kein Horchpunkt und keine Datenbank. Die Klammer ist privat; erreicht wird sie
// ueber `grantConsent`, eine der fuenf oeffentlichen Methoden, die sie benutzen.
//
// AUSDRUECKLICHE REICHWEITENGRENZE — dieselbe wie in `services/db-tx/src/gated-pool.test.ts`:
// Alle Faelle laufen gegen ein Postgres-DOPPEL. Bewiesen ist die LOGIK DIESER SCHICHT —
// Reihenfolge, Verbindungsbindung, Rollbacksemantik, Freigabe. **NICHT bewiesen ist, dass
// PostgreSQL sich verhaelt wie das Doppel**; das bleibt bis zu einem Integrationslauf eine
// UNBEWIESENE HYPOTHESE.
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { type KlaraConsent, PgKlaraSessionRepo } from "../../services/reasoner";

interface Doppel {
  pool: Pool;
  /** Jede Anweisung MIT der Verbindung, auf der sie lief — verkuerzt auf ihr erstes Wort. */
  protokoll: string[];
  /** Der vollstaendige Anweisungstext, fuer die Zuordnung zur Tabelle. */
  volltext: string[];
  freigaben: string[];
  verbindungen: () => number;
}

/**
 * Das Doppel protokolliert jede Anweisung mit ihrer Verbindung. Die Verbindungskennung ist
 * tragend: Zwei Verbindungen waeren zwei Transaktionen — und damit genau das Loch, das die
 * Klammer schliesst.
 *
 * `zeilen` steuert den CAS-Ausgang (`rowCount`), `fehlerBei` laesst eine bestimmte Anweisung
 * scheitern. Beides ohne eine Zeile Produktaenderung.
 */
function poolDoppel(opts: {
  zeilen?: (text: string) => number;
  fehlerBei?: (text: string) => Error | undefined;
}): Doppel {
  const protokoll: string[] = [];
  const volltext: string[] = [];
  const freigaben: string[] = [];
  let clientZaehler = 0;

  const connect = async (): Promise<PoolClient> => {
    clientZaehler += 1;
    const name = `c${clientZaehler}`;
    const client = {
      query: async (text: string) => {
        const kopf = text.trim().split(/\s+/)[0] ?? "";
        protokoll.push(`${name}: ${kopf}`);
        volltext.push(text.trim());
        const fehler = opts.fehlerBei?.(text);
        if (fehler) {
          throw fehler;
        }
        return { rows: [], rowCount: opts.zeilen?.(text) ?? 1 };
      },
      release: () => {
        freigaben.push(name);
      },
    };
    return client as unknown as PoolClient;
  };

  return {
    pool: { connect } as unknown as Pool,
    protokoll,
    volltext,
    freigaben,
    verbindungen: () => clientZaehler,
  };
}

function zustimmung(): KlaraConsent {
  return {
    consentId: "consent-1",
    sessionId: "sitzung-1",
    tenantId: "mandant-1",
    actorId: "anna",
    documentContextId: "dok-1",
    consentScope: "dokument",
    allowedPayloadClasses: ["text"],
    providerClass: "deterministic",
    providerBindingId: "bindung-1",
    modelReference: "modell-1",
    providerReference: "anbieter-1",
    addinInstanceId: "instanz-1",
    policyVersion: "p1",
    configurationVersion: "k1",
    grantedAt: "2026-08-26T08:00:00.000Z",
    expiresAt: "2026-08-26T09:00:00.000Z",
    revokedAt: null,
    status: "granted",
    // W1 S4 R2: dieselbe Resolution wie an Sitzung und Status — ohne sie ist die Bindung
    // unvollstaendig, und der Compiler faengt es (TS2741).
    resolutionId: "aufloesung-1",
  };
}

/** Wie oft eine Anweisung auf eine Tabelle zugreift — die Zuordnung Schritt -> Tabelle. */
const trifft = (volltext: string[], tabelle: string): number =>
  volltext.filter((t) => t.includes(tabelle)).length;

describe("JOB 2376 · die Klammer um Klaras Zustimmung", () => {
  it("P1 · ERFOLG: BEGIN, Sitzungs-CAS, Zustimmungsschritte, COMMIT — in dieser Reihenfolge", async () => {
    const d = poolDoppel({});
    const repo = new PgKlaraSessionRepo(d.pool);

    const ergebnis = await repo.grantConsent("sitzung-1", 7, zustimmung());

    expect(ergebnis, "der Grant hat nicht gegriffen").toBe(true);
    expect(d.protokoll[0]).toBe("c1: BEGIN");
    expect(d.protokoll.at(-1)).toBe("c1: COMMIT");
    expect(d.protokoll, "es wurde trotz Erfolg zurueckgerollt").not.toContain("c1: ROLLBACK");

    // Beide Tabellen liegen in DERSELBEN Klammer — das ist der Zweck.
    expect(trifft(d.volltext, "klara_sessions"), "die Sitzung wurde nicht angefasst").toBe(1);
    expect(
      trifft(d.volltext, "klara_session_consents"),
      "die Zustimmungsseite wurde nicht geschrieben",
    ).toBeGreaterThanOrEqual(2);
  });

  it("P2 · DAS TOR: greift das Sitzungs-CAS nicht, wird zurueckgerollt und die Zustimmung NIE geschrieben", async () => {
    // Veraltete Revision: das UPDATE trifft null Zeilen.
    const d = poolDoppel({
      zeilen: (text) => (text.includes("UPDATE klara_sessions") ? 0 : 1),
    });
    const repo = new PgKlaraSessionRepo(d.pool);

    const ergebnis = await repo.grantConsent("sitzung-1", 1, zustimmung());

    expect(ergebnis, "ein Grant auf veralteter Revision hat gegriffen").toBe(false);
    expect(d.protokoll).toEqual(["c1: BEGIN", "c1: UPDATE", "c1: ROLLBACK"]);
    expect(d.protokoll, "es wurde committet, obwohl das Tor zu war").not.toContain("c1: COMMIT");

    // DER KERN: Ohne diese Zusage kaeme ein Grant auf veralteter Revision bis zum Insert —
    // die Zustimmungszeile entstuende, ohne dass die Sitzung sie traegt.
    expect(
      trifft(d.volltext, "klara_session_consents"),
      "die Zustimmungsseite wurde trotz geschlossenem Tor beruehrt",
    ).toBe(0);
  });

  it("P3 · DER TEILZUSTAND: bricht der Zustimmungsschritt, wird die SITZUNGSAENDERUNG mit zurueckgerollt", async () => {
    const bruch = new Error("INSERT verletzt den Unique-Index");
    const d = poolDoppel({
      fehlerBei: (text) =>
        text.includes("INSERT INTO klara_session_consents") ? bruch : undefined,
    });
    const repo = new PgKlaraSessionRepo(d.pool);

    await expect(repo.grantConsent("sitzung-1", 7, zustimmung())).rejects.toBe(bruch);

    // Das UPDATE auf `klara_sessions` war ERFOLGREICH — ohne die Klammer stuende die Sitzung
    // jetzt auf `consent_state='granted'`, waehrend keine gueltige Zustimmungszeile existiert.
    // Genau diesen Teilzustand verhindert das ROLLBACK.
    expect(trifft(d.volltext, "UPDATE klara_sessions"), "das Sitzungs-CAS lief nicht").toBe(1);
    expect(d.protokoll.at(-1), "es wurde nicht zurueckgerollt").toBe("c1: ROLLBACK");
    expect(d.protokoll, "ein gebrochener Grant wurde committet").not.toContain("c1: COMMIT");
  });

  it("P4 · RELEASE: die Verbindung wird in ALLEN DREI Ausgaengen genau einmal freigegeben", async () => {
    const gut = poolDoppel({});
    await new PgKlaraSessionRepo(gut.pool).grantConsent("s", 1, zustimmung());
    expect(gut.freigaben, "Erfolgsfall").toEqual(["c1"]);

    const tor = poolDoppel({ zeilen: (t) => (t.includes("UPDATE klara_sessions") ? 0 : 1) });
    await new PgKlaraSessionRepo(tor.pool).grantConsent("s", 1, zustimmung());
    expect(tor.freigaben, "Tor geschlossen").toEqual(["c1"]);

    const bruch = poolDoppel({
      fehlerBei: (t) => (t.includes("INSERT INTO") ? new Error("kaputt") : undefined),
    });
    await expect(
      new PgKlaraSessionRepo(bruch.pool).grantConsent("s", 1, zustimmung()),
    ).rejects.toThrow("kaputt");
    // `finally` ist die Zusage. Ohne sie versickert der Pool nach einigen Fehlern — ein Ausfall,
    // der erst unter Last sichtbar wird und dann alles trifft.
    expect(bruch.freigaben, "Fehlerfall: die Verbindung blieb belegt").toEqual(["c1"]);
  });

  it("P5 · CLIENTIDENTITAET: beide Tabellen werden auf DERSELBEN Verbindung geschrieben", async () => {
    const d = poolDoppel({});
    await new PgKlaraSessionRepo(d.pool).grantConsent("sitzung-1", 7, zustimmung());

    expect(d.verbindungen(), "es wurde mehr als eine Verbindung geoeffnet").toBe(1);
    const verbindungen = new Set(d.protokoll.map((z) => z.split(":")[0]));
    expect(verbindungen.size, "die Anweisungen liefen nicht auf einer Verbindung").toBe(1);
  });

  it("P6 · scheitert auch das ROLLBACK, bleibt der URSPRUENGLICHE Fehler sichtbar", async () => {
    const echterFehler = new Error("INSERT gescheitert");
    const rollbackFehler = new Error("ROLLBACK ebenfalls kaputt");
    const d = poolDoppel({
      fehlerBei: (text) => {
        if (text.includes("INSERT INTO klara_session_consents")) {
          return echterFehler;
        }
        return text.trim() === "ROLLBACK" ? rollbackFehler : undefined;
      },
    });

    // Ohne das `.catch(() => undefined)` traege der Aufrufer den Rollbackfehler und wuesste nie,
    // WARUM die Zustimmung wirklich scheiterte.
    await expect(new PgKlaraSessionRepo(d.pool).grantConsent("s", 1, zustimmung())).rejects.toBe(
      echterFehler,
    );
    expect(d.freigaben).toEqual(["c1"]);
  });

  it("P7 · KALIBRIERUNG: das Doppel sieht Reihenfolge, Tabellen und Verbindungen ueberhaupt", async () => {
    // Ohne diesen Fall waere jede Zusage oben auch dann gruen, wenn das Doppel nichts
    // protokolliert — dieselbe Fehlerklasse, an der die KA-Reihe gescheitert ist.
    const d = poolDoppel({});
    const client = await d.pool.connect();
    await client.query("BEGIN");
    await client.query("UPDATE klara_sessions SET x=1");
    client.release();

    expect(d.protokoll).toEqual(["c1: BEGIN", "c1: UPDATE"]);
    expect(trifft(d.volltext, "klara_sessions")).toBe(1);
    expect(trifft(d.volltext, "klara_session_consents")).toBe(0);
    expect(d.freigaben).toEqual(["c1"]);
    expect(d.verbindungen()).toBe(1);
  });
});
