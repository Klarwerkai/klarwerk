import type { Pool } from "pg";

// ================================================================================================
// INTERNER CHAT — DIREKT-, GRUPPEN-, SPACE- UND ARTIKELGESPRÄCHE (produkt:20261007:interner-chat).
// ================================================================================================
//
// VIER ARTEN, ZWEI ARTEN VON ZUGANG:
//   · `direkt` und `gruppe` — die Teilnehmenden stehen am Gespräch. Wer nicht darin steht, sieht es
//     nicht (404, nicht 403).
//   · `space` und `artikel` — KEINE eigene Teilnehmerliste. Wer das Gespräch liest, entscheidet JETZT
//     das Recht am Space (`darfSpaceInhalteLesen`) bzw. am Artikel (`darfSehen`). Wird jemand aus
//     dem Space genommen oder wandert der Artikel in einen geschlossenen Space, ist das Gespräch für
//     ihn beim nächsten Abruf weg — es gibt keine zweite, veraltete Rechteliste.
//
// INHALTE MIT RECHTEN (Verweise auf Artikel, Ausschnitte, Anhänge) speichert die Nachricht nur als
// KENNUNG. Titel, Vorschau, Ausschnittstext und Dateiangaben werden bei JEDEM Abruf für die lesende
// Person neu gegen `darfSehen` gehalten (`routes/chat-routes.ts`). Ein späterer Rechteentzug wirkt
// damit sofort, auch auf alte Nachrichten.
//
// SENDEN IST WIEDERHOLBAR: jede Nachricht trägt die `sendeKennung` des Absenders. Eine zweite
// Sendung mit derselben Kennung im selben Gespräch legt nichts Neues an, sondern gibt die erste
// zurück — eine Wiederholung nach einem Netzfehler dupliziert nicht (Schlüssel in der Tabelle).

export const GESPRAECH_ARTEN = ["direkt", "gruppe", "space", "artikel"] as const;
export type GespraechArt = (typeof GESPRAECH_ARTEN)[number];

/** Persönlich ist das Zweiergespräch; alles mit mehr Beteiligten oder Raumbezug ist geteilt. */
export type ChatSichtbarkeit = "persoenlich" | "geteilt";

export function sichtbarkeitVon(art: GespraechArt): ChatSichtbarkeit {
  return art === "direkt" ? "persoenlich" : "geteilt";
}

export interface Gespraech {
  id: string;
  art: GespraechArt;
  /** Nur bei `gruppe` gesetzt; die anderen Arten nennt die Oberfläche nach Person, Space, Artikel. */
  titel: string;
  /** `direkt`/`gruppe`: die Teilnehmenden (Kontokennungen, sortiert). Sonst leer. */
  teilnehmer: string[];
  spaceId?: string;
  koId?: string;
  angelegtVon: string;
  angelegtAm: string;
  /**
   * Eindeutiger Schlüssel, damit dasselbe Gespräch nicht zweimal entsteht: `direkt:a|b`,
   * `space:<id>`, `artikel:<id>`. Gruppen haben keinen — zwei Gruppen dürfen gleich besetzt sein.
   */
  schluessel?: string;
}

/** Ein markierter Ausschnitt — aus einem echten Artikel (Kennung + Fassung) oder fiktiv (Vorschau). */
export interface ChatAusschnitt {
  text: string;
  fiktiv: boolean;
  /** Anzeigename der Herkunft zum Zeitpunkt des Markierens (Artikeltitel, Name der Vorschauseite). */
  quelle: string;
  koId?: string;
  fassung?: number;
  /** Nur fiktiv: der Pfad der Vorschauseite (`/klara-vorschau/…`), auf die der Rücklink führt. */
  pfad?: string;
}

export interface ChatAnhangVerweis {
  koId: string;
  anhangId: string;
}

export interface ChatUebernahme {
  von: string;
  entwurfId: string;
  am: string;
}

