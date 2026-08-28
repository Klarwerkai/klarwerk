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
// Aufruf (Pedi/Chef):
//   KLARWERK_DB_URL='postgres://…' tools/bodytext-zaehlung.sh

import { pathToFileURL } from "node:url";
import { Pool } from "pg";

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

async function main(): Promise<void> {
  const url = process.env.KLARWERK_DB_URL ?? process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write("KLARWERK_DB_URL (oder DATABASE_URL) setzen — kein Wert steht im Code.\n");
    process.exitCode = 2;
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const b = await zaehlen(pool);
    process.stdout.write(
      [
        `Projektionstabelle vorhanden: ${b.projektionstabelle ? "ja" : "NEIN (alles Betroffene)"}`,
        `KOs gesamt (lebend): ${b.gesamt} · davon mit bodyHtml: ${b.mitBodyHtml}`,
        `BETROFFEN (bodyHtml gefuellt, bodyText leer): ${b.betroffen}`,
        `  davon nach Pruefstand: ${b.betroffeneNachStatus.map((s) => `${s.status}=${s.n}`).join(" · ") || "-"}`,
        `  davon ohne Vertraulichkeitsstufe: ${b.betroffeneOhneStufe}`,
        `Projektions-Inventur: ${b.inventur.map((i) => `Fassung ${i.projectionVersion}: ${i.n}`).join(" · ") || "keine Zeilen"}`,
        "",
        JSON.stringify(b, null, 2),
      ].join("\n") + "\n",
    );
  } finally {
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  void main();
}
