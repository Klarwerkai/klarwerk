import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { type AnswerSnapshotRepo, gehoertNutzer } from "../../ask";

// ================================================================================================
// produkt:20261008:klara-basis — DAS PERSÖNLICHE KLARA-GESPRÄCH, SERVERSEITIG UNTER DER EIGENEN PERSON.
// ================================================================================================
//
// „Persönliche Gespräche serverseitig unter der eigenen Person speichern und nach Neuladen, erneuter
// Anmeldung und Seitenwechsel fortsetzen. Der letzte bewusst begonnene Schritt und sein Objektbezug
// bleiben erhalten." (Auftrag Klara 01.)
//
// EIN EIGENER DATENRAUM wie das Interaktionsgedächtnis (`interaktionsgedaechtnis.ts`):
//   · Ein Gespräch gehört GENAU EINEM KONTO. Jede Operation nimmt die Kontokennung aus der Sitzung;
//     ein fremdes und ein unbekanntes Gespräch antworten gleich (404). Auch Administratoren lesen
//     fremde Gespräche nicht.
//   · Das Gespräch trägt seinen URSPRÜNGLICHEN OBJEKTBEZUG (Seite und Objekt beim Beginn), jede
//     Nachricht ihren eigenen, und den LETZTEN BEWUSST BEGONNENEN SCHRITT mit Stand.
//   · Eine Antwort „aus dem Frageweg" (`ki`/`ohne_ki`) braucht eine Antwortkennung, die serverseitig
//     nachgeschlagen wird und dem Konto gehört (`gehoertNutzer`, dieselbe Regel wie im Gedächtnis).
//     Eine erfundene oder fremde Kennung wird abgewiesen — eine gespeicherte Klara-Antwort ist damit
//     immer an einen echten, eigenen Lauf von `POST /api/ask` gebunden.
//   · Fragen und Antworten aus dem Frageweg setzen die EINWILLIGUNG dieses Gesprächs voraus
//     (`einwilligungAm`). Ohne sie lehnt der Server die Ablage ab — er hält nichts fest, was ohne
//     Zustimmung an den Frageweg gegangen wäre.
//
// BEWUSST NICHT HIER: Der Server ruft keine KI. Die Frage geht über den unveränderten Frageweg
// `POST /api/ask` (KI-Abschaltung, Sichtbarkeit, Grund- und Vertraulichkeitsfreigabe wirken dort);
// diese Ablage hält nur fest, was die Person gefragt und was sie zurückbekommen hat.

export type KlaraVon = "du" | "klara";

/**
 * Was eine Nachricht ist:
 *   frage        — eine getippte Frage, die an den Frageweg ging (Einwilligung nötig)
 *   hilfe        — eine Bitte an Klaras eingebaute Hilfe (Tutorial, Seitenerklärung), ohne KI
 *   ki           — eine Antwort des Fragewegs, von einem Modell formuliert
 *   ohne_ki      — eine Antwort des Fragewegs OHNE Modell (wörtliche geprüfte Aussage oder Lücke)
 *   hilfetext    — Klaras eingebaute Hilfeantwort, ohne KI
 *   abgebrochen  — die Person hat die Anfrage gestoppt; es kam keine Antwort
 *   fehler       — der tatsächliche Fehlerzustand (Abschaltung, Anmeldung, Berechtigung, Netz …)
 */
export type KlaraModus =
  | "frage"
  | "hilfe"
  | "ki"
  | "ohne_ki"
  | "hilfetext"
  | "abgebrochen"
  | "fehler";

const MODI_DU: readonly KlaraModus[] = ["frage", "hilfe"];
const MODI_KLARA: readonly KlaraModus[] = ["ki", "ohne_ki", "hilfetext", "abgebrochen", "fehler"];
/** Diese Modi stammen aus dem Frageweg oder gingen an ihn — sie setzen die Einwilligung voraus. */
const MODI_MIT_EINWILLIGUNG: readonly KlaraModus[] = ["frage", "ki", "ohne_ki"];
/** Diese Modi tragen eine geprüfte Antwortkennung — und nur sie. */
const MODI_MIT_ANTWORT: readonly KlaraModus[] = ["ki", "ohne_ki"];

