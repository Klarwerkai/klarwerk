import type {
  Confidentiality,
  DokumentHerkunft,
  KnowledgeType,
  NegativwissenAngaben,
} from "../../knowledge-object";
import type { DraftAblauf } from "./ablauf";

// Roh-Inhalt eines Entwurfs (wird später zu einem KO strukturiert/eingereicht).
export interface DraftPayload {
  title?: string;
  statement?: string;
  type?: KnowledgeType;
  category?: string;
  // R-0034 / R-0056 / FR-CAP-08 (aufnahme:20260922:gesamt-wissen-metadaten): das Fachgebiet,
  // erfasst neben der Kategorie. Es reist mit dem Entwurf bis ins KO (`toKoInput`); leer oder
  // fehlend = kein Fachgebiet angegeben — es wird nichts abgeleitet (KnowledgeObject.domain).
  domain?: string;
  // R-0086: Tatsache oder Handlungsanweisung. Der Wert wird erst am Einreichen geprüft
  // (`KoService.create`, INVALID); ein Leerwert heißt „nicht angegeben".
  aussageart?: string;
  tags?: string[];
  conditions?: string[];
  measures?: string[];
  neededValidations?: number;
  asset?: string | null;
  // R-0082: die Anlagenliste des Entwurfs; ist sie da, gilt sie beim Einreichen (s. CreateKoInput).
  assets?: string[];
  // R-1690: Re-Validierungstermin `JJJJ-MM-TT`; geprüft beim Einreichen (`KoService.create`).
  revalidierungAm?: string;
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body übersteht Entwurf/Resume/Promote
  // SCRUM-509 R2: die im Erfassen gewählte Vertraulichkeit übersteht Entwurf/Resume/Promote —
  // sonst ginge die Stufe beim Promote verloren (fail-open). toKoInput reicht sie ans KO durch.
  confidentiality?: Confidentiality;
  // R-1664/R-2179: die geführten Angaben eines Negativwissen-Falls überstehen Entwurf/Resume/Promote.
  // An der Persistenzgrenze normalisiert (`normalizeNegativwissen`); `toKoInput` reicht sie durch.
  // `null` leert sie ausdrücklich (Merge-Vertrag) und wird dort nicht gespeichert.
  negativwissen?: NegativwissenAngaben | null;
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
    // R-1624: der bestätigte Bildbefund eines Foto-Interviews (Klartext, kein Bild — das Foto steht
    // als Bild-Anker im Rumpf). Fehlt er, war es ein normales Interview.
    imageContext?: string;
    // AUFNAHME 20260922 · WISSEN-INTERVIEW: Fragebaum, Lücken-Thema und die ausdrückliche
    // Abschlussbestätigung des Menschen (R-0113) reisen mit, damit ein Fortsetzen nichts davon verliert.
    tree?: boolean;
    topic?: string;
    confirmed?: boolean;
  };
  /**
   * BILDSCHIRMABLÄUFE — die übernommenen Schritte samt Herkunft (Begründung: `./ablauf.ts`).
   * `null` leert ausdrücklich (Merge-Vertrag); ins Wissensobjekt reist nur der daraus erzeugte Rumpf.
   */
  ablauf?: DraftAblauf | null;
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
   * R-0554 — DIE URSPRÜNGLICHE URHEBERIN EINES ÜBERGEBENEN ENTWURFS.
   *
   * Bei der Wissensübergabe (`services/app/src/wissensuebergabe.ts`) wandert `originalAuthor` an
   * die Nachfolgerin — an diesem Feld hängen Sichtbarkeit und „meine Entwürfe", und die gehören
   * jetzt ihr. Wer den Entwurf ursprünglich verfasst hat, bleibt HIER stehen und reist beim
   * Einreichen als `originalAuthor` ans Wissensobjekt (`toKoInput`) — dieselbe Trennung wie
   * `author`/`originalAuthor` dort. Gesetzt nur bei der ersten Übergabe; fehlt das Feld, ist
   * `originalAuthor` die Urheberin. Additiv im JSONB, keine Migration.
   */
  urheber?: string;
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
  /**
   * R-0632 (BEN-Befund, Nacharbeit 5) — AM `Draft`, NICHT IM `DraftPayload`, aus demselben Grund
   * wie `createOperation`: kein Rumpf erreicht dieses Feld (`continueDraft` mischt nur die
   * Nutzlast). Gesetzt bei der Anlage eines Word-Entwurfs; solange es steht, wird eine gespeicherte
   * Stufe nur angehoben, nie gesenkt — auch wenn die Herkunft in der Nutzlast später wechselt.
   */
  stufeNurAnheben?: true;
  /**
   * R-0169 (herkunft-identitaet, Nacharbeit 5) — DIE FASSUNG DES WORD-DOKUMENTS, AUS DEM DIESER
   * ENTWURF KAM.
   *
   * AM `Draft`, NICHT IM `DraftPayload` — aus demselben Grund wie `createOperation` darüber: der
   * Payload ist, was der Client schreiben darf (Speichern, Fortsetzen). Der Fassungsbezug setzt
   * ausschliesslich der Server beim Anlegen über den Word-Weg (capture-routes.ts); ein Client kann
   * ihn über keinen Entwurfsweg setzen oder ändern. `toKoInput` reicht ihn ans Wissensobjekt durch.
   * Additiv im JSONB, keine Migration.
   */
  dokumentHerkunft?: DokumentHerkunft;
  /**
   * AUFNAHME entwurf-in-gemeinsamen-pool-geben (R-2099, FR-CAP-06, Pedi `debbb8e8`) — DER AUTOR HAT
   * DIESEN ENTWURF BEWUSST IN DEN GEMEINSAMEN POOL GEGEBEN.
   *
   * Fehlt das Feld, ist der Entwurf privat — das ist der Standardfall, und jeder Bestand ohne Feld
   * bleibt es. AM `Draft`, NICHT IM `DraftPayload`, aus demselben Grund wie `createOperation`: kein
   * Speichern, Fortsetzen oder Einreichen erreicht es (`continueDraft` mischt nur die Nutzlast,
   * `toKoInput` liest nur die Nutzlast). Setzen und zurücknehmen kann es allein der Autor über
   * `PUT /api/drafts/:id/pool` (`CaptureService.entwurfInPool`). Additiv im JSONB, keine Migration.
   */
  imPool?: true;
  /**
   * JOB 3668 (Papierkorb) — GESETZT BEIM WEICHEN LÖSCHEN.
   *
   * DIE FORM IST ÜBERNOMMEN, NICHT ERFUNDEN: zeichengleich die zwei Felder des Wissensobjekts
   * (`knowledge-object/src/types.ts:354-355`) und aus demselben Grund IM DOKUMENT statt in einer
   * Spalte — additiv, ohne Migration, ohne Rückweg, den jemand fahren müsste.
   *
   * EIN GETRASHTER ENTWURF IST FÜR ALLE GEWÖHNLICHEN WEGE NICHT VORHANDEN. Durchgesetzt wird das
   * an EINER Stelle, nämlich `DraftRepo.findById` (beide Ablagen blenden ihn dort aus) — damit
   * sehen Dienst, Fortsetzen, Speichern, Einreichen, der nächste Schritt und jede Route ihn nicht,
   * ohne dass eine einzige dieser Stellen davon wissen muss.
   *
   * DREI GRÜNDE, AUS DENEN EIN ENTWURF VERSCHWINDET, und nur der erste führt hierher:
   *   1. Der Mensch löscht ihn         → Papierkorb (`CaptureService.deleteDraft`), umkehrbar.
   *   2. Ein Promote hat ihn VERBRAUCHT → `CaptureService.entwurfVerbraucht`, HART. Läge er im
   *      Papierkorb, liesse er sich wiederherstellen und stünde als Dublette neben dem
   *      Wissensobjekt, das aus ihm geworden ist.
   *   3. Endgültiges Löschen aus dem Papierkorb → `CaptureService.purgeTrashedDraft`, HART.
   *
   * `deletedBy` IST OPTIONAL und wird NICHT geraten: der Promote-Weg und Altbestand tragen ihn
   * nicht, und wo niemand ihn gesetzt hat, steht nichts statt einer erfundenen Person. Die
   * Papierkorbzeile sagt dann „wann", nicht „von wem" (REGELN §7: „unbekannt" ist etwas anderes
   * als „leer"). Das Wissensobjekt fällt an dieser Stelle auf `"system"` zurück
   * (`knowledge-object/src/service.ts:3484`) — dieser Name wäre hier eine Behauptung über einen
   * Menschen.
   */
  deletedAt?: string;
  deletedBy?: string;
}

