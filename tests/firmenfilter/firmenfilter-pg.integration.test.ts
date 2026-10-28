// ================================================================================================
// produkt:20261011:peter-p14 · DER FIRMENFILTER IN SQL IST DIESELBE REGEL WIE IN DER APP.
// ================================================================================================
//
// `firmenTrim` hängt das Bereichsprädikat UND-verknüpft an den Sichtbarkeitstrim, damit es VOR
// Trefferdeckel, Seite und Zählung wirkt. Damit gibt es wieder zwei Formen derselben Regel — der
// Beweis, dass es nur eine ist, führt (wie bei `tests/security/380-trim-paritaet`) über ein echtes
// Postgres und über ALLE Kombinationen:
//
//   Bestand:     {kein Space, Partner Alpha, Partner Beta, eigener Space} × {öffentlich, nicht}
//                × {Stufe fehlt, intern, vertraulich} × {Autor, leerer Autor} × {lebend, getrasht}
//   Betrachter:  {viewer, experte, controller, admin} × {Autor, Fremder}
//                × {keine Spaces, Alpha, alle Spaces, Spaces unbekannt}
//   Filter:      alle sieben Bereichsauswahlen + vier Partnerkennungen (auch fremd/unbekannt)
//
// GEMESSEN WIRD MENGENGLEICHHEIT gegen `!deletedAt && darfSehen && imFirmenfilter`. Eine Abweichung
// in die eine Richtung wäre ein Leck, in die andere ein Funktionsverlust.
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K2 · der Filter öffnet nichts (Teilmenge der Sichtbarkeit, in jeder Kombination)
//   K3 · Rechte VOR der Suche: das Prädikat steht in derselben WHERE-Klausel wie der Trim
//   K5 · Zähler und Seiten über der gefilterten Menge kennen kein unsichtbares Objekt
//   K6 · die lebende Zeile entscheidet: Spacewechsel und Höherstufung wirken sofort
//
// Nutzt eine bewachte lokale PG-URL oder Docker, jeweils mit eigener frischer Testdatenbank.
// Läuft unter `npm run test:integration`. Erfundene Testdaten.
import type { StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  type Bereichsmarken,
  FIRMENBEREICHE,
  type Firmenbereich,
  type Firmenfilter,
  firmenTrim,
  imFirmenfilter,
} from "../../services/app/src/firmenbereich";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Confidentiality,
  type KnowledgeObject,
  PgKoRepo,
} from "../../services/knowledge-object";

// Nacharbeit 8 (AC01): die Marken der EINEN Bereichsableitung — Partner- UND öffentliche Spaces.
const PARTNER: Bereichsmarken = {
  partner: new Set(["s-alpha", "s-beta"]),
  oeffentlich: new Set(["s-normen"]),
};
const SPACES: readonly (string | undefined)[] = [
  undefined,
  "s-alpha",
  "s-beta",
  "s-werk",
  "s-normen",
];
const STUFEN: readonly (Confidentiality | undefined)[] = [undefined, "intern", "vertraulich"];
const AUTOREN: readonly string[] = ["u-anna", ""];
const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];
const BETRACHTER: readonly string[] = ["u-anna", "u-bert"];
const LESBAR: readonly (ReadonlySet<string> | undefined)[] = [
  new Set(),
  new Set(["s-alpha"]),
  new Set(["s-alpha", "s-beta", "s-werk", "s-normen"]),
  undefined,
];

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Messkettenabgleich",
    statement: "Vor jeder Schicht.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Messtechnik",
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
    createdAt: "2026-10-11T08:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as KnowledgeObject;
}

// 5 Spaces (ohne, Partner Alpha, Partner Beta, eigener, öffentlicher) × 2 Marken × 3 Stufen
// × 2 Autoren × 2 Papierkorbzustände = 120 Zeilen.
function kreuzbestand(): KnowledgeObject[] {
  const out: KnowledgeObject[] = [];
  for (const [ri, spaceId] of SPACES.entries()) {
    for (const oeffentlich of [false, true]) {
      for (const [si, stufe] of STUFEN.entries()) {
        for (const [ai, autor] of AUTOREN.entries()) {
          for (const getrasht of [false, true]) {
            out.push(
              ko({
                id: `k-${ri}-${oeffentlich ? "o" : "n"}-${si}-${ai}-${getrasht ? "t" : "l"}`,
                author: autor,
                originalAuthor: autor,
                ...(spaceId ? { spaceId } : {}),
                ...(oeffentlich ? { oeffentlich: true } : {}),
                ...(stufe ? { confidentiality: stufe } : {}),
                ...(getrasht ? { deletedAt: "2026-10-11T09:00:00.000Z" } : {}),
              }),
            );
          }
        }
      }
    }
  }
  return out;
}