export interface ChatNachricht {
  id: string;
  gespraechId: string;
  von: string;
  text: string;
  am: string;
  sendeKennung: string;
  erwaehnungen: string[];
  /** Kennungen der verwiesenen Artikel (ausdrücklich gewählt oder als `/wissen/<id>` im Text). */
  verweise: string[];
  anhaenge: ChatAnhangVerweis[];
  ausschnitt?: ChatAusschnitt;
  /** Der Entwurf kam aus Klara und wurde bewusst abgeschickt. */
  ausKlara?: true;
  /** Wissensübernahmen — je Person höchstens eine; gezeigt wird nur die eigene. */
  uebernahmen: ChatUebernahme[];
}

export const CHAT_GRENZEN = {
  text: 4_000,
  titel: 80,
  sendeKennung: 80,
  gruppeTeilnehmer: 50,
  erwaehnungen: 20,
  verweise: 10,
  anhaenge: 5,
  ausschnitt: 1_200,
  quelle: 200,
  nachrichtenJeAbruf: 500,
  erwaehnungenJeAbruf: 50,
} as const;

export class ChatFehler extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChatFehler";
  }
}

function text(wert: unknown): string {
  return typeof wert === "string" ? wert.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: genau diese Zeichen gehen weg.
const STEUERZEICHEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Der Nachrichtentext behält Zeilenumbrüche; nur Ränder und Steuerzeichen gehen weg. */
export function nachrichtenText(wert: unknown): string {
  if (typeof wert !== "string") {
    return "";
  }
  const ohneSteuerzeichen = wert.normalize("NFC").replace(STEUERZEICHEN, "");
  return ohneSteuerzeichen.replace(/\r\n?/g, "\n").trim();
}

export function direktSchluessel(a: string, b: string): string {
  return `direkt:${[a, b].sort().join("|")}`;
}

/** Artikelkennungen aus `/wissen/<id>`-Links im Text — als Verweise behandelt. */
export function verweiseImText(roh: string): string[] {
  const raus: string[] = [];
  for (const treffer of roh.matchAll(/\/wissen\/([A-Za-z0-9_-]{1,80})/g)) {
    const id = treffer[1];
    if (id && !raus.includes(id)) {
      raus.push(id);
    }
  }
  return raus;
}

function kennungsListe(roh: unknown, grenze: number, was: string): string[] {
  if (roh === undefined || roh === null) {
    return [];
  }
  if (!Array.isArray(roh) || roh.length > grenze) {
    throw new ChatFehler("CHAT_UNGUELTIG", `${was} sind keine gültige Liste.`);
  }
  const raus: string[] = [];
  for (const eintrag of roh) {
    const id = text(eintrag);
    if (!id) {
      throw new ChatFehler("CHAT_UNGUELTIG", `${was} enthalten einen leeren Eintrag.`);
    }
    if (!raus.includes(id)) {
      raus.push(id);
    }
  }
  return raus;
}

export interface NachrichtEingabe {
  text: string;
  sendeKennung: string;
  erwaehnungen: string[];
  verweise: string[];
  anhaenge: ChatAnhangVerweis[];
  ausschnitt?: ChatAusschnitt;
  ausKlara: boolean;
}

/**
 * Prüft die Gestalt einer Sendung und gibt sie bereinigt zurück — oder wirft `ChatFehler`. Die
 * RECHTE (darf der Absender den Artikel sehen, kann die Erwähnte das Gespräch lesen) prüft die
 * Route; hier steht nur, was ohne Bestand entscheidbar ist.
 */
export function pruefeNachrichtEingabe(roh: unknown): NachrichtEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Erwartet wird eine Nachricht als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const inhalt = nachrichtenText(r.text);
  if (!inhalt || inhalt.length > CHAT_GRENZEN.text) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Der Text fehlt oder ist zu lang.");
  }
  const sendeKennung = text(r.sendeKennung);
  if (
    sendeKennung.length < 8 ||
    sendeKennung.length > CHAT_GRENZEN.sendeKennung ||
    !/^[A-Za-z0-9_-]+$/.test(sendeKennung)
  ) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Die Sendekennung fehlt oder ist ungültig.");
  }
  const erwaehnungen = kennungsListe(r.erwaehnungen, CHAT_GRENZEN.erwaehnungen, "Erwähnungen");
  const verweise = kennungsListe(r.verweise, CHAT_GRENZEN.verweise, "Verweise");
  for (const id of verweiseImText(inhalt)) {
    if (!verweise.includes(id)) {
      verweise.push(id);
    }
  }
  if (verweise.length > CHAT_GRENZEN.verweise) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Zu viele Verweise in einer Nachricht.");
  }
  const rohAnhaenge = r.anhaenge ?? [];
  if (!Array.isArray(rohAnhaenge) || rohAnhaenge.length > CHAT_GRENZEN.anhaenge) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Die Anhänge sind keine gültige Liste.");
  }
  const anhaenge: ChatAnhangVerweis[] = [];
  for (const eintrag of rohAnhaenge) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const koId = text(e.koId);
    const anhangId = text(e.anhangId);
    if (!koId || !anhangId) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Ein Anhang nennt Artikel und Anhang.");
    }
    if (!anhaenge.some((a) => a.koId === koId && a.anhangId === anhangId)) {
      anhaenge.push({ koId, anhangId });
    }
  }
  let ausschnitt: ChatAusschnitt | undefined;
  if (r.ausschnitt !== undefined && r.ausschnitt !== null) {
    if (typeof r.ausschnitt !== "object") {
      throw new ChatFehler("CHAT_UNGUELTIG", "Der Ausschnitt ist kein Objekt.");
    }
    const a = r.ausschnitt as Record<string, unknown>;
    const atext = nachrichtenText(a.text);
    const quelle = text(a.quelle);
    if (!atext || atext.length > CHAT_GRENZEN.ausschnitt) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Der Ausschnitt fehlt oder ist zu lang.");
    }
    if (!quelle || quelle.length > CHAT_GRENZEN.quelle) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Die Herkunft des Ausschnitts fehlt.");
    }
    const koId = text(a.koId);
    if (koId) {
      const fassung = a.fassung;
      const mitFassung = typeof fassung === "number" && Number.isInteger(fassung) && fassung > 0;
      ausschnitt = {
        text: atext,
        fiktiv: false,
        quelle,
        koId,
        ...(mitFassung ? { fassung } : {}),
      };
    } else {
      // Ohne Artikelkennung ist der Ausschnitt fiktiv — er muss es auch so nennen. Sein Rücklink
      // führt nur in die Klara-Vorschau, nie an eine beliebige Adresse.
      if (a.fiktiv !== true) {
        throw new ChatFehler(
          "CHAT_UNGUELTIG",
          "Ein Ausschnitt ohne Artikel muss als fiktiv gekennzeichnet sein.",
        );
      }
      const pfad = text(a.pfad);
      ausschnitt = {
        text: atext,
        fiktiv: true,
        quelle,
        ...(/^\/klara-vorschau(\/[A-Za-z0-9_-]+)*$/.test(pfad) ? { pfad } : {}),
      };
    }
  }
  return {
    text: inhalt,
    sendeKennung,
    erwaehnungen,
    verweise,
    anhaenge,
    ...(ausschnitt ? { ausschnitt } : {}),
    ausKlara: r.ausKlara === true,
  };
}

