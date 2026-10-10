// JOB 2614 D4 — DIE ZAHL AUS §2, READ-ONLY (Bauform wie tools/audit-forensics.ts).
//
// Frage des Auftrags, wörtlich: „Wie viele KOs im Bestand haben `bodyHtml` gefüllt und `bodyText`
// leer?" — lesend ermittelt, NICHT durch einen Migrationslauf.
//
// HARTE GRENZEN (bewusst, wie audit-forensics):
//   - AUSSCHLIESSLICH SELECT. Kein INSERT/UPDATE/DELETE, keine Migration, kein Schemaeingriff —
//     auch nicht implizit: dieses Werkzeug baut KEINEN Repo-Stapel auf (deren Konstruktoren
//     ruesten Schema nach), sondern setzt rohe SELECTs ab. Alle Statements stehen in
//     BODYTEXT_ZAEHLUNG_SQL und beginnen mit SELECT.
//   - Verbindungsdaten NUR aus der Umgebung (KLARWERK_DB_URL bzw. DATABASE_URL).
//   - Es werden NUR Zaehlungen gelesen — keine Titel, keine Inhalte, keine Ids.
//   - NICHT in die Anwendung eingebunden, nicht Teil von tools/check.
//
// Definition „betroffen" (identisch zur Trockenlauf-Semantik von tools/bodytext-nachziehen.ts,
// dort ueber die Dienstwege): ein lebendes KO mit gefuelltem `bodyHtml`, zu dessen AKTIVER Version
// KEINE Projektionszeile mit gefuelltem `body_text` existiert — das deckt alle drei Sorten
// (ohne Zeile · Fassung 1 · geltende Fassung mit leerem Text) in EINER Zahl ab.
//
// R-1410 (BEFUND 19, „Zählung ohne Absicherung") — drei Absicherungen der Gegenprobe:
//   - FASSUNGSSCHUTZ: eine Zeile zählt nur in der GELTENDEN Projektionsfassung als versorgt — dieselbe
//     Grenze wie `zaehleBetroffene` (Sorte „Fassung alt"). Ohne sie hielte die Zählung eine
//     Altfassungszeile mit Text für erledigt, die das Nachziehwerkzeug als betroffen meldet.
//   - SCHREIBSCHUTZ AUF SITZUNGSEBENE: `default_transaction_read_only=on` — auch ein künftig
//     versehentlich ergänztes Schreib-Statement scheitert an der Datenbank, nicht erst am Test R1.
//   - FÄNGER: ein Abbruch endet mit EINER Zeile und Exit 2 statt einer unbehandelten Zurückweisung.
//
// Aufruf (Pedi/Chef):
//   KLARWERK_DB_URL='postgres://…' tools/bodytext-zaehlung.sh

import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { inhaltsfreieAbbruchkennung } from "../services/app/src/startfehler-zeile";
import { SEARCH_PROJECTION_VERSION } from "../services/knowledge-object";

// Eine Zahl aus dem Produktcode, kein Eingabewert — die Einbettung ins SQL ist deshalb unbedenklich.
const GELTENDE_FASSUNG: number = SEARCH_PROJECTION_VERSION;

/** Pool-Optionen der Zählung: eine Verbindung, jede Transaktion read-only. */
export const ZAEHLUNG_POOL_OPTIONEN = {
  max: 1,
  options: "-c default_transaction_read_only=on",
} as const;

