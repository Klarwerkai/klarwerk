// ================================================================================================
// G27 WELLE 1 / R1 — SINGLE ACTIVE PROJECTION GEGEN ECHTES POSTGRES
// ================================================================================================
//
// WARUM DIESE DATEI SEPARAT EXISTIERT — und nicht als weiterer Fall in
// `services/app/src/db.migrate.integration.test.ts` steht: dort geht es um SCHEMAMIGRATION. Hier
// geht es um BETRIEBSZUSTAND. Drei Zusagen lassen sich ausschliesslich gegen einen echten Server
// belegen, und keine davon ist ein Migrationsfall:
//
//  1 RESTARTFESTIGKEIT (04 §1, §8). Der Control-State muss einen Prozesswiederanlauf überleben.
//    Der Beweis ist ein ZWEITER, frischer Adapter über DENSELBEN Pool, der denselben Zustand
//    vorfindet — ohne heuristische Wiederaufnahme und ohne erneuten Rebuild.
//  2 ATOMARITÄT DER FREIGABE (04 §3). Dass `V2_READY → V2_ACTIVE` genau EINE Operation ist,
//    entscheidet das bedingte `UPDATE ... WHERE projection_state = …` im Server — nicht ein
//    Textvergleich. Zwei gleichzeitige Freigeber müssen genau EINEN Gewinner haben.
//  3 DIE FASSUNGSBINDUNG IM SQL. Ob `p.projection_version = $1` eine V1-Zeile wirklich aus der
//    Treffermenge hält, beantwortet der Planner, nicht der Fake-Pool.
//
// Läuft unter `npm run test:integration` (Docker/Testcontainers), nicht im schnellen Root-Gate.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
// G27 R3: die Gegenprobe startet über GENAU den kanonischen Helper, den App-Ready und der CLI-Seed
// benutzen — nicht über einen nachgebauten Ablauf. Sonst prüfte sie etwas anderes als den Produktweg.
import { stelleSuchprojektionBereit } from "../../services/app/src/search-projection-startup";
import {
  type KnowledgeObject,
  type KoSearchProjection,
  KoService,
  PgKoRepo,
  PgKoSearchProjectionRepo,
  SEARCH_PROJECTION_VERSION,
  buildSearchProjection,
  integritaetsMarkerGueltig,
  parseClassificationSnapshot,
} from "../../services/knowledge-object";

const AT = "2026-08-02T09:00:00.000Z";
const KO_CREATED_AT = "2024-03-01T08:00:00.000Z";
const ALT = "AltkategorieXYZ";
const NEU = "NeukategorieXYZ";
const DECKEL = 20;
const VORGAENGER = 21;

function objekt(id: string, kategorie: string, koerper: string): KnowledgeObject {
  return {
    id,
    title: `Objekt ${id}`,
    statement: "Aussage ohne Zielwort.",
    bodyHtml: `<p>${koerper}</p>`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: kategorie,
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    createdAt: KO_CREATED_AT,
    history: [],
  } as unknown as KnowledgeObject;
}

function v1Zeile(ko: KnowledgeObject, kategorieImInhalt: string): KoSearchProjection {
  return {
    ...buildSearchProjection(ko, AT),
    projectionVersion: 1,
    bodyText: "",
    searchText: `${ko.title}\n${ko.statement}\n${kategorieImInhalt}`,
    contentHash: "v1-hash",
    classificationSnapshot: parseClassificationSnapshot("", ko.version),
  };
}

