// ================================================================================================
// JOB 3326 · LESEVARIANTE — EINE GEKENNZEICHNETE LESEÜBERSETZUNG NEBEN DEM ORIGINAL.
// ================================================================================================
//
// WAS DAS IST UND WAS AUSDRÜCKLICH NICHT: Eine Lesevariante ist eine ÜBERSETZUNG zum LESEN. Sie ist
// kein zweites Wissensobjekt, kein zweiter Beleg und niemals Gegenstand einer Freigabe. Das
// Original bleibt die Wahrheit: Suche, Ähnlichkeits- und Konfliktprüfung, KI-Antwortkontext, Export
// und Prüfprotokoll arbeiten unverändert auf den Originalfeldern des Wissensobjekts. Genau deshalb
// wohnt die Variante in einer EIGENEN Tabelle und nicht im KO-Dokument: alles, was `kos.data` liest
// (und das ist die halbe Anwendung), sieht sie schlicht nicht.
//
// WOHER DIE ÜBERSETZUNGEN KOMMEN: aus der LOKALEN LIEFERUNG, die neben diesem Quelltext liegt
// (`example-packages/advisor-ict-v1.lokalisierung.json`). KEIN Modellaufruf, keine Cloudübersetzung,
// keine laufenden Kosten. Was nicht in der Lieferung steht, bleibt unübersetzt — ehrlich, statt
// automatisch erfunden.
//
// WARUM DIE ZUORDNUNG ÜBER HERKUNFTSANKER LÄUFT: Jeder Datensatz der Lieferung trägt entweder eine
// `confluence_id` (das sind die 36 importierten Confluence-Seiten) oder nur seinen Paketschlüssel
// (Word-/OneDrive-Material). Das Wissensobjekt trägt denselben Anker in seinen Quellen
// (`KoSource.externalId`). Zugeordnet wird deshalb über den Anker und NIE über Titelähnlichkeit —
// eine Titelheuristik hängte irgendwann die falsche Übersetzung an ein Objekt, und das wäre die
// teuerste Sorte Fehler: der Nutzer läse etwas anderes, als das Objekt sagt.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import type { AuditService } from "../../audit";
import type { KnowledgeObject } from "../../knowledge-object";
// Die kanonische Normalisierung des Provider-Anteils ALLER Import-Schlüssel (trim + kleingeschrieben,
// fehlend zählt als „confluence" — deckungsgleich mit dem Pg-Backfill). Sie wird hier BENUTZT und
// nicht nachgebaut: ein zweiter Vergleich derselben Sache wäre die zweite Wahrheit.
import { importProviderKey } from "../../library-analytics";
// Der Providername der Beispielpaket-Herkunft — DIESELBE Konstante, die `demo-pakete.ts` an die
// Quelle der Paketobjekte schreibt. Ein hier hingeschriebenes „Beispielpaket" wäre die zweite
// Wahrheit, die beim nächsten Umbenennen still danebenläge.
import { EXAMPLE_PROVIDER } from "./example-packages";

// ================================================================================================
// DIE FORM DER LIEFERUNG
// ================================================================================================

export interface LokalisierungsText {
  title: string;
  paragraphs: string[];
}

export interface LokalisierungsRecord {
  key: string;
  semantic_id?: string;
  original_language: string;
  confluence_id?: string;
  confluence_url?: string;
  source_body_sha256?: string;
  translation_status: string;
  en?: LokalisierungsText;
  de?: LokalisierungsText;
  nl?: LokalisierungsText;
}

export interface LokalisierungsPaket {
  schema_version: number;
  package_id: string;
  updated_at: string;
  languages: string[];
  rule?: string;
  records: LokalisierungsRecord[];
}

/**
 * Die eine Lieferung, die dieses Repo kennt. Bewusst eine feste, kleine Liste und kein
 * Verzeichnis-Scan: was geladen werden kann, ist damit im Quelltext ablesbar, und eine versehentlich
 * dort abgelegte Datei wird nicht zur Datenquelle.
 */
const PAKETE: Readonly<Record<string, string>> = {
  "advisor-ict-en-v1": "advisor-ict-v1.lokalisierung.json",
};

const gelesen = new Map<string, LokalisierungsPaket>();

/**
 * Liest die Lieferung von der Platte (einmal je Prozess). Der Pfad wird über `import.meta.url`
 * gebildet — dieselbe Bauform wie die Versionsauskunft in `build-app.ts`, weil der Dienst seinen
 * Quelltext ausführt (`tsx services/app/src/server.ts`) und ein `process.cwd()` je nach Aufrufer
 * woanders steht.
 *
 * JOB 3363: DIE AUFLÖSUNG LÄUFT ÜBER `fileURLToPath` UND NICHT MEHR ÜBER `new URL(rel, base)`.
 * Gemessen, nicht vermutet: unter jsdom ist `globalThis.URL` die whatwg-url-Fassung von jsdom, und
 * die löst eine `file:`-Basis gegen die Dokumentadresse auf —
 *
 *     new URL("./example-packages/x", "file:///…/lesevarianten.ts")
 *       → "http://localhost:3000/…/x"
 *
 * — worauf `readFileSync` mit `ENOENT: open '/services/app/src/example-packages/…'` abbrach. Jeder
 * gemountete Test, der den ECHTEN Server fährt (die Prüfkarte tut genau das), lief damit ins Leere.
 * `fileURLToPath` aus `node:url` wird von jsdom nicht überschrieben und ist die vorgesehene
 * Umrechnung; im Serverbetrieb ist das Ergebnis dasselbe wie vorher.
 *
 * Unbekanntes Paket → `undefined`. Kein Rückfall auf ein anderes Paket: eine falsche Übersetzung
 * wäre schlimmer als gar keine.
 */
export function lokalisierungsPaket(packageId: string): LokalisierungsPaket | undefined {
  const datei = PAKETE[packageId];
  if (!datei) {
    return undefined;
  }
  const zwischenstand = gelesen.get(packageId);
  if (zwischenstand) {
    return zwischenstand;
  }
  const roh = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "example-packages", datei),
    "utf8",
  );
  const paket = JSON.parse(roh) as LokalisierungsPaket;
  gelesen.set(packageId, paket);
  return paket;
}

