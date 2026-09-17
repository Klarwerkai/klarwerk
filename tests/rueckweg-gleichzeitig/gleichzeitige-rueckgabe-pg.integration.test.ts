// ================================================================================================
// JOB 4325 · ZWEI RÜCKGABEN IM SELBEN AUGENBLICK — GEMESSEN GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// DIE KETTE, die diese Datei misst und die sonst nirgends unter GLEICHZEITIGKEIT gemessen ist:
//
//     zwei Konten → zwei echte Sockets → zwei Dienstinstanzen (zwei Prozess-Locks) →
//     Compare-and-Set in PostgreSQL (`repo-pg.ts:424-445`) → `ko_versions` → `audit`
//
// JOB 4299 hat den Konflikt gegen dieselbe Ablage gemessen, aber NACHEINANDER
// (`tests/office-pg-abnahme/rueckweg-pg.integration.test.ts:532,539`: zwei `await`). Der Prüfer zu
// 4299 R2 sagt zum Parallelfall wörtlich: „Der berichtete parallele Tabellenkonflikt trat in meinem
// Lauf nicht auf; dessen dauerhafte Abwesenheit ist damit nicht bewiesen." Genau diese Lücke — und
// die von JOB 3667 R9 benannte („PostgreSQL-Parallelzugriffe … bleiben offen") — steht hier.
//
// WAS HIER NICHT BEHAUPTET WIRD: irgendetwas Sichtbares. Die Nutzenkette endet am HTTP-Körper
// (REGELN.md Abschnitt 9). Kein Browser, keine Fläche, kein Word-Host.
//
// WAS GEMESSEN WIRD UND WAS NICHT GERATEN WIRD: jede Runde SAMMELT ihre Mängel, statt beim ersten
// Fehlschlag abzubrechen; geurteilt wird über alle Wiederholungen zusammen. Eine Abnahme, die in
// Lauf 1 stirbt, sagt über die übrigen 19 nichts — und die VERTEILUNG über viele Läufe ist hier der
// Gegenstand (Lehre 4151/4203: „Ein zufällig grünes `Promise.all` genügt nicht als
// Parallelitätsnachweis."). Zusätzlich belegt jede Runde ihre Überlappung mit zwei Zeitmarken je
// Aufruf, statt sie aus der Schreibweise zu folgern.
//
// FINDET DIE MESSUNG EINEN PRODUKTFEHLER, BLEIBT ER ROT (Auftrag §4/§5.5): kein Umbau, kein
// Abschwächen der Erwartung. Die Meldung nennt Datei und Zeile (`deuteVerlierer` in `strecke.ts`).
//
// STARTBAR, ohne dass eine Zeile geändert werden muss:
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts tests/rueckweg-gleichzeitig
//
// Der Datenbankname MUSS `test` enthalten (`services/db-tx/src/pg-test-guard.ts`); diese Datei legt
// darüber hinaus eine EIGENE Wegwerf-Datenbank an und räumt sie am Ende ab.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  erwarteFassung,
  erwarteKeineFassung,
  pruefeBelegvollstaendigkeit,
  pruefeKette,
  verwaisteVorschlagsbelege,
} from "./kette";
import {
  type Antwort,
  EINREICHER_A,
  EINREICHER_B,
  ENTSCHEIDER,
  type Fallbefund,
  type Instanz,
  JOB,
  type Kontenbuch,
  type Kopf,
  MERKMAL_B,
  RUECKGEBER_A,
  RUECKGEBER_B,
  RUMPF_A,
  RUMPF_B,
  RUMPF_BESTAND,
  type Runde,
  STATEMENT_A,
  STATEMENT_B,
  alsFehler,
  anmeldung,
  auditBestand,
  datenbankZaehler,
  deuteVerlierer,
  entscheide,
  fasseZusammen,
  fassungen,
  gewinnerAus,
  legeObjektAn,
  mitDatenbank,
  mitServerzeilen,
  nachNeuerVerbindung,
  neueServerzeilen,
  ohneGeheimnis,
  pgVersion,
  pruefeSchnappschuss,
  reicheEin,
  rennenUmDieFassung,
  richteKontenEin,
  starteInstanz,
  ueberlappt,
  vorschlagsKennung,
} from "./strecke";

