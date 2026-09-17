// ================================================================================================
// JOB 4224 · RUNDE 3, BEN-KORREKTURPFLICHT 2 — DIESELBE KETTE, ABER GEGEN ECHTES POSTGRESQL
// ================================================================================================
//
// WAS RUNDE 1 UND 2 FALSCH GEMACHT HABEN, und zwar zweimal hintereinander: sie haben in der
// RUECKGABE behauptet, ein PostgreSQL-Lauf sei hier nicht zu haben („der getrennte Integrationslauf
// braucht Docker, und der ist im Prüfplatz nicht zugesagt"). Das war eine ANNAHME, keine Messung.
// Ben hat darauf bestanden. Die Messung (Arbeitsprüfung 5ba672e5…, Cloud-Lauf ec7a7567…):
// `npx vitest run --config vitest.integration.config.ts services/capture/src/repo-pg.integration.test.ts`
// → „Test Files 1 passed (1) · Tests 8 passed (8)", Exit 0. Kein Skip.
// Diese Datei ist die Folge daraus.
//
// WAS RUNDE 3 UND 4 DANN FALSCH GEMACHT HABEN — der Grund, warum Runde 4 FORM ROT bekam: aus dieser
// EINEN Messung wurde der Satz „der Prüfplatz KANN Postgres" als Dauerzusage abgeleitet, und die
// RUECKGABE der Runde 4 behauptete für DIESE Datei eine PostgreSQL-Abnahme. Ben hat nachgemessen:
// der Lauf der Bahn (4d336fe7a0f24d4fae1669f943737b4b) trug in `check.err:1` und Bens eigener Lauf
// (bf53210e493e48a3856c16c98cc185d9) auf stderr dieselbe Zeile:
//   „PG-KETTE ÜBERSPRUNGEN: keine Container-Laufzeit verfügbar — Could not find a working container
//    runtime strategy"
// und meldete trotzdem auf stdout „Tests 3 passed (3)". Beides zugleich war möglich, weil PG1–PG3
// ohne Pool mit `expect(grund).not.toBeNull(); return;` ENDETEN — ein frühes `return` ist in Vitest
// ein BESTANDENER Test. Genau das ist der stille Skip, den der Kopf dieser Datei zu verbieten
// vorgab. Seit Runde 5 rufen die drei Fälle `ctx.skip()` (Hausform:
// `tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts:117-121`); ohne Datenbank meldet der
// Lauf „3 skipped", NIE „3 passed". Wer diese Datei anfasst, prüft stdout UND stderr.
//
// STATUS IN DIESER UMGEBUNG: NICHT AUSGEFÜHRT, solange keine Container-Laufzeit da ist. Was unten
// steht, ist damit ZUGESAGT, aber nicht gemessen; die Rückgabe nennt das als offenen Lieferstand und
// behauptet keinen grünen PG-Lauf.
//
// WAS HIER ECHT IST, und was das gegenüber `beleg-fuehrt-zum-original.test.ts` hinzufügt:
//   · DIE ABLAGE. `buildPgServices(pool)` gegen einen echten PostgreSQL-Container mit dem echten
//     Migrationslauf (`migrate`). Wissensobjekt, Anhang, Quelle, Freigabe, Vertraulichkeitsstufe
//     und das hochgeladene Original liegen in echten Tabellen, nicht im Anwendungsspeicher.
//   · DER ENTZUG WIRKT AUF DEM GESPEICHERTEN STAND, nicht auf einem Objekt im Heap.
// Alles andere ist dieselbe Kette und derselbe Code: dieselbe App, dieselben Routen, derselbe
// `originalweg`, derselbe kontrollierte Adapter.
//
// DER KONTROLLIERTE MODELLADAPTER ist als solcher benannt (`kette.ts`). Damit darf weder eine reale
// semantische Antwortqualität noch eine Microsoft-365-Host-Abnahme behauptet werden.
//
// WARUM `.integration.test.ts` UND DAMIT NICHT IM TOR: `vitest.config.ts` schliesst dieses Muster
// aus (`AUSSCHLUSS`), `tools/test` faehrt es nicht. Das ist die Hausordnung fuer jeden der rund
// zwanzig PG-Faelle dieses Baums und keine Erfindung dieses Auftrags — der Lauf ist ein eigener
// Aufruf (`npm run test:integration` bzw. `--config vitest.integration.config.ts`). Die RUECKGABE
// nennt ihn deshalb als EIGENE Pruefung mit eigener Kennung und behauptet nicht, das Tor decke ihn.
//
// SICHTBARER SKIP STATT STILLEM GRUEN: ohne Container-Laufzeit meldet diese Datei das auf stderr und
// ueberspringt — dieselbe Bauform wie `tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts`.
// Ein stiller Skip saehe aus wie ein bestandener Lauf.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Aufbau,
  BELEGSTELLE,
  type Draht,
  ORIGINALNAME,
  ORIGINALTEXT,
  QUELLENBEZEICHNUNG,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  fragen,
  kosLesen,
  neuesKonto,
  objektLesen,
  originalLesen,
} from "./kette";

