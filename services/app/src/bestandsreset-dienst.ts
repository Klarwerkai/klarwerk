import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  BESTANDSRESET_LOESCHGRAPH,
  type BestandsresetBefund,
  type Queryable,
  SQL_SPERRE_WIRD_GEHALTEN,
  bestandsresetBefund,
  fuehreBestandsresetAus,
  poolQueryable,
} from "../../db-tx";
import { sqlDeletedAtLeer } from "../../knowledge-object";

// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSRESET — DER ADMINISTRATIVE AUFRUF (Nacharbeit 2).
// ================================================================================================
//
// Peters Entscheidung vom 11.10. (Fachhilfe, Frage 59), wörtlich: „deine empfehlung, zweifache
// passworteingabe und checkbox zum klicken." Die Empfehlung lautete: „Konten und Firmenwörterbuch
// standardmäßig erhalten. Einen administrativen Aufruf mit verständlicher Folgenvorschau und
// zusätzlicher Bestätigung für irreversible Löschungen vorsehen."
//
// Dieses Modul ist die Brücke zwischen der Admin-Route und dem vorhandenen Reset aus JOB 596
// (`services/db-tx/src/bestandsreset.ts`). Es baut KEINEN zweiten Reset: gelöscht wird über
// `fuehreBestandsresetAus` mit dem Standard-Löschgraphen, der Konten und Firmenwörterbuch bereits
// stehen lässt.
//
// DIE FOLGENVORSCHAU IST WIRKSAM, NICHT DEKORATIV. Ihre `kennung` ist ein Hash über das, was sie
// zusagt: WELCHE Wissensobjekte gelöscht werden (Kennung und Papierkorbstand jedes einzelnen) und
// wie viele Konten und Begriffe bleiben. Der Reset verlangt diese Kennung zurück und rechnet sie vor
// dem Löschen neu; hat sich daran inzwischen etwas geändert, läuft nichts (`VORSCHAU_VERALTET`).
// Wer löscht, hat damit nachweislich die Folgen gesehen, die eintreten.
//
// BEWUSST NICHT im Hash: die Zeilenzahlen der abgeleiteten Tabellen (Suchprojektion, Modellläufe,
// Gelesen-Marken …). Sie stehen in der Vorschau, ändern sich im Betrieb aber laufend im Hintergrund
// — eine Kennung über sie wiese fast jeden Reset als „veraltet" ab, ohne dass sich an seinen Folgen
// für einen Menschen etwas geändert hätte.

export interface BestandsresetVorschau {
  /** Was gelöscht wird: Zeilen je Tabelle des Löschgraphen, in seiner Reihenfolge. */
  geloescht: { tabelle: string; zeilen: number }[];
  /** Wissensobjekte insgesamt (lebend und im Papierkorb) — beide gehen mit. */
  wissensobjekte: number;
  /** Davon im Papierkorb. */
  papierkorb: number;
  /** Was ausdrücklich bleibt. */
  erhalten: { konten: number; begriffe: number };
  /** Kennung GENAU DIESER Vorschau. Der Reset verlangt sie zurück. */
  kennung: string;
}

export interface BestandsresetStand {
  vorschau: BestandsresetVorschau;
  /** Der Befund des jüngsten Laufs aus der Laufakte — `null`, wenn es nie einen gab. */
  letzterLauf: BestandsresetBefund | null;
}

export interface BestandsresetDienst {
  stand(): Promise<BestandsresetStand>;
  ausfuehren(laufId: string): Promise<BestandsresetBefund>;
}

/**
 * Die Kennung einer Vorschau. `koFingerabdruck` fasst Kennung und Papierkorbstand JEDES
 * Wissensobjekts zusammen — dieselben Objekte ergeben dieselbe Kennung, ein neues, ein gelöschtes
 * oder ein in den Papierkorb verschobenes eine andere.
 */
export function vorschauKennung(
  koFingerabdruck: string,
  v: Pick<BestandsresetVorschau, "wissensobjekte" | "papierkorb" | "erhalten">,
): string {
  const kanonisch = JSON.stringify([
    koFingerabdruck,
    v.wissensobjekte,
    v.papierkorb,
    v.erhalten.konten,
    v.erhalten.begriffe,
  ]);
  return createHash("sha256").update(kanonisch).digest("hex");
}

// Die Tabellennamen stammen aus der Konstante des Löschgraphen, nie aus einer Eingabe (wie in
// `fuehreBestandsresetAus`); ein Bezeichner kann ohnehin nicht als Parameter gebunden werden.
async function zaehleLoeschgraph(db: Queryable): Promise<{ tabelle: string; zeilen: number }[]> {
  const sql = BESTANDSRESET_LOESCHGRAPH.map(
    (tabelle, i) => `SELECT ${i} AS pos, count(*)::text AS n FROM ${tabelle}`,
  ).join(" UNION ALL ");
  const res = await db.query<{ pos: number; n: string }>(sql);
  const zeilen = new Map(res.rows.map((r) => [Number(r.pos), Number(r.n)]));
  return BESTANDSRESET_LOESCHGRAPH.map((tabelle, i) => ({ tabelle, zeilen: zeilen.get(i) ?? 0 }));
}

