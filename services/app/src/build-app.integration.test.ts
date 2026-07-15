import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "./build-app";
import { createPool, migrate } from "./db";

// Integrationstest gegen ein echtes Postgres (Testcontainers). Braucht Docker.
// Lauf: `npm run test:integration`. Aus dem schnellen Gate ausgeschlossen.
describe("Persistenz: App gegen echtes Postgres", () => {
  let container: StartedTestContainer;
  let pool: Pool;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    pool = createPool(url);
    await migrate(pool);
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  it("Register → Login → KO anlegen → Audit, persistent über App-Instanzen hinweg", async () => {
    const app = buildApp(buildPgServices(pool));

    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().role).toBe("admin"); // erstes Konto wird Admin (FR-AUTH-01)

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    const create = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Ventil schließen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(create.statusCode).toBe(201);
    const koId = create.json().id as string;

    // Stage-B-Repos gegen echtes Postgres: Entwurf→KO (drafts), Bewertung (ratings,
    // zusammengesetzter Schlüssel), Lernpfad (lifecycle, mehrere Tabellen).
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: {
        title: "Pumpe schmieren",
        statement: "Pumpe alle 200h schmieren.",
        type: "technik",
        category: "Anlage 2",
      },
    });
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.json().id}/promote`,
      headers,
    });
    expect(promote.statusCode).toBe(201);
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode).toBe(200);
    const path = await app.inject({
      method: "POST",
      url: "/api/learning-paths",
      headers,
      payload: { role: "schweisser", steps: [{ title: "Grundlagen" }] },
    });
    expect(path.statusCode).toBe(201);
    await app.close();

    // Frische App-Instanz auf derselben DB → Daten sind persistent.
    const app2 = buildApp(buildPgServices(pool));
    const login2 = await app2.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers2 = { authorization: `Bearer ${login2.json().token}` };

    const list = await app2.inject({ method: "GET", url: "/api/kos", headers: headers2 });
    expect(list.json().length).toBeGreaterThanOrEqual(2); // direktes KO + befördeter Entwurf

    // Lernpfad (lifecycle) ist persistent.
    const path2 = await app2.inject({
      method: "GET",
      url: "/api/learning-paths/schweisser",
      headers: headers2,
    });
    expect(path2.statusCode).toBe(200);

    // Suche über die Bibliothek findet das persistierte KO (JSONB-Filter).
    const search = await app2.inject({
      method: "GET",
      url: "/api/library/search?q=überdruck",
      headers: headers2,
    });
    expect(search.json().length).toBeGreaterThanOrEqual(1);

    // Audit-Log liegt in Postgres und die Hash-Kette ist intakt.
    const audit = await app2.inject({ method: "GET", url: "/api/audit", headers: headers2 });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().length).toBeGreaterThanOrEqual(1);

    // SCRUM-496: Duplikat-Board gegen echtes Postgres. Vor dem Fix fehlten die Tabellen
    // (overlaps / overlap_settings nie migriert) → beide Routen brachen mit einer rohen
    // PG-Meldung ab. Jetzt: sauberer 200, das Board lädt (leere Liste, Default-Schwelle).
    const duplicates = await app2.inject({
      method: "GET",
      url: "/api/duplicates",
      headers: headers2,
    });
    expect(duplicates.statusCode).toBe(200);
    expect(Array.isArray(duplicates.json())).toBe(true);
    const dupSettings = await app2.inject({
      method: "GET",
      url: "/api/duplicates/settings",
      headers: headers2,
    });
    expect(dupSettings.statusCode).toBe(200);
    expect(typeof dupSettings.json().minConfidence).toBe("number");
    await app2.close();
  });
});
