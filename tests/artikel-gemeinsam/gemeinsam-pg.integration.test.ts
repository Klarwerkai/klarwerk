// ================================================================================================
// ARTIKEL-GEMEINSAM · ZWEI APP-PROZESSE, EINE DATENBANK, NEUSTART (K1, K2, K5, K6).
// ================================================================================================
//
// `gemeinsam-am-server.test.ts` misst den Draht an der Speicherablage. Hier steht, was erst gegen
// eine ECHTE PostgreSQL-Datenbank belegt ist:
//   P1 (K1) Zwei App-Prozesse legen gleichzeitig den Entwurf desselben Artikels an — es gibt genau
//           EINEN offenen (partieller Unique-Index), und beide Prozesse sehen denselben.
//   P2 (K2) Anna speichert über Prozess A, Bernd gleichzeitig über Prozess B an verschiedenen
//           Abschnitten: der bedingte UPDATE lässt nur einen direkt durch, der andere wird gegen
//           den neuen Stand zusammengeführt — beide Änderungen stehen in der Tabelle. Derselbe
//           Abschnitt über zwei Prozesse ist ein 409; die Tabelle trägt den Stand des Gewinners.
//   P3 (K5/K6) Nach einem Neustart (neue Pools, neue Apps) liegt der Entwurf mit Verlauf und
//           Beteiligten unverändert vor; ein Speichern auf altem Arbeitsstand wird zusammengeführt;
//           die Übernahme über den bestehenden Weg wird von einem DRITTEN, frisch gestarteten
//           Prozess als Fassung gelesen.
//
// Der volle Produktaufbau: `migrate()` (mit `GEMEINSAMER_ENTWURF_SCHEMA`, zweimal),
// `buildPgServices`, `buildApp`. Jede Ausführung bekommt eine EIGENE, frische Datenbank und räumt
// sie danach ab. Alle Namen und Inhalte sind erfundene Testdaten.
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
const TITEL = "Spindelschmierung am Bohrwerk";
const A1 = "Die Spindel wird jede Woche geschmiert.";
const A2 = "Verwendet wird Fett der Klasse 2.";
const A3 = "Danach den Probelauf starten.";
const TEXT = [A1, A2, A3].join("\n\n");
const A1_NEU = "Die Spindel wird jeden Montag geschmiert.";
const A3_NEU = "Danach den Probelauf mit halber Drehzahl starten.";

interface Zeile {
  offen: boolean;
  revision: number;
  text: string;
}

interface Lage {
  entwurf: {
    id: string;
    revision: number;
    text: string;
    beteiligte: string[];
    verlauf: Array<{ art: string }>;
  } | null;
  abgeschlossen: { zustand: string } | null;
  uebernahme: {
    revision: number;
    basisVersion: number;
    aenderung: { title: string; statement: string; bodyHtml?: string };
  } | null;
}