function auswahl(...bereiche: Firmenbereich[]): Firmenfilter {
  return { bereiche: new Set<Firmenbereich>(bereiche) };
}

function betrachter(id: string, role: Role, ...spaces: string[]): SessionUser {
  return { id, role, spaceLesbar: new Set(spaces) };
}

function alleFilter(): Firmenfilter[] {
  const out: Firmenfilter[] = [];
  for (let maske = 1; maske < 1 << FIRMENBEREICHE.length; maske += 1) {
    out.push(auswahl(...FIRMENBEREICHE.filter((_, i) => (maske & (1 << i)) !== 0)));
  }
  for (const partner of ["s-alpha", "s-beta", "s-werk", "s-fremd"]) {
    out.push({ ...auswahl("partner"), partner });
  }
  return out;
}

function betrachterListe(): SessionUser[] {
  const out: SessionUser[] = [];
  for (const role of ROLLEN) {
    for (const id of BETRACHTER) {
      for (const spaceLesbar of LESBAR) {
        out.push(spaceLesbar ? { id, role, spaceLesbar } : { id, role });
      }
    }
  }
  return out;
}

function beschreibe(user: SessionUser, filter: Firmenfilter): string {
  const lesbar = user.spaceLesbar ? [...user.spaceLesbar].join("+") || "keine" : "unbekannt";
  const auswahl = [...filter.bereiche].join("+") + (filter.partner ? `:${filter.partner}` : "");
  return `${user.role}/${user.id}/Spaces ${lesbar} · ${auswahl}`;
}

