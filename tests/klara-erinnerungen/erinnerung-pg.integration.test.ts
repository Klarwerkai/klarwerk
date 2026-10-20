// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · ERINNERUNGEN GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `steuerung.test.ts` misst die Regeln an der Speicherablage. Hier steht, was nur die Datenbank
// belegen kann: dieselben Ablagen (`pgErinnerungAblage`), das ausgeführte `migrate()` mit
// `KLARA_ERINNERUNG_SCHEMA` (zweimal — wiederholbar), ein NEUER Pool je „Prozess" bzw. „Neustart".
//
//   P1 (AW18-K04) Mehrere Prozesse gleichzeitig über derselben Datenbank: je Vorkommen genau eine
//      Laufzeile und genau eine Meldung — die Übernahme ist ein einziger Datenbankbefehl.
//   P2 (K4, AW18-K05, AW18-K12, P07-AC07) Stillstand vor Fälligkeit, Neustart auf frischem Pool:
//      verpasste Termine nach Regel, Person benachrichtigt, ein weiterer Neustart wiederholt nichts.
//   P3 (AW18-K06) Absturz nach der Wirkung, vor der Bestätigung: ein anderer Prozess übernimmt erst
//      nach Ablauf der Laufberechtigung und bestätigt per Readback — keine zweite Meldung.
//   P4 (K2, AW18-K10) Zustand, Fassung, Steuerstand und Lage überstehen den Neustart.
//   P5 (K5, Nacharbeit 2) Ein anderer Prozess pausiert unmittelbar vor dem Schreiben: das bedingte
//      `INSERT … WHERE EXISTS (… FOR SHARE)` lehnt ab — keine Meldung, Lauf abgebrochen.
//   P6 (AW18-K08, P07, Nacharbeit 2) Übergabe und Einstellungen sind in der Datenbank haltbar.
//   P7/P8 (AW18-K08, K5, Nacharbeit 4) Konto gesperrt bzw. Quelle gelöscht UNMITTELBAR vor dem
//      Schreiben (nach allen Prüfungen): das bedingte INSERT hält Kontozeile und Quelle mit
//      `FOR SHARE` und lehnt ab → gestoppt bzw. wartet auf Klärung, keine Meldung.
//   P9 (AW18-K08, Nacharbeit 4) Modellantwort angehalten, währenddessen Konto in der Datenbank
//      gesperrt → nach der Antwort kein Schreibversuch, Lauf gestoppt.
//   P10/P11 (AW18-K08, Nacharbeit 5) ÜBERLAPPENDE Sperre bzw. Löschung der Kontozeile in einer
//      eigenen, noch offenen Transaktion nach der letzten Anwendungsprüfung: das INSERT wartet auf
//      sie und schreibt danach nichts → gestoppt.
//   P13 (EQF-07) Routine gegen die Datenbank: Bericht in klara_notizen genau einmal — zwei
//      Prozesse gleichzeitig und ein Neustart wiederholen nichts; Quellenfassung im Lauf.
//   P12 (AW18-K08, Nacharbeit 5) Ohne Kontozeile schreibt das bedingte INSERT nichts; Gegenprobe
//      mit vorhandenem, berechtigtem Konto wird geschrieben. Alle Konten dieser Suite haben deshalb
//      eine fiktive Kontozeile.
//   P14 (EQF-07-K06/K07, Nacharbeit 9) Der Routinenbericht ist eine eigene bedingte Wirkung: Pause
//      durch einen anderen Prozess, Kontosperre bzw. Änderung der gelesenen Quelle UNMITTELBAR vor
//      dem Notiz-INSERT → nichts geschrieben; bei geänderter Quelle neu gelesen, EIN Bericht.
//   P15 (EQF-07-K06, Nacharbeit 9) Teilbericht, Neustart: derselbe Bericht wird fortgesetzt
//      (Fassung 2), kein zweiter Bericht; ein weiterer Neustart ändert nichts.
//   P16 (EQF-07-K06, Nacharbeit 16) Bedingtes Entfernen einer Folgeserie: geändert, schon mit
//      Lauf oder fremdes Konto → bleibt; nur unverändert und ohne Lauf → entfernt.
//   P17 (AW18-K04, EQF-07-K06, Nacharbeit 17) Gleichzeitige Laufübernahme und bedingtes Entfernen
//      über dieselbe Zeilensperre: Übernahme zuerst → nichts gelöscht; Entfernen zuerst → kein
//      verwaister Lauf. Beide Reihenfolgen mit offener fremder Transaktion erzwungen.
// Echter Prozessneustart und Wiederherstellung aus einer Sicherung: `dienstneustart-restore.
// integration.test.ts` (eigene Serverprozesse, `backup.sh`, `pg_restore`).
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { type KlaraAufgabe, PgKlaraAufgabeRepo } from "../../services/app/src/klara-aufgabe";
import {
  KLARA_ERINNERUNG_LEASE_MS,
  type KlaraErinnerungAblage,
  KlaraErinnerungDienst,
  KlaraErinnerungSteuerung,
  type MeldungSchreibergebnis,
  PgKlaraErinnerungLaufRepo,
  PgKlaraErinnerungMeldungRepo,
  lageVon,
  pgErinnerungAblage,
  quelleFuerBedingung,
} from "../../services/app/src/klara-erinnerung";
import { loeseMitRegel } from "../../services/app/src/klara-erinnerung-zeit";
import { KlaraNotizDienst, PgKlaraNotizRepo } from "../../services/app/src/klara-notiz";
import { ergebnisVorgang } from "../../services/app/src/klara-routine";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-erinnerung-anna";
const BERT = "u-pg-erinnerung-bert";
const CARL = "u-pg-erinnerung-carl";
const DORA = "u-pg-erinnerung-dora";
const EMIL = "u-pg-erinnerung-emil";
const FINN = "u-pg-erinnerung-finn";
const GRETA = "u-pg-erinnerung-greta";
const HANNA = "u-pg-erinnerung-hanna";
const IDA = "u-pg-erinnerung-ida";
// Nacharbeit 9 (P14): je Fall ein eigenes fiktives Konto.
const JONA = "u-pg-erinnerung-jona";
const KAI = "u-pg-erinnerung-kai";
const LENA = "u-pg-erinnerung-lena";
const MIA = "u-pg-erinnerung-mia";
const KONTEN = [ANNA, BERT, CARL, DORA, EMIL, FINN, GRETA, HANNA, IDA, JONA, KAI, LENA, MIA];
const BERLIN = "Europe/Berlin";