/** Gleicht eine Wiederholung dem schon gespeicherten Stand? Sonst ist die Kennung belegt. */
export function gleicheSendung(n: ChatNachricht, e: NachrichtEingabe): boolean {
  return (
    n.text === e.text &&
    JSON.stringify(n.erwaehnungen) === JSON.stringify(e.erwaehnungen) &&
    JSON.stringify(n.verweise) === JSON.stringify(e.verweise) &&
    JSON.stringify(n.anhaenge) === JSON.stringify(e.anhaenge) &&
    JSON.stringify(n.ausschnitt ?? null) === JSON.stringify(e.ausschnitt ?? null)
  );
}

export interface GespraechEingabe {
  art: GespraechArt;
  titel: string;
  teilnehmer: string[];
  spaceId?: string;
  koId?: string;
}

/** Gestalt eines neuen Gesprächs; Konten und Rechte prüft die Route. */
export function pruefeGespraechEingabe(roh: unknown, ich: string): GespraechEingabe {
  if (typeof roh !== "object" || roh === null) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Erwartet wird ein Gespräch als Objekt.");
  }
  const r = roh as Record<string, unknown>;
  const art = r.art;
  if (!GESPRAECH_ARTEN.includes(art as GespraechArt)) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Die Art ist direkt, gruppe, space oder artikel.");
  }
  if (art === "direkt") {
    const andere = kennungsListe(r.teilnehmer, 2, "Teilnehmende").filter((id) => id !== ich);
    if (andere.length !== 1) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Ein Direktgespräch hat genau eine andere Person.");
    }
    return { art, titel: "", teilnehmer: [ich, ...andere].sort() };
  }
  if (art === "gruppe") {
    const titel = text(r.titel);
    if (!titel || titel.length > CHAT_GRENZEN.titel) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Eine Gruppe braucht einen Namen.");
    }
    const alle = kennungsListe(r.teilnehmer, CHAT_GRENZEN.gruppeTeilnehmer, "Teilnehmende");
    const andere = alle.filter((id) => id !== ich);
    if (andere.length < 1) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Eine Gruppe braucht mindestens eine andere Person.");
    }
    return { art, titel, teilnehmer: [ich, ...andere].sort() };
  }
  if (art === "space") {
    const spaceId = text(r.spaceId);
    if (!spaceId) {
      throw new ChatFehler("CHAT_UNGUELTIG", "Ein Spacegespräch nennt seinen Space.");
    }
    return { art, titel: "", teilnehmer: [], spaceId };
  }
  const koId = text(r.koId);
  if (!koId) {
    throw new ChatFehler("CHAT_UNGUELTIG", "Ein Artikelgespräch nennt seinen Artikel.");
  }
  return { art: "artikel", titel: "", teilnehmer: [], koId };
}

