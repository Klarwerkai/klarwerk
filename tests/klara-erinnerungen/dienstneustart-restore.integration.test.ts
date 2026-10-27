// ================================================================================================
// KLARA 10 (produkt:20261007:klara-erinnerungen-kalender) · ECHTER DIENSTNEUSTART UND ECHTER RESTORE.
// ================================================================================================
//
// Nacharbeit 2 (Ben, Befund 5): `erinnerung-pg.integration.test.ts` belegt Neustarts nur als neuen
// Pool IM SELBEN Prozess. Hier läuft Klarwerk als EIGENER Betriebssystemprozess
// (`node --import tsx services/app/src/server.ts`, `starteKlarwerk` aus der vorhandenen
// Restore-Vorrichtung) gegen eine eigene Wegwerf-Datenbank; die Erinnerungssteuerung ist die, die
// `server.ts` beim Start und im Takt fährt. Kein Test ruft die Steuerung selbst.
//
//   R1 (AW18-K05/K12, K4, P07-AC07) Anlegen über HTTP → Prozess BEENDET (PID weg) → Stillstand →
//      NEUER Prozess: je Verpasst-Regel die zugesagte Wirkung über MEHRERE verpasste Termine,
//      Grenzzeit (innerhalb = pünktlich, darüber = verpasst), feste Meldungs- und Laufkennungen.
//   R2 (AW18-K04/K06) Ein DRITTER Prozess auf demselben Bestand: dieselben Kennungen, keine neue
//      Meldung, kein neuer Versuch.
//   R3 (AW18-K12) Sicherung mit dem UNVERÄNDERTEN `scripts/backup/backup.sh`, Wiederherstellung mit
//      dem UNVERÄNDERTEN `scripts/backup/restore-drill.sh` in eine LEERE Zieldatenbank, danach ein
//      Prozess gegen das Ziel: dieselben Meldungskennungen. Zusätzlich der Fall „Sicherung mitten im
//      Lauf“ (Meldung im Bestand, Laufzeilen und Steuerstand nicht): Readback statt Doppelmeldung.
//   R4 (EQF-07-K10, Nacharbeit 9) Der Wochenbericht auf echten Prozessen: über HTTP einrichten
//      (nichts läuft), in Worten ändern, pausieren; nach Stillstand nachgeholt mit Funktionsfassung
//      2; Quellausfall im laufenden Betrieb → Handlungsmeldung bzw. Teilbericht, danach Fortsetzung
//      im selben Bericht; Absturz nach der Wirkung → Readback, kein zweiter Bericht; Pause übersteht
//      Neustarts, Fortsetzen durch die Person.
//
// WAS HIER SIMULIERT IST — ausdrücklich: Ein Stillstand von Tagen lässt sich in einem Testlauf nicht
// abwarten. Während der Prozess WIRKLICH beendet ist, wird der gespeicherte Zeitplan deshalb per SQL
// in die Vergangenheit gelegt (Datum/Uhrzeit, `bearbeitet_bis`, `naechste_faelligkeit`) — dasselbe,
// was ein Stillstand über diese Termine hinterlässt. Für R3 wird im WIEDERHERGESTELLTEN Ziel der
// Zustand „Sicherung mitten im Lauf“ ebenso per SQL hergestellt. Prozessende, Neustart, Sicherung und
// Wiederherstellung selbst sind echt. Daten fiktiv.
//
// INFRASTRUKTUR: echte PostgreSQL (`KLARWERK_PG_TEST_URL` mit `test` im Namen oder Wegwerf-
// Container) und `pg_dump`/`pg_restore`/`psql`/`createdb`/`ps`/`curl` auf dem PATH. Fehlt etwas,
// SCHEITERT die Suite mit dem Namen der fehlenden Voraussetzung — kein stiller Skip.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ergebnisVorgang } from "../../services/app/src/klara-routine";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Instanz,
  PASSWORT,
  type Verbindung,
  fahreDrill,
  freierPort,
  pgUrl,
  prozessLebt,
  sende,
  sichere,
  starteKlarwerk,
  werkzeugFehlt,
  zerlege,
} from "../beziehungs-restore-nutzerweg/vorrichtung";

const NACHWEIS = "[KLARWERK] Klara 10 · Neustart/Restore";
const ADMIN = { name: "Erinnerung Admin", email: "ke-admin@erinnerung-neustart.test" };
const NORA = { name: "Nora Neustart", email: "nora@erinnerung-neustart.test" };
const BASIS = "/api/me/klara/erinnerungen";
const TAG = 86_400_000;
const REGELN = ["nachholen", "nur_melden", "zusammenfassen", "ueberspringen"] as const;
type Regel = (typeof REGELN)[number];

interface Lauf {
  vorkommenId: string;
  status: string;
  versuch: number;
  art: string;
  ergebnis: { nachgeholt?: boolean; dedupliziert?: boolean; grund?: string };
}
interface Meldungszeile {
  id: string;
  erinnerung_id: string;
  art: string;
  vorkommen: string[];
  nachgeholt: boolean;
}

/** „YYYY-MM-DDTHH:MM“ in UTC — in der Zone UTC zugleich der nominale Terminschlüssel. */
const schluessel = (ms: number): string => new Date(ms).toISOString().slice(0, 16);
const aufMinute = (ms: number): number => Math.floor(ms / 60_000) * 60_000;

