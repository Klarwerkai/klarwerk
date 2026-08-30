import type { Confidentiality, KnowledgeType } from "../../knowledge-object";

// Roh-Inhalt eines Entwurfs (wird später zu einem KO strukturiert/eingereicht).
export interface DraftPayload {
  title?: string;
  statement?: string;
  type?: KnowledgeType;
  category?: string;
  tags?: string[];
  conditions?: string[];
  measures?: string[];
  neededValidations?: number;
  asset?: string | null;
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body übersteht Entwurf/Resume/Promote
  // SCRUM-509 R2: die im Erfassen gewählte Vertraulichkeit übersteht Entwurf/Resume/Promote —
  // sonst ginge die Stufe beim Promote verloren (fail-open). toKoInput reicht sie ans KO durch.
  confidentiality?: Confidentiality;
  // UI-Herkunft fuer Resume-Routing; keine Persistenzlogik, nur Payload-Metadatum.
  origin?: "tell" | "studio" | "expert" | "frontdoor" | "word_addin";
  // JOB 512 (R5): Zahl der Bilder in der QUELLDATEI, erhoben beim Import VOR jedem Budget-/
  // Formatabzug. Sie reist mit dem Entwurf, weil die Entwurfsgalerie an einem GELADENEN Entwurf
  // rendert und einen Bildverlust ohne Vergleichsgroesse nicht erkennen kann. Reines
  // Payload-Metadatum ohne Persistenzlogik: `normalizeDraftPayload` reicht es ueber `...rest`
  // unveraendert durch. Der Client entscheidet fail-closed (apps/web/src/lib/bildverlust.ts) —
  // fehlt oder unbrauchbar, wird KEIN Verlust behauptet.
  sourceImageCount?: number;
  // AUFTRAG-mega4/mega5 Block A (bens Auflage A): der Entwurf traegt AUCH die uebrigen inhaltlichen,
  // textuell sicherbaren Dirty-Felder, damit „Entwurf speichern" nichts still verliert und
  // „Fortsetzen" sie wiederherstellt: Prueferauswahl, offene/teilweise Quelle, externe Suchanfrage
  // und Interviewfortschritt. `sourceProvider` = Such-/Herkunftsquelle des Treffers (bens Vorschlag),
  // NICHT ein KI-Anbieter. Der volle Treffer-Cache (extResults) wird nach Pedis Datenminimierungs-
  // Entscheid (mega5 Block C) bewusst NICHT persistiert; normalizeDraftPayload streift ihn ab.
  // Alle diese Strukturen werden an der Persistenz-Grenze typ-, mengen- und laengenbegrenzt
  // normalisiert (mega5 Block B, s. service.ts).
  reviewerIds?: string[];
  // ==========================================================================================
  // AUFTRAG-mega20 Block D — DER ENTWURF TRÄGT DIE REFERENZ.
  // ==========================================================================================
  //
  // DER BEFUND. Bis mega19 trug eine wartende Belegstelle NUR Text: Label, Adresse, Auszug,
  // Herkunftsquelle. Die Bindung an das Originaldokument — der lokale Schlüssel (`anchorKey`) und
  // die gesicherte Objektkennung (`objectId`) — lebte ausschliesslich im flüchtigen Zustand der
  // Oberfläche und wurde beim Speichern ABGESTREIFT. Capture.tsx hat die Grenze selbst benannt.
  //
  // DIE FOLGE, ausgeschrieben: nach „Entwurf speichern" und „Fortsetzen" stand der aus einem
  // Dokument übernommene TEXT weiterhin im Body — aber ohne jede Referenz auf sein Original. Der
  // Einreich-Weg sah keine verankerten Quellen mehr, wählte deshalb den einfachen Promote-Pfad,
  // und heraus kam ein Wissensobjekt mit Dokumentinhalt OHNE Herkunft. Genau der Zustand, den
  // mega18 und mega19 an jeder anderen Stelle geschlossen haben — hier lief er über den Umweg
  // eines Zwischenspeicherns weiter.
  //
  // `anchorKey` ist der LOKALE Schlüssel des Ankerdokuments in der Oberfläche (er verbindet
  // Belegstelle und Dokument im Formular), `objectId` die ECHTE, serverseitig vergebene Kennung
  // des gesicherten Originals. Beide reisen mit; geprüft wird ausschliesslich `objectId` — der
  // lokale Schlüssel behauptet nichts über den Bestand und wird deshalb auch nicht geglaubt.
  pendingSources?: {
    label: string;
    url?: string;
    excerpt?: string;
    sourceProvider?: string;
    anchorKey?: string;
    objectId?: string;
  }[];
  /**
   * AUFTRAG-mega20 Block D — DIE GESICHERTEN ORIGINALE des Entwurfs.
   *
   * Getrennt von `pendingSources`, weil es zwei verschiedene Dinge sind: hier steht das DOKUMENT
   * (gesicherte Objektkennung, Name, Typ), dort die ZUORDNUNG einer Belegstelle zu ihm
   * (`anchorKey`). Mehrere Belegstellen teilen sich dasselbe Dokument — sie alle mit Name und Typ
   * zu beladen hieße, dieselbe Angabe mehrfach zu speichern und sie auseinanderlaufen zu lassen.
   *
   * `key` ist derselbe lokale Schlüssel, den `pendingSources[].anchorKey` trägt. Er ist die Brücke
   * INNERHALB des Entwurfs und behauptet nichts über den Bestand; die einzige prüfbare Angabe ist
   * `objectId`, und genau sie prüft der Server (`verifyDraftAnchors`).
   *
   * Name und Typ stehen hier, weil die Erstanlage sie im Anker-Payload braucht und der Entwurf die
   * Bytes des Originals nicht trägt. Dass sie damit aus dem Request statt aus dem gespeicherten
   * ObjectRef stammen, ist der HEUTIGE Stand des Anker-Vertrags (die Umstellung auf den ObjectRef
   * ist ausdrücklich Nach-VIP-2) — dieser Entwurf verschärft ihn nicht und lockert ihn nicht.
   */
  anchorDocuments?: { key: string; objectId: string; name: string; mime: string }[];
  sourceForm?: { label: string; url: string; excerpt: string };
  extQuery?: string;
  interview?: {
    started: boolean;
    answers: string[];
    answer?: string;
    question?: string;
    done?: boolean;
    demo?: boolean;
  };
}

