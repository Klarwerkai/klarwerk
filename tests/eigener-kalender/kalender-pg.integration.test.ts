// ================================================================================================
// AW-16 · K1/K4 — DER ECHTE SPEICHERWEG: PostgreSQL über einen Neustart hinweg.
// ================================================================================================
//
// `kalender-am-server.test.ts` misst den Draht an der Speicherablage. „Nach Neuladen/Neustart bleibt
// derselbe Eintrag vorhanden" ist aber erst belegt, wenn der Eintrag eine ECHTE Datenbank, einen
// neuen Pool und eine neue App überlebt. Genau das steht hier: dieselben Routen
// (`eigenerKalenderRoutes`), dieselbe Ablage (`PgEigenerKalenderRepo`), das ausgeführte `migrate()`
// mit `EIGENER_KALENDER_SCHEMA` — zweimal, weil die Stufe wiederholbar sein muss.
//
// Die Anmeldung ist hier nicht Gegenstand (dafür `kalender-am-server.test.ts`): ein schmaler
// Kopfzeilen-Wächter setzt das Konto. Alle Inhalte sind erfundene Testdaten.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  EigenerKalenderDienst,
  PgEigenerKalenderRepo,
} from "../../services/app/src/eigener-kalender";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { eigenerKalenderRoutes } from "../../services/app/src/routes/eigener-kalender-routes";
import { InMemoryTeamsRepo } from "../../services/app/src/teams";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { SimulierterAusfuehrungsdienst } from "./simulierte-zugaenge";

const KONTO_A = "kalender-pg-anna";
const KONTO_B = "kalender-pg-bert";

function nutzer(request: FastifyRequest): SessionUser | undefined {
  const konto = request.headers["x-test-konto"];
  return typeof konto === "string" && konto.length > 0 ? { id: konto, role: "experte" } : undefined;
}

