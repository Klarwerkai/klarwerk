import type { Queryable } from "../../db-tx";
import { KO_FREMDSCHLUESSEL } from "../../knowledge-object";
import { type ObjectRef, isTransientMedia, isWithinRetention } from "../../object-store";

// ================================================================================================
// R-0846 / L6 — DIE VIER DATENBANKBEFUNDE, ALS BERICHT UND ALS VORBEREITETE BEREINIGUNG.
// ================================================================================================
//
// Die vier Befunde aus L6 und was hier jeweils gilt:
//
//   1. FREMDSCHLÜSSEL AUF DIE OBJEKTTABELLE. `KO_FREMDSCHLUESSEL_SCHEMA` (knowledge-object) legt sie
//      an, `NOT VALID`. Der Bericht nennt je Schlüssel „fehlt", „ungeprüft" (Altbestand nicht
//      validiert) oder „gültig" und zählt die Zeilen, die eine Validierung heute verhindern.
//   2. LÜCKEN OHNE OBJEKTBEZUG. `Gap.koId` trägt den Bezug (services/ask). Gezählt werden
//      geschlossene Lücken ohne Bezug; einzeln genannt wird jeder Bezug, dessen Objekt fehlt.
//   3. WAISEN. Ein Objekt im Object-Store ist eine Waise, wenn seine Schutzfrist abgelaufen ist
//      (`isWithinRetention`) UND seine Kennung in KEINER Text-/JSON-Spalte irgendeiner Tabelle
//      vorkommt — ausgenommen nur `objects` selbst und `audit`. Das ist eine bewusste OBERMENGE der
//      fünf Referenzorte aus `object-references.ts` (Objekte samt Papierkorb, Fließtext, Fassungen,
//      Belege, Entwürfe samt Papierkorb) und schliesst jede Tabelle ein, die später dazukommt: die
//      Prüfung irrt in die Richtung „referenziert" (dieselbe Richtung des Zweifels wie dort).
//   4. PRÜFSPUR AUF GELÖSCHTE OBJEKTE. Die Prüfspur bleibt — `audit` bekommt bewusst KEINEN
//      Fremdschlüssel, sie muss eine Löschung überdauern. Konsistent ist ein `ko.*`-Eintrag ohne
//      Objekt genau dann, wenn für dieses Ziel ein `ko.purged`-Beleg existiert (die Endlöschung
//      schreibt ihn in derselben Transaktion). Ohne ihn ist er ein Widerspruch und wird einzeln
//      genannt.
//
// DER BERICHT LIEST NUR. Er läuft über `begrenztePruefung` (db-tx): nur lesend, mit Zeitgrenzen,
// immer ROLLBACK. DIE BEREINIGUNG schreibt und ist ein ausdrücklicher Betreiberschritt
// (`tools/datenintegritaet.ts --bereinigen --ausfuehren`); sie läuft in EINER Transaktion samt
// Prüfspureintrag und ermittelt ihre Mengen in dieser Transaktion neu, statt einem älteren Bericht
// zu vertrauen.
//
// GRENZEN, ehrlich benannt:
//   · Ein Bestandsreset löscht `kos` ohne `ko.purged`. Fasst er `audit` nicht mit ab, erscheinen
//     die Ziele seiner Zeit als Widerspruch — der Bericht unterscheidet das nicht.
//   · Der Waisenscan vergleicht Zeichenketten über den ganzen Bestand. Auf großem Bestand kann er
//     die Anweisungsgrenze der Prüfung reißen; dann scheitert er laut, statt zu raten.
//
// NACHARBEIT 4 — DAS KONKURRENZFENSTER IST GESCHLOSSEN. Bis hierher konnte zwischen Referenzscan und
// `DELETE FROM objects` eine andere Transaktion eine neue Referenz auf eine Waise speichern (die
// geteilte Reset-Sperre hält Schreiber nicht ab, sie hält nur den Reset ab). Jetzt nimmt die
// Bereinigung als ERSTES `LOCK TABLE … IN SHARE MODE` auf jede Tabelle, die der Scan liest, und auf
// `objects`. SHARE verträgt Leser, aber keinen Schreiber (INSERT/UPDATE/DELETE): ein Referenzschreiber,
// der vorher begonnen hat, wird zu Ende abgewartet und ist dann im Scan sichtbar; einer, der danach
// kommt, wartet bis zum Commit oder Rollback der Bereinigung und schreibt auf deren Ergebnis. Das
// Warten der Bereinigung selbst ist durch `lock_timeout` begrenzt; scheitert es, rollt sie zurück.
// Die Sperren sind transaktionsgebunden und fallen mit COMMIT oder ROLLBACK.
//   PREIS: Für die Dauer der Bereinigung warten ALLE Schreiber auf diese Tabellen (auch Anmeldung,
//   Sitzungen, Entwürfe). Sie ist ein ausdrücklicher Betreiberschritt, kein Hintergrundlauf.

