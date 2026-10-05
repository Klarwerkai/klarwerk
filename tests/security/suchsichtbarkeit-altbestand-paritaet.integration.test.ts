// ================================================================================================
// AUFNAHME 20260922 · SUCHSICHTBARKEIT BEI ALTDATEN — SPEICHER GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Die Zusatzfälle aus BEN 4359, GETRENNT vom abgeschlossenen SQL-Trim-Vertrag
// (`380-trim-paritaet.integration.test.ts`) und vom Suchdeckelvertrag
// (`suchdeckel-trim-paritaet.integration.test.ts`). Beide bleiben unverändert; diese Datei misst an
// derselben 4303-Naht (`findSearchHits(query, trim)`), aber über einen ALTBESTAND:
//
//     derselbe Saatplan (suchsichtbarkeit-altbestand-fixture.ts)
//   → über den Produktweg angelegt, dann roh in die Altform gebracht (`KoRepo.update`)
//   → einmal im Speicher-Adapter, einmal in PostgreSQL
//   → Treffer-IDs und Zählwerte gegeneinander, gegen `darfSehen` und gegen die von Hand
//     festgelegte Regel je Fall.
//
// ZWEI TEILE, BEWUSST GETRENNT (Nacharbeit nach Bens Urteil, Runde 1):
//
//   · PARITÄTSABNAHME — K1/K2 über die regelkonformen Altfälle und AH-1…AH-4 über die
//     Hypothesenfälle. Jeder dieser Fälle verlangt die Kriterien STRIKT: PostgreSQL = Speicher =
//     festgelegte Regel, gleiche Anzahl, kein unberechtigter Treffer. Kein Fall erwartet eine
//     Abweichung.
//   · FEHLERREPRODUKTION — gibt es nur als Folge der Abnahme: trifft eine der aus dem Code
//     abgeleiteten Hypothesen A1–A3 (`ABWEICHUNGSHYPOTHESEN`, ungemessen) zu, wird genau ihr
//     Abnahmefall rot, und die Meldung nennt Fixture, Altform, Rolle, Betrachter und Herleitung.
//     Die Datei behauptet an keiner Stelle, dass eine Abweichung besteht oder nicht besteht —
//     das entscheidet erst ein Lauf gegen echtes PostgreSQL.
//
// Prüfplatz nach dem Muster von JOB 4321/4359: `KLARWERK_PG_TEST_URL` über die Sicherung, sonst
// Testcontainers, sonst ein SICHTBARER Skip mit Grund. Eigenes Schema.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  type KoRepo,
  KoService,
  PgKoRepo,
  PgKoSearchProjectionRepo,
  normalizeConfidentiality,
} from "../../services/knowledge-object";
import { can } from "../../services/rbac";
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";
import {
  ABWEICHUNGSHYPOTHESEN,
  BEGRIFF_ALT,
  BEGRIFF_BEFUND,
  BESTAND,
  BETRACHTER,
  OHNE_KENNUNG,
  mitAltform,
  siehtNachRegel,
} from "./suchsichtbarkeit-altbestand-fixture";

const LAUF = "[KLARWERK][AUFNAHME 20260922 Altbestand]";
const EIGENES_SCHEMA = "aufnahme20260922_altbestand";
const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];

const ALT = BESTAND.filter((s) => s.begriff === BEGRIFF_ALT);
const DECKEL: readonly (number | undefined)[] = [1, 5, ALT.length, undefined];

type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

function ohneGeheimnis(url: string): string {
  return url.replace(/:\/\/([^/@]*)@/, (_treffer, anmeldedaten: string) => {
    const benutzer = anmeldedaten.split(":")[0] ?? "";
    return `://${benutzer}:***@`;
  });
}

interface Stapel {
  readonly name: string;
  readonly ko: KoService;
  readonly repo: KoRepo;
}

/** Deterministische, gleich lange Kennungen — beide Ablagen ordnen Gleichstände dann gleich. */
function kennungszaehler(): () => string {
  let n = 0;
  return () => `a0922${String(++n).padStart(3, "0")}`;
}

function speicherStapel(): Stapel {
  const repo = new InMemoryKoRepo();
  return {
    name: "Speicher",
    repo,
    ko: new KoService({
      repo,
      searchProjections: new InMemoryKoSearchProjectionRepo(repo),
      genId: kennungszaehler(),
    }),
  };
}

