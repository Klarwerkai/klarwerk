// ================================================================================================
// ALTBELEG UND BILDBILANZ GEGEN ECHTES POSTGRESQL — SPEICHERN, NEUE INSTANZ, NEU LADEN, ANNEHMEN
// ================================================================================================
//
// JOB 4269 hat den historischen Beleg über `POST`/`GET /api/drafts` geschickt — gegen den
// Entwurfsspeicher im ARBEITSSPEICHER (`archiv/4269/runde-1/RUECKGABE.md`, NICHT GEMESSEN: „Kein
// PostgreSQL-Abnahmelauf … ausdrücklich KEIN Beleg für produktive Persistenz"). Hier läuft derselbe
// Weg gegen eine echte Datenbank, und zwar über ZWEI App-Instanzen: was die erste speichert, liest
// die zweite zurück. Ein Wert, der nur im Prozess überlebt, fällt damit auf.
//
//   1. Historischer Beleg (alter Wortlaut, vor dem 16.09.2026) → POST → neue Instanz → GET: Zeichen
//      für Zeichen derselbe Rumpf, auch direkt in der Zeile `drafts` → Annahme → neue Instanz →
//      GET /api/kos/:id: der alte Beleg steht unverändert am Eintrag, keine Bilanz nachgetragen.
//   2. Zwillingsdeck (identische und ausgeblendete Bilder, ein Verlust) → derselbe Weg: Bilanz und
//      Bildbytes stimmen an Entwurf und Eintrag mit den UNABHÄNGIGEN Originaldaten überein.
//
// Datenbank nach Hausform (`services/app/src/build-app.integration.test.ts`): lokale URL über die
// GELB-Sicherung mit Vorrang, sonst Testcontainers, sonst SICHTBARER Skip mit Grund auf stderr. Ein
// Skip heisst ausschliesslich: es gibt keine Datenbank. Eigenes Schema gegen den geteilten Cluster.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  ZWILLINGSDECK,
  ZWILLING_DATEINAME,
  belegText,
  rumpfBefunde,
  zwillingsdeck,
} from "./bildnachweis";
import { importieren } from "./messung";
import { BILANZ_PRAEFIX, VORBEHALT } from "./quittungspruefer";

const EIGENES_SCHEMA = "bildnachweis_altbeleg_pg";

/** Der Wortlaut, mit dem die Quittung bis zum 16.09.2026 einen Bilderverlust behauptete. */
const ALTER_WORTLAUT =
  "Best-Effort-Import aus PowerPoint — Text und Struktur je Folie übernommen; Layout, Animationen, Übergänge, Bilder und Sprechernotizen gehen verloren.";

const ZUGANG = { name: "Altbeleg", email: "altbeleg@bildnachweis.test", password: "secret123" };

function historischerEntwurf(): DraftPayload {
  return {
    ...wholeDocumentDraftPayload({
      fileName: "altes-deck.pptx",
      text: "Inhalt von damals",
      sourceKind: "pptx",
      locale: "de",
    }),
    confidentiality: "intern",
    bodyHtml: [
      "<blockquote><p>Quelle: altes-deck.pptx, gesamtes Dokument</p>",
      `<p>${ALTER_WORTLAUT}</p></blockquote><p>Inhalt von damals</p>`,
    ].join(""),
  } as DraftPayload;
}

async function zwillingsEntwurf(): Promise<DraftPayload> {
  const ergebnis = await importieren(zwillingsdeck());
  return {
    ...wholeDocumentDraftPayload({
      fileName: ZWILLING_DATEINAME,
      text: ergebnis.text,
      html: ergebnis.html,
      sourceKind: "pptx",
      locale: "de",
      sourceImageCount: ergebnis.imageCount,
    }),
    confidentiality: "intern",
  } as DraftPayload;
}