describe("G27 R1 · Single Active Projection gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
  });

  afterAll(async () => {
    await container?.stop();
  });

  // Jeder Fall bekommt einen leeren Bestand — die Steuerzeile eingeschlossen. So misst jeder Test
  // wirklich eine NEUE Instanz und nicht den Rest seines Vorgängers.
  async function frischerBestand() {
    const pool = createPool(url);
    await migrate(pool);
    await pool.query("DELETE FROM ko_search_projections");
    await pool.query("DELETE FROM ko_metadata_projections");
    await pool.query("DELETE FROM kos");
    await pool.query("DELETE FROM ko_projection_control");
    // Genau der Seed, den `migrate()` auf einer frischen Instanz setzt.
    await pool.query(
      "INSERT INTO ko_projection_control(key, projection_state) VALUES ('singleton','UNINITIALIZED')",
    );
    const projections = new PgKoSearchProjectionRepo(pool);
    const repo = new PgKoRepo(pool);
    const ko = new KoService({ repo, searchProjections: projections });
    return { pool, repo, projections, ko };
  }

  // BENs Aufbau, wörtlich — 21 offene Vorgänger vor dem Ziel-KO.
  async function benAufbau() {
    const s = await frischerBestand();
    for (let i = 1; i <= VORGAENGER; i++) {
      await s.repo.insert(
        objekt(`vorgaenger-${String(i).padStart(2, "0")}`, "Wartung", "Fuellwort"),
      );
    }
    const ziel = objekt("ziel", NEU, "Zielkoerperwort");
    await s.repo.insert(ziel);
    await s.projections.insert(v1Zeile(ziel, ALT));
    await s.projections.metadata.upsert({ koId: ziel.id, categoryText: NEU, tagText: "", at: AT });
    return { ...s, zielId: ziel.id };
  }

  // ----------------------------------------------------------------------------------------------
  // 1 — DIE MIGRATION SELBST LEGT DEN FAIL-CLOSED ANFANGSZUSTAND AN
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfall 1: migrate() persistiert genau EINE Steuerzeile mit UNINITIALIZED", async () => {
    const pool = createPool(url);
    try {
      await migrate(pool);
      await pool.query("DELETE FROM ko_projection_control");
      // Ein frischer Migrationslauf legt die Zeile an …
      await migrate(pool);
      const erste = await pool.query<{ key: string; projection_state: string }>(
        "SELECT key, projection_state, active_projection_version FROM ko_projection_control",
      );
      expect(erste.rows).toEqual([
        { key: "singleton", projection_state: "UNINITIALIZED", active_projection_version: null },
      ]);

      // … und ein ZWEITER Lauf setzt einen laufenden Betrieb NICHT zurück (ON CONFLICT DO NOTHING).
      await pool.query(
        "UPDATE ko_projection_control SET projection_state='V2_ACTIVE', active_projection_version=2",
      );
      await migrate(pool);
      const zweite = await pool.query<{ projection_state: string }>(
        "SELECT projection_state FROM ko_projection_control",
      );
      expect(zweite.rows).toEqual([{ projection_state: "V2_ACTIVE" }]);

      // Der Primärschlüssel erzwingt „instanzweit": eine zweite autoritative Zeile ist unmöglich.
      await expect(
        pool.query(
          "INSERT INTO ko_projection_control(key, projection_state) VALUES ('singleton','FAILED')",
        ),
      ).rejects.toThrow();
    } finally {
      await pool.end();
    }
  });

  it("Pflichtfall 1: die Standardsuche wirft im Zustand UNINITIALIZED — kein stilles []", async () => {
    const { pool, ko, repo } = await frischerBestand();
    try {
      await repo.insert(objekt("frisch", NEU, "Frischwort"));
      await expect(ko.findSearchHits({ terms: ["frischwort"] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      await expect(ko.findCandidates({ terms: ["frischwort"], limit: 10 })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // 2/3/4 — V1-BETRIEB, TEILMIGRATION, VOLLSTÄNDIGE MIGRATION
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfälle 2–4: V1-Betrieb, Bau ohne Teilmenge, vollständige Migration", async () => {
    const { pool, ko, projections, zielId } = await benAufbau();
    try {
      // 2 — V1 vorhanden: der Bestand ist noch nicht vollständig, also ist V1_ACTIVE nicht
      //     erklärbar. Erst nach dem Nachzug ALLER Zeilen auf Fassung 1 wäre er es — hier ist der
      //     Bestand gemischt (21 ohne Zeile, eine V1-Zeile), und genau das lehnt die Erklärung ab.
      await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      expect((await ko.searchProjectionVersions()).offenV1).toBe(1);

      // 3 — teilweise migriert: der gedeckelte Nachzug erreicht das Ziel nicht, und im Bau
      //     antwortet die Suche nicht mit einer Teilmenge.
      await ko.beginSearchProjectionBuild();
      await ko.backfillSearchProjections({ limit: DECKEL });
      expect((await projections.find(zielId, 1))?.projectionVersion).toBe(1);
      await expect(ko.findSearchHits({ terms: [ALT.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      expect((await ko.searchProjectionReadiness()).alle).toBe(false);

      // 4 — vollständige Migration.
      const reconcile = await ko.reconcileSearchProjections();
      expect(reconcile.differenz).toBe(0);
      const bestand = await ko.searchProjectionVersions();
      expect(bestand.offenV1).toBe(0);
      expect(bestand.gemischt).toBe(false);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // 5/6/7/8 — REBUILD, RECONCILE, DIE FÜNF PRÜFUNGEN, DIE ATOMARE FREIGABE
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfälle 5–7: ohne Rebuild und Reconcile keine Freigabe — die fünf Prüfungen greifen", async () => {
    const { pool, ko } = await benAufbau();
    try {
      await ko.beginSearchProjectionBuild();
      const ohne = await ko.searchProjectionReadiness();
      expect(ohne.rebuild).toBe(false);
      expect(ohne.reconcile).toBe(false);
      expect(ohne.alle).toBe(false);
      await expect(ko.releaseSearchProjectionVersion()).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      // Ein Bau, der so nicht durchkommt, endet ausdrücklich — und macht die Suche NICHT wieder auf.
      expect((await ko.failSearchProjectionBuild("Vorbedingungen offen")).projectionState).toBe(
        "FAILED",
      );
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });

      // Der vollständige Weg aus `FAILED` heraus — und danach bestehen alle fünf.
      const { readiness, control } = await ko.activateSearchProjectionV2();
      expect(readiness.alle).toBe(true);
      expect(readiness.befunde).toEqual([]);
      expect(control.projectionState).toBe("V2_ACTIVE");
      expect(control.activeProjectionVersion).toBe(SEARCH_PROJECTION_VERSION);
    } finally {
      await pool.end();
    }
  });

  it("Pflichtfall 8: die Freigabe ist atomar — zwei gleichzeitige Freigeber, genau EIN Gewinner", async () => {
    const { pool, ko, projections } = await benAufbau();
    try {
      // Bis unmittelbar vor die Freigabe fahren.
      await ko.beginSearchProjectionBuild();
      const at = new Date().toISOString();
      await ko.rebuildSearchProjections();
      const nachRebuild = await projections.controlState();
      await projections.compareAndSetControlState("V2_BUILDING", {
        ...nachRebuild,
        lastSuccessfulRebuild: at,
      });
      await ko.reconcileSearchProjections();
      const { control } = await ko.finishSearchProjectionBuild();
      expect(control.projectionState).toBe("V2_READY");

      // ECHTE Nebenläufigkeit über den Pool — und zwar über den PRODUKTWEG.
      //
      // GEÄNDERT DURCH ENTSCHEIDUNG 09 §2, und die Änderung ist der Kern von BENs ROT-4. Vorher
      // maß dieser Fall acht gleichzeitige `compareAndSetControlState`-Aufrufe auf derselben
      // Steuerzeile — das belegte die Atomarität der ZEILE, aber nicht die Bindung der fünf
      // Prüfungen an den freigegebenen Bestand. Genau diese Lücke hat BEN ausgenutzt.
      //
      // Jetzt laufen acht vollständige Freigaben gegeneinander: jede sperrt die Steuerzeile
      // exklusiv, prüft UNTER der Sperre und schreibt in derselben Transaktion. Genau eine kommt
      // durch, die anderen sieben finden `V2_READY` nicht mehr vor und scheitern ehrlich.
      const bereit = await projections.controlState();
      const versuche = await Promise.all(
        Array.from({ length: 8 }, () =>
          ko.releaseSearchProjectionVersion(bereit.buildGeneration).then(
            () => true,
            () => false,
          ),
        ),
      );
      expect(versuche.filter(Boolean)).toHaveLength(1);
      const nachFreigabe = await projections.controlState();
      expect(nachFreigabe.projectionState).toBe("V2_ACTIVE");
      // Freigegeben ist die GEPRÜFTE Generation, und der Marker gilt für genau sie.
      expect(nachFreigabe.activeGeneration).toBe(bereit.buildGeneration);
      expect(nachFreigabe.integrityMarker).toBe(`V2-READY:${bereit.buildGeneration}`);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // 9 — WIEDERANLAUF AM SELBEN POOL
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfall 9: ein zweiter frischer Adapter am selben Pool liest denselben Zustand", async () => {
    const { pool, ko, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const vorher = await ko.searchProjectionControl();

      // „Prozesswiederanlauf": neuer Adapter, neuer Dienst, sogar ein neuer Pool auf dieselbe
      // Datenbank. Der Zustand liegt in der Datenbank, nicht im Prozess.
      const zweiterPool = createPool(url);
      try {
        const zweiterDienst = new KoService({
          repo: new PgKoRepo(zweiterPool),
          searchProjections: new PgKoSearchProjectionRepo(zweiterPool),
        });
        expect(await zweiterDienst.searchProjectionControl()).toEqual(vorher);
        // Sofort weiter suchbar — keine heuristische Wiederaufnahme, kein erneuter Rebuild.
        expect(
          (await zweiterDienst.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId),
        ).toEqual([zielId]);
      } finally {
        await zweiterPool.end();
      }
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // 10 — ROLLBACK
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfall 10: Rollback endet vollständig auf V1 oder FAILED — nie im Mischbetrieb", async () => {
    const { pool, ko, repo, projections, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();

      // (a) V1 wurde NICHT erhalten (der Rebuild hat die aktiven Zeilen gehoben) ⇒ FAILED.
      const nachFehlschlag = await ko.rollbackSearchProjectionVersion("Betriebsentscheid");
      expect(nachFehlschlag.projectionState).toBe("FAILED");
      expect(nachFehlschlag.activeProjectionVersion).toBeNull();
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });

      // (b) AUCH ein vollständig zurückgestellter V1-Bestand führt nach FAILED. Entscheidung 08 §1
      //     hat den produktiven V1-Rollback abgeschafft: er war im Produktbetrieb unerreichbar
      //     (der Primärschlüssel ist `(ko_id, ko_version)`, und der V2-Rebuild ERSETZT die V1-Zeile
      //     derselben aktiven KO-Version) und im Test nur über einen Repository-Backdoor grün.
      const { control: wiederAktiv } = await ko.recoverSearchProjectionV2("Wiederinbetriebnahme");
      expect(wiederAktiv.projectionState).toBe("V2_ACTIVE");
      for (const objektImBestand of await repo.list({})) {
        await projections.replace(v1Zeile(objektImBestand, ALT));
      }
      const nachRueckfall = await ko.rollbackSearchProjectionVersion("Rückfallversuch auf V1");
      expect(nachRueckfall.projectionState).toBe("FAILED");
      expect(nachRueckfall.activeProjectionVersion).toBeNull();
      // Und der EINE Weg zurück ist die vollständige V2-Recovery — im echten PostgreSQL.
      const { control: erneut } = await ko.recoverSearchProjectionV2("Wiederinbetriebnahme 2");
      expect(erneut.projectionState).toBe("V2_ACTIVE");
      const treffer = await ko.findSearchHits({ terms: [NEU.toLowerCase()] });
      expect(treffer.every((h) => h.projectionVersion === SEARCH_PROJECTION_VERSION)).toBe(true);
      expect(treffer.map((h) => h.koId)).toContain(zielId);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // 11/12/13 — BENs GEGENPROBE IM SQL
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfälle 11–13: AltKategorie null Treffer, nur der neue Begriff trifft, V1 bleibt liegen", async () => {
    const { pool, ko, projections, repo, zielId } = await benAufbau();
    try {
      // Der gedeckelte Nachzug erreicht das Ziel nachweislich nicht.
      const bilanz = await ko.backfillSearchProjections({ limit: DECKEL });
      expect(bilanz.geprueft).toBe(DECKEL);
      expect((await projections.find(zielId, 1))?.projectionVersion).toBe(1);

      await ko.activateSearchProjectionV2();

      // 11 — der alte Kategoriebegriff trifft NICHT mehr.
      expect(await ko.findSearchHits({ terms: [ALT.toLowerCase()] })).toEqual([]);
      // 12 — der neue trifft, und zwar als Kategoriefund aus der Metadatenprojektion.
      const neueTreffer = await ko.findSearchHits({ terms: [NEU.toLowerCase()] });
      expect(neueTreffer.map((h) => h.koId)).toEqual([zielId]);
      expect(neueTreffer[0]?.matched.category).toBe(true);
      expect(neueTreffer[0]?.matched.body).toBe(false);
      // Kein Treffer trägt eine andere als die freigegebene Fassung.
      const control = await ko.searchProjectionControl();
      const alle = await ko.findSearchHits({ terms: ["fuellwort", "zielkoerperwort"] });
      expect(alle.every((h) => h.projectionVersion === control.activeProjectionVersion)).toBe(true);

      // 13 — GEÄNDERT DURCH ENTSCHEIDUNG 09 §3 (BENs ROT-5). Diese Zusicherung erwartete früher
      //      `[]` und schrieb damit genau die Semantik fest, die Architektur 04 §4 verbietet: eine
      //      leere Treffermenge heisst fachlich „nichts gefunden" und darf „der aktive Bestand ist
      //      beschädigt" nicht verdecken. Der Fassungsfilter verhindert zwar den falschen
      //      V1-Treffer, verwandelt den beschädigten Bestand aber in eine stille Leermenge.
      //
      //      Jetzt gilt: die Rückschreibung kann die aktive Generation nicht tragen, fällt den
      //      Integritätsmarker — IN DERSELBEN Transaktion, im echten PostgreSQL — und die Suche
      //      antwortet fail-closed.
      const ziel = (await repo.findById(zielId)) as KnowledgeObject;
      await projections.replace(v1Zeile(ziel, ALT));
      await expect(ko.findSearchHits({ terms: [ALT.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      // Auch der NEUE Begriff: der ganze Bestand ist unglaubwürdig, nicht nur die eine Zeile.
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      const zeile = await pool.query<{
        projection_version: number;
        search_text: string;
        generation: string | null;
      }>(
        "SELECT projection_version, search_text, generation FROM ko_search_projections WHERE ko_id=$1",
        [zielId],
      );
      expect(zeile.rows[0]?.projection_version).toBe(1);
      expect(zeile.rows[0]?.search_text).toContain(ALT);
      // Die Zeile trägt KEINE Generation — sie gehört zu keinem freigegebenen Zyklus.
      expect(zeile.rows[0]?.generation).toBeNull();
      // Und der Marker ist in der echten Steuerzeile gefallen.
      const steuer = await pool.query<{ integrity_marker: string | null }>(
        "SELECT integrity_marker FROM ko_projection_control WHERE key='singleton'",
      );
      expect(steuer.rows[0]?.integrity_marker).toBeNull();
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // 14/15/16 — BACKFILL, FUSSNOTEN-MAINTENANCE, ÄUSSERER VERTRAG
  // ----------------------------------------------------------------------------------------------

  it("Pflichtfall 14: der Backfill lässt die Steuerzeile byte-gleich und aktiviert nichts", async () => {
    const { pool, ko } = await benAufbau();
    try {
      const vorher = await pool.query("SELECT * FROM ko_projection_control");
      await ko.backfillSearchProjections({ limit: 100 });
      const nachher = await pool.query("SELECT * FROM ko_projection_control");
      expect(nachher.rows).toEqual(vorher.rows);
      // Er hat den Bestand vollständig fertig gemacht — und trotzdem NICHTS freigegeben.
      expect((await ko.searchProjectionVersions()).offenV1).toBe(0);
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
    } finally {
      await pool.end();
    }
  });

  it("Pflichtfall 15: der Fußnoten-Nachzug läuft über die Reconcile-Kette, ohne jeden Suchaufruf", async () => {
    const { pool, ko, repo } = await frischerBestand();
    try {
      await repo.insert({
        ...objekt("mit-bild", "Wartung", "x"),
        bodyHtml:
          '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-1">Fussnotenwort</figcaption></figure>',
      } as KnowledgeObject);
      expect((await repo.findById("mit-bild"))?.captionTexts).toBeUndefined();

      await ko.beginSearchProjectionBuild();
      await ko.reconcileSearchProjections();

      expect((await repo.findById("mit-bild"))?.captionTexts).toEqual(["Fussnotenwort"]);
    } finally {
      await pool.end();
    }
  });

  it("Pflichtfall 16: äußerer Treffervertrag und Ranking sind unverändert", async () => {
    const { pool, ko, repo } = await frischerBestand();
    try {
      // Zwei Objekte, deren Reihenfolge das bestehende Ranking bestimmt: validiert zuerst, dann
      // Trust absteigend. Diese Zeile wurde von R1 ausdrücklich nicht angefasst (04 §7).
      await repo.insert({
        ...objekt("offen-hoch", "Wartung", "Rangwort"),
        status: "offen",
        trust: 90,
      } as KnowledgeObject);
      await repo.insert({
        ...objekt("validiert-niedrig", "Wartung", "Rangwort"),
        status: "validiert",
        trust: 10,
      } as KnowledgeObject);
      await ko.activateSearchProjectionV2();

      const treffer = await ko.findSearchHits({ terms: ["rangwort"] });
      expect(treffer.map((h) => h.koId)).toEqual(["validiert-niedrig", "offen-hoch"]);
      // Dieselben Felder, dieselben Namen, dieselbe Bedeutung von `matched.body` wie vor R1.
      expect(Object.keys(treffer[0] as object).sort()).toEqual([
        "contentHash",
        "koId",
        "koVersion",
        "language",
        "matched",
        "projectionVersion",
        "status",
      ]);
      expect(treffer[0]?.matched).toEqual({
        title: false,
        statement: false,
        category: false,
        tag: false,
        caption: false,
        body: true,
      });
    } finally {
      await pool.end();
    }
  });
  // ----------------------------------------------------------------------------------------------
  // G27 R1 / Entscheidung 09 — GENERATION, SPERRE UND INTEGRITÄT IM ECHTEN POSTGRESQL
  // ----------------------------------------------------------------------------------------------
  //
  // Die drei Zusagen, die NUR ein echter Server beantworten kann: ob `SELECT … FOR UPDATE` eine
  // parallele Mutation wirklich hält, ob die Generation an der Zeile persistiert, und ob der
  // Wiederanlauf aus jedem Zustand ohne Repo-Eingriff in den Betrieb führt.

  it("Entscheidung 09: die freigegebene Generation steht an JEDER aktiven Zeile — persistent", async () => {
    const { pool, ko } = await benAufbau();
    try {
      const { control } = await ko.activateSearchProjectionV2();
      expect(control.activeGeneration).toBe(control.buildGeneration);

      const zeilen = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM kos k
           JOIN ko_search_projections p
             ON p.ko_id = k.id AND p.ko_version = COALESCE((k.data->>'version')::int, 1)
          WHERE NOT (k.data ? 'deletedAt')
            AND (p.projection_version <> $1 OR p.generation IS DISTINCT FROM $2)`,
        [SEARCH_PROJECTION_VERSION, control.activeGeneration],
      );
      // KEINE aktive Zeile ausserhalb der freigegebenen Generation — im Server gemessen.
      expect(Number(zeilen.rows[0]?.n)).toBe(0);
      // Und der Marker in der Steuerzeile nennt genau diese Generation.
      const steuer = await pool.query<{ integrity_marker: string; active_generation: string }>(
        "SELECT integrity_marker, active_generation FROM ko_projection_control WHERE key='singleton'",
      );
      expect(steuer.rows[0]?.integrity_marker).toBe(`V2-READY:${control.activeGeneration}`);
    } finally {
      await pool.end();
    }
  });

  it("Entscheidung 09: eine ENTFERNTE bedienende Zeile macht die Suche fail-closed — nicht leer", async () => {
    const { pool, ko, projections, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const ziel = await projections.find(zielId, 1);
      expect(ziel?.projectionVersion).toBe(SEARCH_PROJECTION_VERSION);

      await projections.remove(zielId, ziel?.koVersion as number);
      await expect(ko.findSearchHits({ terms: [NEU.toLowerCase()] })).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      const steuer = await pool.query<{ integrity_marker: string | null }>(
        "SELECT integrity_marker FROM ko_projection_control WHERE key='singleton'",
      );
      expect(steuer.rows[0]?.integrity_marker).toBeNull();
    } finally {
      await pool.end();
    }
  });

  it("Entscheidung 09: eine Freigabe mit FREMDER Generation wird verweigert", async () => {
    const { pool, ko } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const aktiv = await ko.searchProjectionControl();
      await ko.rollbackSearchProjectionVersion("Neuer Zyklus");
      await ko.beginSearchProjectionBuild();
      await ko.rebuildSearchProjections();
      // Die alte Generation gehört zu einem Bau, den es nicht mehr gibt.
      await expect(
        ko.releaseSearchProjectionVersion(aktiv.activeGeneration as number),
      ).rejects.toMatchObject({ code: "SEARCH_PROJECTION_NOT_READY" });
    } finally {
      await pool.end();
    }
  });

  it("Entscheidung 09: eine LEERE Neuinstanz kann V1 nicht aktivieren (09 §4)", async () => {
    const { pool, ko } = await frischerBestand();
    try {
      await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
      expect((await ko.searchProjectionControl()).projectionState).toBe("UNINITIALIZED");
    } finally {
      await pool.end();
    }
  });

  it("Entscheidung 09: ein ECHTER Legacy-V1-Bestand darf einmalig bestätigt werden — danach nie wieder", async () => {
    const { pool, repo, projections, ko } = await frischerBestand();
    try {
      const legacy = objekt("legacy", ALT, "Legacykoerperwort");
      await repo.insert(legacy);
      await projections.insert(v1Zeile(legacy, ALT));
      await projections.metadata.upsert({
        koId: legacy.id,
        categoryText: ALT,
        tagText: "",
        at: AT,
      });

      const control = await ko.declareSearchProjectionV1Active();
      expect(control.projectionState).toBe("V1_ACTIVE");
      expect(control.buildGeneration).toBe(0);
      expect((await ko.findSearchHits({ terms: [ALT.toLowerCase()] })).map((h) => h.koId)).toEqual([
        "legacy",
      ]);

      // Migration nach V2 — und danach ist V1 endgültig zu.
      await ko.activateSearchProjectionV2();
      expect((await ko.searchProjectionControl()).projectionState).toBe("V2_ACTIVE");
      await expect(ko.declareSearchProjectionV1Active()).rejects.toMatchObject({
        code: "SEARCH_PROJECTION_NOT_READY",
      });
    } finally {
      await pool.end();
    }
  });

  it("Entscheidung 06/09: Wiederanlauf aus V2_BUILDING, V2_READY, V2_ACTIVE und FAILED", async () => {
    const { pool, ko, projections, zielId } = await benAufbau();
    try {
      // (a) V2_BUILDING — ein ZWEITER frischer Adapter am selben Pool setzt DIESELBE Generation
      //     fort. Das ist der Prozesswiederanlauf, ohne heuristische Ableitung aus Zeilen.
      await ko.beginSearchProjectionBuild();
      const imBau = await ko.searchProjectionControl();
      const zweiter = new KoService({
        repo: new PgKoRepo(pool),
        searchProjections: new PgKoSearchProjectionRepo(pool),
      });
      const { control: nachBau } = await zweiter.continueSearchProjectionBuild();
      expect(nachBau.projectionState).toBe("V2_ACTIVE");
      expect(nachBau.activeGeneration).toBe(imBau.buildGeneration);

      // (b) V2_ACTIVE — ein weiterer Wiederanlauf baut NICHTS neu.
      const vorher = await projections.controlState();
      const dritter = new KoService({
        repo: new PgKoRepo(pool),
        searchProjections: new PgKoSearchProjectionRepo(pool),
      });
      expect(await dritter.searchProjectionControl()).toEqual(vorher);

      // (c) FAILED — die vollständige V2-Recovery führt zurück in den Betrieb.
      await ko.rollbackSearchProjectionVersion("Störung");
      expect((await ko.searchProjectionControl()).projectionState).toBe("FAILED");
      const { control: erholt } = await ko.recoverSearchProjectionV2("Wiederinbetriebnahme");
      expect(erholt.projectionState).toBe("V2_ACTIVE");
      expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
        zielId,
      ]);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // G27 R3 — DIE BESCHÄDIGUNG AM REPOSITORY-ADAPTER VORBEI (BEN R2-Nachprüfung, ROT-1)
  // ----------------------------------------------------------------------------------------------
  //
  // WARUM DIESE FÄLLE HIER STEHEN UND NICHT IN EINEM UNIT-TEST. Sie sind die einzige Ebene, auf der
  // sich BENs Befund überhaupt reproduzieren lässt: die Beschädigung geschieht per DIREKTEM SQL,
  // ohne den Adapter zu berühren. Genau dadurch bleibt die Control-Zeile unangetastet — Marker
  // gültig, Generation gesetzt — und der bis R2 gültige Start akzeptierte den Schaden. Ein
  // InMemory-Test kann das nicht: dort gibt es keinen Weg an der Implementierung vorbei.
  //
  // Gemessen wird jeweils dieselbe Kette:
  //   regulär aktivieren → Treffer belegen → per SQL beschädigen → Control-Zeile als UNVERÄNDERT
  //   belegen → kanonisch neu starten → Ausgang prüfen.
  //
  // Der Ausgang darf nach Akzeptanz 8 genau zweierlei sein: ein neuer sauberer V2-Zyklus ist aktiv,
  // ODER der Start bricht fail-closed ab. `V2_ACTIVE` plus fachliche Leermenge ist verboten.

  /** Der Control-Zustand, wie er WIRKLICH in der Datenbank steht — ohne Adapterlogik. */
  async function steuerzeile(pool: Pool) {
    const res = await pool.query<{
      projection_state: string;
      active_projection_version: number | null;
      active_generation: string | null;
      integrity_marker: string | null;
    }>(
      "SELECT projection_state, active_projection_version, active_generation, integrity_marker FROM ko_projection_control WHERE key='singleton'",
    );
    return res.rows[0];
  }

  it("R3: direkt per SQL GELÖSCHTE aktive Zeile — Control-Zeile gültig, Start erkennt es trotzdem", async () => {
    const { pool, ko, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      // Vorbeschädigung: die Suche findet das Ziel.
      expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
        zielId,
      ]);
      const vorher = await steuerzeile(pool);
      expect(vorher?.projection_state).toBe("V2_ACTIVE");

      // DER EINGRIFF — direkt in der Datenbank, am Adapter vorbei. Genau BENs Schritt 5.
      const geloescht = await pool.query("DELETE FROM ko_search_projections WHERE ko_id=$1", [
        zielId,
      ]);
      expect(geloescht.rowCount).toBeGreaterThan(0);

      // Die Control-Zeile ist UNVERÄNDERT — das ist der Kern des Befunds.
      const nachSql = await steuerzeile(pool);
      expect(nachSql).toEqual(vorher);
      expect(nachSql?.integrity_marker).toBe(vorher?.integrity_marker);

      // ==========================================================================================
      // DIE NEGATIVKONTROLLE — sie ist der Grund, warum das Grün dieses Falls etwas bedeutet.
      // ==========================================================================================
      //
      // Hier steht beides nebeneinander gemessen:
      //   · die bis R2 EINZIGE Startprüfung sagt „alles in Ordnung",
      //   · die tatsächliche Bestandsprüfung sagt „beschädigt".
      //
      // Genau diese Differenz war BENs Blocker. Am R2-Stand hätte der Start die linke Seite geglaubt
      // und wäre normal weitergelaufen; die Zusicherungen unten (neue Generation, wiedergefundener
      // Treffer) wären rot. Dieser Fall kann deshalb nicht versehentlich grün sein.
      const control = await ko.searchProjectionControl();
      expect(integritaetsMarkerGueltig(control)).toBe(true);
      const readiness = await ko.searchProjectionReadiness();
      expect(readiness.alle).toBe(false);
      expect(readiness.befunde.join("; ")).toMatch(/unvollständige Projektion/);

      // Kanonischer Neustart über GENAU den Helper, den App und Seed benutzen.
      const nachStart = await stelleSuchprojektionBereit(ko);

      // Akzeptanz 8: sauberer NEUER Zyklus. Der Start hat den Schaden erkannt und über die
      // vollständige V2-Recovery einen neuen Bestand gebaut.
      expect(nachStart.projectionState).toBe("V2_ACTIVE");
      expect(nachStart.activeGeneration).toBeGreaterThan(Number(vorher?.active_generation));
      expect(nachStart.integrityMarker).toBe(`V2-READY:${nachStart.activeGeneration}`);

      // Und der fachliche Beweis: die Suche findet wieder — kein stilles `[]`.
      expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
        zielId,
      ]);
    } finally {
      await pool.end();
    }
  });

  it("R3: direkt per SQL auf FREMDGENERATION gesetzte Zeile wird beim Start erkannt", async () => {
    const { pool, ko, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const vorher = await steuerzeile(pool);

      // Die Zeile bleibt Fassung 2, trägt aber eine Generation, die es nie gab.
      await pool.query("UPDATE ko_search_projections SET generation = 9999 WHERE ko_id=$1", [
        zielId,
      ]);
      expect(await steuerzeile(pool)).toEqual(vorher);
      // Die Suche liefert JETZT die verbotene Leermenge — der Zustand ist beschädigt.
      expect(await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).toEqual([]);

      const nachStart = await stelleSuchprojektionBereit(ko);
      expect(nachStart.projectionState).toBe("V2_ACTIVE");
      expect(nachStart.activeGeneration).toBeGreaterThan(Number(vorher?.active_generation));
      expect((await ko.findSearchHits({ terms: [NEU.toLowerCase()] })).map((h) => h.koId)).toEqual([
        zielId,
      ]);
    } finally {
      await pool.end();
    }
  });

  it("R3: direkt per SQL auf FASSUNG 1 zurückgesetzte Zeile wird beim Start erkannt", async () => {
    const { pool, ko, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const vorher = await steuerzeile(pool);

      await pool.query(
        "UPDATE ko_search_projections SET projection_version = 1, generation = NULL WHERE ko_id=$1",
        [zielId],
      );
      expect(await steuerzeile(pool)).toEqual(vorher);

      const nachStart = await stelleSuchprojektionBereit(ko);
      expect(nachStart.projectionState).toBe("V2_ACTIVE");
      expect(nachStart.activeGeneration).toBeGreaterThan(Number(vorher?.active_generation));
      // Der alte Kategoriebegriff trifft danach nicht — der Bestand ist wieder durchgängig V2.
      expect(await ko.findSearchHits({ terms: [ALT.toLowerCase()] })).toEqual([]);
    } finally {
      await pool.end();
    }
  });

  it("R3: direkt per SQL geleertes PFLICHTFELD und verfälschter HASH werden beim Start erkannt", async () => {
    const { pool, ko, zielId } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const vorher = await steuerzeile(pool);

      // Pflichtfeld leer UND Hash verfälscht: zwei der fünf Gate-Prüfungen auf einmal.
      await pool.query(
        "UPDATE ko_search_projections SET content_hash = '', language = '' WHERE ko_id=$1",
        [zielId],
      );
      expect(await steuerzeile(pool)).toEqual(vorher);

      const nachStart = await stelleSuchprojektionBereit(ko);
      expect(nachStart.projectionState).toBe("V2_ACTIVE");
      expect(nachStart.activeGeneration).toBeGreaterThan(Number(vorher?.active_generation));
      const wieder = await pool.query<{ content_hash: string; language: string }>(
        "SELECT content_hash, language FROM ko_search_projections WHERE ko_id=$1",
        [zielId],
      );
      expect(wieder.rows[0]?.content_hash).not.toBe("");
      expect(wieder.rows[0]?.language).not.toBe("");
    } finally {
      await pool.end();
    }
  });

  it("R3: ein GESUNDER V2_ACTIVE-Bestand löst beim Neustart KEINEN Rebuild aus", async () => {
    // Die notwendige Gegenprobe zu den vier Fällen darüber (Akzeptanz 4): prüfte der Start zu
    // scharf, baute er bei jedem Start neu — und genau das ist ein ausdrückliches No-Go (06 §6).
    const { pool, ko } = await benAufbau();
    try {
      await ko.activateSearchProjectionV2();
      const vorher = await steuerzeile(pool);

      const nachStart = await stelleSuchprojektionBereit(ko);

      // Byte-gleich: dieselbe Generation, derselbe Marker, kein neuer Zyklus.
      expect(await steuerzeile(pool)).toEqual(vorher);
      expect(nachStart.activeGeneration).toBe(Number(vorher?.active_generation));
    } finally {
      await pool.end();
    }
  });
});