/** Höchstzahl einzeln genannter Fundstellen je Befund. Zählungen bleiben vollständig. */
export const BERICHT_HOECHSTENS = 200;

export type Schluesselzustand = "fehlt" | "ungeprueft" | "gueltig";

export interface Integritaetsbefund {
  readonly fremdschluessel: readonly { name: string; zustand: Schluesselzustand }[];
  readonly fassungenOhneObjekt: number;
  readonly belegeOhneObjekt: number;
  readonly luecken: {
    readonly geschlossenOhneBezug: number;
    readonly bezugOhneObjekt: readonly { gapId: string; koId: string }[];
  };
  readonly pruefspur: {
    readonly endgeloeschtBelegt: number;
    readonly ohneLoeschbeleg: readonly { ziel: string; eintraege: number }[];
  };
  readonly waisen: readonly { id: string; zweck: string; transient: boolean }[];
}

export interface Bereinigungsergebnis {
  readonly fassungenEntfernt: number;
  readonly belegeEntfernt: number;
  readonly validiert: readonly string[];
  readonly waisenEntfernt: readonly string[];
  /** Die Tabellen, die bis zum Ende der Transaktion gegen Schreiber gesperrt waren. */
  readonly gesperrt: readonly string[];
}

/** Höchstwartezeit der Bereinigung auf ihre Tabellensperren, in Millisekunden. */
export const BEREINIGUNG_SPERRE_MS = 10_000;

/**
 * Prüfhaken der Bereinigung. `nachReferenzscan` läuft NACH dem Waisenscan und VOR dem Löschen —
 * genau im früheren Konkurrenzfenster. Der Betreiberweg setzt ihn nicht; die Gegenprobe gegen echtes
 * Postgres (datenintegritaet-pg F8–F10) legt dort einen gleichzeitigen Schreiber hinein.
 */
export interface BereinigungsHaken {
  readonly nachReferenzscan?: (waisen: readonly string[]) => Promise<void>;
}