// ================================================================================================
// DIE ABLAGE.
// ================================================================================================

export interface ChatRepo {
  gespraech(id: string): Promise<Gespraech | undefined>;
  /** Legt an — gibt es den Schlüssel schon, das bestehende Gespräch (`neu: false`). */
  legeGespraech(g: Gespraech): Promise<{ gespraech: Gespraech; neu: boolean }>;
  /** Alle Gespräche, an denen die Person teilnimmt, und alle Space-/Artikelgespräche. */
  gespraecheFuer(nutzerId: string): Promise<Gespraech[]>;
  /**
   * Die Nachrichten eines Gesprächs, aufsteigend nach Zeit — höchstens die jüngsten `grenze`. Mit
   * `vor` nur die, die ÄLTER sind als diese Nachricht (Nachladen des früheren Verlaufs).
   */
  nachrichten(gespraechId: string, grenze: number, vor?: ChatNachricht): Promise<ChatNachricht[]>;
  /** Je Gespräch die jüngste Nachricht und die Anzahl. */
  ueberblick(
    gespraechIds: readonly string[],
  ): Promise<Map<string, { letzte: ChatNachricht; anzahl: number }>>;
  nachricht(id: string): Promise<ChatNachricht | undefined>;
  /**
   * Legt an — gibt es (Gespräch, Absender, Sendekennung) schon, die gespeicherte Nachricht
   * (`neu: false`). Das ist die Wiederholungsregel.
   */
  legeNachricht(n: ChatNachricht): Promise<{ nachricht: ChatNachricht; neu: boolean }>;
  /** Hält eine Wissensübernahme fest (je Person eine). */
  vermerkeUebernahme(id: string, eintrag: ChatUebernahme): Promise<ChatNachricht | undefined>;
  /** Die jüngsten Nachrichten, in denen die Person erwähnt ist. */
  erwaehnungenVon(nutzerId: string, grenze: number): Promise<ChatNachricht[]>;
}