/**
 * ALLE Lieferungen, die dieses Repo kennt — aus DERSELBEN festen Liste `PAKETE`, über DIESELBE
 * Lesefunktion (also mit demselben Prozesscache). Sie wird gebraucht, wo kein Paket genannt ist:
 * ein Import-Kandidat trägt seine Herkunft (Provider + Quellkennung), aber keine Paket-Kennung.
 * Eine zweite Liste hier wäre die zweite Wahrheit darüber, was geladen werden darf.
 */
export function alleLokalisierungsPakete(): LokalisierungsPaket[] {
  return Object.keys(PAKETE)
    .map((id) => lokalisierungsPaket(id))
    .filter((p): p is LokalisierungsPaket => p !== undefined);
}

// ================================================================================================
// DIE FORM DER GESPEICHERTEN VARIANTE
// ================================================================================================

export interface Lesevariante {
  koId: string;
  /** Sprache der Variante („de"). */
  lang: string;
  /** Sprache des ORIGINALS laut Lieferung („en"). */
  originalLanguage: string;
  title: string;
  statement: string;
  bodyHtml: string;
  /** `lokale Lieferung <package_id>` bzw. `manuell` — woher der Text stammt, im Klartext. */
  herkunft: string;
  /**
   * Der Übersetzungsstand aus der Lieferung — hier immer
   * `draft_translation_not_business_approval`. Die Variante ist NIE Freigabegegenstand; dieses Feld
   * sagt das ausdrücklich, statt es dem Leser zu überlassen.
   */
  status: string;
  /** Der von der Lieferung mitgeteilte Abdruck des ÜBERSETZTEN Quelltextes. NUR gespeichert. */
  sourceBodySha256: string | null;
  /**
   * ================================================================================================
   * WAS DIESER ABDRUCK BELEGT — UND WAS AUSDRÜCKLICH NICHT (Codex e4b79ac9).
   * ================================================================================================
   *
   * Er ist der Abdruck des ORIGINALS in dem Augenblick, in dem DIESE ÜBERSETZUNG abgelegt wurde.
   * Damit belegt er GENAU EINE Aussage: „seit dem Ablegen der Übersetzung unverändert". Er belegt
   * NICHT, dass die Übersetzung zu genau diesem Original gehört — dafür steht `quellabgleich`.
   *
   * ER WIRD NUR MIT DER ÜBERSETZUNG FORTGESCHRIEBEN, nie beim blossen Neuladen derselben
   * Übersetzung. Täte er es, verschwände die Warnung „Original seit Übersetzung geändert" beim
   * nächsten Ladeklick, obwohl die Übersetzung unverändert alt ist — die Warnung wäre dann eine
   * Funktion des letzten Knopfdrucks statt des Sachverhalts (`ladeLesevarianten`).
   */
  originalSha256: string;
  /**
   * Der Abdruck der ÜBERSETZUNG selbst (Titel + Absätze der Lieferung). Er beantwortet die eine
   * Frage, an der `originalSha256` hängt: „ist das eine NEUE Übersetzung oder dieselbe?"
   */
  uebersetzungSha256: string;
  /**
   * Konnte die Zuordnung „diese Übersetzung gehört zu diesem Original" gegen den GELIEFERTEN
   * Quellabdruck geprüft werden? Siehe `quellabgleichFuer`.
   */
  quellabgleich: Quellabgleich;
  updatedAt: string;
}

/**
 * Ob der gelieferte `source_body_sha256` gegen den gespeicherten Originalinhalt gehalten werden
 * KONNTE. „unbestaetigt" ist eine ehrliche Auskunft und keine Beanstandung: sie sagt, dass dieser
 * Beweis fehlt — nicht, dass die Übersetzung falsch wäre.
 */
export type Quellabgleich = "bestaetigt" | "unbestaetigt";

/** Die Variante, wie sie den Leser erreicht — mit der beim Lesen ERMITTELTEN Änderungsauskunft. */
export interface LesevarianteSicht extends Lesevariante {
  /**
   * Das Original hat sich seit dem Ablegen dieser Übersetzung geändert. KEINE Vermutung: der
   * Abdruck des heutigen Originals wird gegen `originalSha256` gehalten. Die Variante bleibt
   * SICHTBAR (sie ist die bessere Auskunft als gar keine), trägt aber diesen Vorbehalt.
   */
  originalGeaendert: boolean;
}

/**
 * Der Abdruck des Klarwerk-ORIGINALS: Titel, Kernaussage und Rumpf, so wie sie im Bestand stehen.
 * Er ist die messbare Hälfte der Prüfung „Original seit Übersetzung geändert" — beim Ablegen der
 * Übersetzung festgehalten, beim Lesen neu gebildet.
 */
export function originalAbdruck(
  ko: Pick<KnowledgeObject, "title" | "statement" | "bodyHtml">,
): string {
  return createHash("sha256")
    .update(`${ko.title}\n${ko.statement}\n${ko.bodyHtml ?? ""}`, "utf8")
    .digest("hex");
}