function bezeichner(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

const SQL_SCHLUESSEL =
  "SELECT conname, convalidated FROM pg_constraint WHERE conname = ANY($1::text[])";

const SQL_FASSUNGEN_OHNE_OBJEKT = `SELECT count(*)::int AS n FROM ko_versions v
  WHERE NOT EXISTS (SELECT 1 FROM kos k WHERE k.id = v.ko_id)`;

const SQL_BELEGE_OHNE_OBJEKT = `SELECT count(*)::int AS n FROM ko_evidence e
  WHERE NOT EXISTS (SELECT 1 FROM kos k WHERE k.id = e.ko_id)`;

const SQL_LUECKEN_OHNE_BEZUG = `SELECT count(*)::int AS n FROM gaps
  WHERE data->>'status' = 'geschlossen' AND COALESCE(data->>'koId', '') = ''`;

const SQL_LUECKEN_BEZUG_OHNE_OBJEKT = `SELECT g.id AS gap_id, g.data->>'koId' AS ko_id FROM gaps g
  WHERE COALESCE(g.data->>'koId', '') <> ''
    AND NOT EXISTS (SELECT 1 FROM kos k WHERE k.id = g.data->>'koId')
  ORDER BY g.id LIMIT ${BERICHT_HOECHSTENS}`;

const SQL_PRUEFSPUR_OHNE_OBJEKT = `SELECT a.target AS ziel, count(*)::int AS eintraege,
    bool_or(a.action = 'ko.purged') AS endgeloescht
  FROM audit a
  WHERE a.action LIKE 'ko.%' AND NOT EXISTS (SELECT 1 FROM kos k WHERE k.id = a.target)
  GROUP BY a.target
  ORDER BY a.target`;

// Alle Text- und JSON-Spalten echter Tabellen des aktuellen Schemas — ohne `objects` und `audit`.
const SQL_REFERENZSPALTEN = `SELECT c.table_name, c.column_name
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = current_schema()
    AND t.table_type = 'BASE TABLE'
    AND c.data_type IN ('text', 'json', 'jsonb', 'character varying')
    AND c.table_name NOT IN ('objects', 'audit')
  ORDER BY c.table_name, c.column_name`;

async function zahl(q: Queryable, sql: string): Promise<number> {
  const res = await q.query<{ n: number }>(sql);
  return res.rows[0]?.n ?? 0;
}

async function schluesselzustaende(
  q: Queryable,
): Promise<{ name: string; zustand: Schluesselzustand }[]> {
  const namen = [...KO_FREMDSCHLUESSEL];
  const res = await q.query<{ conname: string; convalidated: boolean }>(SQL_SCHLUESSEL, [namen]);
  return namen.map((name): { name: string; zustand: Schluesselzustand } => {
    const zeile = res.rows.find((r) => r.conname === name);
    if (!zeile) {
      return { name, zustand: "fehlt" };
    }
    return { name, zustand: zeile.convalidated ? "gueltig" : "ungeprueft" };
  });
}

/**
 * Die Waisen des Object-Stores (s. Kopf, Befund 3). Erst die Schutzfrist (billig, in Node), dann der
 * Referenzscan nur für die verbliebenen Kandidaten — je Spalte EINE Anweisung über alle Kandidaten.
 */
export async function ermittleWaisen(
  q: Queryable,
  jetzt: number,
): Promise<{ id: string; zweck: string; transient: boolean }[]> {
  const refs = await q.query<{ ref: ObjectRef }>("SELECT ref FROM objects ORDER BY id");
  const kandidaten = refs.rows.map((r) => r.ref).filter((ref) => !isWithinRetention(ref, jetzt));
  if (kandidaten.length === 0) {
    return [];
  }
  const offen = new Set(kandidaten.map((ref) => ref.id));
  const spalten = await q.query<{ table_name: string; column_name: string }>(SQL_REFERENZSPALTEN);
  for (const { table_name, column_name } of spalten.rows) {
    if (offen.size === 0) {
      break;
    }
    const treffer = await q.query<{ id: string }>(
      `SELECT k.id FROM unnest($1::text[]) AS k(id)
        WHERE EXISTS (SELECT 1 FROM ${bezeichner(table_name)} x
                      WHERE strpos(x.${bezeichner(column_name)}::text, k.id) > 0)`,
      [[...offen]],
    );
    for (const { id } of treffer.rows) {
      offen.delete(id);
    }
  }
  const waisen = kandidaten.filter((ref) => offen.has(ref.id));
  return waisen.map((ref) => ({
    id: ref.id,
    zweck: ref.lifecycle?.purpose ?? "unknown",
    transient: isTransientMedia(ref),
  }));
}

/** Der Bericht über alle vier Befunde. Liest nur — gedacht für `begrenztePruefung`. */
export async function erhebeIntegritaet(q: Queryable, jetzt: number): Promise<Integritaetsbefund> {
  const spur = await q.query<{ ziel: string; eintraege: number; endgeloescht: boolean }>(
    SQL_PRUEFSPUR_OHNE_OBJEKT,
  );
  const luecken = await q.query<{ gap_id: string; ko_id: string }>(SQL_LUECKEN_BEZUG_OHNE_OBJEKT);
  const ohneBeleg = spur.rows.filter((r) => !r.endgeloescht).slice(0, BERICHT_HOECHSTENS);
  return {
    fremdschluessel: await schluesselzustaende(q),
    fassungenOhneObjekt: await zahl(q, SQL_FASSUNGEN_OHNE_OBJEKT),
    belegeOhneObjekt: await zahl(q, SQL_BELEGE_OHNE_OBJEKT),
    luecken: {
      geschlossenOhneBezug: await zahl(q, SQL_LUECKEN_OHNE_BEZUG),
      bezugOhneObjekt: luecken.rows.map((r) => ({ gapId: r.gap_id, koId: r.ko_id })),
    },
    pruefspur: {
      endgeloeschtBelegt: spur.rows.filter((r) => r.endgeloescht).length,
      ohneLoeschbeleg: ohneBeleg.map((r) => ({ ziel: r.ziel, eintraege: r.eintraege })),
    },
    waisen: (await ermittleWaisen(q, jetzt)).slice(0, BERICHT_HOECHSTENS),
  };
}

/**
 * Die vorbereitete Bestandsbereinigung — NUR in einer schreibenden Transaktion aufrufen (der
 * Betreiberweg reicht den Client aus `withPgTx` herein). Sie entfernt Fassungen und Belege ohne
 * Objekt, validiert danach die vorhandenen Fremdschlüssel und entfernt die Waisen, deren Menge sie
 * in DIESER Transaktion neu ermittelt. Lücken und Prüfspur fasst sie NICHT an: dort ist der
 * Befund eine Auskunft, kein Löschgrund.
 */
export async function bereinigeBestand(
  q: Queryable,
  jetzt: number,
  haken: BereinigungsHaken = {},
): Promise<Bereinigungsergebnis> {
  // ZUERST die Sperre (s. Kopf, Nacharbeit 4) — vor jedem Lesen, auf dem eine Entscheidung beruht.
  const gesperrt = await sperreReferenzschreiber(q);
  const fassungen = await q.query(
    "DELETE FROM ko_versions v WHERE NOT EXISTS (SELECT 1 FROM kos k WHERE k.id = v.ko_id)",
  );
  const belege = await q.query(
    "DELETE FROM ko_evidence e WHERE NOT EXISTS (SELECT 1 FROM kos k WHERE k.id = e.ko_id)",
  );
  const validiert: string[] = [];
  for (const { name, zustand } of await schluesselzustaende(q)) {
    if (zustand === "fehlt") {
      continue;
    }
    const tabelle = name === "ko_versions_ko_fk" ? "ko_versions" : "ko_evidence";
    await q.query(`ALTER TABLE ${bezeichner(tabelle)} VALIDATE CONSTRAINT ${bezeichner(name)}`);
    validiert.push(name);
  }
  const waisen = (await ermittleWaisen(q, jetzt)).map((w) => w.id);
  await haken.nachReferenzscan?.(waisen);
  if (waisen.length > 0) {
    await q.query("DELETE FROM objects WHERE id = ANY($1::text[])", [waisen]);
  }
  return {
    fassungenEntfernt: fassungen.rowCount ?? 0,
    belegeEntfernt: belege.rowCount ?? 0,
    validiert,
    waisenEntfernt: waisen,
    gesperrt,
  };
}

/**
 * Sperrt jede Tabelle, die der Waisenscan liest, und `objects` in SHARE MODE — bis zum Ende der
 * Transaktion. Sortiert, damit zwei Läufe die Sperren in derselben Reihenfolge nehmen.
 */
async function sperreReferenzschreiber(q: Queryable): Promise<string[]> {
  const spalten = await q.query<{ table_name: string }>(SQL_REFERENZSPALTEN);
  const tabellen = [...new Set([...spalten.rows.map((r) => r.table_name), "objects"])].sort();
  await q.query(`SET LOCAL lock_timeout = ${BEREINIGUNG_SPERRE_MS}`);
  await q.query(`LOCK TABLE ${tabellen.map(bezeichner).join(", ")} IN SHARE MODE`);
  return tabellen;
}
