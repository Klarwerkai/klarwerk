import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { KlaraGespraechRepo, KlaraObjektbezug } from "./klara-gespraech";
import type { KlaraNotizRepo } from "./klara-notiz";

// ================================================================================================
// produkt:20261008:klara-aufgaben (Klara 07) — PERSÖNLICHE AUFGABEN UNTER DER EIGENEN PERSON.
// ================================================================================================
//
// „Persönliche Aufgaben aus einer Notiz oder einem Auftrag erstellen, öffnen, ändern, priorisieren
// und erledigen. Inhalt, Bezug und persönliche Zuständigkeit zeigen. … Unternehmensaufgaben nicht
// ohne bewusste Auswahl als persönliche umetikettieren." (Auftrag Klara 07.)
//
// DERSELBE DATENRAUM-ZUSCHNITT wie die Notizen (`klara-notiz.ts`):
//   · Eine Aufgabe gehört GENAU EINEM KONTO, und dieses Konto ist zugleich die zuständige Person.
//     Jede Operation nimmt die Kontokennung aus der Sitzung; eine fremde und eine unbekannte Aufgabe
//     antworten gleich (404). Auch Administratoren lesen fremde Aufgaben nicht.
//   · GELTUNGSBEREICH: immer `persoenlich`. Die gemeinsam sichtbaren Aufgaben (Prüfung, Konflikt,
//     Lücke, Rückgabe, Übergabe — „Meine Aufgaben") bleiben in ihren Quellen mit ihren Rechten; diese
//     Ablage liest, kopiert und ändert sie nicht, und ihre Einträge erscheinen in keiner dieser
//     Quellen und in keinem gemeinsamen Zähler. Wer einen anderen Bereich verlangt, bekommt 400.
//   · ZWEI WEGE, beide mit belegtem BEZUG, den der SERVER liest:
//       `notiz`   — aus einer EIGENEN Notiz (`klara_notizen`): Notizkennung und -titel, der Rücklink
//                   der Notiz wird der Ort der Aufgabe; Titel und Inhalt der Notiz sind Vorgabe.
//       `auftrag` — aus einem Klara-Auftrag im EIGENEN Gespräch, dessen gebundener Plan genau diesen
//                   Schritt („persönliche Aufgabe anlegen" mit diesem Titel) enthält. Der Wortlaut
//                   und die Art (getippt/gesprochen) des Auftrags stehen am Bezug, der Ort ist der
//                   des Gesprächs. Angelegt wird so nur über den gemeinsamen Aktionsweg
//                   (`klara-ausfuehrung.ts`), nie als freie Behauptung des Browsers.
//   · KEINE DOPPELAUFGABE: Jedes Anlegen trägt einen Vorgangsschlüssel; derselbe Vorgang antwortet
//     mit der schon gespeicherten Aufgabe (`wiederholt: true`). Ein eindeutiger Index
//     (konto_id, vorgang) sichert das auch gegen gleichzeitige Versuche.
//   · KEIN STILLES ÜBERSCHREIBEN: Bearbeiten, Priorisieren und Erledigen nennen die gesehene Fassung;
//     dieselbe Änderung ein zweites Mal (Antwort verloren) erkennt der Server am Inhalt.
//
// BEWUSST NICHT HIER: Fälligkeit/Erinnerung (Klara 10/11), Weitergabe an andere Personen und
// Übernahme in gemeinsames Wissen (Klara 08). Der Server ruft keine KI.

export type KlaraAufgabeWeg = "notiz" | "auftrag";
export type KlaraAufgabePrioritaet = "hoch" | "mittel" | "niedrig";
export type KlaraAufgabeStatus = "offen" | "erledigt";

const WEGE: readonly KlaraAufgabeWeg[] = ["notiz", "auftrag"];
/** Dieselben drei Stufen und Wörter wie die Priorität einer Lücke (`klara-auftrag.ts`). */
export const KLARA_AUFGABE_PRIORITAETEN: readonly KlaraAufgabePrioritaet[] = [
  "hoch",
  "mittel",
  "niedrig",
];
export const KLARA_AUFGABE_STATUS: readonly KlaraAufgabeStatus[] = ["offen", "erledigt"];

/** Der Geltungsbereich. Es gibt hier genau einen — die gemeinsamen Aufgaben wohnen anderswo. */
export const KLARA_AUFGABE_BEREICH = "persoenlich" as const;