/**
 * JOB 2697 — DER VORGANG, ZU DEM DIESER ENTWURF GEHÖRT.
 *
 * Dieselbe Dreiheit wie beim Wissensobjekt (`services/knowledge-object`): Kennung, Eigentümer,
 * Abdruck der Nutzlast.
 *
 * `actor` wird SERVERSEITIG abgeleitet (`user.id` aus der authentifizierten Anfrage), nie aus dem
 * Rumpf gelesen. Er ist Teil des Schlüssels, damit zwei Menschen dieselbe Kennung benutzen können,
 * ohne sich gegenseitig den Entwurf wegzunehmen.
 *
 * `fingerprint` erkennt den Fall, in dem unter derselben Kennung ein ANDERER Inhalt ankommt —
 * dann ist es kein Wiederholungsversuch, sondern ein neuer Vorgang, und die Route antwortet 409
 * statt still den alten Entwurf zu liefern.
 */
export interface DraftCreateOperation {
  id: string;
  actor: string;
  fingerprint: string;
}

export interface Draft {
  id: string;
  payload: DraftPayload;
  originalAuthor: string;
  lastEditor: string;
  createdAt: string;
  updatedAt: string;
  /**
   * JOB 2697 — OPTIONAL UND AM `Draft`, NICHT IM `DraftPayload`.
   *
   * Der Unterschied ist der, an dem D1 gescheitert ist: `capture.toKoInput` liest den PAYLOAD und
   * trägt ihn beim Einreichen ins Wissensobjekt. Ein Feld am Draft wandert dort nicht mit — die
   * Vorgangskennung bleibt Transport und wird nie Teil des Dokumentinhalts.
   *
   * OPTIONAL, weil der Bestandspfad bleibt: Ein `POST /api/drafts` ohne Kennung verhält sich exakt
   * wie bisher. Die anderen Aufrufer (Mobil, Offline-Queue, `from-docx`) hängen daran.
   */
  createOperation?: DraftCreateOperation;
}

