import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  KlaraGespraechFehler,
  type KlaraGespraechRepo,
  type KlaraObjektbezug,
  pruefeObjektbezug,
} from "./klara-gespraech";
import type { NotizSchreibbedingung } from "./klara-notiz-schreibbedingung";
import type { KlaraWissensHerkunft } from "./klara-wissensuebernahme";

// ================================================================================================
// produkt:20261007:klara-notizen-aufgaben (Klara 06) — PRIVATE NOTIZEN UNTER DER EIGENEN PERSON.
// ================================================================================================
//
// „Gesprochene oder geschriebene Notiz wird tatsächlich gespeichert und nach erneuter Anmeldung mit
// identischem Inhalt und Rücklink wieder geöffnet. … Andere Personen und Space-Suche sehen
// persönliche Notizen und Gespräche nicht automatisch. Fehlgeschlagene Speicherung ist sichtbar;
// Wiederholung erzeugt keine Doppelnotiz." (Auftrag Klara 06.)
//
// EIN EIGENER DATENRAUM wie das Klara-Gespräch (`klara-gespraech.ts`):
//   · Eine Notiz gehört GENAU EINEM KONTO. Jede Operation nimmt die Kontokennung aus der Sitzung;
//     eine fremde und eine unbekannte Notiz antworten gleich (404). Auch Administratoren lesen
//     fremde Notizen nicht. Die Notizen liegen NICHT im Wissensbestand — die Bibliothekssuche, der
//     Frageweg und jeder Space kennen diese Tabelle nicht.
//   · Der RÜCKLINK ist der geprüfte Objektbezug des Gesprächs (`pruefeObjektbezug`): Seite, Objekt,
//     Artikel/Absatz bzw. Wissensobjekt und Fassung von damals. Er wird beim Anlegen festgehalten und
//     beim Bearbeiten nie verändert.
//   · Vier Wege: getippt (`geschrieben`), diktiert (`diktiert`), aus einer gespeicherten
//     Gesprächsnachricht (`gespraech`) und aus einem markierten Ausschnitt (`ausschnitt`). Aus dem
//     Gespräch übernimmt der SERVER Wortlaut und Bezug der eigenen Nachricht — eine fremde oder
//     erfundene Nachricht wird abgewiesen.
//   · KEINE DOPPELNOTIZ: Jedes Anlegen trägt einen VORGANGSSCHLÜSSEL des Browsers. Wiederholt der
//     Browser nach einem Fehler denselben Vorgang, antwortet der Server mit der schon gespeicherten
//     Notiz (`wiederholt: true`) statt eine zweite anzulegen. Die Datenbank sichert das mit einem
//     eindeutigen Index (konto_id, vorgang) auch gegen zwei gleichzeitige Versuche.
//   · KEIN STILLES ÜBERSCHREIBEN: Bearbeiten nennt die Fassung, die die Person gesehen hat. Eine
//     Wiederholung derselben Änderung (Antwort ging verloren) erkennt der Server am Inhalt.
//
// BEWUSST NICHT HIER: Aufgaben, gemeinsames Wissen, Übernahme in Artikel oder Space und Präferenzen
// (eigene Folgeaufträge). Der Server ruft keine KI.

export type KlaraNotizArt = "notiz" | "arbeitszettel";
export type KlaraNotizWeg = "geschrieben" | "diktiert" | "gespraech" | "ausschnitt";

const ARTEN: readonly KlaraNotizArt[] = ["notiz", "arbeitszettel"];
const WEGE: readonly KlaraNotizWeg[] = ["geschrieben", "diktiert", "gespraech", "ausschnitt"];

/** Woher eine Notiz aus dem Gespräch stammt — Kennungen, nie Wortlaut. */
export interface KlaraNotizQuelle {
  readonly gespraechId: string;
  readonly nachrichtId: string;
}

export interface KlaraNotiz {
  readonly wissensHerkunft?: KlaraWissensHerkunft;
  /** Nur serverseitig aus g/n: null = ohne Antwortbezug, fehlend = ungeklärter Altbestand. */
  readonly antwortId?: string | null;
  readonly id: string;
  readonly kontoId: string;
  /** Der Vorgangsschlüssel des Anlegens — eine Wiederholung mit ihm legt nichts Zweites an. */
  readonly vorgang: string;
  readonly art: KlaraNotizArt;
  readonly weg: KlaraNotizWeg;
  readonly titel: string;
  readonly inhalt: string;
  /** Offene Fragen des persönlichen Arbeitszettels. */
  readonly offeneFragen: readonly string[];
  /** Der Rücklink: Seite und Objekt (Artikel/Absatz, Wissensobjekt/Fassung) beim Anlegen. */
  readonly objektbezug: KlaraObjektbezug;
  readonly quelle: KlaraNotizQuelle | null;
  readonly angelegtAm: string;
  readonly geaendertAm: string;
  readonly fassung: number;
}