function nachZeit(a: ChatNachricht, b: ChatNachricht): number {
  return a.am.localeCompare(b.am) || a.id.localeCompare(b.id);
}

export class InMemoryChatRepo implements ChatRepo {
  private readonly gespraeche = new Map<string, Gespraech>();
  private readonly zeilen = new Map<string, ChatNachricht>();

  gespraech(id: string): Promise<Gespraech | undefined> {
    const g = this.gespraeche.get(id);
    return Promise.resolve(g ? structuredClone(g) : undefined);
  }

  legeGespraech(g: Gespraech): Promise<{ gespraech: Gespraech; neu: boolean }> {
    if (g.schluessel) {
      for (const vorhanden of this.gespraeche.values()) {
        if (vorhanden.schluessel === g.schluessel) {
          return Promise.resolve({ gespraech: structuredClone(vorhanden), neu: false });
        }
      }
    }
    this.gespraeche.set(g.id, structuredClone(g));
    return Promise.resolve({ gespraech: structuredClone(g), neu: true });
  }

  gespraecheFuer(nutzerId: string): Promise<Gespraech[]> {
    const raus: Gespraech[] = [];
    for (const g of this.gespraeche.values()) {
      if (g.art === "space" || g.art === "artikel" || g.teilnehmer.includes(nutzerId)) {
        raus.push(structuredClone(g));
      }
    }
    return Promise.resolve(raus);
  }

  nachrichten(gespraechId: string, grenze: number, vor?: ChatNachricht): Promise<ChatNachricht[]> {
    const alle = [...this.zeilen.values()].filter(
      (n) => n.gespraechId === gespraechId && (!vor || nachZeit(n, vor) < 0),
    );
    alle.sort(nachZeit);
    return Promise.resolve(alle.slice(-grenze).map((n) => structuredClone(n)));
  }

  ueberblick(
    gespraechIds: readonly string[],
  ): Promise<Map<string, { letzte: ChatNachricht; anzahl: number }>> {
    const raus = new Map<string, { letzte: ChatNachricht; anzahl: number }>();
    for (const n of this.zeilen.values()) {
      if (!gespraechIds.includes(n.gespraechId)) {
        continue;
      }
      const bisher = raus.get(n.gespraechId);
      if (!bisher) {
        raus.set(n.gespraechId, { letzte: structuredClone(n), anzahl: 1 });
        continue;
      }
      bisher.anzahl += 1;
      if (nachZeit(bisher.letzte, n) < 0) {
        bisher.letzte = structuredClone(n);
      }
    }
    return Promise.resolve(raus);
  }

  nachricht(id: string): Promise<ChatNachricht | undefined> {
    const n = this.zeilen.get(id);
    return Promise.resolve(n ? structuredClone(n) : undefined);
  }

  legeNachricht(n: ChatNachricht): Promise<{ nachricht: ChatNachricht; neu: boolean }> {
    for (const vorhanden of this.zeilen.values()) {
      if (
        vorhanden.gespraechId === n.gespraechId &&
        vorhanden.von === n.von &&
        vorhanden.sendeKennung === n.sendeKennung
      ) {
        return Promise.resolve({ nachricht: structuredClone(vorhanden), neu: false });
      }
    }
    this.zeilen.set(n.id, structuredClone(n));
    return Promise.resolve({ nachricht: structuredClone(n), neu: true });
  }

  vermerkeUebernahme(id: string, eintrag: ChatUebernahme): Promise<ChatNachricht | undefined> {
    const n = this.zeilen.get(id);
    if (!n) {
      return Promise.resolve(undefined);
    }
    if (!n.uebernahmen.some((u) => u.von === eintrag.von)) {
      n.uebernahmen.push({ ...eintrag });
    }
    return Promise.resolve(structuredClone(n));
  }

  erwaehnungenVon(nutzerId: string, grenze: number): Promise<ChatNachricht[]> {
    return Promise.resolve(
      [...this.zeilen.values()]
        .filter((n) => n.erwaehnungen.includes(nutzerId))
        .sort((a, b) => nachZeit(b, a))
        .slice(0, grenze)
        .map((n) => structuredClone(n)),
    );
  }
}

