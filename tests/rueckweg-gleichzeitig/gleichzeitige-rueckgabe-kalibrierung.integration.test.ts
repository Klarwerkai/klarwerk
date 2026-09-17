// ================================================================================================
// JOB 4325 · DIE KALIBRIERUNG — DIESE DATEI MUSS ROT WERDEN, SONST MISST DIE ABNAHME NICHTS.
// ================================================================================================
//
// WAS SIE BELEGT. `gleichzeitige-rueckgabe-pg.integration.test.ts` behauptet: in ≥ 20 echten
// Überlappungen gibt es nie zwei Gewinner, nie einen stillen Verlierer, keinen fehlenden und keinen
// falschen Beleg. Grün wäre dieselbe Datei aber auch dann, wenn ihr Erwartungssatz gar nichts prüfte.
// Hier wird ihm sechsmal gezielt der Boden entzogen — und zwar an GENAU DEM Erwartungssatz, den die
// Abnahme fährt (`rennenUmDieFassung` in `strecke.ts`, eine Fassung, zwei Aufrufer). Eine nachgebaute
// Erwartung würde nur belegen, dass die Nachbildung rot wird.
//
// DIE SECHS VERSTELLUNGEN:
//
//   K1  OHNE `expectedVersion` (Auftrag §6). Der Dienst sagt über sich selbst
//       (`services/knowledge-object/src/service.ts:4015`): „OHNE `expectedVersion` ändert sich NICHTS
//       am Altverhalten." Der zweite Schreiber schreibt dann durch — Fassung 3, keine 409.
//   K2  `currentVersion` 3 statt 2 erwartet (Auftrag §6).
//   K3  Die Belege der wirksamen Rückgabe FEHLEN, die Restkette bleibt lückenlos (Prüfer R1).
//   K4  Der Fassungs-Schnappschuss ist VERFÄLSCHT, die Zeilenzahl bleibt richtig (Prüfer R1, Punkt 6).
//   K5  Der Fassungs-Schnappschuss FEHLT ganz (Prüfer R2, Korrekturpflicht 2).
//   K6  Die Belege nennen den FALSCHEN Menschen, die Hashkette ist korrekt neu berechnet
//       (Prüfer R2, Korrekturpflicht 1).
//
// JEDE VERSTELLUNG MISST ZUERST SICH SELBST. Vor jedem roten Satz steht mindestens eine Vorbedingung,
// die belegt, dass die Verstellung überhaupt eingetreten ist (getroffene Zeilen, entfernte Belege)
// und dass sie die Lage erzeugt, um die es geht (Kette danach heil, Zeilenzahl unverändert). Eine
// Gegenprobe, deren Eintreten niemand geprüft hat, belegt nichts.
//
// WARUM SIE HINTER EINEM SCHALTER STEHT. Ein dauerhaft roter Fall im Regellauf ist kein Nachweis,
// sondern Rauschen — nach der dritten Woche schaut niemand mehr hin. Ohne `KLARWERK_KALIBRIERUNG=1`
// übersprungen, MIT sichtbarem Grund auf stderr; der Zeuge unten sagt in jedem Lauf, welcher Zustand
// vorliegt.
//
// AUFRUF:
//
//     KLARWERK_KALIBRIERUNG=1 npx vitest run --config vitest.integration.config.ts \
//       tests/rueckweg-gleichzeitig/gleichzeitige-rueckgabe-kalibrierung.integration.test.ts
//
// ERWARTET: Exit 1, sechs rote Fälle.
//
// ── UND DERSELBE SCHALTER ALS VITEST-BETRIEBSART, WEIL DER PRÜFPLATZ KEINE UMGEBUNG TRÄGT ────────
// Der Cloud-Wrapper nimmt AUSSCHLIESSLICH den nackten Befehl entgegen — `register/cloud/work.py:26-29`
// lässt `npx vitest run …` zu und sonst nichts, insbesondere keine vorangestellte Zuweisung. Die
// Kalibrierung wäre dort also gar nicht einschaltbar und damit unbelegt. Deshalb zählt DIESELBE
// Entscheidung auch, wenn die Betriebsart so heisst:
//
//     npx vitest run --mode kalibrierung --config vitest.integration.config.ts \
//       tests/rueckweg-gleichzeitig/gleichzeitige-rueckgabe-kalibrierung.integration.test.ts
//
// Zwei Wege zu EINEM Schalter, nicht zwei Schalter: unten steht genau ein `EINGESCHALTET`, und der
// Zeuge meldet in jedem Lauf, welcher Zustand vorlag.
//
// EIGENE WEGWERF-DATENBANK, wie die Abnahme und aus demselben Grund (Lehre JOB 4321 R1): eine
// Erweiterung ist je Datenbank, und in dieser gibt es genau einen Anleger.
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { FASSUNGSBELEG, FREIGABEBELEG, belegeFuer, pruefeKette } from "./kette";
import {
  type Fallbefund,
  type Instanz,
  JOB,
  type Kontenbuch,
  type Kopf,
  RUECKGEBER_A,
  RUECKGEBER_B,
  anmeldung,
  auditBestand,
  fassungen,
  mitDatenbank,
  ohneGeheimnis,
  rennenUmDieFassung,
  richteKontenEin,
  starteInstanz,
  verstelleBelegAkteur,
} from "./strecke";