function pgStapel(pool: Pool): Stapel {
  const repo = new PgKoRepo(pool);
  return {
    name: "PostgreSQL",
    repo,
    ko: new KoService({
      repo,
      searchProjections: new PgKoSearchProjectionRepo(pool),
      genId: kennungszaehler(),
    }),
  };
}

async function seede(s: Stapel): Promise<Map<string, string>> {
  const { readiness } = await s.ko.activateSearchProjectionV2();
  expect(readiness.alle, `${s.name}: ${readiness.befunde.join("; ")}`).toBe(true);
  const kennungen = new Map<string, string>();
  for (const saat of BESTAND) {
    const angelegt = await s.ko.create({
      type: "best_practice",
      category: "Handbuch",
      author: saat.autor,
      title: `Notiz zur ${saat.begriff} ${saat.marke}`,
      statement: `Messreihe ${saat.marke} zur ${saat.begriff}.`,
      confidentiality: saat.stufe,
    });
    await s.ko.setValidationState(angelegt.id, { trust: saat.trust, status: "validiert" });
    if (saat.altform) {
      const ist = await s.repo.findById(angelegt.id);
      if (!ist) {
        throw new Error(`${s.name}: ${saat.marke} nach Anlage nicht lesbar`);
      }
      // Die Altform wird ROH geschrieben — derselbe Weg in beiden Ablagen, keine Normalisierung.
      await s.repo.update(mitAltform(ist, saat.altform));
    }
    kennungen.set(saat.marke, angelegt.id);
  }
  return kennungen;
}

async function treffer(
  s: Stapel,
  user: SessionUser,
  begriff: string,
  deckel?: number,
): Promise<readonly string[]> {
  const frage = deckel === undefined ? { terms: [begriff] } : { terms: [begriff], limit: deckel };
  return (await s.ko.findSearchHits(frage, sqlSichtbarkeitFuer(user))).map((h) => h.koId);
}

async function ungetrimmt(s: Stapel, begriff: string): Promise<readonly string[]> {
  return (await s.ko.findSearchHits({ terms: [begriff] })).map((h) => h.koId);
}

/** Der Massstab aus der Regel: Grundmenge des Speichers, `!deletedAt && darfSehen`, dann Deckel. */
async function nachDerRegel(
  s: Stapel,
  user: SessionUser,
  begriff: string,
  deckel?: number,
): Promise<readonly string[]> {
  const stand = new Map((await s.repo.listForSearch({})).map((k) => [k.id, k]));
  const sichtbar = (await ungetrimmt(s, begriff)).filter((id) => {
    const ko = stand.get(id);
    return Boolean(ko && !ko.deletedAt && darfSehen(user, ko));
  });
  return deckel === undefined ? sichtbar : sichtbar.slice(0, deckel);
}

