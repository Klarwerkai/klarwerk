import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { type AnswerSnapshotRepo, gehoertNutzer } from "../../ask";
import { type Confidentiality, isValidConfidentiality } from "../../knowledge-object";

// ================================================================================================
// R-0466 — DAS INTERAKTIONSGEDÄCHTNIS: FRÜHERE FRAGEN, ANTWORTEN UND VORLIEBEN.
// ================================================================================================
//
// „Frühere Fragen, Antworten und Vorlieben sollen als eigenes Gedächtnis geführt werden — mit
// Herkunft, Aufbewahrungsfrist und Vertraulichkeit." (Herkunft des Punkts: Beraterkonzept
// Wissensschicht 2026-07-05, Abschnitt 4.3 „Schicht 3 — Interaktionsgedächtnis (NEU, mit Vorsicht)".)
//
// EIN EIGENER DATENRAUM, kein Anbau am Wissensobjekt und kein Teil des Prüfprotokolls:
//   · Er gehört GENAU EINEM KONTO. Jede Operation nimmt die Kontokennung aus der Sitzung; einen
//     Zugriff auf fremde Einträge gibt es nicht, auch nicht für Administratoren.
//   · Jeder Eintrag trägt seine HERKUNFT. „antwort" heißt: die Antwortkennung wurde serverseitig
//     nachgeschlagen und gehört dem Konto (`gehoertNutzer`) — eine fremde oder erfundene Kennung
//     wird abgewiesen, nicht als Herkunft übernommen. Den Wortlaut von Frage und Antwort liefert
//     das Konto selbst; der Antwortdatensatz führt ihn nicht.
//   · Jeder Eintrag trägt eine AUFBEWAHRUNGSFRIST (`verfallAm`). Sie ist eine LÖSCHFRIST: ein
//     abgelaufener Eintrag wird nicht mehr ausgeliefert und vom Aufräumlauf (`server.ts`)
//     endgültig gelöscht, nicht nur ausgeblendet.
//   · Jeder Eintrag trägt eine VERTRAULICHKEIT in denselben drei Stufen wie Wissensobjekte. Ohne
//     Angabe gilt `vertraulich` — die vorsichtige Richtung für persönliche Notizen.
//   · Jeder Eintrag ist EINZELN LÖSCHBAR, und das ganze Gedächtnis ist auf einmal löschbar. Gelöscht
//     wird die Zeile; ins Prüfprotokoll geht nur das Ereignis ohne Inhalt (`gedaechtnis-routes.ts`).
//
// BEWUSST NICHT HIER: kein Weg liest das Gedächtnis in Antworten, Suche oder Modellkontexte. Das
// Konzept nennt es ausdrücklich „nie eine zitierfähige Quelle"; ein Rückfluss wäre ein eigener
// Auftrag mit eigener Prüfung.

export type GedaechtnisArt = "frage_antwort" | "vorliebe";
export const GEDAECHTNIS_ARTEN: readonly GedaechtnisArt[] = ["frage_antwort", "vorliebe"];

export type GedaechtnisHerkunftArt = "eigene_eingabe" | "antwort";

export interface GedaechtnisHerkunft {
  readonly art: GedaechtnisHerkunftArt;
  /** Nur bei `antwort`: die geprüfte Kennung der eigenen Antwort. */
  readonly antwortId: string | null;
  /** Nur bei `antwort`: wann diese Antwort entstand (aus dem Antwortdatensatz, nicht vom Client). */
  readonly antwortAm: string | null;
}

export interface Gedaechtniseintrag {
  readonly id: string;
  readonly kontoId: string;
  readonly art: GedaechtnisArt;
  /** Die Frage (`frage_antwort`) oder die Vorliebe selbst (`vorliebe`). */
  readonly inhalt: string;
  /** Nur bei `frage_antwort`: die damalige Antwort. */
  readonly antwort: string | null;
  readonly herkunft: GedaechtnisHerkunft;
  readonly vertraulichkeit: Confidentiality;
  readonly aufbewahrungTage: number;
  readonly angelegtAm: string;
  readonly verfallAm: string;
}

/**
 * Die wählbaren Fristen in Tagen. Betriebsparameter, keine Vorgabe der Quelle: die Quelle verlangt
 * EINE Frist je Eintrag, nicht eine bestimmte Länge. Eine feste Auswahl statt einer freien Zahl, damit
 * es kein „für immer" durch eine sehr große Eingabe gibt.
 */
