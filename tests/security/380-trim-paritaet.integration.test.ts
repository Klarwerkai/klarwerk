// ================================================================================================
// AUFTRAG-BASIC-380 · T-S-1 — DAS SQL-PRÄDIKAT UND `darfSehen` SIND DIESELBE REGEL.
// ================================================================================================
//
// WARUM DIESER TEST DER TEURE IST UND ES SEIN MUSS. Der Trim wandert vom Anwendungsspeicher in die
// Datenbank. Damit gibt es für einen Augenblick ZWEI Auslegungen derselben Regel — genau die
// zweite Wahrheit, gegen die `services/app/src/sichtbarkeit.ts` seit mega74 gebaut ist. Der
// einzige belastbare Beweis, dass es doch nur eine ist, führt über ein ECHTES Postgres und über
// ALLE Kombinationen, nicht über eine Auswahl:
//
//   {intern, vertraulich, streng_vertraulich, fehlend} × {Autor, Fremder, leerer Autor}
//   × {lebend, getrasht} × {viewer, experte, controller, admin} × {Betrachter = Autor, Fremder}
//
// GEMESSEN WIRD MENGENGLEICHHEIT, nicht Stichprobe: die Menge, die das SQL liefert, muss
// ZEICHENGLEICH die Menge sein, die `!deletedAt && darfSehen(user, ko)` über denselben Bestand
// liefert. Eine Abweichung in EINE Richtung wäre ein Leck, in die andere ein Funktionsverlust.
//
// Braucht Docker (Testcontainers); läuft unter `npm run test:integration`, nicht im schnellen Tor.
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import {
  type Confidentiality,
  type KnowledgeObject,
  PgKoRepo,
  normalizeConfidentiality,
} from "../../services/knowledge-object";

const STUFEN: readonly (Confidentiality | undefined)[] = [
  undefined,
  "intern",
  "vertraulich",
  "streng_vertraulich",
];
const AUTOREN: readonly string[] = ["u-anna", "u-bert", ""];
const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];
const BETRACHTER: readonly string[] = ["u-anna", "u-bert"];

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Lieferzeiten",
    statement: "Fuenf Werktage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Logistik",
    tags: [],
    confidence: 50,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u-anna",
    author: "u-anna",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as KnowledgeObject;
}

// Der vollständige Kreuzbestand: 4 Stufen × 3 Autoren × 2 Papierkorbzustände = 24 Zeilen.
function kreuzbestand(): KnowledgeObject[] {
  const out: KnowledgeObject[] = [];
  for (const [si, stufe] of STUFEN.entries()) {
    for (const [ai, autor] of AUTOREN.entries()) {
      for (const getrasht of [false, true]) {
        out.push(
          ko({
            id: `k-${si}-${ai}-${getrasht ? "trash" : "live"}`,
            author: autor,
            originalAuthor: autor,
            ...(stufe ? { confidentiality: stufe } : {}),
            ...(getrasht ? { deletedAt: "2026-07-02T10:00:00.000Z" } : {}),
          }),
        );
      }
    }
  }
  return out;
}

