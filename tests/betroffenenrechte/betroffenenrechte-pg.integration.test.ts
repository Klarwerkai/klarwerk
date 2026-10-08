// ================================================================================================
// BETROFFENENRECHTE · DER ECHTE SPEICHERWEG — PostgreSQL über einen Neustart hinweg (R-0661, R-0663).
// ================================================================================================
//
// `auskunft-und-loeschantrag.test.ts` misst den Vorgang an der Speicherablage. Dass ein Antrag einen
// Neustart überlebt, dass „ein offener Antrag je Konto" in der Datenbank selbst gilt und dass die
// Antworten einer Person über ihr Eigentum gefunden werden, ist erst mit einer ECHTEN Datenbank
// belegt: dieselben Ablagen (`PgLoeschantragRepo`, `PgAnswerSnapshotRepo`), das ausgeführte
// `migrate()` mit `LOESCHANTRAG_SCHEMA` — zweimal, weil die Stufe wiederholbar sein muss.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip. Alle Kennungen
// tragen einen Zufallsanteil; die Prüfungen lesen nur eigene Zeilen.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  PgLoeschantragRepo,
  istUeberfaellig,
  neuerLoeschantrag,
} from "../../services/app/src/loeschantraege";
import { PgAnswerSnapshotRepo } from "../../services/ask";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PgModelRunRepo } from "../../services/model-runs";
import { PgKlaraSessionRepo } from "../../services/reasoner";

