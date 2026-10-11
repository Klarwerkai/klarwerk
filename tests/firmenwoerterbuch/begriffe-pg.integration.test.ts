// ================================================================================================
// FIRMENWÖRTERBUCH · DER ECHTE SPEICHERWEG — PostgreSQL über einen Neustart hinweg (K1, K5).
// ================================================================================================
//
// `begriffe-api.test.ts` misst den Draht an der Speicherablage. Ein „Neuladen erhält die konkrete
// Fassung" ist aber erst belegt, wenn die Fassung eine ECHTE Datenbank, einen neuen Pool und eine
// neue App überlebt. Genau das steht hier: dieselben Routen (`begriffeRoutes`), dieselbe Ablage
// (`PgBegriffeRepo`), das ausgeführte `migrate()` mit `BEGRIFFE_SCHEMA`.
//
// Die Rechte kommen aus der echten Rechtematrix (`can` aus services/rbac) hinter einem schmalen
// Kopfzeilen-Wächter — Anmeldung ist hier nicht Gegenstand (dafür `begriffe-api.test.ts`).
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgBegriffeRepo } from "../../services/app/src/firmenwoerterbuch";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { begriffeRoutes } from "../../services/app/src/routes/begriffe-routes";
import type { Role } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { can } from "../../services/rbac";

const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];

function nutzer(request: FastifyRequest): SessionUser | undefined {
  const rolle = request.headers["x-test-rolle"];
  return typeof rolle === "string" && (ROLLEN as readonly string[]).includes(rolle)
    ? { id: `u-${rolle}`, role: rolle as Role }
    : undefined;
}

const WAECHTER: Guards = {
  async requireUser(request: FastifyRequest, reply: FastifyReply) {
    const u = nutzer(request);
    if (!u) {
      reply.code(401).send({ error: "INVALID_CREDENTIALS" });
    }
    return u;
  },
  async requirePermission(recht, request: FastifyRequest, reply: FastifyReply) {
    const u = nutzer(request);
    if (!u) {
      reply.code(401).send({ error: "INVALID_CREDENTIALS" });
      return undefined;
    }
    if (!can(u.role, recht)) {
      reply.code(403).send({ error: "FORBIDDEN" });
      return undefined;
    }
    return u;
  },
};

const PFLEGE = { "x-test-rolle": "controller" };
const LESEN = { "x-test-rolle": "viewer" };

const EINTRAG = {
  geltungsbereich: "Instandhaltung",
  verantwortlich: "Leitung Instandhaltung",
  definition: { de: "Geplanter Austausch eines Verschleissteils.", en: "Planned replacement." },
  bezeichnungen: {
    de: { vorzug: "Teiletausch", synonyme: ["Teilewechsel"], unerwuenscht: ["Teiletauschung"] },
    en: { vorzug: "part replacement", synonyme: [], unerwuenscht: ["part swap"] },
  },
};

describe("Firmenwörterbuch gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const offen: { pool: Pool; app: FastifyInstance }[] = [];

  /** Eine frische App mit eigenem Pool — so sieht ein Neustart des Servers aus. */
  async function neueApp(): Promise<FastifyInstance> {
    const pool = createPool(url);
    const app = Fastify();
    await app.register(begriffeRoutes({ begriffe: new PgBegriffeRepo(pool) }, WAECHTER));
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
      await pool.query("DELETE FROM begriffe_fassungen WHERE data->>'geltungsbereich' = $1", [
        EINTRAG.geltungsbereich,
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

  it("K1 · angelegt, Server neu gestartet — dieselbe Fassung kommt Zeichen für Zeichen zurück", async () => {
    const vorher = await neueApp();
    const res = await vorher.inject({
      method: "POST",
      url: "/api/begriffe",
      headers: PFLEGE,
      payload: EINTRAG,
    });
    expect(res.statusCode, res.body).toBe(201);
    const angelegt = res.json();
    await beenden(vorher);

    const nachher = await neueApp();
    const liste = await nachher.inject({ method: "GET", url: "/api/begriffe", headers: LESEN });
    const meine = liste.json().begriffe.filter((b: { id: string }) => b.id === angelegt.id);
    expect(meine).toEqual([angelegt]);
    const einzeln = await nachher.inject({
      method: "GET",
      url: `/api/begriffe/${angelegt.id}`,
      headers: LESEN,
    });
    expect(einzeln.json()).toEqual({ aktuell: angelegt, fassungen: [angelegt] });
    // Unberechtigte Pflege bleibt auch hier abgewiesen.
    const verboten = await nachher.inject({
      method: "POST",
      url: "/api/begriffe",
      headers: { "x-test-rolle": "experte" },
      payload: { ...EINTRAG, geltungsbereich: "Instandhaltung" },
    });
    expect(verboten.statusCode).toBe(403);
  });

  it("K5 · Fassung 2 und Fassung 1 überleben den Neustart; ein veralteter Schreiber kommt nicht durch", async () => {
    const erste = await neueApp();
    const ersteFassung = {
      geltungsbereich: "Instandhaltung",
      verantwortlich: "Leitung Instandhaltung",
      definition: { de: "Zeitraum, in dem eine Anlage gewartet werden darf." },
      bezeichnungen: { de: { vorzug: "Wartungsfenster" } },
    };
    const anlage = await erste.inject({
      method: "POST",
      url: "/api/begriffe",
      headers: PFLEGE,
      payload: ersteFassung,
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    const angelegt = anlage.json();
    const zweiteFassung = {
      ...ersteFassung,
      version: 1,
      bezeichnungen: { de: { vorzug: "Wartungsfenster", unerwuenscht: ["Wartungszeitchen"] } },
    };
    // Zwei Server schreiben GLEICHZEITIG auf denselben Stand: genau einer gewinnt.
    const zweite = await neueApp();
    const [a, b] = await Promise.all([
      erste.inject({
        method: "PUT",
        url: `/api/begriffe/${angelegt.id}`,
        headers: PFLEGE,
        payload: zweiteFassung,
      }),
      zweite.inject({
        method: "PUT",
        url: `/api/begriffe/${angelegt.id}`,
        headers: PFLEGE,
        payload: { ...zweiteFassung, verantwortlich: "Zweiter Server" },
      }),
    ]);
    expect([a?.statusCode, b?.statusCode].sort()).toEqual([200, 409]);
    await beenden(erste);
    await beenden(zweite);

    const nachher = await neueApp();
    const eintrag = await nachher.inject({
      method: "GET",
      url: `/api/begriffe/${angelegt.id}`,
      headers: LESEN,
    });
    const verlauf = eintrag.json();
    expect(verlauf.fassungen.map((f: { version: number }) => f.version)).toEqual([1, 2]);
    const alt = await nachher.inject({
      method: "GET",
      url: `/api/begriffe/${angelegt.id}/fassungen/1`,
      headers: LESEN,
    });
    expect(alt.json()).toEqual(angelegt);
    const pruefung = await nachher.inject({
      method: "POST",
      url: "/api/begriffe/pruefen",
      headers: LESEN,
      payload: { segmente: ["Das Wartungszeitchen ist kurz."], kontext: "Instandhaltung" },
    });
    expect(pruefung.json().hinweise).toMatchObject([
      { begriffId: angelegt.id, begriffVersion: 2, vorzug: "Wartungsfenster" },
    ]);
  });
});
