// ================================================================================================
// produkt:20261011:assistenz-skills-werkzeuge (BPA-11) · FÄHIGKEITSAUFTRÄGE GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `produktweg.test.ts` misst die Ablage an der Speicherfassung. Hier dieselbe Ablage
// (`ProfilFaehigkeitsAblage` über `PgAssistenzProfilRepo`) gegen das ausgeführte `migrate()`,
// mit einem neuen Pool und einem neuen Ausführungsobjekt je „Prozess":
//
//   G1  Ein Hintergrundauftrag überlebt den Neustart und wird vom neuen Prozess genau einmal
//       ausgeführt; danach ist nichts mehr offen.
//   G2  Vergleich-und-Tausch: zwei Prozesse beanspruchen denselben Auftrag — genau einer führt aus.
//   G3  Profilschreiben und Auftragsschreiben überschreiben einander nicht; die Profilfassung bleibt.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AdapterAntwort,
  FaehigkeitsAusfuehrung,
  type Faehigkeitsbindung,
  Faehigkeitsregistry,
  type Faehigkeitsvertrag,
  ProfilFaehigkeitsAblage,
} from "../../services/app/src/assistenz-faehigkeiten";
import {
  AssistenzProfilDienst,
  PgAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const KONTO = "u-pg-faehigkeit-carla";

const INTERN: Faehigkeitsvertrag = {
  id: "pg-testfaehigkeit",
  fassung: "1.0.0",
  name: "PG-Testfähigkeit",
  beschreibung: "Synthetisch, intern.",
  zwecke: ["pg_test"],
  datenempfaenger: { art: "intern" },
  wirkung: "lesen",
  modell: false,
  aktionen: ["wissen_lesen"],
  eingaben: [{ name: "begriff", maxLaenge: 100, pflicht: true }],
  ergebnis: { art: "trefferliste", felder: ["titel"], quellenPflicht: false },
  hoechsteSchutzstufe: "streng_vertraulich",
  grenzen: { maxTreffer: 3, zeitlimitMs: 5_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

describe("Fähigkeitsaufträge gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  let aufrufe = 0;

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Ein neuer „Prozess": neuer Pool, neue Registry, neue Ausführung, eigene Instanzkennung. */
  function prozess(instanz: string, verzoegerungMs = 0): FaehigkeitsAusfuehrung {
    const registry = new Faehigkeitsregistry();
    registry.registriere(INTERN);
    registry.installiereAdapter({
      faehigkeitId: INTERN.id,
      fassung: INTERN.fassung,
      transport: "ersatz",
      fuehreAus: async (): Promise<AdapterAntwort> => {
        aufrufe += 1;
        await new Promise((r) => setTimeout(r, verzoegerungMs));
        return { status: "ok", eintraege: [{ titel: "Treffer" }] };
      },
    });
    return new FaehigkeitsAusfuehrung({
      registry,
      lage: async () => ({
        keineKi: false,
        externeWissensabfrage: "search_on_click",
        vertraulichNachExtern: false,
        freigegebeneAnbieter: [],
      }),
      geheimnisse: { hole: () => null },
      ablage: new ProfilFaehigkeitsAblage(new PgAssistenzProfilRepo(neuePool())),
      instanz,
    });
  }

  let zaehler = 0;
  async function binde(p: FaehigkeitsAusfuehrung): Promise<Faehigkeitsbindung> {
    zaehler += 1;
    const v = await p.bereiteVor({
      auftragId: `pg-auftrag-${zaehler}`,
      mandant: "instanz",
      nutzer: KONTO,
      sitzung: "s",
      arbeitsbereich: null,
      zweck: "pg_test",
      gewaehlt: null,
      eingabe: { begriff: "x" },
      kontext: [],
      ausloeser: "nutzerauftrag",
    });
    if (v.art !== "gebunden") {
      throw new Error(`nicht gebunden: ${v.stand}`);
    }
    return v.bindung;
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
      await migrate(pool);
      await pool.query("DELETE FROM assistenz_profile WHERE konto_id = $1", [KONTO]);
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end();
    }
    await container?.stop();
  });

  it("G1 · ein Hintergrundauftrag überlebt den Neustart und läuft genau einmal", async () => {
    aufrufe = 0;
    const alt = prozess("pg-alt");
    const b = await binde(alt);
    expect((await alt.starteImHintergrund(b)).stand).toBe("wartet");
    const repo = new PgAssistenzProfilRepo(neuePool());
    expect(await repo.kontenMitOffenenFaehigkeitsauftraegen()).toContain(KONTO);

    const neu = prozess("pg-neu");
    const ergebnisse = await neu.arbeiteWarteschlangeAb();
    expect(ergebnisse.map((r) => [r.auftragId, r.stand])).toEqual([[b.auftragId, "erfolgreich"]]);
    expect(aufrufe).toBe(1);
    expect(await repo.kontenMitOffenenFaehigkeitsauftraegen()).not.toContain(KONTO);
    expect((await prozess("pg-dritter").fuehreAus(b)).wiederholt).toBe(true);
    expect(aufrufe).toBe(1);
  });

  it("G2 · zwei Prozesse, ein Auftrag: genau eine Ausführung", async () => {
    aufrufe = 0;
    const a = prozess("pg-a", 50);
    const c = prozess("pg-c", 50);
    const b = await binde(a);
    const [ra, rc] = await Promise.all([a.fuehreAus(b), c.fuehreAus(b)]);
    expect([ra.stand, rc.stand].sort()).toEqual(["erfolgreich", "laeuft"]);
    expect(aufrufe).toBe(1);
  });

  it("G3 · Profil- und Auftragsschreiben überschreiben einander nicht", async () => {
    const dienst = new AssistenzProfilDienst({ repo: new PgAssistenzProfilRepo(neuePool()) });
    // Bisher nur Aufträge: kein eingerichtetes Profil.
    expect(await dienst.hole(KONTO)).toBeNull();
    const p = await dienst.aendere(KONTO, {
      name: "Carla",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(p.fassung).toBe(1);
    const p1 = prozess("pg-g3");
    await p1.fuehreAus(await binde(p1));
    const nachAuftrag = await dienst.hole(KONTO);
    expect(nachAuftrag?.fassung).toBe(1);
    const anzahl = nachAuftrag?.faehigkeitsAuftraege?.length ?? 0;
    expect(anzahl).toBeGreaterThanOrEqual(3);
    // Ein Profilschreiben mit veraltetem Auftragsstand verliert keinen Auftrag.
    await dienst.aendere(KONTO, { name: "Carla 2", fassung: 1 });
    const danach = await dienst.hole(KONTO);
    expect(danach?.name).toBe("Carla 2");
    expect(danach?.faehigkeitsAuftraege?.length).toBe(anzahl);
  });
});
