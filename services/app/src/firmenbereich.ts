// ================================================================================================
// produkt:20261011:peter-p14 — DER FIRMENFILTER: EIGENE FIRMA, FREIGEGEBENER PARTNER, ÖFFENTLICH.
// ================================================================================================
//
// Peters Entscheidung 51 (11.10.2026): „Firmenfilter als serverseitig berechtigter Firmen-/Partner-/
// öffentlicher Kontext." Dazu P14: „ohne Rechtevergabe durch den Filter", „Mandanten-/Rechteprüfung
// vor Suche und Ausgabe", „manipulierte IDs und Kontextwechsel".
//
// DAS BETRIEBSMODELL BLEIBT: eine Firma je Instanz (`instanzbindung.ts`). Die eigene Firma ist die
// Anlage selbst; es gibt kein Mandantenfeld und keinen Firmenschlüssel, den ein Aufrufer setzen
// könnte. Der Mandant ist geprüft, bevor diese Datei gefragt wird: die Sitzung gilt nur in dieser
// Anlage (`tests/mandanten-isolation`), die Datenbank nur für diese Anlage.
//
// DIE DREI BEREICHE werden aus dem BESTAND abgeleitet, nie aus der Anfrage:
//   · `partner`     — der führende Space steht ausdrücklich im Kontext `partner`
//                     (`SpaceEingabe.kontext`/`partner`, `spaces.ts` · `partnerbereiche`).
//   · `oeffentlich` — Schutzbedarf „öffentlich" am Objekt (`KnowledgeObject.oeffentlich`, nur bei
//                     interner Stufe wirksam — dieselbe Lesart wie `KoService.setOeffentlich`).
//   · `eigen`       — alles andere: das Wissen der eigenen Firma.
// Die Reihenfolge ist fest: ein Objekt im Partnerbereich bleibt Partnerwissen, auch wenn es als
// öffentlich markiert ist — der Bereich sagt, WOHER es kommt.
//
// DER FILTER VERENGT NUR. Er tritt als UND hinter die eine Sichtbarkeitsentscheidung
// (`sichtbarkeit.ts`), in SQL vor jedem Deckel und noch einmal vor der Ausgabe. Er öffnet keinen
// Space, keine Stufe und keine Quellleserliste. Eine Partnerkennung, die kein lesbarer
// Partnerbereich ist, liefert dieselbe leere Antwort wie eine, die es nicht gibt.
import { isConfidential } from "../../knowledge-object";
import type { SichtbarkeitsFakten, SqlSichtbarkeitstrim } from "./sichtbarkeit";

export const FIRMENBEREICHE = ["eigen", "partner", "oeffentlich"] as const;
export type Firmenbereich = (typeof FIRMENBEREICHE)[number];

/** Was die Ableitung über ein Objekt braucht: die Sichtbarkeitsfakten und die Öffentlich-Marke. */
export interface FirmenbereichsFakten extends SichtbarkeitsFakten {
  oeffentlich?: unknown;
}

/** Die Kennungen der ausdrücklich als Partnerbereich markierten Spaces, je Anfrage erhoben. */
export type PartnerbereichQuelle = () => Promise<ReadonlySet<string>>;

/** Die Felder des Firmenfilters am Draht (Abfrage oder Körper), noch ungeprüft. */
export interface FirmenfilterAbfrage {
  firmenbereich?: string | string[];
  partner?: string;
}

/** Die Auswahl einer Anfrage — bereits geprüft. */
export interface Firmenfilter {
  bereiche: ReadonlySet<Firmenbereich>;
  /** Optional genau ein Partnerbereich (Space-Kennung). */
  partner?: string;
}

export class FirmenfilterFehler extends Error {
  readonly code = "FIRMENFILTER_UNGUELTIG";
  constructor() {
    // Bewusst EIN Text für jeden Fehlerfall: die Ablehnung hängt nur an der Form der Eingabe, nie
    // am Bestand — sie sagt nichts darüber, welche Spaces oder Partner es gibt.
    super(
      "Der Firmenfilter ist ungültig. Erlaubt sind firmenbereich=eigen, partner oder oeffentlich (auch kommagetrennt) und optional partner=<Bereichskennung>.",
    );
    this.name = "FirmenfilterFehler";
  }
}

const KENNUNG_RE = /^[\w-]{1,64}$/;

function werteAus(roh: unknown): string[] | undefined {
  if (roh === undefined) {
    return undefined;
  }
  const liste = Array.isArray(roh) ? roh : [roh];
  if (!liste.every((x) => typeof x === "string")) {
    throw new FirmenfilterFehler();
  }
  return (liste as string[]).flatMap((s) => s.split(",")).map((s) => s.trim());
}

/**
 * Liest den Firmenfilter aus Abfrage oder Körper. `undefined`: kein Filter gesetzt — die Antwort
 * bleibt zeichengleich der bisherigen. Jede unbekannte oder mehrdeutige Angabe wirft
 * `FirmenfilterFehler` (400), statt still auf „alles" oder „nichts" zu fallen.
 */