// ================================================================================================
// JOB 1171 D1 (KA8 Stufe 1a) — DER NAECHSTE SINNVOLLE SCHRITT ZU EINEM ENTWURF.
// ================================================================================================
//
// KEIN SICHTBARER NUTZEN. Dieser Typ ist der DATENLIEFERANT, nicht die Karte. Niemand sieht nach
// diesem Bau einen naechsten Schritt; die Karte ist Stufe 1b (Web) und Stufe 2 (Panel).
//
// ADDITIV UND OPTIONAL: unterhalb steht nur Neues. Kein bestehendes Feld aendert sich, keine
// Pflicht wird enger, und `Draft` bleibt unberuehrt — der Schritt ist eine ABLEITUNG aus dem
// Entwurf und wird nirgends an ihm gespeichert.
//
// WARUM ER NICHT GESPEICHERT WIRD: derselbe Grund, aus dem `ext.validity.*` in der Oberflaeche
// ehrlich sagt, seine Werte wuerden „aus dem aktuellen Zustand ABGELEITET, nicht gespeichert". Ein
// persistierter naechster Schritt waere ab dem Moment falsch, in dem sich der Entwurf aendert —
// und niemand saehe ihm an, dass er veraltet ist.
export type NaechsterSchrittArt =
  // Der Entwurf beruft sich auf ein gesichertes Original, das es nicht (mehr) gibt.
  | "anker_fehlt"
  // `toKoInput` wuerde an den KO-Pflichtfeldern abbrechen (INCOMPLETE, s. service.ts).
  | "vervollstaendigen"
  // Nichts steht mehr im Weg — der Entwurf kann zum Wissensobjekt werden.
  | "einreichen";

export interface NaechsterSchritt {
  readonly art: NaechsterSchrittArt;
  /**
   * DIE HERKUNFT DER AUSSAGE: die Felder, die genau diesen Schritt ausgeloest haben.
   *
   * Sie ist der Unterschied zwischen einer Ableitung und einer geratenen Empfehlung. Ein Schritt
   * ohne rueckfuehrbare Herkunft duerfte nicht entstehen — deshalb ist die Liste nie leer, und
   * jeder Eintrag benennt ein Feld, das es wirklich gibt (`anchorsMissing` aus der Ankerpruefung
   * oder ein `payload.*` aus `DraftPayload`).
   */
  readonly herkunft: readonly string[];
}

export type CaptureErrorCode =
  | "NOT_FOUND"
  | "INVALID_NEEDED"
  | "INCOMPLETE"
  | "EMPTY_DRAFT"
  // AUFTRAG-mega20 Block D: der Entwurf beruft sich auf ein gesichertes Original, das es nicht
  // (mehr) gibt. Fail-closed: lieber ein ehrlicher Abbruch als ein Wissensobjekt mit
  // Dokumentinhalt ohne Herkunft.
  | "MISSING_DRAFT_ANCHOR"
  // JOB 2684 D1 (Review R2-17): der Aufrufer hat einen ÄLTEREN Stand des Entwurfs gelesen, als
  // jetzt gespeichert ist — ein zweiter Tab, das Studio, die Vordertür. Sein Schreiben würde still
  // überschreiben; deshalb Konflikt (409), nicht Merge.
  | "DRAFT_STALE"
  // JOB 2684 D3 (R2-17): ein Schreiben OHNE mitgeschickten Stand hat den Compare-and-Swap in der
  // Ablage mehrfach hintereinander verloren (ein anderer Prozess schreibt fortlaufend denselben
  // Entwurf). Kein Datenverlust — nichts wurde überschrieben; der Aufrufer versucht es erneut.
  | "DRAFT_WRITE_CONTENDED"
  // JOB 2697: derselbe Vorgangsschlüssel, ABWEICHENDER Inhalt. Der Mensch hat nach einem
  // Antwortverlust seinen Text geändert; sein neuer Inhalt ist ein NEUER Vorgang. 409 und nicht
  // 400: die Anfrage ist wohlgeformt, der Aufrufer hat nichts falsch gemacht. Der Code steht in
  // `services/app/src/http.ts:65` bereits auf 409 — dort war nichts zu ändern, und die Oberfläche
  // kennt ihn schon (`createConflictOffersRestart` bietet danach einen neuen Vorgang an).
  | "IDEMPOTENCY_PAYLOAD_MISMATCH";

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;

  constructor(code: CaptureErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CaptureError";
  }
}
