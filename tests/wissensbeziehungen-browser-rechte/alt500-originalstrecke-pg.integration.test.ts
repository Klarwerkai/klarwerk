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
// HEUTIGER NACHFOLGER: dieselben drei vollen Strecken b–f mit Prozessneustart und offenem Graphen.
// Der aktuelle PgAuditRepo serialisiert appendNext datenbankweit an AUDIT_KETTENSPERRE, VOR
// Vorgänger und Insert. Jede der 303 Anlagen muss 201 liefern, genau EIN KO zur Titelkennung
// hinterlassen und genau EINEN passenden ko.created-Beleg (event_id, action, target) tragen.
// Jeder Nicht201/Abbruch/Diagnosefehler bleibt rot; die vorhandene innere Diagnose wird weiterhin
// VOR dem Entfernen der Datenbank gelesen. Die positive Diagnoseaktivität bleibt Pflicht.
//
// HISTORIE: f4571f58/.690 belegte die damalige Diagnose/Reproduktion, keine damalige Heilung.
// Der abgeschlossene Originalauftrag r7 samt History/Lieferung bleibt unverändert. Der interne
// Verlauf von 4328 R1 ist weiterhin unbelegt; heutige 201 ordnen dessen Ursache nicht rückwirkend zu.
// Ein tatsächlicher Lauf dieses fortgeschriebenen Falls belegt nur den heutigen Nachfolger.
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
  koMitBeleg: number;
  diagnosen: Diagnose[];
  /** Jeder Abbruch bleibt rot — auch ein intern zugeordneter heutiger Anlagefehler. */
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

/** Titelkennung, gespeichertes KO und genau EIN kausaler Erstanlagebeleg müssen zusammenpassen. */
async function pruefeAnlagebeleg(pool: Pool, titel: string): Promise<void> {
  const kos = await pool.query<{ id: string }>("SELECT id FROM kos WHERE data->>'title' = $1", [
    titel,
  ]);
  expect(kos.rows, `genau ein KO zur eigenen Titelkennung ${titel}`).toHaveLength(1);
  const id = kos.rows[0]?.id;
  if (!id) throw new Error(`KO-Kennung fehlt: ${titel}`);
  const belege = await pool.query<{ event_id: string; action: string; target: string }>(
    "SELECT event_id,action,target FROM audit WHERE event_id=$1 OR (action='ko.created' AND target=$2)",
    [`ko.created:${id}`, id],
  );
  expect(belege.rows, `genau ein passender ko.created-Beleg zu ${titel}`).toEqual([
    { event_id: `ko.created:${id}`, action: "ko.created", target: id },
  ]);
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

  it("heutiger serialisierter Nachfolger: volle b–f-Strecken, jede 201 mit genau einem KO und ko.created-Beleg", async () => {
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
      koMitBeleg: 0,
      diagnosen: [],
    };
    messung = m;
    try {
      for (let lauf = 1; lauf <= LAEUFE; lauf += 1) {
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
              if (a.status !== 201) {
                m.diagnosen.push(await diagnostiziere(pool, datei, lauf, a));
              }
              expect(a.status, `${MARKE}: ${JSON.stringify(m.diagnosen)} ${a.text}`).toBe(201);
              await pruefeAnlagebeleg(pool, `Grenzobjekt ${a.nr}`);
              m.koMitBeleg += 1;
            },
          });
        } catch (fehler) {
          m.andererAbbruch = String(fehler).slice(0, 400);
          throw fehler;
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
      expect(m.laeufe, "alle drei vollen Strecken einschließlich Neustart").toBe(LAEUFE);
      expect(m.anlagen, "101 Anlagen je voller Strecke").toBe(LAEUFE * 101);
      expect(
        m.status,
        `${MARKE}: jede Nicht201 bleibt rot: ${JSON.stringify(m.diagnosen)}`,
      ).toEqual({
        "201": LAEUFE * 101,
      });
      expect(m.koMitBeleg, "jede erfolgreiche Anlage mit exakt einem KO und passenden Beleg").toBe(
        m.anlagen,
      );
      expect(
        m.diagnosen,
        "kein heutiger Anlagefehler; historische Akten bleiben unverändert",
      ).toEqual([]);
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