// ================================================================================================
// JOB 3363 R2 · DER SPRACHWERT IST EINGABE — DIE EINE STELLE, DIE IHN IN DIE LIEFERUNG LÄSST.
// ================================================================================================
//
// WAS FALSCH WAR, gemessen von BEN an der echten App: Beide Lesestellen dieser Datei griffen mit
// `record[lang as "de" | "en" | "nl"]` in den Datensatz. Die Typbehauptung ist zur Laufzeit NICHTS,
// und `:lang` kommt aus der Adresszeile. Damit traf
//
//     …/lesevariante/original_language  → das echte Feld des Datensatzes (die Zeichenkette „en")
//     …/lesevariante/constructor        → den Prototyp (eine Funktion)
//
// beides wahrheitswertig, also lief der Code weiter bis `text.paragraphs.length` und warf:
// HTTP 500, reproduzierbar. Eine Serverausnahme ist keine Antwort — und sie sagt dem Fragenden
// nebenbei, welche Zeichenketten im Datensatz existieren.
//
// DIE SPERRE HAT ZWEI ZÄHNE, und beide werden gebraucht:
//
//   1. DIE LIEFERUNG SAGT, WAS EINE SPRACHE IST. `paket.languages` ist die geführte Liste („de",
//      „en"); was nicht darin steht, ist keine Sprache — auch dann nicht, wenn der Datensatz
//      zufällig ein gleichnamiges Feld trägt. Das schliesst Datensatzfelder UND Prototypschlüssel
//      in EINEM Schritt aus, ohne eine zweite Verbotsliste zu pflegen, die man vergessen kann.
//   2. DER FUND MUSS EIN TEXT SEIN. Auch innerhalb der geführten Sprachen wird geprüft, was
//      wirklich dasteht (`title` als Zeichenkette, `paragraphs` als Feld von Zeichenketten) —
//      eine kaputte Lieferung ergibt dann „kein Text", nicht eine geworfene Ausnahme mitten in
//      einer Antwort. Das deckt zugleich Prototypschlüssel ab, falls eine Lieferung eines Tages
//      eine Sprache namens `constructor` oder `__proto__` führt: was von dort käme, ist eine
//      Funktion oder `Object.prototype` und besteht diese Prüfung nicht.
//
// KEIN DRITTER ZAHN. Ein zusätzliches `Object.hasOwn(record, sprache)` stand hier zwischenzeitlich
// und ist wieder RAUS: gemessen ändert es an keinem einzigen Fall etwas (die Gegenprobe blieb
// grün), weil Zahn 2 jeden Prototypwert ohnehin verwirft — und `JSON.parse` liefert schlichte
// Objekte, deren Prototyp nie einen formgültigen Text trägt. Eine Verteidigung, die nie
// entscheidet, ist keine; sie steht nur da und lässt den Leser glauben, sie täte etwas.
//
// SIE STEHT EINMAL. Ladeweg (`ladeLesevarianten`) und Kandidatenauflösung (`kandidatenLesevariante`)
// rufen dieselbe Funktion; zwei Auslegungen davon, welcher Sprachwert in die Lieferung darf, wären
// genau die zweite Wahrheit, die beim nächsten Befund nur an einer Stelle nachgeführt wird.
export function textFuerSprache(
  paket: Pick<LokalisierungsPaket, "languages">,
  record: LokalisierungsRecord,
  sprache: string,
): LokalisierungsText | undefined {
  // ZAHN 1: nur eine von der Lieferung GEFÜHRTE Sprache darf überhaupt nachschlagen.
  if (!paket.languages.includes(sprache)) {
    return undefined;
  }
  const fund = (record as unknown as Record<string, unknown>)[sprache];
  // ZAHN 2: es muss ein Text in der Form der Lieferung sein.
  return istLokalisierungsText(fund) ? fund : undefined;
}

/** Trägt dieser Wert wirklich Titel und Absätze — oder ist er nur zufällig vorhanden? */
function istLokalisierungsText(wert: unknown): wert is LokalisierungsText {
  if (typeof wert !== "object" || wert === null) {
    return false;
  }
  const t = wert as Partial<LokalisierungsText>;
  return (
    typeof t.title === "string" &&
    Array.isArray(t.paragraphs) &&
    t.paragraphs.every((p) => typeof p === "string")
  );
}

/** Der Abdruck der gelieferten ÜBERSETZUNG — Titel und Absätze in der Form der Lieferung. */
export function uebersetzungsAbdruck(text: LokalisierungsText): string {
  return createHash("sha256")
    .update(`${text.title}\n\n${text.paragraphs.join("\n\n")}`, "utf8")
    .digest("hex");
}

/**
 * ================================================================================================
 * DER QUELLABGLEICH — DER EINE BEWEIS, DEN DIE LIEFERUNG WIRKLICH MITBRINGT.
 * ================================================================================================
 *
 * Die Lieferung nennt je Datensatz `source_body_sha256`. Gemessen an der beiliegenden Datei ist das
 * der SHA-256 von `en.paragraphs.join("\n\n")` — für alle 36 Datensätze mit Seiten-Id nachgerechnet
 * (`lesevarianten.test.ts`, Q0). GENAU DIESE Zeichenfolge legt das Demopaket als Kernaussage seiner
 * Grundlagen-Objekte ab (`example-packages/demo-pakete.ts`, `baselineStatement`), und das Manifest
 * führt sie als `bodySha256` je Baustein mit.
 *
 * DARAUS FOLGT DIE PRÜFUNG, und sie ist eine echte: stimmt der Abdruck der gespeicherten
 * Kernaussage mit dem gelieferten überein, ist BELEGT, dass diese Übersetzung zu genau diesem
 * Originaltext gehört → `bestaetigt`.
 *
 * WO ER NICHT AUFGEHT, WIRD NICHTS ZURECHTGEBOGEN. Ein über Confluence importiertes Objekt trägt
 * eine vom Import erzeugte Kernaussage, nicht den Rohkörper; dort schlägt der Vergleich fehl. Das
 * heisst dann `unbestaetigt` — der Beweis fehlt. Es wird KEINE Normalisierung auf Verdacht
 * versucht (Kürzen, Trimmen, HTML-Strippen, bis es passt), und die Variante wird auch nicht als
 * frisch übersetzt ausgegeben. Die Fläche sagt „Zuordnung unbestätigt" und der Leser weiss, woran
 * er ist.
 */
export function quellabgleichFuer(
  record: Pick<LokalisierungsRecord, "source_body_sha256">,
  ko: Pick<KnowledgeObject, "statement">,
): Quellabgleich {
  if (!record.source_body_sha256) {
    return "unbestaetigt";
  }
  const abdruck = createHash("sha256").update(ko.statement, "utf8").digest("hex");
  return abdruck === record.source_body_sha256 ? "bestaetigt" : "unbestaetigt";
}

/** Ergänzt die beim LESEN ermittelte Änderungsauskunft. */
export function mitAenderungsauskunft(
  variante: Lesevariante,
  ko: Pick<KnowledgeObject, "title" | "statement" | "bodyHtml">,
): LesevarianteSicht {
  return { ...variante, originalGeaendert: originalAbdruck(ko) !== variante.originalSha256 };
}

