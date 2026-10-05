// ================================================================================================
// ALT-500 · DER ORIGINALABLAUF VON 715dd3abb — MIT INTERNER DIAGNOSE IN BEIDEN SERVERPROZESSEN.
// ================================================================================================
//
// AUFTRAG: aufnahme:20260922:graph-browser-rechte-alt500 (Pedi, entscheidung:ea418f5a, Option C).
// Kriterium: der alte 500-Fall ist durch einen konkreten Nachfolger belegt geschlossen ODER aktuell
// minimal reproduziert — kein neuer Fehler aus blosser Altueberschrift.
//
// WAS DER QUELLVERGLEICH ERGAB (QUELLEN-GRAPH-ORIGINAL.json, Originalstand 715dd3abb):
//   · Der Vorfall (Arbeitspruefung 9b5f98b21ece44fea6340ee5410a6823) lief in
//     `beziehung-oeffnen-graph-widerruf-neustart-kuerzung.integration.test.ts` mit den Stationen
//     b–f: Link, Menueweg, Widerruf, SIGTERM und PROZESS 2 auf derselben Datenbank, erneute
//     Anmeldung und Stufe 2, `/graph` offen — erst DANN `POST /api/kos`; nr=0002 bekam 500.
//   · Der bisherige Nachfolger ALT-500-AUSLÖSER (`tastatur-schmal-rechte-pg.integration.test.ts`)
//     fuhr davon nur Anmeldung, Stufe 2 und `/graph` in EINEM Prozess — ohne b–e und OHNE
//     Prozessneustart. Seine 303 × 201 sagen deshalb nichts ueber den Originalablauf.
//   · Die heutige Strecke verlaesst `/graph` vor den Anlagen (`about:blank`) — genau die Bedingung
//     des Vorfalls ist dort abgeschaltet.
//   · `services/app/src/http.ts`, `server.ts` und die Vorrichtung unterscheiden sich vom Original
//     nur additiv (neue Statuscodes, Kommentar, Diagnosezusatz); der Auffangzweig von `sendError`
//     schreibt damals wie heute keine Logzeile.
//
// WAS DIESER FALL TUT: er faehrt DIESELBE Strecke (`fahreStrecke`, Stationen b–f) mit
// `graphOffenBeiAnlage` — `/graph` bleibt waehrend der Anlagen offen wie in 715dd3abb — und mit der
// Treiberdiagnose (`pg-fehlerdiagnose-vorladen.ts`) in Prozess 1 UND Prozess 2. Fuer jeden 500 wird
// VOR dem Entfernen der Datenbank gelesen: der gescheiterte Beleg `ko.created:<id>` DIESER Anlage
// (SQLSTATE, Constraint, seq), der erfolgreiche Eintrag mit derselben seq (zweiter Schreiber) und
// jede gescheiterte SQL-Anfrage im Zeitfenster der Anlage.
//
// WANN ER GRUEN IST: mindestens ein 500 trat auf, und JEDER 500 traegt intern `23505 audit_pkey`
// am Beleg seiner Anlage — dieselbe Ursache, die ALT-500 minimal reproduziert. Dann ist der
// historische Ablauf heute an diese Ursache gebunden; ALT-500 ist die minimale Reproduktion dazu.
//
// WANN ER ROT IST — UND WAS DAS HEISST:
//   · kein 500 in `LAEUFE` vollen Strecken: am Originalablauf NICHT reproduziert. Das ist KEINE
//     Schliessung (Nichtziel: erfolgreiche Anlagen gelten nicht als Schliessung).
//   · ein 500 mit anderer oder ohne Treiberursache: ein eigener, belegter Befund — er steht in der
//     Meldung. Ein Fehler ausserhalb von PostgreSQL bleibt fuer diese Diagnose unsichtbar, weil der
//     Auffangzweig von `sendError` nichts protokolliert; das sagt die Meldung dann ausdruecklich.
//
// WAS AUCH EIN GRUENER LAUF NICHT BELEGT: dass der Lauf von 4328 R1 selbst genau diesen Verlauf
// hatte — dessen interne Diagnose ist nicht erhalten (check.out/check.err tragen nur die Assertion).
//
// KEINE PRODUKTIVDATEN: jede Datenbank traegt `test` im Namen (`pgUrl`) und wird entfernt.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import {
  type Anlage,
  type Umgebung,
  fahreStrecke,
  richteUmgebungEin,
} from "../wissensnetz-nutzerweg/strecke";
import type { PgVorfall } from "./pg-fehlerdiagnose";

