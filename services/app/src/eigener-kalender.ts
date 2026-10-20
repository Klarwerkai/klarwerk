import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { SessionUser } from "./http";
import type { TeamFassung } from "./teams";

// ================================================================================================
// produkt:20261010:klara-eigener-kalender (AW-16) — DER EIGENE KALENDER OHNE EXTERNEN DIENST.
// ================================================================================================
//
// „Eine Person möchte Fristen und Aufgaben nutzen, ohne Outlook oder einen anderen Kalender
// anzubinden." Diese Datei trägt das INTERNE KALENDEROBJEKT: Kennung (`event_id` = `id`), Bereich,
// Rechte-/Quellbezug und die wahlweisen VERWEISE auf Frist (`deadline_id`), Auftrag (`task_id`),
// Serie (`series_id`) und Lauf (`run_id`). Routen: `routes/eigener-kalender-routes.ts`.
//
// RECHTE — HEUTIGE RECHTE, JEDES MAL NEU ERHOBEN:
//   · PERSÖNLICH ist der Standard. Ein persönlicher Eintrag gehört genau einem Konto; fremd und
//     unbekannt antworten gleich (404). Auch Administratoren lesen fremde persönliche Einträge nicht.
//     Ein persönlicher Eintrag erscheint NIE im Teamkalender.
//   · TEAM: lesen und bearbeiten darf, wer HEUTE aktives Mitglied des (nicht archivierten) Teams ist.
//     Auftrag, Lauf, Serie und Löschen steuert nur, wer HEUTE Verantwortliche des Eintrags oder
//     Teamzuständige ist. Eine SERIENAKTION wirkt auf alle Einträge der Serie und ist deshalb nur
//     erlaubt, wenn die Person JEDEN dieser Einträge heute steuern darf.
//   · Eine UNBEKANNTE VERANTWORTLICHKEIT (`verantwortlich: null`) bleibt als „unzugeordnet" sichtbar
//     und trägt keinen Ausführungsauftrag.
//   · QUELLE: Ein aus einem Wissensobjekt abgeleiteter Eintrag zeigt seinen Text nur, solange die
//     lesende Person die Quelle HEUTE sehen darf (`quelleLesbar`, in der App `darfSehen`).
//
// AUFTRAG, LAUF, ERGEBNIS UND SERIE GEHÖREN NICHT DEM KALENDER (Bens Befunde zu K03/K06): Der
// Kalender speichert nur die KENNUNGEN. Titel des Auftrags, Stand des Laufs, tatsächliches Ergebnis
// und Pausenstand der Serie liest er bei jeder Anzeige aus dem maßgeblichen Ausführungsnachweis
// (`AusfuehrungsNachweis`) — mit den Rechten der lesenden Person. Absagen, Abbrechen und Pausieren
// reicht er an denselben Dienst weiter und meldet nur, was dieser danach tatsächlich zurückmeldet.
// Ein Ergebnis lässt sich über die Kalenderbearbeitung nicht eingeben. Ist kein Ausführungsdienst
// angebunden, gibt es keine Lauf-/Serienverknüpfung und keine solchen Aktionen — der Kalender
// behauptet dann nichts darüber.
//
// AUFGABEN (Ben, Nacharbeit 7): Die reine Auftragsverknüpfung `task_id` braucht nur die
// Aufgabenablage (`AufgabenNachweis`), angeschlossen über den berechtigten Leseweg der gelieferten
// persönlichen Aufgaben (`aufgabenNachweisAus`). Sie löst Titel mit heutigen Rechten auf und
// ersetzt den Ausführungsnachweis NICHT: Lauf, Serie, Ergebnis und Ausführungsaktionen bleiben ohne
// ihn gesperrt. Eine persönliche Aufgabe lässt sich nicht in den Teamkalender verknüpfen.
//
// WAS DIESER KALENDER NICHT TUT (K08): Er ruft kein Modell, verschickt keine Einladung oder
// Nachricht, verlängert nichts und ändert kein System von sich aus. Diese Datei importiert nichts
// ausser `pg`-Typ, Sitzungs- und Teamtyp; das misst `tests/eigener-kalender/kalender-ohne-ausfuehrung.test.ts`.

export const KALENDER_BEREICHE = ["persoenlich", "team"] as const;
export type KalenderBereich = (typeof KALENDER_BEREICHE)[number];

export const KALENDER_ARTEN = ["termin", "frist", "aufgabe"] as const;
export type KalenderArt = (typeof KALENDER_ARTEN)[number];

export const KALENDER_STATUS = ["offen", "erledigt", "abgesagt"] as const;
export type KalenderStatus = (typeof KALENDER_STATUS)[number];

export const LAUF_STATUS = [
  "geplant",
  "laeuft",
  "abgeschlossen",
  "fehlgeschlagen",
  "abgesagt",
  "abgebrochen",
] as const;
export type LaufStatus = (typeof LAUF_STATUS)[number];

/**
 * Was TATSÄCHLICH geschehen ist — ausschliesslich so, wie der Ausführungsnachweis es meldet.
 * `erinnerung_zugestellt` heisst genau das: eine Erinnerung ist angekommen. Es ist keine Aussage
 * über die Frist selbst (keine Verlängerung, keine Erledigung).
 */
export const ERGEBNIS_ARTEN = [
  "erinnerung_zugestellt",
  "lauf_abgeschlossen",
  "lauf_fehlgeschlagen",
] as const;
export type ErgebnisArt = (typeof ERGEBNIS_ARTEN)[number];

export const SICHTMODI = ["eigen", "vorhanden", "beide"] as const;
export type Sichtmodus = (typeof SICHTMODI)[number];

export const KALENDER_AKTIONEN = [
  "anzeige_entfernen",
  "anzeige_zeigen",
  "lauf_absagen",
  "serie_pausieren",
  "serie_fortsetzen",
  "arbeit_abbrechen",
] as const;
export type KalenderAktion = (typeof KALENDER_AKTIONEN)[number];

export type KalenderHerkunft = { art: "eigen" } | { art: "wissensobjekt"; koId: string };

/** Verweise — der Kalender speichert nur die Kennungen, nie Stand oder Ergebnis. */
export interface KalenderAuftragVerweis {
  taskId: string;
}
export interface KalenderSerieVerweis {
  seriesId: string;
}
export interface KalenderLaufVerweis {
  runId: string;
}

export interface KalenderErgebnis {
  art: ErgebnisArt;
  am: string;
}

export interface KalenderEintrag {
  /** Die `event_id` — in jeder Ansicht dieselbe. */
  id: string;
  bereich: KalenderBereich;
  /** Wer den Eintrag angelegt hat. Bei `persoenlich` zugleich die einzige berechtigte Person. */
  kontoId: string;
  teamId: string | null;
  /** Konto-Kennung oder `null` = unzugeordnet. Bei `persoenlich` immer `kontoId`. */
  verantwortlich: string | null;
  art: KalenderArt;
  titel: string;
  notiz: string | null;
  ganztaegig: boolean;
  /** Ganztägig: Kalenderdatum `JJJJ-MM-TT` (zeitzonenfrei). Sonst ein UTC-Zeitpunkt (ISO). */
  beginn: string;
  ende: string | null;
  /** Die IANA-Zeitzone, in der der Eintrag angelegt wurde (Anzeige, keine Umrechnung im Server). */
  zeitzone: string;
  herkunft: KalenderHerkunft;
  status: KalenderStatus;
  fristId: string | null;
  auftrag: KalenderAuftragVerweis | null;
  serie: KalenderSerieVerweis | null;
  lauf: KalenderLaufVerweis | null;
  /** Konten, die diesen Eintrag aus IHRER Ansicht entfernt haben. Der Eintrag selbst bleibt. */
  ausgeblendetFuer: string[];
  angelegtAm: string;
  geaendertAm: string;
  fassung: number;
}