export const GEDAECHTNIS_FRISTEN_TAGE: readonly number[] = [30, 90, 365];
export const GEDAECHTNIS_STANDARD_FRIST_TAGE = 90;
export const GEDAECHTNIS_STANDARD_VERTRAULICHKEIT: Confidentiality = "vertraulich";
export const GEDAECHTNIS_MAX_INHALT = 2_000;
export const GEDAECHTNIS_MAX_ANTWORT = 8_000;
/** Obergrenze je Konto — ein Gedächtnis ist eine Merkliste, kein Protokoll jeder Frage. */
export const GEDAECHTNIS_MAX_EINTRAEGE = 500;

const TAG_MS = 24 * 60 * 60 * 1000;

export interface GedaechtnisRepo {
  /** Die Einträge eines Kontos, deren Frist NACH `jetzt` endet — neueste zuerst. */
  eigene(kontoId: string, jetzt: string): Promise<Gedaechtniseintrag[]>;
  anzahl(kontoId: string, jetzt: string): Promise<number>;
  lege(eintrag: Gedaechtniseintrag): Promise<void>;
  /** Löscht genau diesen Eintrag DIESES Kontos; `false`, wenn es ihn für das Konto nicht gibt. */
  entferne(kontoId: string, id: string): Promise<boolean>;
  /** Löscht alle Einträge des Kontos; liefert die Zahl gelöschter Zeilen. */
  entferneAlle(kontoId: string): Promise<number>;
  /** Löscht jeden Eintrag, dessen Frist spätestens `jetzt` endet; liefert die Zahl. */
  entferneAbgelaufene(jetzt: string): Promise<number>;
}

export class InMemoryGedaechtnisRepo implements GedaechtnisRepo {
  private readonly eintraege = new Map<string, Gedaechtniseintrag>();

  eigene(kontoId: string, jetzt: string): Promise<Gedaechtniseintrag[]> {
    const treffer = [...this.eintraege.values()]
      .filter((e) => e.kontoId === kontoId && e.verfallAm > jetzt)
      .sort((a, b) => b.angelegtAm.localeCompare(a.angelegtAm));
    return Promise.resolve(treffer);
  }

  async anzahl(kontoId: string, jetzt: string): Promise<number> {
    return (await this.eigene(kontoId, jetzt)).length;
  }

  lege(eintrag: Gedaechtniseintrag): Promise<void> {
    this.eintraege.set(eintrag.id, eintrag);
    return Promise.resolve();
  }

  entferne(kontoId: string, id: string): Promise<boolean> {
    const eintrag = this.eintraege.get(id);
    if (!eintrag || eintrag.kontoId !== kontoId) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.eintraege.delete(id));
  }

  entferneAlle(kontoId: string): Promise<number> {
    let n = 0;
    for (const [id, e] of this.eintraege) {
      if (e.kontoId === kontoId) {
        this.eintraege.delete(id);
        n += 1;
      }
    }
    return Promise.resolve(n);
  }

  entferneAbgelaufene(jetzt: string): Promise<number> {
    let n = 0;
    for (const [id, e] of this.eintraege) {
      if (e.verfallAm <= jetzt) {
        this.eintraege.delete(id);
        n += 1;
      }
    }
    return Promise.resolve(n);
  }
}