const WAECHTER: Guards = {
  async requireUser(request: FastifyRequest, reply: FastifyReply) {
    const u = nutzer(request);
    if (!u) {
      reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
    return u;
  },
  async requirePermission(_recht, request: FastifyRequest, reply: FastifyReply) {
    const u = nutzer(request);
    if (!u) {
      reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
    return u;
  },
};

describe("Eigener Kalender gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const offen: { pool: Pool; app: FastifyInstance }[] = [];
  // SIMULIERT (kein Produktdienst): der Ausführungsdienst lebt ausserhalb des Kalenders und
  // überdauert dessen Neustart. Der Kalender selbst bewahrt nur die Verweise darauf.
  const dienst = new SimulierterAusfuehrungsdienst();
  dienst.auftragAnlegen("auftrag-l17", "Lizenz L-17 verlängern");
  dienst.laufSetzen("auftrag-l17", "lauf-l17-7t", "geplant");
  dienst.serieAnlegen("serie-lizenzen");

  /** Eine frische App mit eigenem Pool — so sieht ein Neustart des Servers aus. */
  async function neueApp(): Promise<FastifyInstance> {
    const pool = createPool(url);
    const app = Fastify();
    await app.register(
      eigenerKalenderRoutes(
        {
          dienst: new EigenerKalenderDienst({
            repo: new PgEigenerKalenderRepo(pool),
            teams: new InMemoryTeamsRepo(),
            quelleLesbar: async () => false,
            ausfuehrung: dienst,
          }),
          audit: new AuditService({ repo: new InMemoryAuditRepo() }),
        },
        WAECHTER,
      ),
    );
    await app.ready();
    offen.push({ pool, app });
    return app;
  }

  async function beenden(app: FastifyInstance): Promise<void> {
    const i = offen.findIndex((o) => o.app === app);
    const eintrag = offen[i];
    if (eintrag) {
      offen.splice(i, 1);
      await eintrag.app.close();
      await eintrag.pool.end();
    }
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(
        "KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr) — kein Container-Rückfall",
      );
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error("Weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar", {
          cause,
        });
      }
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    const pool = createPool(url);
    try {
      // Zweimal: die Stufe ist wiederholbar und lässt den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      await pool.query("DELETE FROM kalender_eintraege WHERE konto_id = ANY($1)", [
        [KONTO_A, KONTO_B],
      ]);
      await pool.query("DELETE FROM kalender_einstellungen WHERE konto_id = ANY($1)", [
        [KONTO_A, KONTO_B],
      ]);
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const o of [...offen]) {
      await beenden(o.app);
    }
    await container?.stop();
  });

  it("K1 · angelegt, geändert, Server neu gestartet — derselbe Eintrag mit derselben Kennung", async () => {
    const vorher = await neueApp();
    const anlage = await vorher.inject({
      method: "POST",
      url: "/api/me/kalender/eintraege",
      headers: { "x-test-konto": KONTO_A },
      payload: {
        art: "frist",
        titel: "Lizenz L-17 endet",
        ganztaegig: true,
        beginn: "2026-12-15",
        zeitzone: "Europe/Berlin",
        auftrag: { taskId: "auftrag-l17" },
        lauf: { runId: "lauf-l17-7t" },
        serie: { seriesId: "serie-lizenzen" },
      },
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    const angelegt = anlage.json().eintrag;
    const aenderung = await vorher.inject({
      method: "PUT",
      url: `/api/me/kalender/eintraege/${angelegt.id}`,
      headers: { "x-test-konto": KONTO_A },
      payload: { fassung: 1, notiz: "Fiktive Notiz nach der Änderung." },
    });
    expect(aenderung.statusCode, aenderung.body).toBe(200);
    const geaendert = aenderung.json().eintrag;
    await beenden(vorher);

    // Neustart: neuer Pool, neue App.
    const nachher = await neueApp();
    const liste = await nachher.inject({
      method: "GET",
      url: "/api/me/kalender",
      headers: { "x-test-konto": KONTO_A },
    });
    expect(liste.json().eintraege).toEqual([geaendert]);
    const einzeln = await nachher.inject({
      method: "GET",
      url: `/api/me/kalender/eintraege/${angelegt.id}`,
      headers: { "x-test-konto": KONTO_A },
    });
    expect(einzeln.json().eintrag).toEqual(geaendert);
    expect(geaendert).toMatchObject({ id: angelegt.id, fassung: 2, beginn: "2026-12-15" });

    // Ein anderes Konto sieht den persönlichen Eintrag auch nach dem Neustart nicht.
    const fremd = await nachher.inject({
      method: "GET",
      url: `/api/me/kalender/eintraege/${angelegt.id}`,
      headers: { "x-test-konto": KONTO_B },
    });
    expect(fremd.statusCode).toBe(404);

    // Eine bestätigte Kalenderaktion überlebt den nächsten Neustart; ein veralteter Schreiber nicht.
    // Die Serienpause wirkt beim (simulierten) Ausführungsdienst und wird nach dem Neustart über den
    // gespeicherten Verweis wieder von dort gelesen — der Kalender speichert sie nicht selbst.
    const pause = await nachher.inject({
      method: "POST",
      url: `/api/me/kalender/eintraege/${angelegt.id}/aktionen`,
      headers: { "x-test-konto": KONTO_A },
      payload: { aktion: "serie_pausieren", bestaetigt: true },
    });
    expect(pause.statusCode, pause.body).toBe(200);
    const ausgeblendet = await nachher.inject({
      method: "POST",
      url: `/api/me/kalender/eintraege/${angelegt.id}/aktionen`,
      headers: { "x-test-konto": KONTO_A },
      payload: { aktion: "anzeige_entfernen", bestaetigt: true },
    });
    expect(ausgeblendet.statusCode, ausgeblendet.body).toBe(200);
    const veraltet = await nachher.inject({
      method: "PUT",
      url: `/api/me/kalender/eintraege/${angelegt.id}`,
      headers: { "x-test-konto": KONTO_A },
      payload: { fassung: 2, titel: "Zweiter Tab" },
    });
    expect(veraltet.statusCode).toBe(409);
    await beenden(nachher);

    const dritte = await neueApp();
    const zuletzt = (
      await dritte.inject({
        method: "GET",
        url: `/api/me/kalender/eintraege/${angelegt.id}`,
        headers: { "x-test-konto": KONTO_A },
      })
    ).json().eintrag;
    expect(zuletzt).toMatchObject({
      id: angelegt.id,
      titel: "Lizenz L-17 endet",
      fassung: 3,
      ausgeblendet: true,
      auftrag: { taskId: "auftrag-l17", titel: "Lizenz L-17 verlängern", aufgeloest: true },
      serie: { seriesId: "serie-lizenzen", pausiert: true },
      lauf: { runId: "lauf-l17-7t", status: "geplant" },
    });

    // Löschen wirkt in der Datenbank — auch nach einem weiteren Neustart ist der Eintrag fort.
    const weg = await dritte.inject({
      method: "DELETE",
      url: `/api/me/kalender/eintraege/${angelegt.id}`,
      headers: { "x-test-konto": KONTO_A },
    });
    expect(weg.statusCode).toBe(200);
    await beenden(dritte);
    const vierte = await neueApp();
    const geloescht = await vierte.inject({
      method: "GET",
      url: `/api/me/kalender/eintraege/${angelegt.id}`,
      headers: { "x-test-konto": KONTO_A },
    });
    expect(geloescht.statusCode).toBe(404);
  });

  it("K4 · die Sichtwahl überlebt den Neustart und gehört genau einem Konto", async () => {
    const erste = await neueApp();
    for (const sichtmodus of ["beide", "vorhanden"]) {
      const res = await erste.inject({
        method: "PUT",
        url: "/api/me/kalender/einstellungen",
        headers: { "x-test-konto": KONTO_A },
        payload: { sichtmodus },
      });
      expect(res.statusCode, res.body).toBe(200);
    }
    await beenden(erste);
    const zweite = await neueApp();
    const a = await zweite.inject({
      method: "GET",
      url: "/api/me/kalender",
      headers: { "x-test-konto": KONTO_A },
    });
    expect(a.json().sichtmodus).toBe("vorhanden");
    const b = await zweite.inject({
      method: "GET",
      url: "/api/me/kalender",
      headers: { "x-test-konto": KONTO_B },
    });
    expect(b.json().sichtmodus).toBe("eigen");
  });
});
