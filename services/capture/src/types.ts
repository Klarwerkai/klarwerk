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

export interface Draft {
  id: string;
  payload: DraftPayload;
  originalAuthor: string;
  lastEditor: string;
  createdAt: string;
  updatedAt: string;
}

export type CaptureErrorCode =
  | "NOT_FOUND"
  | "INVALID_NEEDED"
  | "INCOMPLETE"
  | "EMPTY_DRAFT"
  // AUFTRAG-mega20 Block D: der Entwurf beruft sich auf ein gesichertes Original, das es nicht
  // (mehr) gibt. Fail-closed: lieber ein ehrlicher Abbruch als ein Wissensobjekt mit
  // Dokumentinhalt ohne Herkunft.
  | "MISSING_DRAFT_ANCHOR";

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;

  constructor(code: CaptureErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CaptureError";
  }
}