describe("Aufnahme 20260922 · Suchsichtbarkeit bei Altdaten — Speicher gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let pool: Pool | undefined;
  let speicher: Stapel | undefined;
  let pg: Stapel | undefined;
  let marken: Map<string, string> | undefined;
  let laufzustand: Laufzustand | undefined;
  let gemeldet = false;

  function meldeLaufzustand(): void {
    if (gemeldet) {
      return;
    }
    gemeldet = true;
    const z = laufzustand;
    if (!z) {
      process.stderr.write(`${LAUF} KEIN LAUFZUSTAND — beforeAll lief nicht.\n`);
    } else if (z.gelaufen) {
      process.stderr.write(`${LAUF} Altbestand-Parität GELAUFEN gegen ${z.quelle}.\n`);
    } else {
      process.stderr.write(
        `${LAUF} Altbestand-Parität ÜBERSPRUNGEN — Grund: ${z.grund}. Die Altfälle wurden NICHT gegen PostgreSQL geprüft.\n`,
      );
    }
  }

  beforeAll(async () => {
    let url = "";
    let quelle = "";
    let grund = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
      quelle = `lokale Testinstanz · ${ohneGeheimnis(lokal)}`;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = `Testcontainer postgres:16-alpine · ${ohneGeheimnis(url)}`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (url) {
      verwaltung = createPool(url);
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // Ab hier wird nichts mehr gefangen: ein kaputter Aufbau färbt rot.
        await stelleTrigrammErweiterungSicher(verwaltung);
        await verwaltung.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`);
        await verwaltung.query(`CREATE SCHEMA ${EIGENES_SCHEMA}`);
        pool = new Pool({
          connectionString: url,
          options: `-c search_path=${EIGENES_SCHEMA},public`,
        });
        await migrate(pool);
        speicher = speicherStapel();
        pg = pgStapel(pool);
        const imSpeicher = await seede(speicher);
        const inPg = await seede(pg);
        expect([...inPg.entries()], "die Ablagen tragen nicht dieselben Kennungen").toEqual([
          ...imSpeicher.entries(),
        ]);
        marken = imSpeicher;
        laufzustand = { gelaufen: true, quelle: `${quelle} (Schema ${EIGENES_SCHEMA})` };
      }
    }
    if (!pool) {
      laufzustand = { gelaufen: false, grund };
    }
    meldeLaufzustand();
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await verwaltung
      ?.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  interface Platz {
    speicher: Stapel;
    pg: Stapel;
    pool: Pool;
    id: (marke: string) => string;
  }

  function verlangePlatz(ctx: { skip: () => void }): Platz {
    if (!speicher || !pg || !marken || !pool) {
      meldeLaufzustand();
      ctx.skip();
      throw new Error("unreachable");
    }
    const karte = marken;
    const id = (marke: string): string => {
      const wert = karte.get(marke);
      if (!wert) {
        throw new Error(`${LAUF} unbekannte Marke ${marke}`);
      }
      return wert;
    };
    return { speicher, pg, pool, id };
  }

  /** Die von Hand festgelegte Erwartung für einen Betrachter, in Ausgabeordnung. */
  function sollNachSaatplan(p: Platz, user: SessionUser, begriff: string): string[] {
    const mitValidate = can(user.role, "ko.validate");
    return BESTAND.filter((s) => s.begriff === begriff)
      .filter((s) => siehtNachRegel(s.regel, user.id, mitValidate))
      .map((s) => p.id(s.marke));
  }

  it("der Lauf bezeugt seinen eigenen Zustand — übersprungen ist von gelaufen unterscheidbar", async () => {
    meldeLaufzustand();
    expect(laufzustand, "beforeAll hat keinen Laufzustand hinterlassen").toBeDefined();
    const zustand = laufzustand as Laufzustand;
    if (zustand.gelaufen) {
      const gezaehlt = await (pool as Pool).query<{ n: number }>(
        "SELECT count(*)::int AS n FROM kos",
      );
      expect(gezaehlt.rows[0]?.n).toBe(BESTAND.length);
    } else {
      expect(pool).toBeUndefined();
      expect(zustand.grund.trim().length, "ÜBERSPRUNGEN ohne Grund").toBeGreaterThan(0);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // DER BESTAND — die Altform liegt wirklich roh in beiden Ablagen.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("beide Ablagen tragen die Altform roh, und die generierten Spalten folgen der bestehenden Auslegung", async (ctx) => {
    const p = verlangePlatz(ctx);
    for (const saat of BESTAND) {
      const id = p.id(saat.marke);
      const zeile = await p.pool.query<{
        vorhanden: boolean;
        roh: unknown;
        confidentiality_key: string;
        author_key: string | null;
        deleted_at_key: string | null;
        roh_stufe: string | null;
      }>(
        `SELECT data ? $2 AS vorhanden, data->$2 AS roh, confidentiality_key, author_key,
                deleted_at_key, data->>'confidentiality' AS roh_stufe
           FROM kos WHERE id = $1`,
        [id, saat.altform?.feld ?? "author"],
      );
      const r = zeile.rows[0];
      expect(r, saat.marke).toBeDefined();
      const imSpeicher = (await p.speicher.repo.findById(id)) as unknown as Record<string, unknown>;
      if (saat.altform) {
        const feld = saat.altform.feld;
        if ("entfernt" in saat.altform) {
          expect(r?.vorhanden, `PostgreSQL ${saat.marke}: ${feld} noch da`).toBe(false);
          expect(feld in imSpeicher, `Speicher ${saat.marke}: ${feld} noch da`).toBe(false);
        } else {
          expect(r?.vorhanden, `PostgreSQL ${saat.marke}: ${feld} fehlt`).toBe(true);
          expect(r?.roh, `PostgreSQL ${saat.marke}: Rohwert`).toEqual(saat.altform.wert);
          expect(imSpeicher[feld], `Speicher ${saat.marke}: Rohwert`).toEqual(saat.altform.wert);
        }
      }
      // Die generierte Stufe ist für jede Zeile die bestehende Auslegung — auch für Altstufen.
      expect(r?.confidentiality_key, `${saat.marke}: confidentiality_key`).toBe(
        normalizeConfidentiality(r?.roh_stufe),
      );
      if (saat.altform?.feld === "confidentiality") {
        expect(r?.confidentiality_key, `${saat.marke}: Altstufe`).toBe("intern");
      }
    }
    // Ungetrimmt findet der Speicher (die Referenz) jeden Saatling beider Begriffe. Für PostgreSQL
    // wird das hier nur beim regelkonformen Begriff verlangt; der Hypothesenbegriff wird strikt in
    // den AH-Fällen abgenommen.
    for (const begriff of [BEGRIFF_ALT, BEGRIFF_BEFUND]) {
      const alle = BESTAND.filter((s) => s.begriff === begriff).map((s) => p.id(s.marke));
      expect(await ungetrimmt(p.speicher, begriff), `Speicher ${begriff}`).toEqual(alle);
    }
    expect(await ungetrimmt(p.pg, BEGRIFF_ALT)).toEqual(ALT.map((s) => p.id(s.marke)));
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K1 — REGELKONFORME ALTFÄLLE: DIESELBEN IDS UND ZÄHLWERTE, FÜR JEDE ROLLE UND JEDEN DECKEL.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("K1 · Stufen- und Autor-Altfälle: Speicher, PostgreSQL und darfSehen liefern dieselben IDs und Zählwerte", async (ctx) => {
    const p = verlangePlatz(ctx);
    let geprueft = 0;
    for (const role of ROLLEN) {
      for (const betrachter of BETRACHTER) {
        const user: SessionUser = { id: betrachter, role };
        for (const deckel of DECKEL) {
          const lage = `Rolle ${role}, Betrachter ${betrachter || "(leer)"}, Deckel ${deckel ?? "ohne"}`;
          const ausSpeicher = await treffer(p.speicher, user, BEGRIFF_ALT, deckel);
          const ausPg = await treffer(p.pg, user, BEGRIFF_ALT, deckel);
          expect(ausPg, `${lage}: Treffermengen laufen auseinander`).toEqual(ausSpeicher);
          expect(ausPg, `${lage}: PostgreSQL weicht von darfSehen ab`).toEqual(
            await nachDerRegel(p.pg, user, BEGRIFF_ALT, deckel),
          );
          expect(ausSpeicher, `${lage}: Speicher weicht von darfSehen ab`).toEqual(
            await nachDerRegel(p.speicher, user, BEGRIFF_ALT, deckel),
          );
          const soll = sollNachSaatplan(p, user, BEGRIFF_ALT);
          expect(ausPg, `${lage}: weicht von der festgelegten Regel ab`).toEqual(
            deckel === undefined ? soll : soll.slice(0, deckel),
          );
          expect(ausPg.length, `${lage}: Zählwerte`).toBe(ausSpeicher.length);
          geprueft += 1;
        }
      }
    }
    expect(geprueft).toBe(ROLLEN.length * BETRACHTER.length * DECKEL.length);
  });

  it("K2 · nicht Berechtigte finden keinen vertraulichen Altautor-Eintrag — in keiner Ablage, bei keinem Deckel", async (ctx) => {
    const p = verlangePlatz(ctx);
    const verborgen = ["autorLeer", "autorFehlt", "autorNull", "autorLeerzeichen"].map(p.id);
    for (const s of [p.speicher, p.pg]) {
      for (const role of ["viewer", "experte"] as const) {
        for (const betrachter of BETRACHTER) {
          for (const deckel of DECKEL) {
            const geliefert = await treffer(s, { id: betrachter, role }, BEGRIFF_ALT, deckel);
            for (const id of verborgen) {
              expect(
                geliefert,
                `${s.name} ${role}/${betrachter || "(leer)"} Deckel ${deckel ?? "ohne"}`,
              ).not.toContain(id);
            }
          }
        }
      }
      // Nicht trivial: ungetrimmt stehen sie ganz vorn und würden Deckel 1 füllen.
      expect((await ungetrimmt(s, BEGRIFF_ALT))[0]).toBe(p.id("autorLeer"));
      // Der Betrachter OHNE Kennung bekommt genau die „jeder"-Fälle, bei Deckel 1 die erste Altstufe.
      expect(await treffer(s, { id: OHNE_KENNUNG, role: "experte" }, BEGRIFF_ALT, 1)).toEqual([
        p.id("stufeFehlt"),
      ]);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // PARITÄTSABNAHME DER HYPOTHESENFÄLLE — STRIKT, JE HYPOTHESE EIN FALL.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Die Erwartung ist die festgelegte Regel (`regel` im Saatplan), NICHT die Hypothese. Ist die
  // Hypothese falsch, ist dieser Fall grün und die Hypothese widerlegt; ist sie richtig, ist er rot
  // und die Meldung ist die Reproduktion.
  for (const hypothese of ABWEICHUNGSHYPOTHESEN) {
    it(`AH · ${hypothese.kennung} ${hypothese.marke}: PostgreSQL liefert für jede Rolle und jeden Betrachter genau das Berechtigte`, async (ctx) => {
      const p = verlangePlatz(ctx);
      const saat = BESTAND.find((s) => s.marke === hypothese.marke);
      expect(saat?.altform, `${hypothese.kennung}: Fixture ohne Altform`).toBeDefined();
      const id = p.id(hypothese.marke);
      const fixture = `Fixture ${hypothese.marke} (${JSON.stringify(saat?.altform)}, Stufe ${saat?.stufe})`;
      for (const role of ROLLEN) {
        for (const betrachter of BETRACHTER) {
          const user: SessionUser = { id: betrachter, role };
          const berechtigt = siehtNachRegel(
            saat?.regel ?? "nurValidate",
            betrachter,
            can(role, "ko.validate"),
          );
          const lage = `${hypothese.kennung} · ${fixture} · Rolle ${role} · Betrachter ${betrachter || "(leer)"} · berechtigt=${berechtigt}`;
          const ausSpeicher = await treffer(p.speicher, user, BEGRIFF_BEFUND);
          const ausPg = await treffer(p.pg, user, BEGRIFF_BEFUND);
          expect(ausSpeicher.includes(id), `Speicher/Referenz · ${lage}`).toBe(berechtigt);
          expect(
            ausPg.includes(id),
            `PostgreSQL · ${lage} · Hypothese (${hypothese.stand}): ${hypothese.herleitung}`,
          ).toBe(berechtigt);
        }
      }
    });
  }

  it("AH · Hypothesenbegriff gesamt: PostgreSQL, Speicher und Regel liefern dieselbe Menge und Anzahl — bei jedem Deckel", async (ctx) => {
    const p = verlangePlatz(ctx);
    const deckel: readonly (number | undefined)[] = [1, 2, undefined];
    for (const role of ROLLEN) {
      for (const betrachter of BETRACHTER) {
        const user: SessionUser = { id: betrachter, role };
        const soll = sollNachSaatplan(p, user, BEGRIFF_BEFUND);
        // Nicht trivial: die Kontrolle ist für jeden berechtigt, die Menge also nie leer.
        expect(soll).toContain(p.id("befundKontrolle"));
        for (const d of deckel) {
          const lage = `Rolle ${role}, Betrachter ${betrachter || "(leer)"}, Deckel ${d ?? "ohne"}`;
          const erwartet = d === undefined ? soll : soll.slice(0, d);
          const ausSpeicher = await treffer(p.speicher, user, BEGRIFF_BEFUND, d);
          const ausPg = await treffer(p.pg, user, BEGRIFF_BEFUND, d);
          expect(ausSpeicher, `Speicher · ${lage}`).toEqual(erwartet);
          expect(ausPg, `PostgreSQL · ${lage}`).toEqual(erwartet);
          expect(ausPg.length, `Anzahl · ${lage}`).toBe(ausSpeicher.length);
        }
      }
    }
  });
});