/**
 * Eine Zeile je Eintrag. REIN ADDITIV UND WIEDERHOLBAR: ein `CREATE TABLE IF NOT EXISTS` und zwei
 * `CREATE INDEX IF NOT EXISTS`, kein DROP, kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const GEDAECHTNIS_SCHEMA = `
CREATE TABLE IF NOT EXISTS interaktions_gedaechtnis (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  art text NOT NULL,
  inhalt text NOT NULL,
  antwort text,
  herkunft_art text NOT NULL,
  herkunft_antwort_id text,
  herkunft_antwort_am timestamptz,
  vertraulichkeit text NOT NULL,
  aufbewahrung_tage integer NOT NULL,
  angelegt_am timestamptz NOT NULL,
  verfall_am timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interaktions_gedaechtnis_konto
  ON interaktions_gedaechtnis (konto_id, angelegt_am DESC);
CREATE INDEX IF NOT EXISTS idx_interaktions_gedaechtnis_verfall
  ON interaktions_gedaechtnis (verfall_am);
`;

interface GedaechtnisZeile {
  id: string;
  konto_id: string;
  art: GedaechtnisArt;
  inhalt: string;
  antwort: string | null;
  herkunft_art: GedaechtnisHerkunftArt;
  herkunft_antwort_id: string | null;
  herkunft_antwort_am: Date | null;
  vertraulichkeit: Confidentiality;
  aufbewahrung_tage: number;
  angelegt_am: Date;
  verfall_am: Date;
}

function ausZeile(z: GedaechtnisZeile): Gedaechtniseintrag {
  return {
    id: z.id,
    kontoId: z.konto_id,
    art: z.art,
    inhalt: z.inhalt,
    antwort: z.antwort,
    herkunft: {
      art: z.herkunft_art,
      antwortId: z.herkunft_antwort_id,
      antwortAm: z.herkunft_antwort_am ? z.herkunft_antwort_am.toISOString() : null,
    },
    vertraulichkeit: z.vertraulichkeit,
    aufbewahrungTage: z.aufbewahrung_tage,
    angelegtAm: z.angelegt_am.toISOString(),
    verfallAm: z.verfall_am.toISOString(),
  };
}

export class PgGedaechtnisRepo implements GedaechtnisRepo {
  constructor(private readonly pool: Pool) {}

  async eigene(kontoId: string, jetzt: string): Promise<Gedaechtniseintrag[]> {
    const res = await this.pool.query<GedaechtnisZeile>(
      `SELECT * FROM interaktions_gedaechtnis
        WHERE konto_id = $1 AND verfall_am > $2
        ORDER BY angelegt_am DESC, id`,
      [kontoId, jetzt],
    );
    return res.rows.map(ausZeile);
  }

  async anzahl(kontoId: string, jetzt: string): Promise<number> {
    const res = await this.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM interaktions_gedaechtnis WHERE konto_id = $1 AND verfall_am > $2",
      [kontoId, jetzt],
    );
    return res.rows[0]?.n ?? 0;
  }

  async lege(e: Gedaechtniseintrag): Promise<void> {
    await this.pool.query(
      `INSERT INTO interaktions_gedaechtnis
         (id, konto_id, art, inhalt, antwort, herkunft_art, herkunft_antwort_id,
          herkunft_antwort_am, vertraulichkeit, aufbewahrung_tage, angelegt_am, verfall_am)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        e.id,
        e.kontoId,
        e.art,
        e.inhalt,
        e.antwort,
        e.herkunft.art,
        e.herkunft.antwortId,
        e.herkunft.antwortAm,
        e.vertraulichkeit,
        e.aufbewahrungTage,
        e.angelegtAm,
        e.verfallAm,
      ],
    );
  }

  async entferne(kontoId: string, id: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM interaktions_gedaechtnis WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferneAlle(kontoId: string): Promise<number> {
    const sql = "DELETE FROM interaktions_gedaechtnis WHERE konto_id = $1";
    const res = await this.pool.query(sql, [kontoId]);
    return res.rowCount ?? 0;
  }

  async entferneAbgelaufene(jetzt: string): Promise<number> {
    const sql = "DELETE FROM interaktions_gedaechtnis WHERE verfall_am <= $1";
    const res = await this.pool.query(sql, [jetzt]);
    return res.rowCount ?? 0;
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type GedaechtnisFehlerGrund = "eingabe" | "antwort_unbekannt" | "voll";

export class GedaechtnisFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: GedaechtnisFehlerGrund,
    message: string,
  ) {
    super(message);
    this.name = "GedaechtnisFehler";
  }
}

export interface GedaechtnisEingabe {
  art?: unknown;
  inhalt?: unknown;
  antwort?: unknown;
  antwortId?: unknown;
  vertraulichkeit?: unknown;
  aufbewahrungTage?: unknown;
}

export interface GedaechtnisDienstDeps {
  readonly repo: GedaechtnisRepo;
  /** Ohne Angabe ist keine Herkunft `antwort` möglich — jede Antwortkennung wird abgewiesen. */
  readonly antworten?: Pick<AnswerSnapshotRepo, "findRecord">;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim().length > 0 ? wert.trim() : null;
}

