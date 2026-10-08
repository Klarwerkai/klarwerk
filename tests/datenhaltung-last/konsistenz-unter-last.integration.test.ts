// ================================================================================================
// R-2078 / NFR-DAT-01 — „AK: KONSISTENZ UNTER LAST", GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// DER AUFBAU: zwei Anwendungsinstanzen (je ein eigener Vorrat aus `createPool`, je eine eigene
// Kompositionswurzel `buildPgServices`) über EINER Datenbank — so wie zwei App-Prozesse im Betrieb.
// Auf mehrere Wissensobjekte gehen gleichzeitig viele Überarbeitungen aus beiden Instanzen. Jede
// Überarbeitung schreibt in EINER Transaktion: Objektstand (CAS auf `rowVersion`), Fassung
// (`ko_versions`), Suchprojektion und Prüfspureintrag `ko.revised`.
//
// GEMESSEN WIRD NICHT „es lief", sondern was danach im Bestand steht:
//
//   L1 — Jeder Aufruf endet entweder wirksam oder mit einem benannten Konflikt (`KoError`), nie mit
//        einem anderen Fehler.
//   L2 — Je Objekt: Fassungen lückenlos 1..v, der Objektstand trägt genau v, und die Zahl wirksamer
//        Aufrufe ist v − 1 (keine verlorene, keine doppelte Fassung).
//   L3 — Je Objekt: genau v − 1 `ko.revised`-Einträge mit den Fassungen 2..v — kein Beleg ohne
//        Fassung, keine Fassung ohne Beleg.
//   L4 — Je Objekt: die Suchprojektion der gültigen Fassung steht.
//   L5 — Die Prüfspur-Kette bekommt durch die Last keinen einzigen neuen Bruch.
//
// Läuft NUR unter `test:integration` (Testcontainers oder gesicherte KLARWERK_PG_TEST_URL). Ohne
// beides wird EHRLICH übersprungen; ein Überspringen ist kein Prüfbeleg.
//
// GRENZE: Das ist ein Lastnachweis im Testmaßstab (Größen unten), kein Dauerlasttest gegen die
// Produktion. Er belegt die Konsistenzzusage unter konkurrierenden Schreibern, keine Durchsatzzahl.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgAuditRepo, inspectChain } from "../../services/audit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type KnowledgeObject, KoError } from "../../services/knowledge-object";

/** Wissensobjekte unter Last. */
const OBJEKTE = 6;
/** Überarbeitungen je Objekt und Instanz. */
const RUNDEN = 15;