/** Die Aktion des gemeinsamen Aktionswegs, aus der eine Aufgabe „aus einem Auftrag" entsteht. */
export const KLARA_AUFGABE_AKTION = "persoenliche_aufgabe_anlegen" as const;

export type KlaraAufgabeBezug =
  | { readonly art: "notiz"; readonly notizId: string; readonly notizTitel: string }
  | {
      readonly art: "auftrag";
      readonly gespraechId: string;
      readonly auftragId: string;
      readonly wortlaut: string;
      readonly quelle: "getippt" | "gesprochen";
    };

export interface KlaraAufgabe {
  readonly id: string;
  /** Eigentümer UND zuständige Person — eine persönliche Aufgabe hat keine zweite. */
  readonly kontoId: string;
  readonly vorgang: string;
  readonly bereich: typeof KLARA_AUFGABE_BEREICH;
  readonly weg: KlaraAufgabeWeg;
  readonly titel: string;
  readonly inhalt: string;
  readonly prioritaet: KlaraAufgabePrioritaet;
  readonly status: KlaraAufgabeStatus;
  /** Woraus die Aufgabe entstand — vom Server gelesen, nie vom Browser behauptet. */
  readonly bezug: KlaraAufgabeBezug;
  /** Der Ort: Rücklink der Notiz bzw. Ort des Gesprächs beim Auftrag. Ändert sich nie. */
  readonly objektbezug: KlaraObjektbezug;
  readonly angelegtAm: string;
  readonly geaendertAm: string;
  readonly erledigtAm: string | null;
  readonly fassung: number;
}

export const KLARA_AUFGABE_TITEL_MAX = 200;
export const KLARA_AUFGABE_INHALT_MAX = 20_000;
export const KLARA_AUFGABE_MAX_JE_KONTO = 2_000;
export const KLARA_AUFGABE_LISTE_MAX = 500;
const VORGANG_RE = /^[A-Za-z0-9_-]{8,100}$/;

const PRIORITAETS_RANG: Record<KlaraAufgabePrioritaet, number> = { hoch: 0, mittel: 1, niedrig: 2 };

/**
 * Die Reihenfolge der eigenen Liste — für Speicher und Datenbank DIESELBE Regel: offene vor
 * erledigten, dann höhere Priorität, dann zuletzt geänderte.
 */
export function aufgabenOrdnung(a: KlaraAufgabe, b: KlaraAufgabe): number {
  if (a.status !== b.status) {
    return a.status === "offen" ? -1 : 1;
  }
  return (
    PRIORITAETS_RANG[a.prioritaet] - PRIORITAETS_RANG[b.prioritaet] ||
    b.geaendertAm.localeCompare(a.geaendertAm) ||
    b.id.localeCompare(a.id)
  );
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export interface KlaraAufgabeRepo {
  hole(kontoId: string, id: string): Promise<KlaraAufgabe | null>;
  zuVorgang(kontoId: string, vorgang: string): Promise<KlaraAufgabe | null>;
  /** Die eigenen Aufgaben (wahlweise nur ein Status), zuletzt geänderte zuerst. */
  liste(kontoId: string, status: KlaraAufgabeStatus | null, limit: number): Promise<KlaraAufgabe[]>;
  anzahl(kontoId: string): Promise<number>;
  /** Legt `a` an — oder `false`, wenn das Konto diesen Vorgang schon hat (nichts geschrieben). */
  lege(a: KlaraAufgabe): Promise<boolean>;
  /** Schreibt `a`, wenn die gespeicherte Aufgabe noch `fassung - 1` trägt; sonst `false`. */
  ersetze(a: KlaraAufgabe): Promise<boolean>;
  entferne(kontoId: string, id: string): Promise<boolean>;
}

export class InMemoryKlaraAufgabeRepo implements KlaraAufgabeRepo {
  private readonly aufgaben = new Map<string, KlaraAufgabe>();

  private eigene(kontoId: string): KlaraAufgabe[] {
    return [...this.aufgaben.values()].filter((a) => a.kontoId === kontoId);
  }

  hole(kontoId: string, id: string): Promise<KlaraAufgabe | null> {
    const a = this.aufgaben.get(id);
    return Promise.resolve(a?.kontoId === kontoId ? a : null);
  }

  zuVorgang(kontoId: string, vorgang: string): Promise<KlaraAufgabe | null> {
    return Promise.resolve(this.eigene(kontoId).find((a) => a.vorgang === vorgang) ?? null);
  }

  liste(
    kontoId: string,
    status: KlaraAufgabeStatus | null,
    limit: number,
  ): Promise<KlaraAufgabe[]> {
    const treffer = this.eigene(kontoId)
      .filter((a) => status === null || a.status === status)
      .sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm) || b.id.localeCompare(a.id));
    return Promise.resolve(treffer.slice(0, limit));
  }

  anzahl(kontoId: string): Promise<number> {
    return Promise.resolve(this.eigene(kontoId).length);
  }

  lege(a: KlaraAufgabe): Promise<boolean> {
    if (this.eigene(a.kontoId).some((x) => x.vorgang === a.vorgang)) {
      return Promise.resolve(false);
    }
    this.aufgaben.set(a.id, a);
    return Promise.resolve(true);
  }

  ersetze(a: KlaraAufgabe): Promise<boolean> {
    const alt = this.aufgaben.get(a.id);
    if (!alt || alt.kontoId !== a.kontoId || alt.fassung !== a.fassung - 1) {
      return Promise.resolve(false);
    }
    this.aufgaben.set(a.id, a);
    return Promise.resolve(true);
  }

  entferne(kontoId: string, id: string): Promise<boolean> {
    const a = this.aufgaben.get(id);
    if (!a || a.kontoId !== kontoId) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.aufgaben.delete(id));
  }
}