/**
 * Zwei Tabellen. REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE/INDEX IF NOT EXISTS`, kein DROP,
 * kein Fremdschlüssel, keine Extension, kein Seed. Die Wiederholungsregel ist der Unique-Schlüssel
 * (gespraech_id, von, sende_kennung); die Eindeutigkeit von Direkt-/Space-/Artikelgesprächen der
 * Unique-Schlüssel auf `schluessel` (Gruppen tragen NULL und sind frei).
 */
export const CHAT_SCHEMA = `
CREATE TABLE IF NOT EXISTS chat_gespraeche (
  id text PRIMARY KEY,
  art text NOT NULL,
  schluessel text UNIQUE,
  teilnehmer text[] NOT NULL,
  angelegt_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_nachrichten (
  id text PRIMARY KEY,
  gespraech_id text NOT NULL,
  von text NOT NULL,
  sende_kennung text NOT NULL,
  am timestamptz NOT NULL,
  erwaehnt text[] NOT NULL,
  data jsonb NOT NULL,
  UNIQUE (gespraech_id, von, sende_kennung)
);
CREATE INDEX IF NOT EXISTS idx_chat_nachrichten_gespraech
  ON chat_nachrichten (gespraech_id, am);
`;

interface DataZeile<T> {
  data: T;
}

interface UeberblickZeile {
  gespraech_id: string;
  data: ChatNachricht;
  anzahl: number;
}

export class PgChatRepo implements ChatRepo {
  /** Übernahmen derselben Nachricht nacheinander, damit keine zweite die erste überschreibt. */
  private readonly sperren = new Map<string, Promise<unknown>>();

  constructor(private readonly pool: Pool) {}

  async gespraech(id: string): Promise<Gespraech | undefined> {
    const res = await this.pool.query<DataZeile<Gespraech>>(
      "SELECT data FROM chat_gespraeche WHERE id = $1",
      [id],
    );
    return res.rows[0]?.data;
  }

