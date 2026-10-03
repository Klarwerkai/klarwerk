// ==================================================================================================
// AUFNAHME 20260922 · confluence-import-rechte (R-0549) — DIE LESERLISTE AUS DER QUELLE, ALS SQL.
// ==================================================================================================
//
// `darfSehen` hat einen neuen ersten Zweig: trägt ein Objekt `quellrechte.leser`, entscheidet nur
// diese Liste (plus der Autor). `sqlSichtbarkeitFuer` trägt denselben Zweig als CASE im Prädikat.
// Zwei Formen derselben Regel brauchen denselben Beleg wie BASIC 380: ein ECHTES Postgres und
// Mengengleichheit über den vollständigen Kreuzbestand, nicht eine Stichprobe.
//
//   {ohne Quellrechte, leere Liste, [Lea], [Lea, Carl]} × {intern, vertraulich} × {Admin, leer}
//   × {lebend, getrasht} — gelesen von {Lea, Carl, Otto, Admin} × {viewer, controller, admin}
//
// Dazu: die Quellrechte überstehen einen NEUEN Pool unverändert (Ablage im JSONB-Dokument). Das ist
// ausdrücklich KEIN Prozessneustart der App — dieser Beleg bleibt offen.
//
// Braucht Docker (Testcontainers); läuft unter `npm run test:integration`.
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import {
  type Confidentiality,
  type KnowledgeObject,
  type KoQuellrechte,
  PgKoRepo,
} from "../../services/knowledge-object";

const LEA = "u-lea";
const CARL = "u-carl";
const OTTO = "u-otto";
const ADMIN = "u-admin";

const RECHTE: readonly (Omit<KoQuellrechte, "stufe"> | undefined)[] = [
  undefined,
  { leser: [] },
  { leser: [LEA] },
  { leser: [LEA, CARL] },
];
const STUFEN: readonly Confidentiality[] = ["intern", "vertraulich"];
const AUTOREN: readonly string[] = [ADMIN, ""];
const ROLLEN: readonly Role[] = ["viewer", "controller", "admin"];
const BETRACHTER: readonly string[] = [LEA, CARL, OTTO, ADMIN];

function kreuzbestand(): KnowledgeObject[] {
  const out: KnowledgeObject[] = [];
  for (const [ri, rechte] of RECHTE.entries()) {
    for (const stufe of STUFEN) {
      for (const [ai, autor] of AUTOREN.entries()) {
        for (const getrasht of [false, true]) {
          out.push({
            id: `q-${ri}-${stufe}-${ai}-${getrasht ? "trash" : "live"}`,
            title: "Seite",
            statement: "Inhalt.",
            conditions: [],
            measures: [],
            type: "best_practice",
            category: "K",
            tags: [],
            confidence: 50,
            trust: 50,
            status: "offen",
            version: 1,
            originalAuthor: autor,
            author: autor,
            neededValidations: 1,
            assignments: [],
            asset: null,
            createdAt: "2026-10-03T10:00:00.000Z",
            history: [],
            comments: [],
            attachments: [],
            sources: [],
            confidentiality: stufe,
            ...(rechte ? { quellrechte: { stufe, ...rechte } } : {}),
            ...(getrasht ? { deletedAt: "2026-10-03T11:00:00.000Z" } : {}),
          } as KnowledgeObject);
        }
      }
    }
  }
  return out;
}

describe("R-0549 · SQL-Trim und darfSehen sind auch mit Quelllesern dieselbe Regel", () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const pool = createPool(url);
    try {
      await migrate(pool);
      await pool.query("DELETE FROM kos");
      for (const k of kreuzbestand()) {
        await pool.query("INSERT INTO kos(id,type,status,category,data) VALUES($1,$2,$3,$4,$5)", [
          k.id,
          k.type,
          k.status,
          k.category,
          JSON.stringify(k),
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("P1 · Listen- und Suchweg liefern für jeden Betrachter genau die Menge von darfSehen", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const alle = await repo.list({});
      expect(alle).toHaveLength(RECHTE.length * STUFEN.length * AUTOREN.length * 2);
      let geprueft = 0;
      for (const role of ROLLEN) {
        for (const id of BETRACHTER) {
          const user: SessionUser = { id, role };
          const ausRegel = alle
            .filter((k) => !k.deletedAt && darfSehen(user, k))
            .map((k) => k.id)
            .sort();
          const ausListe = (await repo.list({}, sqlSichtbarkeitFuer(user))).map((k) => k.id).sort();
          const ausSuche = (await repo.listForSearch({}, sqlSichtbarkeitFuer(user)))
            .map((k) => k.id)
            .sort();
          expect(ausListe, `Liste — ${role}/${id}`).toEqual(ausRegel);
          expect(ausSuche, `Suche — ${role}/${id}`).toEqual(ausRegel);
          geprueft += 1;
        }
      }
      expect(geprueft).toBe(ROLLEN.length * BETRACHTER.length);
    } finally {
      await pool.end();
    }
  });

  it("P2 · Anti-Vakuum: die Leserliste schliesst den Controller aus und lässt die Leserin ein", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const id = "q-2-vertraulich-0-live"; // Leser [Lea], vertraulich, Autor Admin, lebend
      const carl = await repo.list({}, sqlSichtbarkeitFuer({ id: CARL, role: "controller" }));
      const lea = await repo.list({}, sqlSichtbarkeitFuer({ id: LEA, role: "viewer" }));
      expect(carl.map((k) => k.id)).not.toContain(id);
      expect(lea.map((k) => k.id)).toContain(id);
      // Ohne Leserliste bleibt die Stufenregel: dieselbe Stufe, der Controller sieht sie.
      expect(carl.map((k) => k.id)).toContain("q-0-vertraulich-0-live");
    } finally {
      await pool.end();
    }
  });

  it("P3 · die Quellrechte stehen nach einem neuen Pool unverändert im Dokument", async () => {
    const pool = createPool(url);
    try {
      const geladen = await new PgKoRepo(pool).findById("q-3-vertraulich-0-live");
      expect(geladen?.quellrechte).toEqual({ stufe: "vertraulich", leser: [LEA, CARL] });
    } finally {
      await pool.end();
    }
  });
});