/**
 * Eine Zeile je Aufgabe, der Inhalt als JSON. REIN ADDITIV UND WIEDERHOLBAR: ein `CREATE TABLE IF
 * NOT EXISTS`, ein `CREATE UNIQUE INDEX IF NOT EXISTS` (der Vorgangsschlüssel je Konto — keine
 * Doppelaufgabe) und ein `CREATE INDEX IF NOT EXISTS`; kein DROP, kein Fremdschlüssel, keine
 * Extension, kein Seed.
 */
export const KLARA_AUFGABE_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_aufgaben (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  vorgang text NOT NULL,
  fassung integer NOT NULL,
  status text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_klara_aufgaben_vorgang
  ON klara_aufgaben (konto_id, vorgang);
CREATE INDEX IF NOT EXISTS idx_klara_aufgaben_konto
  ON klara_aufgaben (konto_id, geaendert_am DESC);
`;

export class PgKlaraAufgabeRepo implements KlaraAufgabeRepo {
  constructor(private readonly pool: Pool) {}

  async hole(kontoId: string, id: string): Promise<KlaraAufgabe | null> {
    const res = await this.pool.query<{ data: KlaraAufgabe }>(
      "SELECT data FROM klara_aufgaben WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async zuVorgang(kontoId: string, vorgang: string): Promise<KlaraAufgabe | null> {
    const res = await this.pool.query<{ data: KlaraAufgabe }>(
      "SELECT data FROM klara_aufgaben WHERE konto_id = $1 AND vorgang = $2",
      [kontoId, vorgang],
    );
    return res.rows[0]?.data ?? null;
  }

  async liste(
    kontoId: string,
    status: KlaraAufgabeStatus | null,
    limit: number,
  ): Promise<KlaraAufgabe[]> {
    const res = await this.pool.query<{ data: KlaraAufgabe }>(
      `SELECT data FROM klara_aufgaben
        WHERE konto_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY geaendert_am DESC, id DESC
        LIMIT $3`,
      [kontoId, status, limit],
    );
    return res.rows.map((r) => r.data);
  }

  async anzahl(kontoId: string): Promise<number> {
    const res = await this.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_aufgaben WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? 0;
  }

  async lege(a: KlaraAufgabe): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO klara_aufgaben (id, konto_id, vorgang, fassung, status, geaendert_am, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (konto_id, vorgang) DO NOTHING`,
      [a.id, a.kontoId, a.vorgang, a.fassung, a.status, a.geaendertAm, JSON.stringify(a)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async ersetze(a: KlaraAufgabe): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_aufgaben SET fassung = $3, status = $4, geaendert_am = $5, data = $6
        WHERE id = $1 AND konto_id = $2 AND fassung = $7`,
      [a.id, a.kontoId, a.fassung, a.status, a.geaendertAm, JSON.stringify(a), a.fassung - 1],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferne(kontoId: string, id: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM klara_aufgaben WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type KlaraAufgabeGrund =
  | "eingabe"
  | "unbekannt"
  | "quelle_unbekannt"
  | "vorgang_belegt"
  | "voll"
  | "konflikt";

export class KlaraAufgabeFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KlaraAufgabeGrund,
    message: string,
  ) {
    super(message);
    this.name = "KlaraAufgabeFehler";
  }
}

export interface KlaraAufgabeEingabe {
  vorgang?: unknown;
  weg?: unknown;
  bereich?: unknown;
  quelle?: unknown;
  titel?: unknown;
  inhalt?: unknown;
  prioritaet?: unknown;
}

export interface KlaraAufgabeAenderung {
  fassung?: unknown;
  titel?: unknown;
  inhalt?: unknown;
  prioritaet?: unknown;
  status?: unknown;
}

export interface KlaraAufgabeDienstDeps {
  readonly repo: KlaraAufgabeRepo;
  /** Die eigenen Notizen — für Aufgaben aus einer Notiz. */
  readonly notizen?: Pick<KlaraNotizRepo, "hole">;
  /** Die eigenen Gespräche — für Aufgaben aus einem Klara-Auftrag. */
  readonly gespraeche?: Pick<KlaraGespraechRepo, "hole">;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

function eingabeFehler(message: string): KlaraAufgabeFehler {
  return new KlaraAufgabeFehler(400, "eingabe", message);
}

function wahl<T extends string>(wert: unknown, erlaubt: readonly T[], feld: string): T | null {
  if (wert === undefined || wert === null) {
    return null;
  }
  if (typeof wert !== "string" || !(erlaubt as readonly string[]).includes(wert)) {
    throw eingabeFehler(`${feld} muss einer der Werte ${erlaubt.join(", ")} sein.`);
  }
  return wert as T;
}

function titelAus(wert: unknown): string {
  if (
    typeof wert !== "string" ||
    wert.trim().length === 0 ||
    wert.length > KLARA_AUFGABE_TITEL_MAX
  ) {
    throw eingabeFehler(`titel ist Pflicht und höchstens ${KLARA_AUFGABE_TITEL_MAX} Zeichen lang.`);
  }
  return wert.trim();
}

function inhaltAus(wert: unknown): string {
  if (typeof wert !== "string" || wert.length > KLARA_AUFGABE_INHALT_MAX) {
    throw eingabeFehler(`inhalt ist höchstens ${KLARA_AUFGABE_INHALT_MAX} Zeichen lang.`);
  }
  return wert;
}

/** Ein Titel aus fremdem Text (Notiz): die erste Zeile, gekürzt — nicht erfunden. */
function kurz(text: string): string {
  const ersteZeile = text.trim().split("\n")[0]?.trim() ?? "";
  const max = KLARA_AUFGABE_TITEL_MAX;
  return [...ersteZeile].length > max
    ? `${[...ersteZeile].slice(0, max - 1).join("")}…`
    : ersteZeile;
}

type Felder = Pick<KlaraAufgabe, "titel" | "inhalt" | "prioritaet" | "status">;

function gleicherInhalt(a: Felder, b: Felder): boolean {
  return (
    a.titel === b.titel &&
    a.inhalt === b.inhalt &&
    a.prioritaet === b.prioritaet &&
    a.status === b.status
  );
}

function quelleAus(roh: unknown, felder: readonly string[]): Record<string, string> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw eingabeFehler(`quelle (${felder.join(", ")}) ist Pflicht.`);
  }
  const o = roh as Record<string, unknown>;
  const aus: Record<string, string> = {};
  for (const f of felder) {
    const w = o[f];
    if (typeof w !== "string" || w.length === 0 || w.length > 200) {
      throw eingabeFehler(`quelle.${f} ist Pflicht (höchstens 200 Zeichen).`);
    }
    aus[f] = w;
  }
  return aus;
}

export class KlaraAufgabeDienst {
  private readonly repo: KlaraAufgabeRepo;
  private readonly notizen: KlaraAufgabeDienstDeps["notizen"];
  private readonly gespraeche: KlaraAufgabeDienstDeps["gespraeche"];
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: KlaraAufgabeDienstDeps) {
    this.repo = deps.repo;
    this.notizen = deps.notizen;
    this.gespraeche = deps.gespraeche;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  async hole(kontoId: string, id: string): Promise<KlaraAufgabe> {
    const a = await this.repo.hole(kontoId, id);
    if (!a) {
      // Fremd und unbekannt antworten gleich — die Kennung verrät nichts über fremde Aufgaben.
      throw new KlaraAufgabeFehler(404, "unbekannt", "Aufgabe nicht gefunden.");
    }
    return a;
  }

  async liste(kontoId: string, status: unknown): Promise<KlaraAufgabe[]> {
    const s = wahl(status === "" ? undefined : status, KLARA_AUFGABE_STATUS, "status");
    const roh = await this.repo.liste(kontoId, s, KLARA_AUFGABE_LISTE_MAX);
    return [...roh].sort(aufgabenOrdnung);
  }

  /**
   * Legt eine Aufgabe an. Ist der Vorgang schon gespeichert, antwortet der Dienst mit DIESER Aufgabe
   * (`wiederholt: true`) — eine Wiederholung nach einem Fehler legt keine zweite an.
   */
  async lege(
    kontoId: string,
    eingabe: KlaraAufgabeEingabe,
  ): Promise<{ aufgabe: KlaraAufgabe; wiederholt: boolean }> {
    if (typeof eingabe.vorgang !== "string" || !VORGANG_RE.test(eingabe.vorgang)) {
      throw eingabeFehler("vorgang ist Pflicht (8–100 Zeichen aus Buchstaben, Ziffern, - und _).");
    }
    const vorgang = eingabe.vorgang;
    if (eingabe.bereich !== undefined && eingabe.bereich !== KLARA_AUFGABE_BEREICH) {
      // Gemeinsam sichtbare Aufgaben bleiben in ihren Quellen — hier entsteht nur Persönliches.
      throw eingabeFehler(
        "Hier entstehen nur persönliche Aufgaben; gemeinsame Aufgaben bleiben an ihrem Ort.",
      );
    }
    const weg = wahl(eingabe.weg, WEGE, "weg");
    if (weg === null) {
      throw eingabeFehler(`weg ist Pflicht: ${WEGE.join(", ")}.`);
    }
    const prioritaet =
      wahl(eingabe.prioritaet, KLARA_AUFGABE_PRIORITAETEN, "prioritaet") ?? "mittel";

    let titel: string;
    let inhalt: string;
    let bezug: KlaraAufgabeBezug;
    let objektbezug: KlaraObjektbezug;
    if (weg === "notiz") {
      const q = quelleAus(eingabe.quelle, ["notizId"]);
      const notiz = this.notizen ? await this.notizen.hole(kontoId, q.notizId as string) : null;
      if (!notiz) {
        throw new KlaraAufgabeFehler(404, "quelle_unbekannt", "Notiz nicht gefunden.");
      }
      titel =
        eingabe.titel === undefined ? kurz(notiz.titel || notiz.inhalt) : titelAus(eingabe.titel);
      if (titel.length === 0) {
        throw eingabeFehler("titel ist Pflicht.");
      }
      inhalt = eingabe.inhalt === undefined ? notiz.inhalt : inhaltAus(eingabe.inhalt);
      bezug = { art: "notiz", notizId: notiz.id, notizTitel: notiz.titel };
      objektbezug = notiz.objektbezug;
    } else {
      const q = quelleAus(eingabe.quelle, ["gespraechId", "auftragId"]);
      const g = this.gespraeche
        ? await this.gespraeche.hole(kontoId, q.gespraechId as string)
        : null;
      const auftrag = g?.auftraege?.find((x) => x.id === q.auftragId);
      titel = titelAus(eingabe.titel);
      // Nur ein Auftrag, dessen gebundener Plan genau diese Anlage vorsieht, ist ein Bezug.
      const geplant = auftrag?.plan?.some(
        (p) => p.aktion === KLARA_AUFGABE_AKTION && p.ziel?.titel === titel,
      );
      if (!g || !auftrag || !geplant) {
        throw new KlaraAufgabeFehler(404, "quelle_unbekannt", "Auftrag nicht gefunden.");
      }
      inhalt = eingabe.inhalt === undefined ? "" : inhaltAus(eingabe.inhalt);
      bezug = {
        art: "auftrag",
        gespraechId: g.id,
        auftragId: auftrag.id,
        wortlaut: auftrag.wortlaut,
        quelle: auftrag.quelle,
      };
      objektbezug = g.objektbezug;
    }
    const gewollt: Felder = { titel, inhalt, prioritaet, status: "offen" };

    const vorher = await this.repo.zuVorgang(kontoId, vorgang);
    if (vorher) {
      return this.wiederholung(vorher, gewollt);
    }
    if ((await this.repo.anzahl(kontoId)) >= KLARA_AUFGABE_MAX_JE_KONTO) {
      throw new KlaraAufgabeFehler(
        409,
        "voll",
        `Es sind höchstens ${KLARA_AUFGABE_MAX_JE_KONTO} Aufgaben gespeichert. Bitte zuerst erledigte löschen.`,
      );
    }
    const jetzt = this.jetztIso();
    const aufgabe: KlaraAufgabe = {
      id: this.neueId(),
      kontoId,
      vorgang,
      bereich: KLARA_AUFGABE_BEREICH,
      weg,
      ...gewollt,
      bezug,
      objektbezug,
      angelegtAm: jetzt,
      geaendertAm: jetzt,
      erledigtAm: null,
      fassung: 1,
    };
    if (await this.repo.lege(aufgabe)) {
      return { aufgabe, wiederholt: false };
    }
    // Ein gleichzeitiger zweiter Versuch desselben Vorgangs war schneller: dessen Aufgabe gilt.
    const parallel = await this.repo.zuVorgang(kontoId, vorgang);
    if (!parallel) {
      throw new KlaraAufgabeFehler(409, "konflikt", "Die Aufgabe konnte nicht angelegt werden.");
    }
    return this.wiederholung(parallel, gewollt);
  }

  private wiederholung(
    gespeichert: KlaraAufgabe,
    gewollt: Felder,
  ): { aufgabe: KlaraAufgabe; wiederholt: boolean } {
    // Derselbe Vorgang mit ANDEREM Inhalt ist kein Wiederholen, sondern ein Fehler des Aufrufers.
    // Nach einer Bearbeitung zählt die Aufgabe, wie sie jetzt ist.
    if (gespeichert.fassung === 1 && !gleicherInhalt(gespeichert, gewollt)) {
      throw new KlaraAufgabeFehler(
        409,
        "vorgang_belegt",
        "Dieser Vorgang hat bereits eine Aufgabe mit anderem Inhalt angelegt.",
      );
    }
    return { aufgabe: gespeichert, wiederholt: true };
  }

  /**
   * Bearbeitet Titel und Inhalt, setzt die Priorität oder erledigt (bzw. öffnet wieder). `fassung`
   * ist die Fassung, die die Person gesehen hat. Bezug, Ort, Weg und Bereich bleiben unverändert.
   */
  async aendere(
    kontoId: string,
    id: string,
    eingabe: KlaraAufgabeAenderung,
  ): Promise<{ aufgabe: KlaraAufgabe; wiederholt: boolean }> {
    const fassung = eingabe.fassung;
    if (typeof fassung !== "number" || !Number.isSafeInteger(fassung) || fassung < 1) {
      throw eingabeFehler("fassung ist Pflicht (die zuletzt gesehene Fassung).");
    }
    const alt = await this.hole(kontoId, id);
    const gewollt: Felder = {
      titel: eingabe.titel === undefined ? alt.titel : titelAus(eingabe.titel),
      inhalt: eingabe.inhalt === undefined ? alt.inhalt : inhaltAus(eingabe.inhalt),
      prioritaet:
        wahl(eingabe.prioritaet, KLARA_AUFGABE_PRIORITAETEN, "prioritaet") ?? alt.prioritaet,
      status: wahl(eingabe.status, KLARA_AUFGABE_STATUS, "status") ?? alt.status,
    };
    const konflikt = (): KlaraAufgabeFehler =>
      new KlaraAufgabeFehler(
        409,
        "konflikt",
        "Die Aufgabe wurde inzwischen an anderer Stelle geändert. Bitte neu laden und erneut ändern.",
      );
    if (alt.fassung !== fassung) {
      // Dieselbe Änderung kam schon an (die Antwort ging verloren): keine zweite Fassung.
      if (alt.fassung === fassung + 1 && gleicherInhalt(alt, gewollt)) {
        return { aufgabe: alt, wiederholt: true };
      }
      throw konflikt();
    }
    if (gleicherInhalt(alt, gewollt)) {
      return { aufgabe: alt, wiederholt: true };
    }
    const jetzt = this.jetztIso();
    const erledigtAm =
      gewollt.status === "erledigt" ? (alt.status === "erledigt" ? alt.erledigtAm : jetzt) : null;
    const neu: KlaraAufgabe = {
      ...alt,
      ...gewollt,
      erledigtAm,
      geaendertAm: jetzt,
      fassung: alt.fassung + 1,
    };
    if (!(await this.repo.ersetze(neu))) {
      throw konflikt();
    }
    return { aufgabe: neu, wiederholt: false };
  }

  loesche(kontoId: string, id: string): Promise<boolean> {
    return this.repo.entferne(kontoId, id);
  }
}