export interface KalenderEinstellungen {
  sichtmodus: Sichtmodus;
  geaendertAm: string | null;
}

export const KALENDER_GRENZEN = {
  titel: 200,
  notiz: 2_000,
  kennung: 200,
  zeitzone: 64,
  eintraegeJeKonto: 2_000,
  externeTermine: 500,
} as const;

// ------------------------------------------------------------------------------------------------
// DIE ZUGÄNGE NACH AUSSEN — der maßgebliche Ausführungsnachweis und der vorhandene Kalender.
// ------------------------------------------------------------------------------------------------

/**
 * Der Dienst, der Aufträge, Läufe und Serien TATSÄCHLICH führt (Aufgaben- und
 * Erinnerungssteuerung, eigene Aufträge). Jede Lesung gilt für die anfragende Person: was sie dort
 * heute nicht sehen darf oder was es nicht gibt, ist `null`. Die Wirkungen liefern `true` nur, wenn
 * der Dienst sie bestätigt hat; der Kalender liest den Stand danach zurück.
 */
export interface AusfuehrungsNachweis {
  auftrag(user: SessionUser, taskId: string): Promise<{ titel: string } | null>;
  lauf(
    user: SessionUser,
    taskId: string,
    runId: string,
  ): Promise<{ status: LaufStatus; ergebnis: KalenderErgebnis | null } | null>;
  serie(user: SessionUser, seriesId: string): Promise<{ pausiert: boolean } | null>;
  laufAbsagen(user: SessionUser, taskId: string, runId: string): Promise<boolean>;
  arbeitAbbrechen(user: SessionUser, taskId: string, runId: string): Promise<boolean>;
  serieSchalten(user: SessionUser, seriesId: string, pausiert: boolean): Promise<boolean>;
}

/**
 * Die Aufgabenablage (`produkt:20261008:klara-aufgaben`) — NUR LESEND und nur für die Verknüpfung
 * `task_id`. Sie kennt weder Läufe noch Serien noch Ergebnisse; dafür bleibt der
 * `AusfuehrungsNachweis` nötig. Jede Lesung gilt für die anfragende Person: fremd, unbekannt oder
 * gelöscht ist `null`. `persoenlich: true` — die Aufgabe sieht nur ihre Person.
 */
export interface AufgabenNachweis {
  aufgabe(
    user: SessionUser,
    taskId: string,
  ): Promise<{ titel: string; persoenlich: boolean } | null>;
}

/**
 * Der berechtigte Leseweg der gelieferten persönlichen Aufgaben (`KlaraAufgabeDienst.hole` aus
 * `klara-aufgabe.ts`): er liest nur Aufgaben des eigenen Kontos und antwortet für fremd und
 * unbekannt gleich mit einem Fehler `status: 404`.
 */
export interface AufgabenLeseweg {
  hole(kontoId: string, id: string): Promise<{ titel: string; bereich: string }>;
}

