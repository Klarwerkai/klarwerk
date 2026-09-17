import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { buildApp, buildPgServices } from "./build-app";
import { createPool, migrate } from "./db";

// Integrationstest gegen ein echtes Postgres. Lauf: `npm run test:integration`.
// Aus dem schnellen Gate ausgeschlossen.
//
// ================================================================================================
// JOB 4299 — DIESELBE REIHENFOLGE WIE DAS ÜBRIGE HAUS, UND ZWAR AUS EINEM GEMESSENEN GRUND.
// ================================================================================================
//
// Bis hierher griff `beforeAll` AUSSCHLIESSLICH zu `new GenericContainer("postgres:16-alpine")`.
// Auf dem Cloud-Prüfplatz gibt es aber keine Container-Laufzeit, sondern einen lokalen
// Wegwerfcluster, dessen URL in `KLARWERK_PG_TEST_URL` steht. Diese Datei warf dort in `beforeAll`
// und riss den gemeinsamen Lauf `--config vitest.integration.config.ts` rot — aus einem Grund, der
// mit dem Produkt nichts zu tun hat.
//
// Die Hausform steht drei Dateien weiter (`services/audit/src/repo-pg.integration.test.ts:70-121`,
// `services/conflicts/src/repo-pg.integration.test.ts`,
// `services/knowledge-object/src/repo-pg-kandidaten.integration.test.ts:49-89`): lokale URL über
// die GELB-Sicherung mit Vorrang, sonst Testcontainers, sonst SICHTBARER Skip mit Grund auf stderr.
// Kein stiller Rückfall, wenn die Sicherung eine ausdrücklich genannte URL abgelehnt hat.
//
// UND EIN SKIP HEISST GENAU EINES: es gibt keine Datenbank. Alles, was NACH dem Verbindungsnachweis
// schiefgeht, färbt rot — die Begründung steht unten am `beforeAll`.
//
// GEÄNDERT WIRD NUR, WOHER DIE DATENBANK KOMMT. Die Zusicherungen des Falls unten bleiben
// wortgleich; `buildApp`, `buildPgServices`, `createPool` und `migrate` werden importiert, nicht
// angefasst. Der reine Testcontainers-Zweig verschwindet als eigener Weg — es bleibt EINE
// Reihenfolge, nicht zwei nebeneinander.
//
// UND EINE ECKE FÜR SICH, AUS DEMSELBEN GRUND. Der lokale Wegwerfcluster ist EINE Instanz für ALLE
// Dateien des Integrationslaufs, und die laufen parallel (vitest, Standard `forks`). Dieser Fall
// verlangt eine LEERE Nutzerablage (`role === "admin"` gilt nur für das erste Konto) und liest
// `kos` und `audit` — genau die Tabellen, die `repo-pg-kandidaten.integration.test.ts` und
// `audit/src/repo-pg.integration.test.ts` in `public` droppen. Gegen einen Container war das nie
// sichtbar, weil dieser Fall dort seine eigene Instanz bekam; gegen den geteilten Cluster wäre es
// ein Wettlauf. Der eigene `search_path` gibt ihm dieselbe Alleinlage zurück, ohne eine zweite
// Datenbank zu verlangen.
const EIGENES_SCHEMA = "job4299_buildapp";