// ================================================================================================
// DIE ABLAGE
// ================================================================================================

export const LESEVARIANTEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS lesevarianten (
  ko_id text NOT NULL,
  lang text NOT NULL,
  original_language text NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  body_html text NOT NULL,
  herkunft text NOT NULL,
  status text NOT NULL,
  source_body_sha256 text,
  original_sha256 text NOT NULL,
  uebersetzung_sha256 text NOT NULL,
  quellabgleich text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (ko_id, lang)
);
`;

export interface LesevariantenRepo {
  /** Legt an oder aktualisiert. Rückgabe: `true`, wenn es die Zeile vorher schon gab. */
  upsert(variante: Lesevariante): Promise<boolean>;
  forKo(koId: string): Promise<Lesevariante[]>;
  get(koId: string, lang: string): Promise<Lesevariante | undefined>;
  /** Alle Varianten einer Sprache — die Grundmenge der Listenanzeige. */
  inSprache(lang: string): Promise<Lesevariante[]>;
}

export class InMemoryLesevariantenRepo implements LesevariantenRepo {
  private readonly zeilen = new Map<string, Lesevariante>();

  private static schluessel(koId: string, lang: string): string {
    return `${koId} ${lang}`;
  }

  async upsert(variante: Lesevariante): Promise<boolean> {
    const key = InMemoryLesevariantenRepo.schluessel(variante.koId, variante.lang);
    const vorhanden = this.zeilen.has(key);
    this.zeilen.set(key, { ...variante });
    return vorhanden;
  }

  async forKo(koId: string): Promise<Lesevariante[]> {
    return [...this.zeilen.values()].filter((v) => v.koId === koId).map((v) => ({ ...v }));
  }

  async get(koId: string, lang: string): Promise<Lesevariante | undefined> {
    const treffer = this.zeilen.get(InMemoryLesevariantenRepo.schluessel(koId, lang));
    return treffer ? { ...treffer } : undefined;
  }

  async inSprache(lang: string): Promise<Lesevariante[]> {
    return [...this.zeilen.values()].filter((v) => v.lang === lang).map((v) => ({ ...v }));
  }
}

interface LesevarianteZeile {
  ko_id: string;
  lang: string;
  original_language: string;
  title: string;
  statement: string;
  body_html: string;
  herkunft: string;
  status: string;
  source_body_sha256: string | null;
  original_sha256: string;
  uebersetzung_sha256: string;
  quellabgleich: string;
  updated_at: Date | string;
}

function ausZeile(zeile: LesevarianteZeile): Lesevariante {
  return {
    koId: zeile.ko_id,
    lang: zeile.lang,
    originalLanguage: zeile.original_language,
    title: zeile.title,
    statement: zeile.statement,
    bodyHtml: zeile.body_html,
    herkunft: zeile.herkunft,
    status: zeile.status,
    sourceBodySha256: zeile.source_body_sha256,
    originalSha256: zeile.original_sha256,
    uebersetzungSha256: zeile.uebersetzung_sha256,
    // Ein unbekannter Wert aus der Ablage wird NICHT zu „bestaetigt" gerundet: fehlt der Beleg
    // oder ist er unlesbar, ist die Auskunft „unbestaetigt" (fail-closed).
    quellabgleich: zeile.quellabgleich === "bestaetigt" ? "bestaetigt" : "unbestaetigt",
    updatedAt:
      zeile.updated_at instanceof Date ? zeile.updated_at.toISOString() : String(zeile.updated_at),
  };
}

export class PgLesevariantenRepo implements LesevariantenRepo {
  constructor(private readonly pool: Pool) {}

  async upsert(variante: Lesevariante): Promise<boolean> {
    // `xmax = 0` ist in Postgres die kanonische Unterscheidung „eingefügt" gegen „aktualisiert"
    // eines `ON CONFLICT DO UPDATE` — sie kostet keine zweite Abfrage und keine Wettlaufluecke.
    const res = await this.pool.query<{ war_neu: boolean }>(
      `INSERT INTO lesevarianten(
         ko_id, lang, original_language, title, statement, body_html,
         herkunft, status, source_body_sha256, original_sha256,
         uebersetzung_sha256, quellabgleich, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (ko_id, lang) DO UPDATE SET
         original_language = EXCLUDED.original_language,
         title = EXCLUDED.title,
         statement = EXCLUDED.statement,
         body_html = EXCLUDED.body_html,
         herkunft = EXCLUDED.herkunft,
         status = EXCLUDED.status,
         source_body_sha256 = EXCLUDED.source_body_sha256,
         original_sha256 = EXCLUDED.original_sha256,
         uebersetzung_sha256 = EXCLUDED.uebersetzung_sha256,
         quellabgleich = EXCLUDED.quellabgleich,
         updated_at = EXCLUDED.updated_at
       RETURNING (xmax = 0) AS war_neu`,
      [
        variante.koId,
        variante.lang,
        variante.originalLanguage,
        variante.title,
        variante.statement,
        variante.bodyHtml,
        variante.herkunft,
        variante.status,
        variante.sourceBodySha256,
        variante.originalSha256,
        variante.uebersetzungSha256,
        variante.quellabgleich,
        variante.updatedAt,
      ],
    );
    return res.rows[0]?.war_neu === false;
  }

  async forKo(koId: string): Promise<Lesevariante[]> {
    const res = await this.pool.query<LesevarianteZeile>(
      "SELECT * FROM lesevarianten WHERE ko_id=$1",
      [koId],
    );
    return res.rows.map(ausZeile);
  }

  async get(koId: string, lang: string): Promise<Lesevariante | undefined> {
    const res = await this.pool.query<LesevarianteZeile>(
      "SELECT * FROM lesevarianten WHERE ko_id=$1 AND lang=$2",
      [koId, lang],
    );
    const zeile = res.rows[0];
    return zeile ? ausZeile(zeile) : undefined;
  }

  async inSprache(lang: string): Promise<Lesevariante[]> {
    const res = await this.pool.query<LesevarianteZeile>(
      "SELECT * FROM lesevarianten WHERE lang=$1",
      [lang],
    );
    return res.rows.map(ausZeile);
  }
}

// ================================================================================================
// DIE ZUORDNUNG
// ================================================================================================

export type Zuordnungsweg = "confluence" | "paketschluessel";

/**
 * Der Providername, den der Confluence-Import an jede Quelle schreibt
 * (`services/confluence/src/mapper.ts`, `provider: "Confluence"`). Verglichen wird über
 * `importProviderKey`, also unabhängig von Gross-/Kleinschreibung und Rand-Leerzeichen.
 */
export const CONFLUENCE_PROVIDER = "Confluence";

export interface Zuordnung {
  record: LokalisierungsRecord;
  ko: KnowledgeObject;
  weg: Zuordnungsweg;
}

export interface Zuordnungsbefund {
  /** EIN Eintrag je (Datensatz × Wissensobjekt) — ein Datensatz kann MEHRERE Objekte bedienen. */
  treffer: Zuordnung[];
  /** Die Schlüssel der Datensätze, für die KEIN Wissensobjekt im Bestand steht — benannt, nicht gezählt. */
  ohneObjekt: string[];
}

/** Ein Herkunftsanker der Lieferung: welche `KoSource` gehört zu diesem Datensatz? */
export interface Anker {
  externalId: string;
  weg: Zuordnungsweg;
  /**
   * Der Provider, den die Quelle führen MUSS. NIE `null` — eine Kennung allein ist kein Anker.
   *
   * JOB 3326 R2 (Codex 9e24066d): Runde 2 liess den Confluence-Anker zunächst jeden Provider gelten
   * („welcher Provider die Seiten-Id führt, entscheidet der Import"). Das war falsch, und der
   * Bestand sagt warum: `importStatusKey` (confluence-import.ts) hält ausdrücklich fest
   * „externalId ist EINDEUTIG JE PROVIDER; ein zweiter Provider mit zufällig gleicher externalId
   * erzeugt KEINEN falschen Status." Diese Zuordnung liest den GANZEN Bestand — eine Jira-Nummer
   * oder ein fremder Anker mit derselben Ziffernfolge bekäme sonst eine Advisor-Übersetzung
   * angehängt und der Leser läse etwas, das mit seinem Objekt nichts zu tun hat.
   */
  provider: string;
}

/**
 * Führt diese Quelle den geforderten Provider? Der Vergleich läuft über `importProviderKey` —
 * dieselbe Normalisierung wie Queue, Status-Abgleich und `acceptToKo` („Confluence"/" confluence "
 * sind derselbe Schlüssel; ein Anker OHNE Provider zählt als Confluence, deckungsgleich mit dem
 * Pg-Backfill). Für den Paketanker gilt sie genauso: „Beispielpaket" ist ein eigener Schlüssel.
 */
function providerPasst(gefordert: string, gefunden: string | null): boolean {
  return importProviderKey(gefunden) === importProviderKey(gefordert);
}

/**
 * ================================================================================================
 * DIE ANKER EINES DATENSATZES — BEIDE, NICHT DER ERSTE (Codex 071152c5).
 * ================================================================================================
 *
 * Ein Datensatz der Lieferung kann ZWEI Wissensobjekte bedienen, und beide gehören ihm:
 *
 *   · die CONFLUENCE-KOPIE — entstanden aus dem Import der Seite; ihr Herkunftsanker ist die
 *     Seiten-Id (`KoSource.externalId` = `confluence_id`).
 *   · das PAKETOBJEKT — einer der sechs Grundlagen-Bausteine des Demopakets `advisor-ict-en-v1`.
 *     Sein Anker ist `<paket>/<key>` beim Provider `Beispielpaket`; genau so schreibt ihn
 *     `example-packages/demo-pakete.ts` (`externalIdOf`, `quelle.provider = EXAMPLE_PROVIDER`).
 *
 * Bis Runde 1 brach die Suche beim ERSTEN Treffer ab. Weil die sechs Grundlagen-Schlüssel
 * (S02, S04, C01, C02, T01, T03) auch eine Seiten-Id tragen, gewann immer die Confluence-Kopie —
 * und die sechs Paketobjekte, die Pedi in der Vorführung ZUERST lädt, wären ohne Übersetzung
 * geblieben. Deshalb liefert diese Funktion ALLE Anker, und `ordneZu` bedient alle.
 *
 * KEINE TOLERANZ MEHR: Runde 1 erkannte zusätzlich `<paket>-<key>` und `beispiel-<paket>-<key>`,
 * weil das Demopaket damals noch nicht im Baum lag und seine Schreibweise nicht messbar war. Es
 * liegt jetzt vor; es gilt die EINE echte Schreibweise, und `lesevarianten.test.ts` A4 hält sie
 * gegen die geladenen Objekte des echten Pakets.
 */
export function ankerFuer(paketId: string, record: LokalisierungsRecord): Anker[] {
  const anker: Anker[] = [];
  if (record.confluence_id) {
    // Der Confluence-Anker ist die Seiten-Id BEIM PROVIDER `Confluence` — genau das Paar, das der
    // Mapper schreibt (`services/confluence/src/mapper.ts`: `externalId: page.id`,
    // `provider: "Confluence"`). Der Providername steht als Zeichenkette hier, weil `confluence`
    // ein FREMDES Modul ist, dessen Adapterkonstante die Kompositionswurzel nicht importiert; die
    // Bindung an den echten Wert hält `lesevarianten.test.ts` A7 gegen den Mapper-Vertrag.
    anker.push({
      externalId: record.confluence_id,
      weg: "confluence",
      provider: CONFLUENCE_PROVIDER,
    });
  }
  anker.push({
    externalId: `${paketId}/${record.key}`,
    weg: "paketschluessel",
    provider: EXAMPLE_PROVIDER,
  });
  return anker;
}

/**
 * Ordnet die Datensätze der Lieferung den vorhandenen Wissensobjekten zu. LEGT NICHTS AN: was kein
 * Objekt findet, wird beim Namen genannt und bleibt unübersetzt (die Lieferung ist ein
 * Lesekatalog, kein Wissensbestand — siehe `rule` in der Datei selbst).
 *
 * Die Word-/OneDrive-Datensätze der Lieferung (OD01–OD05, WORD-NEW, WORD-COMPARE) haben weder eine
 * Seiten-Id noch ein Paketobjekt. Sie werden zugeordnet, WENN ein Objekt mit passendem Paketanker
 * existiert — und sonst beim Namen genannt. Erfunden wird für sie nichts.
 */
export function ordneZu(
  paketId: string,
  records: readonly LokalisierungsRecord[],
  kos: readonly KnowledgeObject[],
): Zuordnungsbefund {
  // Anker → ALLE Objekte, die ihn führen. Bewusst eine Liste: träfe hier eine Map auf das erste
  // Objekt, wäre genau der Fehler zurück, den diese Runde behebt.
  const jeAnker = new Map<string, { ko: KnowledgeObject; provider: string | null }[]>();
  for (const ko of kos) {
    for (const quelle of ko.sources ?? []) {
      if (!quelle.externalId) {
        continue;
      }
      const liste = jeAnker.get(quelle.externalId) ?? [];
      liste.push({ ko, provider: quelle.provider ?? null });
      jeAnker.set(quelle.externalId, liste);
    }
  }
  const treffer: Zuordnung[] = [];
  const ohneObjekt: string[] = [];
  for (const record of records) {
    // Je Datensatz höchstens EIN Eintrag pro Objekt: trüge ein Objekt beide Anker, entstünde sonst
    // eine zweite Zeile für dieselbe Variante.
    const gesehen = new Set<string>();
    let gefunden = 0;
    for (const anker of ankerFuer(paketId, record)) {
      for (const kandidat of jeAnker.get(anker.externalId) ?? []) {
        if (!providerPasst(anker.provider, kandidat.provider)) {
          continue;
        }
        if (gesehen.has(kandidat.ko.id)) {
          continue;
        }
        gesehen.add(kandidat.ko.id);
        treffer.push({ record, ko: kandidat.ko, weg: anker.weg });
        gefunden += 1;
      }
    }
    if (gefunden === 0) {
      ohneObjekt.push(record.key);
    }
  }
  return { treffer, ohneObjekt };
}

// ================================================================================================
// DAS LADEN
// ================================================================================================

export interface LesevariantenLadeBilanz {
  paket: string;
  /** Anzahl der Datensätze in der Lieferung. */
  records: number;
  /** Die geladenen Sprachen (die Sprachen der Lieferung ohne die Originalsprache). */
  sprachen: string[];
  /** DATENSÄTZE mit mindestens einem gefundenen Wissensobjekt. */
  zugeordnet: number;
  /** OBJEKTE, die eine Variante bekommen haben — ein Datensatz kann zwei bedienen. */
  objekte: number;
  ueberConfluence: number;
  ueberPaketschluessel: number;
  /** Angelegte Varianten (Objekt × Sprache). */
  neu: number;
  /** Angefasste vorhandene Varianten — beim zweiten Laden desselben Pakets ist `neu` 0 und dies die Zahl. */
  aktualisiert: number;
  /**
   * Objekte, deren ÜBERSETZUNGSTEXT sich in diesem Lauf wirklich geändert hat. Nur bei ihnen wird
   * der Original-Abdruck neu gesetzt — s. `originalSha256`.
   */
  textGeaendert: string[];
  /** Datensätze ohne Wissensobjekt — BENANNT, nicht nur gezählt. */
  nichtZugeordnet: string[];
  /**
   * Objekte, deren Original NACH diesem Lauf nicht mehr zum Abdruck der Übersetzung passt — die
   * Warnung „Original seit Übersetzung geändert" steht also weiterhin. Sie wird durch das Laden
   * ausdrücklich NICHT weggewischt: ein Ladeklick ändert die Übersetzung nicht.
   */
  originalGeaendert: string[];
  /** Varianten, deren Zuordnung gegen den gelieferten Quellabdruck BELEGT ist. */
  quellabgleichBestaetigt: number;
  /** Varianten ohne diesen Beleg — ehrlich gezählt, nicht weggerundet. */
  quellabgleichUnbestaetigt: number;
  /** Datensätze, die für eine Sprache keinen Text tragen — ehrlich benannt statt still übersprungen. */
  ohneText: string[];
}

export interface LesevariantenLadeDeps {
  repo: LesevariantenRepo;
  /** Der Bestand, gegen den zugeordnet wird (ungetrimmt — das Laden ist ein Admin-Vorgang). */
  kos(): Promise<KnowledgeObject[]>;
  audit?: AuditService;
  jetzt?(): Date;
}

/**
 * Der Text der Variante. Die Absätze der Lieferung werden zu `<p>`-Absätzen; die Kernaussage ist
 * der ERSTE Absatz. Bewusst KEIN Durchreichen fremden HTMLs: die Lieferung liefert reinen Text,
 * und was hier entsteht, ist genau daraus gebaut.
 */
function absaetzeZuHtml(paragraphs: readonly string[]): string {
  return paragraphs.map((p) => `<p>${entschaerfe(p)}</p>`).join("");
}

function entschaerfe(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Lädt EIN Lieferpaket idempotent: zweites Laden aktualisiert die vorhandenen Zeilen und legt
 * nichts doppelt an (Primärschlüssel ko_id+lang). Es entsteht KEIN Wissensobjekt und es wird keines
 * verändert — der Vorgang schreibt ausschließlich in `lesevarianten`.
 */
export async function ladeLesevarianten(
  deps: LesevariantenLadeDeps,
  paket: LokalisierungsPaket,
  actor: string,
): Promise<LesevariantenLadeBilanz> {
  const jetzt = (deps.jetzt?.() ?? new Date()).toISOString();
  const kos = await deps.kos();
  const { treffer, ohneObjekt } = ordneZu(paket.package_id, paket.records, kos);
  // Die Originalsprache steht je Datensatz; geladen werden alle ANDEREN Sprachen der Lieferung.
  const sprachen = [
    ...new Set(
      paket.records.flatMap((r) => paket.languages.filter((l) => l !== r.original_language)),
    ),
  ];
  const bilanz: LesevariantenLadeBilanz = {
    paket: paket.package_id,
    records: paket.records.length,
    sprachen,
    zugeordnet: new Set(treffer.map((t) => t.record.key)).size,
    objekte: new Set(treffer.map((t) => t.ko.id)).size,
    ueberConfluence: treffer.filter((t) => t.weg === "confluence").length,
    ueberPaketschluessel: treffer.filter((t) => t.weg === "paketschluessel").length,
    neu: 0,
    aktualisiert: 0,
    textGeaendert: [],
    nichtZugeordnet: ohneObjekt,
    originalGeaendert: [],
    quellabgleichBestaetigt: 0,
    quellabgleichUnbestaetigt: 0,
    ohneText: [],
  };
  for (const { record, ko } of treffer) {
    const abdruck = originalAbdruck(ko);
    for (const lang of paket.languages) {
      if (lang === record.original_language) {
        continue;
      }
      // JOB 3363 R2: DIESELBE Sperre wie an der Kandidatenroute. Hier kommt `lang` zwar aus
      // `paket.languages`, ist also schon kontrolliert — aber die Frage „welcher Wert darf in den
      // Datensatz?" wird an EINER Stelle beantwortet, nicht an der, die gerade auffiel. Ein
      // Datensatz mit kaputtem Textfeld zählt jetzt als „ohne Text" statt eine Ausnahme zu werfen.
      const text = textFuerSprache(paket, record, lang);
      if (!text || text.paragraphs.length === 0) {
        bilanz.ohneText.push(`${record.key}/${lang}`);
        continue;
      }
      const vorher = await deps.repo.get(ko.id, lang);
      const uebersetzungSha256 = uebersetzungsAbdruck(text);
      // ==========================================================================================
      // DIE EINE ENTSCHEIDUNG DIESES LAUFS: IST DAS EINE NEUE ÜBERSETZUNG ODER DIESELBE?
      // ==========================================================================================
      //
      // DIESELBE → der Original-Abdruck von damals BLEIBT STEHEN, und mit ihm die Warnung „Original
      // seit Übersetzung geändert". Würde er hier auf den heutigen Stand gesetzt, verschwände die
      // Warnung durch einen Ladeklick, obwohl die Übersetzung unverändert alt ist (Codex e4b79ac9).
      // Auch `quellabgleich` und `updatedAt` bleiben: beide beschreiben den Augenblick, in dem
      // DIESE Übersetzung abgelegt wurde, und dieser Augenblick ist nicht jetzt.
      //
      // NEU → der Abdruck wird gesetzt und der Quellabgleich neu erhoben; die Übersetzung ist
      // frisch gegen das heutige Original.
      const gleicheUebersetzung = vorher?.uebersetzungSha256 === uebersetzungSha256;
      if (vorher && !gleicheUebersetzung) {
        bilanz.textGeaendert.push(ko.id);
      }
      const originalSha256 = gleicheUebersetzung && vorher ? vorher.originalSha256 : abdruck;
      const quellabgleich =
        gleicheUebersetzung && vorher ? vorher.quellabgleich : quellabgleichFuer(record, ko);
      const warVorhanden = await deps.repo.upsert({
        koId: ko.id,
        lang,
        originalLanguage: record.original_language,
        title: text.title,
        statement: text.paragraphs[0] ?? "",
        bodyHtml: absaetzeZuHtml(text.paragraphs),
        herkunft: `lokale Lieferung ${paket.package_id}`,
        status: record.translation_status,
        sourceBodySha256: record.source_body_sha256 ?? null,
        originalSha256,
        uebersetzungSha256,
        quellabgleich,
        updatedAt: gleicheUebersetzung && vorher ? vorher.updatedAt : jetzt,
      });
      if (warVorhanden) {
        bilanz.aktualisiert += 1;
      } else {
        bilanz.neu += 1;
      }
      if (quellabgleich === "bestaetigt") {
        bilanz.quellabgleichBestaetigt += 1;
      } else {
        bilanz.quellabgleichUnbestaetigt += 1;
      }
      // Der Bericht steht NACH dem Schreiben und beschreibt den Zustand, den der Leser gleich
      // sieht — nicht den, der vorher galt.
      if (originalSha256 !== abdruck && !bilanz.originalGeaendert.includes(ko.id)) {
        bilanz.originalGeaendert.push(ko.id);
      }
    }
  }
  await deps.audit?.record({
    actor,
    action: "lesevarianten.load",
    target: paket.package_id,
    payload: {
      records: bilanz.records,
      zugeordnet: bilanz.zugeordnet,
      objekte: bilanz.objekte,
      neu: bilanz.neu,
      aktualisiert: bilanz.aktualisiert,
      textGeaendert: bilanz.textGeaendert,
      nichtZugeordnet: bilanz.nichtZugeordnet,
      quellabgleichBestaetigt: bilanz.quellabgleichBestaetigt,
      quellabgleichUnbestaetigt: bilanz.quellabgleichUnbestaetigt,
    },
  });
  return bilanz;
}

// ================================================================================================
// JOB 3363 · DIE LESEÜBERSETZUNG EINES NOCH NICHT ANGENOMMENEN KANDIDATEN.
// ================================================================================================
//
// WARUM ES DAFÜR KEINE GESPEICHERTE ZEILE GIBT — UND KEINE GEBEN DARF. Alles oben in dieser Datei
// hängt am WISSENSOBJEKT: Primärschlüssel `ko_id + lang`, Original-Abdruck aus `ko.title/statement/
// bodyHtml`, Änderungsauskunft gegen genau dieses Objekt. Ein Import-Kandidat der Prüfkarte ist
// aber noch KEIN Wissensobjekt — `koId` ist `null`, bis jemand „Annehmen" drückt
// (`library-analytics/src/service.ts`). Ihm eine Zeile mit erfundener KO-Kennung zu geben, hiesse
// entweder ein Wissensobjekt zu erfinden oder die Ablage zu belügen; beides wäre in der Vorführung
// genau der Betrug, den dieser Auftrag ausschliesst.
//
// DIE ANTWORT IST DESHALB EINE REINE AUFLÖSUNG, KEIN SCHREIBVORGANG: Provider und Quellkennung des
// Kandidaten werden gegen dieselben Anker gehalten wie beim Laden am Wissensobjekt — `ankerFuer`
// und `providerPasst`, nicht eine zweite Fassung davon. Es entsteht nichts, es ändert sich nichts;
// die Auskunft lebt genau so lange wie der Aufruf.
//
// WAS SIE NICHT BEANTWORTEN KANN, sagt sie auch nicht: „Original seit der Übersetzung geändert" ist
// eine Aussage ÜBER EINEN ZEITPUNKT — den, an dem die Übersetzung abgelegt wurde. Für einen
// Kandidaten gibt es diesen Zeitpunkt nicht, also gibt es die Aussage hier nicht (und darum trägt
// `KandidatenLesevariante` das Feld `originalGeaendert` ausdrücklich NICHT). Der Quellabgleich
// dagegen ist beantwortbar: er vergleicht den gelieferten Abdruck mit dem Text, der vorliegt.

/**
 * Die Herkunft eines Import-Kandidaten, so schmal wie die Frage: Provider und Quellkennung. Genau
 * die zwei Felder, die `ImportItem` führt (`library-analytics/src/types.ts`) und die den Anker
 * bilden. Bewusst kein `ImportItem` im Vertrag: diese Datei entscheidet über Übersetzungen, nicht
 * über Importe.
 */
export interface Kandidatenherkunft {
  provider?: string | null | undefined;
  externalId?: string | null | undefined;
}

/**
 * Die live aufgelöste Variante eines Kandidaten. Sie trägt DIESELBEN Kennzeichnungsfelder wie die
 * gespeicherte (`originalLanguage`, `herkunft`, `status`, `quellabgleich`) — und ausdrücklich
 * KEINE `koId`, weil es keine gibt.
 */
export interface KandidatenLesevariante {
  lang: string;
  originalLanguage: string;
  title: string;
  statement: string;
  /**
   * Der übersetzte Fließtext, in derselben entschärften `<p>`-Form wie am Wissensobjekt.
   *
   * DIE PRÜFKARTE ZEIGT IHN HEUTE NICHT (Auftrag §5.2 nennt Titel und Kernaussage): der GANZE
   * importierte Seitentext bleibt dort das ORIGINAL, weil er der Prüfgegenstand ist — wer
   * entscheidet, ob dieser Beitrag in den Bestand darf, entscheidet über den Originaltext. Er steht
   * trotzdem in der Antwort (Auftrag §5.1 „title/statement/body"), und der Client benutzt ihn als
   * Tragfähigkeitsprüfung: eine abgeschnittene Antwort ohne Fließtext gilt als keine Variante,
   * genau wie am Wissensobjekt.
   */
  bodyHtml: string;
  /** `lokale Lieferung <package_id>` — dieselbe Herkunftsangabe wie an der gespeicherten Variante. */
  herkunft: string;
  /** Der Übersetzungsstand aus der Lieferung. Die Variante ist NIE Freigabegegenstand. */
  status: string;
  quellabgleich: Quellabgleich;
  /** Der Datensatzschlüssel der Lieferung, aus dem dieser Text stammt — Herkunft im Klartext. */
  recordKey: string;
}

/**
 * Löst die Leseübersetzung eines Kandidaten aus der lokalen Lieferung auf — oder `undefined`.
 *
 * DREI GRÜNDE FÜR `undefined`, alle ehrlich:
 *   · der Kandidat trägt gar keine Quellkennung (dann gibt es nichts anzuknüpfen),
 *   · kein Datensatz der Lieferung führt diesen Anker BEIM PASSENDEN PROVIDER,
 *   · die gewünschte Sprache ist die Originalsprache des Datensatzes oder er trägt dort keinen Text.
 *
 * DER LETZTE FALL IST DER WICHTIGE: die Lieferung führt zu jedem Datensatz AUCH das englische
 * Original. Es als „Übersetzung · Herkunft: lokale Lieferung … · keine Freigabe" auszugeben, wäre
 * eine falsche Auskunft über den Originaltext. In die Originalsprache gibt es keine Leseübersetzung
 * — und die Fläche zeigt dann schlicht das Original ohne Hinweis.
 */
export function kandidatenLesevariante(
  lang: string,
  herkunft: Kandidatenherkunft,
  original: Pick<KnowledgeObject, "statement">,
): KandidatenLesevariante | undefined {
  const externalId = herkunft.externalId?.trim();
  if (!externalId) {
    return undefined;
  }
  const sprache = lang.trim();
  for (const paket of alleLokalisierungsPakete()) {
    for (const record of paket.records) {
      // DIESELBE Ankerbildung und DERSELBE Providervergleich wie beim Laden am Wissensobjekt.
      const passt = ankerFuer(paket.package_id, record).some(
        (anker) =>
          anker.externalId === externalId &&
          providerPasst(anker.provider, herkunft.provider ?? null),
      );
      if (!passt) {
        continue;
      }
      if (sprache === record.original_language) {
        return undefined;
      }
      // JOB 3363 R2 (BEN): der Sprachwert kommt aus der Adresszeile und darf den Datensatz nur
      // über diese eine Sperre erreichen — s. `textFuerSprache`. Alles, was die Lieferung nicht als
      // Sprache führt, ist hier schlicht „keine Variante": 404, kein Text, keine Ausnahme.
      const text = textFuerSprache(paket, record, sprache);
      if (!text || text.paragraphs.length === 0) {
        return undefined;
      }
      return {
        lang: sprache,
        originalLanguage: record.original_language,
        title: text.title,
        statement: text.paragraphs[0] ?? "",
        bodyHtml: absaetzeZuHtml(text.paragraphs),
        herkunft: `lokale Lieferung ${paket.package_id}`,
        status: record.translation_status,
        // DIESELBE Prüfung wie am Wissensobjekt: der gelieferte Quellabdruck gegen den Text, der
        // wirklich vorliegt. Bei einer importierten Confluence-Seite ist das die vom Import
        // erzeugte Kernaussage — dort schlägt der Vergleich fehl, und das heisst dann
        // „unbestaetigt": der Beleg fehlt, die Übersetzung ist deshalb nicht falsch.
        quellabgleich: quellabgleichFuer(record, original),
        recordKey: record.key,
      };
    }
  }
  return undefined;
}