describe("BASIC 380 · T-S-1: SQL-Trim und darfSehen liefern über denselben Bestand dieselbe Menge", () => {
  let container: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
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

  // ----------------------------------------------------------------------------------------------
  // T-M-3 / T-K-4 — DIE ALTER-ONLY-STUFE IST WIRKLICH GELAUFEN UND DECKT sich MIT normalizeConfidentiality.
  // ----------------------------------------------------------------------------------------------

  it("KO_SICHTBARKEIT_SCHEMA hat die drei Schlüsselspalten wirklich angelegt", async () => {
    const pool = createPool(url);
    try {
      const res = await pool.query<{ column_name: string; is_generated: string }>(
        `SELECT column_name, is_generated FROM information_schema.columns
          WHERE table_name = 'kos' AND column_name IN ($1,$2,$3) ORDER BY column_name`,
        ["author_key", "confidentiality_key", "deleted_at_key"],
      );
      expect(res.rows.map((r) => r.column_name)).toEqual([
        "author_key",
        "confidentiality_key",
        "deleted_at_key",
      ]);
      // Generiert, nicht geschrieben: es gibt keinen Schreibweg, der sie auseinanderlaufen lässt.
      expect(res.rows.every((r) => r.is_generated === "ALWAYS")).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("T-K-4: die generierte Stufe ist für JEDE Bestandszeile deckungsgleich mit normalizeConfidentiality", async () => {
    const pool = createPool(url);
    try {
      const res = await pool.query<{
        id: string;
        confidentiality_key: string;
        author_key: string | null;
        deleted_at_key: string | null;
        roh: string | null;
        roh_author: string | null;
        roh_deleted: string | null;
      }>(
        `SELECT id, confidentiality_key, author_key, deleted_at_key,
                data->>'confidentiality' AS roh,
                data->>'author' AS roh_author,
                data->>'deletedAt' AS roh_deleted
           FROM kos ORDER BY id`,
      );
      expect(res.rows).toHaveLength(24);
      for (const row of res.rows) {
        expect(row.confidentiality_key).toBe(normalizeConfidentiality(row.roh));
        expect(row.author_key).toBe(row.roh_author);
        expect(row.deleted_at_key).toBe(row.roh_deleted);
      }
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // T-S-1 — DIE PARITÄT SELBST.
  // ----------------------------------------------------------------------------------------------

  it("über ALLE Rollen-, Autoren- und Vertraulichkeitsfälle sind beide Mengen identisch", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const alle = await repo.listForSearch({});
      expect(alle).toHaveLength(24);

      let geprueft = 0;
      for (const role of ROLLEN) {
        for (const id of BETRACHTER) {
          const user: SessionUser = { id, role };
          const ausSql = (await repo.listForSearch({}, sqlSichtbarkeitFuer(user)))
            .map((k) => k.id)
            .sort();
          const ausRegel = alle
            .filter((k) => !k.deletedAt && darfSehen(user, k))
            .map((k) => k.id)
            .sort();
          expect(ausSql, `Rolle ${role}, Betrachter ${id}`).toEqual(ausRegel);
          // Gegenprobe: die Menge darf nicht leer und nicht der ganze Bestand sein — sonst
          // wäre die Gleichheit trivial und dieser Test wertlos.
          expect(ausSql.length).toBeGreaterThan(0);
          expect(ausSql.length).toBeLessThan(alle.length);
          geprueft += 1;
        }
      }
      expect(geprueft).toBe(ROLLEN.length * BETRACHTER.length);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // AUFTRAG-BASIC-391 — DIESELBE PARITÄT FÜR DEN LISTENWEG (`PgKoRepo.list`).
  // ----------------------------------------------------------------------------------------------
  //
  // WARUM DAS HIER NÖTIG IST UND NICHT „FOLGT SCHON AUS DEM OBIGEN". `list` und `listForSearch`
  // teilen sich `buildListFilter`, also entsteht dieselbe WHERE-Klausel — aber sie tragen
  // verschiedene Projektionen (`SELECT data` gegenüber `SELECT data - 'bodyHtml'`). „Die WHERE ist
  // per Konstruktion dieselbe" ist genau die Sorte Annahme, die ein Test belegen soll, statt sie zu
  // erben. Der Listenweg ist die Methode, die Auftrag 391 geändert hat; ohne diesen Fall gäbe es
  // für ihn keinen Beleg gegen ein echtes Postgres.
  //
  // Bewusst DERSELBE Kreuzbestand, ohne ihn zu verändern — der Fall kommt zu den 24 Zeilen hinzu
  // und rührt keine der bestehenden Zusicherungen an.
  it("BASIC 391: `list` liefert über alle Rollen-, Autoren- und Vertraulichkeitsfälle dieselbe Menge", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const alle = await repo.list({});
      expect(alle).toHaveLength(24);

      let geprueft = 0;
      for (const role of ROLLEN) {
        for (const id of BETRACHTER) {
          const user: SessionUser = { id, role };
          const ausSql = (await repo.list({}, sqlSichtbarkeitFuer(user))).map((k) => k.id).sort();
          const ausRegel = alle
            .filter((k) => !k.deletedAt && darfSehen(user, k))
            .map((k) => k.id)
            .sort();
          expect(ausSql, `Listenweg — Rolle ${role}, Betrachter ${id}`).toEqual(ausRegel);
          expect(ausSql.length).toBeGreaterThan(0);
          expect(ausSql.length).toBeLessThan(alle.length);
          // Und zeichengleich zu dem, was der Suchweg für denselben Betrachter trimmt: EIN
          // Prädikat, zwei Projektionen — nicht zwei Auslegungen.
          const ausSuchweg = (await repo.listForSearch({}, sqlSichtbarkeitFuer(user)))
            .map((k) => k.id)
            .sort();
          expect(ausSql).toEqual(ausSuchweg);
          geprueft += 1;
        }
      }
      expect(geprueft).toBe(ROLLEN.length * BETRACHTER.length);
    } finally {
      await pool.end();
    }
  });

  it("kein Papierkorb-Objekt überlebt den SQL-Trim — für keine Rolle", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      for (const role of ROLLEN) {
        const treffer = await repo.listForSearch({}, sqlSichtbarkeitFuer({ id: "u-anna", role }));
        expect(treffer.every((k) => !k.deletedAt)).toBe(true);
        expect(treffer.some((k) => k.id.endsWith("trash"))).toBe(false);
      }
    } finally {
      await pool.end();
    }
  });

  it("ein LEERER Autor ist auch in SQL keine Autorschaft (sichtbarkeit.ts:74-76)", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      // Ein Betrachter ohne Kennung darf die autorlosen vertraulichen Objekte NICHT sehen.
      const treffer = await repo.listForSearch(
        {},
        sqlSichtbarkeitFuer({ id: "", role: "experte" }),
      );
      const vertraulichOhneAutor = treffer.filter(
        (k) => k.author === "" && k.confidentiality !== undefined && k.confidentiality !== "intern",
      );
      expect(vertraulichOhneAutor).toEqual([]);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // T-S-2 — EINE SEITE IST VOLL. DER GRUND, WARUM DER TRIM ÜBERHAUPT INS SQL MUSSTE.
  // ----------------------------------------------------------------------------------------------

  it("T-S-2: ein Deckel über dem GETRIMMTEN SQL liefert volle Seiten; derselbe Deckel davor nicht", async () => {
    const pool = createPool(url);
    try {
      const user: SessionUser = { id: "u-bert", role: "experte" };
      const trim = sqlSichtbarkeitFuer(user);
      const seitengroesse = 4;

      // RICHTIG HERUM: Prädikat vor dem Deckel.
      const richtig = await pool.query<{ id: string }>(
        `SELECT id FROM kos WHERE ${trim.sql("kos", 1)} ORDER BY id LIMIT ${seitengroesse}`,
        [...trim.params],
      );
      expect(richtig.rows).toHaveLength(seitengroesse);

      // FALSCH HERUM: Deckel vor dem Prädikat — genau der heutige Bau, den BASIC 379 §1.2 benennt.
      const roh = await pool.query<{ id: string; data: KnowledgeObject }>(
        `SELECT id, data FROM kos ORDER BY id LIMIT ${seitengroesse}`,
      );
      const nachgefiltert = roh.rows.filter((r) => !r.data.deletedAt && darfSehen(user, r.data));
      expect(nachgefiltert.length).toBeLessThan(seitengroesse);
    } finally {
      await pool.end();
    }
  });

  it("Gate 4: der Zähler über der getrimmten Menge kennt kein unsichtbares Objekt", async () => {
    const pool = createPool(url);
    try {
      const fremder: SessionUser = { id: "u-bert", role: "experte" };
      const trim = sqlSichtbarkeitFuer(fremder);
      const gezaehlt = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM kos WHERE ${trim.sql("kos", 1)}`,
        [...trim.params],
      );
      const repo = new PgKoRepo(pool);
      const alle = await repo.listForSearch({});
      const erwartet = alle.filter((k) => !k.deletedAt && darfSehen(fremder, k)).length;
      expect(Number(gezaehlt.rows[0]?.n)).toBe(erwartet);
      // Und er ist echt kleiner als der Bestand — der Zähler ist keine Existenzauskunft.
      expect(erwartet).toBeLessThan(alle.length);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // G-TRIM-LIVE — DIE LEBENDE ZEILE IST DIE TRIMQUELLE, NIE EIN SNAPSHOT.
  // ----------------------------------------------------------------------------------------------

  it("eine Höherstufung wirkt SOFORT — der classification_snapshot ist nicht Berechtigungsquelle", async () => {
    const pool = createPool(url);
    try {
      const fremder: SessionUser = { id: "u-bert", role: "experte" };
      const trim = sqlSichtbarkeitFuer(fremder);
      const repo = new PgKoRepo(pool);
      const ziel = "k-0-0-live"; // Stufe fehlt, Autor u-anna, lebend → für u-bert sichtbar.

      expect((await repo.listForSearch({}, trim)).map((k) => k.id)).toContain(ziel);

      // Eine veraltete Projektionszeile, die das Gegenteil behauptet — sie darf nichts bewirken.
      await pool.query(
        `INSERT INTO ko_search_projections
           (ko_id, ko_version, projection_version, search_text, title_text, statement_text,
            caption_text, body_text, language, content_hash, status, classification_snapshot,
            generation, created_at, updated_at)
         VALUES ($1, 1, 1, 'lieferzeiten', 'lieferzeiten', 'lieferzeiten',
            '', 'lieferzeiten', 'de', 'h', 'validiert', 'intern',
            1, '2026-07-01T10:00:00.000Z', '2026-07-01T10:00:00.000Z')
         ON CONFLICT DO NOTHING`,
        [ziel],
      );
      // Gegenprobe: der Snapshot behauptet weiterhin 'intern' — er darf gleich nichts bewirken.
      const snapshot = await pool.query<{ classification_snapshot: string }>(
        "SELECT classification_snapshot FROM ko_search_projections WHERE ko_id = $1",
        [ziel],
      );
      expect(snapshot.rows[0]?.classification_snapshot).toBe("intern");
      await pool.query(
        "UPDATE kos SET data = jsonb_set(data,'{confidentiality}', to_jsonb('vertraulich'::text)) WHERE id = $1",
        [ziel],
      );

      const danach = (await repo.listForSearch({}, trim)).map((k) => k.id);
      expect(danach).not.toContain(ziel);

      // Zurücksetzen, damit die übrigen Fälle auf demselben Bestand laufen.
      await pool.query("UPDATE kos SET data = data - 'confidentiality' WHERE id = $1", [ziel]);
      expect((await repo.listForSearch({}, trim)).map((k) => k.id)).toContain(ziel);
    } finally {
      await pool.end();
    }
  });

  // ----------------------------------------------------------------------------------------------
  // ALTVERTRAG — DIE MIGRATION ÄNDERT KEINE ZEILE, UND OHNE TRIM BLEIBT ALLES WIE HEUTE.
  // ----------------------------------------------------------------------------------------------

  it("migrate() ist wiederholbar und verändert keine Zeile in `kos` (T-K-3, eng)", async () => {
    const pool = createPool(url);
    try {
      const vorher = await pool.query<{ h: string }>(
        "SELECT md5(string_agg(id || data::text, '|' ORDER BY id)) AS h FROM kos",
      );
      await expect(migrate(pool)).resolves.toBeUndefined();
      const nachher = await pool.query<{ h: string }>(
        "SELECT md5(string_agg(id || data::text, '|' ORDER BY id)) AS h FROM kos",
      );
      expect(nachher.rows[0]?.h).toBe(vorher.rows[0]?.h);
    } finally {
      await pool.end();
    }
  });

  it("OHNE injizierten Trim liefert listForSearch weiterhin den ungetrimmten Bestand (Altvertrag)", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const alle = await repo.listForSearch({});
      expect(alle).toHaveLength(24);
      expect(alle.some((k) => k.deletedAt)).toBe(true);
    } finally {
      await pool.end();
    }
  });
});