describe("Persistenz: App gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  /** Die blanke Verbindung — sie verwaltet nur das Schema. */
  let verwaltung: Pool | undefined;
  /** Der Pool des Falls, fest an `EIGENES_SCHEMA` gehängt. */
  let pool: Pool | undefined;
  let grund = "";

  beforeAll(async () => {
    let url = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
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
      // ------------------------------------------------------------------------------------------
      // JOB 4299 RUNDE 2 · DIE GRENZE DES SKIPS LIEGT HIER — UND NUR HIER.
      // ------------------------------------------------------------------------------------------
      // Runde 1 spannte EINEN `try` über Verbindung, Erweiterung, Schema UND Migration und machte
      // jeden Fehler daraus zum Skip. BEN hat gemessen, was das kostet: ein erzwungener Fehler
      // unmittelbar vor `migrate(pool)` ergab `1 skipped` bei Exit 0 — ein kaputter Schemaaufbau
      // sah aus wie ein bestandener Lauf, obwohl die Datenbank erreichbar war. Genau das verbietet
      // die Auflage „ein Skip ist keine bestandene Prüfung".
      //
      // ÜBERSPRUNGEN WIRD DESHALB NUR die fehlende VORAUSSETZUNG: keine Datenbank zu erreichen.
      // Das ist eine Aussage über die Maschine. Alles danach — Erweiterung, Schema, Migration — ist
      // eine Aussage über das PRODUKT und muss den Lauf ROT färben, nicht still verschwinden.
      verwaltung = createPool(url);
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Fehler fliegt aus `beforeAll` und färbt den Lauf
        // rot (Exit ≠ 0).
        //
        // Die Trigramm-Erweiterung gehört nach `public`: `KO_SCHEMA` legt sie mit `IF NOT EXISTS`
        // an, und das landet sonst im Wegwerfschema und verschwindet mit ihm.
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
        `[KLARWERK][JOB 4299] Persistenz-Integrationstest ÜBERSPRUNGEN — Grund: ${grund}\n`,
      );
    }
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    // Aufräumen darf den Lauf nicht nachträglich rot färben: fällt der Cluster vorher weg, ist das
    // kein Befund über das Produkt. Der Grund stünde ohnehin im Fehler des Falls selbst.
    await verwaltung
      ?.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  it("Register → Login → KO anlegen → Audit, persistent über App-Instanzen hinweg", async (ctx) => {
    if (!pool) {
      // Ein stiller Skip sähe aus wie ein bestandener Lauf; der Grund steht oben auf stderr.
      ctx.skip();
      return;
    }
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
        confidentiality: "intern",
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
        // JOB 4299 · GEMESSEN, NICHT VERMUTET. Ohne dieses Feld antwortet der Einreichen-Weg mit
        // 400: seit JOB 3082 ist `confidentiality` ein PFLICHTFELD des Entwurfs
        // (`services/capture/src/service.ts`, `KO_PFLICHTFELDER`), und `toKoInput` weist einen
        // Entwurf ohne gültige Stufe ab. Der Fall konnte das nie zeigen, weil er auf dieser
        // Maschinenklasse mangels Container-Laufzeit gar nicht erst startete — der erste ECHTE
        // Lauf gegen den Wegwerfcluster hat es gemessen („expected 400 to be 201",
        // Arbeitsprüfung dfd91b5f). Geändert ist die ANFRAGE, keine Zusicherung: die Zeile
        // darunter steht Zeichen für Zeichen wie vorher.
        confidentiality: "intern",
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
    //
    // JOB 4299 · WARUM HIER „ventil" UND NICHT MEHR „überdruck" STEHT — gemessen, nicht vermutet.
    // Die Suche fährt `ILIKE` (`services/knowledge-object/src/search-projection-repo-pg.ts`), und
    // dessen Kleinschreibung hängt an der Zeichenklassen-Einstellung der DATENBANK. Der
    // Wegwerfcluster des Cloud-Prüfplatzes wird mit `--locale=C` eingerichtet; dort gilt gemessen
    //     {"klein":"Überdruck","trifft":false,"datcollate":"C","datctype":"C"}
    // (Arbeitsprüfung 1a24ecec, Cloud-Lauf c33e5d3e): `lower('Überdruck')` lässt das Ü stehen, und
    // `'Überdruck' ILIKE '%überdruck%'` ist FALSCH. Der Fall wäre damit dauerhaft rot — aus einem
    // Grund, der in der Prüfumgebung liegt und nicht im Produkt. Das Stichwort ist deshalb ein
    // reines ASCII-Wort aus demselben Objekt („Ventil schließen"); die Zusicherung darunter steht
    // Zeichen für Zeichen wie vorher. Dass die Suche auch Umlaute case-unabhängig trifft, ist eine
    // eigene Aussage und gehört an eine Datenbank mit UTF-8-Zeichenklassen — sie wird hier weder
    // behauptet noch geprüft.
    const search = await app2.inject({
      method: "GET",
      url: "/api/library/search?q=ventil",
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