export type KlaraSchrittArt = "frage" | "hilfe";
export type KlaraSchrittStand = "laeuft" | "beantwortet" | "abgebrochen" | "fehlgeschlagen";
const SCHRITT_ARTEN: readonly KlaraSchrittArt[] = ["frage", "hilfe"];
const SCHRITT_STAENDE: readonly KlaraSchrittStand[] = [
  "laeuft",
  "beantwortet",
  "abgebrochen",
  "fehlgeschlagen",
];

/** Klara 03: der Bezug, den die Person für einen Schritt gewählt hat. */
export type KlaraBezug = "seite" | "markierung" | "frei";
const BEZUEGE: readonly KlaraBezug[] = ["seite", "markierung", "frei"];
const MODI_SEITE = ["lesen", "bearbeiten"] as const;
const PRUEFSTAENDE = ["geprueft", "ungeprueft"] as const;
const LESARTEN = ["original", "uebersetzung"] as const;
export const KLARA_AUSWAHL_MAX = 300;

/** Wo etwas geschah: Seite und Objekt, wie Klara sie auf dem Bildschirm gelesen hat. */
export interface KlaraObjektbezug {
  readonly pfad: string;
  readonly seitenName: string;
  readonly objekt: string;
  readonly artikelId?: string;
  readonly absatz?: number;
  // produkt:20261007:klara-kontext-tutorial (Klara 03) — der Bezug aus dem Appzustand, alles
  // wahlweise: ein Gespräch aus Klara 01 trägt nichts davon und bleibt gültig.
  /** Das Wissensobjekt, auf das sich der Schritt bezog, und die Fassung, die dabei zu sehen war. */
  readonly koId?: string;
  readonly fassung?: number;
  /** Lese- oder Bearbeitungsmodus der Seite in diesem Augenblick. */
  readonly modus?: (typeof MODI_SEITE)[number];
  /** Prüfstatus des Objekts in diesem Augenblick (Anzeige, keine Freigabeentscheidung). */
  readonly pruefstatus?: (typeof PRUEFSTAENDE)[number];
  /** Original oder Leseübersetzung — woraus eine Markierung stammt. */
  readonly lesart?: (typeof LESARTEN)[number];
  /** Seite, Markierung oder freies Gespräch. */
  readonly bezug?: KlaraBezug;
  /** Der Anfang der Markierung (gekürzt), wenn der Bezug die Markierung war. */
  readonly auswahl?: string;
}

/**
 * Klara 03: eine Quelle einer Antwort, wie der Frageweg sie für DIESE Antwort nannte — Titel, die
 * gelesene Fassung und ob die Quelle geprüft war. `null` heisst: der Frageweg hat es nicht gesagt.
 */
export interface KlaraQuellenAngabe {
  readonly koId: string;
  readonly titel: string;
  readonly fassung: number | null;
  readonly geprueft: boolean | null;
}

export interface KlaraNachricht {
  readonly id: string;
  readonly von: KlaraVon;
  readonly modus: KlaraModus;
  readonly text: string;
  readonly objektbezug: KlaraObjektbezug;
  /** Nur bei `ki`/`ohne_ki`: die geprüfte Kennung der eigenen Antwort. */
  readonly antwortId: string | null;
  /** Nur bei `ki`/`ohne_ki`: die herangezogenen Quellen (Kennungen), wie der Frageweg sie nannte. */
  readonly quellen: readonly string[];
  /**
   * Klara 03, nur bei `ki`/`ohne_ki`: Titel, Fassung und Prüfstatus der Quellen. Fehlt das Feld,
   * stammt die Nachricht aus der Zeit davor oder der Frageweg nannte nichts dazu.
   */
  readonly quellenAngaben?: readonly KlaraQuellenAngabe[];
  /** Nur bei `ki`/`ohne_ki`: die Einstufung der Antwort (`knowledgeClass`). */
  readonly wissensklasse: string | null;
  /** Nur bei `fehler`: ein kurzer Grundschlüssel (`ki_abgeschaltet`, `anmeldung`, …). */
  readonly grund: string | null;
  readonly angelegtAm: string;
}

