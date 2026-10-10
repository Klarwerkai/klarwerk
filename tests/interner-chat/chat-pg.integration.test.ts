// ================================================================================================
// INTERNER CHAT · DER ECHTE SPEICHERWEG — PostgreSQL und Neustart (K1, K2, K3, K6).
// ================================================================================================
//
// `chat-api.test.ts` misst den Draht an der Speicherablage. Hier steht, was erst gegen eine ECHTE
// Datenbank belegt ist:
//   K1/K2 · Gespräche und Nachrichten überleben einen Neustart (neuer Pool, neue App) — in
//           Reihenfolge, mit Absender, und eine wiederholte Sendung steht genau EINMAL in der Tabelle
//           (Unique-Schlüssel), auch wenn beide Sendungen gleichzeitig ankommen.
//   K3    · Die Erwähnung ist nach dem Neustart noch da und zeigt auf dieselbe Nachricht.
//   K6    · Der Übernahmevermerk und der Entwurf überleben den Neustart; eine zweite Übernahme legt
//           keinen zweiten Entwurf an.
//
// Der volle Produktaufbau: `migrate()` (mit `CHAT_SCHEMA`, zweimal), `buildPgServices`, `buildApp`.
// Jede Ausführung bekommt eine EIGENE, frische Datenbank und räumt sie danach ab. Alle Namen und
// Inhalte sind erfundene Testdaten.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";