describe("Gemeinsamer Artikelentwurf gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  /** Eine eigene Verbindung zur Testdatenbank, an der die Tabelle direkt gelesen wird. */
  let direkt: Pool | undefined;
  const offen: { pool: Pool; app: App }[] = [];

  async function neueApp(): Promise<App> {
    const pool = createPool(url);
    const app = buildApp(buildPgServices(pool));
    await app.ready();
    offen.push({ pool, app });
    return app;
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

  type Methode = "GET" | "POST" | "PUT";
  function api(app: App, kopf: Kopf, method: Methode, pfad: string, rumpf?: unknown) {
    return app.inject({
      method,
      url: pfad,
      headers: kopf,
      ...(rumpf === undefined ? {} : { payload: rumpf as Record<string, unknown> }),
    });
  }

  /** Die Zeilen der Tabelle selbst — gelesen an der Datenbank, nicht über die App. */
  async function tabelle(koId: string): Promise<Zeile[]> {
    const res = await (direkt as Pool).query<{
      offen: boolean;
      revision: number;
      data: { stand: { text: string } };
    }>("SELECT offen, revision, data FROM gemeinsame_entwuerfe WHERE ko_id = $1", [koId]);
    return res.rows.map((z) => ({ offen: z.offen, revision: z.revision, text: z.data.stand.text }));
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
    datenbank = `klarwerk_gemeinsam_test_${`${Date.now()}`.slice(-9)}`;
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
    direkt = new Pool({ connectionString: url });
  }, 300_000);

  afterAll(async () => {
    for (const o of [...offen]) {
      await beenden(o.app);
    }
    await direkt?.end();
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end();
    }
    await container?.stop();
  }, 120_000);

  it("P1–P3: ein Entwurf über zwei Prozesse, Zusammenführung, Konflikt, Neustart, Übernahme", async () => {
    // --- Zwei App-Prozesse gegen dieselbe Datenbank ---------------------------------------------
    const a = await neueApp();
    const b = await neueApp();
    await a.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "admin@gemeinsam-pg.test", password: KENNWORT },
    });
    const admin = await anmelden(a, "admin@gemeinsam-pg.test");
    for (const [name, email] of [
      ["Anna Beispiel", "anna@gemeinsam-pg.test"],
      ["Bernd Beispiel", "bernd@gemeinsam-pg.test"],
    ] as const) {
      const res = await api(a, admin, "POST", "/api/users", {
        name,
        email,
        password: KENNWORT,
        role: "experte",
      });
      expect(res.statusCode, res.body).toBe(201);
    }
    const anna = await anmelden(a, "anna@gemeinsam-pg.test");
    const bernd = await anmelden(b, "bernd@gemeinsam-pg.test");
    const angelegt = await api(a, admin, "POST", "/api/kos", {
      confidentiality: "intern",
      title: TITEL,
      statement: TEXT,
      bodyHtml: `<p>${A1}</p><p>${A2}</p><p>${A3}</p>`,
      type: "best_practice",
      category: "Instandhaltung",
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = (angelegt.json() as { id: string }).id;
    const pfad = `/api/kos/${koId}/gemeinsam`;

    // --- P1 · gleichzeitig anlegen über zwei Prozesse: EIN offener Entwurf --------------------
    const [vonA, vonB] = await Promise.all([
      api(a, anna, "POST", pfad),
      api(b, bernd, "POST", pfad),
    ]);
    expect([vonA.statusCode, vonB.statusCode].sort()).toEqual([200, 201]);
    const idA = (vonA.json() as Lage).entwurf?.id;
    expect((vonB.json() as Lage).entwurf?.id).toBe(idA);
    expect((await tabelle(koId)).filter((z) => z.offen)).toHaveLength(1);

    // --- P2 · gleichzeitig speichern über zwei Prozesse, verschiedene Abschnitte ----------------
    const stand = (text: string) => ({ basisRevision: 1, titel: TITEL, text });
    const [sa, sb] = await Promise.all([
      api(a, anna, "PUT", pfad, stand(TEXT.replace(A1, A1_NEU))),
      api(b, bernd, "PUT", pfad, stand(TEXT.replace(A3, A3_NEU))),
    ]);
    expect(sa.statusCode, sa.body).toBe(200);
    expect(sb.statusCode, sb.body).toBe(200);
    const nachP2 = await tabelle(koId);
    expect(nachP2).toEqual([{ offen: true, revision: 3, text: [A1_NEU, A2, A3_NEU].join("\n\n") }]);

    // --- P2 · derselbe Abschnitt über zwei Prozesse: ein Gewinner, ein 409 -----------------------
    const [ka, kb] = await Promise.all([
      api(a, anna, "PUT", pfad, {
        basisRevision: 3,
        titel: TITEL,
        text: [A1_NEU, "Verwendet wird Fett der Klasse 3.", A3_NEU].join("\n\n"),
      }),
      api(b, bernd, "PUT", pfad, {
        basisRevision: 3,
        titel: TITEL,
        text: [A1_NEU, "Verwendet wird Öl.", A3_NEU].join("\n\n"),
      }),
    ]);
    const codes = [ka.statusCode, kb.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const gewinner = ka.statusCode === 200 ? "Klasse 3" : "Öl";
    const verlierer = ka.statusCode === 200 ? "Öl" : "Klasse 3";
    const nachKonflikt = await tabelle(koId);
    expect(nachKonflikt[0]?.revision).toBe(4);
    expect(nachKonflikt[0]?.text).toContain(gewinner);
    expect(nachKonflikt[0]?.text).not.toContain(verlierer);

    // --- P3 · Neustart: beide Prozesse weg, zwei neue ------------------------------------------
    await beenden(a);
    await beenden(b);
    const c = await neueApp();
    const d = await neueApp();
    const annaC = await anmelden(c, "anna@gemeinsam-pg.test");
    const berndD = await anmelden(d, "bernd@gemeinsam-pg.test");
    const nachNeustart = (await api(c, annaC, "GET", pfad)).json() as Lage;
    expect(nachNeustart.entwurf?.id).toBe(idA);
    expect(nachNeustart.entwurf?.revision).toBe(4);
    expect([...(nachNeustart.entwurf?.beteiligte ?? [])].sort()).toEqual([
      "Anna Beispiel",
      "Bernd Beispiel",
    ]);
    expect(nachNeustart.entwurf?.verlauf.map((s) => s.art)).toEqual([
      "angelegt",
      "gespeichert",
      "zusammengefuehrt",
      "gespeichert",
    ]);
    // Bernd war während des Neustarts weg und hält noch Stand 3 mit einer Ergänzung am Ende.
    const spaet = await api(d, berndD, "PUT", pfad, {
      basisRevision: 3,
      titel: TITEL,
      text: [A1_NEU, A2, A3_NEU, "Den Schmierplan abzeichnen."].join("\n\n"),
    });
    expect(spaet.statusCode, spaet.body).toBe(200);
    const zusammen = (spaet.json() as Lage).entwurf?.text ?? "";
    expect(zusammen).toContain(gewinner);
    expect(zusammen).toContain("Den Schmierplan abzeichnen.");

    // Übernahme über den bestehenden Weg (Prozess C), Abschluss über Prozess D.
    const l = (await api(c, annaC, "GET", pfad)).json() as Lage;
    const revise = await api(c, annaC, "PUT", `/api/kos/${koId}`, {
      action: "revise",
      changes: l.uebernahme?.aenderung,
      expectedVersion: l.uebernahme?.basisVersion,
    });
    expect(revise.statusCode, revise.body).toBe(200);
    const fassung = (revise.json() as { version: number }).version;
    const abschluss = await api(d, annaC, "POST", `${pfad}/abschluss`, {
      revision: l.uebernahme?.revision,
      fassung,
    });
    expect(abschluss.statusCode, abschluss.body).toBe(200);

    // Ein DRITTER, frisch gestarteter Prozess liest das tatsächliche Ergebnis.
    await beenden(c);
    await beenden(d);
    const e = await neueApp();
    const leser = await anmelden(e, "bernd@gemeinsam-pg.test");
    const ko = (await api(e, leser, "GET", `/api/kos/${koId}`)).json() as {
      version: number;
      statement: string;
      bodyHtml: string;
    };
    expect(ko.version).toBe(fassung);
    expect(ko.statement).toBe(zusammen);
    expect(ko.bodyHtml).toContain("Den Schmierplan abzeichnen.");
    const danach = (await api(e, leser, "GET", pfad)).json() as Lage;
    expect(danach.entwurf).toBeNull();
    expect(danach.abgeschlossen?.zustand).toBe("uebernommen");
    expect((await tabelle(koId)).map((z) => z.offen)).toEqual([false]);
  }, 180_000);
});
