// ================================================================================================
// GRAPH-BROWSER-RECHTE · DIESELBE STRECKE GEGEN POSTGRESQL — und der historische 500, minimal.
// ================================================================================================
//
// `strecke.ts` fährt hier unverändert, nur mit einem echten `Pool`: Setzen und Widerrufen per
// Tastatur bei 360 px, Neuladen, Gegenseite, Rechteentzug an offener Sitzung. Zusätzlich wird jede
// Station an der Tabelle `ko_kanten` nachgelesen — mit eigener Verbindung, nicht über die Anwendung.
//
// ------------------------------------------------------------------------------------------------
// DER HISTORISCHE 500 — ZUGEORDNET UND MINIMAL REPRODUZIERT (Befund B3, Ben R1)
// ------------------------------------------------------------------------------------------------
//
// DER ALTBEFUND (JOB 4328 R1, Arbeitsprüfung 9b5f98b21ece44fea6340ee5410a6823, festgehalten in
// `tests/wissensnetz-nutzerweg/strecke.ts:1155-1171`): gegen PostgreSQL, bei offener `/graph`-Seite,
// antwortete `POST /api/kos` beim dritten Grenzobjekt mit `500 {"error":"INTERNAL",…}`. Ursache
// „nicht aufgeklärt", weil kein Serverprotokoll herauskam.
//
// DIE ZUORDNUNG, am Code belegt:
//   · `POST /api/kos` (`services/app/src/routes/ko-routes.ts`) schreibt NACH dem Einfügen in `kos`
//     den Prüfprotokoll-Beleg `recordOnce("ko.created:<id>")` (`knowledge-object/src/service.ts`,
//     `finishCreated`). `AuditService.record`/`recordOnce` (`services/audit/src/service.ts`)
//     vergeben die Folgenummer als `last()` → `seq + 1` — zwei getrennte Anfragen, NICHTS
//     serialisiert sie. `audit.seq` ist Primärschlüssel; `appendOnce` fängt nur `event_id` ab.
//   · Schreibt ein ANDERER Prüfprotokoll-Eintrag gleichzeitig (eine zweite Anlage, die
//     Hintergrundprüfung mit `overlap.auto-created`, …), bekommen beide dieselbe `seq`, und einer
//     scheitert mit SQLSTATE 23505 an `audit_pkey`.
//   · `sendError` (`services/app/src/http.ts`) reicht nur Codes aus GROSSBUCHSTABEN durch; `23505`
//     fällt in den Auffangzweig → `500 INTERNAL` „Unerwarteter Fehler." — OHNE Logzeile. Das ist
//     GENAU der beobachtete Rumpf und GENAU das fehlende Protokoll des Altbefunds.
//   · Auf Dienstebene ist diese Kollision seit `ad4c957d` (JOB 4271 Befund 3,
//     `tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts`, Fall E3) als
//     „REPRODUZIERTER REST, NICHT BEHOBEN" festgehalten. Ein Nachfolger, der sie im Stand dieses
//     Zweigs schließt, existiert NICHT: die Serialisierung im Auftrag „gesamt-auditprotokoll"
//     liegt auf einem nicht übernommenen Zweig.
//
// DIE MINIMALE REPRODUKTION, Fall ALT-500 unten — EIN echter `POST /api/kos` über HTTP, ohne
// Browser, deterministisch statt zeitglücksabhängig (dieselbe Technik wie E3):
//   (a) ein zweiter Schreiber legt in OFFENER Transaktion einen gewöhnlichen Prüfprotokoll-Eintrag
//       an (`AuditService.record`, seq = n+1, noch nicht festgeschrieben);
//   (b) `POST /api/kos` läuft; sein `last()` sieht den offenen Eintrag nicht (MVCC), rechnet
//       ebenfalls n+1, und sein INSERT wartet an der Zeile des Primärschlüssels — gemessen in
//       `pg_stat_activity`, sonst ist nichts überlappt und der Fall sagt nichts;
//   (c) der zweite Schreiber schreibt fest → die Anlage scheitert.
// Belegt wird: Antwort `500` mit `error: "INTERNAL"`; der Eintrag STEHT in `kos` (das Einfügen
// war schon festgeschrieben), aber sein Beleg `ko.created:<id>` FEHLT in `audit` — der
// Fingerabdruck genau dieses Schritts. Die GEGENPROBE (dieselbe Anlage ohne zweiten Schreiber)
// ergibt 201 samt Beleg — die Nutzlast ist es also nicht.
//
// WAS DAMIT NICHT BEWIESEN IST, und so steht es auch in der Rückgabe: WELCHER zweite Schreiber im
// Lauf von 4328 R1 kollidierte (naheliegend: die Hintergrundprüfung einer fast gleichlautenden
// Vorgängeranlage) und warum es nur mit offener Seite auftrat. Zugeordnet ist der Mechanismus —
// dieselbe Route, derselbe Rumpf, dasselbe fehlende Protokoll —, nicht der einzelne Zeitverlauf.
//
// WENN DIESER FALL ROT WIRD, WEIL DIE ANLAGE 201 LIEFERT: dann ist die Folge serialisiert
// (z. B. `pg_advisory_xact_lock` in `PgAuditRepo` oder `seq` aus der Datenbank). Das ist der
// schliessende Nachfolger — diesen Fall dann auf „geschlossen durch <Commit>" umstellen, nicht
// abschwächen. (Eine rein prozessinterne Warteschlange schliesst ihn NICHT: der zweite Schreiber
// hier ist ein eigener Client, wie eine zweite Instanz.)
//
// PRÜFGRENZE, SICHTBAR: ohne PostgreSQL (weder `KLARWERK_PG_TEST_URL` noch Container) oder ohne
// Chromium steht der Grund auf stderr, und der Zeuge sagt, dass nichts belegt ist.
//
// KEINE PRODUKTIVDATEN: die Datenbanken tragen `test` im Namen (`pgUrl`) und werden entfernt.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { AuditService, PgAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
import { type Verbindung, pgUrl, zerlege } from "../beziehungs-restore-nutzerweg/vorrichtung";
import { type Browser, starteChromium } from "../gast-nutzerweg/browserweg";
import { PASSWORT, starteStrecke } from "../gast-nutzerweg/strecke";
import { stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { MARKE, type Protokoll, baueAuf, fahreStrecke, protokollzeile } from "./strecke";

const STEMPEL = `${Date.now()}`.slice(-8);
const DATENBANK = `klarwerk_wbr_${STEMPEL}_test`;
const DATENBANK_500 = `klarwerk_wbr500_${STEMPEL}_test`;

/** Was Fall ALT-500 gemessen hat — steht als Zeile auf stderr und im Zeugen. */
interface Alt500 {
  gegenprobe: number;
  wartend: string;
  status: number;
  rumpf: string;
  koGespeichert: number;
  belegFehlt: boolean;
  folge: number[];
}

describe(`${MARKE} · PostgreSQL im echten Chromium`, () => {
  let zustand: Laufzustand | undefined;
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let pgFassung = "";
  let protokoll: Protokoll | undefined;
  let alt500: Alt500 | undefined;

  beforeAll(async () => {
    let url = guardedLocalPgTestUrl() ?? "";
    let quelle = url ? "lokale Testinstanz" : "";
    let grund = "";
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = "Testcontainer postgres:16-alpine";
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar (${String(fehler)})`;
      }
    }
    if (url) {
      verbindung = zerlege(url);
      if (!verbindung) {
        grund = "die Test-URL nennt keinen Rechnernamen";
      } else {
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Aufbaufehler färbt rot.
        verwaltung = new Pool({ connectionString: url });
        const v = await verwaltung.query<{ version: string }>("SELECT version() AS version");
        pgFassung = (v.rows[0]?.version ?? "unbekannt").split(" ").slice(0, 2).join(" ");
        await verwaltung.query(`CREATE DATABASE ${DATENBANK}`);
        await verwaltung.query(`CREATE DATABASE ${DATENBANK_500}`);
        process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
        browser = await starteChromium();
        zustand = { gelaufen: true, quelle: `${quelle}, ${pgFassung}, Datenbank ${DATENBANK}` };
      }
    }
    zustand ??= { gelaufen: false, grund };
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
  }, 900_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    for (const db of [DATENBANK, DATENBANK_500]) {
      await verwaltung?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await verwaltung?.end().catch(() => undefined);
    await container?.stop().catch(() => undefined);
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
    if (protokoll) {
      process.stderr.write(`${protokollzeile(protokoll)} PostgreSQL=${pgFassung}\n`);
    }
    if (alt500) {
      process.stderr.write(`${MARKE} ALT-500: ${JSON.stringify(alt500)}\n`);
    }
  }, 300_000);

  it("Tastatur, 360 px, Neuladen, Widerruf und Rechteentzug gegen PostgreSQL — nachgelesen an ko_kanten", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !browser) {
      process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
      return;
    }
    const pool = createPool(pgUrl(verbindung, DATENBANK));
    pool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verbindung endete — ${String(fehler)}\n`);
    });
    await migrate(pool);
    const aufbau = await baueAuf(pool);
    try {
      protokoll = await fahreStrecke({ browser, aufbau, pool });
      expect(protokoll.pgStatus, "ko_kanten: gesetzt → widerrufen; verborgen bleibt aktiv").toEqual(
        ["aktiv", "widerrufen", "aktiv"],
      );
      expect(protokoll.kachelnAnker).toEqual([2, 2, 1]);
      expect(protokoll.controllerFlaeche).toEqual([1, 0]);
      expect(protokoll.controllerApi).toEqual([1, 0]);
      expect(aufbau.serverfehler, "Serverfehler während der ganzen Strecke").toEqual([]);
    } finally {
      await aufbau.strecke.schliessen();
      await pool.end().catch(() => undefined);
    }
  }, 1_200_000);

  it("ALT-500 · minimal reproduziert: POST /api/kos → 500 INTERNAL, wenn ein gleichzeitiger Prüfprotokoll-Eintrag dieselbe seq belegt (23505 audit_pkey)", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !verwaltung) {
      process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ALT-500`, zustand));
      return;
    }
    const v = verwaltung;
    const url = pgUrl(verbindung, DATENBANK_500);
    const pool = createPool(url);
    pool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verbindung endete — ${String(fehler)}\n`);
    });
    const halterPool = new Pool({ connectionString: url, max: 1 });
    await migrate(pool);
    const strecke = await starteStrecke({ pool });
    try {
      const admin = strecke.profil("admin");
      const setup = await admin.sende("POST", "/api/auth/setup", {
        name: "Alt500 Admin",
        email: "wbr-alt500@graph-browser-rechte.test",
        password: PASSWORT,
      });
      expect(setup.status, setup.text).toBe(201);
      // Dieselbe Nutzlastform wie die Grenzobjekte des Altbefunds.
      const anlage = (nr: string) => ({
        title: `Grenzobjekt ${nr}`,
        statement: `Belegsatz des Grenzobjekts ${nr} fuer die Lesegrenze.`,
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "intern",
        tags: [`wbr-alt500-${nr}`],
      });
      const koIdZuTitel = async (titel: string): Promise<string[]> =>
        (
          await pool.query<{ id: string }>("SELECT id FROM kos WHERE data->>'title' = $1", [titel])
        ).rows.map((r) => r.id);
      const hatBeleg = async (id: string): Promise<boolean> =>
        (
          await pool.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM audit WHERE event_id = $1",
            [`ko.created:${id}`],
          )
        ).rows[0]?.n === 1;
      /** Bis das Prüfprotokoll still ist — Nachläufer früherer Anlagen dürfen nicht mitschreiben. */
      const ruhe = async (): Promise<void> => {
        let vorher = -1;
        for (let stabil = 0; stabil < 3; ) {
          await new Promise((weiter) => setTimeout(weiter, 500));
          const r = await pool.query<{ n: number }>(
            "SELECT COALESCE(max(seq), 0)::int AS n FROM audit",
          );
          const n = r.rows[0]?.n ?? 0;
          stabil = n === vorher ? stabil + 1 : 0;
          vorher = n;
        }
      };

      // GEGENPROBE: dieselbe Anlage ohne zweiten Schreiber → 201 samt Beleg.
      const frei = await admin.sende("POST", "/api/kos", anlage("0000"));
      expect(frei.status, frei.text.slice(0, 300)).toBe(201);
      const freiId = (frei.json as { id: string }).id;
      expect(await hatBeleg(freiId), "Gegenprobe: Beleg ko.created vorhanden").toBe(true);
      await ruhe();

      // (a)–(c): der zweite Schreiber hält seinen Eintrag offen, bis die Anlage an ihm wartet.
      const halter = new AuditService({ repo: new PgAuditRepo(halterPool) });
      let antwort: ReturnType<typeof admin.sende> | undefined;
      let wartend = "";
      await withPgTx(halterPool, async (tx) => {
        await halter.record(
          { actor: "wbr-alt500-halter", action: "alt500.gleichzeitig", target: "audit" },
          tx,
        );
        antwort = admin.sende("POST", "/api/kos", anlage("0002"));
        const frist = Date.now() + 30_000;
        while (Date.now() < frist && !wartend) {
          const r = await v.query<{ q: string }>(
            `SELECT query AS q FROM pg_stat_activity
              WHERE datname = $1 AND wait_event_type = 'Lock' AND query ILIKE 'INSERT INTO audit%'`,
            [DATENBANK_500],
          );
          wartend = r.rows[0]?.q.replace(/\s+/g, " ").slice(0, 80) ?? "";
          if (!wartend) await new Promise((weiter) => setTimeout(weiter, 50));
        }
      });
      const r = await (antwort as ReturnType<typeof admin.sende>);
      const ids = await koIdZuTitel("Grenzobjekt 0002");
      const folge = (
        await pool.query<{ seq: number }>("SELECT seq FROM audit ORDER BY seq")
      ).rows.map((z) => z.seq);
      alt500 = {
        gegenprobe: frei.status,
        wartend,
        status: r.status,
        rumpf: r.text.slice(0, 200),
        koGespeichert: ids.length,
        belegFehlt: ids.length === 1 ? !(await hatBeleg(ids[0] as string)) : false,
        folge,
      };

      expect(
        wartend,
        "die Anlage wartete nie am INSERT INTO audit — die Überlappung kam nicht zustande, der Fall sagt nichts",
      ).not.toBe("");
      expect(
        r.status,
        `${MARKE} ALT-500: die Anlage lieferte ${r.status} statt 500. Liefert sie 201, ist die Prüfprotokoll-Folge serialisiert — dann ist der Altbefund durch diesen Nachfolger GESCHLOSSEN; diesen Fall darauf umstellen, nicht abschwächen. Rumpf: ${r.text.slice(0, 200)}`,
      ).toBe(500);
      expect((r.json as { error?: string }).error, "Rumpf wie im Altbefund").toBe("INTERNAL");
      expect(
        { koGespeichert: alt500.koGespeichert, belegFehlt: alt500.belegFehlt },
        "Fingerabdruck: der Eintrag steht in kos, sein Beleg ko.created fehlt — gescheitert ist der Prüfprotokoll-Schritt",
      ).toEqual({ koGespeichert: 1, belegFehlt: true });
      expect(new Set(folge).size, "keine doppelte seq").toBe(folge.length);
      expect(
        folge,
        "die Folge bleibt lückenlos — der Verlierer hinterlässt keinen halben Eintrag",
      ).toEqual(folge.map((_, i) => i + 1));
    } finally {
      await strecke.schliessen();
      await halterPool.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
  }, 300_000);

  it("Zeuge: der Lauf sagt selbst, ob er gelaufen ist — ein Skip ist kein Grün", () => {
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ZEUGE`, zustand));
    expect(zustand, "beforeAll hat keinen Laufzustand hinterlassen").toBeDefined();
    if (!zaehltAlsBestanden(zustand)) {
      expect(protokoll, "ohne Voraussetzungen darf kein Protokoll entstanden sein").toBeUndefined();
      expect(
        alt500,
        "ohne Voraussetzungen darf keine ALT-500-Messung entstanden sein",
      ).toBeUndefined();
      return;
    }
    expect(
      protokoll,
      "die Voraussetzungen lagen vor — dann MUSS die Strecke gefahren sein",
    ).toBeDefined();
    expect(protokoll?.ablage).toBe("PostgreSQL");
    expect(
      alt500,
      "die Voraussetzungen lagen vor — dann MUSS ALT-500 gemessen haben",
    ).toBeDefined();
  });
});