describe("Interner Chat gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  const offen: { pool: Pool; app: App }[] = [];

  async function neueApp(): Promise<{ app: App; pool: Pool }> {
    const pool = createPool(url);
    const app = buildApp(buildPgServices(pool));
    await app.ready();
    offen.push({ pool, app });
    return { app, pool };
  }

  async function beenden(app: App): Promise<void> {
    const i = offen.findIndex((o) => o.app === app);
    const eintrag = offen[i];
    if (eintrag) {
      offen.splice(i, 1);
      await eintrag.app.close();
      await eintrag.pool.end();
    }
  }

  async function anmelden(app: App, email: string): Promise<Kopf> {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: KENNWORT },
    });
    expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
    return { authorization: `Bearer ${res.json().token}` };
  }

  beforeAll(async () => {
    let basis: string;
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basis = lokal;
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
      basis = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    datenbank = `klarwerk_chat_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    const pool = createPool(url);
    try {
      // Zweimal: die Stufen sind wiederholbar und lassen den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      await buildPgServices(pool).ko.activateSearchProjectionV2();
    } finally {
      await pool.end();
    }
  }, 300_000);

  afterAll(async () => {
    for (const o of [...offen]) {
      await beenden(o.app);
    }
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end();
    }
    await container?.stop();
  }, 120_000);

  it("Verlauf, Erwähnung und Übernahme überleben den Neustart; nichts steht doppelt", async () => {
    // --- Erster Server -------------------------------------------------------------------------
    const { app: erste, pool: erstePool } = await neueApp();
    await erste.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "admin@chat-pg.test", password: KENNWORT },
    });
    const admin = await anmelden(erste, "admin@chat-pg.test");
    for (const [name, email] of [
      ["Lea Leitung", "lea@chat-pg.test"],
      ["Erik Experte", "erik@chat-pg.test"],
      ["Fritz Fremd", "fritz@chat-pg.test"],
    ] as const) {
      const res = await erste.inject({
        method: "POST",
        url: "/api/users",
        headers: admin,
        payload: { name, email, password: KENNWORT, role: "experte" },
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const lea = await anmelden(erste, "lea@chat-pg.test");
    const erik = await anmelden(erste, "erik@chat-pg.test");
    const konten = (
      await erste.inject({ method: "GET", url: "/api/chat/konten", headers: lea })
    ).json().konten as { id: string; name: string }[];
    const id = (name: string): string => konten.find((k) => k.name === name)?.id ?? "";

    // Zwei gleichzeitige Anlagen desselben Direktgesprächs ergeben EIN Gespräch.
    const [a, b] = await Promise.all([
      erste.inject({
        method: "POST",
        url: "/api/chat/gespraeche",
        headers: lea,
        payload: { art: "direkt", teilnehmer: [id("Erik Experte")] },
      }),
      erste.inject({
        method: "POST",
        url: "/api/chat/gespraeche",
        headers: erik,
        payload: { art: "direkt", teilnehmer: [id("Lea Leitung")] },
      }),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(a.json().id).toBe(b.json().id);
    const gespraechId = a.json().id as string;
    const nachrichtenUrl = `/api/chat/gespraeche/${gespraechId}/nachrichten`;

    const erste1 = await erste.inject({
      method: "POST",
      url: nachrichtenUrl,
      headers: lea,
      payload: { text: "Hallo Erik, Bohrwerk ab 14 Uhr frei?", sendeKennung: "pg-sendung-0001" },
    });
    expect(erste1.statusCode, erste1.body).toBe(201);
    // Dieselbe Sendung doppelt und GLEICHZEITIG — die Tabelle hält sie einmal.
    const sendung = {
      text: "@Erik Experte bitte bestätigen.",
      sendeKennung: "pg-sendung-0002",
      erwaehnungen: [id("Erik Experte")],
    };
    const [x, y] = await Promise.all([
      erste.inject({ method: "POST", url: nachrichtenUrl, headers: lea, payload: sendung }),
      erste.inject({ method: "POST", url: nachrichtenUrl, headers: lea, payload: sendung }),
    ]);
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 201]);
    expect(x.json().nachricht.id).toBe(y.json().nachricht.id);
    const erwaehnteId = x.json().nachricht.id as string;
    const antwort = await erste.inject({
      method: "POST",
      url: nachrichtenUrl,
      headers: erik,
      payload: { text: "Bestätigt, 14 Uhr.", sendeKennung: "pg-sendung-0003" },
    });
    expect(antwort.statusCode, antwort.body).toBe(201);

    const uebernahme = await erste.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${erste1.json().nachricht.id}/wissen`,
      headers: erik,
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(201);
    const entwurfId = uebernahme.json().entwurfId as string;

    const gezaehlt = await erstePool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM chat_nachrichten WHERE gespraech_id = $1",
      [gespraechId],
    );
    expect(gezaehlt.rows[0]?.n).toBe(3);
    await beenden(erste);

    // --- Zweiter Server: neuer Pool, neue App ----------------------------------------------------
    const { app: zweite } = await neueApp();
    const lea2 = await anmelden(zweite, "lea@chat-pg.test");
    const erik2 = await anmelden(zweite, "erik@chat-pg.test");
    const fritz2 = await anmelden(zweite, "fritz@chat-pg.test");

    const verlauf = await zweite.inject({
      method: "GET",
      url: `/api/chat/gespraeche/${gespraechId}`,
      headers: erik2,
    });
    expect(verlauf.statusCode, verlauf.body).toBe(200);
    const nachrichten = verlauf.json().nachrichten as {
      id: string;
      text: string;
      vonName: string;
      eigeneUebernahme: { entwurfId: string } | null;
    }[];
    expect(nachrichten.map((n) => [n.vonName, n.text])).toEqual([
      ["Lea Leitung", "Hallo Erik, Bohrwerk ab 14 Uhr frei?"],
      ["Lea Leitung", "@Erik Experte bitte bestätigen."],
      ["Erik Experte", "Bestätigt, 14 Uhr."],
    ]);
    expect(nachrichten[0]?.eigeneUebernahme?.entwurfId).toBe(entwurfId);

    const liste = await zweite.inject({
      method: "GET",
      url: "/api/chat/gespraeche",
      headers: lea2,
    });
    const zeile = (
      liste.json().gespraeche as { id: string; anzahl: number; letzte: { text: string } }[]
    ).find((g) => g.id === gespraechId);
    expect(zeile).toMatchObject({ anzahl: 3, letzte: { text: "Bestätigt, 14 Uhr." } });

    const erwaehnt = await zweite.inject({
      method: "GET",
      url: "/api/chat/erwaehnungen",
      headers: erik2,
    });
    expect(erwaehnt.json().erwaehnungen).toEqual([
      expect.objectContaining({ nachrichtId: erwaehnteId, gespraechId }),
    ]);

    // Die Übernahme nach dem Neustart öffnet denselben Entwurf, legt keinen zweiten an.
    const nochmal = await zweite.inject({
      method: "POST",
      url: `/api/chat/nachrichten/${nachrichten[0]?.id}/wissen`,
      headers: erik2,
    });
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect(nochmal.json().entwurfId).toBe(entwurfId);
    const entwuerfe = await zweite.inject({ method: "GET", url: "/api/drafts", headers: erik2 });
    expect((entwuerfe.json() as { id: string }[]).filter((d) => d.id === entwurfId)).toHaveLength(
      1,
    );

    // Ein Unbeteiligter sieht auch nach dem Neustart nichts.
    const fremd = await zweite.inject({
      method: "GET",
      url: `/api/chat/gespraeche/${gespraechId}`,
      headers: fritz2,
    });
    expect(fremd.statusCode).toBe(404);
    await beenden(zweite);
  }, 120_000);
});
