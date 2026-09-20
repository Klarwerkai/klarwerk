// ================================================================================================
// JOB 4359 · DER SUCHDECKEL ZÄHLT IN DER ECHTEN DATENBANK GENAU DAS, WAS DER MENSCH SEHEN DARF.
// ================================================================================================
//
// WAS HIER NEU IST UND WARUM ES EINE EIGENE DATEI IST. JOB 4303 hat den Sichtbarkeitstrim an die
// gedeckelte Trefferabfrage (`findSearchHits` → `KoSearchProjectionRepo.findActive`) gelegt — VOR
// den Deckel, auf der Grundmenge. Belegt war das bis heute an zwei Stellen, und beide messen den
// Vollzug NICHT: der Speicher-Adapter über einen Dienstlauf
// (`tests/wiki-grossbestand-nutzerweg/deckel-auf-sichtbarer-grundmenge.test.ts`, D3) und der
// PostgreSQL-Adapter über die ERZEUGTE Anweisung an einem Attrappen-Pool (ebenda, D4 — „SQL-Pin").
// Die Rückgabe von 4303 sagt das selbst (R1 Z. 48, R3 Z. 56/76). Eine gepinnte Anweisung ist ein
// Beleg über die Bauform, kein Beleg über das Ergebnis: sie zeigt nicht, dass PostgreSQL daraus
// dieselbe Menge macht wie der Speicher.
//
// DIESE DATEI SCHLIESST GENAU DIESE LÜCKE — ausführend, gegen echtes PostgreSQL, über BEIDE
// Adapter am DERSELBEN Bestand:
//
//     derselbe gemischte Bestand (Rollen × eigene/fremde Autorschaft × Papierkorb × Stufen)
//   → einmal im Speicher-Adapter, einmal in PostgreSQL
//   → `findSearchHits(query, trim)` über Deckel 1, 5 und Bestandsgröße
//   → identische Treffermengen (IDs), identische Zählwerte, jeweils gleich der `darfSehen`-Regel.
//
// ABGRENZUNG ZUM NACHBARN. `tests/security/380-trim-paritaet.integration.test.ts` misst dieselbe
// Parität eine Ebene tiefer und für einen anderen Weg: `PgKoRepo.list`/`listForSearch` über den
// vollen Kreuzbestand. Er bleibt UNVERÄNDERT; diese Datei tritt daneben und misst die 4303-Naht —
// die gedeckelte TREFFERabfrage der Suchprojektion, die dort gar nicht vorkommt.
//
// DER MASSSTAB IST NICHT DIE ZWEITE MESSUNG, SONDERN DIE REGEL. Verglichen wird dreifach: Speicher
// gegen PostgreSQL (wären beide gleich falsch, sagte das nichts), jeder Adapter gegen
// `!deletedAt && darfSehen(...)` über denselben Bestand — und die entscheidenden Fälle zusätzlich
// gegen eine VON HAND aufgeschriebene Erwartung aus dem Saatplan (`SICHTBAR_*`). Ohne die
// dritte Stufe erbte die Erwartung jeden gemeinsamen Fehler beider Adapter.
//
// PRÜFPLATZ NACH DEM MUSTER VON JOB 4321 (`tests/ko/trash-tx-pg.integration.test.ts`): lokale
// Wegwerf-Instanz aus `KLARWERK_PG_TEST_URL` über die GELB-Sicherung mit Vorrang, sonst
// Testcontainers, sonst ein SICHTBARER Skip mit Grund. Eigenes Schema, damit der geteilte
// Wegwerfcluster des Integrationslaufs nicht zum Wettlauf wird; die Trigramm-Erweiterung über den
// gemeinsamen, konkurrenzfesten Weg (Lehre JOB 4321 R1). Übersprungen wird NUR die fehlende
// Datenbank — ein kaputter Aufbau färbt rot, statt wie ein bestandener Lauf auszusehen.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Confidentiality,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  type KnowledgeObject,
  type KoRepo,
  type KoSearchQuery,
  KoService,
  type KoStatus,
  PgKoRepo,
  PgKoSearchProjectionRepo,
} from "../../services/knowledge-object";
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";

const JOB = "[KLARWERK][JOB 4359]";

/** Eigene Ecke im geteilten Wegwerfcluster — dieselbe Begründung wie JOB 4321. */
const EIGENES_SCHEMA = "job4359_suchdeckel";

/** Frei erfunden: kein Stoppwort, keine deklarierte Entsprechung, kein Fixture-Wort. */
const BEGRIFF = "zwirbelkopplung";

const ANNA = "uanna4359";
const BERT = "ubert4359";
/** Ein Dritter, der nie sucht — an ihm hängen die Fälle „weder eigen noch der andere Betrachter". */
const CARL = "ucarl4359";