const um = (datum: string, uhrzeit: string): number =>
  loeseMitRegel({ datum, uhrzeit }, BERLIN, { luecke: "verschieben", doppelt: "erste" })
    .ms as number;

/** Eine Laufablage, deren nächste Bestätigung „abstürzt" — die Wirkung ist dann geschehen. */
class AbstuerzendeLaeufe extends PgKlaraErinnerungLaufRepo {
  bestaetigungWerfen = 0;
  override async schliesse(
    ...args: Parameters<PgKlaraErinnerungLaufRepo["schliesse"]>
  ): Promise<boolean> {
    if (this.bestaetigungWerfen > 0) {
      this.bestaetigungWerfen -= 1;
      throw new Error("Prozess vor der Bestätigung beendet");
    }
    return super.schliesse(...args);
  }
}

/** Meldungsablage, die GENAU vor dem bedingten Schreiben einen fremden Schritt einschiebt. */
class EinschubMeldungen extends PgKlaraErinnerungMeldungRepo {
  einschub: (() => Promise<void>) | null = null;
  readonly ergebnisse: MeldungSchreibergebnis[] = [];
  /** Wann das jeweilige INSERT zurückkam (ms) — belegt das Warten auf eine fremde Transaktion. */
  readonly fertigAm: number[] = [];
  override async schreibe(
    ...args: Parameters<PgKlaraErinnerungMeldungRepo["schreibe"]>
  ): Promise<MeldungSchreibergebnis> {
    const e = this.einschub;
    if (e) {
      this.einschub = null;
      await e();
    }
    const r = await super.schreibe(...args);
    this.fertigAm.push(Date.now());
    this.ergebnisse.push(r);
    return r;
  }
}

/** Aufgabenablage, deren Liste auf Kommando nicht lesbar ist (Routinenabschnitt fällt aus). */
class StoerbareAufgaben extends PgKlaraAufgabeRepo {
  listeKaputt = false;
  override async liste(...args: Parameters<PgKlaraAufgabeRepo["liste"]>): Promise<KlaraAufgabe[]> {
    if (this.listeKaputt) {
      throw new Error("Aufgabenablage nicht erreichbar");
    }
    return super.liste(...args);
  }
}