/** Der `AufgabenNachweis` über den berechtigten Leseweg — nie über die Ablage direkt. */
export function aufgabenNachweisAus(weg: AufgabenLeseweg): AufgabenNachweis {
  return {
    async aufgabe(user, taskId) {
      try {
        const a = await weg.hole(user.id, taskId);
        return { titel: a.titel, persoenlich: a.bereich === "persoenlich" };
      } catch (err) {
        if ((err as { status?: unknown } | null)?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  };
}

/** Ein Termin aus dem vorhandenen (externen) Kalender — nur gelesen, nie verändert. */
export interface ExternerTermin {
  id: string;
  titel: string;
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
}

/** Der Zugang zum vorhandenen Kalender der Person (Kalendervertrag `klara-kalender`). */
export interface VorhandenerKalender {
  lies(
    user: SessionUser,
    von: string,
    bis: string,
  ): Promise<{ verbunden: true; termine: ExternerTermin[] } | { verbunden: false }>;
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export interface EigenerKalenderRepo {
  persoenliche(kontoId: string): Promise<KalenderEintrag[]>;
  vonTeams(teamIds: readonly string[]): Promise<KalenderEintrag[]>;
  hole(id: string): Promise<KalenderEintrag | null>;
  /** Alle Einträge einer Serie — die Bereichs- und Rechteprüfung trifft der Dienst. */
  derSerie(seriesId: string): Promise<KalenderEintrag[]>;
  anzahl(kontoId: string): Promise<number>;
  lege(e: KalenderEintrag): Promise<void>;
  /** Schreibt `e`, wenn der gespeicherte Eintrag noch `fassung - 1` trägt; sonst `false`. */
  ersetze(e: KalenderEintrag): Promise<boolean>;
  entferne(id: string): Promise<boolean>;
  einstellungen(kontoId: string): Promise<KalenderEinstellungen | null>;
  setzeEinstellungen(kontoId: string, e: KalenderEinstellungen): Promise<void>;
}

export class InMemoryEigenerKalenderRepo implements EigenerKalenderRepo {
  private readonly eintraege = new Map<string, KalenderEintrag>();
  private readonly einstellungenJeKonto = new Map<string, KalenderEinstellungen>();

  private alle(): KalenderEintrag[] {
    return [...this.eintraege.values()].map((e) => structuredClone(e));
  }

  persoenliche(kontoId: string): Promise<KalenderEintrag[]> {
    return Promise.resolve(
      this.alle().filter((e) => e.bereich === "persoenlich" && e.kontoId === kontoId),
    );
  }

  vonTeams(teamIds: readonly string[]): Promise<KalenderEintrag[]> {
    return Promise.resolve(
      this.alle().filter(
        (e) => e.bereich === "team" && e.teamId !== null && teamIds.includes(e.teamId),
      ),
    );
  }

  hole(id: string): Promise<KalenderEintrag | null> {
    const e = this.eintraege.get(id);
    return Promise.resolve(e ? structuredClone(e) : null);
  }

  derSerie(seriesId: string): Promise<KalenderEintrag[]> {
    return Promise.resolve(this.alle().filter((e) => e.serie?.seriesId === seriesId));
  }

  anzahl(kontoId: string): Promise<number> {
    return Promise.resolve(this.alle().filter((e) => e.kontoId === kontoId).length);
  }

  lege(e: KalenderEintrag): Promise<void> {
    this.eintraege.set(e.id, structuredClone(e));
    return Promise.resolve();
  }

  ersetze(e: KalenderEintrag): Promise<boolean> {
    const alt = this.eintraege.get(e.id);
    if (!alt || alt.fassung !== e.fassung - 1) {
      return Promise.resolve(false);
    }
    this.eintraege.set(e.id, structuredClone(e));
    return Promise.resolve(true);
  }

  entferne(id: string): Promise<boolean> {
    return Promise.resolve(this.eintraege.delete(id));
  }

  einstellungen(kontoId: string): Promise<KalenderEinstellungen | null> {
    const e = this.einstellungenJeKonto.get(kontoId);
    return Promise.resolve(e ? { ...e } : null);
  }

  setzeEinstellungen(kontoId: string, e: KalenderEinstellungen): Promise<void> {
    this.einstellungenJeKonto.set(kontoId, { ...e });
    return Promise.resolve();
  }
}

/**
 * Eine Zeile je Eintrag (Inhalt als JSON) und eine Zeile je Konto für die Sichtwahl. REIN ADDITIV
 * UND WIEDERHOLBAR: zwei `CREATE TABLE IF NOT EXISTS` und drei `CREATE INDEX IF NOT EXISTS`, kein
 * DROP, kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const EIGENER_KALENDER_SCHEMA = `
CREATE TABLE IF NOT EXISTS kalender_eintraege (
  id text PRIMARY KEY,
  bereich text NOT NULL,
  konto_id text NOT NULL,
  team_id text,
  serie_id text,
  fassung integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_kalender_eintraege_konto
  ON kalender_eintraege (konto_id, bereich);
CREATE INDEX IF NOT EXISTS idx_kalender_eintraege_team
  ON kalender_eintraege (team_id);
CREATE INDEX IF NOT EXISTS idx_kalender_eintraege_serie
  ON kalender_eintraege (serie_id);
CREATE TABLE IF NOT EXISTS kalender_einstellungen (
  konto_id text PRIMARY KEY,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
`;

export class PgEigenerKalenderRepo implements EigenerKalenderRepo {
  constructor(private readonly pool: Pool) {}

  async persoenliche(kontoId: string): Promise<KalenderEintrag[]> {
    const res = await this.pool.query<{ data: KalenderEintrag }>(
      "SELECT data FROM kalender_eintraege WHERE konto_id = $1 AND bereich = 'persoenlich'",
      [kontoId],
    );
    return res.rows.map((z) => z.data);
  }

  async vonTeams(teamIds: readonly string[]): Promise<KalenderEintrag[]> {
    if (teamIds.length === 0) {
      return [];
    }
    const res = await this.pool.query<{ data: KalenderEintrag }>(
      "SELECT data FROM kalender_eintraege WHERE bereich = 'team' AND team_id = ANY($1)",
      [[...teamIds]],
    );
    return res.rows.map((z) => z.data);
  }

  async hole(id: string): Promise<KalenderEintrag | null> {
    const res = await this.pool.query<{ data: KalenderEintrag }>(
      "SELECT data FROM kalender_eintraege WHERE id = $1",
      [id],
    );
    return res.rows[0]?.data ?? null;
  }

  async derSerie(seriesId: string): Promise<KalenderEintrag[]> {
    const res = await this.pool.query<{ data: KalenderEintrag }>(
      "SELECT data FROM kalender_eintraege WHERE serie_id = $1",
      [seriesId],
    );
    return res.rows.map((z) => z.data);
  }

  async anzahl(kontoId: string): Promise<number> {
    const res = await this.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM kalender_eintraege WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? 0;
  }

  async lege(e: KalenderEintrag): Promise<void> {
    await this.pool.query(
      `INSERT INTO kalender_eintraege
         (id, bereich, konto_id, team_id, serie_id, fassung, geaendert_am, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        e.id,
        e.bereich,
        e.kontoId,
        e.teamId,
        e.serie?.seriesId ?? null,
        e.fassung,
        e.geaendertAm,
        JSON.stringify(e),
      ],
    );
  }

  async ersetze(e: KalenderEintrag): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE kalender_eintraege
          SET serie_id = $2, fassung = $3, geaendert_am = $4, data = $5
        WHERE id = $1 AND fassung = $6`,
      [e.id, e.serie?.seriesId ?? null, e.fassung, e.geaendertAm, JSON.stringify(e), e.fassung - 1],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferne(id: string): Promise<boolean> {
    const res = await this.pool.query("DELETE FROM kalender_eintraege WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async einstellungen(kontoId: string): Promise<KalenderEinstellungen | null> {
    const res = await this.pool.query<{ data: KalenderEinstellungen }>(
      "SELECT data FROM kalender_einstellungen WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async setzeEinstellungen(kontoId: string, e: KalenderEinstellungen): Promise<void> {
    await this.pool.query(
      `INSERT INTO kalender_einstellungen (konto_id, geaendert_am, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (konto_id) DO UPDATE SET geaendert_am = EXCLUDED.geaendert_am,
                                            data = EXCLUDED.data`,
      [kontoId, e.geaendertAm ?? new Date().toISOString(), JSON.stringify(e)],
    );
  }
}

// ------------------------------------------------------------------------------------------------
// PRÜFUNG DER EINGABE
// ------------------------------------------------------------------------------------------------

export type KalenderGrund =
  | "eingabe"
  | "unbekannt"
  | "quelle_unbekannt"
  | "team_unbekannt"
  | "verweis_unbekannt"
  | "ausfuehrung_nicht_angebunden"
  | "aufgabe_persoenlich"
  | "unzugeordnet"
  | "keine_steuerung"
  | "quelle_geschuetzt"
  | "bestaetigung_fehlt"
  | "nicht_moeglich"
  | "nicht_bestaetigt"
  | "voll"
  | "konflikt";

export class KalenderFehler extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    readonly grund: KalenderGrund,
    message: string,
  ) {
    super(message);
    this.name = "KalenderFehler";
  }
}

function eingabeFehler(message: string): KalenderFehler {
  return new KalenderFehler(400, "eingabe", message);
}

function objekt(wert: unknown, feld: string): Record<string, unknown> {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    throw eingabeFehler(`${feld} muss ein Objekt sein.`);
  }
  return wert as Record<string, unknown>;
}

function text(wert: unknown, max: number, feld: string): string {
  if (typeof wert !== "string") {
    throw eingabeFehler(`${feld} ist Pflicht.`);
  }
  const t = wert.normalize("NFC").replace(/\s+/g, " ").trim();
  if (t.length === 0 || t.length > max) {
    throw eingabeFehler(`${feld} ist Pflicht und höchstens ${max} Zeichen lang.`);
  }
  return t;
}

function wahlweiseText(wert: unknown, max: number, feld: string): string | null {
  if (wert === undefined || wert === null || wert === "") {
    return null;
  }
  if (typeof wert !== "string" || wert.trim().length === 0 || wert.length > max) {
    throw eingabeFehler(`${feld} ist höchstens ${max} Zeichen lang.`);
  }
  return wert.trim();
}

function wahl<T extends string>(wert: unknown, erlaubt: readonly T[], feld: string): T {
  if (typeof wert !== "string" || !(erlaubt as readonly string[]).includes(wert)) {
    throw eingabeFehler(`${feld} muss einer der Werte ${erlaubt.join(", ")} sein.`);
  }
  return wert as T;
}

const DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;
const ZEITPUNKT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function datum(wert: unknown, feld: string): string {
  const m = typeof wert === "string" ? DATUM.exec(wert) : null;
  if (!m) {
    throw eingabeFehler(`${feld} muss ein Datum JJJJ-MM-TT sein.`);
  }
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(j, mo - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) {
    throw eingabeFehler(`${feld} ist kein gültiges Datum.`);
  }
  return wert as string;
}

/** Ein Zeitpunkt MIT Zonenangabe — ohne sie wäre unklar, welche Ortszeit gemeint ist. */
function zeitpunkt(wert: unknown, feld: string): string {
  if (typeof wert !== "string" || !ZEITPUNKT.test(wert) || Number.isNaN(Date.parse(wert))) {
    throw eingabeFehler(`${feld} muss ein Zeitpunkt mit Zonenangabe sein (ISO 8601).`);
  }
  return new Date(wert).toISOString();
}

function zeitzone(wert: unknown): string {
  const z = text(wert, KALENDER_GRENZEN.zeitzone, "zeitzone");
  try {
    Intl.DateTimeFormat("en", { timeZone: z }).format(0);
  } catch {
    throw eingabeFehler("zeitzone ist keine bekannte IANA-Zeitzone.");
  }
  return z;
}

function kennung(wert: unknown, feld: string): string {
  return text(wert, KALENDER_GRENZEN.kennung, feld);
}

function wahlweiseKennung(wert: unknown, feld: string): string | null {
  return wert === undefined || wert === null ? null : kennung(wert, feld);
}

/** Zeitangaben: Beginn, Ende (wahlweise, nicht vor dem Beginn) und ihre Form. */
function zeiten(
  ganztaegig: boolean,
  beginnRoh: unknown,
  endeRoh: unknown,
): { beginn: string; ende: string | null } {
  const beginn = ganztaegig ? datum(beginnRoh, "beginn") : zeitpunkt(beginnRoh, "beginn");
  if (endeRoh === undefined || endeRoh === null || endeRoh === "") {
    return { beginn, ende: null };
  }
  const ende = ganztaegig ? datum(endeRoh, "ende") : zeitpunkt(endeRoh, "ende");
  if (ende < beginn) {
    throw eingabeFehler("ende liegt vor beginn.");
  }
  return { beginn, ende };
}

/**
 * Ein Verweis besteht aus GENAU einer Kennung. Weitere Felder (Titel, Stand, Ergebnis) sind
 * Behauptungen über einen fremden Dienst und werden abgewiesen, nicht still übernommen.
 */
function verweis(roh: unknown, feld: string, schluessel: string): string | null {
  if (roh === undefined || roh === null) {
    return null;
  }
  const o = objekt(roh, feld);
  const fremd = Object.keys(o).filter((k) => k !== schluessel);
  if (fremd.length > 0) {
    throw eingabeFehler(
      `${feld} trägt nur ${schluessel}. ${fremd.join(", ")} liest der Kalender aus dem Ausführungsnachweis.`,
    );
  }
  return kennung(o[schluessel], `${feld}.${schluessel}`);
}

// ------------------------------------------------------------------------------------------------
// DIE SICHT NACH AUSSEN
// ------------------------------------------------------------------------------------------------

export interface KalenderSicht {
  id: string;
  bereich: KalenderBereich;
  teamId: string | null;
  teamName: string | null;
  verantwortlich: string | null;
  /** `false` = unbekannte Verantwortlichkeit („unzugeordnet"). */
  zugeordnet: boolean;
  art: KalenderArt;
  /** `null`, wenn die Quelle der lesenden Person heute nicht (mehr) offensteht. */
  titel: string | null;
  notiz: string | null;
  ganztaegig: boolean;
  beginn: string;
  ende: string | null;
  zeitzone: string;
  herkunft: { art: KalenderHerkunft["art"]; koId: string | null };
  geschuetzt: boolean;
  status: KalenderStatus;
  fristId: string | null;
  /** `aufgeloest: false` — der Ausführungsnachweis kennt den Auftrag für diese Person heute nicht. */
  auftrag: { taskId: string; titel: string | null; aufgeloest: boolean } | null;
  /** `pausiert: null` — Stand nicht nachgewiesen. */
  serie: { seriesId: string; pausiert: boolean | null } | null;
  /** `status: null` — Stand nicht nachgewiesen. */
  lauf: { runId: string; status: LaufStatus | null } | null;
  /** Nur, was der Ausführungsnachweis als tatsächlich geschehen meldet. */
  ergebnis: KalenderErgebnis | null;
  ausgeblendet: boolean;
  eigen: boolean;
  /** Darf diese Person HEUTE Auftrag, Lauf und Serie steuern und den Eintrag löschen? */
  darfSteuern: boolean;
  angelegtAm: string;
  geaendertAm: string;
  fassung: number;
}

export interface KalenderFolgen {
  aktion: KalenderAktion;
  moeglich: boolean;
  /** Warum die Aktion hier nicht geht — ein Schlüssel, kein Satz. */
  hinderung: string | null;
  /** Wie viele Kalendereinträge die Aktion betrifft (Serie: alle der Serie im Bereich). */
  betroffeneEintraege: number;
  /** Ob sie sich mit einer Gegenaktion zurücknehmen lässt. */
  umkehrbar: boolean;
  /** Was sie NICHT berührt — Schlüssel für die Oberfläche. */
  bleibt: string[];
  /** `true`, wenn die Wirkung beim Ausführungsdienst eintritt und dort bestätigt werden muss. */
  ausfuehrung: boolean;
}

export interface KalenderAnsicht {
  bereich: KalenderBereich;
  sichtmodus: Sichtmodus;
  /** Der vorhandene Kalender: Verbindungsstand und — gelesen — seine Termine im Zeitraum. */
  vorhandenerKalender: { verbunden: boolean; termine: ExternerTermin[] };
  /** Ist ein Ausführungsdienst angebunden (Lauf/Serie verknüpfbar und steuerbar)? */
  ausfuehrungAngebunden: boolean;
  /** Ist eine Aufgabenablage angebunden (Auftrag `task_id` verknüpfbar)? */
  aufgabenAngebunden: boolean;
  teams: { id: string; name: string }[];
  eintraege: KalenderSicht[];
  ausgeblendet: number;
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export interface EigenerKalenderDeps {
  readonly repo: EigenerKalenderRepo;
  readonly teams: { aktuelle(): Promise<TeamFassung[]> };
  /** Darf diese Person das Wissensobjekt HEUTE sehen? Unbekannt heisst nein (fail-closed). */
  readonly quelleLesbar: (user: SessionUser, koId: string) => Promise<boolean>;
  /** Der maßgebliche Ausführungsnachweis. Ohne Angabe: keine Verknüpfung, keine Ausführungsaktion. */
  readonly ausfuehrung?: AusfuehrungsNachweis;
  /** Die Aufgabenablage. Ohne Angabe (und ohne Ausführungsnachweis): keine Auftragsverknüpfung. */
  readonly aufgaben?: AufgabenNachweis;
  /** Der vorhandene Kalender. Ohne Angabe: nicht verbunden. */
  readonly vorhandenerKalender?: VorhandenerKalender;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

/** Was eine Person an einem Eintrag eingibt — ohne Kennung, Bereich, Herkunft und Verwaltung. */
type KalenderFelder = Omit<
  KalenderEintrag,
  | "id"
  | "bereich"
  | "kontoId"
  | "teamId"
  | "verantwortlich"
  | "herkunft"
  | "ausgeblendetFuer"
  | "angelegtAm"
  | "geaendertAm"
  | "fassung"
>;

interface Zugriff {
  eintrag: KalenderEintrag;
  team: TeamFassung | null;
  darfSteuern: boolean;
}

const VERALTET = "Der Eintrag wurde inzwischen geändert. Bitte neu laden.";
const NICHT_ANGEBUNDEN =
  "Es ist kein Ausführungsdienst angebunden. Lauf und Serie lassen sich deshalb nicht verknüpfen oder steuern.";
const AUFGABEN_NICHT_ANGEBUNDEN =
  "Es ist keine Aufgabenablage angebunden. Ein Auftrag lässt sich deshalb nicht verknüpfen.";

/** Der Lesezeitraum für den vorhandenen Kalender: 31 Tage zurück bis 90 Tage voraus. */
const VORHANDEN_ZURUECK_MS = 31 * 86_400_000;
const VORHANDEN_VORAUS_MS = 90 * 86_400_000;

export class EigenerKalenderDienst {
  private readonly repo: EigenerKalenderRepo;
  private readonly teams: EigenerKalenderDeps["teams"];
  private readonly quelleLesbar: EigenerKalenderDeps["quelleLesbar"];
  private readonly ausfuehrung: AusfuehrungsNachweis | undefined;
  private readonly aufgaben: AufgabenNachweis | undefined;
  private readonly vorhanden: VorhandenerKalender | undefined;
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: EigenerKalenderDeps) {
    this.repo = deps.repo;
    this.teams = deps.teams;
    this.quelleLesbar = deps.quelleLesbar;
    this.ausfuehrung = deps.ausfuehrung;
    this.aufgaben = deps.aufgaben;
    this.vorhanden = deps.vorhandenerKalender;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  /** Die Teams, in denen die Person HEUTE aktives Mitglied ist. */
  private async meineTeams(user: SessionUser): Promise<TeamFassung[]> {
    return (await this.teams.aktuelle()).filter(
      (t) => !t.archiviert && t.mitglieder.includes(user.id),
    );
  }

  private steuert(user: SessionUser, e: KalenderEintrag, team: TeamFassung | null): boolean {
    if (e.bereich === "persoenlich") {
      return e.kontoId === user.id;
    }
    return team !== null && (e.verantwortlich === user.id || team.verantwortlich === user.id);
  }

  /** Zugriff mit heutigen Rechten — fremd und unbekannt antworten gleich (404). */
  private async zugriff(user: SessionUser, id: string): Promise<Zugriff> {
    const e = await this.repo.hole(id);
    if (e?.bereich === "persoenlich" && e.kontoId === user.id) {
      return { eintrag: e, team: null, darfSteuern: true };
    }
    if (e?.bereich === "team") {
      const team = (await this.meineTeams(user)).find((t) => t.id === e.teamId) ?? null;
      if (team) {
        return { eintrag: e, team, darfSteuern: this.steuert(user, e, team) };
      }
    }
    throw new KalenderFehler(404, "unbekannt", "Kalendereintrag nicht gefunden.");
  }

  /**
   * Der Auftrag `task_id` mit den HEUTIGEN Rechten der lesenden Person: zuerst in der Aufgabenablage,
   * sonst im Ausführungsnachweis. Was keiner der beiden dieser Person zeigt, ist `null`.
   */
  private async auftragLesen(
    user: SessionUser,
    taskId: string,
  ): Promise<{ titel: string; persoenlich: boolean } | null> {
    const aufgabe = this.aufgaben ? await this.aufgaben.aufgabe(user, taskId) : null;
    if (aufgabe) {
      return aufgabe;
    }
    const auftrag = this.ausfuehrung ? await this.ausfuehrung.auftrag(user, taskId) : null;
    return auftrag ? { titel: auftrag.titel, persoenlich: false } : null;
  }

  private async sicht(
    user: SessionUser,
    e: KalenderEintrag,
    team: TeamFassung | null,
  ): Promise<KalenderSicht> {
    const geschuetzt =
      e.herkunft.art === "wissensobjekt" && !(await this.quelleLesbar(user, e.herkunft.koId));
    const a = this.ausfuehrung;
    const auftrag = e.auftrag ? await this.auftragLesen(user, e.auftrag.taskId) : null;
    const lauf =
      e.auftrag && e.lauf && a ? await a.lauf(user, e.auftrag.taskId, e.lauf.runId) : null;
    const serie = e.serie && a ? await a.serie(user, e.serie.seriesId) : null;
    return {
      id: e.id,
      bereich: e.bereich,
      teamId: e.teamId,
      teamName: team?.name ?? null,
      verantwortlich: e.verantwortlich,
      zugeordnet: e.verantwortlich !== null,
      art: e.art,
      titel: geschuetzt ? null : e.titel,
      notiz: geschuetzt ? null : e.notiz,
      ganztaegig: e.ganztaegig,
      beginn: e.beginn,
      ende: e.ende,
      zeitzone: e.zeitzone,
      herkunft: {
        art: e.herkunft.art,
        koId: e.herkunft.art === "wissensobjekt" && !geschuetzt ? e.herkunft.koId : null,
      },
      geschuetzt,
      status: e.status,
      fristId: e.fristId,
      auftrag: e.auftrag
        ? {
            taskId: e.auftrag.taskId,
            titel: auftrag && !geschuetzt ? auftrag.titel : null,
            aufgeloest: auftrag !== null,
          }
        : null,
      serie: e.serie
        ? { seriesId: e.serie.seriesId, pausiert: serie ? serie.pausiert : null }
        : null,
      lauf: e.lauf ? { runId: e.lauf.runId, status: lauf ? lauf.status : null } : null,
      ergebnis: lauf ? lauf.ergebnis : null,
      ausgeblendet: e.ausgeblendetFuer.includes(user.id),
      eigen: e.kontoId === user.id,
      darfSteuern: this.steuert(user, e, team),
      angelegtAm: e.angelegtAm,
      geaendertAm: e.geaendertAm,
      fassung: e.fassung,
    };
  }

  /** Die Termine des vorhandenen Kalenders — nur gelesen, wenn die Sichtwahl sie zeigt. */
  private async vorhandeneTermine(
    user: SessionUser,
    sichtmodus: Sichtmodus,
  ): Promise<{ verbunden: boolean; termine: ExternerTermin[] }> {
    if (!this.vorhanden) {
      return { verbunden: false, termine: [] };
    }
    if (sichtmodus === "eigen") {
      // Die Verbindung wird erst gelesen, wenn die Person den vorhandenen Kalender sehen will.
      return { verbunden: true, termine: [] };
    }
    const t = this.jetzt();
    const von = new Date(t - VORHANDEN_ZURUECK_MS).toISOString();
    const bis = new Date(t + VORHANDEN_VORAUS_MS).toISOString();
    const antwort = await this.vorhanden.lies(user, von, bis);
    if (!antwort.verbunden) {
      return { verbunden: false, termine: [] };
    }
    return {
      verbunden: true,
      termine: antwort.termine.slice(0, KALENDER_GRENZEN.externeTermine).map((x) => ({
        id: String(x.id),
        titel: String(x.titel),
        ganztaegig: Boolean(x.ganztaegig),
        beginn: String(x.beginn),
        ende: x.ende === null ? null : String(x.ende),
      })),
    };
  }

  async ansicht(
    user: SessionUser,
    bereichRoh: unknown,
    mitAusgeblendeten: boolean,
  ): Promise<KalenderAnsicht> {
    const bereich =
      bereichRoh === undefined ? "persoenlich" : wahl(bereichRoh, KALENDER_BEREICHE, "bereich");
    const teams = await this.meineTeams(user);
    // PERSÖNLICH UND TEAM SIND GETRENNTE MENGEN: die Teamsicht liest ausschliesslich Teameinträge
    // der heutigen Teams — ein persönlicher Eintrag kann dort nicht auftauchen.
    const roh =
      bereich === "persoenlich"
        ? await this.repo.persoenliche(user.id)
        : await this.repo.vonTeams(teams.map((t) => t.id));
    const teamVon = (e: KalenderEintrag): TeamFassung | null =>
      teams.find((t) => t.id === e.teamId) ?? null;
    const sichten = await Promise.all(roh.map((e) => this.sicht(user, e, teamVon(e))));
    sichten.sort((a, b) => a.beginn.localeCompare(b.beginn) || a.id.localeCompare(b.id));
    const einstellungen = await this.einstellungen(user);
    return {
      bereich,
      sichtmodus: einstellungen.sichtmodus,
      vorhandenerKalender: await this.vorhandeneTermine(user, einstellungen.sichtmodus),
      ausfuehrungAngebunden: this.ausfuehrung !== undefined,
      aufgabenAngebunden: this.aufgaben !== undefined || this.ausfuehrung !== undefined,
      teams: teams.map((t) => ({ id: t.id, name: t.name })),
      eintraege: mitAusgeblendeten ? sichten : sichten.filter((s) => !s.ausgeblendet),
      ausgeblendet: sichten.filter((s) => s.ausgeblendet).length,
    };
  }

  async hole(user: SessionUser, id: string): Promise<KalenderSicht> {
    const z = await this.zugriff(user, id);
    return this.sicht(user, z.eintrag, z.team);
  }

  /**
   * Die Felder, die Anlegen und Ändern gemeinsam prüfen. Beim Ändern gilt: ein fehlendes Feld
   * bleibt, wie es war, `null` leert es — und der zusammengesetzte Stand wird als Ganzes geprüft.
   */
  private felder(roh: Record<string, unknown>, bisher: KalenderEintrag | null): KalenderFelder {
    // K03: ein Ergebnis ist, was tatsächlich geschehen ist — es kommt nur aus dem
    // Ausführungsnachweis und lässt sich hier weder eingeben noch überschreiben.
    if (roh.ergebnis !== undefined) {
      throw eingabeFehler(
        "Ein Ergebnis lässt sich nicht eintragen; der Kalender liest es aus dem Ausführungsnachweis.",
      );
    }
    const q: Record<string, unknown> = { ...bisher };
    for (const [k, v] of Object.entries(roh)) {
      if (v !== undefined) {
        q[k] = v;
      }
    }
    const ganztaegig = q.ganztaegig ?? false;
    if (typeof ganztaegig !== "boolean") {
      throw eingabeFehler("ganztaegig muss true oder false sein.");
    }
    const taskId = verweis(q.auftrag, "auftrag", "taskId");
    const runId = verweis(q.lauf, "lauf", "runId");
    const seriesId = verweis(q.serie, "serie", "seriesId");
    // K08 · DATENWEG: ein Lauf gehört zu einem Auftrag. Ein Termin ohne Auftrag trägt nie einen Lauf.
    if (runId !== null && taskId === null) {
      throw eingabeFehler("Ein Lauf braucht einen auszuführenden Auftrag.");
    }
    return {
      art: wahl(q.art ?? "termin", KALENDER_ARTEN, "art"),
      titel: text(q.titel, KALENDER_GRENZEN.titel, "titel"),
      notiz: wahlweiseText(q.notiz, KALENDER_GRENZEN.notiz, "notiz"),
      ganztaegig,
      ...zeiten(ganztaegig, q.beginn, q.ende),
      zeitzone: zeitzone(q.zeitzone),
      status: wahl(q.status ?? "offen", KALENDER_STATUS, "status"),
      fristId: wahlweiseKennung(q.fristId, "fristId"),
      auftrag: taskId === null ? null : { taskId },
      serie: seriesId === null ? null : { seriesId },
      lauf: runId === null ? null : { runId },
    };
  }

  /**
   * Auftrag/Lauf/Serie sind Steuerung: nur mit heutigem Steuerrecht, nie „unzugeordnet", und nur
   * auf Kennungen, die Aufgabenablage bzw. Ausführungsnachweis dieser Person heute tatsächlich
   * zeigen. Lauf und Serie brauchen den Ausführungsnachweis — die Aufgabenablage ersetzt ihn nicht.
   */
  private async pruefeVerweise(
    user: SessionUser,
    bereich: KalenderBereich,
    e: Pick<KalenderEintrag, "verantwortlich" | "auftrag" | "lauf" | "serie">,
    bisher: KalenderEintrag | null,
    darfSteuern: boolean,
  ): Promise<void> {
    const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
    const neuerAuftrag = !gleich(e.auftrag, bisher?.auftrag ?? null);
    const neuerLauf = !gleich(e.lauf, bisher?.lauf ?? null) || (neuerAuftrag && e.lauf !== null);
    const neueSerie = !gleich(e.serie, bisher?.serie ?? null);
    if (e.verantwortlich === null && (e.auftrag || e.lauf)) {
      throw new KalenderFehler(
        409,
        "unzugeordnet",
        "Ein unzugeordneter Eintrag trägt keinen Ausführungsauftrag. Zuerst eine verantwortliche Person festlegen.",
      );
    }
    if ((neuerAuftrag || neuerLauf || neueSerie) && !darfSteuern) {
      throw new KalenderFehler(
        403,
        "keine_steuerung",
        "Auftrag, Lauf und Serie steuern nur die Verantwortlichen dieses Eintrags oder des Teams.",
      );
    }
    const a = this.ausfuehrung;
    if (((neuerLauf && e.lauf) || (neueSerie && e.serie)) && !a) {
      throw new KalenderFehler(409, "ausfuehrung_nicht_angebunden", NICHT_ANGEBUNDEN);
    }
    if (neuerAuftrag && e.auftrag && !this.aufgaben && !a) {
      throw new KalenderFehler(409, "ausfuehrung_nicht_angebunden", AUFGABEN_NICHT_ANGEBUNDEN);
    }
    const unbekannt = (was: string): KalenderFehler =>
      new KalenderFehler(404, "verweis_unbekannt", `${was} nicht gefunden.`);
    if (neuerAuftrag && e.auftrag) {
      const auftrag = await this.auftragLesen(user, e.auftrag.taskId);
      if (!auftrag) {
        throw unbekannt("Auftrag");
      }
      // K05: eine persönliche Aufgabe sieht nur ihre Person — im Teamkalender wäre sie für alle
      // anderen ein unauflösbarer Verweis auf privaten Inhalt.
      if (auftrag.persoenlich && bereich === "team") {
        throw new KalenderFehler(
          409,
          "aufgabe_persoenlich",
          "Eine persönliche Aufgabe gehört in den persönlichen Kalender, nicht in den Teamkalender.",
        );
      }
    }
    if (!a) {
      return;
    }
    if (neuerLauf && e.auftrag && e.lauf && !(await a.lauf(user, e.auftrag.taskId, e.lauf.runId))) {
      throw unbekannt("Lauf");
    }
    if (neueSerie && e.serie && !(await a.serie(user, e.serie.seriesId))) {
      throw unbekannt("Serie");
    }
  }

  async lege(user: SessionUser, eingabe: unknown): Promise<KalenderSicht> {
    const roh = objekt(eingabe ?? {}, "Eintrag");
    const bereich =
      roh.bereich === undefined ? "persoenlich" : wahl(roh.bereich, KALENDER_BEREICHE, "bereich");
    const felder = this.felder(roh, null);
    let team: TeamFassung | null = null;
    let verantwortlich: string | null = user.id;
    if (bereich === "team") {
      const teamId = kennung(roh.teamId, "teamId");
      team = (await this.meineTeams(user)).find((t) => t.id === teamId) ?? null;
      if (!team) {
        throw new KalenderFehler(404, "team_unbekannt", "Team nicht gefunden.");
      }
      verantwortlich = wahlweiseKennung(roh.verantwortlich, "verantwortlich");
      if (verantwortlich !== null && !team.mitglieder.includes(verantwortlich)) {
        throw eingabeFehler("verantwortlich muss ein Mitglied des Teams sein.");
      }
    } else if (roh.verantwortlich !== undefined && roh.verantwortlich !== user.id) {
      throw eingabeFehler("Ein persönlicher Eintrag hat genau eine Verantwortliche: dich.");
    }
    if (roh.teamId !== undefined && bereich === "persoenlich") {
      throw eingabeFehler("Ein persönlicher Eintrag gehört zu keinem Team.");
    }
    let herkunft: KalenderHerkunft = { art: "eigen" };
    if (roh.herkunft !== undefined && roh.herkunft !== null) {
      const h = objekt(roh.herkunft, "herkunft");
      const art = wahl(h.art, ["eigen", "wissensobjekt"] as const, "herkunft.art");
      if (art === "wissensobjekt") {
        const koId = kennung(h.koId, "herkunft.koId");
        if (!(await this.quelleLesbar(user, koId))) {
          throw new KalenderFehler(404, "quelle_unbekannt", "Quelle nicht gefunden.");
        }
        herkunft = { art, koId };
      }
    }
    const entwurf = { ...felder, verantwortlich };
    const darfSteuern =
      bereich === "persoenlich" ||
      (team !== null && (verantwortlich === user.id || team.verantwortlich === user.id));
    await this.pruefeVerweise(user, bereich, entwurf, null, darfSteuern);
    if ((await this.repo.anzahl(user.id)) >= KALENDER_GRENZEN.eintraegeJeKonto) {
      throw new KalenderFehler(
        409,
        "voll",
        `Höchstens ${KALENDER_GRENZEN.eintraegeJeKonto} Einträge je Konto. Bitte ältere löschen.`,
      );
    }
    const jetzt = this.jetztIso();
    const e: KalenderEintrag = {
      ...entwurf,
      id: this.neueId(),
      bereich,
      kontoId: user.id,
      teamId: team?.id ?? null,
      herkunft,
      ausgeblendetFuer: [],
      angelegtAm: jetzt,
      geaendertAm: jetzt,
      fassung: 1,
    };
    await this.repo.lege(e);
    return this.sicht(user, e, team);
  }

  async aendere(user: SessionUser, id: string, eingabe: unknown): Promise<KalenderSicht> {
    const roh = objekt(eingabe ?? {}, "Eintrag");
    const gesehen = roh.fassung;
    if (typeof gesehen !== "number" || !Number.isSafeInteger(gesehen)) {
      throw eingabeFehler("fassung (die zuletzt gesehene) fehlt.");
    }
    const z = await this.zugriff(user, id);
    const alt = z.eintrag;
    if (
      alt.herkunft.art === "wissensobjekt" &&
      !(await this.quelleLesbar(user, alt.herkunft.koId))
    ) {
      throw new KalenderFehler(
        409,
        "quelle_geschuetzt",
        "Die Quelle dieses Eintrags ist dir nicht mehr freigegeben; sein Text bleibt geschützt.",
      );
    }
    if (roh.bereich !== undefined || roh.teamId !== undefined || roh.herkunft !== undefined) {
      throw eingabeFehler("Bereich, Team und Herkunft bleiben, wie sie angelegt wurden.");
    }
    if (gesehen !== alt.fassung) {
      throw new KalenderFehler(409, "konflikt", VERALTET);
    }
    let verantwortlich = alt.verantwortlich;
    if (roh.verantwortlich !== undefined) {
      if (alt.bereich === "persoenlich") {
        if (roh.verantwortlich !== user.id) {
          throw eingabeFehler("Ein persönlicher Eintrag hat genau eine Verantwortliche: dich.");
        }
      } else {
        if (!z.darfSteuern) {
          throw new KalenderFehler(
            403,
            "keine_steuerung",
            "Die Verantwortung legen nur die Verantwortlichen des Eintrags oder des Teams fest.",
          );
        }
        verantwortlich = wahlweiseKennung(roh.verantwortlich, "verantwortlich");
        if (verantwortlich !== null && !z.team?.mitglieder.includes(verantwortlich)) {
          throw eingabeFehler("verantwortlich muss ein Mitglied des Teams sein.");
        }
      }
    }
    const felder = this.felder(roh, alt);
    await this.pruefeVerweise(user, alt.bereich, { ...felder, verantwortlich }, alt, z.darfSteuern);
    const neu: KalenderEintrag = {
      ...alt,
      ...felder,
      verantwortlich,
      geaendertAm: this.jetztIso(),
      fassung: alt.fassung + 1,
    };
    if (!(await this.repo.ersetze(neu))) {
      throw new KalenderFehler(409, "konflikt", VERALTET);
    }
    return this.sicht(user, neu, z.team);
  }

  async loesche(user: SessionUser, id: string): Promise<KalenderEintrag> {
    const z = await this.zugriff(user, id);
    if (!z.darfSteuern) {
      throw new KalenderFehler(
        403,
        "keine_steuerung",
        "Einen Teameintrag löschen nur seine Verantwortlichen oder die Teamzuständigen. Aus der eigenen Ansicht entfernen geht immer.",
      );
    }
    if (!(await this.repo.entferne(id))) {
      throw new KalenderFehler(404, "unbekannt", "Kalendereintrag nicht gefunden.");
    }
    return z.eintrag;
  }

  /** Die Kalendereinträge derselben Serie im selben Bereich (persönlich: eigenes Konto; Team). */
  private async serienEintraege(e: KalenderEintrag): Promise<KalenderEintrag[]> {
    if (!e.serie) {
      return [];
    }
    return (await this.repo.derSerie(e.serie.seriesId)).filter((x) =>
      e.bereich === "persoenlich"
        ? x.bereich === "persoenlich" && x.kontoId === e.kontoId
        : x.bereich === "team" && x.teamId === e.teamId,
    );
  }

  private async bewerte(
    user: SessionUser,
    z: Zugriff,
    aktion: KalenderAktion,
  ): Promise<KalenderFolgen> {
    const e = z.eintrag;
    const nein = (hinderung: string, ausfuehrung = false): KalenderFolgen => ({
      aktion,
      moeglich: false,
      hinderung,
      betroffeneEintraege: 0,
      umkehrbar: false,
      bleibt: [],
      ausfuehrung,
    });
    const ja = (
      betroffen: number,
      umkehrbar: boolean,
      bleibt: string[],
      ausfuehrung: boolean,
    ): KalenderFolgen => ({
      aktion,
      moeglich: true,
      hinderung: null,
      betroffeneEintraege: betroffen,
      umkehrbar,
      bleibt,
      ausfuehrung,
    });
    const versteckt = e.ausgeblendetFuer.includes(user.id);
    if (aktion === "anzeige_entfernen") {
      return versteckt
        ? nein("bereits_ausgeblendet")
        : ja(1, true, ["eintrag", "frist", "auftrag", "serie", "lauf", "andere_personen"], false);
    }
    if (aktion === "anzeige_zeigen") {
      return versteckt ? ja(1, true, ["eintrag"], false) : nein("nicht_ausgeblendet");
    }
    // Ab hier wirkt die Aktion beim Ausführungsdienst — ohne ihn gibt es sie nicht.
    const a = this.ausfuehrung;
    if (!a) {
      return nein("ausfuehrung_nicht_angebunden", true);
    }
    if (!z.darfSteuern) {
      return nein("keine_steuerung", true);
    }
    if (aktion === "lauf_absagen" || aktion === "arbeit_abbrechen") {
      if (!e.auftrag || !e.lauf) {
        return nein("kein_lauf", true);
      }
      const lauf = await a.lauf(user, e.auftrag.taskId, e.lauf.runId);
      if (!lauf) {
        return nein("lauf_nicht_nachgewiesen", true);
      }
      if (aktion === "lauf_absagen") {
        return lauf.status === "geplant"
          ? ja(1, false, ["eintrag", "serie", "andere_laeufe"], true)
          : nein("lauf_nicht_geplant", true);
      }
      return lauf.status === "laeuft"
        ? ja(1, false, ["eintrag", "serie", "ergebnisse", "andere_laeufe"], true)
        : nein("lauf_laeuft_nicht", true);
    }
    // serie_pausieren / serie_fortsetzen
    if (!e.serie) {
      return nein("keine_serie", true);
    }
    const serie = await a.serie(user, e.serie.seriesId);
    if (!serie) {
      return nein("serie_nicht_nachgewiesen", true);
    }
    const pausieren = aktion === "serie_pausieren";
    if (serie.pausiert === pausieren) {
      return nein(pausieren ? "serie_bereits_pausiert" : "serie_nicht_pausiert", true);
    }
    // K07 (Bens Befund): Die Serie wirkt auf ALLE ihre Einträge. Steuert die Person auch nur einen
    // davon heute nicht, ist die Serienaktion nicht ihre Entscheidung.
    const eintraege = await this.serienEintraege(e);
    if (eintraege.some((x) => !this.steuert(user, x, z.team))) {
      return nein("serie_fremde_verantwortung", true);
    }
    return ja(eintraege.length, true, ["eintraege", "laufende_arbeit", "fristen"], true);
  }

  async folgen(user: SessionUser, id: string, aktionRoh: unknown): Promise<KalenderFolgen> {
    const aktion = wahl(aktionRoh, KALENDER_AKTIONEN, "aktion");
    return this.bewerte(user, await this.zugriff(user, id), aktion);
  }

  /**
   * Führt eine Aktion aus — nur mit ausdrücklicher Bestätigung, also nachdem die Folgen gezeigt
   * wurden. Ausführungsaktionen gehen an den Ausführungsdienst; als vollzogen gilt nur, was er
   * bestätigt UND was danach zurückgelesen genau so dasteht.
   */
  async handle(
    user: SessionUser,
    id: string,
    aktionRoh: unknown,
    bestaetigt: unknown,
  ): Promise<{ eintrag: KalenderSicht; folgen: KalenderFolgen }> {
    const aktion = wahl(aktionRoh, KALENDER_AKTIONEN, "aktion");
    if (bestaetigt !== true) {
      throw new KalenderFehler(
        400,
        "bestaetigung_fehlt",
        "Bitte zuerst die Folgen ansehen und die Aktion ausdrücklich bestätigen.",
      );
    }
    const z = await this.zugriff(user, id);
    const folgen = await this.bewerte(user, z, aktion);
    if (!folgen.moeglich) {
      throw new KalenderFehler(409, "nicht_moeglich", `Aktion nicht möglich: ${folgen.hinderung}.`);
    }
    const e = z.eintrag;
    if (aktion === "anzeige_entfernen" || aktion === "anzeige_zeigen") {
      const neu: KalenderEintrag = {
        ...e,
        ausgeblendetFuer:
          aktion === "anzeige_entfernen"
            ? [...e.ausgeblendetFuer, user.id]
            : e.ausgeblendetFuer.filter((k) => k !== user.id),
        geaendertAm: this.jetztIso(),
        fassung: e.fassung + 1,
      };
      if (!(await this.repo.ersetze(neu))) {
        throw new KalenderFehler(409, "konflikt", VERALTET);
      }
      return { eintrag: await this.sicht(user, neu, z.team), folgen };
    }
    const a = this.ausfuehrung as AusfuehrungsNachweis;
    let bestaetigtVomDienst = false;
    let zurueckgelesen = false;
    if ((aktion === "lauf_absagen" || aktion === "arbeit_abbrechen") && e.auftrag && e.lauf) {
      const ziel: LaufStatus = aktion === "lauf_absagen" ? "abgesagt" : "abgebrochen";
      bestaetigtVomDienst =
        aktion === "lauf_absagen"
          ? await a.laufAbsagen(user, e.auftrag.taskId, e.lauf.runId)
          : await a.arbeitAbbrechen(user, e.auftrag.taskId, e.lauf.runId);
      zurueckgelesen = (await a.lauf(user, e.auftrag.taskId, e.lauf.runId))?.status === ziel;
    } else if (e.serie) {
      const pausieren = aktion === "serie_pausieren";
      bestaetigtVomDienst = await a.serieSchalten(user, e.serie.seriesId, pausieren);
      zurueckgelesen = (await a.serie(user, e.serie.seriesId))?.pausiert === pausieren;
    }
    if (!bestaetigtVomDienst || !zurueckgelesen) {
      throw new KalenderFehler(
        409,
        "nicht_bestaetigt",
        "Der Ausführungsdienst hat die Wirkung nicht bestätigt. Der Kalender zeigt den Stand, den der Dienst meldet.",
      );
    }
    return { eintrag: await this.sicht(user, e, z.team), folgen };
  }

  async einstellungen(user: SessionUser): Promise<KalenderEinstellungen> {
    return (await this.repo.einstellungen(user.id)) ?? { sichtmodus: "eigen", geaendertAm: null };
  }

  /**
   * K04: die Sichtwahl betrifft NUR die Tagesansicht. Interne Einträge, Fristen und ihre
   * Zeitsteuerung bleiben in jedem Modus gespeichert und wirksam.
   */
  async setzeEinstellungen(user: SessionUser, eingabe: unknown): Promise<KalenderEinstellungen> {
    const roh = objekt(eingabe ?? {}, "Einstellungen");
    const e: KalenderEinstellungen = {
      sichtmodus: wahl(roh.sichtmodus, SICHTMODI, "sichtmodus"),
      geaendertAm: this.jetztIso(),
    };
    await this.repo.setzeEinstellungen(user.id, e);
    return e;
  }
}