export const BODYTEXT_ZAEHLUNG_SQL = {
  // Existiert die Projektionstabelle ueberhaupt? (Aeltere Bestaende: nein → alles Betroffene.)
  projektionstabelle: "SELECT to_regclass('ko_search_projections')::text AS name",
  gesamt: `SELECT count(*)::int AS n FROM kos k
    WHERE coalesce(k.data->>'deletedAt','') = ''`,
  mitBodyHtml: `SELECT count(*)::int AS n FROM kos k
    WHERE coalesce(k.data->>'deletedAt','') = ''
      AND coalesce(k.data->>'bodyHtml','') <> ''`,
  betroffen: `SELECT count(*)::int AS n FROM kos k
    WHERE coalesce(k.data->>'deletedAt','') = ''
      AND coalesce(k.data->>'bodyHtml','') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM ko_search_projections p
        WHERE p.ko_id = k.id
          AND p.ko_version = coalesce(nullif(k.data->>'version','')::int, 1)
          AND p.projection_version = ${GELTENDE_FASSUNG}
          AND coalesce(p.body_text,'') <> ''
      )`,
  // Kontext fuer die Reihenfolgefalle (BASIC3 §3): Pruefstand und Stufe der Betroffenen — nur
  // Verteilungen, keine Inhalte.
  betroffeneNachStatus: `SELECT k.status, count(*)::int AS n FROM kos k
    WHERE coalesce(k.data->>'deletedAt','') = ''
      AND coalesce(k.data->>'bodyHtml','') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM ko_search_projections p
        WHERE p.ko_id = k.id
          AND p.ko_version = coalesce(nullif(k.data->>'version','')::int, 1)
          AND p.projection_version = ${GELTENDE_FASSUNG}
          AND coalesce(p.body_text,'') <> ''
      )
    GROUP BY k.status ORDER BY k.status`,
  betroffeneOhneStufe: `SELECT count(*)::int AS n FROM kos k
    WHERE coalesce(k.data->>'deletedAt','') = ''
      AND coalesce(k.data->>'bodyHtml','') <> ''
      AND coalesce(k.data->>'confidentiality','') = ''
      AND NOT EXISTS (
        SELECT 1 FROM ko_search_projections p
        WHERE p.ko_id = k.id
          AND p.ko_version = coalesce(nullif(k.data->>'version','')::int, 1)
          AND p.projection_version = ${GELTENDE_FASSUNG}
          AND coalesce(p.body_text,'') <> ''
      )`,
  inventur: `SELECT p.projection_version, count(*)::int AS n
    FROM ko_search_projections p GROUP BY p.projection_version ORDER BY p.projection_version`,
} as const;

export interface Zaehlbericht {
  projektionstabelle: boolean;
  gesamt: number;
  mitBodyHtml: number;
  betroffen: number;
  betroffeneNachStatus: { status: string; n: number }[];
  betroffeneOhneStufe: number;
  inventur: { projectionVersion: number; n: number }[];
}

export async function zaehlen(pool: Pool): Promise<Zaehlbericht> {
  const tab = await pool.query(BODYTEXT_ZAEHLUNG_SQL.projektionstabelle);
  const projektionstabelle = tab.rows[0]?.name != null;
  const gesamt = (await pool.query(BODYTEXT_ZAEHLUNG_SQL.gesamt)).rows[0]?.n ?? 0;
  const mitBodyHtml = (await pool.query(BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml)).rows[0]?.n ?? 0;
  if (!projektionstabelle) {
    // Ohne Projektionstabelle hat KEIN Dokument einen Suchtext: betroffen = alle mit bodyHtml.
    return {
      projektionstabelle,
      gesamt,
      mitBodyHtml,
      betroffen: mitBodyHtml,
      betroffeneNachStatus: [],
      betroffeneOhneStufe: 0,
      inventur: [],
    };
  }
  return {
    projektionstabelle,
    gesamt,
    mitBodyHtml,
    betroffen: (await pool.query(BODYTEXT_ZAEHLUNG_SQL.betroffen)).rows[0]?.n ?? 0,
    betroffeneNachStatus: (await pool.query(BODYTEXT_ZAEHLUNG_SQL.betroffeneNachStatus)).rows.map(
      (r: { status: string; n: number }) => ({ status: r.status, n: r.n }),
    ),
    betroffeneOhneStufe:
      (await pool.query(BODYTEXT_ZAEHLUNG_SQL.betroffeneOhneStufe)).rows[0]?.n ?? 0,
    inventur: (await pool.query(BODYTEXT_ZAEHLUNG_SQL.inventur)).rows.map(
      (r: { projection_version: number; n: number }) => ({
        projectionVersion: r.projection_version,
        n: r.n,
      }),
    ),
  };
}