/** Fünf statt zwanzig: die Kalibrierung belegt die Empfindlichkeit, nicht die Sporadikfestigkeit. */
const WIEDERHOLUNGEN = 5;

/** Die Betriebsart des Laufs (`--mode`), ohne `vite/client`-Typen gelesen. */
const BETRIEBSART = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE ?? "";

const EINGESCHALTET = process.env.KLARWERK_KALIBRIERUNG === "1" || BETRIEBSART === "kalibrierung";

describe("JOB 4325 · Kalibrierung: dem Erwartungssatz wird der Boden entzogen", () => {
  let verwaltung: Pool | undefined;
  let lese: Pool | undefined;
  let instanz: Instanz | undefined;
  let eigeneUrl = "";
  let verfuegbar = false;
  let grund = "";
  let kopfA: Kopf = {};
  let kopfB: Kopf = {};
  let konten: Kontenbuch | undefined;

  const datenbank = `klarwerk_gleichzeitig_kal_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    if (!EINGESCHALTET) {
      grund = `weder KLARWERK_KALIBRIERUNG=1 noch --mode kalibrierung (Betriebsart war „${BETRIEBSART}") — die Kalibrierung läuft nur auf ausdrücklichen Aufruf.`;
      process.stderr.write(`${JOB} KALIBRIERUNG ÜBERSPRUNGEN: ${grund}\n`);
      return;
    }
    const lokal = guardedLocalPgTestUrl();
    if (!lokal) {
      grund = "keine gesicherte KLARWERK_PG_TEST_URL";
      process.stderr.write(`${JOB} KALIBRIERUNG ÜBERSPRUNGEN: ${grund}.\n`);
      return;
    }
    verwaltung = new Pool({ connectionString: lokal, max: 2 });
    try {
      await verwaltung.query("SELECT 1");
    } catch (fehler) {
      grund = `KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich — ${String(fehler)}`;
      process.stderr.write(`${JOB} KALIBRIERUNG ÜBERSPRUNGEN: ${grund}\n`);
      await verwaltung.end().catch(() => undefined);
      verwaltung = undefined;
      return;
    }
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    eigeneUrl = mitDatenbank(lokal, datenbank);
    const migration = new Pool({ connectionString: eigeneUrl, max: 1 });
    try {
      await migrate(migration);
    } finally {
      await migration.end();
    }
    lese = new Pool({ connectionString: eigeneUrl, max: 2 });
    instanz = await starteInstanz("K", eigeneUrl);
    konten = await richteKontenEin(instanz.basis);
    kopfA = await anmeldung(instanz.basis, RUECKGEBER_A);
    kopfB = await anmeldung(instanz.basis, RUECKGEBER_B);
    verfuegbar = true;
    process.stderr.write(
      `${JOB} KALIBRIERUNG GELAUFEN gegen ${ohneGeheimnis(eigeneUrl)} · Socket ${instanz.port}\n`,
    );
  }, 600_000);

  afterAll(async () => {
    await instanz?.schliessen().catch(() => undefined);
    await lese?.end().catch(() => undefined);
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end().catch(() => undefined);
    }
  }, 300_000);

  /** Er skippt NIE — ohne ihn sähe „2 skipped" aus wie ein bestandener Lauf. */
  it("Z · die Kalibrierung sagt in jedem Lauf, ob sie wirklich gemessen hat", () => {
    if (verfuegbar) {
      expect(EINGESCHALTET).toBe(true);
      expect(instanz?.port).toBeGreaterThan(0);
    } else {
      expect(grund.trim().length, "ÜBERSPRUNGEN ohne Grund ist der stumme Lauf").toBeGreaterThan(0);
    }
  });

  function fahre(praefix: string, bedingt: boolean, konfliktVersion: number): Promise<Fallbefund> {
    return rennenUmDieFassung({
      lese: lese as Pool,
      url: eigeneUrl,
      a: instanz as Instanz,
      b: instanz as Instanz,
      kopfA,
      kopfB,
      akteurA: (konten as Kontenbuch).kennung(RUECKGEBER_A),
      akteurB: (konten as Kontenbuch).kennung(RUECKGEBER_B),
      praefix,
      wiederholungen: WIEDERHOLUNGEN,
      bedingt,
      erwarteteKonfliktVersion: konfliktVersion,
    });
  }

  /** EINE Runde mit einer Verstellung, die nach dem Rennen und vor jeder Prüfung greift. */
  function fahreVerstellt(
    praefix: string,
    vorDerPruefung: (koId: string) => Promise<void>,
  ): Promise<Fallbefund> {
    return rennenUmDieFassung({
      lese: lese as Pool,
      url: eigeneUrl,
      a: instanz as Instanz,
      b: instanz as Instanz,
      kopfA,
      kopfB,
      akteurA: (konten as Kontenbuch).kennung(RUECKGEBER_A),
      akteurB: (konten as Kontenbuch).kennung(RUECKGEBER_B),
      praefix,
      wiederholungen: 1,
      bedingt: true,
      erwarteteKonfliktVersion: 2,
      vorDerPruefung,
    });
  }

  /** Die Mängel eines Kalibrierungsfalles gehören ins Protokoll, bevor ein `expect` sie verschluckt. */
  function meldeMaengel(fall: string, befund: Fallbefund): void {
    for (const zeile of befund.maengel) {
      process.stderr.write(`${JOB} ${fall} MANGEL · ${zeile}\n`);
    }
  }

  // K1 — OHNE den bedingten Schreibzugriff schreibt der zweite durch. Der Erwartungssatz MUSS fallen.
  it("K1 · ohne expectedVersion schreibt der zweite Schreiber durch — derselbe Erwartungssatz wird rot", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const befund = await fahre("ko-4325-k1", false, 2);
    process.stderr.write(
      `${JOB} K1 · Verteilung A ${befund.verteilung.A} · B ${befund.verteilung.B} · beide ${befund.verteilung.beide} · keiner ${befund.verteilung.keiner}\n`,
    );
    // ABSICHTLICH DIESELBE ZEILE WIE IN DER ABNAHME (Fall d) — sie muss hier scheitern.
    expect(befund.maengel, "K1 ist GRÜN — der Erwartungssatz misst nichts.").toEqual([]);
  }, 900_000);

  // K2 — die Abweisung nennt Fassung 2. Wer 3 erwartet, muss rot werden.
  it("K2 · eine verstellte currentVersion (3 statt 2) macht denselben Erwartungssatz rot", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const befund = await fahre("ko-4325-k2", true, 3);
    process.stderr.write(
      `${JOB} K2 · Verteilung A ${befund.verteilung.A} · B ${befund.verteilung.B} · beide ${befund.verteilung.beide} · keiner ${befund.verteilung.keiner}\n`,
    );
    expect(befund.maengel, "K2 ist GRÜN — die Konfliktfassung wird nicht geprüft.").toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // K3 — DIE KALIBRIERUNG, DIE RUNDE 1 GEFEHLT HAT: FEHLENDE BELEGE BEI HEILER HASHKETTE.
  // ==============================================================================================
  //
  // DER PRÜFER ZU RUNDE 1 HAT ES VORGEMACHT: er unterdrückte beide `audit.record` in
  // `reviseUndFreigeben` (`services/knowledge-object/src/service.ts:4549-4558`) und die Abnahme blieb
  // grün — 20 wirksame Rückgaben, kein einziger Beleg, `seq 1–14 (14 Belege, 0 Mängel)`, Exit 0.
  //
  // WARUM HIER NICHT DER PRODUKTCODE MUTIERT WIRD: er liegt ausserhalb der Zielpfade. Dieselbe Lage
  // entsteht über die Ablage — die Belege der wirksamen Rückgabe werden über `vorDerPruefung` aus der
  // eigenen Wegwerf-Datenbank entfernt, BEVOR die Abnahme prüft. Sie stehen am ENDE der Kette; die
  // verbleibende Kette ist danach weiterhin lückenlos ab 1, richtig verkettet und Hash für Hash
  // nachrechenbar.
  //
  // ROT WIRD HIER DER ERWARTUNGSSATZ DER ABNAHME SELBST (`rennenUmDieFassung`, dieselbe Funktion, die
  // Fall (a) und Fall (d) fahren) — nicht eine nachgebaute Prüfung. Genau das verlangt der Prüfer:
  // „Derselbe Abnahmefall muss fehlende Belege erkennen, obwohl die verbleibende Hashkette lückenlos
  // ist."
  //
  // BEIDE FEHLERKLASSEN SIND KALIBRIERT: die zwei Vorbedingungen prüfen den MESSWEG (ist genau das
  // Belegpaar entfernt worden, meldet die Integritätsprüfung danach wirklich „ganz"), der Schlusssatz
  // die fachliche WIRKUNG. Eine Verstellung, deren Eintreten niemand geprüft hat, belegt nichts.
  it("K3 · fehlende Rückgabe-Belege bei lückenloser Hashkette — derselbe Abnahmefall muss rot werden", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const pool = lese as Pool;
    const entfernt: number[] = [];
    // EINE Wiederholung, und die Belege fallen am ENDE der Kette weg: die Restkette bleibt dadurch
    // lückenlos ab 1 — genau die Lage, in der die Integritätsprüfung nichts sehen KANN.
    const befund = await fahreVerstellt("ko-4325-k3", async (koId) => {
      const bestand = await auditBestand(pool);
      const belege = [
        ...belegeFuer(bestand, koId, FASSUNGSBELEG),
        ...belegeFuer(bestand, koId, FREIGABEBELEG),
      ];
      if (belege.length === 0) {
        return;
      }
      await pool.query("DELETE FROM audit WHERE seq >= $1", [
        Math.min(...belege.map((b) => b.seq)),
      ]);
      entfernt.push(belege.length);
    });
    meldeMaengel("K3", befund);

    // ── DER MESSWEG ZUERST: ist die Verstellung überhaupt eingetreten? ─────────────────────────
    expect(
      entfernt,
      "K3 VORBEDINGUNG verletzt: es wurde nicht genau das Belegpaar EINER wirksamen Rückgabe entfernt — dann misst der Rest nichts.",
    ).toEqual([2]);
    const nachher = await auditBestand(pool);
    // DIE GRENZE DER INTEGRITÄTSPRÜFUNG, GEMESSEN statt behauptet: sie meldet weiterhin „ganz".
    const kette = pruefeKette(nachher);
    expect(
      kette.maengel,
      "K3 VORBEDINGUNG verletzt: die Integritätsprüfung meldet eine Lücke — dann bewiese dieser Fall nicht, dass Vollständigkeit eine EIGENE Frage ist.",
    ).toEqual([]);
    process.stderr.write(
      `${JOB} K3 · 2 Belege entfernt; die Restkette (seq ${String(kette.von)}–${String(kette.bis)}, ${kette.anzahl} Belege) meldet 0 Mängel.\n`,
    );

    // ── DER ROTE SATZ — ZEICHENGLEICH DER DER ABNAHME (Fall a/d). ──────────────────────────────
    expect(
      befund.maengel,
      "K3 ist GRÜN — derselbe Abnahmefall erkennt vollständig fehlende Belege einer wirksamen Rückgabe NICHT.",
    ).toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // K4 — DER SCHNAPPSCHUSS: GEZÄHLT IST NICHT VERGLICHEN.
  // ==============================================================================================
  //
  // Runde 1 zählte in Fall (c) die Zeilen in `ko_versions` und verglich ihren Inhalt nicht; Fall (b)
  // prüfte sie gar nicht (Prüferbefund zu Prüfpunkt 6). Hier wird der abgelegte Fließtext der
  // wirksamen Fassung gezielt verfälscht — die ZEILENZAHL bleibt dabei richtig. Ein Erwartungssatz,
  // der nur zählt, bliebe grün; der geprüfte muss fallen.
  it("K4 · ein verfälschter Fassungs-Schnappschuss bei richtiger Zeilenzahl — derselbe Abnahmefall muss rot werden", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const pool = lese as Pool;
    const getroffen: number[] = [];
    let zeilenzahlDanach = -1;
    const befund = await fahreVerstellt("ko-4325-k4", async (koId) => {
      // Derselbe EINE Datensatz, anderer Fließtext — die Zeilenzahl bleibt richtig.
      const geaendert = await pool.query(
        `UPDATE ko_versions SET snapshot = jsonb_set(snapshot, '{bodyHtml}', to_jsonb($2::text))
           WHERE ko_id = $1 AND version = 2`,
        [koId, "<p>Ein Text, der nie gespeichert wurde.</p>"],
      );
      getroffen.push(geaendert.rowCount ?? 0);
      zeilenzahlDanach = (await fassungen(pool, koId)).filter((z) => z.version === 2).length;
    });
    meldeMaengel("K4", befund);

    expect(
      getroffen,
      "K4 VORBEDINGUNG verletzt: das UPDATE hat nicht genau eine Schnappschusszeile getroffen.",
    ).toEqual([1]);
    expect(
      zeilenzahlDanach,
      "K4 VORBEDINGUNG verletzt: die Zeilenzahl hat sich verändert — dann bewiese dieser Fall nicht, dass ZÄHLEN zu wenig ist.",
    ).toBe(1);
    process.stderr.write(`${JOB} K4 · Schnappschuss verfälscht, Zeilenzahl weiterhin 1.\n`);

    // ── DER ROTE SATZ — ZEICHENGLEICH DER DER ABNAHME (Fall a/d). ──────────────────────────────
    expect(
      befund.maengel,
      "K4 ist GRÜN — derselbe Abnahmefall erkennt einen verfälschten Fassungs-Schnappschuss NICHT.",
    ).toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // K5 — DER FEHLENDE SCHNAPPSCHUSS (Korrekturpflicht 2 aus Runde 2).
  // ==============================================================================================
  //
  // K4 verfälscht den Inhalt bei richtiger Zeilenzahl. Die ANDERE Hälfte — die Zeile fehlt ganz —
  // hat der Prüfer selbst gefahren und für wirksam befunden, aber sie stand nicht dauerhaft da.
  // Jetzt steht sie: eine Fassung, die es im Bestand gibt, aber nicht in `ko_versions`, wäre eine
  // Fassung ohne Rückholpunkt — und niemand sähe es.
  it("K5 · ein gelöschter Fassungs-Schnappschuss — derselbe Abnahmefall muss rot werden", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const pool = lese as Pool;
    const geloescht: number[] = [];
    const befund = await fahreVerstellt("ko-4325-k5", async (koId) => {
      const weg = await pool.query("DELETE FROM ko_versions WHERE ko_id = $1 AND version = 2", [
        koId,
      ]);
      geloescht.push(weg.rowCount ?? 0);
    });
    meldeMaengel("K5", befund);

    expect(
      geloescht,
      "K5 VORBEDINGUNG verletzt: es wurde nicht genau eine Schnappschusszeile gelöscht — dann misst der Rest nichts.",
    ).toEqual([1]);
    expect(
      (await fassungen(pool, "ko-4325-k5-1")).filter((z) => z.version === 2).length,
      "K5 VORBEDINGUNG verletzt: die Zeile steht noch da.",
    ).toBe(0);
    expect(
      befund.maengel.join(" | "),
      "K5: der Befund benennt nicht, dass die Fassung NICHT abgelegt ist.",
    ).toContain("NICHT abgelegt");
    process.stderr.write(`${JOB} K5 · Schnappschuss der Fassung 2 gelöscht, Zeilenzahl 0.\n`);

    // ── DER ROTE SATZ. ─────────────────────────────────────────────────────────────────────────
    expect(
      befund.maengel,
      "K5 ist GRÜN — derselbe Abnahmefall erkennt einen fehlenden Fassungs-Schnappschuss NICHT.",
    ).toEqual([]);
  }, 900_000);

  // ==============================================================================================
  // K6 — DER FALSCHE MENSCH IM BELEG, BEI KORREKT NEU BERECHNETER KETTE (Korrekturpflicht 1).
  // ==============================================================================================
  //
  // DER PRÜFER ZU RUNDE 2 HAT ES GEMESSEN: er setzte beide Audit-Akteure in `reviseUndFreigeben` auf
  // einen fremden Namen — 40 falsche Belege, Kette `seq 1–54` intakt, und die Abnahme blieb GRÜN
  // (`Tests 2 passed | 3 skipped`, Exit 0).
  //
  // HIER ENTSTEHT DIESELBE LAGE OHNE PRODUKTÄNDERUNG, und die Hashkette wird dabei KORREKT NEU
  // BERECHNET (`verstelleBelegAkteur`, `strecke.ts`). Das ist der Kern: ein blosses Überschreiben der
  // Spalte bräche jeden Hash, die INTEGRITÄTSprüfung fände es, und über die Identitätsprüfung wäre
  // nichts gesagt. Die Vorbedingung unten misst deshalb ausdrücklich, dass die Kette danach heil ist.
  it("K6 · falscher Akteur bei korrekt neu berechneter Hashkette — derselbe Abnahmefall muss rot werden", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    const pool = lese as Pool;
    const FREMD = "fremder-mensch-der-nie-gehandelt-hat";
    const verstellt: number[] = [];
    const befund = await fahreVerstellt("ko-4325-k6", async (koId) => {
      verstellt.push(await verstelleBelegAkteur(pool, koId, FREMD));
    });
    meldeMaengel("K6", befund);

    expect(
      verstellt,
      "K6 VORBEDINGUNG verletzt: es wurden nicht genau die zwei Belege der Rückgabe auf einen fremden Namen gesetzt.",
    ).toEqual([2]);
    const kette = pruefeKette(await auditBestand(pool));
    expect(
      kette.maengel,
      "K6 VORBEDINGUNG verletzt: die Hashkette ist nach der Verstellung nicht heil — dann fände die INTEGRITÄTSprüfung den Fehler und über die Identität wäre nichts gesagt.",
    ).toEqual([]);
    expect(
      befund.maengel.join(" | "),
      "K6: der Befund benennt die falsche Person nicht.",
    ).toContain("FALSCHEN Person");
    process.stderr.write(
      `${JOB} K6 · 2 Belege auf „${FREMD}" gesetzt; die Kette (seq ${String(kette.von)}–${String(kette.bis)}, ${kette.anzahl} Belege) meldet 0 Mängel.\n`,
    );

    // ── DER ROTE SATZ. ─────────────────────────────────────────────────────────────────────────
    expect(
      befund.maengel,
      "K6 ist GRÜN — derselbe Abnahmefall erkennt Belege mit FREMDEM Akteur NICHT.",
    ).toEqual([]);
  }, 900_000);
});