describe("Altbeleg und Bildbilanz — Persistenz gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let pool: Pool | undefined;
  let grund = "";

  beforeAll(async () => {
    let url = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt.";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (url) {
      verwaltung = createPool(url);
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // Ab hier wird nichts mehr gefangen: ein Fehler im Aufbau ist ein Befund, kein Skip.
        await verwaltung.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
        await verwaltung.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`);
        await verwaltung.query(`CREATE SCHEMA ${EIGENES_SCHEMA}`);
        pool = new Pool({
          connectionString: url,
          options: `-c search_path=${EIGENES_SCHEMA},public`,
        });
        await migrate(pool);
      }
    }
    if (!pool) {
      process.stderr.write(
        `[KLARWERK][Bildnachweis] PostgreSQL-Rundlauf ÜBERSPRUNGEN — Grund: ${grund}\n`,
      );
    }
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await verwaltung
      ?.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  /** Eine FRISCHE App-Instanz auf derselben Datenbank, angemeldet. */
  async function instanz(db: Pool, registrieren: boolean) {
    const app = buildApp(buildPgServices(db));
    if (registrieren) {
      const reg = await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
      expect(reg.statusCode, reg.body).toBe(201);
    }
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ZUGANG.email, password: ZUGANG.password },
    });
    expect(login.statusCode, login.body).toBe(200);
    const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
    return { app, headers };
  }

  it("speichern → neue Instanz → neu laden → annehmen → neue Instanz: Altbeleg unverändert, Bilanz und Bilder wie im Original", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const alt = historischerEntwurf();
    const zwilling = await zwillingsEntwurf();

    // ---- Instanz 1: speichern ----------------------------------------------------------------
    const eins = await instanz(pool, true);
    const ids: string[] = [];
    for (const entwurf of [alt, zwilling]) {
      const res = await eins.app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: eins.headers,
        payload: entwurf,
      });
      expect(res.statusCode, res.body).toBeLessThan(300);
      ids.push((res.json() as { id: string }).id);
    }
    await eins.app.close();
    const [altId, zwillingId] = ids as [string, string];

    // ---- Die Zeile in der Datenbank selbst — kein Prozessgedächtnis dazwischen ----------------
    const zeile = await pool.query<{ rumpf: string }>(
      "SELECT data->'payload'->>'bodyHtml' AS rumpf FROM drafts WHERE id = $1",
      [altId],
    );
    expect(zeile.rows[0]?.rumpf, "Altbeleg in der Zeile drafts").toBe(alt.bodyHtml);

    // ---- Instanz 2: neu laden, dann annehmen ---------------------------------------------------
    const zwei = await instanz(pool, false);
    const koIds: string[] = [];
    for (const id of [altId, zwillingId]) {
      const geladen = await zwei.app.inject({
        method: "GET",
        url: `/api/drafts/${id}`,
        headers: zwei.headers,
      });
      expect(geladen.statusCode, geladen.body).toBe(200);
      const rumpf = (geladen.json() as { payload: { bodyHtml?: string } }).payload.bodyHtml ?? "";
      if (id === altId) {
        expect(rumpf, "der Altbeleg hat die neue Instanz nicht unverändert erreicht").toBe(
          alt.bodyHtml,
        );
      } else {
        expect(rumpfBefunde(rumpf, "de", ZWILLINGSDECK), "Zwillingsentwurf neu geladen").toEqual(
          [],
        );
      }
      const angenommen = await zwei.app.inject({
        method: "POST",
        url: `/api/drafts/${id}/promote`,
        headers: zwei.headers,
      });
      expect(angenommen.statusCode, angenommen.body).toBe(201);
      koIds.push((angenommen.json() as { id: string }).id);
    }
    await zwei.app.close();
    const [altKo, zwillingKo] = koIds as [string, string];

    // ---- Instanz 3: der angenommene Eintrag, erneut geöffnet -----------------------------------
    const drei = await instanz(pool, false);
    const lies = async (id: string) => {
      const res = await drei.app.inject({
        method: "GET",
        url: `/api/kos/${id}`,
        headers: drei.headers,
      });
      expect(res.statusCode, res.body).toBe(200);
      return (res.json() as { bodyHtml?: string }).bodyHtml ?? "";
    };
    const altAmEintrag = await lies(altKo);
    expect(belegText(altAmEintrag), "der Altbeleg am Eintrag").toBe(
      `Quelle: altes-deck.pptx, gesamtes Dokument ${ALTER_WORTLAUT}`,
    );
    expect(altAmEintrag).not.toContain(VORBEHALT.de);
    expect(altAmEintrag).not.toContain(BILANZ_PRAEFIX.de);
    expect(rumpfBefunde(await lies(zwillingKo), "de", ZWILLINGSDECK), "Zwillingseintrag").toEqual(
      [],
    );
    await drei.app.close();
  });
});