describe("P14 · Firmenfilter: SQL-Prädikat und App-Regel liefern dieselbe Menge", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: ReturnType<typeof createPool> | undefined;
  let datenbank = "";
  let url: string;

  beforeAll(async () => {
    let basis: string;
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basis = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL !== undefined) {
      throw new Error("KLARWERK_PG_TEST_URL abgelehnt — kein Container-Rückfall");
    } else {
      const { GenericContainer, Wait } = await import("testcontainers");
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      basis = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    verwaltung = createPool(basis);
    const name = `klarwerk_firmenfilter_test_${process.pid}_${Date.now()}`;
    await verwaltung.query(`CREATE DATABASE "${name}"`);
    datenbank = name;
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
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
    const fehler: unknown[] = [];
    if (verwaltung) {
      try {
        if (datenbank) {
          await verwaltung.query(`DROP DATABASE "${datenbank}"`);
        }
      } catch (error) {
        fehler.push(error);
      }
      try {
        await verwaltung.end();
      } catch (error) {
        fehler.push(error);
      }
    }
    try {
      await container?.stop();
    } catch (error) {
      fehler.push(error);
    }
    if (fehler.length > 0) {
      throw new AggregateError(fehler, "Firmenfilter-Testdatenbank nicht vollständig aufgeräumt");
    }
  });

  it("K2/K3: über alle Betrachter × Filter × Bestand sind `list` und `listForSearch` gleich der Regel", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const alle = await repo.list({});
      expect(alle).toHaveLength(120);
      let geprueft = 0;
      let nichtLeer = 0;
      let echtEnger = 0;
      for (const user of betrachterListe()) {
        const sichtbar = alle.filter((k) => !k.deletedAt && darfSehen(user, k));
        for (const filter of alleFilter()) {
          const trim = firmenTrim(sqlSichtbarkeitFuer(user), filter, PARTNER);
          const ausRegel = sichtbar
            .filter((k) => imFirmenfilter(k, filter, PARTNER))
            .map((k) => k.id)
            .sort();
          const ausListe = (await repo.list({}, trim)).map((k) => k.id).sort();
          const ausSuche = (await repo.listForSearch({}, trim)).map((k) => k.id).sort();
          expect(ausListe, beschreibe(user, filter)).toEqual(ausRegel);
          expect(ausSuche, beschreibe(user, filter)).toEqual(ausRegel);
          // K2: nie mehr als die Sichtbarkeit allein.
          const ueberschuss = ausListe.filter((id) => !sichtbar.some((k) => k.id === id));
          expect(ueberschuss, beschreibe(user, filter)).toEqual([]);
          if (ausListe.length > 0) {
            nichtLeer += 1;
          }
          if (ausListe.length < sichtbar.length) {
            echtEnger += 1;
          }
          geprueft += 1;
        }
      }
      expect(geprueft).toBe(betrachterListe().length * alleFilter().length);
      // Gegenprobe: die Gleichheit ist nicht trivial — viele Fälle tragen Treffer, viele grenzen ein.
      expect(nichtLeer).toBeGreaterThan(geprueft / 3);
      expect(echtEnger).toBeGreaterThan(geprueft / 3);
    } finally {
      await pool.end();
    }
  });

  it("der Tabellenalias ist frei wählbar (Suchprojektion verbindet `kos` als `k`)", async () => {
    const pool = createPool(url);
    try {
      const user = betrachter("u-bert", "experte", "s-alpha");
      const trim = firmenTrim(sqlSichtbarkeitFuer(user), auswahl("partner"), PARTNER);
      const mitKos = await pool.query<{ id: string }>(
        `SELECT id FROM kos WHERE ${trim.sql("kos", 1)} ORDER BY id`,
        [...trim.params],
      );
      const mitK = await pool.query<{ id: string }>(
        `SELECT k.id FROM kos k WHERE ${trim.sql("k", 1)} ORDER BY k.id`,
        [...trim.params],
      );
      expect(mitK.rows).toEqual(mitKos.rows);
      expect(mitKos.rows.length).toBeGreaterThan(0);
      expect(mitKos.rows.every((r) => r.id.startsWith("k-1-"))).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("K5: Seite und Zähler über der gefilterten Menge — volle Seite, kein unsichtbares Objekt", async () => {
    const pool = createPool(url);
    try {
      const user = betrachter("u-bert", "viewer", "s-alpha");
      const filter = auswahl("eigen", "partner");
      const trim = firmenTrim(sqlSichtbarkeitFuer(user), filter, PARTNER);
      const repo = new PgKoRepo(pool);
      const alle = await repo.list({});
      const erwartet = alle.filter(
        (k) => !k.deletedAt && darfSehen(user, k) && imFirmenfilter(k, filter, PARTNER),
      );
      const gezaehlt = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM kos WHERE ${trim.sql("kos", 1)}`,
        [...trim.params],
      );
      expect(Number(gezaehlt.rows[0]?.n)).toBe(erwartet.length);
      expect(erwartet.length).toBeLessThan(alle.length);

      const seitengroesse = 4;
      const seite = await pool.query<{ id: string; data: KnowledgeObject }>(
        `SELECT id, data FROM kos WHERE ${trim.sql("kos", 1)} ORDER BY id LIMIT ${seitengroesse}`,
        [...trim.params],
      );
      expect(seite.rows).toHaveLength(seitengroesse);
      expect(seite.rows.every((r) => erwartet.some((k) => k.id === r.id))).toBe(true);
    } finally {
      await pool.end();
    }
  });

  it("K6: die lebende Zeile entscheidet — Spacewechsel, Marke und Höherstufung wirken sofort", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const user = betrachter("u-bert", "experte", "s-alpha");
      const partner = firmenTrim(sqlSichtbarkeitFuer(user), auswahl("partner"), PARTNER);
      const oeffentlich = firmenTrim(sqlSichtbarkeitFuer(user), auswahl("oeffentlich"), PARTNER);
      const ziel = "k-1-n-1-0-l"; // Partner Alpha, intern, lebend
      const marke = "k-0-o-1-0-l"; // ohne Space, öffentlich, intern, lebend
      const ids = async (trim: typeof partner) => (await repo.list({}, trim)).map((k) => k.id);
      expect(await ids(partner)).toContain(ziel);
      expect(await ids(oeffentlich)).toContain(marke);

      await pool.query(
        "UPDATE kos SET data = jsonb_set(data, '{spaceId}', to_jsonb('s-beta'::text)) WHERE id = $1",
        [ziel],
      );
      expect(await ids(partner)).not.toContain(ziel);
      await pool.query(
        "UPDATE kos SET data = jsonb_set(data, '{confidentiality}', to_jsonb('vertraulich'::text)) WHERE id = $1",
        [marke],
      );
      expect(await ids(oeffentlich)).not.toContain(marke);

      // Zurücksetzen, damit die übrigen Fälle auf demselben Bestand laufen.
      await pool.query(
        "UPDATE kos SET data = jsonb_set(data, '{spaceId}', to_jsonb('s-alpha'::text)) WHERE id = $1",
        [ziel],
      );
      await pool.query(
        "UPDATE kos SET data = jsonb_set(data, '{confidentiality}', to_jsonb('intern'::text)) WHERE id = $1",
        [marke],
      );
      expect(await ids(partner)).toContain(ziel);
      expect(await ids(oeffentlich)).toContain(marke);
    } finally {
      await pool.end();
    }
  });
});