describe("NFR-DAT-01 · Konsistenz versionierter Wissensobjekte unter Last", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  const pools: Pool[] = [];
  let instanzen: AppServices[] = [];
  let lese: Pool | undefined;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      url = localUrl;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      return;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          // Name nicht frei gewählt: s. `tests/app/job2354-drei-datenbanknamen.test.ts` (E7).
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        return;
      }
    }
    try {
      const migration = createPool(url);
      pools.push(migration);
      await migrate(migration);
      const a = createPool(url);
      const b = createPool(url);
      pools.push(a, b);
      instanzen = [buildPgServices(a), buildPgServices(b)];
      lese = new Pool({ connectionString: url, max: 2 });
      pools.push(lese);
    } catch {
      process.stderr.write(
        "[KLARWERK] Last-Suite UEBERSPRUNGEN: keine Verbindung zur Testinstanz.\n",
      );
      instanzen = [];
    }
  }, 180_000);

  afterAll(async () => {
    for (const p of pools) {
      await p.end().catch(() => undefined);
    }
    await container?.stop();
  });

  it("L1–L5 · zwei Instanzen, viele gleichzeitige Überarbeitungen: der Bestand bleibt widerspruchsfrei", async (ctx) => {
    const [a, b] = instanzen;
    if (!a || !b || !lese) {
      ctx.skip();
      return;
    }
    const p = lese;
    const objekte: KnowledgeObject[] = [];
    for (let i = 0; i < OBJEKTE; i++) {
      objekte.push(
        await a.ko.create({
          title: `Lastprobe ${i}`,
          statement: "Fassung 1.",
          type: "best_practice",
          category: "Instandhaltung",
          confidentiality: "intern",
          author: "last",
        }),
      );
    }
    const kettenbruecheVorher = inspectChain(await new PgAuditRepo(p).all()).linkageBreaks;

    const auftraege: { koId: string; lauf: Promise<unknown> }[] = [];
    for (const ko of objekte) {
      for (let runde = 0; runde < RUNDEN; runde++) {
        for (const instanz of [a, b]) {
          const name = instanz === a ? "A" : "B";
          auftraege.push({
            koId: ko.id,
            lauf: instanz.ko.revise(ko.id, { statement: `Fassung ${name}-${runde}.` }, "last"),
          });
        }
      }
    }
    const ausgaenge = await Promise.allSettled(auftraege.map((x) => x.lauf));

    // L1 — wirksam oder benannter Konflikt, sonst nichts.
    const fremdeFehler: string[] = [];
    for (const ausgang of ausgaenge) {
      if (ausgang.status === "rejected" && !(ausgang.reason instanceof KoError)) {
        fremdeFehler.push(String(ausgang.reason));
      }
    }
    expect(
      fremdeFehler,
      "ein Aufruf endete weder wirksam noch mit einem benannten Konflikt",
    ).toEqual([]);

    let wirksamGesamt = 0;
    for (const ko of objekte) {
      const wirksam = auftraege.filter(
        (x, i) => x.koId === ko.id && ausgaenge[i]?.status === "fulfilled",
      ).length;
      wirksamGesamt += wirksam;

      // L2 — Fassungen lückenlos, Objektstand passend, keine verlorene Fassung.
      const fassungen = await p.query<{ version: number }>(
        "SELECT version FROM ko_versions WHERE ko_id = $1 ORDER BY version",
        [ko.id],
      );
      const v = fassungen.rows.length;
      const nummern = fassungen.rows.map((z) => z.version);
      const lueckenlos = Array.from({ length: v }, (_, i) => i + 1);
      expect(nummern, `${ko.id}: Fassungen nicht lückenlos`).toEqual(lueckenlos);
      const stand = await p.query<{ version: number }>(
        "SELECT (data->>'version')::int AS version FROM kos WHERE id = $1",
        [ko.id],
      );
      expect(stand.rows[0]?.version, `${ko.id}: Objektstand ≠ letzte Fassung`).toBe(v);
      expect(wirksam, `${ko.id}: wirksame Aufrufe ≠ neue Fassungen`).toBe(v - 1);

      // L3 — genau ein Beleg je neuer Fassung, mit genau diesen Fassungen.
      const belege = await p.query<{ version: number }>(
        "SELECT (payload->>'version')::int AS version FROM audit WHERE action = 'ko.revised' AND target = $1 ORDER BY version",
        [ko.id],
      );
      const belegte = belege.rows.map((z) => z.version);
      const erwartet = Array.from({ length: v - 1 }, (_, i) => i + 2);
      expect(belegte, `${ko.id}: Prüfspur passt nicht zu den Fassungen`).toEqual(erwartet);

      // L4 — die Suchprojektion der gültigen Fassung steht.
      const projektion = await p.query(
        "SELECT 1 FROM ko_search_projections WHERE ko_id = $1 AND ko_version = $2",
        [ko.id, v],
      );
      expect(projektion.rowCount, `${ko.id}: keine Projektion der Fassung ${v}`).toBeGreaterThan(0);
    }
    // Die Last hat gearbeitet: jeder verlorene Vergleich (STALE_WRITE) setzt einen gewonnenen der
    // anderen Instanz voraus. Je Objekt gewinnt damit mindestens ein Drittel der 2 · RUNDEN Aufrufe.
    expect(wirksamGesamt).toBeGreaterThanOrEqual(Math.ceil((OBJEKTE * RUNDEN * 2) / 3));
    process.stderr.write(
      `[KLARWERK][last] ${auftraege.length} gleichzeitige Überarbeitungen, ${wirksamGesamt} wirksam, ${auftraege.length - wirksamGesamt} als Konflikt abgewiesen.\n`,
    );

    // L5 — kein neuer Bruch in der Prüfspur-Kette.
    const kettenbruecheNachher = inspectChain(await new PgAuditRepo(p).all()).linkageBreaks;
    expect(kettenbruecheNachher).toBe(kettenbruecheVorher);
  }, 180_000);
});