export interface KlaraSchritt {
  readonly art: KlaraSchrittArt;
  readonly text: string;
  readonly objektbezug: KlaraObjektbezug;
  readonly stand: KlaraSchrittStand;
  readonly begonnenAm: string;
  readonly geaendertAm: string;
}

export interface KlaraGespraech {
  readonly id: string;
  readonly kontoId: string;
  /** Der Objektbezug beim BEGINN des Gesprächs — er ändert sich nie. */
  readonly objektbezug: KlaraObjektbezug;
  readonly nachrichten: readonly KlaraNachricht[];
  readonly letzterSchritt: KlaraSchritt | null;
  readonly einwilligungAm: string | null;
  readonly angelegtAm: string;
  readonly geaendertAm: string;
  /** Zähler für den Standvergleich beim Schreiben (kein stilles Überschreiben paralleler Tabs). */
  readonly fassung: number;
}

export const KLARA_GESPRAECH_MAX_NACHRICHTEN = 400;
export const KLARA_GESPRAECH_MAX_JE_KONTO = 100;
export const KLARA_FRAGE_MAX = 8_000;
export const KLARA_ANTWORT_MAX = 20_000;
const MAX_QUELLEN = 20;

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export interface KlaraGespraechRepo {
  /** Das zuletzt geänderte Gespräch des Kontos — oder `null`. */
  aktuelles(kontoId: string): Promise<KlaraGespraech | null>;
  hole(kontoId: string, id: string): Promise<KlaraGespraech | null>;
  anzahl(kontoId: string): Promise<number>;
  lege(g: KlaraGespraech): Promise<void>;
  /** Schreibt `g`, wenn das gespeicherte Gespräch noch `fassung - 1` trägt; sonst `false`. */
  ersetze(g: KlaraGespraech): Promise<boolean>;
  entferne(kontoId: string, id: string): Promise<boolean>;
}

export class InMemoryKlaraGespraechRepo implements KlaraGespraechRepo {
  private readonly gespraeche = new Map<string, KlaraGespraech>();
  /** Schreibreihenfolge — entscheidet bei gleichem Zeitstempel, welches Gespräch das aktuelle ist. */
  private readonly geschrieben = new Map<string, number>();
  private takt = 0;

  private eigene(kontoId: string): KlaraGespraech[] {
    return [...this.gespraeche.values()].filter((g) => g.kontoId === kontoId);
  }

  aktuelles(kontoId: string): Promise<KlaraGespraech | null> {
    const sortiert = this.eigene(kontoId).sort(
      (a, b) =>
        b.geaendertAm.localeCompare(a.geaendertAm) ||
        (this.geschrieben.get(b.id) ?? 0) - (this.geschrieben.get(a.id) ?? 0),
    );
    return Promise.resolve(sortiert[0] ?? null);
  }

  hole(kontoId: string, id: string): Promise<KlaraGespraech | null> {
    const g = this.gespraeche.get(id);
    return Promise.resolve(g?.kontoId === kontoId ? g : null);
  }

  anzahl(kontoId: string): Promise<number> {
    return Promise.resolve(this.eigene(kontoId).length);
  }

  lege(g: KlaraGespraech): Promise<void> {
    this.gespraeche.set(g.id, g);
    this.takt += 1;
    this.geschrieben.set(g.id, this.takt);
    return Promise.resolve();
  }