adapterUmgebungSetzen();

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { originalweg } from "../../apps/web/src/lib/askCitedSources";
import { buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";

/** Eine Kennung, die es nie gegeben hat — der Maßstab für „nicht vorhanden". */
const ERFUNDEN = "gibt-es-nicht-4224-pg";

let container: StartedTestContainer | null = null;
/** Nur für das Abräumen: kann gesetzt sein, während `pool` (der Prüfschalter) null bleibt. */
let aufraeumPool: Pool | null = null;
/**
 * Der EINE Schalter der Datei: nicht null heißt „Container da UND `migrate` durch". Er wird erst
 * nach der Migration gesetzt, damit ein halber Aufbau (Container steht, Schema fehlt) nicht als
 * benutzbare Datenbank durchgeht und die Fälle mit unverständlichen SQL-Fehlern rot macht.
 */
let pool: Pool | null = null;
let draht: Draht;

beforeAll(async () => {
  draht = drahtAufbauen();
  try {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    aufraeumPool = createPool(url);
    await migrate(aufraeumPool);
    pool = aufraeumPool;
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    process.stderr.write(
      `[KLARWERK] JOB 4224 PG-KETTE ÜBERSPRUNGEN: keine Container-Laufzeit verfügbar — ${grund}\n`,
    );
  }
}, 180_000);

afterAll(async () => {
  draht?.abbauen();
  await aufraeumPool?.end();
  await container?.stop();
});

async function pgApp(): Promise<Aufbau> {
  const p = pool;
  if (!p) {
    throw new Error("kein Pool");
  }
  const a = await appAufbauen(false, () => buildPgServices(p));
  draht.setzeApp(a.app);
  return a;
}

function koAus(bestand: Record<string, unknown>[], id: string): KnowledgeObject {
  const treffer = bestand.find((k) => k.id === id);
  expect(treffer, `die Quelle ${id} fehlt im Bestand, den die Fläche liest`).toBeDefined();
  return treffer as unknown as KnowledgeObject;
}

describe("JOB 4224 · D5 · PG — dieselbe Kette auf echtem PostgreSQL", () => {
  it("PG1 · von der belegten Quelle bis zum gespeicherten Originalinhalt", async (ctx) => {
    // `ctx.skip()` statt `return`: ohne Datenbank ist dieser Fall NICHT bestanden, sondern
    // übersprungen — der Grund steht auf stderr (siehe Kopf der Datei).
    if (!pool) {
      ctx.skip();
      return;
    }
    const { app, admin } = await pgApp();
    const eintrag = await eintragMitOriginal(app, admin);
    const leser = await neuesKonto(app, "leser", admin);

    const antwort = await fragen(app, leser);
    expect(
      draht.lage.generierungen,
      "der kontrollierte Adapter wurde nicht befragt",
    ).toBeGreaterThan(0);
    expect(antwort.answered, antwort.roh).toBe(true);
    expect(antwort.citedSources, "die Antwort belegt den gespeicherten Eintrag nicht").toContain(
      eintrag.koId,
    );

    // Der Bestand kommt jetzt aus PostgreSQL — dieselbe Route, dieselbe Ableitung.
    const weg = originalweg(koAus(await kosLesen(app, leser), eintrag.koId), "de");
    expect(weg.erreichbar).toBe(true);
    expect(weg.quellen[0]?.quelle.label).toBe(QUELLENBEZEICHNUNG);
    expect(weg.quellen[0]?.quelle.excerpt).toBe(BELEGSTELLE);
    expect(weg.quellen[0]?.datei?.name).toBe(ORIGINALNAME);
    expect(weg.quellen[0]?.datei?.href).toBe(`/api/objects/${eintrag.objectId}/raw`);

    // Und die Bytes kommen aus dem echten Objektspeicher zurück.
    const roh = await originalLesen(app, leser, eintrag.objectId);
    expect(roh.statusCode, roh.body).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
    await app.close();
  }, 120_000);

  it("PG2 · der Entzug wirkt auf dem GESPEICHERTEN Stand — und verrät nichts", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const { app, admin } = await pgApp();
    const eintrag = await eintragMitOriginal(app, admin);
    const leser = await neuesKonto(app, "leser", admin);
    expect((await fragen(app, leser)).citedSources).toContain(eintrag.koId);

    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${eintrag.koId}`,
      headers: admin.kopf,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // Nicht erlaubt sieht aus wie nicht vorhanden — Status, Rumpf und Cachevertrag.
    const meta = await objektLesen(app, leser, eintrag.objectId);
    const metaErfunden = await objektLesen(app, leser, ERFUNDEN);
    expect(meta.statusCode, `das Original ist noch abrufbar: ${meta.body}`).toBe(404);
    expect(meta.body).toBe(metaErfunden.body);
    expect(meta.headers["cache-control"]).toBe(metaErfunden.headers["cache-control"]);
    const roh = await originalLesen(app, leser, eintrag.objectId);
    expect(roh.statusCode).toBe(404);
    expect(roh.body).not.toContain(ORIGINALTEXT);

    // Und die Antwort verrät nichts über Existenz oder Inhalt.
    const danach = await fragen(app, leser);
    expect(danach.roh).not.toContain(eintrag.koId);
    expect(danach.roh).not.toContain(eintrag.kernaussage);
    expect(danach.verschlossen.map((v) => v.id)).not.toContain(eintrag.koId);

    // GEGENPROBE auf demselben gespeicherten Stand: der Autor kommt weiter durch — gemessen wird
    // das RECHT, nicht ein Totalausfall der Ablage.
    const alsAdmin = await originalLesen(app, admin, eintrag.objectId);
    expect(alsAdmin.statusCode).toBe(200);
    expect(alsAdmin.body).toBe(ORIGINALTEXT);
    await app.close();
  }, 120_000);

  it("PG3 · der Stand überlebt die App-Instanz — er liegt wirklich in der Datenbank", async (ctx) => {
    // Ohne diesen Fall wäre „auf echtem PostgreSQL" auch dann wahr, wenn alles im Prozess läge und
    // die Datenbank nur danebenstünde. Eine ZWEITE App auf DEMSELBEN Pool muss den Eintrag samt
    // Original finden — dieselbe Bauform wie `build-app.integration.test.ts`.
    if (!pool) {
      ctx.skip();
      return;
    }
    const erste = await pgApp();
    const eintrag = await eintragMitOriginal(erste.app, erste.admin);
    const leser = await neuesKonto(erste.app, "leser", erste.admin);
    await erste.app.close();

    const zweite = await appAufbauen(false, () => buildPgServices(pool as Pool));
    draht.setzeApp(zweite.app);
    const weg = originalweg(koAus(await kosLesen(zweite.app, leser), eintrag.koId), "de");
    expect(weg.quellen[0]?.datei?.objectId, "der Anker hat den Neustart nicht überlebt").toBe(
      eintrag.objectId,
    );
    const roh = await originalLesen(zweite.app, leser, eintrag.objectId);
    expect(roh.statusCode, roh.body).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
    await zweite.app.close();
  }, 120_000);
});