  async legeGespraech(g: Gespraech): Promise<{ gespraech: Gespraech; neu: boolean }> {
    const res = await this.pool.query(
      `INSERT INTO chat_gespraeche (id, art, schluessel, teilnehmer, angelegt_am, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [g.id, g.art, g.schluessel ?? null, g.teilnehmer, g.angelegtAm, JSON.stringify(g)],
    );
    if ((res.rowCount ?? 0) === 1) {
      return { gespraech: g, neu: true };
    }
    const vorhanden = await this.pool.query<DataZeile<Gespraech>>(
      "SELECT data FROM chat_gespraeche WHERE schluessel = $1",
      [g.schluessel ?? null],
    );
    const erstes = vorhanden.rows[0]?.data;
    if (!erstes) {
      throw new ChatFehler("CHAT_KONFLIKT", "Das Gespräch konnte nicht angelegt werden.");
    }
    return { gespraech: erstes, neu: false };
  }

  async gespraecheFuer(nutzerId: string): Promise<Gespraech[]> {
    const res = await this.pool.query<DataZeile<Gespraech>>(
      `SELECT data FROM chat_gespraeche
        WHERE art IN ('space', 'artikel') OR $1 = ANY(teilnehmer)`,
      [nutzerId],
    );
    return res.rows.map((z) => z.data);
  }

  async nachrichten(
    gespraechId: string,
    grenze: number,
    vor?: ChatNachricht,
  ): Promise<ChatNachricht[]> {
    // Mit `vor`: dieselbe Ordnung (am, id) wie unten, nur strikt davor — die Seiten schließen
    // lückenlos aneinander an.
    const res = await this.pool.query<DataZeile<ChatNachricht>>(
      `SELECT data FROM (
         SELECT data, am, id FROM chat_nachrichten
          WHERE gespraech_id = $1
            AND ($3::timestamptz IS NULL OR (am, id) < ($3::timestamptz, $4::text))
          ORDER BY am DESC, id DESC
          LIMIT $2
       ) j ORDER BY am ASC, id ASC`,
      [gespraechId, grenze, vor?.am ?? null, vor?.id ?? null],
    );
    return res.rows.map((z) => z.data);
  }

  async ueberblick(
    gespraechIds: readonly string[],
  ): Promise<Map<string, { letzte: ChatNachricht; anzahl: number }>> {
    const raus = new Map<string, { letzte: ChatNachricht; anzahl: number }>();
    if (gespraechIds.length === 0) {
      return raus;
    }
    const res = await this.pool.query<UeberblickZeile>(
      `SELECT DISTINCT ON (gespraech_id) gespraech_id, data,
              (count(*) OVER (PARTITION BY gespraech_id))::int AS anzahl
         FROM chat_nachrichten
        WHERE gespraech_id = ANY($1)
        ORDER BY gespraech_id, am DESC, id DESC`,
      [[...gespraechIds]],
    );
    for (const z of res.rows) {
      raus.set(z.gespraech_id, { letzte: z.data, anzahl: z.anzahl });
    }
    return raus;
  }

  async nachricht(id: string): Promise<ChatNachricht | undefined> {
    const res = await this.pool.query<DataZeile<ChatNachricht>>(
      "SELECT data FROM chat_nachrichten WHERE id = $1",
      [id],
    );
    return res.rows[0]?.data;
  }

  async legeNachricht(n: ChatNachricht): Promise<{ nachricht: ChatNachricht; neu: boolean }> {
    const res = await this.pool.query(
      `INSERT INTO chat_nachrichten (id, gespraech_id, von, sende_kennung, am, erwaehnt, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (gespraech_id, von, sende_kennung) DO NOTHING`,
      [n.id, n.gespraechId, n.von, n.sendeKennung, n.am, n.erwaehnungen, JSON.stringify(n)],
    );
    if ((res.rowCount ?? 0) === 1) {
      return { nachricht: n, neu: true };
    }
    const vorhanden = await this.pool.query<DataZeile<ChatNachricht>>(
      `SELECT data FROM chat_nachrichten
        WHERE gespraech_id = $1 AND von = $2 AND sende_kennung = $3`,
      [n.gespraechId, n.von, n.sendeKennung],
    );
    const erste = vorhanden.rows[0]?.data;
    if (!erste) {
      throw new ChatFehler("CHAT_KONFLIKT", "Die Nachricht konnte nicht gespeichert werden.");
    }
    return { nachricht: erste, neu: false };
  }

  async vermerkeUebernahme(
    id: string,
    eintrag: ChatUebernahme,
  ): Promise<ChatNachricht | undefined> {
    const vorher = this.sperren.get(id) ?? Promise.resolve();
    const lauf = vorher.then(async () => {
      const n = await this.nachricht(id);
      if (!n) {
        return undefined;
      }
      if (n.uebernahmen.some((u) => u.von === eintrag.von)) {
        return n;
      }
      const nachher: ChatNachricht = { ...n, uebernahmen: [...n.uebernahmen, eintrag] };
      await this.pool.query("UPDATE chat_nachrichten SET data = $2 WHERE id = $1", [
        id,
        JSON.stringify(nachher),
      ]);
      return nachher;
    });
    const gesichert = lauf.catch(() => undefined);
    this.sperren.set(id, gesichert);
    void gesichert.finally(() => {
      if (this.sperren.get(id) === gesichert) {
        this.sperren.delete(id);
      }
    });
    return lauf;
  }

  async erwaehnungenVon(nutzerId: string, grenze: number): Promise<ChatNachricht[]> {
    const res = await this.pool.query<DataZeile<ChatNachricht>>(
      `SELECT data FROM chat_nachrichten
        WHERE $1 = ANY(erwaehnt)
        ORDER BY am DESC, id DESC
        LIMIT $2`,
      [nutzerId, grenze],
    );
    return res.rows.map((z) => z.data);
  }
}