const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];
const BETRACHTER: readonly string[] = [ANNA, BERT];

/**
 * Der Saatplan. Er ist die EINE Beschreibung des Bestands — beide Ablagen werden aus ihm in
 * derselben Reihenfolge befüllt, und die Kennungen entstehen aus einem deterministischen Zähler.
 * Nur so ist „identische Treffermengen (IDs)" überhaupt eine prüfbare Aussage und nicht bloß
 * „gleich viele".
 *
 * DIE TRUST-WERTE SIND DAS MESSINSTRUMENT, nicht Dekoration: die Ausgabeordnung ist
 * `validiert ↓, trust ↓, koId`. Die UNSICHTBAREN Einträge tragen den höchsten Trust und stehen
 * damit ganz vorn — genau die Lage aus JOB 4271, in der der Deckel sich mit Einträgen füllt, die
 * der Suchende nie zu sehen bekommt. Ein Deckel von 1 oder 5 ist deshalb hier kein Schnitt
 * irgendwo, sondern der Schnitt an der Stelle, an der der Fehler entsteht.
 */
interface Saat {
  readonly marke: string;
  readonly autor: string;
  readonly stufe: Confidentiality;
  readonly trust: number;
  readonly status: KoStatus;
  readonly getrasht?: true;
  /** Der Begriff steht NUR im Fliesstext — so, wie das gesuchte Dokument ihn im Alltag trägt. */
  readonly imFliesstext?: true;
}

const BESTAND: readonly Saat[] = [
  // Papierkorb — beide mit dem HÖCHSTEN Trust des ganzen Bestands. Fiele der Papierkorbfilter weg,
  // belegten sie sofort den Deckel; für ihre Autoren wäre `darfSehen` erfüllt (s. K3-Fall unten).
  {
    marke: "papierkorbEigen",
    autor: ANNA,
    stufe: "intern",
    trust: 99,
    status: "validiert",
    getrasht: true,
  },
  {
    marke: "papierkorbFremd",
    autor: BERT,
    stufe: "vertraulich",
    trust: 98,
    status: "validiert",
    getrasht: true,
  },
  // Die vertraulichen Einträge, die den Deckel füllen würden. Zwei gehören BERT (für ihn eigene
  // Autorschaft, für ANNA unsichtbar), zwei einem Dritten (für BEIDE Betrachter unsichtbar).
  { marke: "vertraulichBert1", autor: BERT, stufe: "vertraulich", trust: 95, status: "validiert" },
  { marke: "vertraulichBert2", autor: BERT, stufe: "vertraulich", trust: 94, status: "validiert" },
  { marke: "vertraulichCarl1", autor: CARL, stufe: "vertraulich", trust: 93, status: "validiert" },
  { marke: "vertraulichCarl2", autor: CARL, stufe: "vertraulich", trust: 92, status: "validiert" },
  { marke: "strengBert", autor: BERT, stufe: "streng_vertraulich", trust: 91, status: "validiert" },
  // Das Dokument, das ein Mensch sucht: intern, für jede Rolle sichtbar, Begriff nur im Fliesstext
  // und mit einem Trust UNTER allen vertraulichen Einträgen.
  {
    marke: "ziel",
    autor: ANNA,
    stufe: "intern",
    trust: 80,
    status: "validiert",
    imFliesstext: true,
  },
  { marke: "eigenVertraulich", autor: ANNA, stufe: "vertraulich", trust: 79, status: "validiert" },
  {
    marke: "eigenStreng",
    autor: ANNA,
    stufe: "streng_vertraulich",
    trust: 78,
    status: "validiert",
  },
  // Der Kandidat der nachträglichen Höherstufung (K3): startet intern, also für jede Rolle sichtbar.
  { marke: "hochstufung", autor: CARL, stufe: "intern", trust: 75, status: "validiert" },
  { marke: "internBert1", autor: BERT, stufe: "intern", trust: 70, status: "validiert" },
  { marke: "internBert2", autor: BERT, stufe: "intern", trust: 69, status: "validiert" },
  { marke: "internCarl", autor: CARL, stufe: "intern", trust: 68, status: "validiert" },
  // Höchster Trust des lebenden Bestands, aber NICHT validiert: er muss in BEIDEN Ablagen trotzdem
  // ganz hinten stehen. Damit misst die Reihenfolge auch die erste Stufe der Ausgabeordnung.
  { marke: "internOffen", autor: BERT, stufe: "intern", trust: 100, status: "offen" },
];