  ersetze(g: KlaraGespraech): Promise<boolean> {
    const alt = this.gespraeche.get(g.id);
    if (!alt || alt.kontoId !== g.kontoId || alt.fassung !== g.fassung - 1) {
      return Promise.resolve(false);
    }
    this.gespraeche.set(g.id, g);
    this.takt += 1;
    this.geschrieben.set(g.id, this.takt);
    return Promise.resolve(true);
  }

  entferne(kontoId: string, id: string): Promise<boolean> {
    const g = this.gespraeche.get(id);
    if (!g || g.kontoId !== kontoId) {
      return Promise.resolve(false);
    }
    this.geschrieben.delete(id);
    return Promise.resolve(this.gespraeche.delete(id));
  }
}

/**
 * Eine Zeile je Gespräch, der Inhalt als JSON. REIN ADDITIV UND WIEDERHOLBAR: ein
 * `CREATE TABLE IF NOT EXISTS` und ein `CREATE INDEX IF NOT EXISTS`, kein DROP, kein Fremdschlüssel,
 * keine Extension, kein Seed.
 */
export const KLARA_GESPRAECH_SCHEMA = `
CREATE TABLE IF NOT EXISTS klara_gespraeche (
  id text PRIMARY KEY,
  konto_id text NOT NULL,
  fassung integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_klara_gespraeche_konto
  ON klara_gespraeche (konto_id, geaendert_am DESC);
`;

export class PgKlaraGespraechRepo implements KlaraGespraechRepo {
  constructor(private readonly pool: Pool) {}