const MARKE = "[KLARWERK] ALT-500-ORIGINALSTRECKE";
const VORLADEN = resolve(
  process.cwd(),
  "tests/wissensbeziehungen-browser-rechte/pg-fehlerdiagnose-vorladen.ts",
);
/** Volle Strecken b–f, hoechstens — der Vorfall trat in EINEM Lauf auf. */
const LAEUFE = 3;
/** Dieselbe Ursache, die ALT-500 minimal reproduziert. */
const AUDIT_KOLLISION = "23505 audit_pkey";

interface Diagnose {
  lauf: number;
  nr: string;
  status: number;
  rumpf: string;
  koGespeichert: number;
  ursache: string;
  seq?: number;
  zweiterSchreiber: string;
  imFenster: string[];
}

interface Messung {
  laeufe: number;
  anlagen: number;
  status: Record<string, number>;
  diagnoseZeilen: number;
  auditEintraegeOk: number;
  diagnosen: Diagnose[];
  /** Ein Abbruch der Strecke, der KEIN 500 einer Anlage war — er wird nicht verschluckt. */
  andererAbbruch?: string;
}

const lies = (datei: string): PgVorfall[] =>
  readFileSync(datei, "utf8")
    .split("\n")
    .filter((z) => z.trim() !== "")
    .map((z) => JSON.parse(z) as PgVorfall);

/** Bis das Pruefprotokoll still ist — ein Nachlaeufer kann der zweite Schreiber sein. */
async function ruhe(pool: Pool): Promise<void> {
  let vorher = -1;
  for (let stabil = 0; stabil < 3; ) {
    await new Promise((weiter) => setTimeout(weiter, 500));
    const r = await pool.query<{ n: number }>("SELECT COALESCE(max(seq), 0)::int AS n FROM audit");
    const n = r.rows[0]?.n ?? 0;
    stabil = n === vorher ? stabil + 1 : 0;
    vorher = n;
  }
}

async function diagnostiziere(
  pool: Pool,
  datei: string,
  lauf: number,
  a: Anlage,
): Promise<Diagnose> {
  await ruhe(pool);
  const vorfaelle = lies(datei);
  const ids = (
    await pool.query<{ id: string }>("SELECT id FROM kos WHERE data->>'title' = $1", [
      `Grenzobjekt ${a.nr}`,
    ])
  ).rows.map((z) => z.id);
  const eigen = vorfaelle.find((v) => !v.ok && ids.some((id) => v.eventId === `ko.created:${id}`));
  const zweiter = eigen
    ? vorfaelle.find((v) => v.ok && v.seq === eigen.seq && v.handlung !== undefined)
    : undefined;
  return {
    lauf,
    nr: a.nr,
    status: a.status,
    rumpf: a.text,
    koGespeichert: ids.length,
    ursache: eigen
      ? `${eigen.code ?? "?"} ${eigen.constraint ?? "?"}`
      : ids.length === 0
        ? "kein Eintrag in kos — gescheitert VOR dem Einfuegen, nicht am Beleg"
        : "kein gescheiterter Beleg ko.created dieser Anlage — Ursache ausserhalb dieses Schritts",
    ...(eigen?.seq !== undefined ? { seq: eigen.seq } : {}),
    zweiterSchreiber: zweiter?.handlung ?? "(nicht gefunden)",
    imFenster: vorfaelle
      .filter((v) => !v.ok && v.t >= a.von && v.t <= a.bis)
      .map((v) => `${v.code ?? "?"} ${v.constraint ?? ""} ${v.sql.slice(0, 60)}`),
  };
}