/**
 * DIE VON HAND AUFGESCHRIEBENEN ERWARTUNGEN — die dritte, vom Produkt unabhängige Stufe.
 *
 * Sie stehen als Markenfolge da, in genau der Reihenfolge der Ausgabeordnung. Wer sie nachrechnen
 * will, braucht nur den Saatplan oben und `darfSehen`: nicht vertraulich → jeder; vertraulich oder
 * streng_vertraulich → `ko.validate` (controller/admin) oder der Autor selbst; Papierkorb nie.
 */
const SICHTBAR_ANNA_OHNE_RECHT = [
  "ziel",
  "eigenVertraulich",
  "eigenStreng",
  "hochstufung",
  "internBert1",
  "internBert2",
  "internCarl",
  "internOffen",
] as const;

const SICHTBAR_BERT_OHNE_RECHT = [
  "vertraulichBert1",
  "vertraulichBert2",
  "strengBert",
  "ziel",
  "hochstufung",
  "internBert1",
  "internBert2",
  "internCarl",
  "internOffen",
] as const;

/** Mit `ko.validate` fällt die Stufengrenze — es bleibt der Papierkorb (und nur er). */
const SICHTBAR_MIT_RECHT = [
  "vertraulichBert1",
  "vertraulichBert2",
  "vertraulichCarl1",
  "vertraulichCarl2",
  "strengBert",
  "ziel",
  "eigenVertraulich",
  "eigenStreng",
  "hochstufung",
  "internBert1",
  "internBert2",
  "internCarl",
  "internOffen",
] as const;

/** Die Deckel des Vertrags: 1, 5 und die Bestandsgröße; `undefined` = ungedeckelt als Vergleich. */
const DECKEL: readonly (number | undefined)[] = [1, 5, BESTAND.length, undefined];

/** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — `undefined` heißt: `beforeAll` lief nicht. */
type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

/** Die Quelle darf genannt werden, das Passwort nicht (Form aus JOB 4321). */
function ohneGeheimnis(url: string): string {
  return url.replace(/:\/\/([^/@]*)@/, (_treffer, anmeldedaten: string) => {
    const benutzer = anmeldedaten.split(":")[0] ?? "";
    return `://${benutzer}:***@`;
  });
}

/** Ein Stapel ist EINE Ablage mit ihrem Dienst — der Vergleich läuft immer über zwei davon. */
interface Stapel {
  readonly name: string;
  readonly ko: KoService;
  readonly repo: KoRepo;
}

/**
 * Der deterministische Kennungszähler. Rein alphanumerisch und gleich lang — damit `ORDER BY
 * p.ko_id` (Cluster-Locale `C`) und `koId.localeCompare` im Speicher-Adapter bei Gleichstand
 * dieselbe Reihenfolge ergeben und der Vergleich nicht an einer Sortierregel scheitert.
 */
