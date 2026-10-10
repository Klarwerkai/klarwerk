// ================================================================================================
// ADMIN-15 · DER ECHTE SPEICHERWEG — PostgreSQL über einen Neustart hinweg (K1, K4, K6).
// ================================================================================================
//
// `unternehmen-api.test.ts` misst den Draht an der Speicherablage. „Nach Reload erhalten" und
// „ohne Verlust alter Fassungen" sind erst belegt, wenn Profil, Richtlinienfassungen und
// Handlungen eine ECHTE Datenbank, einen neuen Pool und eine neue App überleben. Dieselben Routen
// (`unternehmenRoutes`), dieselbe Ablage (`PgUnternehmenRepo`), das ausgeführte `migrate()` mit
// `UNTERNEHMEN_SCHEMA`.
//
// Die Rechte kommen aus der echten Rechtematrix (`can`) hinter einem schmalen Kopfzeilen-Wächter —
// Anmeldung ist hier nicht Gegenstand. Alle Daten sind fiktiv („Nordtal").
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { unternehmenRoutes } from "../../services/app/src/routes/unternehmen-routes";
import { PgUnternehmenRepo, UnternehmenDienst } from "../../services/app/src/unternehmensprofil";
import type { Role } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { can } from "../../services/rbac";
import { alsLogo, pngLogo } from "../../tests-smoke/support/logo-bild";

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

const KONTEN = ROLLEN.map((role) => ({
  id: `u-${role}`,
  name: `Nordtal ${role}`,
  role,
  approved: true,
}));

const ADMIN = { "x-test-rolle": "admin" };
const EXPERTE = { "x-test-rolle": "experte" };
const LOGO = alsLogo(pngLogo(120, 40), "image/png");