  async aktuelles(kontoId: string): Promise<KlaraGespraech | null> {
    const res = await this.pool.query<{ data: KlaraGespraech }>(
      `SELECT data FROM klara_gespraeche WHERE konto_id = $1
        ORDER BY geaendert_am DESC, id DESC LIMIT 1`,
      [kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async hole(kontoId: string, id: string): Promise<KlaraGespraech | null> {
    const res = await this.pool.query<{ data: KlaraGespraech }>(
      "SELECT data FROM klara_gespraeche WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async anzahl(kontoId: string): Promise<number> {
    const res = await this.pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_gespraeche WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? 0;
  }

  async lege(g: KlaraGespraech): Promise<void> {
    await this.pool.query(
      `INSERT INTO klara_gespraeche (id, konto_id, fassung, geaendert_am, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [g.id, g.kontoId, g.fassung, g.geaendertAm, JSON.stringify(g)],
    );
  }

  async ersetze(g: KlaraGespraech): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE klara_gespraeche SET fassung = $3, geaendert_am = $4, data = $5
        WHERE id = $1 AND konto_id = $2 AND fassung = $6`,
      [g.id, g.kontoId, g.fassung, g.geaendertAm, JSON.stringify(g), g.fassung - 1],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async entferne(kontoId: string, id: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM klara_gespraeche WHERE id = $1 AND konto_id = $2",
      [id, kontoId],
    );
    return (res.rowCount ?? 0) > 0;
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type KlaraGespraechGrund =
  | "eingabe"
  | "unbekannt"
  | "antwort_unbekannt"
  | "einwilligung_fehlt"
  | "voll"
  | "konflikt";

export class KlaraGespraechFehler extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly grund: KlaraGespraechGrund,
    message: string,
  ) {
    super(message);
    this.name = "KlaraGespraechFehler";
  }
}

export interface KlaraNachrichtEingabe {
  von?: unknown;
  modus?: unknown;
  text?: unknown;
  objektbezug?: unknown;
  antwortId?: unknown;
  quellen?: unknown;
  quellenAngaben?: unknown;
  wissensklasse?: unknown;
  grund?: unknown;
}

export interface KlaraSchrittEingabe {
  art?: unknown;
  text?: unknown;
  objektbezug?: unknown;
  stand?: unknown;
}

export interface KlaraGespraechDienstDeps {
  readonly repo: KlaraGespraechRepo;
  /** Ohne Angabe ist keine Antwort aus dem Frageweg ablegbar — jede Antwortkennung wird abgewiesen. */
  readonly antworten?: Pick<AnswerSnapshotRepo, "findRecord">;
  readonly jetzt?: () => number;
  readonly neueId?: () => string;
}

function eingabeFehler(message: string): KlaraGespraechFehler {
  return new KlaraGespraechFehler(400, "eingabe", message);
}

function kurzerText(wert: unknown, max: number, feld: string): string {
  if (typeof wert !== "string" || wert.trim().length === 0 || wert.length > max) {
    throw eingabeFehler(`${feld} ist Pflicht und höchstens ${max} Zeichen lang.`);
  }
  return wert.trim();
}

function wahlweiseText(wert: unknown, max: number, feld: string): string | null {
  if (wert === undefined || wert === null) {
    return null;
  }
  return kurzerText(wert, max, feld);
}

function wahlweiseWahl<T extends string>(
  wert: unknown,
  erlaubt: readonly T[],
  feld: string,
): T | null {
  if (wert === undefined || wert === null) {
    return null;
  }
  if (typeof wert !== "string" || !(erlaubt as readonly string[]).includes(wert)) {
    throw eingabeFehler(`${feld} muss einer der Werte ${erlaubt.join(", ")} sein.`);
  }
  return wert as T;
}

function wahlweiseFassung(wert: unknown, feld: string): number | null {
  if (wert === undefined || wert === null) {
    return null;
  }
  if (typeof wert !== "number" || !Number.isSafeInteger(wert) || wert < 1) {
    throw eingabeFehler(`${feld} muss eine positive ganze Zahl sein.`);
  }
  return wert;
}

/** Prüft einen Objektbezug aus dem Netz — nur die bekannten Felder werden übernommen. */
export function pruefeObjektbezug(roh: unknown): KlaraObjektbezug {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw eingabeFehler("objektbezug ist Pflicht.");
  }
  const o = roh as Record<string, unknown>;
  const pfad = kurzerText(o.pfad, 300, "objektbezug.pfad");
  // R-1398: dieselbe Regel wie `internerPfad` in der Oberfläche — `//` oder `/\` am Anfang, ein
  // Backslash oder ein Steuerzeichen machen aus dem Pfad eine fremde Adresse.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: genau diese Zeichen werden abgewiesen.
  if (!pfad.startsWith("/") || pfad.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(pfad)) {
    throw eingabeFehler("objektbezug.pfad muss eine Adresse dieser Anwendung sein.");
  }
  const bezug: {
    -readonly [K in keyof KlaraObjektbezug]: KlaraObjektbezug[K];
  } = {
    pfad,
    seitenName: kurzerText(o.seitenName, 120, "objektbezug.seitenName"),
    objekt: kurzerText(o.objekt, 300, "objektbezug.objekt"),
  };
  const artikelId = wahlweiseText(o.artikelId, 80, "objektbezug.artikelId");
  if (artikelId !== null) {
    bezug.artikelId = artikelId;
  }
  if (o.absatz !== undefined && o.absatz !== null) {
    if (typeof o.absatz !== "number" || !Number.isInteger(o.absatz) || o.absatz < 1) {
      throw eingabeFehler("objektbezug.absatz muss eine positive ganze Zahl sein.");
    }
    bezug.absatz = o.absatz;
  }
  // Klara 03 — dieselbe Regel für jedes neue Feld: bekannt und gültig, sonst abgewiesen; fehlt es,
  // fehlt es auch in der Ablage (kein Füllwert, der etwas behauptet).
  const koId = wahlweiseText(o.koId, 200, "objektbezug.koId");
  if (koId !== null) {
    bezug.koId = koId;
  }
  const fassung = wahlweiseFassung(o.fassung, "objektbezug.fassung");
  if (fassung !== null) {
    bezug.fassung = fassung;
  }
  const modus = wahlweiseWahl(o.modus, MODI_SEITE, "objektbezug.modus");
  if (modus !== null) {
    bezug.modus = modus;
  }
  const pruefstatus = wahlweiseWahl(o.pruefstatus, PRUEFSTAENDE, "objektbezug.pruefstatus");
  if (pruefstatus !== null) {
    bezug.pruefstatus = pruefstatus;
  }
  const lesart = wahlweiseWahl(o.lesart, LESARTEN, "objektbezug.lesart");
  if (lesart !== null) {
    bezug.lesart = lesart;
  }
  const gewaehlt = wahlweiseWahl(o.bezug, BEZUEGE, "objektbezug.bezug");
  if (gewaehlt !== null) {
    bezug.bezug = gewaehlt;
  }
  const auswahl = wahlweiseText(o.auswahl, KLARA_AUSWAHL_MAX, "objektbezug.auswahl");
  if (auswahl !== null) {
    if (gewaehlt !== "markierung") {
      throw eingabeFehler("objektbezug.auswahl gehört nur zum Bezug markierung.");
    }
    bezug.auswahl = auswahl;
  }
  return bezug;
}

/**
 * Klara 03: Titel, Fassung und Prüfstatus der Quellen einer Antwort. Jede Angabe muss zu einer der
 * genannten Quellen gehören — eine Angabe zu einer Kennung, die die Antwort gar nicht nennt, wäre
 * eine erfundene Quelle.
 */
function quellenAngabenAus(roh: unknown, quellen: readonly string[]): KlaraQuellenAngabe[] {
  if (roh === undefined || roh === null) {
    return [];
  }
  if (!Array.isArray(roh) || roh.length > MAX_QUELLEN) {
    throw eingabeFehler(`quellenAngaben: höchstens ${MAX_QUELLEN} Angaben.`);
  }
  const gesehen = new Set<string>();
  return roh.map((eintrag, i) => {
    if (typeof eintrag !== "object" || eintrag === null || Array.isArray(eintrag)) {
      throw eingabeFehler(`quellenAngaben[${i}] ist keine Angabe.`);
    }
    const e = eintrag as Record<string, unknown>;
    const koId = kurzerText(e.koId, 200, `quellenAngaben[${i}].koId`);
    if (!quellen.includes(koId) || gesehen.has(koId)) {
      throw eingabeFehler(`quellenAngaben[${i}] gehört zu keiner (weiteren) Quelle der Antwort.`);
    }
    gesehen.add(koId);
    if (e.geprueft !== undefined && e.geprueft !== null && typeof e.geprueft !== "boolean") {
      throw eingabeFehler(`quellenAngaben[${i}].geprueft muss true, false oder null sein.`);
    }
    return {
      koId,
      titel: kurzerText(e.titel, 300, `quellenAngaben[${i}].titel`),
      fassung: wahlweiseFassung(e.fassung, `quellenAngaben[${i}].fassung`),
      geprueft: typeof e.geprueft === "boolean" ? e.geprueft : null,
    };
  });
}

function quellenAus(roh: unknown): string[] {
  if (roh === undefined || roh === null) {
    return [];
  }
  if (
    !Array.isArray(roh) ||
    roh.length > MAX_QUELLEN ||
    roh.some((q) => typeof q !== "string" || q.length === 0 || q.length > 200)
  ) {
    throw eingabeFehler(`quellen: höchstens ${MAX_QUELLEN} Kennungen.`);
  }
  return [...new Set(roh as string[])];
}

export class KlaraGespraechDienst {
  private readonly repo: KlaraGespraechRepo;
  private readonly antworten: KlaraGespraechDienstDeps["antworten"];
  private readonly jetzt: () => number;
  private readonly neueId: () => string;

  constructor(deps: KlaraGespraechDienstDeps) {
    this.repo = deps.repo;
    this.antworten = deps.antworten;
    this.jetzt = deps.jetzt ?? Date.now;
    this.neueId = deps.neueId ?? randomUUID;
  }

  private jetztIso(): string {
    return new Date(this.jetzt()).toISOString();
  }

  aktuelles(kontoId: string): Promise<KlaraGespraech | null> {
    return this.repo.aktuelles(kontoId);
  }

  async hole(kontoId: string, id: string): Promise<KlaraGespraech> {
    const g = await this.repo.hole(kontoId, id);
    if (!g) {
      // Fremd und unbekannt antworten gleich — die Kennung verrät nichts über fremde Gespräche.
      throw new KlaraGespraechFehler(404, "unbekannt", "Gespräch nicht gefunden.");
    }
    return g;
  }

  async beginne(kontoId: string, objektbezug: unknown): Promise<KlaraGespraech> {
    const bezug = pruefeObjektbezug(objektbezug);
    if ((await this.repo.anzahl(kontoId)) >= KLARA_GESPRAECH_MAX_JE_KONTO) {
      throw new KlaraGespraechFehler(
        409,
        "voll",
        `Es sind höchstens ${KLARA_GESPRAECH_MAX_JE_KONTO} Gespräche gespeichert. Bitte zuerst ältere löschen.`,
      );
    }
    const jetzt = this.jetztIso();
    const g: KlaraGespraech = {
      id: this.neueId(),
      kontoId,
      objektbezug: bezug,
      nachrichten: [],
      letzterSchritt: null,
      einwilligungAm: null,
      angelegtAm: jetzt,
      geaendertAm: jetzt,
      fassung: 1,
    };
    await this.repo.lege(g);
    return g;
  }

  /**
   * Liest, ändert und schreibt mit Standvergleich. Ein paralleles Schreiben (zweiter Tab) wird
   * erkannt und bis zu dreimal neu angewandt — nie still überschrieben.
   */
  private async aendere(
    kontoId: string,
    id: string,
    f: (g: KlaraGespraech, jetzt: string) => Promise<KlaraGespraech> | KlaraGespraech,
  ): Promise<KlaraGespraech> {
    for (let versuch = 0; versuch < 3; versuch++) {
      const alt = await this.hole(kontoId, id);
      const jetzt = this.jetztIso();
      const neu = { ...(await f(alt, jetzt)), geaendertAm: jetzt, fassung: alt.fassung + 1 };
      if (await this.repo.ersetze(neu)) {
        return neu;
      }
    }
    throw new KlaraGespraechFehler(
      409,
      "konflikt",
      "Das Gespräch wurde gleichzeitig an anderer Stelle geändert. Bitte erneut versuchen.",
    );
  }

  async fuegeHinzu(
    kontoId: string,
    id: string,
    eingabe: KlaraNachrichtEingabe,
  ): Promise<{ gespraech: KlaraGespraech; nachricht: KlaraNachricht }> {
    const von = eingabe.von;
    if (von !== "du" && von !== "klara") {
      throw eingabeFehler("von muss du oder klara sein.");
    }
    const modus = eingabe.modus as KlaraModus;
    if (!(von === "du" ? MODI_DU : MODI_KLARA).includes(modus)) {
      throw eingabeFehler(`modus passt nicht zu ${von}.`);
    }
    const text = kurzerText(
      eingabe.text,
      von === "du" ? KLARA_FRAGE_MAX : KLARA_ANTWORT_MAX,
      "text",
    );
    const objektbezug = pruefeObjektbezug(eingabe.objektbezug);
    const mitAntwort = MODI_MIT_ANTWORT.includes(modus);
    if (
      !mitAntwort &&
      (eingabe.antwortId !== undefined ||
        eingabe.quellen !== undefined ||
        eingabe.quellenAngaben !== undefined)
    ) {
      throw eingabeFehler("Nur eine Antwort des Fragewegs trägt Antwortkennung und Quellen.");
    }
    const quellen = mitAntwort ? quellenAus(eingabe.quellen) : [];
    const quellenAngaben = mitAntwort ? quellenAngabenAus(eingabe.quellenAngaben, quellen) : [];
    const wissensklasse = mitAntwort
      ? wahlweiseText(eingabe.wissensklasse, 40, "wissensklasse")
      : null;
    const grund = modus === "fehler" ? wahlweiseText(eingabe.grund, 40, "grund") : null;
    let antwortId: string | null = null;
    if (mitAntwort) {
      const kennung = kurzerText(eingabe.antwortId, 200, "antwortId");
      const record = this.antworten ? await this.antworten.findRecord(kennung) : undefined;
      if (!record || !gehoertNutzer(record, kontoId)) {
        throw new KlaraGespraechFehler(404, "antwort_unbekannt", "Antwort nicht gefunden.");
      }
      antwortId = record.answerId;
    }
    const angelegt: { nachricht?: KlaraNachricht } = {};
    const gespraech = await this.aendere(kontoId, id, (g, jetzt) => {
      if (MODI_MIT_EINWILLIGUNG.includes(modus) && !g.einwilligungAm) {
        throw new KlaraGespraechFehler(
          409,
          "einwilligung_fehlt",
          "Für dieses Gespräch liegt keine Einwilligung vor, Fragen an den Frageweg zu schicken.",
        );
      }
      if (g.nachrichten.length >= KLARA_GESPRAECH_MAX_NACHRICHTEN) {
        throw new KlaraGespraechFehler(
          409,
          "voll",
          `Ein Gespräch hält höchstens ${KLARA_GESPRAECH_MAX_NACHRICHTEN} Nachrichten. Bitte ein neues beginnen.`,
        );
      }
      const nachricht: KlaraNachricht = {
        id: this.neueId(),
        von,
        modus,
        text,
        objektbezug,
        antwortId,
        quellen,
        ...(quellenAngaben.length > 0 ? { quellenAngaben } : {}),
        wissensklasse,
        grund,
        angelegtAm: jetzt,
      };
      angelegt.nachricht = nachricht;
      return { ...g, nachrichten: [...g.nachrichten, nachricht] };
    });
    const nachricht = angelegt.nachricht;
    if (!nachricht) {
      throw new Error("Nachricht wurde nicht angelegt.");
    }
    return { gespraech, nachricht };
  }

  setzeSchritt(kontoId: string, id: string, eingabe: KlaraSchrittEingabe): Promise<KlaraGespraech> {
    const art = eingabe.art as KlaraSchrittArt;
    if (!SCHRITT_ARTEN.includes(art)) {
      throw eingabeFehler("art muss frage oder hilfe sein.");
    }
    const stand = eingabe.stand as KlaraSchrittStand;
    if (!SCHRITT_STAENDE.includes(stand)) {
      throw eingabeFehler("stand ist unbekannt.");
    }
    const text = kurzerText(eingabe.text, KLARA_FRAGE_MAX, "text");
    const objektbezug = pruefeObjektbezug(eingabe.objektbezug);
    return this.aendere(kontoId, id, (g, jetzt) => {
      // Derselbe Schritt (gleiche Art und gleicher Text) behält seinen Beginn; ein neuer beginnt neu.
      const vorher = g.letzterSchritt;
      const derselbe = vorher?.art === art && vorher.text === text && stand !== "laeuft";
      return {
        ...g,
        letzterSchritt: {
          art,
          text,
          objektbezug,
          stand,
          begonnenAm: derselbe && vorher ? vorher.begonnenAm : jetzt,
          geaendertAm: jetzt,
        },
      };
    });
  }

  setzeEinwilligung(kontoId: string, id: string, erteilt: unknown): Promise<KlaraGespraech> {
    if (typeof erteilt !== "boolean") {
      throw eingabeFehler("erteilt muss true oder false sein.");
    }
    return this.aendere(kontoId, id, (g, jetzt) => ({
      ...g,
      einwilligungAm: erteilt ? (g.einwilligungAm ?? jetzt) : null,
    }));
  }

  loesche(kontoId: string, id: string): Promise<boolean> {
    return this.repo.entferne(kontoId, id);
  }
}