describe("Klara 10 · Erinnerungen gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  let uhr = Date.parse("2026-10-12T08:00:00.000Z");
  let vorgaenge = 0;
  const jetzt = (): number => uhr;

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  function vorgang(): string {
    vorgaenge += 1;
    return `pg-erinnerung-${String(vorgaenge).padStart(4, "0")}`;
  }

  /** Ein „Prozess": eigener Pool, eigene Ablage, eigene Steuerung mit eigener Kennung. */
  function prozess(name: string, ablage: KlaraErinnerungAblage = pgErinnerungAblage(neuePool())) {
    return {
      ablage,
      dienst: new KlaraErinnerungDienst({ ablage, jetzt }),
      steuerung: new KlaraErinnerungSteuerung({
        ablage,
        konto: () => Promise.resolve({ approved: true }),
        jetzt,
        besitzer: name,
      }),
    };
  }

  async function zahl(tabelle: string, konto: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${tabelle} WHERE konto_id = $1`,
      [konto],
    );
    return res.rows[0]?.n ?? -1;
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
      for (const tabelle of [
        "klara_erinnerungen",
        "klara_erinnerung_laeufe",
        "klara_erinnerung_meldungen",
        "klara_erinnerung_einstellungen",
        "klara_notizen",
      ]) {
        await pool.query(`DELETE FROM ${tabelle} WHERE konto_id = ANY($1)`, [KONTEN]);
      }
      // Jede Zustellung verlangt seit Nacharbeit 5 eine vorhandene, heute berechtigte Kontozeile
      // (fiktiv) — die Sperre bzw. Löschung wirkt IN der Datenbank.
      await pool.query("DELETE FROM users WHERE id = ANY($1)", [KONTEN]);
      for (const id of KONTEN) {
        await pool.query(
          `INSERT INTO users (id, name, email, password_salt, password_hash, role, approved, created_at)
           VALUES ($1, $2, $3, 'fiktiv', 'fiktiv', 'experte', true, $4)`,
          [id, `Konto ${id}`, `${id}@pg-erinnerung.test`, new Date(0).toISOString()],
        );
      }
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

  it("P1 · fünf Prozesse gleichzeitig über zehn fällige Termine: zehn Läufe, zehn Meldungen", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const a = prozess("anlage-a");
    for (let i = 0; i < 10; i++) {
      await a.dienst.lege(ANNA, {
        vorgang: vorgang(),
        titel: `Gleichzeitig ${i}`,
        zeitzone: BERLIN,
        zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
      });
    }
    uhr = um("2026-10-13", "09:00") + 5_000;
    const berichte = await Promise.all(
      ["p-1", "p-2", "p-3", "p-4", "p-5"].map((name) => prozess(name).steuerung.lauf()),
    );
    expect(berichte.reduce((s, b) => s + b.zugestellt, 0)).toBe(10);
    expect(await zahl("klara_erinnerung_laeufe", ANNA)).toBe(10);
    expect(await zahl("klara_erinnerung_meldungen", ANNA)).toBe(10);
    // Ein weiterer Takt irgendeines Prozesses ändert nichts.
    await prozess("p-6").steuerung.lauf();
    expect(await zahl("klara_erinnerung_meldungen", ANNA)).toBe(10);
  });

  it("P2 · Stillstand vor Fälligkeit, Neustart: zusammenfassen und nur melden, je einmal", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const vor = prozess("vor-dem-halt");
    const serie = (regel: string) =>
      vor.dienst.lege(BERT, {
        vorgang: vorgang(),
        titel: `Serie ${regel}`,
        zeitzone: BERLIN,
        verpasst: { regel, grenzeMinuten: 15 },
        zeitplan: {
          art: "serie",
          datum: "2026-10-13",
          uhrzeit: "09:00",
          wiederholung: { takt: "taeglich", intervall: 1, anzahl: 5 },
        },
      });
    const zusammen = (await serie("zusammenfassen")).eintrag.erinnerung;
    const melden = (await serie("nur_melden")).eintrag.erinnerung;
    await vor.steuerung.lauf();

    uhr = um("2026-10-15", "09:05");
    const nach = prozess("nach-dem-neustart");
    const bericht = await nach.steuerung.lauf();
    expect(bericht).toMatchObject({ zusammengefasst: 2, verpasstGemeldet: 2, zugestellt: 2 });
    const meldungen = await nach.ablage.meldungen.fuerKonto(BERT, 100);
    const von = (id: string) =>
      meldungen
        .filter((m) => m.erinnerungId === id)
        .map((m) => m.art)
        .sort();
    expect(von(zusammen.id)).toEqual(["erinnerung", "zusammenfassung"]);
    expect(von(melden.id)).toEqual(["erinnerung", "verpasst", "verpasst"]);

    await prozess("zweiter-neustart").steuerung.lauf();
    expect(await zahl("klara_erinnerung_meldungen", BERT)).toBe(5);
  });

  it("P3 · Absturz vor der Bestätigung: erst nach Ablauf der Berechtigung, dann per Readback", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const pool = neuePool();
    const laeufe = new AbstuerzendeLaeufe(pool);
    const basis = pgErinnerungAblage(pool);
    const a = prozess("prozess-a", { ...basis, laeufe });
    const { eintrag } = await a.dienst.lege(CARL, {
      vorgang: vorgang(),
      titel: "Absturz",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    uhr = um("2026-10-13", "09:00") + 5_000;
    laeufe.bestaetigungWerfen = 1;
    expect((await a.steuerung.lauf()).fehler).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", CARL)).toBe(1);

    const b = prozess("prozess-b");
    await b.steuerung.lauf();
    expect((await b.ablage.laeufe.fuerErinnerung(eintrag.erinnerung.id, 10))[0]?.status).toBe(
      "laeuft",
    );

    uhr += KLARA_ERINNERUNG_LEASE_MS + 1_000;
    expect((await b.steuerung.lauf()).dedupliziert).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", CARL)).toBe(1);
    expect((await b.ablage.laeufe.fuerErinnerung(eintrag.erinnerung.id, 10))[0]).toMatchObject({
      status: "zugestellt",
      versuch: 2,
      besitzer: "prozess-b",
      ergebnis: { dedupliziert: true },
    });
  });

  it("P4 · Zustand, Fassung, Steuerstand und Lage überstehen den Neustart", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const a = prozess("vorher");
    const { eintrag } = await a.dienst.lege(CARL, {
      vorgang: vorgang(),
      titel: "Haltbar",
      zeitzone: BERLIN,
      zeitplan: {
        art: "serie",
        datum: "2026-10-13",
        uhrzeit: "09:00",
        wiederholung: { takt: "taeglich", intervall: 1, anzahl: 3 },
      },
    });
    const id = eintrag.erinnerung.id;
    await a.dienst.status(CARL, id, { fassung: 1, aktion: "pausieren" });

    const b = prozess("nachher");
    const gelesen = await b.dienst.eintrag(CARL, id);
    expect(gelesen.erinnerung).toMatchObject({ status: "pausiert", fassung: 2, zeitzone: BERLIN });
    expect(gelesen.steuer.naechste).toBeNull();
    // Fremd und unbekannt antworten gleich.
    await expect(b.dienst.eintrag(ANNA, id)).rejects.toMatchObject({ status: 404 });

    await b.dienst.status(CARL, id, { fassung: 2, aktion: "fortsetzen" });
    uhr = um("2026-10-13", "09:00") + 5_000;
    await prozess("takt").steuerung.lauf();
    const c = prozess("danach");
    const e = await c.dienst.eintrag(CARL, id);
    expect(e.steuer.naechste).toBe(um("2026-10-14", "09:00"));
    expect(lageVon(e, await c.dienst.laeufe(id), uhr)).toBe("geplant");
    expect((await c.dienst.laeufe(id))[0]).toMatchObject({ status: "zugestellt", versuch: 1 });
  });

  it("P5 · Pause durch einen ANDEREN Prozess unmittelbar vor dem Schreiben: die Datenbank lehnt ab", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const pool = neuePool();
    const meldungen = new EinschubMeldungen(pool);
    const a = prozess("schreiber", { ...pgErinnerungAblage(pool), meldungen });
    const anderer = prozess("bedienung");
    const { eintrag } = await a.dienst.lege(DORA, {
      vorgang: vorgang(),
      titel: "Bedingt",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    const id = eintrag.erinnerung.id;
    meldungen.einschub = async () => {
      await anderer.dienst.status(DORA, id, { fassung: 1, aktion: "pausieren" });
    };
    uhr = um("2026-10-13", "09:00") + 5_000;
    const bericht = await a.steuerung.lauf();
    expect(meldungen.ergebnisse[0]).toBe("veraltet");
    expect(bericht.abgebrochen).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", DORA)).toBe(0);
    expect((await anderer.dienst.laeufe(id))[0]).toMatchObject({
      status: "abgebrochen",
      ergebnis: { grund: "status_geaendert" },
    });
    // Ein späterer Takt eines weiteren Prozesses belebt nichts.
    await prozess("spaeter").steuerung.lauf();
    expect(await zahl("klara_erinnerung_meldungen", DORA)).toBe(0);
  });

  it("P6 · Übergabe und Einstellungen in der Datenbank: Zuständige liest, Meldung bei ihr", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const personen = {
      kontoPerAdresse: (email: string) =>
        Promise.resolve(
          email === "emil@beispiel.test"
            ? { id: EMIL, name: "Emil Beispiel", approved: true }
            : undefined,
        ),
      kontoLesen: () => Promise.resolve(undefined),
    };
    const ablage = pgErinnerungAblage(neuePool());
    const dienst = new KlaraErinnerungDienst({ ablage, jetzt, personen });
    await dienst.setzeEinstellungen(DORA, {
      fassung: 0,
      zeitzone: "Europe/Vienna",
      abschliessen: true,
    });
    const { eintrag } = await dienst.lege(DORA, {
      vorgang: vorgang(),
      titel: "Übergeben",
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
    });
    expect(eintrag.erinnerung.zeitzone).toBe("Europe/Vienna");
    await dienst.uebergib(DORA, eintrag.erinnerung.id, { fassung: 1, an: "emil@beispiel.test" });

    const neu = prozess("nach-neustart");
    expect((await neu.dienst.einstellungen(DORA)).zeitzone).toBe("Europe/Vienna");
    expect((await neu.dienst.uebernommene(EMIL)).map((x) => x.erinnerung.id)).toEqual([
      eintrag.erinnerung.id,
    ]);
    uhr = loeseMitRegel({ datum: "2026-10-13", uhrzeit: "09:00" }, "Europe/Vienna", {
      luecke: "verschieben",
      doppelt: "erste",
    }).ms as number;
    uhr += 5_000;
    await neu.steuerung.lauf();
    expect(await zahl("klara_erinnerung_meldungen", EMIL)).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", DORA)).toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // Nacharbeit 4 (Ben): Konto- und Quellenänderungen ändern die Fassung der Erinnerung nicht. Sie
  // werden deshalb nach der abhängigen Aktion erneut gelesen UND im bedingten Schreiben gehalten.
  // ----------------------------------------------------------------------------------------------

  /** Das Konto so, wie die Datenbank es JETZT führt — wie `AuthService.kontoLesen`. */
  function kontoAusDb(pool: Pool) {
    return async (id: string) => {
      const r = await pool.query<{ approved: boolean; access_expires_at: string | null }>(
        "SELECT approved, access_expires_at FROM users WHERE id = $1",
        [id],
      );
      const z = r.rows[0];
      if (!z) {
        return undefined;
      }
      return z.access_expires_at
        ? { approved: z.approved, accessExpiresAt: z.access_expires_at }
        : { approved: z.approved };
    };
  }

  /** Ein „Prozess" mit echter Konten- und Notizablage aus derselben Datenbank. */
  function echterProzess(
    name: string,
    meldungen: PgKlaraErinnerungMeldungRepo,
    zusammenfassen?: (text: string) => Promise<{ text: string; ki: boolean }>,
  ) {
    const pool = neuePool();
    const ablage = { ...pgErinnerungAblage(pool), meldungen };
    const notizen = new PgKlaraNotizRepo(pool);
    const notizDienst = new KlaraNotizDienst({ repo: notizen, jetzt });
    const aufgaben = new StoerbareAufgaben(pool);
    // Nacharbeit 9: ein fremder Schritt GENAU vor dem Speichern des Berichts (nach allen Prüfungen).
    const vorBericht: { einschub: (() => Promise<void>) | null } = { einschub: null };
    return {
      notizen,
      notizDienst,
      aufgaben,
      vorBericht,
      dienst: new KlaraErinnerungDienst({ ablage, notizen, aufgaben, jetzt }),
      laeufe: ablage.laeufe,
      steuerung: new KlaraErinnerungSteuerung({
        ablage,
        konto: kontoAusDb(pool),
        notizen,
        aufgaben,
        jetzt,
        besitzer: name,
        // EQF-07: dieselbe Ergebnisablage wie in `buildApp` — „Meine Notizen“ in der Datenbank,
        // mit der Schreibbedingung der Steuerung im selben Befehl.
        ergebnisablage: {
          zuVorgang: (k, v) => notizen.zuVorgang(k, v),
          hole: (k, id) => notizen.hole(k, id),
          lege: async (k, e, bedingung) => {
            const einschub = vorBericht.einschub;
            vorBericht.einschub = null;
            await einschub?.();
            return notizDienst.lege(k, e, bedingung);
          },
          aendere: (k, id, e, bedingung) => notizDienst.aendere(k, id, e, bedingung),
        },
        ...(zusammenfassen ? { zusammenfassen } : {}),
      }),
    };
  }

  async function notizErinnerung(
    p: ReturnType<typeof echterProzess>,
    konto: string,
    titel: string,
    aktion: "erinnern" | "inhalt_zusammenfassen",
  ): Promise<{ id: string; notizId: string }> {
    const { notiz } = await p.notizDienst.lege(konto, {
      vorgang: vorgang(),
      weg: "geschrieben",
      titel,
      inhalt: `${titel}: fiktiver Inhalt für die Prüfung.`,
      objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: titel },
    });
    const { eintrag } = await p.dienst.lege(konto, {
      vorgang: vorgang(),
      titel,
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: "2026-10-13", uhrzeit: "09:00" },
      bezug: { art: "notiz", notizId: notiz.id },
      aktion,
    });
    return { id: eintrag.erinnerung.id, notizId: notiz.id };
  }

  it("P7 · Konto wird gesperrt UNMITTELBAR vor dem Schreiben (nach allen Prüfungen): die Datenbank lehnt ab", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const meldungen = new EinschubMeldungen(neuePool());
    const p = echterProzess("p7", meldungen);
    const { id } = await notizErinnerung(p, FINN, "Konto gesperrt vor dem Schreiben", "erinnern");
    meldungen.einschub = async () => {
      await neuePool().query("UPDATE users SET approved = false WHERE id = $1", [FINN]);
    };
    uhr = um("2026-10-13", "09:00") + 5_000;
    const bericht = await p.steuerung.lauf();
    expect(meldungen.ergebnisse[0]).toBe("veraltet");
    expect(bericht.gestoppt).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", FINN)).toBe(0);
    expect((await p.laeufe.fuerErinnerung(id, 10))[0]).toMatchObject({
      status: "gestoppt",
      ergebnis: { grund: "konto_gesperrt" },
    });
  });

  it("P8 · Quelle wird gelöscht UNMITTELBAR vor dem Schreiben: die Datenbank lehnt ab, Lauf wartet", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const meldungen = new EinschubMeldungen(neuePool());
    const p = echterProzess("p8", meldungen);
    const { id, notizId } = await notizErinnerung(p, GRETA, "Quelle vor dem Schreiben", "erinnern");
    meldungen.einschub = async () => {
      await neuePool().query("DELETE FROM klara_notizen WHERE id = $1", [notizId]);
    };
    uhr = um("2026-10-13", "09:00") + 5_000;
    const bericht = await p.steuerung.lauf();
    expect(meldungen.ergebnisse[0]).toBe("veraltet");
    expect(bericht.unklar).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", GRETA)).toBe(0);
    expect((await p.laeufe.fuerErinnerung(id, 10))[0]).toMatchObject({
      status: "unklar",
      ergebnis: { grund: "quelle_geloescht" },
    });
  });

  it("P9 · Modellantwort angehalten, Konto währenddessen in der Datenbank gesperrt: keine Zustellung", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    await neuePool().query("UPDATE users SET approved = true WHERE id = $1", [FINN]);
    let gerufen: () => void = () => undefined;
    let freigabe: () => void = () => undefined;
    const imModell = new Promise<void>((r) => {
      gerufen = r;
    });
    const antwort = new Promise<void>((r) => {
      freigabe = r;
    });
    const meldungen = new EinschubMeldungen(neuePool());
    const p = echterProzess("p9", meldungen, async () => {
      gerufen();
      await antwort;
      return { text: "Kurzfassung nach der Sperre.", ki: true };
    });
    const { id } = await notizErinnerung(p, FINN, "Modell während Sperre", "inhalt_zusammenfassen");
    uhr = um("2026-10-13", "09:00") + 5_000;
    const lauf = p.steuerung.lauf();
    await imModell;
    await neuePool().query("UPDATE users SET approved = false WHERE id = $1", [FINN]);
    freigabe();
    const bericht = await lauf;
    expect(bericht.gestoppt).toBe(1);
    expect(meldungen.ergebnisse).toEqual([]); // gar kein Schreibversuch
    expect(await zahl("klara_erinnerung_meldungen", FINN)).toBe(0);
    expect((await p.laeufe.fuerErinnerung(id, 10))[0]).toMatchObject({
      status: "gestoppt",
      ergebnis: { grund: "konto_gesperrt" },
    });
  });

  /**
   * Nacharbeit 5 (Ben): eine ÜBERLAPPENDE Kontoänderung in einer EIGENEN Transaktion. Nach der
   * letzten Anwendungsprüfung — unmittelbar vor dem INSERT — beginnt sie, ändert die Kontozeile und
   * bleibt offen; das INSERT startet, solange sie noch nicht festgeschrieben ist, und erst danach
   * schreibt sie fest. Das INSERT muss auf sie warten und darf danach nichts schreiben.
   */
  async function ueberlappend(
    meldungen: EinschubMeldungen,
    aenderung: string,
    konto: string,
  ): Promise<{ festgeschriebenAm: () => number }> {
    // Der Zeitpunkt, zu dem das COMMIT ABGESCHICKT wird. Kam das INSERT später zurück, hat es auf
    // die fremde, noch offene Transaktion gewartet (gemessen vor dem COMMIT, damit die Reihenfolge
    // der beiden Antworten im Client den Beleg nicht verfälscht).
    let am = 0;
    meldungen.einschub = async () => {
      const fremd = await neuePool().connect();
      await fremd.query("BEGIN");
      await fremd.query(aenderung, [konto]);
      // Noch NICHT festgeschrieben: erst 400 ms später, während das INSERT schon läuft.
      void (async () => {
        await new Promise((weiter) => setTimeout(weiter, 400));
        am = Date.now();
        await fremd.query("COMMIT");
        fremd.release();
      })();
    };
    return { festgeschriebenAm: () => am };
  }

  it("P10 · überlappende Kontosperre (eigene Transaktion, nach der letzten Prüfung): INSERT wartet, schreibt nichts", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const meldungen = new EinschubMeldungen(neuePool());
    const p = echterProzess("p10", meldungen);
    const { id } = await notizErinnerung(p, HANNA, "Überlappende Sperre", "erinnern");
    const fremd = await ueberlappend(
      meldungen,
      "UPDATE users SET approved = false WHERE id = $1",
      HANNA,
    );
    uhr = um("2026-10-13", "09:00") + 5_000;
    const bericht = await p.steuerung.lauf();
    expect(meldungen.ergebnisse[0]).toBe("veraltet");
    // Das INSERT war erst NACH dem Festschreiben der fremden Transaktion fertig: es hat gewartet.
    expect(fremd.festgeschriebenAm()).toBeGreaterThan(0);
    expect(meldungen.fertigAm[0] ?? 0).toBeGreaterThanOrEqual(fremd.festgeschriebenAm());
    expect(bericht.gestoppt).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", HANNA)).toBe(0);
    expect((await p.laeufe.fuerErinnerung(id, 10))[0]).toMatchObject({
      status: "gestoppt",
      ergebnis: { grund: "konto_gesperrt" },
    });
  });

  it("P11 · überlappende Kontolöschung (eigene Transaktion, nach der letzten Prüfung): keine Zustellung ohne Kontozeile", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const meldungen = new EinschubMeldungen(neuePool());
    const p = echterProzess("p11", meldungen);
    const { id } = await notizErinnerung(p, IDA, "Überlappende Löschung", "erinnern");
    // Derselbe Befehl wie der vorhandene Löschweg (`services/auth/src/repo-pg.ts`, `delete`).
    const fremd = await ueberlappend(meldungen, "DELETE FROM users WHERE id=$1", IDA);
    uhr = um("2026-10-13", "09:00") + 5_000;
    const bericht = await p.steuerung.lauf();
    expect(meldungen.ergebnisse[0]).toBe("veraltet");
    expect(fremd.festgeschriebenAm()).toBeGreaterThan(0);
    expect(meldungen.fertigAm[0] ?? 0).toBeGreaterThanOrEqual(fremd.festgeschriebenAm());
    expect(bericht.gestoppt).toBe(1);
    expect(await zahl("klara_erinnerung_meldungen", IDA)).toBe(0);
    expect((await p.laeufe.fuerErinnerung(id, 10))[0]).toMatchObject({
      status: "gestoppt",
      ergebnis: { grund: "konto_gesperrt" },
    });
  });

  it("P12 · Konto ohne Kontozeile: auch ohne Anwendungsprüfung schreibt das bedingte INSERT nichts", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const repo = new PgKlaraErinnerungMeldungRepo(neuePool());
    const p = echterProzess("p12", repo);
    const { id } = await notizErinnerung(p, CARL, "Direkt geschrieben", "erinnern");
    const e = (await p.dienst.eintrag(CARL, id)).erinnerung;
    const meldung = {
      id: `ke-${id}@2026-10-13T09:00`,
      kontoId: "u-pg-erinnerung-gibt-es-nicht",
      erinnerungId: id,
      art: "erinnerung" as const,
      titel: e.titel,
      zugestelltAm: new Date(uhr).toISOString(),
      vorkommen: ["2026-10-13T07:00:00.000Z"],
      nachgeholt: false,
      pruefung: null,
      laufStatus: "zugestellt" as const,
    };
    const bedingung = {
      erinnerungId: id,
      fassung: e.fassung,
      quelle: quelleFuerBedingung(e),
    };
    expect(
      await repo.schreibe(meldung, {
        ...bedingung,
        empfaenger: { kontoId: "u-pg-erinnerung-gibt-es-nicht", jetzt: uhr },
      }),
    ).toBe("veraltet");
    // Gegenprobe: dieselbe Meldung an das vorhandene, berechtigte Konto wird geschrieben.
    expect(
      await repo.schreibe(
        { ...meldung, kontoId: CARL },
        { ...bedingung, empfaenger: { kontoId: CARL, jetzt: uhr } },
      ),
    ).toBe("geschrieben");
  });

  it("P13 · EQF-07: Routine in der Datenbank — Bericht in klara_notizen, Neustart und zweiter Prozess wiederholen nichts", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const a = echterProzess("routine-a", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const { notiz: fest } = await a.notizDienst.lege(HANNA, {
      vorgang: vorgang(),
      weg: "geschrieben",
      titel: "Wochenziel",
      inhalt: "Wochenziel: Filter Presse 4 tauschen.",
      objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "Wochenziel" },
    });
    await neuePool().query("UPDATE users SET approved = true WHERE id = $1", [HANNA]);
    const { eintrag } = await a.dienst.lege(HANNA, {
      vorgang: vorgang(),
      titel: "Wochenbericht",
      zeitzone: BERLIN,
      zeitplan: {
        art: "serie",
        datum: "2026-10-19",
        uhrzeit: "09:00",
        wiederholung: { takt: "woechentlich", intervall: 1, anzahl: 4 },
      },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest.id] },
    });
    const id = eintrag.erinnerung.id;
    // Einrichtung: nichts ausgeführt.
    await a.steuerung.lauf();
    const vorgang19 = ergebnisVorgang(`${id}@2026-10-19T09:00`);
    expect(await a.notizen.zuVorgang(HANNA, vorgang19)).toBeNull();

    uhr = um("2026-10-19", "09:00") + 5_000;
    // Zwei Prozesse gleichzeitig, dann ein Neustart (neuer Pool, neue Steuerung).
    const b = echterProzess("routine-b", new PgKlaraErinnerungMeldungRepo(neuePool()));
    await Promise.all([a.steuerung.lauf(), b.steuerung.lauf()]);
    const neustart = echterProzess(
      "routine-neustart",
      new PgKlaraErinnerungMeldungRepo(neuePool()),
    );
    await neustart.steuerung.lauf();
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_notizen WHERE konto_id = $1 AND vorgang = $2",
      [HANNA, vorgang19],
    );
    expect(res.rows[0]?.n).toBe(1);
    const lauf = (await a.laeufe.fuerErinnerung(id, 10))[0];
    expect(lauf).toMatchObject({
      status: "zugestellt",
      versuch: 1,
      ergebnis: {
        routine: {
          status: "erstellt",
          routineFassung: 1,
          quellen: [{ art: "notiz", id: fest.id, fassung: 1 }],
        },
      },
    });
    const bericht = await a.notizen.hole(HANNA, lauf?.ergebnis.routine?.notizId ?? "");
    expect(bericht?.inhalt).toContain(`[notiz ${fest.id}, Fassung 1]`);
    expect(await zahl("klara_erinnerung_meldungen", HANNA)).toBe(1);
  });

  /** Eine wöchentliche Routine mit einer festen Notiz, montags 09:00 ab dem 19.10.2026. */
  async function routineMitNotiz(
    p: ReturnType<typeof echterProzess>,
    konto: string,
  ): Promise<{ id: string; festId: string; vorgang19: string }> {
    const { notiz: fest } = await p.notizDienst.lege(konto, {
      vorgang: vorgang(),
      weg: "geschrieben",
      titel: "Wochenziel",
      inhalt: "Wochenziel: fiktiver Inhalt für die Prüfung.",
      objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "Wochenziel" },
    });
    const { eintrag } = await p.dienst.lege(konto, {
      vorgang: vorgang(),
      titel: "Wochenbericht",
      zeitzone: BERLIN,
      zeitplan: {
        art: "serie",
        datum: "2026-10-19",
        uhrzeit: "09:00",
        wiederholung: { takt: "woechentlich", intervall: 1, anzahl: 4 },
      },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben"], notizIds: [fest.id] },
    });
    const id = eintrag.erinnerung.id;
    return { id, festId: fest.id, vorgang19: ergebnisVorgang(`${id}@2026-10-19T09:00`) };
  }

  async function berichtZahl(konto: string, v: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_notizen WHERE konto_id = $1 AND vorgang = $2",
      [konto, v],
    );
    return res.rows[0]?.n ?? -1;
  }

  it("P14 · Nacharbeit 9: Pause, Kontosperre bzw. Quellenänderung UNMITTELBAR vor dem Speichern des Berichts", async () => {
    // (a) Ein ANDERER Prozess pausiert die Routine nach allen Prüfungen, vor dem Notiz-INSERT.
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const a = echterProzess("p14-pause", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const pause = await routineMitNotiz(a, JONA);
    const andere = echterProzess("p14-andere", new PgKlaraErinnerungMeldungRepo(neuePool()));
    a.vorBericht.einschub = async () => {
      const f = (await andere.dienst.eintrag(JONA, pause.id)).erinnerung.fassung;
      await andere.dienst.status(JONA, pause.id, { fassung: f, aktion: "pausieren" });
    };
    uhr = um("2026-10-19", "09:00") + 5_000;
    await a.steuerung.lauf();
    expect(a.vorBericht.einschub).toBeNull();
    expect(await berichtZahl(JONA, pause.vorgang19)).toBe(0);
    expect((await a.laeufe.fuerErinnerung(pause.id, 10))[0]).toMatchObject({
      status: "abgebrochen",
      ergebnis: { grund: "status_geaendert" },
    });

    // (b) Das Konto wird in der Datenbank gesperrt — nach allen Prüfungen, vor dem INSERT.
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const b = echterProzess("p14-sperre", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const sperre = await routineMitNotiz(b, KAI);
    b.vorBericht.einschub = async () => {
      await neuePool().query("UPDATE users SET approved = false WHERE id = $1", [KAI]);
    };
    uhr = um("2026-10-19", "09:00") + 5_000;
    await b.steuerung.lauf();
    expect(await berichtZahl(KAI, sperre.vorgang19)).toBe(0);
    expect((await b.laeufe.fuerErinnerung(sperre.id, 10))[0]).toMatchObject({
      status: "gestoppt",
      ergebnis: { grund: "konto_gesperrt" },
    });

    // (c) Die feste Notiz wird nach dem Lesen in der Datenbank geändert: der INSERT hält die
    //     gelesene Fassung fest und schreibt nichts; neu gelesen entsteht EIN Bericht mit Fassung 2.
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const c = echterProzess("p14-quelle", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const quelle = await routineMitNotiz(c, LENA);
    c.vorBericht.einschub = async () => {
      await andere.notizDienst.aendere(LENA, quelle.festId, {
        fassung: 1,
        inhalt: "Wochenziel: geändert nach dem Lesen.",
      });
    };
    uhr = um("2026-10-19", "09:00") + 5_000;
    await c.steuerung.lauf();
    expect(c.vorBericht.einschub).toBeNull();
    expect(await berichtZahl(LENA, quelle.vorgang19)).toBe(1);
    const lauf = (await c.laeufe.fuerErinnerung(quelle.id, 10))[0];
    expect(lauf).toMatchObject({
      status: "zugestellt",
      ergebnis: { routine: { quellen: [{ art: "notiz", id: quelle.festId, fassung: 2 }] } },
    });
    const n = await c.notizen.zuVorgang(LENA, quelle.vorgang19);
    expect(n?.inhalt).toContain(`[notiz ${quelle.festId}, Fassung 2]`);
    expect(n?.inhalt).not.toContain(`[notiz ${quelle.festId}, Fassung 1]`);
  });

  it("P16 · Nacharbeit 16: bedingtes Entfernen — Fassung und „kein Lauf“ gelten im selben Befehl", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const p = echterProzess("p16", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const ablage = pgErinnerungAblage(neuePool());
    const lege = async (titel: string) =>
      (
        await p.dienst.lege(JONA, {
          vorgang: vorgang(),
          titel,
          zeitzone: BERLIN,
          zeitplan: { art: "einmalig", datum: "2026-10-20", uhrzeit: "09:00" },
        })
      ).eintrag.erinnerung;
    // Inzwischen geändert (Fassung 2) → bleibt.
    const geaendert = await lege("P16 geändert");
    await p.dienst.aendere(JONA, geaendert.id, { fassung: 1, titel: "P16 geändert (2)" });
    expect(await ablage.erinnerungen.entferneBedingt(JONA, geaendert.id, 1)).toBe(false);
    expect(await ablage.erinnerungen.holeSystem(geaendert.id)).not.toBeNull();
    // Schon ein Lauf (Wirkung übernommen) → bleibt.
    const gelaufen = await lege("P16 gelaufen");
    const schluessel = "2026-10-20T09:00";
    expect(
      await ablage.laeufe.uebernimm({
        vorkommenId: `${gelaufen.id}@${schluessel}`,
        erinnerungId: gelaufen.id,
        kontoId: JONA,
        geplantFuer: um("2026-10-20", "09:00"),
        besitzer: "p16",
        jetzt: uhr,
        leaseMs: KLARA_ERINNERUNG_LEASE_MS,
        art: "erinnerung",
        meldungId: `ke-${gelaufen.id}@${schluessel}`,
      }),
    ).not.toBeNull();
    expect(await ablage.erinnerungen.entferneBedingt(JONA, gelaufen.id, 1)).toBe(false);
    expect(await ablage.erinnerungen.holeSystem(gelaufen.id)).not.toBeNull();
    // Fremdes Konto → nichts.
    const frisch = await lege("P16 frisch");
    expect(await ablage.erinnerungen.entferneBedingt(KAI, frisch.id, 1)).toBe(false);
    // Unverändert, ohne Lauf → entfernt.
    expect(await ablage.erinnerungen.entferneBedingt(JONA, frisch.id, 1)).toBe(true);
    expect(await ablage.erinnerungen.holeSystem(frisch.id)).toBeNull();
  });

  it("P17 · Nacharbeit 17: Laufübernahme und bedingtes Entfernen über DIESELBE Sperre — beide Reihenfolgen", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const p = echterProzess("p17", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const ablage = pgErinnerungAblage(neuePool());
    const schluessel = "2026-10-21T09:00";
    const lege = async (titel: string) =>
      (
        await p.dienst.lege(JONA, {
          vorgang: vorgang(),
          titel,
          zeitzone: BERLIN,
          zeitplan: { art: "einmalig", datum: "2026-10-21", uhrzeit: "09:00" },
        })
      ).eintrag.erinnerung;
    const uebernahme = (id: string, besitzer: string) => ({
      vorkommenId: `${id}@${schluessel}`,
      erinnerungId: id,
      kontoId: JONA,
      geplantFuer: um("2026-10-21", "09:00"),
      besitzer,
      jetzt: uhr,
      leaseMs: KLARA_ERINNERUNG_LEASE_MS,
      art: "erinnerung" as const,
      meldungId: `ke-${id}@${schluessel}`,
    });

    // (a) Eine Übernahme hält die Zeile (FOR SHARE) und legt ihren Lauf an — noch NICHT
    //     festgeschrieben. Das Entfernen wartet auf sie und sieht danach den Lauf: nichts gelöscht.
    const a = await lege("P17 Übernahme zuerst");
    const fremd = await neuePool().connect();
    await fremd.query("BEGIN");
    await fremd.query("SELECT 1 FROM klara_erinnerungen WHERE id = $1 FOR SHARE", [a.id]);
    await fremd.query(
      `INSERT INTO klara_erinnerung_laeufe
         (vorkommen_id, erinnerung_id, konto_id, geplant_fuer, status, versuch, besitzer,
          lease_bis, aktualisiert_am, data)
       VALUES ($1, $2, $3, $4, 'laeuft', 1, 'p17-fremd', $5, $6, $7)`,
      [
        `${a.id}@${schluessel}`,
        a.id,
        JONA,
        new Date(um("2026-10-21", "09:00")),
        new Date(uhr + KLARA_ERINNERUNG_LEASE_MS),
        new Date(uhr),
        JSON.stringify({ art: "erinnerung", meldungId: `ke-${a.id}@${schluessel}`, ergebnis: {} }),
      ],
    );
    const entfernen = ablage.erinnerungen.entferneBedingt(JONA, a.id, 1);
    await new Promise((weiter) => setTimeout(weiter, 300));
    await fremd.query("COMMIT");
    fremd.release();
    expect(await entfernen).toBe(false);
    expect(await ablage.erinnerungen.holeSystem(a.id)).not.toBeNull();
    expect(await ablage.laeufe.hole(`${a.id}@${schluessel}`)).not.toBeNull();

    // (b) Das Entfernen hält die Zeile (FOR UPDATE) und löscht — noch NICHT festgeschrieben. Eine
    //     Übernahme wartet auf die Sperre und findet die Erinnerung danach nicht: kein Lauf.
    const b = await lege("P17 Entfernen zuerst");
    const loescher = await neuePool().connect();
    await loescher.query("BEGIN");
    await loescher.query("SELECT 1 FROM klara_erinnerungen WHERE id = $1 FOR UPDATE", [b.id]);
    await loescher.query("DELETE FROM klara_erinnerungen WHERE id = $1", [b.id]);
    const uebernommen = ablage.laeufe.uebernimm(uebernahme(b.id, "p17-steuerung"));
    await new Promise((weiter) => setTimeout(weiter, 300));
    await loescher.query("COMMIT");
    loescher.release();
    expect(await uebernommen).toBeNull();
    expect(await ablage.laeufe.hole(`${b.id}@${schluessel}`)).toBeNull();

    // (c) Ohne Gegenspieler bleibt die Übernahme unverändert möglich.
    const c = await lege("P17 regulär");
    expect(await ablage.laeufe.uebernimm(uebernahme(c.id, "p17-regulaer"))).not.toBeNull();
  });

  it("P15 · Nacharbeit 9: Teilbericht in der Datenbank — Fortsetzung nach Neustart im SELBEN Bericht", async () => {
    uhr = Date.parse("2026-10-12T08:00:00.000Z");
    const a = echterProzess("p15-a", new PgKlaraErinnerungMeldungRepo(neuePool()));
    const r = await routineMitNotiz(a, MIA);
    a.aufgaben.listeKaputt = true;
    uhr = um("2026-10-19", "09:00") + 5_000;
    await a.steuerung.lauf();
    const vorher = await a.notizen.zuVorgang(MIA, r.vorgang19);
    expect(vorher?.fassung).toBe(1);
    expect(vorher?.inhalt).toContain("## Noch offen");
    expect((await a.laeufe.fuerErinnerung(r.id, 10))[0]).toMatchObject({
      status: "teilweise",
      ergebnis: { routine: { status: "teilweise", fortsetzbar: true } },
    });

    // Neustart: neuer Pool, neue Steuerung, Aufgabenablage wieder lesbar.
    uhr += 60_000;
    const neu = echterProzess("p15-neustart", new PgKlaraErinnerungMeldungRepo(neuePool()));
    await neu.steuerung.lauf();
    expect(await berichtZahl(MIA, r.vorgang19)).toBe(1);
    const nachher = await neu.notizen.zuVorgang(MIA, r.vorgang19);
    expect(nachher?.id).toBe(vorher?.id);
    expect(nachher?.fassung).toBe(2);
    expect(nachher?.inhalt).not.toContain("## Noch offen");
    expect(nachher?.inhalt).toContain(`[notiz ${r.festId}, Fassung 1]`);
    expect((await neu.laeufe.fuerErinnerung(r.id, 10))[0]).toMatchObject({
      status: "zugestellt",
      ergebnis: { routine: { status: "erstellt", notizFassung: 2, offen: [], fortsetzbar: false } },
    });
    // Ein weiterer Neustart setzt nichts mehr fort.
    uhr += 60_000;
    await echterProzess("p15-noch", new PgKlaraErinnerungMeldungRepo(neuePool())).steuerung.lauf();
    expect((await neu.notizen.zuVorgang(MIA, r.vorgang19))?.fassung).toBe(2);
  });
});