describe(`${MARKE} · Stationen b–f, Prozessneustart, /graph offen — gegen PostgreSQL im echten Chromium`, () => {
  let zustand: Laufzustand | undefined;
  let umgebung: Umgebung | undefined;
  let aufraeumen: (() => Promise<void>) | undefined;
  let messung: Messung | undefined;

  beforeAll(async () => {
    const eingerichtet = await richteUmgebungEin();
    zustand = eingerichtet.zustand;
    umgebung = eingerichtet.umgebung;
    aufraeumen = eingerichtet.aufraeumen;
    process.stderr.write(befundsatz(MARKE.replace("[KLARWERK] ", ""), zustand));
  }, 900_000);

  afterAll(async () => {
    await aufraeumen?.();
    if (messung) {
      process.stderr.write(`${MARKE}: ${JSON.stringify(messung)}\n`);
    }
  }, 300_000);

  it("der historische Ablauf mit interner Diagnose: jeder 500 mit SQLSTATE, Constraint und zweitem Schreiber", async () => {
    if (!zaehltAlsBestanden(zustand) || !umgebung) {
      process.stderr.write(befundsatz(MARKE.replace("[KLARWERK] ", ""), zustand));
      return;
    }
    const ordner = mkdtempSync(join(tmpdir(), "alt500-original-"));
    const m: Messung = {
      laeufe: 0,
      anlagen: 0,
      status: {},
      diagnoseZeilen: 0,
      auditEintraegeOk: 0,
      diagnosen: [],
    };
    messung = m;
    try {
      for (let lauf = 1; lauf <= LAEUFE && m.diagnosen.length === 0; lauf += 1) {
        const datei = join(ordner, `pg-vorfaelle-${lauf}.jsonl`);
        writeFileSync(datei, "");
        m.laeufe = lauf;
        try {
          await fahreStrecke(umgebung, {
            stationen: ["b", "c", "d", "e", "f"],
            kennung: `alt500o${lauf}${`${Date.now()}`.slice(-7)}`,
            serverZusatz: {
              importe: [pathToFileURL(VORLADEN).href],
              env: { KLARWERK_TEST_PG_DIAGNOSE: datei },
            },
            graphOffenBeiAnlage: true,
            nachAnlage: async (pool, a) => {
              m.anlagen += 1;
              m.status[String(a.status)] = (m.status[String(a.status)] ?? 0) + 1;
              if (a.status >= 500) {
                m.diagnosen.push(await diagnostiziere(pool, datei, lauf, a));
              }
            },
          });
        } catch (fehler) {
          // Nur der Abbruch an der Pruefung des 500 ist erwartet; alles andere ist ein eigener
          // Befund und wird NICHT als Ergebnis dieses Falls gelesen.
          if (!m.diagnosen.some((d) => d.lauf === lauf)) {
            m.andererAbbruch = String(fehler).slice(0, 400);
            throw fehler;
          }
        } finally {
          const vorfaelle = lies(datei);
          m.diagnoseZeilen += vorfaelle.length;
          m.auditEintraegeOk += vorfaelle.filter((v) => v.ok && v.seq !== undefined).length;
        }
      }

      // DER ZEUGE DER DIAGNOSE: ohne Zeilen war sie nicht aktiv — dann sagte ihr Schweigen nichts.
      expect(
        m.auditEintraegeOk,
        "die Treiberdiagnose in den Serverprozessen hat keinen Pruefprotokoll-Eintrag gesehen — sie war nicht aktiv",
      ).toBeGreaterThan(0);
      expect(
        m.diagnosen.length,
        `${MARKE}: in ${m.laeufe} vollen Strecken (b–f, Prozessneustart, /graph offen) und ${m.anlagen} Anlagen kein 500 (${JSON.stringify(m.status)}). Der historische Fall ist am Originalablauf NICHT reproduziert und NICHT zugeordnet — das ist auch kein Beleg einer Schliessung.`,
      ).toBeGreaterThan(0);
      expect(
        m.diagnosen.map((d) => d.ursache),
        `${MARKE}: mindestens ein 500 hat eine ANDERE oder keine Treiberursache — ein eigener, belegter Befund (ein Fehler ausserhalb von PostgreSQL bleibt hier unsichtbar, weil der Auffangzweig von sendError nichts protokolliert): ${JSON.stringify(m.diagnosen)}`,
      ).toEqual(m.diagnosen.map(() => AUDIT_KOLLISION));
    } finally {
      rmSync(ordner, { recursive: true, force: true });
    }
  }, 3_600_000);

  it("Zeuge: der Lauf sagt selbst, ob er gelaufen ist — ein Skip ist kein Grün", () => {
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} ZEUGE`, zustand));
    expect(zustand, "beforeAll hat keinen Laufzustand hinterlassen").toBeDefined();
    if (!zaehltAlsBestanden(zustand)) {
      expect(messung, "ohne Voraussetzungen keine Messung").toBeUndefined();
      return;
    }
    expect(messung, "die Voraussetzungen lagen vor — dann MUSS gemessen worden sein").toBeDefined();
  });
});