/**
 * JOB 3668 — EIN ENTWURF, VON DEM FESTSTEHT, DASS ER IM PAPIERKORB LIEGT.
 *
 * Der Unterschied zu `Draft` mit optionalem `deletedAt` ist kein Zierrat: die Papierkorb-Sicht und
 * das Wiederherstellen verlassen sich auf den Löschzeitpunkt (sie sortieren danach und zeigen ihn
 * an). Ein optionales Feld zwänge an jeder dieser Stellen zu einem `?? ""`, und damit wäre die
 * Reihenfolge des Papierkorbs eine Vermutung. Dieselbe Trennung führt das Wissensobjekt mit
 * `TrashedKo` (`knowledge-object/src/types.ts:362`).
 *
 * ANDERS ALS `TrashedKo` IST DIES DER GANZE ENTWURF, keine Metadatenzeile. `TrashedKo` ist eine
 * ADMIN-Auskunft über fremde Objekte und gibt deshalb bewusst keine Inhalte heraus. Der
 * Entwurfs-Papierkorb ist die Rückholmöglichkeit des Menschen für SEINE EIGENEN Entwürfe — er
 * zeigt dem Autor, was er ohnehin sehen darf, und die Wiederherstellung braucht den vollen Stand.
 */
export type EntwurfImPapierkorb = Draft & { deletedAt: string };

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
  // JOB 3618 (Q3 c): niemand hat die Vertraulichkeitsstufe gewählt — derselbe Name, den die
  // Anlagerouten für dasselbe Versäumnis schon tragen. NUR DAS FEHLEN; ein vorhandener, aber
  // ungültiger Wert bleibt `INCOMPLETE`. Begründung: `services/capture/src/service.ts`.
  | "MISSING_CONFIDENTIALITY"
  // R-0632: die gespeicherte Stufe eines Word-Entwurfs würde gesenkt — sie wird nur angehoben.
  // Begründung und Abgrenzung: `pruefeKeineHerabstufung` in `services/capture/src/service.ts`.
  | "CONFIDENTIALITY_DOWNGRADE"
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