describe("Klara 10 · Erinnerungen über echten Dienstneustart und echten Restore", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let instanz: Instanz | undefined;

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_ke_quelle_test_${kennung}`;
  const zielDb = `klarwerk_ke_ziel_test_${kennung}`;

  let adminToken = "";
  let noraToken = "";
  let noraId = "";
  /** Je Regel die Serie, dazu „pünktlich“ (innerhalb der Grenze) und „knapp verpasst“. */
  const serie = new Map<Regel, string>();
  let puenktlich = "";
  let knapp = "";
  /** Beginn der Serien nach der Verschiebung — vier Termine liegen in der Vergangenheit. */
  let serienBeginn = 0;
  let puenktlichAm = 0;
  let knappAm = 0;
  /** Die Meldungskennungen nach dem ersten Wiederanlauf — der Vergleichsmaßstab für R2 und R3. */
  let kennungenNachR1: string[] = [];
  const pids: number[] = [];

  function v(): Verbindung {
    if (!verbindung) {
      throw new Error(`${NACHWEIS}: keine Verbindung — beforeAll ist gescheitert.`);
    }
    return verbindung;
  }

  async function starte(db: string, was: string): Promise<Instanz> {
    const i = await starteKlarwerk({ datenbankUrl: pgUrl(v(), db), was });
    instanz = i;
    pids.push(i.pid);
    return i;
  }

  async function beende(i: Instanz): Promise<void> {
    await i.beende();
    expect(prozessLebt(i.pid), `PID ${i.pid} lebt noch — dann wäre das kein Neustart`).toBe(false);
    instanz = undefined;
  }

  /** Wartet, bis DIESER Prozess seinen ersten Takt (beim Start) abgeschlossen hat. */
  async function ersterTakt(i: Instanz): Promise<Record<string, unknown>> {
    const frist = Date.now() + 90_000;
    while (Date.now() < frist) {
      const r = await sende(i.basis, "GET", `${BASIS}/ueberwachung`, noraToken);
      expect(r.status, r.text).toBe(200);
      const letzter = (r.json as { steuerung: { letzterLauf: Record<string, unknown> | null } })
        .steuerung.letzterLauf;
      if (letzter) {
        return letzter;
      }
      await new Promise((weiter) => setTimeout(weiter, 500));
    }
    throw new Error(`${NACHWEIS}: der Prozess ${i.pid} hat in 90 s keinen Takt abgeschlossen.`);
  }

  async function meldungen(db: string): Promise<Meldungszeile[]> {
    const pool = new Pool({ connectionString: pgUrl(v(), db) });
    try {
      const r = await pool.query<Meldungszeile>(
        `SELECT id, erinnerung_id, data->>'art' AS art,
                ARRAY(SELECT jsonb_array_elements_text(data->'vorkommen')) AS vorkommen,
                (data->>'nachgeholt')::boolean AS nachgeholt
           FROM klara_erinnerung_meldungen WHERE konto_id = $1 ORDER BY id`,
        [noraId],
      );
      return r.rows;
    } finally {
      await pool.end();
    }
  }

  async function laeufe(i: Instanz, id: string): Promise<Lauf[]> {
    const r = await sende(i.basis, "GET", `${BASIS}/${id}`, noraToken);
    expect(r.status, r.text).toBe(200);
    return (r.json as { erinnerung: { laeufe: Lauf[] } }).erinnerung.laeufe;
  }

  /** Die vier verpassten Termine einer Serie, als nominale Schlüssel. */
  const verpassteTermine = (): string[] =>
    [0, 1, 2, 3].map((k) => schluessel(serienBeginn + k * TAG));

  beforeAll(async () => {
    const werkzeuge = ["pg_dump", "pg_restore", "psql", "createdb", "ps", "curl"];
    const fehlend = werkzeuge.filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      throw new Error(
        `${NACHWEIS}: fehlende Voraussetzung auf dem PATH: ${fehlend.join(", ")} — ohne sie laufen backup.sh und restore-drill.sh nicht.`,
      );
    }
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(`${NACHWEIS}: KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr).`);
    }
    if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error(`${NACHWEIS}: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit.`, {
          cause,
        });
      }
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      throw new Error(`${NACHWEIS}: die Test-URL nennt keinen Rechnernamen.`);
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-ke-neustart-"));
  }, 240_000);

  afterAll(async () => {
    await instanz?.beende();
    if (adminPool) {
      for (const db of [quellDb, zielDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
    process.stderr.write(
      `${NACHWEIS} BELEGE: PIDs=${pids.join(",")} Quelle=${quellDb} Ziel=${zielDb}\n`,
    );
  }, 180_000);

  it("R1 · anlegen, Prozess beenden, Stillstand, neuer Prozess: jede Regel, Grenzzeit, feste Kennungen", async () => {
    const vorher = await starte(quellDb, "Erinnerungen anlegen");
    try {
      const setup = await sende(vorher.basis, "POST", "/api/auth/setup", undefined, {
        ...ADMIN,
        password: PASSWORT,
      });
      expect(setup.status, setup.text).toBe(201);
      adminToken = (setup.json as { token: string }).token;
      const angelegt = await sende(vorher.basis, "POST", "/api/users", adminToken, {
        ...NORA,
        password: PASSWORT,
        role: "experte",
      });
      expect(angelegt.status, angelegt.text).toBe(201);
      noraId = (angelegt.json as { id: string }).id;
      const login = await sende(vorher.basis, "POST", "/api/auth/login", undefined, {
        email: NORA.email,
        password: PASSWORT,
      });
      expect(login.status, login.text).toBe(200);
      noraToken = (login.json as { token: string }).token;

      const morgen = new Date(Date.now() + TAG).toISOString().slice(0, 10);
      const lege = async (titel: string, rumpf: Record<string, unknown>): Promise<string> => {
        const r = await sende(vorher.basis, "POST", BASIS, noraToken, {
          vorgang: `ke-neustart-${kennung}-${titel.replace(/\W+/g, "-")}`,
          titel,
          zeitzone: "UTC",
          ...rumpf,
        });
        expect(r.status, r.text).toBe(201);
        return (r.json as { erinnerung: { id: string } }).erinnerung.id;
      };
      for (const regel of REGELN) {
        serie.set(
          regel,
          await lege(`Serie ${regel}`, {
            verpasst: { regel, grenzeMinuten: 30 },
            zeitplan: {
              art: "serie",
              datum: morgen,
              uhrzeit: "09:00",
              wiederholung: { takt: "taeglich", intervall: 1, anzahl: 6 },
            },
          }),
        );
      }
      const einmal = { art: "einmalig", datum: morgen, uhrzeit: "09:00" };
      puenktlich = await lege("Innerhalb der Grenze", {
        verpasst: { regel: "nur_melden", grenzeMinuten: 30 },
        zeitplan: einmal,
      });
      knapp = await lege("Knapp über der Grenze", {
        verpasst: { regel: "nur_melden", grenzeMinuten: 30 },
        zeitplan: einmal,
      });
      // Vor dem Halt: nichts fällig, nichts zugestellt.
      expect(await meldungen(quellDb)).toEqual([]);
    } finally {
      await beende(vorher);
    }

    // DER STILLSTAND (simuliert, s. Dateikopf) — während KEIN Prozess läuft.
    const jetzt = Date.now();
    serienBeginn = aufMinute(jetzt - 3 * TAG - 2 * 3_600_000);
    puenktlichAm = aufMinute(jetzt - 20 * 60_000);
    knappAm = aufMinute(jetzt - 40 * 60_000);
    const pool = new Pool({ connectionString: pgUrl(v(), quellDb) });
    try {
      const lege = async (id: string, am: number): Promise<void> => {
        const k = schluessel(am);
        const r = await pool.query(
          `UPDATE klara_erinnerungen
              SET data = jsonb_set(jsonb_set(data, '{zeitplan,datum}', to_jsonb($2::text)),
                                   '{zeitplan,uhrzeit}', to_jsonb($3::text)),
                  bearbeitet_bis = $4::timestamptz,
                  naechste_faelligkeit = $5::timestamptz
            WHERE id = $1`,
          [id, k.slice(0, 10), k.slice(11, 16), new Date(am - 3_600_000), new Date(am)],
        );
        expect(r.rowCount).toBe(1);
      };
      for (const id of serie.values()) {
        await lege(id, serienBeginn);
      }
      await lege(puenktlich, puenktlichAm);
      await lege(knapp, knappAm);
    } finally {
      await pool.end();
    }

    const nachher = await starte(quellDb, "Wiederanlauf nach dem Stillstand");
    try {
      expect(pids[1]).not.toBe(pids[0]);
      const erster = await ersterTakt(nachher);
      expect(erster.ende).toBeTypeOf("string");
      const zweiter = await naechsterTakt(nachher, String(erster.ende));
      // Sechs Erinnerungen benötigen bei fünf je Konto zwei reguläre Takte.
      const bericht = Object.fromEntries(
        [
          "nachgeholt",
          "verpasstGemeldet",
          "zusammengefasst",
          "uebersprungen",
          "zugestellt",
          "fehlgeschlagen",
          "dedupliziert",
        ].map((feld) => {
          expect(erster[feld], `erster Takt: ${feld}`).toBeTypeOf("number");
          expect(zweiter[feld], `zweiter Takt: ${feld}`).toBeTypeOf("number");
          return [feld, (erster[feld] as number) + (zweiter[feld] as number)] as const;
        }),
      );
      expect(bericht).toMatchObject({
        nachgeholt: 4,
        verpasstGemeldet: 5,
        zusammengefasst: 4,
        uebersprungen: 4,
        zugestellt: 1,
        fehlgeschlagen: 0,
        dedupliziert: 0,
      });

      const termine = verpassteTermine();
      const zeilen = await meldungen(quellDb);
      const von = (id: string) => zeilen.filter((z) => z.erinnerung_id === id);
      const nachholen = serie.get("nachholen") ?? "";
      const melden = serie.get("nur_melden") ?? "";
      const sammeln = serie.get("zusammenfassen") ?? "";
      const springen = serie.get("ueberspringen") ?? "";
      // Nachholen: jeder Termin einzeln, als nachgeholte Erinnerung.
      expect(von(nachholen).map((z) => [z.id, z.art, z.nachgeholt])).toEqual(
        termine.map((t) => [`ke-${nachholen}@${t}`, "erinnerung", true]),
      );
      // Nur melden: jeder Termin einzeln, als „verpasst“.
      expect(von(melden).map((z) => [z.id, z.art])).toEqual(
        termine.map((t) => [`ke-${melden}@${t}`, "verpasst"]),
      );
      // Zusammenfassen und Überspringen: EINE Meldung über alle vier Termine.
      for (const [id, art, praefix] of [
        [sammeln, "zusammenfassung", "ke-sammel"],
        [springen, "uebersprungen", "ke-uebersprungen"],
      ] as const) {
        const [m, ...rest] = von(id);
        expect(rest).toEqual([]);
        expect(m).toMatchObject({ id: `${praefix}-${id}@${termine[0]}`, art });
        expect(m?.vorkommen).toHaveLength(4);
      }
      // Grenzzeit: 20 Minuten nach dem Termin pünktlich, 40 Minuten danach verpasst (Grenze 30).
      expect(von(puenktlich).map((z) => [z.id, z.art, z.nachgeholt])).toEqual([
        [`ke-${puenktlich}@${schluessel(puenktlichAm)}`, "erinnerung", false],
      ]);
      expect(von(knapp).map((z) => [z.id, z.art])).toEqual([
        [`ke-${knapp}@${schluessel(knappAm)}`, "verpasst"],
      ]);

      // Die Läufe tragen dieselben Termine, je einer, mit ihrem Ergebnis.
      const status = async (id: string) =>
        (await laeufe(nachher, id)).map((l) => [l.vorkommenId, l.status, l.versuch]).sort();
      const erwartet = (id: string, s: string) => termine.map((t) => [`${id}@${t}`, s, 1]).sort();
      expect(await status(nachholen)).toEqual(erwartet(nachholen, "zugestellt"));
      expect(await status(melden)).toEqual(erwartet(melden, "verpasst_gemeldet"));
      expect(await status(sammeln)).toEqual(erwartet(sammeln, "zusammengefasst"));
      expect(await status(springen)).toEqual(erwartet(springen, "uebersprungen"));

      // Und die Person sieht genau diese Meldungen in IHRER Glocke.
      const glocke = await sende(nachher.basis, "GET", "/api/notifications", noraToken);
      expect(glocke.status, glocke.text).toBe(200);
      const inGlocke = (glocke.json as { id: string; kind: string }[])
        .filter((n) => n.kind === "erinnerung")
        .map((n) => n.id)
        .sort();
      kennungenNachR1 = zeilen.map((z) => z.id).sort();
      expect(inGlocke).toEqual(kennungenNachR1);
      expect(kennungenNachR1).toHaveLength(4 + 4 + 1 + 1 + 1 + 1);
    } finally {
      await beende(nachher);
    }
  }, 900_000);

  it("R2 · ein dritter Prozess auf demselben Bestand: dieselben Kennungen, nichts doppelt", async () => {
    expect(kennungenNachR1.length, "R1 ist nicht gelaufen").toBeGreaterThan(0);
    const dritter = await starte(quellDb, "zweiter Neustart");
    const bericht = await ersterTakt(dritter);
    expect(bericht).toMatchObject({
      zugestellt: 0,
      nachgeholt: 0,
      verpasstGemeldet: 0,
      zusammengefasst: 0,
      uebersprungen: 0,
    });
    expect((await meldungen(quellDb)).map((z) => z.id).sort()).toEqual(kennungenNachR1);
    for (const id of serie.values()) {
      expect((await laeufe(dritter, id)).every((l) => l.versuch === 1)).toBe(true);
    }
    await beende(dritter);
  }, 600_000);

  it("R3 · backup.sh und restore-drill.sh: wiederhergestellt ohne Doppelmeldung, auch „mitten im Lauf“", async () => {
    expect(kennungenNachR1.length, "R1 ist nicht gelaufen").toBeGreaterThan(0);
    const beleg = sichere({
      verbindung: v(),
      datenbank: quellDb,
      ordner: join(arbeitsordner, "r3"),
    });
    expect(beleg.bytes).toBeGreaterThan(0);
    expect(beleg.hash).toMatch(/^[0-9a-f]{64}$/);
    const { status, ausgabe } = fahreDrill({
      verbindung: v(),
      dump: beleg.dump,
      ziel: zielDb,
      port: String(await freierPort()),
      loginEmail: ADMIN.email,
      loginPasswort: PASSWORT,
    });
    expect(status, ausgabe).toBe(0);
    expect(ausgabe).toContain("DRILL BESTANDEN");
    // Mengenaussage des Drills (kein Inhaltsbeleg — den liefert der Vergleich der Kennungen unten).
    const n = kennungenNachR1.length;
    expect(ausgabe).toContain(`klara_erinnerung_meldungen: Dump=${n} Datenbank=${n}`);
    expect(ausgabe).toContain("klara_erinnerungen: Dump=6 Datenbank=6");
    // Der Drill hat seinen eigenen Serverprozess gegen das Ziel gefahren — auch der hat nichts
    // doppelt zugestellt.
    expect((await meldungen(zielDb)).map((z) => z.id).sort()).toEqual(kennungenNachR1);

    // „Sicherung mitten im Lauf“: im wiederhergestellten Ziel fehlen die Laufzeilen der
    // Nachhol-Serie, und ihr Steuerstand steht VOR den vier Terminen — ihre Meldungen sind da.
    const nachholen = serie.get("nachholen") ?? "";
    const pool = new Pool({ connectionString: pgUrl(v(), zielDb) });
    try {
      await pool.query("DELETE FROM klara_erinnerung_laeufe WHERE erinnerung_id = $1", [nachholen]);
      await pool.query(
        `UPDATE klara_erinnerungen SET bearbeitet_bis = $2::timestamptz,
                naechste_faelligkeit = $3::timestamptz WHERE id = $1`,
        [nachholen, new Date(serienBeginn - 3_600_000), new Date(serienBeginn)],
      );
    } finally {
      await pool.end();
    }

    const ziel = await starte(zielDb, "Prozess gegen die wiederhergestellte Datenbank");
    const bericht = await ersterTakt(ziel);
    expect(bericht).toMatchObject({ dedupliziert: 4, nachgeholt: 0, zugestellt: 0 });
    expect((await meldungen(zielDb)).map((z) => z.id).sort()).toEqual(kennungenNachR1);
    const neu = await laeufe(ziel, nachholen);
    expect(neu.map((l) => [l.vorkommenId, l.status, l.ergebnis.dedupliziert]).sort()).toEqual(
      verpassteTermine()
        .map((t) => [`${nachholen}@${t}`, "zugestellt", true])
        .sort(),
    );
    const glocke = await sende(ziel.basis, "GET", "/api/notifications", noraToken);
    expect(glocke.status, glocke.text).toBe(200);
    expect(
      (glocke.json as { id: string; kind: string }[])
        .filter((n) => n.kind === "erinnerung")
        .map((n) => n.id)
        .sort(),
    ).toEqual(kennungenNachR1);
    await beende(ziel);
  }, 1_800_000);

  // ----------------------------------------------------------------------------------------------
  // R4 · EQF-07-K10 (Nacharbeit 9, Ben Befund 5): der Wochenbericht auf dem ECHTEN Serverprozess —
  // einrichten, in Worten ändern, pausieren, nach Stillstand nachholen, Quellausfall (Tabelle
  // während des Betriebs nicht lesbar) mit Handlungsmeldung und Teilbericht, Wiederanlauf mit
  // Fortsetzung im selben Bericht, Absturz nach der Wirkung (Readback), Fortsetzen der Pause.
  // SIMULIERT (wie oben): der Stillstand per SQL-Verschiebung; der Quellausfall per Umbenennen der
  // Tabelle in der Wegwerf-Datenbank; „Absturz nach der Wirkung“ per Entfernen von Laufzeilen und
  // Meldungen. Prozesse, Takte, HTTP-Wege und Datenbank sind echt; Daten fiktiv.
  // ----------------------------------------------------------------------------------------------

  /** Legt den gespeicherten Zeitplan einer Erinnerung auf `am` (nur bei beendetem bzw. ruhendem Takt). */
  async function verschiebe(db: string, id: string, am: number): Promise<void> {
    const k = schluessel(am);
    const pool = new Pool({ connectionString: pgUrl(v(), db) });
    try {
      const r = await pool.query(
        `UPDATE klara_erinnerungen
            SET data = jsonb_set(jsonb_set(data, '{zeitplan,datum}', to_jsonb($2::text)),
                                 '{zeitplan,uhrzeit}', to_jsonb($3::text)),
                bearbeitet_bis = $4::timestamptz,
                naechste_faelligkeit = $5::timestamptz
          WHERE id = $1`,
        [id, k.slice(0, 10), k.slice(11, 16), new Date(am - 3_600_000), new Date(am)],
      );
      expect(r.rowCount).toBe(1);
    } finally {
      await pool.end();
    }
  }

  async function sql<T extends Record<string, unknown>>(
    db: string,
    text: string,
    werte: unknown[] = [],
  ): Promise<T[]> {
    const pool = new Pool({ connectionString: pgUrl(v(), db) });
    try {
      return (await pool.query<T>(text, werte)).rows;
    } finally {
      await pool.end();
    }
  }

  /** Die Berichte eines Termins in klara_notizen — über den festen Vorgangsschlüssel. */
  const berichteVon = (id: string, termin: string) =>
    sql<{ id: string; fassung: number; inhalt: string }>(
      quellDb,
      `SELECT id, fassung, data->>'inhalt' AS inhalt FROM klara_notizen
        WHERE konto_id = $1 AND vorgang = $2`,
      [noraId, ergebnisVorgang(`${id}@${termin}`)],
    );

  /** Wartet auf den NÄCHSTEN Takt dieses Prozesses, der nach `nach` begann. */
  async function naechsterTakt(i: Instanz, nach: string): Promise<Record<string, unknown>> {
    const frist = Date.now() + 240_000;
    while (Date.now() < frist) {
      const r = await sende(i.basis, "GET", `${BASIS}/ueberwachung`, noraToken);
      expect(r.status, r.text).toBe(200);
      const letzter = (r.json as { steuerung: { letzterLauf: Record<string, unknown> | null } })
        .steuerung.letzterLauf;
      if (letzter && String(letzter.beginn) > nach && typeof letzter.ende === "string") {
        return letzter;
      }
      await new Promise((weiter) => setTimeout(weiter, 1_000));
    }
    throw new Error(`${NACHWEIS}: Prozess ${i.pid} hat nach ${nach} keinen weiteren Takt beendet.`);
  }

  interface Sicht {
    id: string;
    status: string;
    fassung: number;
    routine?: { fassung: number; abschnitte: string[] };
    laeufe: (Lauf & {
      ergebnis: Lauf["ergebnis"] & {
        routine?: {
          status: string;
          notizId: string;
          notizFassung: number;
          routineFassung: number;
          offen: { was: string; grund: string }[];
          wiederholt?: boolean;
          fortsetzbar?: boolean;
        };
      };
    })[];
  }
  async function sicht(i: Instanz, id: string): Promise<Sicht> {
    const r = await sende(i.basis, "GET", `${BASIS}/${id}`, noraToken);
    expect(r.status, r.text).toBe(200);
    return (r.json as { erinnerung: Sicht }).erinnerung;
  }
  async function glocke(i: Instanz) {
    const r = await sende(i.basis, "GET", "/api/notifications", noraToken);
    expect(r.status, r.text).toBe(200);
    return (
      r.json as { id: string; kind: string; erinnerungArt?: string; erinnerungGrund?: string }[]
    ).filter((n) => n.kind === "erinnerung");
  }

  it("R4 · Wochenbericht auf dem echten Prozess: einrichten, ändern, pausieren, Ausfall, Fortsetzung, Readback", async () => {
    expect(noraToken, "R1 ist nicht gelaufen").not.toBe("");
    const takt = { KLARWERK_KLARA_ERINNERUNG_TAKT_MS: "60000" };
    // Drei verpasste Montags-/Wochentermine: S, S+7 und S+14 Tage (zwei Stunden her).
    const S = aufMinute(Date.now() - 14 * TAG - 2 * 3_600_000);
    const termine = [0, 7, 14].map((d) => schluessel(S + d * TAG));
    const zukunft = schluessel(S + 21 * TAG); // derselbe Wochentag, in der Zukunft

    // ---- A: einrichten (nichts läuft), in Worten ändern, pausieren ---------------------------
    const a = await starte(quellDb, "R4 Routinen einrichten");
    let fest = "";
    let aufgabeId = "";
    const r4 = { w: "", p: "", ausfall: "", teil: "" };
    try {
      const notiz = await sende(a.basis, "POST", "/api/me/klara/notizen", noraToken, {
        vorgang: `ke-r4-${kennung}-ziel`,
        weg: "geschrieben",
        titel: "Wochenziel Halle 2 (fiktiv)",
        inhalt: "Wochenziel: Filter Presse 4 tauschen (fiktive Prüfdaten).",
        objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "Wochenziel" },
      });
      expect(notiz.status, notiz.text).toBe(201);
      fest = (notiz.json as { notiz: { id: string } }).notiz.id;
      const aufgabe = await sende(a.basis, "POST", "/api/me/klara/aufgaben", noraToken, {
        vorgang: `ke-r4-${kennung}-aufgabe`,
        weg: "notiz",
        quelle: { notizId: fest },
      });
      expect(aufgabe.status, aufgabe.text).toBe(201);
      aufgabeId = (aufgabe.json as { aufgabe: { id: string } }).aufgabe.id;

      const lege = async (name: string, routine: Record<string, unknown>): Promise<string> => {
        const r = await sende(a.basis, "POST", BASIS, noraToken, {
          vorgang: `ke-r4-${kennung}-${name}`,
          titel: `Wochenbericht ${name} (fiktiv)`,
          zeitzone: "UTC",
          verpasst: { regel: "nachholen", grenzeMinuten: 30 },
          zeitplan: {
            art: "serie",
            datum: zukunft.slice(0, 10),
            uhrzeit: zukunft.slice(11, 16),
            wiederholung: { takt: "woechentlich", intervall: 1, anzahl: 6 },
          },
          aktion: "routine_bericht",
          routine,
        });
        expect(r.status, r.text).toBe(201);
        return (r.json as { erinnerung: { id: string } }).erinnerung.id;
      };
      r4.w = await lege("w", { abschnitte: ["offene_aufgaben"], notizIds: [fest] });
      r4.p = await lege("p", { abschnitte: ["offene_aufgaben"] });
      r4.ausfall = await lege("ausfall", { abschnitte: ["offene_aufgaben"] });
      r4.teil = await lege("teil", { abschnitte: ["offene_aufgaben"], notizIds: [fest] });
      // Einrichtung ohne Sofortlauf: kein Lauf, kein Bericht.
      for (const id of Object.values(r4)) {
        expect((await sicht(a, id)).laeufe).toEqual([]);
      }
      const routineNotizen = await sql<{ n: number }>(
        quellDb,
        "SELECT count(*)::int AS n FROM klara_notizen WHERE konto_id = $1 AND vorgang LIKE 'routine-%'",
        [noraId],
      );
      expect(routineNotizen[0]?.n).toBe(0);

      // Ändern in Worten: Abschnitt dazu → Funktionsfassung 2.
      const w = await sicht(a, r4.w);
      const aendern = await sende(a.basis, "POST", `${BASIS}/${r4.w}/routine`, noraToken, {
        fassung: w.fassung,
        text: "nimm die neuen Notizen dazu",
        anwenden: true,
      });
      expect(aendern.status, aendern.text).toBe(200);
      expect(aendern.json).toMatchObject({
        angewendet: true,
        erinnerung: { routine: { fassung: 2, abschnitte: ["offene_aufgaben", "neue_notizen"] } },
      });
      // Pausieren in Worten.
      const p = await sicht(a, r4.p);
      const pause = await sende(a.basis, "POST", `${BASIS}/${r4.p}/routine`, noraToken, {
        fassung: p.fassung,
        text: "pausieren",
        anwenden: true,
      });
      expect(pause.status, pause.text).toBe(200);
      expect((await sicht(a, r4.p)).status).toBe("pausiert");
    } finally {
      await beende(a);
    }

    // ---- Stillstand (simuliert): W und P verpassen drei Termine ------------------------------
    await verschiebe(quellDb, r4.w, S);
    await verschiebe(quellDb, r4.p, S);

    // ---- B: neuer Prozess holt nach; Pause bleibt; dann Quellausfall im laufenden Betrieb -----
    const b = await starteKlarwerk({
      datenbankUrl: pgUrl(v(), quellDb),
      was: "R4 Wiederanlauf mit Minutentakt",
      zusatz: { env: takt },
    });
    instanz = b;
    pids.push(b.pid);
    try {
      await ersterTakt(b);
      const w = await sicht(b, r4.w);
      expect(w.laeufe.map((l) => [l.vorkommenId, l.status]).sort()).toEqual(
        termine.map((t) => [`${r4.w}@${t}`, "zugestellt"]).sort(),
      );
      for (const t of termine) {
        const [bericht, ...mehr] = await berichteVon(r4.w, t);
        expect(mehr).toEqual([]);
        expect(bericht?.inhalt).toContain("Funktionsfassung 2.");
        expect(bericht?.inhalt).toContain(`[aufgabe ${aufgabeId}, Fassung 1]`);
        expect(bericht?.inhalt).toContain(`[notiz ${fest}, Fassung 1]`);
        const lauf = w.laeufe.find((l) => l.vorkommenId === `${r4.w}@${t}`);
        expect(lauf?.ergebnis.routine).toMatchObject({
          status: "erstellt",
          notizId: bericht?.id,
          routineFassung: 2,
        });
        // Die Person öffnet den Bericht über ihren eigenen Notizweg.
        const pfad = `/api/me/klara/notizen/${bericht?.id ?? ""}`;
        const geoeffnet = await sende(b.basis, "GET", pfad, noraToken);
        expect(geoeffnet.status, geoeffnet.text).toBe(200);
      }
      const p = await sicht(b, r4.p);
      expect(p.status).toBe("pausiert");
      expect(p.laeufe).toEqual([]);
      for (const t of termine) {
        expect(await berichteVon(r4.p, t)).toEqual([]);
      }
      expect((await glocke(b)).map((n) => n.id)).toEqual(
        expect.arrayContaining(termine.map((t) => `ke-${r4.w}@${t}`)),
      );

      // Quellausfall WÄHREND des Betriebs: die Aufgabenablage ist nicht lesbar.
      await sql(quellDb, "ALTER TABLE klara_aufgaben RENAME TO klara_aufgaben_r4_ausfall");
      try {
        await verschiebe(quellDb, r4.ausfall, S);
        await verschiebe(quellDb, r4.teil, S);
        await naechsterTakt(b, new Date().toISOString());
        const ausfall = await sicht(b, r4.ausfall);
        expect(ausfall.laeufe.map((l) => [l.status, l.ergebnis.grund]).sort()).toEqual(
          termine.map(() => ["fehlgeschlagen", "quelle_unlesbar"]),
        );
        for (const t of termine) {
          expect(await berichteVon(r4.ausfall, t)).toEqual([]); // kein leerer Erfolgsbericht
        }
        const handlung = (await glocke(b)).filter((n) => n.erinnerungArt === "handlung");
        expect(handlung.map((n) => [n.id, n.erinnerungGrund]).sort()).toEqual(
          termine.map((t) => [`ke-handlung-${r4.ausfall}@${t}`, "quelle_unlesbar"]).sort(),
        );
        const teil = await sicht(b, r4.teil);
        for (const t of termine) {
          const [bericht] = await berichteVon(r4.teil, t);
          expect(bericht?.fassung).toBe(1);
          expect(bericht?.inhalt).toContain("## Noch offen");
          expect(bericht?.inhalt).toContain(`[notiz ${fest}, Fassung 1]`);
          expect(teil.laeufe.find((l) => l.vorkommenId === `${r4.teil}@${t}`)).toMatchObject({
            status: "teilweise",
            ergebnis: { routine: { status: "teilweise", fortsetzbar: true } },
          });
        }
      } finally {
        await sql(quellDb, "ALTER TABLE klara_aufgaben_r4_ausfall RENAME TO klara_aufgaben");
      }

      // Ablage wieder da: der nächste Takt setzt fort — gescheiterte Läufe legen ihren Bericht an,
      // Teilberichte werden IM SELBEN Bericht vervollständigt, Handlungsmeldungen nicht verdoppelt.
      await naechsterTakt(b, new Date().toISOString());
      const ausfall = await sicht(b, r4.ausfall);
      expect(ausfall.laeufe.every((l) => l.status === "zugestellt")).toBe(true);
      for (const t of termine) {
        const [bericht, ...mehr] = await berichteVon(r4.ausfall, t);
        expect(mehr).toEqual([]);
        expect(bericht?.inhalt).toContain(`[aufgabe ${aufgabeId}, Fassung 1]`);
      }
      const teil = await sicht(b, r4.teil);
      for (const t of termine) {
        const [bericht, ...mehr] = await berichteVon(r4.teil, t);
        expect(mehr).toEqual([]);
        expect(bericht?.fassung).toBe(2);
        expect(bericht?.inhalt).not.toContain("## Noch offen");
        expect(bericht?.inhalt).toContain(`[aufgabe ${aufgabeId}, Fassung 1]`);
        expect(teil.laeufe.find((l) => l.vorkommenId === `${r4.teil}@${t}`)).toMatchObject({
          status: "zugestellt",
          ergebnis: { routine: { status: "erstellt", notizId: bericht?.id, notizFassung: 2 } },
        });
      }
      expect((await glocke(b)).filter((n) => n.erinnerungArt === "handlung")).toHaveLength(3);
    } finally {
      await beende(b);
    }

    // ---- Absturz nach der Wirkung, vor der Bestätigung (simuliert): Läufe und Meldungen von W
    //      fehlen, die Berichte sind da. Ein neuer Prozess liest zurück und schreibt keinen zweiten.
    await sql(quellDb, "DELETE FROM klara_erinnerung_laeufe WHERE erinnerung_id = $1", [r4.w]);
    await sql(quellDb, "DELETE FROM klara_erinnerung_meldungen WHERE erinnerung_id = $1", [r4.w]);
    await sql(
      quellDb,
      `UPDATE klara_erinnerungen SET bearbeitet_bis = $2::timestamptz,
              naechste_faelligkeit = $3::timestamptz WHERE id = $1`,
      [r4.w, new Date(S - 3_600_000), new Date(S)],
    );
    const c = await starte(quellDb, "R4 Wiederanlauf nach Absturz");
    try {
      await ersterTakt(c);
      const w = await sicht(c, r4.w);
      expect(w.laeufe.map((l) => [l.status, l.ergebnis.routine?.wiederholt]).sort()).toEqual(
        termine.map(() => ["zugestellt", true]),
      );
      for (const t of termine) {
        expect(await berichteVon(r4.w, t)).toHaveLength(1);
      }
      // Die Pause übersteht jeden Neustart — erst die Person setzt fort (nur KOMMENDE Termine).
      const p = await sicht(c, r4.p);
      expect(p.status).toBe("pausiert");
      const weiter = await sende(c.basis, "POST", `${BASIS}/${r4.p}/routine`, noraToken, {
        fassung: p.fassung,
        text: "fortsetzen",
        anwenden: true,
      });
      expect(weiter.status, weiter.text).toBe(200);
      expect((await sicht(c, r4.p)).status).toBe("aktiv");
    } finally {
      await beende(c);
    }
    process.stderr.write(
      `${NACHWEIS} R4 BELEGE: Routinen=${Object.values(r4).join(",")} Termine=${termine.join(",")}\n`,
    );
  }, 1_200_000);
  it("F1 · echter Wiederanlauf startet weder Modell noch Routine, auch nach Freigabe erst beim regulären Neustart", async () => {
    expect(noraToken).not.toBe("");
    const vor = await starte(quellDb, "F1 vorbereiten");
    const ids: string[] = [];
    const morgen = new Date(Date.now() + TAG).toISOString().slice(0, 10);
    try {
      const n = await sende(vor.basis, "POST", "/api/me/klara/notizen", noraToken, {
        vorgang: `f1-notiz-${kennung}`,
        weg: "geschrieben",
        titel: "F1 private Testquelle",
        inhalt: "Nur fiktiver Inhalt.",
        objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "F1" },
      });
      expect(n.status, n.text).toBe(201);
      const notizId = (n.json as { notiz: { id: string } }).notiz.id;
      for (const aktion of ["inhalt_zusammenfassen", "routine_bericht"]) {
        const r = await sende(vor.basis, "POST", BASIS, noraToken, {
          vorgang: `f1-${aktion}-${kennung}`,
          titel: `F1 ${aktion}`,
          zeitzone: "UTC",
          zeitplan: { art: "einmalig", datum: morgen, uhrzeit: "09:00" },
          aktion,
          ...(aktion === "inhalt_zusammenfassen"
            ? { bezug: { art: "notiz", notizId } }
            : { routine: { abschnitte: ["offene_aufgaben"], notizIds: [notizId] } }),
        });
        expect(r.status, r.text).toBe(201);
        ids.push((r.json as { erinnerung: { id: string } }).erinnerung.id);
      }
    } finally {
      await beende(vor);
    }
    const faellig = aufMinute(Date.now() - 120_000);
    const k = schluessel(faellig);
    for (const id of ids)
      await sql(
        quellDb,
        `UPDATE klara_erinnerungen SET data = jsonb_set(jsonb_set(data, '{zeitplan,datum}', to_jsonb($2::text)), '{zeitplan,uhrzeit}', to_jsonb($3::text)), bearbeitet_bis = $4::timestamptz, naechste_faelligkeit = $5::timestamptz WHERE id = $1`,
        [id, k.slice(0, 10), k.slice(11, 16), new Date(faellig - 3_600_000), new Date(faellig)],
      );
    const probe = join(arbeitsordner, "F1-modellaufrufe.txt");
    const probeEnv = { KLARWERK_TEST_ERINNERUNG_MODELL_BELEG: probe };
    const importPfad = join(process.cwd(), "tests/klara-erinnerungen/modell-probe.ts");
    const r = await starteKlarwerk({
      datenbankUrl: pgUrl(v(), quellDb),
      was: "F1 gesperrter Wiederanlauf",
      zusatz: {
        importe: [importPfad],
        env: {
          ...probeEnv,
          KLARWERK_WIEDERANLAUF: `d-f1-${kennung}`,
          KLARWERK_WIEDERANLAUF_SICHERUNG: new Date(faellig).toISOString(),
        },
      },
    });
    instanz = r;
    pids.push(r.pid);
    try {
      const ohneWirkung = async () => {
        const m = await sende(r.basis, "GET", `${BASIS}/ueberwachung`, adminToken);
        expect(m.status, m.text).toBe(200);
        expect(
          (m.json as { steuerung: { letzterLauf: unknown } }).steuerung.letzterLauf,
        ).toBeNull();
        expect(existsSync(probe)).toBe(false);
        expect(
          (
            await sql<{ n: number }>(
              quellDb,
              "SELECT count(*)::int AS n FROM klara_erinnerung_laeufe WHERE erinnerung_id = ANY($1)",
              [ids],
            )
          )[0]?.n,
        ).toBe(0);
      };
      await ohneWirkung();
      // Eine echte weitere Taktgrenze, keine vorgetäuschte Uhr.
      await new Promise((fertig) => setTimeout(fertig, 65_000));
      await ohneWirkung();
      const frei = await sende(r.basis, "POST", "/api/admin/wiederanlauf/freigabe", adminToken, {
        integritaet: true,
        rechteentzuege: true,
        loeschmarkierungen: true,
        aussenaktionen: true,
      });
      expect(frei.status, frei.text).toBe(200);
      await ohneWirkung();
    } finally {
      await beende(r);
    }
    const normal = await starteKlarwerk({
      datenbankUrl: pgUrl(v(), quellDb),
      was: "F1 regulär freigegebener Neustart",
      zusatz: { importe: [importPfad], env: probeEnv },
    });
    instanz = normal;
    pids.push(normal.pid);
    try {
      await ersterTakt(normal);
      expect(readFileSync(probe, "utf8").trim()).toBe("assistText");
      const summary = await sicht(normal, ids[0]!);
      expect(summary.laeufe[0]).toMatchObject({
        status: "zugestellt",
        ergebnis: { zusammenfassung: { status: "erstellt" } },
      });
      const routine = await sicht(normal, ids[1]!);
      expect(routine.laeufe[0]).toMatchObject({
        status: "zugestellt",
        ergebnis: { routine: { status: "erstellt" } },
      });
    } finally {
      await beende(normal);
    }
  }, 300_000);
});