describe("Unternehmensprofil und Richtlinien gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const offen: { pool: Pool; app: FastifyInstance }[] = [];

  /** Eine frische App mit eigenem Pool — so sieht ein Neustart des Servers aus. */
  async function neueApp(): Promise<FastifyInstance> {
    const pool = createPool(url);
    const app = Fastify();
    await app.register(
      unternehmenRoutes(
        {
          dienst: new UnternehmenDienst({
            repo: new PgUnternehmenRepo(pool),
            konten: async () => KONTEN,
          }),
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
      // Nur in der Testdatenbank: ein früherer Lauf soll diese Messung nicht vorbelegen.
      await pool.query("DELETE FROM unternehmensprofil_fassungen");
      await pool.query("DELETE FROM richtlinien_handlungen");
      await pool.query("DELETE FROM richtlinien_fassungen");
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

  it("K1/K6 · Profil mit Logo überlebt den Neustart; von zwei gleichzeitigen Schreibern gewinnt einer", async () => {
    const a = await neueApp();
    const b = await neueApp();
    const [x, y] = await Promise.all([
      a.inject({
        method: "PUT",
        url: "/api/admin/unternehmensprofil",
        headers: ADMIN,
        payload: { version: 0, name: "Nordtal", logo: LOGO, akzent: "tannengruen" },
      }),
      b.inject({
        method: "PUT",
        url: "/api/admin/unternehmensprofil",
        headers: ADMIN,
        payload: { version: 0, name: "Nordtal Zweit", logo: null, akzent: "anthrazit" },
      }),
    ]);
    expect([x?.statusCode, y?.statusCode].sort()).toEqual([200, 409]);
    const gewinner = (x?.statusCode === 200 ? x : y)?.json();
    await beenden(a);
    await beenden(b);

    const nachher = await neueApp();
    const v2 = await nachher.inject({
      method: "PUT",
      url: "/api/admin/unternehmensprofil",
      headers: ADMIN,
      payload: { version: 1, name: "Nordtal AG", logo: LOGO, akzent: "nachtblau" },
    });
    expect(v2.statusCode, v2.body).toBe(200);
    await beenden(nachher);

    const dritte = await neueApp();
    const lesen = await dritte.inject({
      method: "GET",
      url: "/api/unternehmensprofil",
      headers: EXPERTE,
    });
    expect(lesen.json()).toEqual({
      version: 2,
      profil: {
        name: "Nordtal AG",
        logo: { typ: "image/png", daten: LOGO.daten, breite: 120, hoehe: 40 },
        akzent: { id: "nachtblau", flaeche: "#1f3a5f", schrift: "#ffffff" },
      },
    });
    const verlauf = await dritte.inject({
      method: "GET",
      url: "/api/admin/unternehmensprofil",
      headers: ADMIN,
    });
    expect(verlauf.json().fassungen).toEqual([gewinner, v2.json()]);
  });

  it("K4/K6 · zwei Fassungen und ihre Handlungen überleben den Neustart; ein Doppelklick bleibt eine Zeile", async () => {
    const a = await neueApp();
    const eingabe = {
      titel: "Hausordnung Nordtal",
      text: "Besucher melden sich am Empfang an.",
      verantwortlich: "Personalabteilung Nordtal",
      gueltigAb: "2026-10-12",
      rollen: [],
      anforderung: "kenntnisnahme",
    };
    const w1 = await a.inject({
      method: "POST",
      url: "/api/admin/richtlinien/wirkung",
      headers: ADMIN,
      payload: { id: null, anforderung: "kenntnisnahme", rollen: [] },
    });
    const f1 = await a.inject({
      method: "POST",
      url: "/api/admin/richtlinien",
      headers: ADMIN,
      payload: { ...eingabe, wirkung: w1.json() },
    });
    expect(f1.statusCode, f1.body).toBe(201);
    const id = f1.json().fassung.id as string;
    // Zwei gleichzeitige Kenntnisnahmen derselben Person zu derselben Fassung: eine Zeile.
    const [k1, k2] = await Promise.all(
      [0, 1].map(() =>
        a.inject({
          method: "POST",
          url: `/api/richtlinien/${id}/handlungen`,
          headers: EXPERTE,
          payload: { fassung: 1, handlung: "kenntnisnahme" },
        }),
      ),
    );
    expect([k1?.statusCode, k2?.statusCode].sort()).toEqual([200, 201]);
    await beenden(a);

    const b = await neueApp();
    const w2 = await b.inject({
      method: "POST",
      url: "/api/admin/richtlinien/wirkung",
      headers: ADMIN,
      payload: { id, anforderung: "zustimmung", rollen: [] },
    });
    expect(w2.json()).toMatchObject({ erneut: true, bisherigeFassung: 1, bisherigeHandlungen: 1 });
    const f2 = await b.inject({
      method: "POST",
      url: `/api/admin/richtlinien/${id}/fassungen`,
      headers: ADMIN,
      payload: {
        ...eingabe,
        anforderung: "zustimmung",
        gesehen: 1,
        aenderungsgrund: "Zustimmung verlangt",
        wirkung: w2.json(),
      },
    });
    expect(f2.statusCode, f2.body).toBe(201);
    const z = await b.inject({
      method: "POST",
      url: `/api/richtlinien/${id}/handlungen`,
      headers: EXPERTE,
      payload: { fassung: 2, handlung: "zustimmung" },
    });
    expect(z.statusCode).toBe(201);
    await beenden(b);

    const c = await neueApp();
    const protokoll = await c.inject({
      method: "GET",
      url: `/api/admin/richtlinien/${id}/protokoll`,
      headers: ADMIN,
    });
    expect(protokoll.json().fassungen.map((f: { fassung: number }) => f.fassung)).toEqual([1, 2]);
    expect(
      (protokoll.json().eintraege as { personId: string; fassung: number; handlung: string }[]).map(
        (e) => [e.personId, e.fassung, e.handlung],
      ),
    ).toEqual([
      ["u-experte", 1, "kenntnisnahme"],
      ["u-experte", 2, "zustimmung"],
    ]);
    const meine = await c.inject({ method: "GET", url: "/api/richtlinien", headers: EXPERTE });
    expect(meine.json().richtlinien).toMatchObject([
      { id, fassung: 2, meineHandlung: { fassung: 2, handlung: "zustimmung" } },
    ]);
  });
});