export class GedaechtnisDienst {
  private readonly repo: GedaechtnisRepo;
  private readonly antworten: GedaechtnisDienstDeps["antworten"];
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: GedaechtnisDienstDeps) {
    this.repo = deps.repo;
    this.antworten = deps.antworten;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  eigene(kontoId: string): Promise<Gedaechtniseintrag[]> {
    return this.repo.eigene(kontoId, this.jetztIso());
  }

  /**
   * Legt einen Eintrag für DIESES Konto an. Alle Felder werden hier geprüft — die Route reicht den
   * Rumpf nur durch, damit es genau eine Auslegung gibt.
   */
  async merken(kontoId: string, eingabe: GedaechtnisEingabe): Promise<Gedaechtniseintrag> {
    // R-1349: die zulässigen Arten kommen aus `GEDAECHTNIS_ARTEN`, statt hier ein zweites Mal als
    // Literal dazustehen — vorher war die Liste gebaut, aber von niemandem gelesen.
    const art = GEDAECHTNIS_ARTEN.find((a) => a === eingabe.art);
    if (art === undefined) {
      throw new GedaechtnisFehler(400, "eingabe", "art muss frage_antwort oder vorliebe sein.");
    }
    const inhalt = text(eingabe.inhalt);
    if (inhalt === null || inhalt.length > GEDAECHTNIS_MAX_INHALT) {
      throw new GedaechtnisFehler(
        400,
        "eingabe",
        `inhalt ist Pflicht und höchstens ${GEDAECHTNIS_MAX_INHALT} Zeichen lang.`,
      );
    }
    const antwort = text(eingabe.antwort);
    const mitAntwortId = eingabe.antwortId !== undefined && eingabe.antwortId !== null;
    if (art === "vorliebe" && (antwort !== null || mitAntwortId)) {
      throw new GedaechtnisFehler(400, "eingabe", "Eine Vorliebe trägt keine Antwort.");
    }
    if (art === "frage_antwort" && (antwort === null || antwort.length > GEDAECHTNIS_MAX_ANTWORT)) {
      throw new GedaechtnisFehler(
        400,
        "eingabe",
        `antwort ist Pflicht und höchstens ${GEDAECHTNIS_MAX_ANTWORT} Zeichen lang.`,
      );
    }
    const vertraulichkeit = eingabe.vertraulichkeit ?? GEDAECHTNIS_STANDARD_VERTRAULICHKEIT;
    if (!isValidConfidentiality(vertraulichkeit)) {
      throw new GedaechtnisFehler(
        400,
        "eingabe",
        "vertraulichkeit muss intern, vertraulich oder streng_vertraulich sein.",
      );
    }
    const tage = eingabe.aufbewahrungTage ?? GEDAECHTNIS_STANDARD_FRIST_TAGE;
    if (typeof tage !== "number" || !GEDAECHTNIS_FRISTEN_TAGE.includes(tage)) {
      throw new GedaechtnisFehler(
        400,
        "eingabe",
        `aufbewahrungTage muss einer der Werte ${GEDAECHTNIS_FRISTEN_TAGE.join(", ")} sein.`,
      );
    }
    const herkunft = await this.herkunft(kontoId, eingabe.antwortId);

    const jetzt = this.jetzt();
    const jetztIso = new Date(jetzt).toISOString();
    if ((await this.repo.anzahl(kontoId, jetztIso)) >= GEDAECHTNIS_MAX_EINTRAEGE) {
      throw new GedaechtnisFehler(
        409,
        "voll",
        `Das Gedächtnis hält höchstens ${GEDAECHTNIS_MAX_EINTRAEGE} Einträge. Bitte zuerst ältere löschen.`,
      );
    }
    const eintrag: Gedaechtniseintrag = {
      id: this.neueId(),
      kontoId,
      art,
      inhalt,
      antwort: art === "frage_antwort" ? antwort : null,
      herkunft,
      vertraulichkeit,
      aufbewahrungTage: tage,
      angelegtAm: jetztIso,
      verfallAm: new Date(jetzt + tage * TAG_MS).toISOString(),
    };
    await this.repo.lege(eintrag);
    return eintrag;
  }

  /**
   * Die Herkunft. Ohne Antwortkennung ist es die eigene Eingabe. MIT Kennung muss sie eine Antwort
   * DIESES Kontos benennen — unbekannt und fremd antworten gleich (404), damit die Kennung keine
   * Auskunft über fremde Antworten gibt (dieselbe Regel wie `AnswerExplanationService`).
   */
  private async herkunft(kontoId: string, antwortId: unknown): Promise<GedaechtnisHerkunft> {
    if (antwortId === undefined || antwortId === null) {
      return { art: "eigene_eingabe", antwortId: null, antwortAm: null };
    }
    const kennung = text(antwortId);
    if (kennung === null) {
      throw new GedaechtnisFehler(400, "eingabe", "antwortId muss eine Kennung sein.");
    }
    const record = this.antworten ? await this.antworten.findRecord(kennung) : undefined;
    if (!record || !gehoertNutzer(record, kontoId)) {
      throw new GedaechtnisFehler(404, "antwort_unbekannt", "Antwort nicht gefunden.");
    }
    return { art: "antwort", antwortId: record.answerId, antwortAm: record.createdAt };
  }

  vergessen(kontoId: string, id: string): Promise<boolean> {
    return this.repo.entferne(kontoId, id);
  }

  allesVergessen(kontoId: string): Promise<number> {
    return this.repo.entferneAlle(kontoId);
  }

  /** Der Aufräumlauf: löscht jeden abgelaufenen Eintrag endgültig (`server.ts`, periodisch). */
  raeumeAbgelaufeneAuf(): Promise<number> {
    return this.repo.entferneAbgelaufene(this.jetztIso());
  }
}