describe("Betroffenenrechte gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  /** Ein frischer Pool — so sieht ein Neustart des Servers für die Ablage aus. */
  function neuerPool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
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

  it("P1 · ein Antrag überlebt den Neustart — mit Frist, Begründung und Status", async () => {
    const nutzer = `pg-nutzer-${randomUUID()}`;
    const antrag = neuerLoeschantrag(
      nutzer,
      "Austritt zum Quartalsende.",
      new Date("2026-10-06T08:00:00.000Z"),
    );
    expect(await new PgLoeschantragRepo(neuerPool()).lege(antrag)).toBe(true);

    const nachNeustart = new PgLoeschantragRepo(neuerPool());
    const gelesen = await nachNeustart.finde(antrag.id);
    expect(gelesen).toEqual(antrag);
    expect(gelesen?.fristBis).toBe("2026-11-06T08:00:00.000Z");
    expect(await nachNeustart.vonNutzer(nutzer)).toEqual([antrag]);
    expect((await nachNeustart.alle()).some((a) => a.id === antrag.id)).toBe(true);
    expect(istUeberfaellig(antrag, Date.parse("2026-11-07T00:00:00.000Z"))).toBe(true);
  });

  it("P2 · ein offener Antrag je Konto gilt in der Datenbank selbst — auch gleichzeitig", async () => {
    const nutzer = `pg-nutzer-${randomUUID()}`;
    const repoA = new PgLoeschantragRepo(neuerPool());
    const repoB = new PgLoeschantragRepo(neuerPool());
    const jetzt = new Date("2026-10-06T08:00:00.000Z");
    const ergebnisse = await Promise.all([
      repoA.lege(neuerLoeschantrag(nutzer, null, jetzt)),
      repoB.lege(neuerLoeschantrag(nutzer, null, jetzt)),
    ]);
    expect(ergebnisse.filter(Boolean)).toHaveLength(1);
    const offen = (await repoA.vonNutzer(nutzer)).filter((a) => a.status === "offen");
    expect(offen).toHaveLength(1);

    // Abgeschlossen ist er nicht mehr „offen" — dann darf ein neuer Antrag entstehen.
    const erster = offen[0];
    expect(erster).toBeDefined();
    if (!erster) {
      return;
    }
    const abgelehnt = {
      ...erster,
      status: "abgelehnt" as const,
      entschiedenVon: "pg-admin",
      entschiedenAm: "2026-10-07T08:00:00.000Z",
      entscheidungsgrund: "Aufbewahrungspflicht",
    };
    expect(await repoA.abschliessen(abgelehnt)).toBe(true);
    // Ein zweites Abschliessen schreibt nicht über den Endstand.
    expect(await repoB.abschliessen({ ...abgelehnt, status: "erledigt" })).toBe(false);
    expect((await repoB.finde(erster.id))?.status).toBe("abgelehnt");
    expect(await repoB.lege(neuerLoeschantrag(nutzer, null, jetzt))).toBe(true);
  });

  it("P3 · die Antworten einer Person werden über ihr Eigentum gefunden — fremde und System nicht", async () => {
    const repo = new PgAnswerSnapshotRepo(neuerPool());
    const nutzer = `pg-nutzer-${randomUUID()}`;
    const andere = `pg-nutzer-${randomUUID()}`;
    const eigene = [
      {
        answerId: `pg-antwort-${randomUUID()}`,
        askExecutionId: `pg-lauf-${randomUUID()}`,
        createdAt: "2026-10-06T08:00:01.000Z",
        schemaVersion: 1,
        owner: { kind: "user" as const, userId: nutzer },
      },
      {
        answerId: `pg-antwort-${randomUUID()}`,
        askExecutionId: `pg-lauf-${randomUUID()}`,
        createdAt: "2026-10-06T08:00:02.000Z",
        schemaVersion: 1,
        owner: { kind: "user" as const, userId: nutzer },
      },
    ];
    for (const r of [
      ...eigene,
      {
        answerId: `pg-antwort-${randomUUID()}`,
        askExecutionId: `pg-lauf-${randomUUID()}`,
        createdAt: "2026-10-06T08:00:03.000Z",
        schemaVersion: 1,
        owner: { kind: "user" as const, userId: andere },
      },
      {
        answerId: `pg-antwort-${randomUUID()}`,
        askExecutionId: `pg-lauf-${randomUUID()}`,
        createdAt: "2026-10-06T08:00:04.000Z",
        schemaVersion: 1,
        owner: { kind: "system" as const },
      },
    ]) {
      expect(await repo.createRecord(r)).toBe(true);
    }
    const gefunden = await new PgAnswerSnapshotRepo(neuerPool()).listRecordsByOwner(nutzer);
    expect(gefunden.map((r) => r.answerId)).toEqual(eigene.map((r) => r.answerId));
    expect(await repo.listRecordsByOwner("")).toEqual([]);
  });

  // Nacharbeit 4 (BEN): die Erledigung übernimmt den Antrag atomar — in der Datenbank selbst.
  it("P4 · gleichzeitige Übernahmen: genau eine gewinnt; Zurückziehen scheitert; Freigabe nur mit Marke", async () => {
    const nutzer = `pg-nutzer-${randomUUID()}`;
    const repoA = new PgLoeschantragRepo(neuerPool());
    const repoB = new PgLoeschantragRepo(neuerPool());
    const antrag = neuerLoeschantrag(nutzer, null, new Date("2026-10-06T08:00:00.000Z"));
    expect(await repoA.lege(antrag)).toBe(true);
    const a = { token: `a-${randomUUID()}`, am: "2026-10-06T09:00:00.000Z", von: "admin-a" };
    const b = { token: `b-${randomUUID()}`, am: "2026-10-06T09:00:00.000Z", von: "admin-b" };
    const vor = "2026-10-06T08:55:00.000Z";
    const ergebnisse = await Promise.all([
      repoA.uebernehmen(antrag.id, a, vor),
      repoB.uebernehmen(antrag.id, b, vor),
    ]);
    const gewinner = ergebnisse.filter((e) => e !== undefined);
    expect(gewinner).toHaveLength(1);
    const marke = gewinner[0]?.uebernahme;
    expect(marke?.token === a.token || marke?.token === b.token).toBe(true);
    expect((await repoA.finde(antrag.id))?.status).toBe("in_bearbeitung");

    // Zurückziehen (erwartet „offen") greift nicht, solange die Erledigung hält.
    const zurueck = { ...antrag, status: "zurueckgezogen" as const, entschiedenVon: nutzer };
    expect(await repoB.abschliessen(zurueck)).toBe(false);
    // Während der Bearbeitung kein zweiter Antrag desselben Kontos.
    expect(await repoB.lege(neuerLoeschantrag(nutzer, null, new Date()))).toBe(false);
    // Freigabe nur mit der gewinnenden Marke.
    const fremd = marke?.token === a.token ? b.token : a.token;
    expect(await repoA.freigeben(antrag.id, fremd)).toBe(false);
    expect(await repoA.freigeben(antrag.id, marke?.token ?? "")).toBe(true);
    expect((await repoA.finde(antrag.id))?.status).toBe("offen");
    expect((await repoA.finde(antrag.id))?.uebernahme).toBeUndefined();

    // Erneut übernommen, mit der eigenen Marke abgeschlossen; eine fremde Marke schliesst nicht ab.
    const c = { token: `c-${randomUUID()}`, am: "2026-10-06T09:10:00.000Z", von: "admin-a" };
    const uebernommen = await repoA.uebernehmen(antrag.id, c, vor);
    expect(uebernommen?.status).toBe("in_bearbeitung");
    const erledigt = { ...(uebernommen ?? antrag), status: "erledigt" as const };
    expect(await repoB.abschliessen({ ...erledigt, uebernahme: a }, "in_bearbeitung")).toBe(false);
    expect(await repoB.abschliessen(erledigt, "in_bearbeitung")).toBe(true);
    expect((await repoA.finde(antrag.id))?.status).toBe("erledigt");
  });

  it("P5 · KI-Läufe und Klara-Sitzungen einer Person sind über ihre Kennung lesbar", async () => {
    const nutzer = `pg-nutzer-${randomUUID()}`;
    const andere = `pg-nutzer-${randomUUID()}`;
    const laeufe = new PgModelRunRepo(neuerPool());
    for (const [id, actor] of [
      [`lauf-${randomUUID()}`, nutzer],
      [`lauf-${randomUUID()}`, andere],
    ] as const) {
      await laeufe.append({
        id,
        task: "answer",
        provider: "deterministic",
        demo: true,
        fallback: false,
        startedAt: "2026-10-06T08:01:00.000Z",
        finishedAt: "2026-10-06T08:01:01.000Z",
        status: "success",
        actor,
      });
    }
    const eigeneLaeufe = await laeufe.vonAkteur(nutzer);
    expect(eigeneLaeufe.map((l) => l.actor)).toEqual([nutzer]);

    const klara = new PgKlaraSessionRepo(neuerPool());
    const sessionId = `sitzung-${randomUUID()}`;
    await klara.insertSession({
      sessionId,
      tenantId: "instanz",
      actorId: nutzer,
      addinInstanceId: "addin-pg",
      documentContextId: "dok-pg",
      createdAt: "2026-10-06T08:02:00.000Z",
      lastActivityAt: "2026-10-06T08:02:00.000Z",
      expiresAt: "2026-10-06T10:02:00.000Z",
      policyVersion: "p1",
      configurationVersion: "c1",
      consentState: "none",
      closedAt: null,
      resolutionId: "res-pg",
      revision: 0,
    });
    const sitzungen = await klara.sitzungenVon(nutzer);
    expect(sitzungen.map((s) => s.sessionId)).toEqual([sessionId]);
    expect(await klara.sitzungenVon(andere)).toEqual([]);
    expect(await klara.consentsVon(nutzer)).toEqual([]);
  });
});