// Der Papierkorb in SQL wie `!ko.deletedAt` (s. `sqlDeletedAtLeer`): ein Objekt liegt nur dann
// darin, wenn `deletedAt` einen wahren Wert trägt.
const DELETED_AT_LEER = sqlDeletedAtLeer("k");
const IM_PAPIERKORB = `coalesce(k.deleted_at_key IS NOT NULL AND NOT ${DELETED_AT_LEER}, false)`;
interface KoZeile {
  gesamt: string;
  papierkorb: string;
  fingerabdruck: string;
}
const SQL_WISSENSOBJEKTE = `
SELECT count(*)::text AS gesamt,
       (count(*) FILTER (WHERE ${IM_PAPIERKORB}))::text AS papierkorb,
       md5(coalesce(string_agg(k.id || ':' || (${IM_PAPIERKORB})::text, ',' ORDER BY k.id), ''))
         AS fingerabdruck
  FROM kos k`;

// Was bleibt: die Konten und das Firmenwörterbuch (Anzahl Begriffe, nicht Fassungen).
const SQL_ERHALTEN = `
SELECT (SELECT count(*) FROM users)::text AS konten,
       (SELECT count(DISTINCT begriff_id) FROM begriffe_fassungen)::text AS begriffe`;

async function vorschauAus(db: Queryable): Promise<BestandsresetVorschau> {
  const geloescht = await zaehleLoeschgraph(db);
  const ko = (await db.query<KoZeile>(SQL_WISSENSOBJEKTE)).rows[0];
  const bleibt = (await db.query<{ konten: string; begriffe: string }>(SQL_ERHALTEN)).rows[0];
  const ohneKennung = {
    geloescht,
    wissensobjekte: Number(ko?.gesamt ?? 0),
    papierkorb: Number(ko?.papierkorb ?? 0),
    erhalten: { konten: Number(bleibt?.konten ?? 0), begriffe: Number(bleibt?.begriffe ?? 0) },
  };
  return { ...ohneKennung, kennung: vorschauKennung(ko?.fingerabdruck ?? "", ohneKennung) };
}

/**
 * Der Dienst über dem ROHEN Pool. Roh, weil der Reset selbst die exklusive Sperre nimmt und sich mit
 * der geteilten seiner eigenen Kapselung im Weg stünde (s. `bestandsreset.ts`), und weil der Befund
 * auch WÄHREND eines laufenden Resets antworten muss (s. `bestandsresetBefund`).
 */
export function pgBestandsresetDienst(rohPool: Pool): BestandsresetDienst {
  const db = poolQueryable(rohPool);
  const sperreGehalten = async (q: Queryable): Promise<boolean> =>
    (await q.query<{ gehalten: boolean }>(SQL_SPERRE_WIRD_GEHALTEN)).rows[0]?.gehalten === true;
  return {
    stand: async () => ({
      vorschau: await vorschauAus(db),
      letzterLauf: (await bestandsresetBefund(db, sperreGehalten)) ?? null,
    }),
    ausfuehren: (laufId) => fuehreBestandsresetAus(rohPool, laufId),
  };
}

// ================================================================================================
// DIE FREIGABE — reine Prüfung des Rumpfs, vor jeder Datenbankfrage.
// ================================================================================================

export type FreigabeFehler =
  | "BESTAETIGUNG_FEHLT"
  | "VORSCHAU_FEHLT"
  | "PASSWORT_FEHLT"
  | "PASSWORT_UNGLEICH";

export type Freigabe =
  | { ok: true; passwort: string; vorschauKennung: string }
  | { ok: false; fehler: FreigabeFehler; meldung: string };

/**
 * Prüft, ob der Rumpf alle drei verlangten Bestätigungen trägt: die gesehene Vorschau (ihre
 * Kennung), das zweimal gleich eingegebene Passwort und das gesetzte Häkchen. Ob das Passwort
 * STIMMT, entscheidet danach der Aufrufer gegen das Konto — hier wird nur die Form geprüft.
 */
export function pruefeFreigabe(body: unknown): Freigabe {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.folgenBestaetigt !== true) {
    return {
      ok: false,
      fehler: "BESTAETIGUNG_FEHLT",
      meldung: "Bitte bestätige mit dem Häkchen, dass du die Folgen gelesen hast.",
    };
  }
  const kennung = typeof b.vorschauKennung === "string" ? b.vorschauKennung : "";
  if (!/^[0-9a-f]{64}$/.test(kennung)) {
    return {
      ok: false,
      fehler: "VORSCHAU_FEHLT",
      meldung: "Die Folgenvorschau fehlt. Lade sie, bevor du zurücksetzt.",
    };
  }
  const passwort = typeof b.passwort === "string" ? b.passwort : "";
  const wiederholung = typeof b.passwortWiederholung === "string" ? b.passwortWiederholung : "";
  if (passwort === "" || wiederholung === "") {
    return {
      ok: false,
      fehler: "PASSWORT_FEHLT",
      meldung: "Bitte gib dein Passwort zweimal ein.",
    };
  }
  if (passwort !== wiederholung) {
    return {
      ok: false,
      fehler: "PASSWORT_UNGLEICH",
      meldung: "Die beiden Passworteingaben stimmen nicht überein.",
    };
  }
  return { ok: true, passwort, vorschauKennung: kennung };
}