/** ≥ 20 laut Auftrag §5.3 — gegen Sporadik, und damit die Gewinnerverteilung etwas aussagt. */
const WIEDERHOLUNGEN = 20;

/** GELAUFEN mit Quelle oder ÜBERSPRUNGEN mit Grund — `undefined` heißt: `beforeAll` lief nicht. */
type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

describe("JOB 4325 · der Rückweg unter echter Gleichzeitigkeit", () => {
  /** Die BLANKE Verbindung auf die angebotene Instanz — sie legt die Wegwerf-Datenbank an. */
  let verwaltung: Pool | undefined;
  /** Der eigene Lesepool auf die Wegwerf-Datenbank — er gehört KEINER der beiden Instanzen. */
  let lese: Pool | undefined;
  let instanzA: Instanz | undefined;
  let instanzB: Instanz | undefined;
  let eigeneUrl = "";
  let verfuegbar = false;
  let laufzustand: Laufzustand | undefined;
  let gemeldet = false;
  let postgres = "(nicht gelesen)";
  let kopfEntscheider: Kopf = {};
  let kopfRueckgeberA: Kopf = {};
  let kopfRueckgeberB: Kopf = {};
  let kopfEinreicherA: Kopf = {};
  let kopfEinreicherB: Kopf = {};
  /** Die Nutzerkennungen — der vom Protokoll UNABHÄNGIGE Bezugspunkt jedes Akteurvergleichs. */
  let konten: Kontenbuch | undefined;
  /** Die Protokollzeile des Auftrags (§1/§5.6) wächst mit jedem Fall und wird am Ende gemeldet. */
  const protokoll: string[] = [];
  let kettenspanne = "(nicht gemessen)";

  const datenbank = `klarwerk_gleichzeitig_test_${`${Date.now()}`.slice(-9)}`;

  function meldeLaufzustand(): void {
    if (gemeldet) {
      return;
    }
    gemeldet = true;
    const z = laufzustand;
    if (!z) {
      process.stderr.write(
        `${JOB} Gleichzeitigkeits-Abnahme: KEIN LAUFZUSTAND — beforeAll lief nicht durch.\n`,
      );
    } else if (z.gelaufen) {
      process.stderr.write(`${JOB} Gleichzeitigkeits-Abnahme GELAUFEN gegen ${z.quelle}.\n`);
    } else {
      process.stderr.write(
        `${JOB} Gleichzeitigkeits-Abnahme ÜBERSPRUNGEN — Grund: ${z.grund}. Die Fälle (a)–(d) wurden NICHT geprüft.\n`,
      );
    }
  }

  beforeAll(async () => {
    // `guardedLocalPgTestUrl` ALS ERSTES (Auftrag §5.1): ohne gesicherte Testdatenbank wird nichts
    // angelegt und nichts angefasst. KEIN Container-Rückfall — wer eine Instanz angeboten hat, die
    // die Sicherung ablehnt, bekommt keine stille zweite.
    const lokal = guardedLocalPgTestUrl();
    if (!lokal) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: keine gesicherte KLARWERK_PG_TEST_URL — die Gleichzeitigkeit des Rückwegs ist ohne echte Datenbank nicht messbar.\n`,
      );
      laufzustand = { gelaufen: false, grund: "keine gesicherte KLARWERK_PG_TEST_URL" };
      meldeLaufzustand();
      return;
    }
    verwaltung = new Pool({ connectionString: lokal, max: 2 });
    try {
      await verwaltung.query("SELECT 1");
    } catch (fehler) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich — ${String(fehler)}\n`,
      );
      laufzustand = {
        gelaufen: false,
        grund: "KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich",
      };
      await verwaltung.end().catch(() => undefined);
      verwaltung = undefined;
      meldeLaufzustand();
      return;
    }
    postgres = await pgVersion(verwaltung);
    // ── DIE EIGENE WEGWERF-DATENBANK (Lehre JOB 4321 R1). ────────────────────────────────────────
    // Sie ist der Grund, warum der `CREATE EXTENSION`-Wettlauf hier gar nicht entstehen kann:
    // Erweiterungen sind je DATENBANK, und in dieser gibt es genau EINEN Anleger — das `migrate()`
    // unten, einmal, auf EINEM Pool, VOR jeder Instanz und vor jeder Gleichzeitigkeit.
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    eigeneUrl = mitDatenbank(lokal, datenbank);
    const migration = new Pool({ connectionString: eigeneUrl, max: 1 });
    try {
      await migrate(migration);
    } finally {
      await migration.end();
    }
    lese = new Pool({ connectionString: eigeneUrl, max: 2 });
    instanzA = await starteInstanz("A", eigeneUrl);
    instanzB = await starteInstanz("B", eigeneUrl);
    // Die Konten entstehen an EINER Instanz und gelten an BEIDEN — sie stehen in der Datenbank,
    // nicht im Prozessgedächtnis. Genau das belegen die Anmeldungen über beide Sockets unten.
    konten = await richteKontenEin(instanzA.basis);
    kopfEntscheider = await anmeldung(instanzA.basis, ENTSCHEIDER);
    kopfRueckgeberA = await anmeldung(instanzA.basis, RUECKGEBER_A);
    kopfRueckgeberB = await anmeldung(instanzB.basis, RUECKGEBER_B);
    kopfEinreicherA = await anmeldung(instanzA.basis, EINREICHER_A);
    kopfEinreicherB = await anmeldung(instanzB.basis, EINREICHER_B);
    verfuegbar = true;
    laufzustand = {
      gelaufen: true,
      quelle: `${ohneGeheimnis(eigeneUrl)} · ${postgres} · Sockets A=${instanzA.port} B=${instanzB.port}`,
    };
    meldeLaufzustand();
  }, 600_000);

  afterAll(async () => {
    await instanzA?.schliessen().catch(() => undefined);
    await instanzB?.schliessen().catch(() => undefined);
    await lese?.end().catch(() => undefined);
    if (verwaltung) {
      // WITH (FORCE): offene Verbindungen einer abgebrochenen Runde dürfen das Abräumen nicht halten.
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end().catch(() => undefined);
    }
    if (protokoll.length > 0) {
      process.stderr.write(
        `${JOB} PROTOKOLL · ${postgres} · Sockets A=${instanzA?.port ?? "-"} B=${instanzB?.port ?? "-"} · ${protokoll.join(" · ")} · Audit-Kette ${kettenspanne}\n`,
      );
    }
  }, 300_000);

  // ----------------------------------------------------------------------------------------------
  // DER ZEUGE — er ruft NIE `ctx.skip()` und macht in JEDEM Lauf eine Aussage.
  // ----------------------------------------------------------------------------------------------
  // Er färbt eine Maschine ohne Datenbank NICHT rot: beide Zustände sind erlaubt. Verlangt ist nur,
  // dass der Lauf sagt, welcher vorliegt — und dass die Behauptung zur Wirklichkeit passt.
  it("Z · der Lauf bezeugt seinen eigenen Zustand — übersprungen ist von gelaufen unterscheidbar", async () => {
    meldeLaufzustand();
    expect(
      laufzustand,
      "beforeAll hat keinen Laufzustand hinterlassen — ein Lauf ohne Zustandsaussage sieht aus wie ein bestandener.",
    ).toBeDefined();
    const zustand = laufzustand as Laufzustand;
    if (zustand.gelaufen) {
      expect(verfuegbar).toBe(true);
      expect(lese, "GELAUFEN ohne eigenen Lesepool wäre eine leere Behauptung").toBeDefined();
      await expect(
        (lese as Pool).query("SELECT count(*)::int AS n FROM kos"),
      ).resolves.toBeDefined();
      // ZWEI Instanzen, ZWEI verschiedene Ports — sonst wäre „zwei Sockets" eine Formulierung.
      expect(instanzA?.port).toBeGreaterThan(0);
      expect(instanzB?.port).toBeGreaterThan(0);
      expect(instanzA?.port).not.toBe(instanzB?.port);
      // Und beide horchen wirklich: eine Anmeldung über JEDEN der beiden Sockets gelingt.
      await expect(anmeldung((instanzA as Instanz).basis, ENTSCHEIDER)).resolves.toBeDefined();
      await expect(anmeldung((instanzB as Instanz).basis, ENTSCHEIDER)).resolves.toBeDefined();
    } else {
      expect(verfuegbar).toBe(false);
      expect(
        zustand.grund.trim().length,
        "ÜBERSPRUNGEN ohne Grund ist wieder der stumme Lauf",
      ).toBeGreaterThan(0);
    }
  }, 120_000);

  /** Die Kette nach jedem Fall: lückenlos, richtig verkettet, jeder Hash nachgerechnet. */
  async function ketteIstGanz(bezeichnung: string): Promise<void> {
    const bestand = await auditBestand(lese as Pool);
    const befund = pruefeKette(bestand);
    kettenspanne = `nach ${bezeichnung}: seq ${String(befund.von)}–${String(befund.bis)} (${befund.anzahl} Belege, ${befund.maengel.length} Mängel)`;
    process.stderr.write(`${JOB} Audit-Kette ${kettenspanne}\n`);
    expect(
      befund.maengel,
      `${bezeichnung}: die Audit-Hashkette ist nach dem Fall nicht mehr ganz (services/audit/src/service.ts:32-52).`,
    ).toEqual([]);
  }

  /**
   * Die Zusammenfassung eines Falles — auf stderr, BEVOR irgendein `expect` läuft.
   *
   * Der Grund steht in Runde 1 dieses Auftrags: dort lag das `expect` auf den Mängeln vor allen
   * anderen, und als es fiel, wurde die Audit-Kette nie gemessen — „nicht gemessen" sah aus wie
   * „nicht nötig". Was gemessen wurde, wird deshalb GEMELDET; welches `expect` danach zuerst fällt,
   * ändert an der Messung nichts mehr.
   */
  function melde(fall: string, befund: Fallbefund, weitere: readonly string[] = []): void {
    const v = befund.verteilung;
    protokoll.push(
      `${fall}: ${befund.runden.length}× (Überlappung ${befund.ueberlappungen}/${befund.runden.length}, A ${v.A} · B ${v.B} · beide ${v.beide} · keiner ${v.keiner}, Mängel ${befund.maengel.length})`,
    );
    process.stderr.write(`${JOB} ${fall} · ${protokoll[protokoll.length - 1]}\n`);
    for (const zeile of [...befund.maengel, ...weitere]) {
      process.stderr.write(`${JOB} ${fall} MANGEL · ${zeile}\n`);
    }
  }

  // ==============================================================================================
  // FALL (a) — RÜCKGABE GEGEN RÜCKGABE, ÜBER ZWEI INSTANZEN UND ZWEI SOCKETS.
  // ==============================================================================================
  //
  // Die beiden teilen den Prozess-Lock NICHT. Wer gewinnt, entscheidet damit der bedingte UPDATE in
  // PostgreSQL — dieselbe Stelle, die zwischen zwei echten Prozessen entscheidet.
  it("F-a · zwei Rückgaben über ZWEI Instanzen: genau eine gewinnt, die zweite bekommt 409 KO_STALE mit der jetzt gültigen Fassung", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const befund = await rennenUmDieFassung({
      lese: lese as Pool,
      url: eigeneUrl,
      a: instanzA as Instanz,
      b: instanzB as Instanz,
      kopfA: kopfRueckgeberA,
      kopfB: kopfRueckgeberB,
      akteurA: (konten as Kontenbuch).kennung(RUECKGEBER_A),
      akteurB: (konten as Kontenbuch).kennung(RUECKGEBER_B),
      praefix: "ko-4325-a",
      wiederholungen: WIEDERHOLUNGEN,
      bedingt: true,
      erwarteteKonfliktVersion: 2,
    });
    melde("(a) zwei Instanzen", befund);
    // DIE KETTE ZUERST, und das ist Absicht: sie wird in JEDEM Lauf gemessen, auch wenn der Fall
    // gleich darunter an einem Produktbefund rot wird. Runde 1 dieses Auftrags stand ohne
    // Kettenaussage da, weil alle vier Fälle vorher scheiterten — „nicht gemessen" sah aus wie
    // „nicht nötig".
    await ketteIstGanz("Fall (a)");
    expect(
      befund.ueberlappungen,
      "nicht jede Runde hat wirklich überlappt — ohne Überlappung belegt sie keine Gleichzeitigkeit.",
    ).toBe(WIEDERHOLUNGEN);
    expect(befund.maengel, "Fall (a): gemessene Abweichungen").toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // FALL (d) — EINE INSTANZ, ZWEI SITZUNGEN: DER PROZESS-LOCK-WEG AUS 3667, GEGEN POSTGRESQL.
  // ==============================================================================================
  //
  // Hier serialisiert `withKoLock`, und `pruefeErwarteteVersion` sieht die schon geschriebene
  // Fassung 2. Er steht VOR (b) und (c), weil er die Gegenprobe zu (a) ist: wäre auch er rot, läge
  // der Befund nicht an der fehlenden prozessübergreifenden Übersetzung, sondern tiefer.
  it("F-d · zwei Rückgaben über EINE Instanz: genau eine gewinnt, die zweite bekommt 409 KO_STALE mit currentVersion 2", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const befund = await rennenUmDieFassung({
      lese: lese as Pool,
      url: eigeneUrl,
      a: instanzA as Instanz,
      b: instanzA as Instanz,
      kopfA: kopfRueckgeberA,
      kopfB: kopfRueckgeberB,
      akteurA: (konten as Kontenbuch).kennung(RUECKGEBER_A),
      akteurB: (konten as Kontenbuch).kennung(RUECKGEBER_B),
      praefix: "ko-4325-d",
      wiederholungen: WIEDERHOLUNGEN,
      bedingt: true,
      erwarteteKonfliktVersion: 2,
    });
    melde("(d) eine Instanz", befund);
    await ketteIstGanz("Fall (d)");
    expect(
      befund.ueberlappungen,
      "nicht jede Runde hat wirklich überlappt — ohne Überlappung belegt sie keine Gleichzeitigkeit.",
    ).toBe(WIEDERHOLUNGEN);
    expect(befund.maengel, "Fall (d): gemessene Abweichungen").toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // FALL (b) — EINREICHEN GEGEN ENTSCHEIDEN.
  // ==============================================================================================
  //
  // Die zwei Wege sind BAULICH verschieden: `decideProposal` läuft über `mutateKoTx` (eine
  // Transaktion, Audit INNEN, `service.ts:821-869`), `addProposal` über `mutateKo` (Audit ZUERST,
  // dann der Write, OHNE Transaktion, `service.ts:766-780`). Deshalb prüft dieser Fall zwei Dinge
  // zugleich: dass keine der beiden Antworten lügt — und dass kein Beleg für einen Vorschlag
  // stehenbleibt, den es nie gab.
  it("F-b · einreichen gegen entscheiden: jede Antwort ist entweder wirksam oder ein benannter Konflikt — kein 400, kein 500, keine 2xx ohne Wirkung", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const runden: Runde[] = [];
    const verwaisteBelege: string[] = [];
    for (let lauf = 1; lauf <= WIEDERHOLUNGEN; lauf += 1) {
      const koId = `ko-4325-b-${lauf}`;
      await legeObjektAn(lese as Pool, koId, RUMPF_BESTAND);
      // VORBEREITUNG (nacheinander, das ist nicht der Messgegenstand): B reicht ein.
      const vorbereitet = await reicheEin((instanzB as Instanz).basis, kopfEinreicherB, koId, {
        statement: STATEMENT_B,
        bodyHtml: RUMPF_B,
        baseVersion: 1,
      });
      if (vorbereitet.status !== 200) {
        throw new Error(
          `${JOB} F-b Lauf ${lauf}: Vorbereitung misslang — ${deuteVerlierer(vorbereitet)}`,
        );
      }
      const vorschlagB = vorschlagsKennung(vorbereitet, STATEMENT_B);
      if (vorschlagB === undefined) {
        throw new Error(
          `${JOB} F-b Lauf ${lauf}: die Route gibt den vorbereiteten Vorschlag nicht zurück.`,
        );
      }
      // DER AUGENBLICK: der Entscheider übernimmt über A, während A über B neu einreicht.
      const logstaende = [
        (instanzA as Instanz).protokoll.length,
        (instanzB as Instanz).protokoll.length,
      ];
      const zaehlerVor = await datenbankZaehler(lese as Pool);
      const [entscheidung, einreichung] = await Promise.all([
        entscheide((instanzA as Instanz).basis, kopfEntscheider, koId, vorschlagB, 1),
        reicheEin((instanzB as Instanz).basis, kopfEinreicherA, koId, {
          statement: STATEMENT_A,
          bodyHtml: RUMPF_A,
          baseVersion: 1,
        }),
      ]);
      const zaehlerNach = await datenbankZaehler(lese as Pool);
      const serverzeilen = [
        ...neueServerzeilen([instanzA as Instanz, instanzB as Instanz], logstaende),
        `pg_stat_database in dieser Runde: deadlocks +${zaehlerNach.deadlocks - zaehlerVor.deadlocks}, xact_rollback +${zaehlerNach.rollbacks - zaehlerVor.rollbacks}`,
      ];
      const maengel: string[] = [];
      const gespeichert = await nachNeuerVerbindung(eigeneUrl, koId);
      const vorschlaege = gespeichert?.proposals ?? [];

      const pruefeAntwort = (
        was: string,
        antwort: Antwort,
        wirkung: () => string | undefined,
      ): void => {
        if (antwort.status >= 200 && antwort.status < 300) {
          const fehlt = wirkung();
          if (fehlt !== undefined) {
            maengel.push(
              `${was} wurde mit ${antwort.status} quittiert, hat aber keine Wirkung: ${fehlt}`,
            );
          }
          return;
        }
        if (antwort.status === 409) {
          const fehler = alsFehler(antwort);
          if ((fehler.error ?? "").trim().length === 0) {
            maengel.push(`${was}: 409 ohne Fehlernamen — ${antwort.text}`);
          }
          if ((fehler.message ?? "").trim().length === 0) {
            maengel.push(`${was}: 409 ohne Satz — eine Absage ohne Auskunft.`);
          }
          return;
        }
        const satz = `${was} antwortet ${deuteVerlierer(antwort)} — erwartet war 2xx mit Wirkung oder 409 mit Code und Satz.`;
        // Ein 500 ist nach aussen maskiert; seine Ursache steht NUR im Serverprotokoll. Sie wird
        // zitiert und nicht erraten (die Logsenke hängt in `starteInstanz`).
        maengel.push(antwort.status >= 500 ? mitServerzeilen(satz, serverzeilen) : satz);
      };

      pruefeAntwort("die Entscheidung", entscheidung, () => {
        const uebernommen = vorschlaege.find((p) => p.id === vorschlagB);
        if (uebernommen?.status !== "uebernommen") {
          return `Vorschlag B steht im gespeicherten Objekt als „${String(uebernommen?.status)}".`;
        }
        if ((gespeichert?.bodyHtml ?? "").includes(MERKMAL_B) === false) {
          return "das Merkmal von Vorschlag B steht nicht im gespeicherten Fließtext.";
        }
        if (gespeichert?.version !== 2) {
          return `gespeichert ist Version ${String(gespeichert?.version)}, erwartet 2.`;
        }
        return undefined;
      });
      pruefeAntwort("die Einreichung", einreichung, () => {
        const kennung = vorschlagsKennung(einreichung, STATEMENT_A);
        if (kennung === undefined) {
          return "die Antwort nennt den angenommenen Vorschlag nicht.";
        }
        return vorschlaege.some((p) => p.id === kennung)
          ? undefined
          : `der mit ${einreichung.status} quittierte Vorschlag ${kennung} steht nicht im gespeicherten Objekt — er ist still verloren gegangen.`;
      });

      if ((gespeichert?.version ?? 0) > 2) {
        maengel.push(
          `gespeichert ist Version ${String(gespeichert?.version)} — mehr als eine Fassung ist entstanden.`,
        );
      }
      // ── DIE ÜBERNAHME IST WIRKSAM GEWORDEN ODER NICHT — UND GENAU DAS MUSS BELEGT SEIN. ────────
      //
      // Bezugspunkt ist wieder der zurückgelesene Zustand: ist Fassung 2 entstanden, gehört das
      // Belegpaar dazu; ist sie es nicht, darf KEIN Beleg dastehen. Runde 1 prüfte hier gar nichts.
      //
      // DIE ZWEI AKTEURE SIND HIER VERSCHIEDEN, und das ist die Aussage des Protokolls: den Text hat
      // EINREICHER B geschrieben (`service.ts:4741`, `actor: vorschlag.author`), freigegeben hat ihn
      // der ENTSCHEIDER (`:4751`). Ein Protokoll, das beides derselben Person zuschriebe, verfehlte
      // genau die Vier-Augen-Regel, die dieser Weg durchsetzt.
      const uebernahmeWirksam = gespeichert?.version === 2;
      maengel.push(
        ...pruefeBelegvollstaendigkeit(
          await auditBestand(lese as Pool),
          uebernahmeWirksam
            ? erwarteFassung(
                koId,
                2,
                (konten as Kontenbuch).kennung(EINREICHER_B),
                (konten as Kontenbuch).kennung(ENTSCHEIDER),
              )
            : erwarteKeineFassung(koId),
        ),
      );
      // Und der Schnappschuss — in Runde 1 in diesem Fall überhaupt nicht geprüft (Prüferbefund 6).
      maengel.push(
        ...(uebernahmeWirksam
          ? await pruefeSchnappschuss(lese as Pool, koId, 2, gespeichert?.bodyHtml ?? null)
          : (await fassungen(lese as Pool, koId)).map(
              (z) =>
                `ko_versions trägt eine Zeile für Fassung ${z.version}, obwohl keine Fassung entstanden ist.`,
            )),
      );
      // DER VERWAISTE BELEG: jeder `ko.proposed` braucht seinen Vorschlag im Objekt.
      const bestand = await auditBestand(lese as Pool);
      verwaisteBelege.push(
        ...verwaisteVorschlagsbelege(
          bestand,
          koId,
          vorschlaege.map((p) => p.id),
        ),
      );
      runden.push({
        lauf,
        koId,
        ueberlappt: ueberlappt(entscheidung, einreichung),
        status: [entscheidung.status, einreichung.status],
        gewinner: gewinnerAus(entscheidung, einreichung),
        maengel,
      });
    }
    const befund = fasseZusammen(runden);
    melde(
      "(b) einreichen/entscheiden",
      befund,
      verwaisteBelege.map((z) => `VERWAISTER BELEG — ${z}`),
    );
    await ketteIstGanz("Fall (b)");
    expect(
      befund.ueberlappungen,
      "nicht jede Runde hat wirklich überlappt — ohne Überlappung belegt sie keine Gleichzeitigkeit.",
    ).toBe(WIEDERHOLUNGEN);
    expect(
      verwaisteBelege,
      "verwaiste ko.proposed-Belege — Audit VOR dem Write, ohne Transaktion (services/knowledge-object/src/service.ts:766-780).",
    ).toEqual([]);
    // `beide` ist hier KEIN Mangel: Einreichen und Entscheiden dürfen beide wirken.
    expect(befund.maengel, "Fall (b): gemessene Abweichungen").toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // FALL (c) — ZWEIMAL DIESELBE ENTSCHEIDUNG, ÜBER ZWEI INSTANZEN.
  // ==============================================================================================
  //
  // Derselbe Entscheider, derselbe Vorschlag, derselbe erwartete Stand. Aus zwei Übernahmen darf
  // keine dritte Fassung werden — die zweite ist entweder ein überholter Stand (`KO_STALE`) oder ein
  // schon entschiedener Vorschlag (`PROPOSAL_DECIDED`).
  it("F-c · zwei Entscheidungen auf denselben Vorschlag: genau eine 200, die andere 409 — Version 2 und genau ein Schnappschuss", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const runden: Runde[] = [];
    for (let lauf = 1; lauf <= WIEDERHOLUNGEN; lauf += 1) {
      const koId = `ko-4325-c-${lauf}`;
      await legeObjektAn(lese as Pool, koId, RUMPF_BESTAND);
      const vorbereitet = await reicheEin((instanzB as Instanz).basis, kopfEinreicherB, koId, {
        statement: STATEMENT_B,
        bodyHtml: RUMPF_B,
        baseVersion: 1,
      });
      if (vorbereitet.status !== 200) {
        throw new Error(
          `${JOB} F-c Lauf ${lauf}: Vorbereitung misslang — ${deuteVerlierer(vorbereitet)}`,
        );
      }
      const vorschlag = vorschlagsKennung(vorbereitet, STATEMENT_B);
      if (vorschlag === undefined) {
        throw new Error(
          `${JOB} F-c Lauf ${lauf}: die Route gibt den vorbereiteten Vorschlag nicht zurück.`,
        );
      }
      const logstaende = [
        (instanzA as Instanz).protokoll.length,
        (instanzB as Instanz).protokoll.length,
      ];
      const [ra, rb] = await Promise.all([
        entscheide((instanzA as Instanz).basis, kopfEntscheider, koId, vorschlag, 1),
        entscheide((instanzB as Instanz).basis, kopfEntscheider, koId, vorschlag, 1),
      ]);
      const serverzeilen = neueServerzeilen([instanzA as Instanz, instanzB as Instanz], logstaende);
      const gewinner = gewinnerAus(ra, rb);
      const maengel: string[] = [];
      if (gewinner === "beide") {
        maengel.push(
          "BEIDE Entscheidungen wurden mit 2xx quittiert — derselbe Vorschlag wurde zweimal übernommen.",
        );
      } else if (gewinner === "keiner") {
        maengel.push(
          mitServerzeilen(
            `KEINE der beiden Entscheidungen kam durch — A: ${deuteVerlierer(ra)} | B: ${deuteVerlierer(rb)}`,
            serverzeilen,
          ),
        );
      } else {
        const verlierer = gewinner === "A" ? rb : ra;
        if (verlierer.status !== 409) {
          const satz = `die zweite Entscheidung antwortet ${deuteVerlierer(verlierer)} statt 409.`;
          maengel.push(verlierer.status >= 500 ? mitServerzeilen(satz, serverzeilen) : satz);
        } else {
          const fehler = alsFehler(verlierer);
          if (fehler.error !== "KO_STALE" && fehler.error !== "PROPOSAL_DECIDED") {
            maengel.push(
              `der 409 nennt „${String(fehler.error)}" statt „KO_STALE" oder „PROPOSAL_DECIDED".`,
            );
          }
          if ((fehler.message ?? "").trim().length === 0) {
            maengel.push("der 409 trägt keinen Satz — eine Absage ohne Auskunft.");
          }
        }
      }
      const gespeichert = await nachNeuerVerbindung(eigeneUrl, koId);
      if (gespeichert?.version !== 2) {
        maengel.push(
          `gespeichert ist Version ${String(gespeichert?.version)}, erwartet 2 (nicht 3).`,
        );
      }
      // Runde 1 zählte hier nur die Zeilen; jetzt wird auch ihr INHALT verglichen (Prüferbefund 6).
      maengel.push(
        ...(await pruefeSchnappschuss(lese as Pool, koId, 2, gespeichert?.bodyHtml ?? null)),
      );
      const uebernahmen = (gespeichert?.proposals ?? []).filter((p) => p.status === "uebernommen");
      if (uebernahmen.length !== 1) {
        maengel.push(
          `im Objekt stehen ${uebernahmen.length} übernommene Vorschläge, erwartet genau 1.`,
        );
      }
      // Beide Belege des Paares, nicht nur der Freigabebeleg — gegen die wirklich entstandene Fassung
      // UND gegen die zwei Menschen dahinter (Einreicher B schrieb, der Entscheider gab frei).
      maengel.push(
        ...pruefeBelegvollstaendigkeit(
          await auditBestand(lese as Pool),
          gespeichert?.version === 2
            ? erwarteFassung(
                koId,
                2,
                (konten as Kontenbuch).kennung(EINREICHER_B),
                (konten as Kontenbuch).kennung(ENTSCHEIDER),
              )
            : erwarteKeineFassung(koId),
        ),
      );
      runden.push({
        lauf,
        koId,
        ueberlappt: ueberlappt(ra, rb),
        status: [ra.status, rb.status],
        gewinner,
        maengel,
      });
    }
    const befund = fasseZusammen(runden);
    melde("(c) zwei Entscheidungen", befund);
    await ketteIstGanz("Fall (c)");
    expect(
      befund.ueberlappungen,
      "nicht jede Runde hat wirklich überlappt — ohne Überlappung belegt sie keine Gleichzeitigkeit.",
    ).toBe(WIEDERHOLUNGEN);
    expect(befund.maengel, "Fall (c): gemessene Abweichungen").toEqual([]);
  }, 900_000);
});