export function notizIstQuellengebunden(n: KlaraNotiz): boolean {
  return (
    !!n.wissensHerkunft ||
    (n.antwortId !== undefined && n.antwortId !== null) ||
    (!!n.quelle && (n.antwortId !== null || !!n.objektbezug.koId))
  );
}

export const KLARA_NOTIZ_INHALT_MAX = 20_000;
export const KLARA_NOTIZ_TITEL_MAX = 200;
export const KLARA_NOTIZ_FRAGEN_MAX = 50;
export const KLARA_NOTIZ_FRAGE_MAX = 500;
export const KLARA_NOTIZ_MAX_JE_KONTO = 2_000;
export const KLARA_NOTIZ_LISTE_MAX = 200;
const VORGANG_RE = /^[A-Za-z0-9_-]{8,100}$/;

/** Der durchsuchbare Text einer Notiz — klein geschrieben, nur aus Titel, Inhalt, Fragen und Ort. */
export function suchtextVon(
  n: Pick<KlaraNotiz, "titel" | "inhalt" | "offeneFragen" | "objektbezug">,
): string {
  return [n.titel, n.inhalt, ...n.offeneFragen, n.objektbezug.objekt, n.objektbezug.seitenName]
    .join("\n")
    .toLowerCase();
}

/** Die Suchwörter: klein geschrieben, an Leerraum getrennt, höchstens acht. */
export function suchwoerter(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export interface KlaraNotizFilter {
  /** Suchwörter (klein); jede Notiz muss alle enthalten. Leer = alle. */
  readonly woerter: readonly string[];
  readonly art: KlaraNotizArt | null;
  readonly limit: number;
}

export type { NotizSchreibbedingung };

export interface KlaraNotizRepo {
  hole(kontoId: string, id: string): Promise<KlaraNotiz | null>;
  zuVorgang(kontoId: string, vorgang: string): Promise<KlaraNotiz | null>;
  /** Die eigenen Notizen, zuletzt geänderte zuerst. */
  liste(kontoId: string, filter: KlaraNotizFilter): Promise<KlaraNotiz[]>;
  anzahl(kontoId: string): Promise<number>;
  /**
   * Legt `n` an — oder `false`, wenn das Konto diesen Vorgang schon hat oder die `bedingung` nicht
   * (mehr) gilt (nichts geschrieben).
   */
  lege(n: KlaraNotiz, bedingung?: NotizSchreibbedingung): Promise<boolean>;
  /** Schreibt `n`, wenn die gespeicherte Notiz noch `fassung - 1` trägt (und die Bedingung gilt). */
  ersetze(n: KlaraNotiz, bedingung?: NotizSchreibbedingung): Promise<boolean>;
  entferne(kontoId: string, id: string): Promise<boolean>;
}

export class InMemoryKlaraNotizRepo implements KlaraNotizRepo {
  private readonly notizen = new Map<string, KlaraNotiz>();
  private readonly geschrieben = new Map<string, number>();
  private takt = 0;

  private eigene(kontoId: string): KlaraNotiz[] {
    return [...this.notizen.values()].filter((n) => n.kontoId === kontoId);
  }

  hole(kontoId: string, id: string): Promise<KlaraNotiz | null> {
    const n = this.notizen.get(id);
    return Promise.resolve(n?.kontoId === kontoId ? n : null);
  }

  zuVorgang(kontoId: string, vorgang: string): Promise<KlaraNotiz | null> {
    return Promise.resolve(this.eigene(kontoId).find((n) => n.vorgang === vorgang) ?? null);
  }

  liste(kontoId: string, filter: KlaraNotizFilter): Promise<KlaraNotiz[]> {
    const treffer = this.eigene(kontoId)
      .filter((n) => filter.art === null || n.art === filter.art)
      .filter((n) => {
        const text = suchtextVon(n);
        return filter.woerter.every((w) => text.includes(w));
      })
      .sort(
        (a, b) =>
          b.geaendertAm.localeCompare(a.geaendertAm) ||
          (this.geschrieben.get(b.id) ?? 0) - (this.geschrieben.get(a.id) ?? 0),
      );
    return Promise.resolve(treffer.slice(0, filter.limit));
  }

  anzahl(kontoId: string): Promise<number> {
    return Promise.resolve(this.eigene(kontoId).length);
  }

  lege(n: KlaraNotiz, bedingung?: NotizSchreibbedingung): Promise<boolean> {
    if (this.eigene(n.kontoId).some((x) => x.vorgang === n.vorgang)) {
      return Promise.resolve(false);
    }
    // Zwischen Prüfung und Schreiben liegt kein `await`.
    if (bedingung?.gilt && !bedingung.gilt()) {
      return Promise.resolve(false);
    }
    this.notizen.set(n.id, n);
    this.takt += 1;
    this.geschrieben.set(n.id, this.takt);
    return Promise.resolve(true);
  }

  ersetze(n: KlaraNotiz, bedingung?: NotizSchreibbedingung): Promise<boolean> {
    const alt = this.notizen.get(n.id);
    if (!alt || alt.kontoId !== n.kontoId || alt.fassung !== n.fassung - 1) {
      return Promise.resolve(false);
    }
    if (bedingung?.gilt && !bedingung.gilt()) {
      return Promise.resolve(false);
    }
    this.notizen.set(n.id, n);
    this.takt += 1;
    this.geschrieben.set(n.id, this.takt);
    return Promise.resolve(true);
  }

  entferne(kontoId: string, id: string): Promise<boolean> {
    const n = this.notizen.get(id);
    if (!n || n.kontoId !== kontoId) {
      return Promise.resolve(false);
    }
    this.geschrieben.delete(id);
    return Promise.resolve(this.notizen.delete(id));
  }
}

/**
 * Eine Zeile je Notiz, der Inhalt als JSON, daneben der klein geschriebene Suchtext. REIN ADDITIV
 * UND WIEDERHOLBAR: ein `CREATE TABLE IF NOT EXISTS`, ein `CREATE UNIQUE INDEX IF NOT EXISTS` (der
 * Vorgangsschlüssel je Konto — keine Doppelnotiz) und ein `CREATE INDEX IF NOT EXISTS`; kein DROP,
 * kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const KLARA_NOTIZ_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_notizen (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  vorgang text NOT NULL,
  fassung integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  suchtext text NOT NULL,
  data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_klara_notizen_vorgang
  ON klara_notizen (konto_id, vorgang);
CREATE INDEX IF NOT EXISTS idx_klara_notizen_konto
  ON klara_notizen (konto_id, geaendert_am DESC);
`;

/** Ein Suchwort als LIKE-Muster — `%`, `_` und `\` stehen wörtlich. */
function likeMuster(wort: string): string {
  return `%${wort.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
}

export class PgKlaraNotizRepo implements KlaraNotizRepo {
  constructor(private readonly pool: Pool) {}

  async hole(kontoId: string, id: string): Promise<KlaraNotiz | null> {
    const res = await this.pool.query<{ data: KlaraNotiz }>(
      "SELECT data FROM klara_notizen WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async zuVorgang(kontoId: string, vorgang: string): Promise<KlaraNotiz | null> {
    const res = await this.pool.query<{ data: KlaraNotiz }>(
      "SELECT data FROM klara_notizen WHERE konto_id = $1 AND vorgang = $2",
      [kontoId, vorgang],
    );
    return res.rows[0]?.data ?? null;
  }

  async liste(kontoId: string, filter: KlaraNotizFilter): Promise<KlaraNotiz[]> {
    const res = await this.pool.query<{ data: KlaraNotiz }>(
      `SELECT data FROM klara_notizen
        WHERE konto_id = $1
          AND ($2::text IS NULL OR data->>'art' = $2)
          AND suchtext LIKE ALL ($3::text[])
        ORDER BY geaendert_am DESC, id DESC
        LIMIT $4`,
      [kontoId, filter.art, filter.woerter.map(likeMuster), filter.limit],
    );
    return res.rows.map((r) => r.data);
  }

  async anzahl(kontoId: string): Promise<number> {
    const res = await this.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_notizen WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? 0;
  }

  async lege(n: KlaraNotiz, bedingung?: NotizSchreibbedingung): Promise<boolean> {
    const werte = [
      n.id,
      n.kontoId,
      n.vorgang,
      n.fassung,
      n.geaendertAm,
      suchtextVon(n),
      JSON.stringify(n),
    ];
    const zusatz = bedingung?.sql?.(werte.length + 1);
    const res = zusatz
      ? await this.pool.query(
          // Mit Bedingung EIN Befehl: gilt sie beim Schreiben nicht (mehr), entsteht nichts.
          `INSERT INTO klara_notizen (id, konto_id, vorgang, fassung, geaendert_am, suchtext, data)
           SELECT $1::text, $2::text, $3::text, $4::int, $5::timestamptz, $6::text, $7::jsonb
            WHERE ${zusatz.und.length > 0 ? zusatz.und.join("\n              AND ") : "true"}
           ON CONFLICT (konto_id, vorgang) DO NOTHING`,
          [...werte, ...zusatz.params],
        )
      : await this.pool.query(
          `INSERT INTO klara_notizen (id, konto_id, vorgang, fassung, geaendert_am, suchtext, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (konto_id, vorgang) DO NOTHING`,
          werte,
        );
    return (res.rowCount ?? 0) > 0;
  }

  async ersetze(n: KlaraNotiz, bedingung?: NotizSchreibbedingung): Promise<boolean> {
    const werte = [
      n.id,
      n.kontoId,
      n.fassung,
      n.geaendertAm,
      suchtextVon(n),
      JSON.stringify(n),
      n.fassung - 1,
    ];
    const zusatz = bedingung?.sql?.(werte.length + 1);
    const und = zusatz && zusatz.und.length > 0 ? ` AND ${zusatz.und.join(" AND ")}` : "";
    const res = await this.pool.query(
      `UPDATE klara_notizen SET fassung = $3, geaendert_am = $4, suchtext = $5, data = $6
        WHERE id = $1 AND konto_id = $2 AND fassung = $7${und}`,
      [...werte, ...(zusatz?.params ?? [])],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferne(kontoId: string, id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM klara_notizen WHERE id = $1 AND konto_id = $2", [
      id,
      kontoId,
    ]);
    return (res.rowCount ?? 0) > 0;
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type KlaraNotizGrund =
  | "eingabe"
  | "unbekannt"
  | "quelle_unbekannt"
  | "vorgang_belegt"
  | "voll"
  | "konflikt"
  /** Die Schreibbedingung der aufrufenden Steuerung galt beim Schreiben nicht (mehr). */
  | "bedingung";

export class KlaraNotizFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KlaraNotizGrund,
    message: string,
  ) {
    super(message);
    this.name = "KlaraNotizFehler";
  }
}

export interface KlaraNotizEingabe {
  vorgang?: unknown;
  weg?: unknown;
  art?: unknown;
  titel?: unknown;
  inhalt?: unknown;
  offeneFragen?: unknown;
  objektbezug?: unknown;
  quelle?: unknown;
}

export interface KlaraNotizAenderung {
  fassung?: unknown;
  art?: unknown;
  titel?: unknown;
  inhalt?: unknown;
  offeneFragen?: unknown;
}

export interface KlaraNotizDienstDeps {
  readonly repo: KlaraNotizRepo;
  /** Die eigenen Gespräche — nur für Notizen aus einer Gesprächsnachricht. */
  readonly gespraeche?: Pick<KlaraGespraechRepo, "hole">;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

function eingabeFehler(message: string): KlaraNotizFehler {
  return new KlaraNotizFehler(400, "eingabe", message);
}

function pflichtText(wert: unknown, max: number, feld: string): string {
  if (typeof wert !== "string" || wert.trim().length === 0 || wert.length > max) {
    throw eingabeFehler(`${feld} ist Pflicht und höchstens ${max} Zeichen lang.`);
  }
  return wert;
}

/**
 * Der Rücklink nach DERSELBEN Regel wie im Gespräch (`pruefeObjektbezug`). Dessen Eingabefehler
 * heisst hier, was er ist: ein 400 dieser Ablage — nicht ein unbekannter Fehler (500).
 */
function rueckLinkAus(roh: unknown): KlaraObjektbezug {
  try {
    return pruefeObjektbezug(roh);
  } catch (fehler) {
    if (fehler instanceof KlaraGespraechFehler && fehler.status === 400) {
      throw eingabeFehler(fehler.message);
    }
    throw fehler;
  }
}

function titelAus(wert: unknown, inhalt: string): string {
  if (wert !== undefined && wert !== null && wert !== "") {
    if (typeof wert !== "string" || wert.length > KLARA_NOTIZ_TITEL_MAX) {
      throw eingabeFehler(`titel ist höchstens ${KLARA_NOTIZ_TITEL_MAX} Zeichen lang.`);
    }
    if (wert.trim().length > 0) {
      return wert.trim();
    }
  }
  // Ohne Titel trägt die Notiz den Anfang ihrer ersten Zeile — gekürzt, nicht erfunden.
  const ersteZeile = inhalt.trim().split("\n")[0]?.trim() ?? "";
  return [...ersteZeile].length > 80 ? `${[...ersteZeile].slice(0, 79).join("")}…` : ersteZeile;
}

function fragenAus(wert: unknown): string[] {
  if (wert === undefined || wert === null) {
    return [];
  }
  if (
    !Array.isArray(wert) ||
    wert.length > KLARA_NOTIZ_FRAGEN_MAX ||
    wert.some((f) => typeof f !== "string" || f.length > KLARA_NOTIZ_FRAGE_MAX)
  ) {
    throw eingabeFehler(
      `offeneFragen: höchstens ${KLARA_NOTIZ_FRAGEN_MAX} Fragen zu je ${KLARA_NOTIZ_FRAGE_MAX} Zeichen.`,
    );
  }
  return (wert as string[]).map((f) => f.trim()).filter((f) => f.length > 0);
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

/** Gleicher Inhalt — Grundlage für „dieselbe Wiederholung" beim Anlegen und Bearbeiten. */
function gleicherInhalt(
  a: Pick<KlaraNotiz, "art" | "titel" | "inhalt" | "offeneFragen">,
  b: Pick<KlaraNotiz, "art" | "titel" | "inhalt" | "offeneFragen">,
): boolean {
  return (
    a.art === b.art &&
    a.titel === b.titel &&
    a.inhalt === b.inhalt &&
    a.offeneFragen.length === b.offeneFragen.length &&
    a.offeneFragen.every((f, i) => f === b.offeneFragen[i])
  );
}

export class KlaraNotizDienst {
  private readonly repo: KlaraNotizRepo;
  private readonly gespraeche: KlaraNotizDienstDeps["gespraeche"];
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: KlaraNotizDienstDeps) {
    this.repo = deps.repo;
    this.gespraeche = deps.gespraeche;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  async hole(kontoId: string, id: string): Promise<KlaraNotiz> {
    const n = await this.repo.hole(kontoId, id);
    if (!n) {
      // Fremd und unbekannt antworten gleich — die Kennung verrät nichts über fremde Notizen.
      throw new KlaraNotizFehler(404, "unbekannt", "Notiz nicht gefunden.");
    }
    return n;
  }

  liste(kontoId: string, q: unknown, art: unknown): Promise<KlaraNotiz[]> {
    if (q !== undefined && (typeof q !== "string" || q.length > 200)) {
      throw eingabeFehler("q ist höchstens 200 Zeichen lang.");
    }
    return this.repo.liste(kontoId, {
      woerter: typeof q === "string" ? suchwoerter(q) : [],
      art: wahl(art === "" ? undefined : art, ARTEN, "art"),
      limit: KLARA_NOTIZ_LISTE_MAX,
    });
  }

  /**
   * Legt eine Notiz an. Ist der Vorgang schon gespeichert, antwortet der Dienst mit DIESER Notiz
   * (`wiederholt: true`) — eine Wiederholung nach einem Fehler legt keine zweite an.
   */
  async lege(
    kontoId: string,
    eingabe: KlaraNotizEingabe,
    // Nur für Notizen, die eine andere Steuerung als Wirkung anlegt (Routinenbericht).
    bedingung?: NotizSchreibbedingung,
    herkunft?: KlaraWissensHerkunft,
  ): Promise<{ notiz: KlaraNotiz; wiederholt: boolean }> {
    if (typeof eingabe.vorgang !== "string" || !VORGANG_RE.test(eingabe.vorgang)) {
      throw eingabeFehler("vorgang ist Pflicht (8–100 Zeichen aus Buchstaben, Ziffern, - und _).");
    }
    const vorgang = eingabe.vorgang;
    const weg = wahl(eingabe.weg, WEGE, "weg");
    if (weg === null) {
      throw eingabeFehler(`weg ist Pflicht: ${WEGE.join(", ")}.`);
    }

    let inhalt: string;
    let objektbezug: KlaraObjektbezug;
    let quelle: KlaraNotizQuelle | null = null;
    let antwortId: string | null = null;
    if (weg === "gespraech") {
      // Aus dem Gespräch: Wortlaut und Bezug kommen aus der EIGENEN gespeicherten Nachricht.
      const q = eingabe.quelle as Partial<Record<keyof KlaraNotizQuelle, unknown>> | undefined;
      if (
        typeof q !== "object" ||
        q === null ||
        typeof q.gespraechId !== "string" ||
        typeof q.nachrichtId !== "string" ||
        q.gespraechId.length > 200 ||
        q.nachrichtId.length > 200
      ) {
        throw eingabeFehler("quelle (gespraechId, nachrichtId) ist für den Weg gespraech Pflicht.");
      }
      if (eingabe.inhalt !== undefined || eingabe.objektbezug !== undefined) {
        throw eingabeFehler(
          "Eine Notiz aus dem Gespräch übernimmt Wortlaut und Bezug der Nachricht.",
        );
      }
      const g = this.gespraeche ? await this.gespraeche.hole(kontoId, q.gespraechId) : null;
      const nachricht = g?.nachrichten.find((n) => n.id === q.nachrichtId);
      if (!nachricht) {
        throw new KlaraNotizFehler(404, "quelle_unbekannt", "Gesprächsnachricht nicht gefunden.");
      }
      inhalt = nachricht.text;
      objektbezug = nachricht.objektbezug;
      quelle = { gespraechId: q.gespraechId, nachrichtId: q.nachrichtId };
      if (nachricht.modus === "ki" || nachricht.modus === "ohne_ki") {
        if (!nachricht.antwortId) {
          throw new KlaraNotizFehler(404, "quelle_unbekannt", "Gesprächsnachricht nicht gefunden.");
        }
        antwortId = nachricht.antwortId;
      }
    } else {
      if (eingabe.quelle !== undefined) {
        throw eingabeFehler("quelle gehört nur zum Weg gespraech.");
      }
      inhalt = pflichtText(eingabe.inhalt, KLARA_NOTIZ_INHALT_MAX, "inhalt");
      objektbezug = rueckLinkAus(eingabe.objektbezug);
      if (weg === "ausschnitt" && objektbezug.bezug !== "markierung") {
        throw eingabeFehler("Eine Notiz aus einem Ausschnitt trägt den Bezug markierung.");
      }
    }
    const offeneFragen = fragenAus(eingabe.offeneFragen);
    const art =
      wahl(eingabe.art, ARTEN, "art") ?? (offeneFragen.length > 0 ? "arbeitszettel" : "notiz");
    const titel = titelAus(eingabe.titel, inhalt);

    const vorher = await this.repo.zuVorgang(kontoId, vorgang);
    if (vorher) {
      return this.wiederholung(vorher, { art, titel, inhalt, offeneFragen });
    }
    if ((await this.repo.anzahl(kontoId)) >= KLARA_NOTIZ_MAX_JE_KONTO) {
      throw new KlaraNotizFehler(
        409,
        "voll",
        `Es sind höchstens ${KLARA_NOTIZ_MAX_JE_KONTO} Notizen gespeichert. Bitte zuerst ältere löschen.`,
      );
    }
    const jetzt = this.jetztIso();
    const notiz: KlaraNotiz = {
      id: this.neueId(),
      kontoId,
      vorgang,
      art,
      weg,
      titel,
      inhalt,
      offeneFragen,
      objektbezug,
      quelle,
      ...(quelle ? { antwortId } : {}),
      angelegtAm: jetzt,
      geaendertAm: jetzt,
      fassung: 1,
      ...(herkunft ? { wissensHerkunft: herkunft } : {}),
    };
    if (await this.repo.lege(notiz, bedingung)) {
      return { notiz, wiederholt: false };
    }
    // Ein gleichzeitiger zweiter Versuch desselben Vorgangs war schneller: dessen Notiz gilt.
    const parallel = await this.repo.zuVorgang(kontoId, vorgang);
    if (!parallel) {
      if (bedingung) {
        throw new KlaraNotizFehler(
          409,
          "bedingung",
          "Die Notiz wurde nicht angelegt: die Bedingung der Wirkung galt beim Schreiben nicht mehr.",
        );
      }
      throw new KlaraNotizFehler(409, "konflikt", "Die Notiz konnte nicht angelegt werden.");
    }
    return this.wiederholung(parallel, { art, titel, inhalt, offeneFragen });
  }

  private wiederholung(
    gespeichert: KlaraNotiz,
    gewollt: Pick<KlaraNotiz, "art" | "titel" | "inhalt" | "offeneFragen">,
  ): { notiz: KlaraNotiz; wiederholt: boolean } {
    // Derselbe Vorgang mit ANDEREM Inhalt ist kein Wiederholen, sondern ein Fehler des Aufrufers —
    // weder still verworfen noch als zweite Notiz angelegt. Nach einer Bearbeitung zählt die Notiz.
    if (gespeichert.fassung === 1 && !gleicherInhalt(gespeichert, gewollt)) {
      throw new KlaraNotizFehler(
        409,
        "vorgang_belegt",
        "Dieser Vorgang hat bereits eine Notiz mit anderem Inhalt angelegt.",
      );
    }
    return { notiz: gespeichert, wiederholt: true };
  }

  /**
   * Bearbeitet Titel, Inhalt, offene Fragen oder Art. `fassung` ist die Fassung, die die Person
   * gesehen hat. Rücklink, Weg und Quelle bleiben, wie sie beim Anlegen waren.
   */
  async aendere(
    kontoId: string,
    id: string,
    eingabe: KlaraNotizAenderung,
    // Nur für Notizen, die eine andere Steuerung als Wirkung fortschreibt (Routinenbericht).
    bedingung?: NotizSchreibbedingung,
  ): Promise<{ notiz: KlaraNotiz; wiederholt: boolean }> {
    const fassung = eingabe.fassung;
    if (typeof fassung !== "number" || !Number.isSafeInteger(fassung) || fassung < 1) {
      throw eingabeFehler("fassung ist Pflicht (die zuletzt gesehene Fassung).");
    }
    const alt = await this.hole(kontoId, id);
    if (alt.wissensHerkunft?.besprechung && !alt.wissensHerkunft.besprechung.quelleNotizId)
      throw new KlaraNotizFehler(
        409,
        "konflikt",
        "Transkript über die versionierte Hörfehlerkorrektur ändern.",
      );
    const inhalt =
      eingabe.inhalt === undefined
        ? alt.inhalt
        : pflichtText(eingabe.inhalt, KLARA_NOTIZ_INHALT_MAX, "inhalt");
    const offeneFragen =
      eingabe.offeneFragen === undefined ? [...alt.offeneFragen] : fragenAus(eingabe.offeneFragen);
    const art = wahl(eingabe.art, ARTEN, "art") ?? alt.art;
    const titel = eingabe.titel === undefined ? alt.titel : titelAus(eingabe.titel, inhalt);
    const gewollt = { art, titel, inhalt, offeneFragen };

    if (alt.fassung !== fassung) {
      // Dieselbe Änderung kam schon an (die Antwort ging verloren): keine zweite Fassung.
      if (alt.fassung === fassung + 1 && gleicherInhalt(alt, gewollt)) {
        return { notiz: alt, wiederholt: true };
      }
      throw new KlaraNotizFehler(
        409,
        "konflikt",
        "Die Notiz wurde inzwischen an anderer Stelle geändert. Bitte neu laden und erneut ändern.",
      );
    }
    if (gleicherInhalt(alt, gewollt)) {
      return { notiz: alt, wiederholt: true };
    }
    const neu: KlaraNotiz = {
      ...alt,
      ...gewollt,
      geaendertAm: this.jetztIso(),
      fassung: alt.fassung + 1,
    };
    if (!(await this.repo.ersetze(neu, bedingung))) {
      const jetzt = bedingung ? await this.repo.hole(kontoId, id) : null;
      if (bedingung && jetzt?.fassung === alt.fassung) {
        // Die Notiz ist unverändert — es war die Bedingung der Wirkung, die nicht mehr galt.
        throw new KlaraNotizFehler(
          409,
          "bedingung",
          "Die Notiz wurde nicht geändert: die Bedingung der Wirkung galt beim Schreiben nicht mehr.",
        );
      }
      throw new KlaraNotizFehler(
        409,
        "konflikt",
        "Die Notiz wurde inzwischen an anderer Stelle geändert. Bitte neu laden und erneut ändern.",
      );
    }
    return { notiz: neu, wiederholt: false };
  }

  loesche(kontoId: string, id: string): Promise<boolean> {
    return this.repo.entferne(kontoId, id);
  }
}