/**
 * R-0623 (Ben, Nacharbeit 19) — DIE ABBRUCHZEILE DES WERKZEUGS.
 *
 * Bis hierher stand hier `${fehler.name}: ${fehler.message}` bzw. `String(fehler)` — ein Treiber-
 * oder Netzfehler trägt Hostnamen, Pfade und Datenwerte, und die gingen an allen Positivlisten
 * vorbei auf stderr. Jetzt: fester Ereignistext und nur die freigegebenen Fehlerkennungen
 * (`inhaltsfreieAbbruchkennung`: Typ und Code aus den Erlaubnislisten, Quelltextstelle). Einzeilig.
 */
export function zaehlungAbbruchZeile(fehler: unknown): string {
  return `[bodytext-zaehlung] Abbruch: ${inhaltsfreieAbbruchkennung(fehler)}`;
}

/** Was ein Lauf braucht — einspritzbar, damit der CLI-Weg samt Fänger ohne Datenbank prüfbar ist. */
export interface ZaehlungsLauf {
  env: Record<string, string | undefined>;
  neuerPool: (url: string) => Pool;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

/**
 * Der ganze Lauf des Werkzeugs mit Fänger. Liefert den Exit-Code: 0 bei Erfolg, 2 bei fehlender
 * Verbindungsangabe oder Abbruch. Der Pool wird in jedem Fall beendet (`finally`).
 */
export async function zaehlungAusfuehren(lauf: ZaehlungsLauf): Promise<number> {
  try {
    return await main(lauf);
  } catch (fehler: unknown) {
    lauf.stderr(`${zaehlungAbbruchZeile(fehler)}\n`);
    return 2;
  }
}

async function main(lauf: ZaehlungsLauf): Promise<number> {
  const url = lauf.env.KLARWERK_DB_URL ?? lauf.env.DATABASE_URL;
  if (!url) {
    lauf.stderr("KLARWERK_DB_URL (oder DATABASE_URL) setzen — kein Wert steht im Code.\n");
    return 2;
  }
  const pool = lauf.neuerPool(url);
  try {
    const b = await zaehlen(pool);
    lauf.stdout(
      [
        `Projektionstabelle vorhanden: ${b.projektionstabelle ? "ja" : "NEIN (alles Betroffene)"}`,
        `KOs gesamt (lebend): ${b.gesamt} · davon mit bodyHtml: ${b.mitBodyHtml}`,
        `BETROFFEN (bodyHtml gefuellt, bodyText leer): ${b.betroffen}`,
        `  davon nach Pruefstand: ${b.betroffeneNachStatus.map((s) => `${s.status}=${s.n}`).join(" · ") || "-"}`,
        `  davon ohne Vertraulichkeitsstufe: ${b.betroffeneOhneStufe}`,
        `Projektions-Inventur: ${b.inventur.map((i) => `Fassung ${i.projectionVersion}: ${i.n}`).join(" · ") || "keine Zeilen"}`,
        "",
        JSON.stringify(b, null, 2),
        // JOB 2701 D1 (lint/style/useTemplate): der Zeilenumbruch am Ende als letztes Element statt
        // per `+` angehaengt — dieselbe Ausgabe, Byte fuer Byte (join setzt vor "" ein "\n").
        "",
      ].join("\n"),
    );
    return 0;
  } finally {
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  // Fänger in `zaehlungAusfuehren`: EINE Zeile ohne Fehlertext, Exit 2, Pool-Ende im `finally`.
  void zaehlungAusfuehren({
    env: process.env,
    neuerPool: (url) => new Pool({ connectionString: url, ...ZAEHLUNG_POOL_OPTIONEN }),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  }).then((code) => {
    process.exitCode = code;
  });
}