function kennungszaehler(): () => string {
  let n = 0;
  return () => `k4359${String(++n).padStart(3, "0")}`;
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

/** Beide Ablagen werden aus DEMSELBEN Saatplan und über die echten Produktwege befüllt. */
async function seede(stapel: Stapel): Promise<Map<string, string>> {
  const { readiness } = await stapel.ko.activateSearchProjectionV2();
  expect(readiness.alle, `${stapel.name}: ${readiness.befunde.join("; ")}`).toBe(true);
  const kennungen = new Map<string, string>();
  for (const saat of BESTAND) {
    const angelegt = await stapel.ko.create({
      type: "best_practice",
      category: "Handbuch",
      author: saat.autor,
      title: saat.imFliesstext
        ? `Betriebsanweisung Kaltstart ${saat.marke}`
        : `Notiz zur ${BEGRIFF} ${saat.marke}`,
      statement: saat.imFliesstext
        ? "Dokumentnummer BA-4359-07713."
        : `Messreihe ${saat.marke} zur ${BEGRIFF}.`,
      confidentiality: saat.stufe,
      ...(saat.imFliesstext
        ? { bodyHtml: `<p>Vor dem Kaltstart wird die ${BEGRIFF} geloest.</p>` }
        : {}),
    });
    await stapel.ko.setValidationState(angelegt.id, { trust: saat.trust, status: saat.status });
    if (saat.getrasht) {
      await stapel.ko.delete(angelegt.id, "pruefer4359", { forceTrash: true });
    }
    kennungen.set(saat.marke, angelegt.id);
  }
  return kennungen;
}

function frage(deckel: number | undefined): KoSearchQuery {
  return deckel === undefined ? { terms: [BEGRIFF] } : { terms: [BEGRIFF], limit: deckel };
}

/** Was der Adapter MIT Trim liefert — der Weg, um den es geht. */
async function treffer(
  stapel: Stapel,
  user: SessionUser,
  deckel?: number,
): Promise<readonly string[]> {
  const hits = await stapel.ko.findSearchHits(frage(deckel), sqlSichtbarkeitFuer(user));
  return hits.map((h) => h.koId);
}

/** Der ungetrimmte, ungedeckelte Lauf — die Grundmenge in Ausgabeordnung. */
async function ungetrimmt(stapel: Stapel): Promise<readonly string[]> {
  return (await stapel.ko.findSearchHits(frage(undefined))).map((h) => h.koId);
}

async function fakten(stapel: Stapel): Promise<Map<string, KnowledgeObject>> {
  return new Map((await stapel.repo.listForSearch({})).map((k) => [k.id, k]));
}

/**
 * Der Massstab aus der REGEL: dieselbe Grundmenge, gefiltert mit `!deletedAt && darfSehen`, danach
 * gedeckelt. Genau die Reihenfolge, die der Trim vor dem Deckel zusagt.
 */
async function nachDerRegel(
  stapel: Stapel,
  user: SessionUser,
  deckel?: number,
): Promise<readonly string[]> {
  const stand = await fakten(stapel);
  const sichtbar = (await ungetrimmt(stapel)).filter((id) => {
    const ko = stand.get(id);
    return Boolean(ko && !ko.deletedAt && darfSehen(user, ko));
  });
  return deckel === undefined ? sichtbar : sichtbar.slice(0, deckel);
}

describe("JOB 4359 · Suchdeckel und darfSehen an der 4303-Naht — Speicher gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  /** Die blanke Verbindung — sie verwaltet nur das Schema. */
  let verwaltung: Pool | undefined;
  /** Der Pool der Fälle, fest an `EIGENES_SCHEMA` gehängt. */
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
      process.stderr.write(`${JOB} Suchdeckel-Parität: KEIN LAUFZUSTAND — beforeAll lief nicht.\n`);
    } else if (z.gelaufen) {
      process.stderr.write(`${JOB} Suchdeckel-Parität GELAUFEN gegen ${z.quelle}.\n`);
    } else {
      process.stderr.write(
        `${JOB} Suchdeckel-Parität ÜBERSPRUNGEN — Grund: ${z.grund}. Die Paritätsfälle K1–K4 wurden NICHT geprüft.\n`,
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
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall.
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
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Fehler fliegt aus `beforeAll` und färbt rot.
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
        expect(
          [...inPg.entries()],
          "die beiden Ablagen tragen nicht dieselben Kennungen — ein Mengenvergleich wäre sinnlos",
        ).toEqual([...imSpeicher.entries()]);
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
    // Aufräumen darf den Lauf nicht nachträglich rot färben.
    await verwaltung
      ?.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  interface Platz {
    speicher: Stapel;
    pg: Stapel;
    id: (marke: string) => string;
    ids: (marken: readonly string[]) => string[];
  }

  function verlangePlatz(ctx: { skip: () => void }): Platz {
    if (!speicher || !pg || !marken) {
      meldeLaufzustand(); // kein Skip ohne sichtbaren Grund
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    const karte = marken;
    const id = (marke: string): string => {
      const wert = karte.get(marke);
      if (!wert) {
        throw new Error(`${JOB} unbekannte Marke ${marke}`);
      }
      return wert;
    };
    return { speicher, pg, id, ids: (liste) => liste.map(id) };
  }

  // ----------------------------------------------------------------------------------------------
  // DER ZEUGE — er ruft NIE `verlangePlatz` und macht in JEDEM Lauf eine Aussage.
  // ----------------------------------------------------------------------------------------------
  // Ohne ihn sähen „Parität geprüft" und „Parität übersprungen" gleich aus.
  it("der Lauf bezeugt seinen eigenen Zustand — übersprungen ist von gelaufen unterscheidbar", async () => {
    meldeLaufzustand();

    expect(
      laufzustand,
      "beforeAll hat keinen Laufzustand hinterlassen — ein Lauf ohne Zustandsaussage sieht aus wie " +
        "ein bestandener und darf nicht als Grün durchgehen.",
    ).toBeDefined();
    const zustand = laufzustand as Laufzustand;

    if (zustand.gelaufen) {
      expect(zustand.quelle.trim().length).toBeGreaterThan(0);
      expect(pool, "GELAUFEN ohne Pool wäre eine leere Behauptung").toBeDefined();
      // Und der Datenraum steht wirklich: der Bestand liegt in der echten Tabelle.
      const gezaehlt = await (pool as Pool).query<{ n: number }>(
        "SELECT count(*)::int AS n FROM kos",
      );
      expect(gezaehlt.rows[0]?.n).toBe(BESTAND.length);
    } else {
      expect(pool).toBeUndefined();
      expect(
        zustand.grund.trim().length,
        "ÜBERSPRUNGEN ohne Grund ist wieder der stumme Lauf",
      ).toBeGreaterThan(0);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // DER BESTAND — dieselbe Lage in beiden Ablagen, und sie ist wirklich gemischt.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("beide Ablagen tragen denselben gemischten Bestand — und die Lage ist die aus JOB 4271", async (ctx) => {
    const p = verlangePlatz(ctx);

    for (const stapel of [p.speicher, p.pg]) {
      const stand = await fakten(stapel);
      expect(stand.size, `${stapel.name}: Bestandsgröße`).toBe(BESTAND.length);
      expect(
        [...stand.values()].filter((k) => k.deletedAt).length,
        `${stapel.name}: Papierkorb`,
      ).toBe(2);
      // Jeder Saatling ist über den Begriff auffindbar — sonst misst der Deckel an der Luft.
      const roh = await ungetrimmt(stapel);
      expect([...roh].sort(), `${stapel.name}: Grundmenge`).toEqual(
        BESTAND.filter((s) => !s.getrasht)
          .map((s) => p.id(s.marke))
          .sort(),
      );
    }

    // DIE LAGE: vor dem sichtbaren Ziel stehen fünf Einträge, die ANNA nie zu sehen bekommt.
    const roh = await ungetrimmt(p.pg);
    expect(
      roh.indexOf(p.id("ziel")),
      "das Ziel steht nicht hinter den vertraulichen Einträgen",
    ).toBe(5);
    // Und beide Ablagen ordnen die Grundmenge gleich — sonst wäre jeder Deckelvergleich Zufall.
    expect(await ungetrimmt(p.speicher)).toEqual(roh);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K1 — IDENTISCHE TREFFERMENGEN UND ZÄHLWERTE, FÜR JEDE ROLLE UND JEDEN DECKEL.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("K1 · Speicher und PostgreSQL liefern über alle Rollen, Autorschaften und Deckel dieselben IDs und Zählwerte", async (ctx) => {
    const p = verlangePlatz(ctx);
    let geprueft = 0;

    for (const role of ROLLEN) {
      for (const betrachter of BETRACHTER) {
        const user: SessionUser = { id: betrachter, role };
        for (const deckel of DECKEL) {
          const lage = `Rolle ${role}, Betrachter ${betrachter}, Deckel ${deckel ?? "ohne"}`;
          const ausSpeicher = await treffer(p.speicher, user, deckel);
          const ausPg = await treffer(p.pg, user, deckel);

          // 1 die beiden Ablagen gegeneinander …
          expect(ausPg, `${lage}: Treffermengen laufen auseinander`).toEqual(ausSpeicher);
          // 2 … und jede gegen die REGEL (wären beide gleich falsch, sagte 1 nichts).
          expect(ausSpeicher, `${lage}: Speicher weicht von darfSehen ab`).toEqual(
            await nachDerRegel(p.speicher, user, deckel),
          );
          expect(ausPg, `${lage}: PostgreSQL weicht von darfSehen ab`).toEqual(
            await nachDerRegel(p.pg, user, deckel),
          );
          // 3 der ZÄHLWERT ausdrücklich — er ist die Zahl, die der Mensch als „Treffer" liest.
          expect(ausPg.length, `${lage}: Zählwerte laufen auseinander`).toBe(ausSpeicher.length);
          geprueft += 1;
        }
      }
    }
    expect(geprueft).toBe(ROLLEN.length * BETRACHTER.length * DECKEL.length);
  });

  it("K1b · die ungedeckelte, getrimmte Menge ist genau die von Hand aufgeschriebene", async (ctx) => {
    const p = verlangePlatz(ctx);
    const faelle: readonly { user: SessionUser; soll: readonly string[] }[] = [
      { user: { id: ANNA, role: "viewer" }, soll: SICHTBAR_ANNA_OHNE_RECHT },
      { user: { id: ANNA, role: "experte" }, soll: SICHTBAR_ANNA_OHNE_RECHT },
      { user: { id: BERT, role: "viewer" }, soll: SICHTBAR_BERT_OHNE_RECHT },
      { user: { id: BERT, role: "experte" }, soll: SICHTBAR_BERT_OHNE_RECHT },
      { user: { id: ANNA, role: "controller" }, soll: SICHTBAR_MIT_RECHT },
      { user: { id: ANNA, role: "admin" }, soll: SICHTBAR_MIT_RECHT },
      { user: { id: BERT, role: "controller" }, soll: SICHTBAR_MIT_RECHT },
      { user: { id: BERT, role: "admin" }, soll: SICHTBAR_MIT_RECHT },
    ];
    for (const fall of faelle) {
      const lage = `${fall.user.role}/${fall.user.id}`;
      expect(await treffer(p.speicher, fall.user), `Speicher ${lage}`).toEqual(p.ids(fall.soll));
      expect(await treffer(p.pg, fall.user), `PostgreSQL ${lage}`).toEqual(p.ids(fall.soll));
    }
    // Und die Mengen sind weder leer noch der ganze Bestand — sonst wäre jede Gleichheit trivial.
    expect(SICHTBAR_ANNA_OHNE_RECHT.length).toBeGreaterThan(0);
    expect(SICHTBAR_MIT_RECHT.length).toBeLessThan(BESTAND.length);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K2 — DER DECKEL LIEGT ÜBER DER SICHTBAREN MENGE: 1 UND 5.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Der Beleg ist die NAMENTLICHE Erwartung, nicht „irgendetwas kam zurück": bei Deckel 1 überlebt
  // genau der oberste SICHTBARE Eintrag, obwohl vor ihm fünf unsichtbare stehen.
  it("K2 · bei Deckel 1 und 5 überlebt in beiden Ablagen der oberste sichtbare Eintrag", async (ctx) => {
    const p = verlangePlatz(ctx);
    const faelle: readonly { user: SessionUser; eins: string; fuenf: readonly string[] }[] = [
      {
        user: { id: ANNA, role: "experte" },
        eins: "ziel",
        fuenf: SICHTBAR_ANNA_OHNE_RECHT.slice(0, 5),
      },
      {
        user: { id: BERT, role: "experte" },
        // BERTS eigener vertraulicher Eintrag — für ihn sichtbar, für ANNA nicht.
        eins: "vertraulichBert1",
        fuenf: SICHTBAR_BERT_OHNE_RECHT.slice(0, 5),
      },
      {
        user: { id: ANNA, role: "controller" },
        eins: "vertraulichBert1",
        fuenf: SICHTBAR_MIT_RECHT.slice(0, 5),
      },
    ];
    for (const fall of faelle) {
      const lage = `${fall.user.role}/${fall.user.id}`;
      expect(await treffer(p.speicher, fall.user, 1), `Speicher ${lage} Deckel 1`).toEqual([
        p.id(fall.eins),
      ]);
      expect(await treffer(p.pg, fall.user, 1), `PostgreSQL ${lage} Deckel 1`).toEqual([
        p.id(fall.eins),
      ]);
      expect(await treffer(p.speicher, fall.user, 5), `Speicher ${lage} Deckel 5`).toEqual(
        p.ids(fall.fuenf),
      );
      expect(await treffer(p.pg, fall.user, 5), `PostgreSQL ${lage} Deckel 5`).toEqual(
        p.ids(fall.fuenf),
      );
    }
    // DAS SICHTBARE ZIELOBJEKT überlebt den Deckel für BEIDE Betrachter ohne Sonderrecht — bei 5
    // ausdrücklich, bei 1 für ANNA (bei BERT steht sein eigener Eintrag davor, und das ist richtig).
    for (const betrachter of BETRACHTER) {
      const user: SessionUser = { id: betrachter, role: "experte" };
      expect(
        await treffer(p.pg, user, 5),
        `${betrachter}: das Ziel fällt aus dem Deckel`,
      ).toContain(p.id("ziel"));
      expect(await treffer(p.speicher, user, 5)).toContain(p.id("ziel"));
    }
  });

  it("K2b · kein unsichtbares und kein getrashtes Objekt belegt einen Deckelplatz", async (ctx) => {
    const p = verlangePlatz(ctx);
    const unsichtbarFuerAnna = p.ids([
      "vertraulichBert1",
      "vertraulichBert2",
      "vertraulichCarl1",
      "vertraulichCarl2",
      "strengBert",
    ]);
    const papierkorb = p.ids(["papierkorbEigen", "papierkorbFremd"]);
    const user: SessionUser = { id: ANNA, role: "experte" };

    for (const stapel of [p.speicher, p.pg]) {
      for (const deckel of DECKEL) {
        const geliefert = await treffer(stapel, user, deckel);
        for (const id of [...unsichtbarFuerAnna, ...papierkorb]) {
          expect(
            geliefert,
            `${stapel.name}, Deckel ${deckel ?? "ohne"}: ${id} steht drin`,
          ).not.toContain(id);
        }
        // Der Deckel ist auch wirklich voll, solange sichtbare Anwärter übrig sind.
        const sichtbar = SICHTBAR_ANNA_OHNE_RECHT.length;
        expect(geliefert.length, `${stapel.name}, Deckel ${deckel ?? "ohne"}: Zählwert`).toBe(
          deckel === undefined ? sichtbar : Math.min(deckel, sichtbar),
        );
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K3a — DER PAPIERKORB, UND WARUM ER NICHT SCHON DURCH DIE STUFENREGEL DRAUSSEN WÄRE.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  it("K3a · kein Papierkorb-Objekt überlebt — in keiner Ablage, für keine Rolle", async (ctx) => {
    const p = verlangePlatz(ctx);
    const papierkorb = p.ids(["papierkorbEigen", "papierkorbFremd"]);

    // Die Nicht-Trivialität zuerst: für ihre Autoren sagt `darfSehen` JA. Es ist also wirklich der
    // Papierkorbfilter, der sie draussen hält — nicht die Stufe.
    const stand = await fakten(p.pg);
    const eigen = stand.get(p.id("papierkorbEigen"));
    const fremd = stand.get(p.id("papierkorbFremd"));
    expect(eigen?.deletedAt, "papierkorbEigen liegt gar nicht im Papierkorb").toBeTruthy();
    expect(fremd?.deletedAt, "papierkorbFremd liegt gar nicht im Papierkorb").toBeTruthy();
    expect(darfSehen({ id: ANNA, role: "experte" }, eigen as KnowledgeObject)).toBe(true);
    expect(darfSehen({ id: BERT, role: "experte" }, fremd as KnowledgeObject)).toBe(true);
    // Und sie tragen den höchsten Trust des Bestands — ohne Filter stünden sie ganz vorn.
    expect(Math.max(eigen?.trust ?? 0, fremd?.trust ?? 0)).toBeGreaterThan(
      Math.max(
        ...BESTAND.filter((s) => !s.getrasht && s.status === "validiert").map((s) => s.trust),
      ),
    );

    for (const stapel of [p.speicher, p.pg]) {
      for (const role of ROLLEN) {
        for (const betrachter of BETRACHTER) {
          for (const deckel of DECKEL) {
            const geliefert = await treffer(stapel, { id: betrachter, role }, deckel);
            for (const id of papierkorb) {
              expect(
                geliefert,
                `${stapel.name}, ${role}/${betrachter}, Deckel ${deckel ?? "ohne"}`,
              ).not.toContain(id);
            }
          }
        }
      }
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K4 — DIE NACHWEISKRAFT: WÄRE DER TRIM FALSCH GEBAUT, WÄRE DIESER VERGLEICH ROT.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Hier wird nichts am Produkt verstellt (das ist die Gegenprobe der Runde, s. RUECKGABE); hier
  // wird gezeigt, dass die OBIGEN Erwartungen die drei Fehlbauten überhaupt unterscheiden können.
  // Eine Kalibrierung, die nur behauptet, sie würde rot, ist keine.
  it("K4 · die drei Fehlbauten liefern nachweislich etwas anderes als die Zusage", async (ctx) => {
    const p = verlangePlatz(ctx);
    const user: SessionUser = { id: ANNA, role: "experte" };
    const stand = await fakten(p.pg);
    const richtig = await treffer(p.pg, user, 1);
    expect(richtig).toEqual([p.id("ziel")]);

    // (a) TRIM HINTER DEM DECKEL: erst deckeln, dann filtern — die Antwort ist LEER, obwohl es
    //     sichtbare Treffer gibt. Genau der Befund aus JOB 4271.
    const erstDeckeln = (await p.pg.ko.findSearchHits(frage(1)))
      .map((h) => h.koId)
      .filter((id) => {
        const ko = stand.get(id);
        return Boolean(ko && !ko.deletedAt && darfSehen(user, ko));
      });
    expect(
      erstDeckeln,
      "Trim hinter dem Deckel liefert dasselbe — dann misst K2 nichts",
    ).not.toEqual(richtig);
    expect(erstDeckeln).toEqual([]);

    // (b) OHNE TRIM: der Deckel füllt sich mit einem Eintrag, den ANNA nie zu sehen bekommt.
    const ohneTrim = (await p.pg.ko.findSearchHits(frage(1))).map((h) => h.koId);
    expect(ohneTrim).toEqual([p.id("vertraulichBert1")]);
    expect(ohneTrim).not.toEqual(richtig);

    // (c) OHNE PAPIERKORBFILTER: dann stünde der getrashte eigene Eintrag ganz vorn.
    const ohnePapierkorb = [...stand.values()]
      .filter((ko) => darfSehen(user, ko))
      .sort(
        (a, b) =>
          Number(b.status === "validiert") - Number(a.status === "validiert") ||
          (b.trust ?? 0) - (a.trust ?? 0) ||
          a.id.localeCompare(b.id),
      )
      .map((ko) => ko.id)
      .slice(0, 1);
    expect(ohnePapierkorb).toEqual([p.id("papierkorbEigen")]);
    expect(ohnePapierkorb).not.toEqual(richtig);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // K3b — DIE NACHTRÄGLICHE HÖHERSTUFUNG WIRKT SOFORT, IN BEIDEN ABLAGEN.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Sie steht zuletzt, weil sie den Bestand verändert. Die Projektionszeile bleibt dabei stehen und
  // trägt weiterhin den alten `classification_snapshot` — genau deshalb ist dieser Fall der Beleg
  // für `G-TRIM-LIVE`: getrimmt wird an der LEBENDEN Zeile, nicht am Schnappschuss.
  it("K3b · eine Höherstufung entfernt den Eintrag sofort aus Treffern und Zählwert — in beiden Ablagen", async (ctx) => {
    const p = verlangePlatz(ctx);
    const ziel = p.id("hochstufung");
    const annaOhneRecht: SessionUser = { id: ANNA, role: "experte" };
    const bertOhneRecht: SessionUser = { id: BERT, role: "viewer" };
    const ohneRecht: readonly SessionUser[] = [annaOhneRecht, bertOhneRecht];
    const mitRecht: SessionUser = { id: BERT, role: "controller" };

    const vorher = new Map<string, readonly string[]>();
    for (const stapel of [p.speicher, p.pg]) {
      for (const user of [...ohneRecht, mitRecht]) {
        const geliefert = await treffer(stapel, user);
        expect(geliefert, `${stapel.name} ${user.role}/${user.id}: Ausgangslage`).toContain(ziel);
        vorher.set(`${stapel.name}|${user.role}|${user.id}`, geliefert);
      }
      // Der Schnappschuss der Projektion sagt weiterhin „intern" — er darf gleich nichts bewirken.
      const projektion = await stapel.ko.searchProjectionOf(ziel);
      expect(projektion?.classificationSnapshot.value, `${stapel.name}: Schnappschuss`).toBe(
        "intern",
      );
    }

    for (const stapel of [p.speicher, p.pg]) {
      await stapel.ko.setConfidentiality(ziel, "vertraulich", "pruefer4359");
    }

    for (const stapel of [p.speicher, p.pg]) {
      // Der Schnappschuss ist absichtlich NICHT nachgeführt — die Sperre wirkt trotzdem.
      const projektion = await stapel.ko.searchProjectionOf(ziel);
      expect(projektion?.classificationSnapshot.value, `${stapel.name}: Schnappschuss danach`).toBe(
        "intern",
      );
      for (const user of ohneRecht) {
        const schluessel = `${stapel.name}|${user.role}|${user.id}`;
        const danach = await treffer(stapel, user);
        expect(danach, `${stapel.name} ${user.role}/${user.id}: bleibt sichtbar`).not.toContain(
          ziel,
        );
        expect(danach.length, `${stapel.name} ${user.role}/${user.id}: Zählwert`).toBe(
          (vorher.get(schluessel) ?? []).length - 1,
        );
        // Auch der Deckel zählt ihn nicht mehr mit: die fünf Plätze sind fünf SICHTBARE.
        const gedeckelt = await treffer(stapel, user, 5);
        expect(gedeckelt).not.toContain(ziel);
        expect(gedeckelt).toEqual(await nachDerRegel(stapel, user, 5));
      }
      // Wer das Recht hat, sieht ihn unverändert — die Höherstufung ist keine Löschung.
      const berechtigt = await treffer(stapel, mitRecht);
      expect(berechtigt, `${stapel.name}: der Berechtigte verliert den Eintrag`).toContain(ziel);
      expect(berechtigt).toEqual(vorher.get(`${stapel.name}|${mitRecht.role}|${mitRecht.id}`));
    }

    // Und beide Ablagen sind auch NACH der Höherstufung deckungsgleich.
    for (const user of [...ohneRecht, mitRecht]) {
      for (const deckel of DECKEL) {
        expect(
          await treffer(p.pg, user, deckel),
          `nach Höherstufung: ${user.role}/${user.id}, Deckel ${deckel ?? "ohne"}`,
        ).toEqual(await treffer(p.speicher, user, deckel));
      }
    }

    // Rücknahme, damit der Bestand die Datei so verlässt, wie er sie betreten hat.
    for (const stapel of [p.speicher, p.pg]) {
      await stapel.ko.setConfidentiality(ziel, "intern", "pruefer4359", { mayDowngrade: true });
      expect(await treffer(stapel, annaOhneRecht)).toContain(ziel);
    }
  });
});