export function leseFirmenfilter(eingabe: {
  firmenbereich?: unknown;
  partner?: unknown;
}): Firmenfilter | undefined {
  const werte = werteAus(eingabe.firmenbereich);
  const partnerRoh = eingabe.partner;
  if (werte === undefined && partnerRoh === undefined) {
    return undefined;
  }
  let partner: string | undefined;
  if (partnerRoh !== undefined) {
    if (typeof partnerRoh !== "string" || !KENNUNG_RE.test(partnerRoh)) {
      throw new FirmenfilterFehler();
    }
    partner = partnerRoh;
  }
  const bereiche = new Set<Firmenbereich>();
  for (const wert of werte ?? (partner ? ["partner"] : [])) {
    if (!FIRMENBEREICHE.includes(wert as Firmenbereich)) {
      throw new FirmenfilterFehler();
    }
    bereiche.add(wert as Firmenbereich);
  }
  if (bereiche.size === 0 || (partner !== undefined && !bereiche.has("partner"))) {
    throw new FirmenfilterFehler();
  }
  return partner === undefined ? { bereiche } : { bereiche, partner };
}

/** Entfernt die Filterfelder aus einer Abfrage, damit sie nicht als Fachfilter weiterreisen. */
export function ohneFirmenfilter<T extends object>(
  abfrage: T,
): Omit<T, "firmenbereich" | "partner"> {
  const {
    firmenbereich: _b,
    partner: _p,
    ...rest
  } = abfrage as T & {
    firmenbereich?: unknown;
    partner?: unknown;
  };
  return rest as Omit<T, "firmenbereich" | "partner">;
}

/** Der Bereich eines Objekts — aus dem Bestand, nie aus der Anfrage. */
export function firmenbereichVon(
  ko: FirmenbereichsFakten,
  partnerbereiche: ReadonlySet<string>,
): Firmenbereich {
  if (typeof ko.spaceId === "string" && partnerbereiche.has(ko.spaceId)) {
    return "partner";
  }
  if (ko.oeffentlich === true && !isConfidential(ko.confidentiality)) {
    return "oeffentlich";
  }
  return "eigen";
}

/** Liegt das Objekt in der gewählten Auswahl? (Nur Eingrenzung — kein Leserecht.) */
export function imFirmenfilter(
  ko: FirmenbereichsFakten,
  filter: Firmenfilter,
  partnerbereiche: ReadonlySet<string>,
): boolean {
  const bereich = firmenbereichVon(ko, partnerbereiche);
  if (!filter.bereiche.has(bereich)) {
    return false;
  }
  return filter.partner === undefined || (bereich === "partner" && ko.spaceId === filter.partner);
}

/**
 * Die Sichtbarkeitsentscheidung, verengt um den Firmenfilter — in BEIDEN Formen des Trims.
 *
 * SQL: der unveränderte Trim des Betrachters UND das Bereichsprädikat. Das Bereichsprädikat liest
 * dieselben Felder der lebenden Zeile wie `firmenbereichVon` (`spaceId`, `oeffentlich`, die
 * generierte Stufenspalte `confidentiality_key`), damit eine Herabstufung oder ein Spacewechsel
 * sofort wirkt. In-Memory: `trifftZu` des Betrachters UND `imFirmenfilter`.
 */
export function firmenTrim(
  basis: SqlSichtbarkeitstrim,
  filter: Firmenfilter,
  partnerbereiche: ReadonlySet<string>,
): SqlSichtbarkeitstrim {
  const partnerListe = [...partnerbereiche];
  return {
    sql(t: string, ab: number): string {
      const basisSql = basis.sql(t, ab);
      const p = ab + basis.params.length;
      // COALESCE: ein fehlendes Feld ergäbe in SQL NULL statt false — und `NOT NULL` ließe ein
      // Objekt ohne Space still aus „eigen" fallen.
      const imPartner = `COALESCE(jsonb_typeof(${t}.data->'spaceId') = 'string' AND ${t}.data->>'spaceId' = ANY($${p}::text[]), false)`;
      const istOeffentlich = `COALESCE(${t}.data->'oeffentlich' = 'true'::jsonb AND ${t}.confidentiality_key = 'intern', false)`;
      const zweige: string[] = [];
      if (filter.bereiche.has("partner")) {
        zweige.push(
          filter.partner === undefined
            ? imPartner
            : `(${imPartner} AND ${t}.data->>'spaceId' = $${p + 1}::text)`,
        );
      }
      if (filter.partner === undefined) {
        if (filter.bereiche.has("oeffentlich")) {
          zweige.push(`(NOT ${imPartner} AND ${istOeffentlich})`);
        }
        if (filter.bereiche.has("eigen")) {
          zweige.push(`(NOT ${imPartner} AND NOT ${istOeffentlich})`);
        }
      }
      const bereich = zweige.length > 0 ? `(${zweige.join(" OR ")})` : "FALSE";
      return `(${basisSql} AND ${bereich})`;
    },
    params:
      filter.partner === undefined
        ? [...basis.params, partnerListe]
        : [...basis.params, partnerListe, filter.partner],
    trifftZu(ko: FirmenbereichsFakten & { deletedAt?: string | null | undefined }): boolean {
      return basis.trifftZu(ko) && imFirmenfilter(ko, filter, partnerbereiche);
    },
  };
}
